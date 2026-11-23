import { valid } from 'semver';
import { parseBoundedYaml } from './bounded-yaml';
import {
  type InventoryEcosystem,
  type InventoryFormat,
  type InventoryPackage,
  InventoryValidationError,
  type ParsedInventory,
} from './types';

export const MAX_INVENTORY_BYTES = 2 * 1024 * 1024;
export const MAX_INVENTORY_PACKAGES = 2000;
export const INVENTORY_YAML_LIMITS = {
  bytes: MAX_INVENTORY_BYTES,
  nodes: 100_000,
  depth: 64,
} as const;

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizePackageName(name: string, ecosystem: string): string {
  return ecosystem === 'PyPI' ? name.toLowerCase().replace(/[-_.]+/g, '-') : name;
}

function isExactVersion(version: string, ecosystem: InventoryEcosystem): boolean {
  if (ecosystem === 'npm') return valid(version) !== null;
  // PEP 440 pinned releases, including epochs, prereleases, post/dev and local versions.
  return /^(?:\d+!)?\d+(?:\.\d+)*(?:(?:a|b|rc)\d+)?(?:\.post\d+)?(?:\.dev\d+)?(?:\+[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/i.test(
    version,
  );
}

function validName(name: string, ecosystem: InventoryEcosystem): boolean {
  if (ecosystem === 'PyPI') return /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(name);
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name);
}

/** Parse pinned inventory only. A range must never masquerade as a deployed version. */
export function parseInventory(
  content: string,
  requestedFormat: InventoryFormat = 'auto',
): ParsedInventory {
  if (typeof content !== 'string' || !content.trim()) {
    throw new InventoryValidationError('Upload a non-empty inventory or lockfile.');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_INVENTORY_BYTES) {
    throw new InventoryValidationError(
      'Inventory exceeds the 2 MB limit. Split it into smaller projects.',
    );
  }
  const allowedFormats: InventoryFormat[] = [
    'auto',
    'inventory',
    'package-lock',
    'pnpm-lock',
    'package-json',
  ];
  if (!allowedFormats.includes(requestedFormat))
    throw new InventoryValidationError('Unsupported inventory format.');

  let document: unknown;
  let isYaml = requestedFormat === 'pnpm-lock';
  try {
    if (!isYaml) {
      try {
        document = JSON.parse(content) as unknown;
      } catch {
        if (requestedFormat !== 'auto') throw new Error('Expected JSON');
        isYaml = true;
      }
    }
    if (isYaml) {
      const yaml = parseBoundedYaml(content, INVENTORY_YAML_LIMITS);
      document = yaml.toJS({ maxAliasCount: 0 }) as unknown;
    }
  } catch {
    throw new InventoryValidationError(
      'This file is not valid JSON or pnpm YAML. Check the format and try again.',
    );
  }

  const object = asRecord(document);
  const format: Exclude<InventoryFormat, 'auto'> =
    requestedFormat === 'auto'
      ? Array.isArray(document) || Array.isArray(object?.packages)
        ? 'inventory'
        : object?.lockfileVersion !== undefined
          ? isYaml
            ? 'pnpm-lock'
            : 'package-lock'
          : 'package-json'
      : requestedFormat;

  const packages: InventoryPackage[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const warn = (message: string) => {
    skipped++;
    if (warnings.length < 50) warnings.push(message);
  };
  const add = (
    rawName: unknown,
    rawVersion: unknown,
    rawEcosystem: unknown = 'npm',
    strict = false,
  ) => {
    const ecosystem = rawEcosystem === 'npm' || rawEcosystem === 'PyPI' ? rawEcosystem : undefined;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const version = typeof rawVersion === 'string' ? rawVersion.trim() : '';
    if (!ecosystem || !name || name.length > 214 || !validName(name, ecosystem)) {
      if (strict)
        throw new InventoryValidationError(
          'Every inventory package needs a valid name and ecosystem (npm or PyPI).',
        );
      warn(`Skipped an invalid package entry${name ? `: ${name.slice(0, 100)}` : ''}.`);
      return;
    }
    if (version.length > 128 || !isExactVersion(version, ecosystem)) {
      if (strict)
        throw new InventoryValidationError(
          `${name} needs an exact installed version, not a range, tag, URL or workspace reference.`,
        );
      warn(
        `${name}: skipped ${version.slice(0, 80) || 'missing version'}; an exact installed version is required.`,
      );
      return;
    }
    const normalizedName = normalizePackageName(name, ecosystem);
    const normalizedVersion = ecosystem === 'npm' ? valid(version)! : version;
    const key = `${ecosystem}:${normalizedName}@${normalizedVersion}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (packages.length >= MAX_INVENTORY_PACKAGES) {
      throw new InventoryValidationError(
        'Inventory exceeds 2,000 unique package versions. Split it into smaller projects.',
      );
    }
    packages.push({ name: normalizedName, version: normalizedVersion, ecosystem });
  };

  if (format === 'inventory') {
    const entries = Array.isArray(document) ? document : object?.packages;
    if (!Array.isArray(entries))
      throw new InventoryValidationError('Inventory JSON must contain an array of packages.');
    for (const entry of entries) {
      const item = asRecord(entry);
      if (!item) throw new InventoryValidationError('Each inventory package must be an object.');
      add(item.name, item.version, item.ecosystem, true);
    }
  } else if (format === 'package-lock') {
    if (!object || ![2, 3].includes(Number(object.lockfileVersion)) || !asRecord(object.packages)) {
      throw new InventoryValidationError(
        'Use an npm package-lock.json with lockfileVersion 2 or 3.',
      );
    }
    for (const [path, value] of Object.entries(asRecord(object.packages)!)) {
      if (!path.includes('node_modules/')) continue;
      const item = asRecord(value);
      if (!item || item.link === true) continue;
      add(
        item.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
        item.version,
      );
    }
  } else if (format === 'pnpm-lock') {
    if (!object || object.lockfileVersion === undefined || !asRecord(object.packages)) {
      throw new InventoryValidationError('Use a pnpm lockfile containing a packages section.');
    }
    for (const [rawKey, value] of Object.entries(asRecord(object.packages)!)) {
      const item = asRecord(value);
      let key = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
      key = key.replace(/\(.*$/, '');
      // pnpm v9: @scope/name@1.2.3; v6/7: /@scope/name/1.2.3.
      const legacy = key.match(/^(@[^/]+\/[^/]+|[^/@]+)\/([^/]+)$/);
      const separator = key.lastIndexOf('@');
      const name = legacy ? legacy[1] : key.slice(0, separator);
      const version = legacy ? legacy[2]?.split('_')[0] : key.slice(separator + 1);
      add(item?.name ?? name, item?.version ?? version);
    }
  } else {
    if (!object) throw new InventoryValidationError('package.json must be a JSON object.');
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const values = asRecord(object[field]);
      if (!values) continue;
      for (const [name, version] of Object.entries(values)) add(name, version);
    }
    warnings.unshift(
      'package.json omits transitive dependencies and does not prove what is deployed. Import a lockfile for better coverage.',
    );
  }
  if (skipped > 50) warnings.push(`${skipped - 50} additional entries were skipped.`);
  if (!packages.length)
    throw new InventoryValidationError(
      'No supported packages with exact installed versions were found. Import a lockfile or a pinned inventory.',
    );
  return { packages, warnings, format };
}
