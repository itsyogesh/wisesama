import { gte, valid } from 'semver';
import { isMap } from 'yaml';
import { parseBoundedYaml } from './bounded-yaml';
import {
  assessCiDependencies,
  type CiDependencyReport,
  ciDependencyConfigPath,
} from './ci-dependencies';

export type BaselineCheck = {
  id: 'package_manager' | 'lockfile' | 'ci_install' | 'dependency_cooldown' | 'ci_dependencies';
  title: string;
  state: 'observed' | 'attention' | 'unknown';
  summary: string;
  evidence: Array<{ path: string; detail: string }>;
  recommendation: string;
  documentationUrl: string;
};
export type BaselineSnapshot = {
  commit: string;
  inventoryPaths: string[];
  checks: BaselineCheck[];
  scope: 'repository_configuration';
  limitations: string[];
  ciDependencies: CiDependencyReport;
};
export type BaselineFiles = {
  /** Only regular files from the bounded immutable git tree. */
  paths: string[];
  /** Allowlisted configuration bytes are transient and are never persisted. */
  contents: Record<string, string>;
  incomplete: boolean;
  unreadable: string[];
};

const docs = {
  manager: 'https://nodejs.org/api/packages.html#packagemanager',
  lock: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json',
  ci: 'https://docs.npmjs.com/cli/v11/commands/npm-ci',
  pnpm: 'https://pnpm.io/settings/dependency-resolution#minimumreleaseage',
  uv: 'https://docs.astral.sh/uv/concepts/resolution/#dependency-cooldowns',
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const parent = (path: string) => path.split('/').slice(0, -1).join('/');
const join = (root: string, name: string) => (root ? `${root}/${name}` : name);
export const normalizedBaselinePaths = (paths: string[]) => [...new Set(paths)].sort();
export function baselineRoots(inventoryPaths: string[]) {
  const roots = new Set<string>(['']);
  for (const path of inventoryPaths) {
    let root = parent(path);
    while (root) {
      roots.add(root);
      root = parent(root);
    }
  }
  return [...roots];
}
export function baselineConfigPath(path: string, roots: string[]) {
  return (
    roots.some((root) =>
      ['package.json', 'pnpm-workspace.yaml', 'pyproject.toml', 'uv.toml'].some(
        (name) => path === join(root, name),
      ),
    ) || ciDependencyConfigPath(path)
  );
}
export const BASELINE_YAML_LIMITS = { bytes: 128 * 1024, nodes: 20_000, depth: 32 } as const;
function yaml(content: string | undefined): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const parsed = parseBoundedYaml(content, BASELINE_YAML_LIMITS);
    if (!isMap(parsed.contents)) return null;
    return record(parsed.toJS({ maxAliasCount: 0 }));
  } catch {
    return null;
  }
}
function manifest(content: string | undefined) {
  try {
    const value: unknown = JSON.parse(content ?? '');
    return value && typeof value === 'object' && !Array.isArray(value) ? record(value) : null;
  } catch {
    return null;
  }
}
/** Conservative structural TOML subset. Any unsupported line invalidates the whole check. */
function tomlConfiguration(content: string | undefined, section: string) {
  if (!content) return null;
  const root: Record<string, unknown> = Object.create(null);
  const declared = new Set<string>();
  let current = root;
  for (const raw of content.split(/\r?\n/)) {
    // Comments are stripped only outside a single-line literal/basic string.
    let quote = '',
      line = '';
    for (const character of raw) {
      if (!quote && character === '#') break;
      line += character;
      if (character === '"' || character === "'") {
        if (!quote) quote = character;
        else if (quote === character) quote = '';
      }
    }
    line = line.trim();
    if (!line) continue;
    if (quote) return null;
    const header = /^\[([^[\]]+)\]$/.exec(line);
    if (header) {
      const parts = header[1]!.split('.').map((part) => part.trim());
      if (parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
      const name = parts.join('.');
      if (declared.has(name)) return null;
      declared.add(name);
      current = root;
      for (const part of parts) {
        if (!Object.hasOwn(current, part)) current[part] = Object.create(null);
        const next = current[part];
        if (!next || typeof next !== 'object' || Array.isArray(next)) return null;
        current = next as Record<string, unknown>;
      }
      continue;
    }
    const setting = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!setting || Object.hasOwn(current, setting[1]!)) return null;
    const rawValue = setting[2]!.trim();
    let value: unknown;
    if (
      (/^"[^"\\]*"$/.test(rawValue) || /^'[^']*'$/.test(rawValue)) &&
      !Array.from(rawValue).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      value = rawValue.slice(1, -1);
    else if (rawValue === 'true' || rawValue === 'false') value = rawValue === 'true';
    else if (/^[+-]?(?:0|[1-9]\d*)$/.test(rawValue) && Number.isSafeInteger(Number(rawValue)))
      value = Number(rawValue);
    else return null; // Arrays, inline tables, escapes and multiline strings remain unknown.
    current[setting[1]!] = value;
  }
  let result: unknown = root;
  for (const part of section ? section.split('.') : []) result = record(result)[part];
  return result && typeof result === 'object' && !Array.isArray(result) ? record(result) : null;
}
function tomlSetting(content: string | undefined, section: string, key: string) {
  const value = tomlConfiguration(content, section)?.[key];
  return typeof value === 'string' ? value : undefined;
}
function exactManager(value: unknown) {
  if (typeof value !== 'string') return null;
  const match =
    /^(npm|pnpm|yarn|bun)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+sha(?:224|256|384|512)\.[a-fA-F0-9]+)?$/.exec(
      value,
    );
  if (!match || !valid(match[2])) return null;
  return { name: match[1]!, version: match[2]! };
}
function ancestors(root: string) {
  const result = [root];
  let current = root;
  while (current) {
    current = parent(current);
    result.push(current);
  }
  return result;
}
function duration(value: string | undefined) {
  if (!value) return false;
  if (/^[1-9]\d*\s+(?:seconds?|minutes?|hours?|days?|weeks?)$/i.test(value)) return true;
  return /^P(?=\d|T\d)(?:(?:[1-9]\d*)D)?(?:T(?:(?:[1-9]\d*)H)?(?:(?:[1-9]\d*)M)?(?:(?:[1-9]\d*)S)?)?$/.test(
    value,
  );
}
function ciCommands(value: unknown, depth = 0): string[] {
  if (depth > 12) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => ciCommands(item, depth + 1));
  return [];
}
function reproducibleCommand(value: string) {
  return value.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (/^npm\s+ci(?:\s|$)/.test(trimmed)) return true;
    if (
      /^pnpm\s+(?:install|i)\s/.test(trimmed) &&
      /(?:^|\s)--frozen-lockfile(?:\s|$)/.test(trimmed) &&
      !trimmed.includes('--no-frozen-lockfile')
    )
      return true;
    return (
      /^uv\s+sync\s/.test(trimmed) &&
      /(?:^|\s)--locked(?:\s|$)/.test(trimmed) &&
      !trimmed.includes('--no-locked')
    );
  });
}

