import type { FigmaNode, RasterImage } from "../types.js";
import { fetchFigmaNode, fetchFileLastModified, parseFigmaUrl } from "./client.js";
import { normalizeNode } from "./normalizer.js";
import { NodeCache } from "./cache.js";
import { collectSvgNodeIdsWithDedup, fetchSvgs, classifySvgs, fetchRasterImages } from "./svg.js";

export interface ExtractOptions {
  figmaUrl?: string;
  fileKey?: string;
  nodeId?: string;
  token: string;
  cacheDir?: string;
  refresh?: boolean;
  rasterScale?: number;   // default 2
  rasterFormat?: "png" | "jpg"; // default "png"
  rasterThreshold?: number; // SVG size in bytes to trigger raster export (default 50000)
}

export interface ExtractResult {
  nodes: FigmaNode[];
  svgs: Record<string, string>;
  rasters: Record<string, RasterImage>;
  count: number;
  svgStats: {
    total: number;
    unique: number;
    deduplicated: number;
    rasterConverted: number; // raster-embedded SVGs converted to PNG
  };
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  let fileKey: string;
  let nodeId: string;

  if (options.figmaUrl) {
    const parsed = parseFigmaUrl(options.figmaUrl);
    fileKey = parsed.fileKey;
    nodeId = parsed.nodeId;
  } else if (options.fileKey && options.nodeId) {
    fileKey = options.fileKey;
    nodeId = options.nodeId;
  } else {
    throw new Error("Provide either figmaUrl or both fileKey and nodeId");
  }

  const rasterScale = options.rasterScale ?? 2;
  const rasterFormat = options.rasterFormat ?? "png";
  const rasterThreshold = options.rasterThreshold ?? 50_000;

  const cache = options.cacheDir ? new NodeCache(options.cacheDir) : null;

  // Check file version cache
  if (cache && !options.refresh) {
    const cachedLastModified = cache.getLastModified(fileKey);
    if (cachedLastModified) {
      const currentLastModified = await fetchFileLastModified(fileKey, options.token);
      if (cachedLastModified === currentLastModified) {
        const cached = cache.get(nodeId);
        if (cached) {
          const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(cached as any);
          const svgs: Record<string, string> = {};
          let allCached = true;
          for (const id of uniqueIds) {
            const svg = cache.getSvg(id);
            if (svg) {
              svgs[id] = svg;
            } else {
              allCached = false;
              break;
            }
          }
          if (allCached) {
            for (const [dupId, origId] of Object.entries(duplicateMap)) {
              if (svgs[origId]) svgs[dupId] = svgs[origId];
            }
            return buildResult(cached as any, svgs, uniqueIds.length, Object.keys(duplicateMap).length, rasterThreshold, fileKey, options.token, cache, rasterScale, rasterFormat);
          }
        }
      }
    }
  }

  // Fetch or use cached node data
  let raw: any;
  if (cache && !options.refresh) {
    const cached = cache.get(nodeId);
    if (cached) raw = cached;
  }

  if (!raw) {
    raw = await fetchFigmaNode(fileKey, nodeId, options.token);
    if (cache) cache.set(nodeId, raw);
  }

  // Collect SVG node IDs with dedup
  const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(raw);

  // Fetch SVGs (unique only)
  const svgs: Record<string, string> = {};
  const missingIds: string[] = [];

  for (const id of uniqueIds) {
    if (cache && !options.refresh) {
      const cached = cache.getSvg(id);
      if (cached) {
        svgs[id] = cached;
        continue;
      }
    }
    missingIds.push(id);
  }

  if (missingIds.length > 0) {
    const fetched = await fetchSvgs(fileKey, missingIds, options.token);
    for (const [id, svg] of Object.entries(fetched)) {
      svgs[id] = svg;
      if (cache) cache.setSvg(id, svg);
    }
  }

