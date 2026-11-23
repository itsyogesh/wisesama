import { isMap, isScalar, isSeq, LineCounter } from 'yaml';
import { parseBoundedYaml } from './bounded-yaml';

export const CI_DEPENDENCY_LIMITS = {
  files: 40,
  workflows: 10,
  fileBytes: 128 * 1024,
  totalBytes: 512 * 1024,
  items: 200,
  yamlNodes: 20_000,
  yamlDepth: 32,
  includeDepth: 8,
} as const;

export type CiDependency = {
  id: string;
  path: string;
  line: number;
  kind: 'action' | 'reusable_workflow' | 'container' | 'gitlab_include' | 'local_action';
  name: string;
  reference: string | null;
  state: 'pinned' | 'locked' | 'mutable' | 'local' | 'unknown';
  detail: string;
  recommendation: string;
};
export type CiDependencyReport = {
  version: 1;
  state: 'observed' | 'attention' | 'unknown';
  items: CiDependency[];
  filesChecked: string[];
  issues: Array<{ path: string; line: number | null; detail: string }>;
  incomplete: boolean;
  limitations: string[];
};
export type CiDependencyFiles = {
  paths: string[];
  contents: Record<string, string>;
  incomplete: boolean;
  unreadable: string[];
};

const workflowPath = (path: string) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path);
const actionPath = (path: string) => /^\.github\/actions\/(?:[^/]+\/)*action\.ya?ml$/.test(path);
const gitlabPath = (path: string) =>
  path === '.gitlab-ci.yml' || /^\.gitlab\/ci\/(?:[^/]+\/)*[^/]+\.ya?ml$/.test(path);
const lockPath = '.github/workflows/actions.lock';
const encoder = new TextEncoder();
const safePath = (path: string) =>
  path.length <= 500 &&
  !path.includes('\\') &&
  !Array.from(path).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  ) &&
  !path.startsWith('/') &&
  !path.split('/').some((part) => !part || part === '.' || part === '..');
/** A fixed allowlist shared by provider collection and the offline skill. */
export const ciDependencyConfigPath = (path: string) =>
  safePath(path) &&
  (workflowPath(path) || actionPath(path) || gitlabPath(path) || path === lockPath);
const scalar = (node: unknown) =>
  isScalar(node) && typeof node.value === 'string' ? node.value : undefined;
const get = (node: unknown, key: string): unknown =>
  isMap(node) ? node.items.find((pair) => scalar(pair.key) === key)?.value : undefined;
const entries = (node: unknown) =>
  isMap(node)
    ? node.items.flatMap((pair) => {
        const key = scalar(pair.key);
        return key === undefined ? [] : [[key, pair.value] as const];
      })
    : [];
