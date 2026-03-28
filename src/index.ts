#!/usr/bin/env node

/**
 * figma-assets CLI
 *
 * Usage:
 *   figma-assets <figma-url> --out-dir ./assets
 *   figma-assets <figma-url> -o ./assets --scale 3 --format jpg
 */

import { extract } from "./extract.js";

const args = process.argv.slice(2);

// MCP server mode
if (args.includes("--serve")) {
  const { startServer } = await import("./serve.js");
  await startServer();
  // Server runs until process is killed
} else if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
figma-assets — Extract production-ready SVG and raster assets from Figma

Usage:
  figma-assets <figma-url> --out-dir <dir> [options]

Options:
  -o, --out-dir <dir>     Output directory (required for CLI mode)
  --scale <n>             Raster export scale: 1, 2, 3, 4 (default: 2)
  --format <fmt>          Raster format: png or jpg (default: png)
  --threshold <bytes>     SVG size threshold for raster detection (default: 50000)
  --cache-dir <dir>       Cache directory (default: .figma-assets/cache)
  --refresh               Bypass cache
  --json                  Output asset manifest as JSON
  --serve                 Start as MCP server (for Claude Code, Cursor, etc.)
  -h, --help              Show this help

Environment:
  FIGMA_TOKEN             Figma Personal Access Token (required)

Examples:
  figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
  figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./icons --scale 3
`);
  process.exit(0);
}

// Parse args
const figmaUrl = args.find(a => a.startsWith("http")) ?? args[0];
const outDir = getFlag(args, "--out-dir") ?? getFlag(args, "-o");
const scale = getFlag(args, "--scale");
const format = getFlag(args, "--format");
const threshold = getFlag(args, "--threshold");
const cacheDir = getFlag(args, "--cache-dir");
const refresh = args.includes("--refresh");
const json = args.includes("--json");

if (!figmaUrl || !outDir) {
  console.error("Error: <figma-url> and --out-dir are required.");
  process.exit(1);
}

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error("Error: FIGMA_TOKEN environment variable is not set.");
  process.exit(1);
}

try {
  const result = await extract({
    figmaUrl,
    token,
    outDir,
    rasterScale: scale ? parseInt(scale) : undefined,
    rasterFormat: format as "png" | "jpg" | undefined,
    rasterThreshold: threshold ? parseInt(threshold) : undefined,
    cacheDir: cacheDir ?? undefined,
    refresh,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { stats } = result;
    console.log(`✓ ${stats.total} assets → ${outDir}/`);
    console.log(`  ${stats.svgs} SVG, ${stats.rasters} raster${stats.deduplicated > 0 ? `, ${stats.deduplicated} deduplicated` : ""}`);
    console.log();
    for (const asset of result.assets) {
      const tag = asset.type === "raster" ? ` [${format ?? "png"} @${asset.rasterScale}x]` : "";
      console.log(`  ${asset.fileName}${tag}`);
    }
  }
} catch (err) {
  console.error("Error:", (err as Error).message);
  process.exit(1);
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
