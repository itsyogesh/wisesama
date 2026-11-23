import { describe, expect, it } from 'vitest';
import { isMap, isScalar, LineCounter } from 'yaml';
import { parseBoundedYaml, type YamlLimits } from '../bounded-yaml';

const limits: YamlLimits = { bytes: 2048, nodes: 100, depth: 8 };

describe('bounded YAML AST validation', () => {
  it('keeps independent mapping keys and original source ranges', () => {
    const lines = new LineCounter();
    const document = parseBoundedYaml('first: {name: one}\nsecond: {name: two}\n', limits, lines);
    expect(isMap(document.contents)).toBe(true);
    if (!isMap(document.contents)) throw new Error('expected mapping');
    const key = document.contents.items[1]?.key;
    expect(isScalar(key) && key.range && lines.linePos(key.range[0]).line).toBe(2);
    expect(document.toJS({ maxAliasCount: 0 })).toEqual({
      first: { name: 'one' },
      second: { name: 'two' },
    });
  });

  it.each([
    'name: one\nname: two',
    'name: one\n"na\\u006de": two',
    'outer: {name: one, "name": two}',
    'value: &value one\nother: *value',
    '? [one, two]\n: value',
    '1: value',
    'value: !custom data',
  ])('rejects duplicate, aliased or unsupported keys and tags: %s', (content) => {
    expect(() => parseBoundedYaml(content, limits)).toThrow();
  });

  it('counts key and empty-value slots and enforces small structural limits', () => {
    expect(() => parseBoundedYaml('key:', { ...limits, nodes: 2 })).toThrow(/structure/);
    expect(parseBoundedYaml('key:', { ...limits, nodes: 3 }).toJS()).toEqual({ key: null });
    expect(() => parseBoundedYaml('a: {b: value}', { ...limits, depth: 1 })).toThrow(/structure/);
    expect(() => parseBoundedYaml('a: [one, two]', { ...limits, nodes: 4 })).toThrow(/structure/);
  });

  it('checks UTF-8 bytes before parsing', () => {
    expect(() => parseBoundedYaml('key: é', { ...limits, bytes: 6 })).toThrow(/byte/);
    expect(parseBoundedYaml('key: é', { ...limits, bytes: 7 }).toJS()).toEqual({ key: 'é' });
  });
});