const sequence = (node: unknown): unknown[] => (isSeq(node) ? node.items : []);
const dynamic = (value: string) => /\$|\{\{|\}\}|`|\r|\n/.test(value);
const sha = (value: string) => /^[a-fA-F0-9]{40}$/.test(value);
const credentialLike = (value: string) =>
  /(?:gh[pousr]_[A-Za-z0-9]{15,}|github_pat_[A-Za-z0-9_]{15,}|glpat-[A-Za-z0-9_-]{10,}|sk_(?:live|test)_[A-Za-z0-9]{10,}|xox[baprs]-[A-Za-z0-9-]{10,})/.test(
    value,
  );
const ref = (value: string) =>
  value.length <= 200 &&
  !credentialLike(value) &&
  /^[A-Za-z0-9_][A-Za-z0-9_./+-]*$/.test(value) &&
  !value.includes('..') &&
  !value.includes('//') &&
  !value.endsWith('/') &&
  !value.endsWith('.lock');
const remoteAction = (value: string) =>
  /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)@([^@]+)$/.exec(value);
const localPath = (value: string) => {
  const cleaned = value.replace(/^\.\//, '').replace(/^\$\//, '').replace(/^\//, '');
  return safePath(cleaned) && !credentialLike(cleaned) ? cleaned : null;
};
function numericId(node: unknown) {
  return (
    isScalar(node) &&
    typeof node.value === 'number' &&
    Number.isSafeInteger(node.value) &&
    node.value > 0
  );
}
function urlLabel(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.href.length > 1000 ||
      credentialLike(`${url.origin}${url.pathname}`)
    )
      return null;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}
type Parsed = { root: unknown; line: (node: unknown) => number };

/** Extracts bounded static metadata only. No source code, include, action or command is executed. */
export function assessCiDependencies(files: CiDependencyFiles): CiDependencyReport {
  const report: CiDependencyReport = {
    version: 1,
    state: 'unknown',
    items: [],
    filesChecked: [],
    issues: [],
    incomplete: files.incomplete,
    limitations: [
      'Configuration observations at the checked source revision; no workflow execution, deployed exposure or code safety is verified.',
      'External actions, reusable workflows, includes, runtime downloads and runner settings are not fetched or executed. Direct pinning does not establish transitive code integrity.',
      'GitHub lock entries are checked as static configuration only. Enterprise Cloud availability, runtime enforcement, remote commit reachability and source repository identity remain unverified.',
      'GitLab includes and images are assessed using GitLab syntax. GitHub lockfile guarantees do not apply to GitLab.',
    ],
  };
  const issue = (path: string, detail: string, line: number | null = null) => {
    report.incomplete = true;
    if (
      report.issues.length < 50 &&
      !report.issues.some((item) => item.path === path && item.detail === detail)
    )
      report.issues.push({ path, line, detail });
  };
  const candidates = [...new Set(files.paths.filter(ciDependencyConfigPath))].sort();
  const workflows = candidates.filter(workflowPath);
  if (
    candidates.length > CI_DEPENDENCY_LIMITS.files ||
    workflows.length > CI_DEPENDENCY_LIMITS.workflows
  )
    issue(
      '.github/workflows',
      'The configuration file or workflow limit was reached; remaining files were not inspected.',
    );
  const selected = candidates
    .filter(
      (path) => !workflowPath(path) || workflows.indexOf(path) < CI_DEPENDENCY_LIMITS.workflows,
    )
    .slice(0, CI_DEPENDENCY_LIMITS.files);
  const parsed = new Map<string, Parsed | null>();
  let totalBytes = 0;
  function read(path: string): Parsed | null {
    if (parsed.has(path)) return parsed.get(path) ?? null;
    parsed.set(path, null);
    if (
      !selected.includes(path) ||
      files.unreadable.includes(path) ||
      !Object.hasOwn(files.contents, path)
    ) {
      issue(
        path,
        'This referenced configuration was not available within the regular-file read scope.',
      );
      return null;
    }
    const content = files.contents[path]!;
    const bytes = encoder.encode(content).length;
    totalBytes += bytes;
    if (bytes > CI_DEPENDENCY_LIMITS.fileBytes || totalBytes > CI_DEPENDENCY_LIMITS.totalBytes) {
      issue(
        path,
        'The configuration byte limit was reached; its dependency metadata was not inspected.',
      );
      return null;
    }
    try {
      const lines = new LineCounter();
      const doc = parseBoundedYaml(
        content,
        {
          bytes: CI_DEPENDENCY_LIMITS.fileBytes,
          nodes: CI_DEPENDENCY_LIMITS.yamlNodes,
          depth: CI_DEPENDENCY_LIMITS.yamlDepth,
        },
        lines,
      );
      if (!isMap(doc.contents)) throw new Error('unsupported-yaml');
      const value: Parsed = {
        root: doc.contents,
        line: (node) => {
          const range = node && typeof node === 'object' && 'range' in node ? node.range : null;
          return Array.isArray(range) && typeof range[0] === 'number'
            ? lines.linePos(range[0]).line
            : 1;
        },
      };
      parsed.set(path, value);
      report.filesChecked.push(path);
      return value;
    } catch {
      issue(
        path,
        'This YAML mapping is malformed, aliased, unsupported or too deeply nested; its dependencies remain unknown.',
      );
      return null;
    }
  }
  for (const path of files.unreadable.filter(ciDependencyConfigPath))
    issue(path, 'This configuration was unreadable or was not a regular file.');
  let exhausted = false;
  function add(path: string, node: unknown, data: Omit<CiDependency, 'id' | 'path' | 'line'>) {
    if (report.items.length >= CI_DEPENDENCY_LIMITS.items) {
      if (!exhausted)
        issue(
          path,
          'The dependency row limit was reached; remaining dependencies were not inspected.',
        );
      exhausted = true;
      return;
    }
    const line = parsed.get(path)?.line(node) ?? 1;
    report.items.push({
      id: `${path}:${line}:${data.kind}:${report.items.length + 1}`,
      path,
      line,
      ...data,
    });
  }
  const lock = selected.includes(lockPath) ? read(lockPath) : null;
  function locked(workflow: string, value: string, expectedRef: string) {
    if (!lock || scalar(get(lock.root, 'version')) !== 'v0.0.3') return null;
    const listed = sequence(get(get(lock.root, 'workflows'), workflow)).some(
      (node) => scalar(node) === value,
    );
    const item = get(get(lock.root, 'dependencies'), value);
    const commit = scalar(get(item, 'commit'));
    if (
      !listed ||
      scalar(get(item, 'ref')) !== expectedRef ||
      !commit ||
      !/^sha1-[a-fA-F0-9]{40}$/.test(commit) ||
      !numericId(get(item, 'owner_id')) ||
      !numericId(get(item, 'repo_id'))
    )
      return null;
    return commit.slice(5);
  }
  if (lock && scalar(get(lock.root, 'version')) !== 'v0.0.3')
    issue(lockPath, 'The actions lockfile version is unsupported; no lock coverage is assumed.');
  if (lock && (!isMap(get(lock.root, 'workflows')) || !isMap(get(lock.root, 'dependencies'))))
    issue(
      lockPath,
      'The actions lockfile mappings are unsupported; no complete lock coverage is assumed.',
    );
  if (lock)
    for (const workflow of workflows) {
      const listed = get(get(lock.root, 'workflows'), workflow);
      if (listed === undefined) continue;
      if (!isSeq(listed)) {
        issue(lockPath, 'A workflow lock entry is not a supported dependency list.');
        continue;
      }
      for (const entry of listed.items) {
        const value = scalar(entry);
        const match = value ? remoteAction(value) : null;
        if (!value || !match || !locked(workflow, value, match[2]!))
          issue(lockPath, 'An onboarded workflow has an absent or invalid dependency lock entry.');
      }
    }
  const visited = new Set<string>();
  const active = new Set<string>();
  function image(path: string, node: unknown, explicitValue?: string) {
    const sourceNode =
      explicitValue || scalar(node) ? node : (get(node, 'image') ?? get(node, 'name') ?? node);
    const value = explicitValue ?? scalar(sourceNode);
    const pinned = value ? /^(.+)@sha256:([a-fA-F0-9]{64})$/.exec(value) : null;
    const base = pinned?.[1] ?? value ?? '';
    const tagIndex = base.lastIndexOf(':') > base.lastIndexOf('/') ? base.lastIndexOf(':') : -1;
    const name = tagIndex >= 0 ? base.slice(0, tagIndex) : base;
    const tag = tagIndex >= 0 ? base.slice(tagIndex + 1) : null;
    const segments = name.split('/');
    const validName = segments.every(
      (segment, index) =>
        segment !== '.' &&
        segment !== '..' &&
        (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(segment) ||
          (index === 0 &&
            segments.length > 1 &&
            /^[A-Za-z0-9][A-Za-z0-9.-]*:[0-9]{1,5}$/.test(segment))),
    );
    if (
      !value ||
      dynamic(value) ||
      credentialLike(value) ||
      value.length > 500 ||
      !validName ||
      (value.includes('@') && !pinned) ||
      (tag !== null && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag))
    ) {
      add(path, sourceNode, {
        kind: 'container',
        name: 'Unresolved container image',
        reference: null,
        state: 'unknown',
        detail: 'The image cannot be resolved from a supported static reference.',
        recommendation:
          'Review the image at this location and use a reviewed immutable digest where supported.',
      });
      return;
    }
    const reference = pinned ? `sha256:${pinned[2]}` : tag ? tag : 'latest (implicit)';
    add(path, sourceNode, {
      kind: 'container',
      name,
      reference,
      state: pinned ? 'pinned' : 'mutable',
      detail: pinned
        ? 'A full SHA256 image digest is configured. Image provenance and runtime use were not checked.'
        : 'This image tag or implicit latest reference can resolve to different image bytes.',
      recommendation:
        'Review the image publisher and configure a trusted SHA256 digest; update it through reviewed changes.',
    });
  }
  function uses(path: string, node: unknown, workflow: string, reusable = false, depth = 0) {
    if (exhausted) return;
    const value = scalar(node);
    const kind = reusable ? 'reusable_workflow' : 'action';
    if (
      !value ||
      value.length > 500 ||
      credentialLike(value) ||
      (dynamic(value) && !value.startsWith('$/'))
    ) {
      const candidate = value && value.length <= 500 ? remoteAction(value) : null;
      const staticName = candidate?.[1];
      const safeName =
        staticName &&
        !credentialLike(staticName) &&
        !staticName.split('/').some((part) => part === '.' || part === '..')
          ? staticName
          : null;
      add(path, node, {
        kind,
        name: safeName ?? 'Unresolved dependency',
        reference: null,
        state: 'unknown',
        detail: 'This dependency has a dynamic or unsupported reference.',
        recommendation:
          'Inspect this location and resolve the exact action or reusable workflow before assessing its integrity.',
      });
      return;
    }
    if (!reusable && value.startsWith('docker://')) return image(path, node, value.slice(9));
    if (value.startsWith('./') || value.startsWith('$/')) {
      const target = localPath(value);
      const descriptors = target ? [`${target}/action.yml`, `${target}/action.yaml`] : [];
      const descriptor = descriptors.find(
        (candidate) => actionPath(candidate) && selected.includes(candidate),
      );
      const directWorkflow = reusable && target && workflowPath(target) ? target : null;
      const ownCommit = value.startsWith('$/');
      const resolved = directWorkflow ?? descriptor;
      add(path, node, {
        kind: 'local_action',
        name: target ?? 'Unsupported local reference',
        reference: ownCommit ? 'workflow commit' : 'runner checkout',
        state: resolved ? (ownCommit || reusable ? 'pinned' : 'local') : 'unknown',
        detail: reusable
          ? 'This same-repository workflow reference belongs to the caller revision; its declared dependencies are inspected only within the read scope.'
          : ownCommit
            ? 'This same-repository action uses the workflow commit. Runtime integrity and code behavior are not verified.'
            : 'A ./ action runs from the runner workspace. The checkout revision and preceding modifications are not established by this scan.',
        recommendation:
          'Review checkout behavior and local action dependencies. Use a supported same-repository commit reference when appropriate; never infer runtime contents solely from this file.',
      });
      if (!resolved || depth >= CI_DEPENDENCY_LIMITS.includeDepth) {
        issue(
          path,
          'A local action or workflow was outside the descriptor scope or nesting limit.',
          parsed.get(path)?.line(node) ?? 1,
        );
        return;
      }
      const key = `${resolved}:${workflow}`;
      if (active.has(key)) {
        issue(
          path,
          'A local action or reusable workflow cycle prevents complete dependency inspection.',
        );
        return;
      }
      if (visited.has(key)) return;
      visited.add(key);
      active.add(key);
      const document = read(resolved);
      if (!document) {
        active.delete(key);
        return;
      }
      if (directWorkflow) github(resolved, document, resolved, depth + 1);
      else {
        const runs = get(document.root, 'runs');
        if (scalar(get(runs, 'using')) === 'composite')
          steps(resolved, get(runs, 'steps'), workflow, depth + 1);
        else if (scalar(get(runs, 'using')) === 'docker') {
          const imageNode = get(runs, 'image');
          if (scalar(imageNode) === 'Dockerfile') {
            add(resolved, imageNode, {
              kind: 'container',
              name: 'Local Dockerfile',
              reference: 'Dockerfile',
              state: 'unknown',
              detail:
                'The action builds a local Dockerfile whose base images are outside this metadata check.',
              recommendation: 'Review the Dockerfile and pin its base images to reviewed digests.',
            });
          } else image(resolved, imageNode);
        }
      }
      active.delete(key);
      return;
    }
    const remote = remoteAction(value);
    if (
      !remote ||
      remote[1]!.split('/').some((part) => part === '.' || part === '..') ||
      !ref(remote[2]!)
    ) {
      add(path, node, {
        kind,
        name: 'Unsupported dependency reference',
        reference: null,
        state: 'unknown',
        detail:
          'The reference is not a supported owner/repository action or reusable workflow reference.',
        recommendation:
          'Review the referenced dependency directly and select a reviewed full commit.',
      });
      return;
    }
    const pinned = sha(remote[2]!);
    const lockCommit = !reusable && !pinned ? locked(workflow, value, remote[2]!) : null;
    const state = pinned ? 'pinned' : lockCommit ? 'locked' : 'mutable';
    add(path, node, {
      kind,
      name: remote[1]!,
      reference: remote[2]!,
      state,
      detail: pinned
        ? 'A full 40-character commit reference is configured. Remote repository ownership, code behavior and transitive dependencies were not verified.'
        : lockCommit
          ? `The caller workflow lists this exact reference with locked commit ${lockCommit} and numeric source identities in a v0.0.3 lockfile. Runtime enforcement and remote reachability remain unverified.`
          : reusable
            ? 'The reusable workflow uses a movable ref. A caller actions lockfile does not pin reusable workflow calls or their dependencies.'
            : 'The action uses a movable ref without a matching supported lock entry for this workflow.',
      recommendation: reusable
        ? 'Pin the reusable workflow call to a reviewed full commit and review dependency locking in its source repository.'
        : 'Pin to a reviewed full commit, or generate and enforce a supported workflow lockfile where Enterprise Cloud supports it. Review updates and transitive dependencies.',
    });
  }
  function steps(path: string, node: unknown, workflow: string, depth: number) {
    if (!isSeq(node)) {
      if (node !== undefined) issue(path, 'The steps field is not a supported sequence.');
      return;
    }
    for (const step of node.items)
      if (get(step, 'uses') !== undefined) uses(path, get(step, 'uses'), workflow, false, depth);
  }
  function github(path: string, document: Parsed, workflow = path, depth = 0) {
    const jobs = get(document.root, 'jobs');
    if (!isMap(jobs)) {
      issue(path, 'No supported jobs mapping was found in this workflow.');
      return;
    }
    for (const [, job] of entries(jobs)) {
      if (!isMap(job)) {
        issue(path, 'A job is not a supported mapping.');
        continue;
      }
      if (get(job, 'uses') !== undefined) uses(path, get(job, 'uses'), workflow, true, depth);
      if (get(job, 'steps') !== undefined) steps(path, get(job, 'steps'), workflow, depth);
      if (get(job, 'container') !== undefined) image(path, get(job, 'container'));
      for (const [, service] of entries(get(job, 'services'))) image(path, service);
    }
  }
  function gitlab(path: string, document: Parsed, depth = 0) {
    const include = get(document.root, 'include');
    const includes = isSeq(include) ? include.items : include === undefined ? [] : [include];
    for (const node of includes) {
      const raw = scalar(node);
      const local = scalar(get(node, 'local')) ?? (raw && !/^https?:/.test(raw) ? raw : undefined);
      if (local) {
        const target = localPath(local);
        const resolved =
          target && gitlabPath(target) && selected.includes(target) && !dynamic(local);
        add(path, get(node, 'local') ?? node, {
          kind: 'gitlab_include',
          name: target ?? 'Unresolved local include',
          reference: 'same repository revision',
          state: resolved ? 'local' : 'unknown',
          detail: resolved
            ? 'A local include is available at the checked repository revision; pipeline merging and execution were not verified.'
            : 'This local include is dynamic, uses a glob, or is outside the bounded file scope.',
          recommendation:
            'Review local include contents at the same revision and verify the effective pipeline configuration.',
        });
        if (resolved && active.has(target)) {
          issue(path, 'A local GitLab include cycle prevents complete dependency inspection.');
        } else if (resolved && depth < CI_DEPENDENCY_LIMITS.includeDepth && !visited.has(target)) {
          visited.add(target);
          active.add(target);
          const child = read(target);
          if (child) gitlab(target, child, depth + 1);
          active.delete(target);
        } else if (!resolved || depth >= CI_DEPENDENCY_LIMITS.includeDepth)
          issue(
            path,
            'A GitLab local include could not be followed within the bounded read scope.',
          );
        continue;
      }
      const project = scalar(get(node, 'project'));
      const component = scalar(get(node, 'component'));
      const remote = scalar(get(node, 'remote')) ?? (raw && /^https?:/.test(raw) ? raw : undefined);
      if (project) {
        const version = scalar(get(node, 'ref'));
        const validName =
          !credentialLike(project) && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(project);
        const fileNode = get(node, 'file');
        const fileNodes = isSeq(fileNode) ? fileNode.items : [fileNode];
        const includedFiles = fileNodes.map(scalar);
        const validFiles =
          includedFiles.length > 0 &&
          includedFiles.every(
            (file) => file && localPath(file) && !dynamic(file) && !file.includes('*'),
          );
        const known = validName && validFiles && version && ref(version) && !dynamic(version);
        add(path, get(node, 'project'), {
          kind: 'gitlab_include',
          name:
            validName && validFiles
              ? `${project}: ${includedFiles.join(', ')}`.slice(0, 500)
              : 'Unresolved project include',
          reference: known ? version : null,
          state: known
            ? sha(version)
              ? 'pinned'
              : 'mutable'
            : validName && validFiles && !version
              ? 'mutable'
              : 'unknown',
          detail:
            known && sha(version)
              ? 'The external project include declares a full 40-character commit; included content and nested dependencies were not read.'
              : 'The project include has no verified full commit reference; branches and tags can move.',
          recommendation:
            'Pin the external project include to a reviewed full commit and inspect its included files and nested dependencies.',
        });
      } else if (component) {
        const split = component.lastIndexOf('@');
        const name = component.slice(0, split);
        const version = component.slice(split + 1);
        const valid =
          split > 0 && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){2,}$/.test(name) && ref(version);
        add(path, get(node, 'component'), {
          kind: 'gitlab_include',
          name: valid ? name : 'Unresolved CI component',
          reference: valid ? version : null,
          state: valid ? (sha(version) ? 'pinned' : 'mutable') : 'unknown',
          detail:
            valid && sha(version)
              ? 'The component reference declares a full commit. Component inputs, source code and nested includes were not checked.'
              : 'This component is not identified by a supported full commit reference.',
          recommendation:
            'Review the component and select its full commit; inspect any nested dependency references.',
        });
      } else if (remote) {
        const name = urlLabel(remote);
        const integrity = scalar(get(node, 'integrity'));
        const pinned = name && integrity && /^sha256-[A-Za-z0-9+/]{43}=$/.test(integrity);
        add(path, get(node, 'remote') ?? node, {
          kind: 'gitlab_include',
          name: name ?? 'Unresolved remote include',
          reference: pinned ? integrity : null,
          state: !name || dynamic(remote) ? 'unknown' : pinned ? 'pinned' : 'mutable',
          detail: pinned
            ? 'A SHA256 integrity value is configured for this HTTPS remote include. Content and GitLab runtime verification were not checked.'
            : 'The remote include has no supported integrity binding; its response can change.',
          recommendation:
            'Review the included content and configure its correct SHA256 integrity value. Review nested includes separately.',
        });
      } else {
        add(path, node, {
          kind: 'gitlab_include',
          name: 'Unresolved include or platform template',
          reference: null,
          state: 'unknown',
          detail:
            'A built-in template, dynamic include or unsupported include shape is outside this integrity check.',
          recommendation:
            'Review the effective GitLab configuration and its source/version before relying on this include.',
        });
      }
    }
    const reserved = new Set([
      'include',
      'default',
      'image',
      'services',
      'variables',
      'stages',
      'workflow',
      'cache',
      'before_script',
      'after_script',
      'spec',
    ]);
    const scopes = [
      document.root,
      get(document.root, 'default'),
      ...entries(document.root)
        .filter(([key]) => !reserved.has(key))
        .map(([, value]) => value),
    ];
    for (const scope of scopes) {
      if (get(scope, 'image') !== undefined) image(path, get(scope, 'image'));
      for (const service of sequence(get(scope, 'services'))) image(path, service);
    }
  }
  for (const path of selected) {
    if (!workflowPath(path) && path !== '.gitlab-ci.yml') continue;
    const document = read(path);
    if (document) path === '.gitlab-ci.yml' ? gitlab(path, document) : github(path, document);
  }
  if (!workflows.length && !candidates.includes('.gitlab-ci.yml'))
    issue(
      '.github/workflows',
      'No supported root GitHub workflow or root GitLab CI configuration was available.',
    );
  if (!report.items.length && !report.incomplete)
    issue(
      '.github/workflows',
      'No supported CI dependency references were observed in the inspected configurations.',
    );
  report.filesChecked.sort();
  report.state = report.items.some((item) => item.state === 'mutable')
    ? 'attention'
    : report.incomplete ||
        report.items.some((item) => item.state === 'unknown' || item.state === 'local') ||
        !report.items.length
      ? 'unknown'
      : 'observed';
  return report;
}