  // Copy duplicates
  for (const [dupId, origId] of Object.entries(duplicateMap)) {
    if (svgs[origId]) svgs[dupId] = svgs[origId];
  }

  // Save lastModified
  if (cache) {
    const lastModified = await fetchFileLastModified(fileKey, options.token);
    cache.setLastModified(fileKey, lastModified);
  }

  return buildResult(raw, svgs, uniqueIds.length, Object.keys(duplicateMap).length, rasterThreshold, fileKey, options.token, cache, rasterScale, rasterFormat);
}

async function buildResult(
  raw: any,
  allSvgs: Record<string, string>,
  uniqueCount: number,
  dupCount: number,
  rasterThreshold: number,
  fileKey: string,
  token: string,
  cache: NodeCache | null,
  rasterScale: number,
  rasterFormat: "png" | "jpg"
): Promise<ExtractResult> {
  // Classify SVGs: vector vs raster-embedded
  const { vector, rasterNodeIds } = classifySvgs(allSvgs, rasterThreshold);

  // Warn about raster-embedded SVGs
  if (rasterNodeIds.length > 0) {
    console.error(`⚠ ${rasterNodeIds.length} SVG(s) contain embedded raster data — exporting as ${rasterFormat.toUpperCase()} @${rasterScale}x`);
  }

  // Fetch raster images for raster-embedded nodes
  const rasters: Record<string, RasterImage> = {};
  if (rasterNodeIds.length > 0) {
    const missingRasterIds: string[] = [];
    for (const id of rasterNodeIds) {
      if (cache) {
        const cachedPath = cache.getRasterPath(id, rasterFormat, rasterScale);
        if (cachedPath) {
          rasters[id] = { format: rasterFormat, scale: rasterScale, filePath: cachedPath };
          continue;
        }
      }
      missingRasterIds.push(id);
    }

    if (missingRasterIds.length > 0) {
      const fetched = await fetchRasterImages(fileKey, missingRasterIds, token, { format: rasterFormat, scale: rasterScale });
      for (const [id, img] of Object.entries(fetched)) {
        if (cache) {
          cache.setRaster(id, rasterFormat, rasterScale, img.buffer);
          const filePath = cache.getRasterPath(id, rasterFormat, rasterScale)!;
          rasters[id] = { format: rasterFormat, scale: rasterScale, filePath };
        } else {
          // No cache — create data URL as fallback
          const mime = rasterFormat === "jpg" ? "image/jpeg" : "image/png";
          const dataUrl = `data:${mime};base64,${img.buffer.toString("base64")}`;
          rasters[id] = { format: rasterFormat, scale: rasterScale, filePath: "", dataUrl };
        }
      }
    }
  }

  const node = normalizeNode(raw);
  attachSvgs(node, vector);
  attachRasters(node, rasters);
  const nodes = flattenNodes(node);

  return {
    nodes,
    svgs: vector,
    rasters,
    count: nodes.length,
    svgStats: {
      total: Object.keys(vector).length + rasterNodeIds.length,
      unique: uniqueCount,
      deduplicated: dupCount,
      rasterConverted: rasterNodeIds.length,
    },
  };
}

function attachSvgs(node: FigmaNode, svgs: Record<string, string>): void {
  if (svgs[node.id]) node.svg = svgs[node.id];
  if (node.children) {
    for (const child of node.children) attachSvgs(child, svgs);
  }
}

function attachRasters(node: FigmaNode, rasters: Record<string, RasterImage>): void {
  if (rasters[node.id]) node.raster = rasters[node.id];
  if (node.children) {
    for (const child of node.children) attachRasters(child, rasters);
  }
}

function flattenNodes(node: FigmaNode): FigmaNode[] {
  const result: FigmaNode[] = [node];
  if (node.children) {
    for (const child of node.children) result.push(...flattenNodes(child));
  }
  return result;
}

export { parseFigmaUrl } from "./client.js";
export { NodeCache } from "./cache.js";
