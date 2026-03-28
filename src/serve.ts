/**
 * MCP server mode — exposes extract_assets as a tool for AI agents.
 *
 * Usage in Claude Code / Cursor MCP settings:
 * {
 *   "mcpServers": {
 *     "figma-assets": {
 *       "command": "npx",
 *       "args": ["figma-assets", "--serve"],
 *       "env": { "FIGMA_TOKEN": "figd_..." }
 *     }
 *   }
 * }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { extract } from "./extract.js";

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "figma-assets",
    version: "0.1.0",
  });

  server.tool(
    "extract_assets",
    "Extract production-ready SVG and raster assets from a Figma frame. Returns actual files — complete SVGs with proper viewBox, auto-detected raster PNGs. Use this instead of MCP asset URLs which expire in 7 days and return cropped SVG fragments.",
    {
      figmaUrl: z.string().describe("Figma URL with node-id, e.g. https://figma.com/design/abc/File?node-id=123-456"),
      outDir: z.string().default("./assets").describe("Output directory for extracted assets"),
      scale: z.number().min(1).max(4).default(2).describe("Raster export scale"),
      format: z.enum(["png", "jpg"]).default("png").describe("Raster export format"),
      refresh: z.boolean().default(false).describe("Bypass cache"),
    },
    async ({ figmaUrl, outDir, scale, format, refresh }) => {
      const token = process.env.FIGMA_TOKEN;
      if (!token) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: FIGMA_TOKEN environment variable is not set. Add it to your MCP server config env.",
          }],
        };
      }

      try {
        const result = await extract({
          figmaUrl,
          token,
          outDir,
          rasterScale: scale,
          rasterFormat: format,
          refresh,
        });

        const summary = [
          `✓ ${result.stats.total} assets → ${outDir}/`,
          `  ${result.stats.svgs} SVG, ${result.stats.rasters} raster${result.stats.deduplicated > 0 ? `, ${result.stats.deduplicated} deduplicated` : ""}`,
          "",
          "Assets:",
          ...result.assets.map(a => {
            const tag = a.type === "raster" ? ` [${format} @${a.rasterScale}x]` : "";
            return `  ${a.fileName}${tag}`;
          }),
          "",
          "Usage:",
          '  SVG: <img src="' + outDir + '/icon-name.svg" />',
          '  PNG: <img src="' + outDir + '/image-name@2x.png" />',
          "",
          "Do NOT recreate SVG icons manually. Use these files.",
        ];

        return {
          content: [{
            type: "text" as const,
            text: summary.join("\n"),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          }],
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
