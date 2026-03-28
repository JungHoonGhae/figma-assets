/**
 * Walk a Figma node tree and collect asset node IDs for SVG export.
 * Handles container grouping, deduplication, and raster detection.
 */

import type { FigmaNode } from "./figma.js";

const SVG_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "LINE", "ELLIPSE"]);
const CONTAINER_TYPES = new Set(["INSTANCE", "FRAME", "COMPONENT", "GROUP"]);

export interface CollectResult {
  /** Unique node IDs to fetch (after dedup) */
  uniqueIds: string[];
  /** Map of duplicate ID → original ID (copy SVG from original) */
  duplicateMap: Record<string, string>;
  /** All collected node IDs (unique + duplicates) */
  allIds: string[];
}

export function collectAssetIds(node: FigmaNode): CollectResult {
  const allIds: string[] = [];
  const signatures = new Map<string, string>();
  const duplicateMap: Record<string, string> = {};

  walk(node, allIds, signatures, duplicateMap);

  const dupSet = new Set(Object.keys(duplicateMap));
  const uniqueIds = allIds.filter(id => !dupSet.has(id));

  return { uniqueIds, duplicateMap, allIds };
}

function walk(
  node: FigmaNode,
  ids: string[],
  sigs: Map<string, string>,
  dups: Record<string, string>
): void {
  // Skip invisible nodes
  if (node.visible === false) return;

  // Container that should export as a single SVG?
  if (node.children && CONTAINER_TYPES.has(node.type)) {
    if (shouldExportAsUnit(node)) {
      addWithDedup(node, ids, sigs, dups);
      return;
    }
  }

  // Leaf SVG node
  if (SVG_TYPES.has(node.type)) {
    addWithDedup(node, ids, sigs, dups);
    return;
  }

  // Recurse
  if (node.children) {
    for (const child of node.children) {
      if (child.visible !== false) walk(child, ids, sigs, dups);
    }
  }
}

function shouldExportAsUnit(node: FigmaNode): boolean {
  const bbox = node.absoluteBoundingBox;

  // Small frame with vector descendants — icon
  if (bbox && bbox.width <= 48 && bbox.height <= 48 && hasVectorDescendants(node)) {
    return true;
  }

  // INSTANCE/COMPONENT with all-vector leaves — logo, complex icon
  if ((node.type === "INSTANCE" || node.type === "COMPONENT") && allLeavesAreSvg(node)) {
    return true;
  }

  return false;
}

function hasVectorDescendants(node: FigmaNode): boolean {
  if (SVG_TYPES.has(node.type)) return true;
  return node.children?.some(c => hasVectorDescendants(c)) ?? false;
}

function allLeavesAreSvg(node: FigmaNode): boolean {
  if (!node.children || node.children.length === 0) return SVG_TYPES.has(node.type);
  return node.children.every(child => allLeavesAreSvg(child));
}

function addWithDedup(
  node: FigmaNode,
  ids: string[],
  sigs: Map<string, string>,
  dups: Record<string, string>
): void {
  const sig = signature(node);
  const existing = sigs.get(sig);
  if (existing) {
    dups[node.id] = existing;
  } else {
    sigs.set(sig, node.id);
  }
  ids.push(node.id);
}

function signature(node: FigmaNode): string {
  const bbox = node.absoluteBoundingBox;
  const w = bbox ? Math.round(bbox.width) : 0;
  const h = bbox ? Math.round(bbox.height) : 0;
  if (node.componentId) return `comp:${node.componentId}:${w}x${h}`;
  return `name:${node.name}:${node.type}:${w}x${h}`;
}

// --- Raster detection ---

const DEFAULT_RASTER_THRESHOLD = 50_000; // 50KB

export function isRasterSvg(svg: string, threshold = DEFAULT_RASTER_THRESHOLD): boolean {
  return svg.length > threshold || svg.includes("data:image/");
}
