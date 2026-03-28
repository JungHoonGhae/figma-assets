# Changelog

## 0.2.0 (2026-03-28)

Complete rewrite. Pivoted from figma-doctor (CSS comparison tool) to figma-assets (asset extraction only).

### Breaking Changes

- Removed: `audit`, `diff`, `measure`, `extract --compact`, CSS value extraction
- Removed: monorepo structure (was core + cli + mcp packages)
- Renamed: `figma-doctor` → `figma-assets`

### Features

- **MCP server** — `--serve` flag for Claude Code / Cursor integration. Primary usage method.
- **Auto cache invalidation** — uses `lastModified` from the nodes API response (no extra API call). Design changes are detected automatically.

### Improvements

- Single package (was 3-package monorepo)
- 0 runtime dependencies besides `@modelcontextprotocol/sdk` and `zod`
- 5 source files, 750 lines total

### Docs

- README with before/after SVG comparison, mermaid flowchart
- MCP setup as primary Quick Start
- Korean README (README.ko.md)
- GitHub Actions CI + automated release
- Issue templates, PR template, FUNDING, LICENSE

## 0.1.0 (2026-03-28)

Initial release (as figma-doctor).

### Features

- SVG extraction via `/v1/images?format=svg`
- Raster detection (>50KB or base64) → PNG export
- Container grouping (≤48px → single SVG)
- Logo detection (all-vector INSTANCE → single SVG)
- Deduplication (same componentId = one API call)
- Parallel downloads (20 concurrent)
- Batched API calls (max 50/request)
- Caching in `.figma-assets/cache/`
- CLI with `--scale`, `--format`, `--threshold`, `--refresh`, `--json`
- Programmatic API: `import { extract } from "figma-assets"`
