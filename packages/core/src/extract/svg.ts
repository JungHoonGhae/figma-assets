import type { RawFigmaNode } from "./client.js";

// Node types that should be exported as SVG
const SVG_NODE_TYPES = new Set([
  "VECTOR", "BOOLEAN_OPERATION", "LINE", "ELLIPSE",
]);

/**
 * Collect node IDs that should be exported as SVG
 * Walks the tree and finds icon-like nodes
 */
export function collectSvgNodeIds(node: RawFigmaNode): string[] {
  const ids: string[] = [];
  collectSvgIds(node, ids);
  return ids;
}

function collectSvgIds(node: RawFigmaNode, ids: string[]): void {
  // If this node itself is an SVG-exportable type AND is a leaf or small subtree
  if (SVG_NODE_TYPES.has(node.type)) {
    ids.push(node.id);
  }

  // Check children - but if a parent INSTANCE/FRAME is small (likely an icon container),
  // export the parent instead of individual children
  if (node.children) {
    const bbox = node.absoluteBoundingBox;
    const isSmallFrame = bbox && bbox.width <= 48 && bbox.height <= 48;
    const hasVectorChildren = node.children.some(c => SVG_NODE_TYPES.has(c.type));

    if (isSmallFrame && hasVectorChildren && (node.type === "INSTANCE" || node.type === "FRAME" || node.type === "COMPONENT")) {
      // Export the container as a single SVG instead of individual vectors
      ids.push(node.id);
    } else {
      for (const child of node.children) {
        collectSvgIds(child, ids);
      }
    }
  }
}

/**
 * Fetch SVGs from Figma's image export API
 * Uses /v1/images endpoint with format=svg
 */
export async function fetchSvgs(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  // Figma API has a limit, batch in groups of 50
  const BATCH_SIZE = 50;
  const result: Record<string, string> = {};

  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    const ids = batch.join(",");
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${ids}&format=svg`;

    const response = await fetch(url, {
      headers: { "X-Figma-Token": token },
    });

    if (!response.ok) {
      console.error(`SVG fetch error: ${response.status} ${response.statusText}`);
      continue;
    }

    const data = await response.json() as { images: Record<string, string | null> };

    // Fetch all SVG URLs in parallel (concurrency limited to 10)
    const entries = Object.entries(data.images ?? {}).filter(
      (e): e is [string, string] => e[1] !== null
    );

    const CONCURRENCY = 10;
    for (let j = 0; j < entries.length; j += CONCURRENCY) {
      const chunk = entries.slice(j, j + CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map(async ([nodeId, svgUrl]) => {
          const svgResponse = await fetch(svgUrl);
          if (svgResponse.ok) {
            result[nodeId] = await svgResponse.text();
          }
        })
      );
    }
  }

  return result;
}
