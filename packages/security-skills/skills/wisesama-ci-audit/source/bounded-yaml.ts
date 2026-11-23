// SPDX-License-Identifier: MIT
// Shared with the standalone Wisesama CI checker covered by packages/security-skills/LICENSE.
import { isAlias, isMap, isScalar, isSeq, type LineCounter, parseDocument } from 'yaml';

export type YamlLimits = { bytes: number; nodes: number; depth: number };
const encoder = new TextEncoder();

/**
 * Validate the AST before conversion or extraction. Disabling the library's pairwise
 * duplicate-key scan lets this bounded walk check resolved string keys with a Set.
 * The byte cap applies before parsing; AST limits do not bound every parser CPU path.
 */
export function parseBoundedYaml(content: string, limits: YamlLimits, lineCounter?: LineCounter) {
  if (content.length > limits.bytes || encoder.encode(content).length > limits.bytes)
    throw new Error('yaml-byte-limit');
  const document = parseDocument(content, { uniqueKeys: false, lineCounter });
  if (document.errors.length || document.warnings.length) throw new Error('unsupported-yaml');

  let nodes = 0;
  const visit = (node: unknown, depth: number): void => {
    // Count both mapping keys and values, including empty values, against one budget.
    if (++nodes > limits.nodes || depth > limits.depth || isAlias(node))
      throw new Error('yaml-structure-limit');
    if (isMap(node)) {
      const keys = new Set<string>();
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string')
          throw new Error('unsupported-yaml-key');
        visit(pair.key, depth + 1);
        if (keys.has(pair.key.value)) throw new Error('duplicate-yaml-key');
        keys.add(pair.key.value);
        visit(pair.value, depth + 1);
      }
    } else if (isSeq(node)) {
      for (const child of node.items) visit(child, depth + 1);
    } else if (node !== null && !isScalar(node)) {
      throw new Error('unsupported-yaml-node');
    }
  };
  visit(document.contents, 0);
  return document;
}
