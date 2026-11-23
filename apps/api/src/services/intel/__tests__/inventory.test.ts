import { describe, expect, it } from 'vitest';
import { INVENTORY_YAML_LIMITS, MAX_INVENTORY_BYTES, parseInventory } from '../inventory';
import { InventoryValidationError } from '../types';

describe('inventory import', () => {
  it('requires exact package versions and normalizes equivalent Python names', () => {
    const result = parseInventory(
      JSON.stringify([
        { name: 'Some_Package.Name', version: '1.0rc1', ecosystem: 'PyPI' },
        { name: 'some-package-name', version: '1.0rc1', ecosystem: 'PyPI' },
        { name: '@scope/pkg', version: 'v1.2.3', ecosystem: 'npm' },
      ]),
    );
    expect(result.packages).toEqual([
      { name: 'some-package-name', version: '1.0rc1', ecosystem: 'PyPI' },
      { name: '@scope/pkg', version: '1.2.3', ecosystem: 'npm' },
    ]);
    expect(result.format).toBe('inventory');
  });

  it.each([
    '^1.2.3',
    'latest',
    '1.x',
    'https://example.com/pkg.tgz',
    'workspace:*',
    '*',
    '>=1.0.0',
  ])('rejects non-pinned version %s', (version) => {
    expect(() =>
      parseInventory(JSON.stringify([{ name: 'pkg', version, ecosystem: 'npm' }])),
    ).toThrow(/exact installed version/);
  });

  it('does not silently drop malformed manual inventory entries', () => {
    expect(() => parseInventory('[{"name":"pkg","version":"1.0.0","ecosystem":"maven"}]')).toThrow(
      /ecosystem/,
    );
    expect(() => parseInventory('["pkg@1.0.0"]')).toThrow(/must be an object/);
    expect(() =>
      parseInventory('[{"name":"../../pkg","version":"1.0.0","ecosystem":"npm"}]'),
    ).toThrow(/valid name/);
  });

  it('reads transitive and scoped versions from npm lockfile package paths', () => {
    const result = parseInventory(
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { name: 'app', version: '1.0.0' },
          'node_modules/pkg': { version: '1.0.0' },
          'node_modules/parent/node_modules/pkg': { version: '2.0.0' },
          'node_modules/parent/node_modules/@scope/child': { version: '3.0.0' },
          'node_modules/workspace': { link: true, resolved: 'packages/workspace' },
        },
      }),
    );
    expect(result.packages).toEqual([
      { name: 'pkg', version: '1.0.0', ecosystem: 'npm' },
      { name: 'pkg', version: '2.0.0', ecosystem: 'npm' },
      { name: '@scope/child', version: '3.0.0', ecosystem: 'npm' },
    ]);
    expect(result.format).toBe('package-lock');
  });

  it('supports npm lockfile v2 and explicitly rejects older unsupported lockfiles', () => {
    expect(
      parseInventory('{"lockfileVersion":2,"packages":{"node_modules/pkg":{"version":"1.0.0"}}}')
        .packages,
    ).toHaveLength(1);
    expect(() =>
      parseInventory('{"lockfileVersion":1,"dependencies":{"pkg":{"version":"1.0.0"}}}'),
    ).toThrow(/lockfileVersion 2 or 3/);
  });

  it('reads pnpm v9 keys without treating peer versions as installed package versions', () => {
    const result = parseInventory(`lockfileVersion: '9.0'
packages:
  '@scope/pkg@1.2.3': {}
  'child@2.3.4(parent@9.0.0)': {}
snapshots:
  'child@2.3.4(parent@9.0.0)': {}
`);
    expect(result.packages).toEqual([
      { name: '@scope/pkg', version: '1.2.3', ecosystem: 'npm' },
      { name: 'child', version: '2.3.4', ecosystem: 'npm' },
    ]);
    expect(result.format).toBe('pnpm-lock');
  });

  it('reads legacy pnpm package keys', () => {
    const result = parseInventory(`lockfileVersion: 5.4
packages:
  /pkg/1.2.3: {}
  /@scope/pkg/3.4.5: {}
  /child/2.0.0_@scope+peer@1.0.0: {}
`);
    expect(result.packages.map((pkg) => `${pkg.name}@${pkg.version}`)).toEqual([
      'pkg@1.2.3',
      '@scope/pkg@3.4.5',
      'child@2.0.0',
    ]);
  });

  it('preserves underscores in modern pnpm package names', () => {
    const result = parseInventory("lockfileVersion: '9.0'\npackages:\n  pkg_name@1.2.3: {}\n");
    expect(result.packages[0]?.name).toBe('pkg_name');
  });

  it('reports package.json limitations and range exclusions', () => {
    const result = parseInventory(
      JSON.stringify({
        dependencies: { fixed: '1.0.0', ranged: '^2.0.0' },
        devDependencies: { dev: '3.0.0' },
      }),
    );
    expect(result.packages.map((pkg) => pkg.name)).toEqual(['fixed', 'dev']);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('omits transitive dependencies'),
        expect.stringContaining('ranged: skipped ^2.0.0'),
      ]),
    );
  });

  it('does not return a clean inventory for an empty or unsupported file', () => {
    for (const content of ['', '{}', '[]', '{"dependencies":{"pkg":"^1.0.0"}}', '{broken']) {
      expect(() => parseInventory(content)).toThrow(InventoryValidationError);
    }
  });

  it('bounds bytes and unique package count', () => {
    expect(() => parseInventory(`${' '.repeat(MAX_INVENTORY_BYTES + 1)}[]`)).toThrow(/2 MB/);
    const packages = Array.from({ length: 2001 }, (_, index) => ({
      name: `pkg-${index}`,
      version: '1.0.0',
      ecosystem: 'npm',
    }));
    expect(() => parseInventory(JSON.stringify(packages))).toThrow(/2,000/);
  });

  it('rejects duplicate resolved keys and complex keys before extracting package versions', () => {
    const prefix = "lockfileVersion: '9.0'\npackages:\n";
    for (const entries of [
      '  pkg@1.0.0: {}\n  "pkg@1.0.0": {}',
      '  pkg@1.0.0: {version: 1.0.0, "version": 2.0.0}',
      '  ? [pkg, 1.0.0]\n  : {}',
    ]) {
      expect(() => parseInventory(prefix + entries, 'pnpm-lock')).toThrow(/not valid/);
    }
    const nested = '['.repeat(INVENTORY_YAML_LIMITS.depth + 1);
    const closes = ']'.repeat(INVENTORY_YAML_LIMITS.depth + 1);
    expect(() =>
      parseInventory(`${prefix}  pkg@1.0.0: {}\nmetadata: ${nested}value${closes}`, 'pnpm-lock'),
    ).toThrow(/not valid/);
  });

  it('rejects YAML aliases and duplicate mapping keys', () => {
    expect(() =>
      parseInventory(`lockfileVersion: 9
packages: &packages
  pkg@1.0.0: {}
snapshots: *packages
`),
    ).toThrow(/not valid/);
    expect(() => parseInventory('lockfileVersion: 9\npackages: {}\npackages: {}')).toThrow(
      /not valid/,
    );
  });
});
