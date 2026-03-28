/**
 * Core extract function — the only public API.
 * Fetches a Figma node tree, collects asset IDs, downloads SVGs,
 * detects raster-embedded SVGs, and saves everything as files.
 */

import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchNode, fetchImageUrls, fetchLastModified, parseFigmaUrl, type FigmaNode } from "./figma.js";
import { collectAssetIds, isRasterSvg } from "./collect.js";

export interface ExtractOptions {
  /** Figma URL with node-id parameter */
  figmaUrl: string;
  /** Figma Personal Access Token */
  token: string;
  /** Output directory for assets */
  outDir: string;
  /** Scale for raster exports (default: 2) */
  rasterScale?: number;
  /** Format for raster exports (default: "png") */
  rasterFormat?: "png" | "jpg";
  /** SVG size threshold to trigger raster export in bytes (default: 50000) */
  rasterThreshold?: number;
  /** Cache directory (default: ".figma-assets/cache") */
  cacheDir?: string;
  /** Bypass cache */
  refresh?: boolean;
}

export interface AssetEntry {
  id: string;
  name: string;
  fileName: string;
  type: "svg" | "raster";
  width?: number;
  height?: number;
  rasterScale?: number;
}

export interface ExtractResult {
  assets: AssetEntry[];
  stats: {
    total: number;
    svgs: number;
    rasters: number;
    deduplicated: number;
  };
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  const { fileKey, nodeId } = parseFigmaUrl(options.figmaUrl);
  const rasterScale = options.rasterScale ?? 2;
  const rasterFormat = options.rasterFormat ?? "png";
  const rasterThreshold = options.rasterThreshold ?? 50_000;
  const cacheDir = options.cacheDir ?? ".figma-assets/cache";

  mkdirSync(options.outDir, { recursive: true });

  // 0. Auto-invalidate cache if Figma file has changed
  let useCache = !options.refresh;
  if (useCache) {
    const cachedTimestamp = readCache(cacheDir, "meta", fileKey);
    const currentTimestamp = await fetchLastModified(fileKey, options.token);
    if (cachedTimestamp !== currentTimestamp) {
      useCache = false; // file changed — bypass cache
      writeCache(cacheDir, "meta", fileKey, currentTimestamp);
    }
  }

  // 1. Fetch node tree
  const root = await fetchNode(fileKey, nodeId, options.token);

  // 2. Collect asset IDs with dedup
  const { uniqueIds, duplicateMap, allIds } = collectAssetIds(root);

  // 3. Fetch SVGs (unique only, with cache)
  const svgs: Record<string, string> = {};
  const uncachedIds: string[] = [];

  for (const id of uniqueIds) {
    if (useCache) {
      const cached = readCache(cacheDir, "svg", id);
      if (cached) { svgs[id] = cached; continue; }
    }
    uncachedIds.push(id);
  }

