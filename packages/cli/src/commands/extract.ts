import { parseFigmaUrl, extract, loadConfig } from "@figma-doctor/core";
import { formatJson } from "../formatters/json.js";

interface ExtractCommandOptions {
  format?: "table" | "json";
  refresh?: boolean;
  svgsOnly?: boolean;
  compact?: boolean;
  rasterScale?: string;
  rasterFormat?: string;
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
