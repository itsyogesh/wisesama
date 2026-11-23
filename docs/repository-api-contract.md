# Repository API contract

All paths below are prefixed `/api/v1/intel/repositories`. JSON follows the API's existing `{data,meta}` response wrapper. Session-only authorization. Mutations (including DELETE) require `Content-Type: application/json` and `{}` when no other body is needed. Error bodies contain `error`. No provider credential is returned.

## Safe types

```ts
type Provider = 'github' | 'gitlab';
type Repository = { id:string; name:string; fullName:string; owner:string; defaultBranch:string; url:string };
type Connection = {
  id:string; provider:Provider; accountName:string; installationId:string|null;
  status:string; error:string|null; validatedAt:string|null; createdAt:string;
};
type Selection = { repositoryId:string; branch:string; paths:string[] };
type Source = {
  id:string; projectId:string; connectionId:string; provider:Provider;
  repositoryId:string; repositoryName:string; repositoryUrl:string;
  branch:string; paths:string[]; scope:'repository_inventory'; paused:boolean;
  status:'idle'|'syncing'|'current'|'behind'|'failed'|'paused'|'disconnected'|'access_removed';
  observedCommit:string|null; importedCommit:string|null;
  importedFiles:Array<{path:string;format:string;digest:string;bytes:number;packages:number}>;
  lastSyncedAt:string|null; lastAttemptAt:string|null; nextSyncAt:string; error:string|null;
  // GET /sources additionally joins actual project assessment health:
  lastAssessedAt?:string|null; assessmentError?:string|null;
};
type Snapshot = {
  repository:Repository; commit:string; scope:'repository_inventory';
  packages:Array<{name:string;version:string;ecosystem:'npm'|'PyPI'}>;
  warnings:string[]; digest:string;
  files:Array<{path:string;format:string;digest:string;bytes:number;packages:number}>;
};
```

## Endpoints

| Method/path | Input | Result |
| --- | --- | --- |
| GET `/connections` | — | `{providers:Array<{provider,available:boolean,reason:string|null,permissions:string,method:string}>,connections:Connection[]}` |
| POST `/:provider/start` | `{}` | `{authorizationUrl:string}`; assign browser location to this URL |
| GET `/callback/:provider` | provider callback query | HTTP redirect to provider authorization (GitHub two-stage setup), or `/app/settings/integrations?connection=connected\|failed\|denied` |
| GET `/connections/:id/repositories` | — | `{repositories:Repository[],incomplete:boolean}` |
| GET `/connections/:id/branches` | `?repositoryId=123` | `{branches:Array<{name:string}>,incomplete:boolean}` |
| GET `/connections/:id/discovery` | `?repositoryId=123&branch=main` | `{repository:Repository,commit:string,paths:Array<{path:string,format:string,size:number|null}>,incomplete:boolean,warnings:string[]}` |
| POST `/connections/:id/preview` | `Selection` | `Snapshot` |
| POST `/projects` | `Selection & {connectionId:string,name:string,environment:'production'\|'staging'\|'development',expectedCommit?:string}` | `{project:{id,name},source:Source,assessment:object|null,assessmentError:string|null,warnings:string[]}` |
| GET `/sources` | — | `{sources:Source[]}` |
| POST `/sources/:id/sync` | `{}` | `{source:Source,assessmentError:string|null}` |
| PATCH `/sources/:id` | `{paused?:boolean,branch?:string,paths?:string[]}` at least one | `{source:Source}`; changed branch/paths are preview-validated before saving; sync after saving |
| DELETE `/sources/:id` | `{}` | `{source:Source}`; pauses/detaches source, retains inventory/history |
| DELETE `/connections/:id` | `{}` | `{disconnected:true,message:string}`; erases credentials, disconnects all linked sources; provider app grant is separately revoked in provider settings |

Providers without required configuration return `available:false`. Starting one returns 503; no simulated connection. Source IDs differ from project IDs. A successful import may carry `assessmentError`; it still created a project and must not be retried as another project. The frontend should continue to the created project/inbox and expose assessment retry.

The project import fetches a new immutable snapshot. Interactive callers send the reviewed preview's `commit` as `expectedCommit`; a changed branch tip returns 409 before any project/source write and requires a fresh preview. Automated callers may omit the precondition when they intentionally want the current branch tip.

Supported selected paths: `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `package.json` (exact versions only), `wisesama-inventory.json`; nested paths accepted with bounded discovery and no generated dependency directories, symlinks, or submodules. At most ten paths, 2 MB per file, 4 MB aggregate, 2,000 combined packages. pnpm shared locks are repository-wide, not an inferred service closure.

`scope`, SHA, import timestamp and assessment timestamp are distinct. Failed refresh keeps the last successful inventory. Disconnect does not establish remediation or change finding status. Changed inventories queue assessment; unchanged inventories can acquire new advisories through the normal intelligence scheduler.
