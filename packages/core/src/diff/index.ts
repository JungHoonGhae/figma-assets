import type { FigmaNode, DOMElement, DiffEntry, DiffResult, ToleranceConfig, NormalizedStyles } from "../types.js";
import { compareValues } from "./comparator.js";
import { DEFAULT_TOLERANCE } from "../config/schema.js";

export interface DiffOptions {
  nodes: FigmaNode[];
  elements: DOMElement[];
  tolerance?: ToleranceConfig;
}

export function diff(options: DiffOptions): DiffResult {
  const tolerance: Required<ToleranceConfig> = { ...DEFAULT_TOLERANCE, ...options.tolerance };
  const results: DiffEntry[] = [];

  for (const element of options.elements) {
    if (!element.matchedFigmaNodeId) continue;
    const node = options.nodes.find((n) => n.id === element.matchedFigmaNodeId);
    if (!node) continue;

    const properties = Object.keys(node.styles) as (keyof NormalizedStyles)[];
    for (const prop of properties) {
      const expected = node.styles[prop];
      const actual = element.computedStyles[prop];
      if (!expected || !actual) continue;

      const { pass, delta } = compareValues(prop, expected, actual, tolerance);
      results.push({
        nodeId: node.id, nodeName: node.name, selector: element.selector,
        property: prop, expected, actual, delta, pass,
      });
    }
  }

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;
  return { results, summary: { total: results.length, pass: passCount, fail: failCount }, pass: failCount === 0 };
}
