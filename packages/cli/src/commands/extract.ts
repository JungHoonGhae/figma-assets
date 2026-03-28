import { parseFigmaUrl, extract, loadConfig } from "@figma-doctor/core";
import { formatJson } from "../formatters/json.js";

interface ExtractCommandOptions {
  format?: "table" | "json";
  refresh?: boolean;
  svgsOnly?: boolean;
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

  const result = await extract({ fileKey, nodeId, token, cacheDir, refresh: options.refresh });

  // --svgs-only: output only SVGs with node metadata (small output for AI agents)
  if (options.svgsOnly) {
    const svgEntries = result.nodes
      .filter(n => n.svg)
      .map(n => ({ id: n.id, name: n.name, type: n.type, width: n.styles.width, height: n.styles.height, svg: n.svg }));
    console.log(formatJson(svgEntries));
    return;
  }

  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    const { total, unique, deduplicated } = result.svgStats;
    console.log(`Extracted ${result.count} nodes from ${nodeId}`);
    console.log(`SVGs: ${total} total (${unique} unique, ${deduplicated} deduplicated)\n`);
    for (const node of result.nodes) {
      const label = node.characters ? `${node.type} "${node.characters}"` : `${node.type} ${node.name}`;
      const svgTag = node.svg ? " [SVG]" : "";
      console.log(`  ${node.id} ${label}${svgTag}`);
      for (const [key, value] of Object.entries(node.styles)) {
        if (value) console.log(`    ${key}: ${value}`);
      }
    }
  }
}
