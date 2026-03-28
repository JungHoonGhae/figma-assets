# Changelog

## 0.1.0 (2026-03-28)

Initial release.

### Features

- **SVG extraction** — Exports complete, self-contained SVGs from Figma via REST API `/v1/images?format=svg`
- **Raster detection** — Auto-detects SVGs with embedded bitmaps (>50KB or base64 content) and re-exports as PNG
- **Container grouping** — Small containers (≤48px) with vector children export as single SVGs instead of individual paths
- **Logo detection** — INSTANCE/COMPONENT nodes with all-vector descendants export as single SVGs
- **Deduplication** — Identical components (same componentId) fetched once, copied for duplicates
- **Parallel downloads** — SVG/PNG URLs fetched with concurrency of 20
- **Batched API calls** — Node IDs batched in groups of 50 per Figma API request
- **Caching** — API responses and downloaded assets cached in `.figma-assets/cache/`
- **MCP server mode** — `--serve` flag exposes `extract_assets` tool for Claude Code, Cursor, etc.
- **CLI** — `figma-assets <url> -o ./assets` with options for scale, format, threshold
- **Programmatic API** — `import { extract } from "figma-assets"`
