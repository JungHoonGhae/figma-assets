import { parseFigmaUrl, extract, loadConfig } from "@figma-doctor/core";
import type { ExtractResult } from "@figma-doctor/core";
import { formatJson } from "../formatters/json.js";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface ExtractCommandOptions {
  format?: "table" | "json";
  refresh?: boolean;
  svgsOnly?: boolean;
  compact?: boolean;
  rasterScale?: string;
  rasterFormat?: string;
  outDir?: string;
}

export async function extractCommand(figmaUrl: string, options: ExtractCommandOptions): Promise<void> {
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  let token: string;
  let cacheDir = ".figma-doctor/cache";
  try {
    const config = loadConfig(process.cwd());
    token = config.figma.token; cacheDir = config.cache?.dir ?? cacheDir;
  } catch {
    token = process.env.FIGMA_TOKEN ?? "";
    if (!token) { console.error("Error: FIGMA_TOKEN not set."); process.exit(1); }
  }

  const rasterScale = options.rasterScale ? parseInt(options.rasterScale) : undefined;
  const rasterFormat = options.rasterFormat as "png" | "jpg" | undefined;

  const result = await extract({
    fileKey, nodeId, token, cacheDir,
    refresh: options.refresh,
    rasterScale,
    rasterFormat,
  });

  // --out-dir: save assets as files and return file paths
  if (options.outDir) {
    const assetPaths = await saveAssets(result, options.outDir);
    console.log(formatJson(assetPaths));
    return;
  }

  // --svgs-only: output SVGs + rasters with node metadata
  if (options.svgsOnly) {
    const entries = result.nodes
      .filter(n => n.svg || n.raster)
      .map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        width: n.styles.width,
        height: n.styles.height,
        ...(n.svg ? { svg: n.svg } : {}),
        ...(n.raster ? {
          raster: n.raster,
          hint: "Raster image includes visual styles (border, background, radius). Use <img> directly without container styling.",
        } : {}),
      }));
    console.log(formatJson(entries));
    return;
  }

  // --compact: lightweight tree for AI agents — only meaningful nodes with non-empty styles
  if (options.compact) {
    const tree = compactTree(result.nodes[0]);
    console.log(formatJson(tree));
    return;
  }

  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    const { total, unique, deduplicated, rasterConverted } = result.svgStats;
    console.log(`Extracted ${result.count} nodes from ${nodeId}`);
    console.log(`SVGs: ${total} total (${unique} unique, ${deduplicated} deduplicated)`);
    if (rasterConverted > 0) {
      console.log(`Rasters: ${rasterConverted} raster-embedded SVGs → ${rasterFormat ?? "png"} @${rasterScale ?? 2}x`);
    }
    console.log();
    for (const node of result.nodes) {
      const label = node.characters ? `${node.type} "${node.characters}"` : `${node.type} ${node.name}`;
      const tag = node.svg ? " [SVG]" : node.raster ? ` [${node.raster.format.toUpperCase()} @${node.raster.scale}x]` : "";
      console.log(`  ${node.id} ${label}${tag}`);
      for (const [key, value] of Object.entries(node.styles)) {
        if (value) console.log(`    ${key}: ${value}`);
      }
    }
  }
}

import type { FigmaNode, NormalizedStyles } from "@figma-doctor/core";

interface CompactNode {
  name: string;
  type: string;
  text?: string;
  styles: Record<string, string>;
  svg?: string;
  raster?: { format: string; scale: number; filePath: string; hint: string };
  children?: CompactNode[];
}

// Layout-only styles that are inherited/default and can be omitted when trivial
const SKIP_DEFAULTS: Record<string, string> = {
  display: "flex",  // keep — important
  flexDirection: "column", // keep when present
  overflow: "visible",
};

function compactTree(node: FigmaNode): CompactNode | null {
  // Filter styles: remove undefined/empty, remove width+height from containers (derivable)
  const styles = cleanStyles(node);
  const hasContent = node.characters || node.svg || node.raster || Object.keys(styles).length > 0;

  // Recursively compact children
  let children: CompactNode[] | undefined;
  if (node.children?.length) {
    const compacted = node.children.map(compactTree).filter((c): c is CompactNode => c !== null);
    if (compacted.length > 0) children = compacted;
  }

  // Skip empty intermediate nodes (no styles, no content, only pass-through)
  if (!hasContent && children?.length === 1) {
    return children[0]; // Collapse pass-through
  }
  if (!hasContent && !children) {
    return null; // Prune dead leaf
  }

  const compact: CompactNode = {
    name: node.name,
    type: node.type,
    styles,
  };

  if (node.characters) compact.text = node.characters;
  if (node.svg) compact.svg = "[SVG]"; // placeholder — actual SVG in --svgs-only
  if (node.raster) compact.raster = {
    format: node.raster.format,
    scale: node.raster.scale,
    filePath: node.raster.filePath,
    hint: "Use <img> directly without container styling.",
  };
  if (children) compact.children = children;

  return compact;
}

function cleanStyles(node: FigmaNode): Record<string, string> {
  const result: Record<string, string> = {};
  const s = node.styles;

  for (const [key, value] of Object.entries(s)) {
    if (!value) continue;

    // Skip width/height for container FRAME/GROUP — usually derivable from content
    // Keep for TEXT, INSTANCE, leaf nodes
    if ((key === "width" || key === "height") && node.children?.length && !node.characters) {
      // Keep only if it looks like a fixed-size container (no auto-layout children)
      if (s.display === "flex") continue; // flex containers derive size from children
    }

    result[key] = value;
  }

  return result;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").replace(/_+/g, "_").substring(0, 60);
}

interface AssetEntry {
  id: string;
  name: string;
  type: string;
  width?: string;
  height?: string;
  filePath: string;
  hint?: string;
}

async function saveAssets(result: ExtractResult, outDir: string): Promise<AssetEntry[]> {
  mkdirSync(outDir, { recursive: true });

  const entries: AssetEntry[] = [];
  const nameCount = new Map<string, number>();

  for (const node of result.nodes) {
    if (!node.svg && !node.raster) continue;

    // Generate unique filename
    const baseName = safeName(node.name);
    const count = nameCount.get(baseName) ?? 0;
    nameCount.set(baseName, count + 1);
    const suffix = count > 0 ? `-${count}` : "";

    if (node.svg) {
      const fileName = `${baseName}${suffix}.svg`;
      const filePath = join(outDir, fileName);
      writeFileSync(filePath, node.svg);
      entries.push({
        id: node.id,
        name: node.name,
        type: node.type,
        width: node.styles.width,
        height: node.styles.height,
        filePath: fileName,
      });
    }

    if (node.raster) {
      const ext = node.raster.format;
      const scale = node.raster.scale;
      const fileName = `${baseName}${suffix}@${scale}x.${ext}`;
      const filePath = join(outDir, fileName);

      // Copy from cache to outDir
      if (existsSync(node.raster.filePath)) {
        copyFileSync(node.raster.filePath, filePath);
      }

      entries.push({
        id: node.id,
        name: node.name,
        type: node.type,
        width: node.styles.width,
        height: node.styles.height,
        filePath: fileName,
        hint: "Raster — use <img src=\"" + fileName + "\"> directly, no container styling needed.",
      });
    }
  }

  console.error(`✓ Saved ${entries.length} assets to ${outDir}/`);
  return entries;
}