/** Static repository signals only: never a security score or an assertion of CI execution. */
export function assessRepositoryBaseline(
  commit: string,
  inventoryPaths: string[],
  files: BaselineFiles,
): BaselineSnapshot {
  const selectedRoots = [...new Set(inventoryPaths.map(parent))];
  const evidence: Record<BaselineCheck['id'], BaselineCheck['evidence']> = {
    package_manager: [],
    lockfile: [],
    ci_install: [],
    dependency_cooldown: [],
    ci_dependencies: [],
  };
  const issues = { manager: 0, lock: 0, cooldown: 0 };
  const unknown = { manager: 0, lock: 0, cooldown: 0 };
  const knownPaths = new Set(files.paths);
  let uvSeen = false;
  for (const root of selectedRoots) {
    const levels = ancestors(root);
    const manifestPath = levels
      .map((level) => join(level, 'package.json'))
      .find((path) => files.contents[path] !== undefined);
    const parsedManifest = manifest(manifestPath ? files.contents[manifestPath] : undefined);
    const pkg = parsedManifest ?? {};
    const manager = exactManager(pkg.packageManager);
    const uvRoot = levels.find(
      (level) =>
        knownPaths.has(join(level, 'uv.lock')) ||
        knownPaths.has(join(level, 'uv.toml')) ||
        knownPaths.has(join(level, 'pyproject.toml')),
    );
    if (manager && manifestPath) {
      evidence.package_manager.push({
        path: manifestPath,
        detail: `${manager.name} ${manager.version} declared in packageManager.`,
      });
    } else if (uvRoot !== undefined) {
      uvSeen = true;
      const uvConfig = files.contents[join(uvRoot, 'uv.toml')];
      const pyConfig = files.contents[join(uvRoot, 'pyproject.toml')];
      const version =
        uvConfig !== undefined
          ? tomlSetting(uvConfig, '', 'required-version')
          : tomlSetting(pyConfig, 'tool.uv', 'required-version');
      const exact = /^==\s*(\d+\.\d+\.\d+)$/.exec(version ?? '');
      if (exact)
        evidence.package_manager.push({
          path: join(uvRoot, uvConfig !== undefined ? 'uv.toml' : 'pyproject.toml'),
          detail: `uv ${exact[1]} required exactly.`,
        });
      else unknown.manager++;
    } else {
      if (
        (manifestPath && !parsedManifest) ||
        (!manifestPath &&
          (files.incomplete ||
            levels.some((level) => files.unreadable.includes(join(level, 'package.json')))))
      )
        unknown.manager++;
      else issues.manager++;
      evidence.package_manager.push({
        path: manifestPath ?? join(root, 'package.json'),
        detail:
          'No supported exact packageManager declaration was observed for this selected root.',
      });
    }

    const expected =
      manager?.name === 'pnpm'
        ? ['pnpm-lock.yaml']
        : manager?.name === 'npm'
          ? ['package-lock.json', 'npm-shrinkwrap.json']
          : manager?.name === 'yarn'
            ? ['yarn.lock']
            : manager?.name === 'bun'
              ? ['bun.lock', 'bun.lockb']
              : uvRoot !== undefined
                ? ['uv.lock']
                : [
                    'pnpm-lock.yaml',
                    'package-lock.json',
                    'npm-shrinkwrap.json',
                    'uv.lock',
                    'yarn.lock',
                    'bun.lock',
                    'bun.lockb',
                  ];
    const lock = levels
      .flatMap((level) => expected.map((name) => join(level, name)))
      .find((path) => knownPaths.has(path));
    if (lock)
      evidence.lockfile.push({
        path: lock,
        detail:
          parent(lock) === root
            ? 'A committed lockfile is present at the selected root; consistency was not executed.'
            : 'A committed ancestor/workspace lockfile is present; service-specific dependency closure is not established.',
      });
    else if (files.incomplete) unknown.lock++;
    else issues.lock++;

    if (manager?.name === 'pnpm') {
      const workspace = levels
        .map((level) => join(level, 'pnpm-workspace.yaml'))
        .find((path) => files.contents[path] !== undefined);
      const settings = yaml(workspace ? files.contents[workspace] : undefined) ?? {};
      const age = settings.minimumReleaseAge;
      if (!gte(manager.version, '10.16.0') || manager.version.includes('-')) {
        issues.cooldown++;
        evidence.dependency_cooldown.push({
          path: manifestPath!,
          detail: `pnpm ${manager.version} does not establish supported stable minimumReleaseAge configuration (introduced in 10.16.0).`,
        });
      } else if (
        typeof age === 'number' &&
        Number.isSafeInteger(age) &&
        age > 0 &&
        age <= 5256000 &&
        workspace
      ) {
        evidence.dependency_cooldown.push({
          path: workspace,
          detail: `minimumReleaseAge: ${age} minutes is configured for the declared pnpm version. Exceptions, registry timestamps, CLI overrides and lockfile behavior require review.`,
        });
        if (
          (settings.minimumReleaseAgeExclude !== undefined &&
            !Array.isArray(settings.minimumReleaseAgeExclude)) ||
          (settings.minimumReleaseAgeStrict !== undefined &&
            typeof settings.minimumReleaseAgeStrict !== 'boolean') ||
          (settings.trustLockfile !== undefined && typeof settings.trustLockfile !== 'boolean')
        )
          unknown.cooldown++;
        if (
          settings.minimumReleaseAgeStrict === false ||
          settings.trustLockfile === true ||
          (Array.isArray(settings.minimumReleaseAgeExclude) &&
            settings.minimumReleaseAgeExclude.length)
        ) {
          issues.cooldown++;
          evidence.dependency_cooldown.push({
            path: workspace,
            detail:
              'Cooldown exclusions or bypass settings are present; review their scope before relying on the policy.',
          });
        }
      } else if (age === 0) {
        issues.cooldown++;
        evidence.dependency_cooldown.push({
          path: workspace!,
          detail: 'minimumReleaseAge is explicitly disabled.',
        });
      } else {
        unknown.cooldown++;
      }
    } else if (uvRoot !== undefined && !manager) {
      const uvPath = join(uvRoot, 'uv.toml'),
        pyPath = join(uvRoot, 'pyproject.toml');
      const path = files.contents[uvPath] !== undefined ? uvPath : pyPath;
      const section = path === uvPath ? '' : 'tool.uv';
      const value = tomlSetting(files.contents[path], section, 'exclude-newer');
      const version = /^==\s*(\d+\.\d+\.\d+)$/.exec(
        tomlSetting(files.contents[path], section, 'required-version') ?? '',
      );
      if (duration(value) && version && gte(version[1]!, '0.9.17')) {
        evidence.dependency_cooldown.push({
          path,
          detail:
            'A positive duration-based exclude-newer policy and compatible exact uv version are configured. Package/index overrides and registry-only scope require review.',
        });
        const settings = tomlConfiguration(files.contents[path], section)!;
        if (Object.hasOwn(settings, 'exclude-newer-package') || Object.hasOwn(settings, 'index')) {
          issues.cooldown++;
          evidence.dependency_cooldown.push({
            path,
            detail:
              'Package or index configuration is present; inspect whether it narrows or disables the global cooldown.',
          });
        }
      } else {
        unknown.cooldown++;
        if (value)
          evidence.dependency_cooldown.push({
            path,
            detail: duration(value)
              ? 'A duration policy is present, but a compatible exact uv version was not established.'
              : 'A fixed date or unsupported exclude-newer value does not establish a rolling dependency cooldown.',
          });
      }
    } else unknown.cooldown++;
  }
  let unknownCiConfiguration = false;
  for (const [path, content] of Object.entries(files.contents)) {
    if (!/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) && path !== '.gitlab-ci.yml') continue;
    const data = yaml(content);
    if (!data) {
      unknownCiConfiguration = true;
      continue;
    }
    const commands: string[] = [];
    if (path === '.gitlab-ci.yml') {
      for (const job of Object.values(data)) {
        const spec = record(job);
        commands.push(...ciCommands(spec.script), ...ciCommands(spec.before_script));
      }
    } else {
      for (const job of Object.values(record(data.jobs))) {
        const steps = record(job).steps;
        if (Array.isArray(steps))
          commands.push(...steps.flatMap((step) => ciCommands(record(step).run)));
      }
    }
    if (commands.some(reproducibleCommand))
      evidence.ci_install.push({
        path,
        detail:
          'A candidate npm ci, pnpm frozen-lockfile, or uv locked sync command was observed. Execution, job conditions, selected root and required branch checks are unverified.',
      });
  }
  const uncertainty = files.incomplete || files.unreadable.length > 0;
  const state = (
    issue: number,
    missing: number,
    id: BaselineCheck['id'],
  ): BaselineCheck['state'] =>
    issue
      ? 'attention'
      : missing || uncertainty || evidence[id].length === 0
        ? 'unknown'
        : 'observed';
  const checks: BaselineCheck[] = [
    {
      id: 'package_manager',
      title: 'Package manager version',
      state: state(issues.manager, unknown.manager, 'package_manager'),
      summary: issues.manager
        ? 'An exact supported package manager version is missing for a selected root.'
        : unknown.manager || uncertainty
          ? 'The package manager version could not be established for every selected root.'
          : 'Exact package manager declarations were observed.',
      evidence: evidence.package_manager,
      recommendation:
        'Declare an exact supported package manager version and verify CI uses it. Repository declarations alone do not prove the installed tool version.',
      documentationUrl: docs.manager,
    },
    {
      id: 'lockfile',
      title: 'Committed lockfile',
      state: state(issues.lock, unknown.lock, 'lockfile'),
      summary: issues.lock
        ? 'No matching committed lockfile was observed for at least one selected root.'
        : unknown.lock || uncertainty
          ? 'Lockfile presence is not established for every selected root.'
          : 'Matching committed lockfiles were observed.',
      evidence: evidence.lockfile,
      recommendation:
        'Commit the correct lockfile, check it matches the manifest, and use an immutable install. Shared workspace locks remain repository-wide evidence.',
      documentationUrl: docs.lock,
    },
    {
      id: 'ci_install',
      title: 'Reproducible CI install',
      state:
        evidence.ci_install.length && !uncertainty && !unknownCiConfiguration
          ? 'observed'
          : 'unknown',
      summary: evidence.ci_install.length
        ? 'Candidate immutable install commands were observed; CI enforcement is unverified.'
        : 'No supported immutable install command was established in the inspected CI files.',
      evidence: evidence.ci_install,
      recommendation:
        'Review working directories, job conditions, package manager setup and required branch checks. Verify a successful protected-branch run; external templates and reusable workflows are not followed.',
      documentationUrl: docs.ci,
    },
    {
      id: 'dependency_cooldown',
      title: 'Dependency cooldown',
      state: state(issues.cooldown, unknown.cooldown, 'dependency_cooldown'),
      summary: issues.cooldown
        ? 'The configured tool or exceptions need attention before relying on a cooldown.'
        : unknown.cooldown || uncertainty
          ? 'A compatible rolling cooldown was not established for every selected root.'
          : 'Version-compatible cooldown settings were observed; enforcement remains unverified.',
      evidence: evidence.dependency_cooldown,
      recommendation:
        'Use a cooldown supported by the exact tool version, review exclusions and registry metadata, and document a reviewed exception for urgent security patches. A cooldown does not make a package safe.',
      documentationUrl: uvSeen ? docs.uv : docs.pnpm,
    },
  ];
  const ciDependencies = assessCiDependencies(files);
  checks.push({
    id: 'ci_dependencies',
    title: 'CI dependency integrity',
    state: ciDependencies.state,
    summary:
      ciDependencies.state === 'attention'
        ? 'Movable CI dependency references need review; this does not establish a compromise.'
        : ciDependencies.state === 'observed'
          ? 'Immutable CI dependency references or matching lock configuration were observed; runtime integrity is unverified.'
          : 'CI dependency integrity could not be established throughout the bounded configuration scope.',
    evidence: ciDependencies.items.map((item) => ({
      path: item.path,
      detail: `Line ${item.line}: ${item.name}. ${item.detail}`,
    })),
    recommendation:
      'Inspect the dependency evidence, resolve unknown coverage, and review immutable references. Recheck the next imported commit after a change. A pin or lock configuration is not a code-safety or execution guarantee.',
    documentationUrl: 'https://docs.github.com/en/actions/reference/security/secure-use',
  });
  for (const check of checks) check.evidence = check.evidence.slice(0, 30);
  return {
    commit,
    inventoryPaths: normalizedBaselinePaths(inventoryPaths),
    checks,
    ciDependencies,
    scope: 'repository_configuration',
    limitations: [
      'Static configuration at the imported commit; repository code and install commands were not executed.',
      'No deployed exposure, runtime reachability, successful CI run or branch protection is verified.',
      'Only selected inventory roots and ancestor configuration, bounded root GitHub workflows, supported lock metadata and local descriptors, and root GitLab CI/local allowlisted includes were inspected. External includes, actions, global configuration, .npmrc, environment and command-line overrides are outside this check.',
      'Configuration contents are transient. Stored evidence contains only allowlisted facts and paths.',
      ...(unknownCiConfiguration
        ? [
            'Some CI YAML was malformed, unsupported or exceeded structural limits; install-command coverage remains unknown.',
          ]
        : []),
      ...(files.incomplete
        ? [
            'Repository discovery was bounded or truncated; absent files cannot be treated as missing.',
          ]
        : []),
      ...(files.unreadable.length
        ? [
            'Some allowlisted configuration files could not be read or exceeded the safe limit; results remain unknown.',
          ]
        : []),
    ],
  };
}
