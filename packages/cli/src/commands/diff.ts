import { loadConfig, extract, measure, diff, parseFigmaUrl } from "@figma-doctor/core";
import { formatDiffTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";

interface DiffCommandOptions {
  figmaUrl?: string;
  pageUrl?: string;
  format?: "table" | "json";
  refresh?: boolean;
  tolerance?: number;
}

export async function diffCommand(pageOrUrl: string, options: DiffCommandOptions): Promise<void> {
  let figmaNodeId: string, url: string, pageName: string, token: string, cacheDir: string, fileKey: string;
  let toleranceConfig = {};

  if (options.figmaUrl && options.pageUrl) {
    const parsed = parseFigmaUrl(options.figmaUrl);
    figmaNodeId = parsed.nodeId; fileKey = parsed.fileKey;
    url = options.pageUrl; pageName = "direct";
    token = process.env.FIGMA_TOKEN ?? ""; cacheDir = ".figma-doctor/cache";
  } else {
    const config = loadConfig(process.cwd());
    const page = config.pages[pageOrUrl];
    if (!page) { console.error(`Page "${pageOrUrl}" not found.`); process.exit(1); }
    figmaNodeId = page.figmaNodeId; url = page.url; pageName = pageOrUrl;
    token = config.figma.token; fileKey = config.figma.fileKey;
    cacheDir = config.cache?.dir ?? ".figma-doctor/cache";
    toleranceConfig = config.diff?.tolerance ?? {};
  }

  if (options.tolerance !== undefined) toleranceConfig = { ...toleranceConfig, size: options.tolerance };

  console.log(`Extracting Figma node ${figmaNodeId}...`);
  const extracted = await extract({ fileKey, nodeId: figmaNodeId, token, cacheDir, refresh: options.refresh });
  console.log(`Extracted ${extracted.count} nodes`);

  console.log(`Measuring ${url}...`);
  const measured = await measure({ url, nodes: extracted.nodes });
  console.log(`Matched ${measured.matched} of ${measured.total} elements`);

  const result = diff({ nodes: extracted.nodes, elements: measured.elements, tolerance: toleranceConfig });

  if (options.format === "json") console.log(formatJson(result));
  else console.log(formatDiffTable(result, { page: pageName, nodeId: figmaNodeId, url }));

  process.exit(result.pass ? 0 : 1);
}
