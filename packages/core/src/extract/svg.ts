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
  // Check if this container should be exported as a single SVG
  if (node.children && isContainerType(node.type)) {
    if (shouldExportAsUnit(node)) {
      ids.push(node.id);
      return; // Don't descend into children
    }
  }

  // Leaf SVG node
  if (SVG_NODE_TYPES.has(node.type)) {
    ids.push(node.id);
    return;
  }

  // Recurse into non-SVG children
  if (node.children) {
    for (const child of node.children) {
      collectSvgIds(child, ids);
    }
  }
}

const CONTAINER_TYPES = new Set(["INSTANCE", "FRAME", "COMPONENT", "GROUP"]);

function isContainerType(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

/**
 * A container should be exported as a single SVG if:
 * 1. Small (≤48px) with vector children — standard icon, OR
 * 2. INSTANCE/COMPONENT where all leaf descendants are SVG types — vector-only (logos etc.)
 */
function shouldExportAsUnit(node: RawFigmaNode): boolean {
  const bbox = node.absoluteBoundingBox;

  // Small frame with vector descendants — obvious icon
  if (bbox && bbox.width <= 48 && bbox.height <= 48 && hasVectorDescendants(node)) {
    return true;
  }

  // INSTANCE or COMPONENT with all-vector leaves — logos, icon assets
  if ((node.type === "INSTANCE" || node.type === "COMPONENT") && allLeavesAreSvg(node)) {
    return true;
  }

  return false;
}

function hasVectorDescendants(node: RawFigmaNode): boolean {
  if (SVG_NODE_TYPES.has(node.type)) return true;
  return node.children?.some(c => hasVectorDescendants(c)) ?? false;
}

function allLeavesAreSvg(node: RawFigmaNode): boolean {
  if (!node.children || node.children.length === 0) {
    return SVG_NODE_TYPES.has(node.type);
  }
  return node.children.every(child => allLeavesAreSvg(child));
}

/**
 * Collect SVG node IDs with deduplication.
 * Identical component instances (same componentId + size, or name+type+size) are
 * deduplicated — only the first occurrence is fetched; duplicates are tracked in
 * duplicateMap so callers can copy the SVG without a network request.
 */
export function collectSvgNodeIdsWithDedup(node: RawFigmaNode): {
  uniqueIds: string[];
  duplicateMap: Record<string, string>; // duplicateId → originalId
} {
  const allIds: string[] = [];
  const signatures = new Map<string, string>(); // signature → first nodeId
  const duplicateMap: Record<string, string> = {};

  collectSvgIdsDedup(node, allIds, signatures, duplicateMap);

  const dupSet = new Set(Object.keys(duplicateMap));
  const uniqueIds = allIds.filter(id => !dupSet.has(id));

  return { uniqueIds, duplicateMap };
}

function svgSignature(node: RawFigmaNode): string {
  const bbox = node.absoluteBoundingBox;
  const w = bbox ? Math.round(bbox.width) : 0;
  const h = bbox ? Math.round(bbox.height) : 0;
  if (node.componentId) return `comp:${node.componentId}:${w}x${h}`;
  return `name:${node.name}:${node.type}:${w}x${h}`;
}

function collectSvgIdsDedup(
  node: RawFigmaNode,
  ids: string[],
  signatures: Map<string, string>,
  duplicateMap: Record<string, string>
): void {
  // Check if this container should be exported as a single SVG
  if (node.children && isContainerType(node.type)) {
    if (shouldExportAsUnit(node)) {
      addWithDedup(node, ids, signatures, duplicateMap);
      return;
    }
  }

  // Leaf SVG node
  if (SVG_NODE_TYPES.has(node.type)) {
    addWithDedup(node, ids, signatures, duplicateMap);
    return;
  }

  // Recurse into non-SVG children
  if (node.children) {
    for (const child of node.children) {
      collectSvgIdsDedup(child, ids, signatures, duplicateMap);
    }
  }
}

function addWithDedup(
  node: RawFigmaNode,
  ids: string[],
  signatures: Map<string, string>,
  duplicateMap: Record<string, string>
): void {
  const sig = svgSignature(node);
  const existing = signatures.get(sig);
  if (existing) {
    duplicateMap[node.id] = existing;
  } else {
    signatures.set(sig, node.id);
  }
  ids.push(node.id);
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

    const CONCURRENCY = 20;
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

const DEFAULT_RASTER_THRESHOLD = 50_000; // 50KB

/**
 * Check if an SVG contains embedded raster data (base64 images).
 */
export function isRasterSvg(svg: string, threshold = DEFAULT_RASTER_THRESHOLD): boolean {
  if (svg.length > threshold) return true;
  return svg.includes("data:image/") || svg.includes("xlink:href=\"data:");
}

/**
 * Separate SVGs into pure vector and raster-embedded.
 */
export function classifySvgs(
  svgs: Record<string, string>,
  threshold = DEFAULT_RASTER_THRESHOLD
): { vector: Record<string, string>; rasterNodeIds: string[] } {
  const vector: Record<string, string> = {};
  const rasterNodeIds: string[] = [];

  for (const [nodeId, svg] of Object.entries(svgs)) {
    if (isRasterSvg(svg, threshold)) {
      rasterNodeIds.push(nodeId);
    } else {
      vector[nodeId] = svg;
    }
  }

  return { vector, rasterNodeIds };
}

/**
 * Fetch raster images (PNG/JPG) from Figma's image export API.
 * Returns nodeId → { format, scale, buffer }.
 */
export async function fetchRasterImages(
  fileKey: string,
  nodeIds: string[],
  token: string,
  options: { format?: "png" | "jpg"; scale?: number } = {}
): Promise<Record<string, { format: "png" | "jpg"; scale: number; buffer: Buffer }>> {
  if (nodeIds.length === 0) return {};

  const format = options.format ?? "png";
  const scale = options.scale ?? 2;
  const BATCH_SIZE = 50;
  const result: Record<string, { format: "png" | "jpg"; scale: number; buffer: Buffer }> = {};

  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    const ids = batch.join(",");
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`;

    const response = await fetch(url, {
      headers: { "X-Figma-Token": token },
    });

    if (!response.ok) {
      console.error(`Raster fetch error: ${response.status} ${response.statusText}`);
      continue;
    }

    const data = await response.json() as { images: Record<string, string | null> };

    const entries = Object.entries(data.images ?? {}).filter(
      (e): e is [string, string] => e[1] !== null
    );

    const CONCURRENCY = 20;
    for (let j = 0; j < entries.length; j += CONCURRENCY) {
      const chunk = entries.slice(j, j + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async ([nodeId, imageUrl]) => {
          const imgResponse = await fetch(imageUrl);
          if (imgResponse.ok) {
            const buffer = Buffer.from(await imgResponse.arrayBuffer());
            result[nodeId] = { format, scale, buffer };
          }
        })
      );
    }
  }

  return result;
}
