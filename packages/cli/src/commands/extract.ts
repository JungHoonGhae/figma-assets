import { parseFigmaUrl, extract, loadConfig } from "@figma-doctor/core";
import { formatJson } from "../formatters/json.js";

interface ExtractCommandOptions {
  format?: "table" | "json";
  refresh?: boolean;
  svgsOnly?: boolean;
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
