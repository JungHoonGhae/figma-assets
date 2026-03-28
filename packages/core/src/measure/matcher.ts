import type { FigmaNode, NormalizedStyles } from "../types.js";

export interface SelectorEntry {
  nodeId: string;
  nodeName: string;
  strategy: "text" | "structural";
  textContent?: string;
  ambiguous: boolean;
}

export function buildSelectors(nodes: FigmaNode[]): SelectorEntry[] {
  const entries: SelectorEntry[] = [];

  for (const node of nodes) {
    if (!hasMeasurableStyles(node.styles)) continue;

    if (node.type === "TEXT" && node.characters) {
      entries.push({
        nodeId: node.id, nodeName: node.name,
        strategy: "text", textContent: node.characters, ambiguous: false,
      });
    } else if (hasMeasurableStyles(node.styles)) {
      entries.push({
        nodeId: node.id, nodeName: node.name,
        strategy: "structural", ambiguous: false,
      });
    }
  }

  // Mark duplicate textContent as ambiguous
  const textCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.textContent) {
      textCounts.set(entry.textContent, (textCounts.get(entry.textContent) ?? 0) + 1);
    }
  }
  for (const entry of entries) {
    if (entry.textContent && (textCounts.get(entry.textContent) ?? 0) > 1) {
      entry.ambiguous = true;
    }
  }
  return entries;
}

function hasMeasurableStyles(styles: NormalizedStyles): boolean {
  return Object.keys(styles).length > 0;
}

export function textXPath(text: string): string {
  return `//*[normalize-space(text())="${text}"]`;
}