  if (uncachedIds.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < uncachedIds.length; i += BATCH) {
      const batch = uncachedIds.slice(i, i + BATCH);
      const urls = await fetchImageUrls(fileKey, batch, options.token, "svg");

      const CONCURRENCY = 20;
      const entries = Object.entries(urls);
      for (let j = 0; j < entries.length; j += CONCURRENCY) {
        const chunk = entries.slice(j, j + CONCURRENCY);
        await Promise.allSettled(chunk.map(async ([id, url]) => {
          const res = await fetch(url);
          if (res.ok) {
            svgs[id] = await res.text();
            writeCache(cacheDir, "svg", id, svgs[id]);
          }
        }));
      }
    }
  }

  // Copy duplicates
  for (const [dupId, origId] of Object.entries(duplicateMap)) {
    if (svgs[origId]) svgs[dupId] = svgs[origId];
  }

  // 4. Classify: vector vs raster-embedded
  const vectorSvgs: Record<string, string> = {};
  const rasterNodeIds: string[] = [];

  for (const [id, svg] of Object.entries(svgs)) {
    if (isRasterSvg(svg, rasterThreshold)) {
      rasterNodeIds.push(id);
    } else {
      vectorSvgs[id] = svg;
    }
  }

  if (rasterNodeIds.length > 0) {
    console.error(`⚠ ${rasterNodeIds.length} asset(s) contain embedded raster data → exporting as ${rasterFormat.toUpperCase()} @${rasterScale}x`);
  }

  // 5. Fetch raster images for raster-embedded nodes
  const rasterFiles: Record<string, string> = {}; // id → filePath

  if (rasterNodeIds.length > 0) {
    // Dedup raster IDs (only fetch unique originals)
    const uniqueRasterIds = rasterNodeIds.filter(id => !duplicateMap[id] || !rasterNodeIds.includes(duplicateMap[id]));

    const urls = await fetchImageUrls(fileKey, uniqueRasterIds, options.token, rasterFormat, rasterScale);

    const CONCURRENCY = 20;
    const entries = Object.entries(urls);
    for (let j = 0; j < entries.length; j += CONCURRENCY) {
      const chunk = entries.slice(j, j + CONCURRENCY);
      await Promise.allSettled(chunk.map(async ([id, url]) => {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const cachePath = writeCacheBinary(cacheDir, rasterFormat, id, rasterScale, buffer);
          rasterFiles[id] = cachePath;
        }
      }));
    }

    // Copy raster duplicates
    for (const id of rasterNodeIds) {
      if (!rasterFiles[id] && duplicateMap[id] && rasterFiles[duplicateMap[id]]) {
        rasterFiles[id] = rasterFiles[duplicateMap[id]];
      }
    }
  }

  // 6. Build node name lookup
  const nodeMap = new Map<string, { name: string; bbox?: { width: number; height: number } }>();
  buildNodeMap(root, nodeMap);

  // 7. Save files to outDir
  const assets: AssetEntry[] = [];
  const nameCount = new Map<string, number>();

  for (const id of allIds) {
    const info = nodeMap.get(id);
    const name = info?.name ?? id;
    const baseName = safeName(name);
    const count = nameCount.get(baseName) ?? 0;
    nameCount.set(baseName, count + 1);
    const suffix = count > 0 ? `-${count}` : "";

    if (vectorSvgs[id]) {
      const fileName = `${baseName}${suffix}.svg`;
      writeFileSync(join(options.outDir, fileName), vectorSvgs[id]);
      assets.push({
        id, name, fileName, type: "svg",
        width: info?.bbox?.width, height: info?.bbox?.height,
      });
    } else if (rasterFiles[id]) {
      const fileName = `${baseName}${suffix}@${rasterScale}x.${rasterFormat}`;
      copyFileSync(rasterFiles[id], join(options.outDir, fileName));
      assets.push({
        id, name, fileName, type: "raster",
        width: info?.bbox?.width, height: info?.bbox?.height,
        rasterScale,
      });
    }
  }

  // Save timestamp for future cache checks
  if (!options.refresh) {
    const ts = await fetchLastModified(fileKey, options.token).catch(() => "");
    if (ts) writeCache(cacheDir, "meta", fileKey, ts);
  }

  return {
    assets,
    stats: {
      total: assets.length,
      svgs: assets.filter(a => a.type === "svg").length,
      rasters: assets.filter(a => a.type === "raster").length,
      deduplicated: Object.keys(duplicateMap).length,
    },
  };
}

// --- Helpers ---

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").replace(/_+/g, "_").substring(0, 60);
}

function buildNodeMap(node: FigmaNode, map: Map<string, { name: string; bbox?: { width: number; height: number } }>): void {
  map.set(node.id, {
    name: node.name,
    bbox: node.absoluteBoundingBox ? { width: node.absoluteBoundingBox.width, height: node.absoluteBoundingBox.height } : undefined,
  });
  if (node.children) {
    for (const child of node.children) buildNodeMap(child, map);
  }
}

// --- Cache ---

function cacheKey(id: string): string {
  return id.replace(/:/g, "-");
}

function readCache(cacheDir: string, ext: string, id: string): string | null {
  const path = join(cacheDir, ext, `${cacheKey(id)}.${ext}`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function writeCache(cacheDir: string, ext: string, id: string, data: string): void {
  const dir = join(cacheDir, ext);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${cacheKey(id)}.${ext}`), data);
}

function writeCacheBinary(cacheDir: string, format: string, id: string, scale: number, buffer: Buffer): string {
  const dir = join(cacheDir, "rasters");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${cacheKey(id)}@${scale}x.${format}`);
  writeFileSync(path, buffer);
  return path;
}

// Re-export for library usage
export { parseFigmaUrl } from "./figma.js";
export type { FigmaNode } from "./figma.js";
