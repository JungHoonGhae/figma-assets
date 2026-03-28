<div align="center">
  <h1>figma-assets</h1>
  <p>Extract production-ready SVG and raster assets from Figma.</p>
</div>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#use-with-ai-agents"><strong>AI Agents</strong></a> ·
  <a href="#options"><strong>Options</strong></a> ·
  <a href="#why"><strong>Why</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/figma-assets"><img src="https://img.shields.io/npm/v/figma-assets.svg" alt="npm" /></a>
  <a href="https://github.com/JungHoonGhae/figma-assets/stargazers"><img src="https://img.shields.io/github/stars/JungHoonGhae/figma-assets" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933.svg?logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="README.ko.md">한국어</a>
</p>

---

Figma's official MCP gives you expiring URLs and cropped SVG fragments.
This gives you actual files.

```bash
export FIGMA_TOKEN=figd_...
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

```
./assets/
├── back-arrow.svg            24×24, self-contained SVG
├── check.svg                 deduplicated (9 identical → 1 API call)
├── company-logo.svg          complex logo exported as single unit
├── hero-image@2x.png         raster auto-detected (1.1MB SVG → 13KB PNG)
└── ...
```

## Setup

**1.** Get a [Figma Personal Access Token](https://www.figma.com/settings) and set `FIGMA_TOKEN`:

```bash
export FIGMA_TOKEN=figd_xxxxxxxx
```

**2.** Copy a Figma URL — select a frame → right-click → **Copy link**. Needs `node-id` in the URL.

**3.** Node.js 18+.

## Quick Start

```bash
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

## Use with AI agents

### As an MCP server (recommended)

Add to your Claude Code or Cursor MCP settings — the agent gets an `extract_assets` tool automatically:

```json
{
  "mcpServers": {
    "figma-assets": {
      "command": "npx",
      "args": ["figma-assets", "--serve"],
      "env": { "FIGMA_TOKEN": "figd_..." }
    }
  }
}
```

### Manual prompt

Paste to your agent:

```
1. Run: npx figma-assets "FIGMA_URL" -o ./assets
2. Use: <img src="./assets/icon-name.svg" />
3. Do NOT recreate SVGs manually.
```

## Options

| Flag | Default | |
|------|---------|---|
| `-o, --out-dir` | required | Output directory |
| `--scale` | `2` | Raster scale (1-4) |
| `--format` | `png` | Raster format: png / jpg |
| `--threshold` | `50000` | Raster detection threshold (bytes) |
| `--refresh` | `false` | Bypass cache |
| `--json` | `false` | JSON manifest output |
| `--serve` | | Start as MCP server |

## Config file

Optional `.figma-assets.json`:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2
}
```

Cache goes to `.figma-assets/cache/`. Second run is instant. `--refresh` when the design changes.

---

## Why

Figma's official MCP asset URLs return this:

```xml
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path stroke="var(--stroke-0, #2D7FF9)" .../>
</svg>
```

Cropped viewBox. No size. `preserveAspectRatio="none"`. CSS variable color.

figma-assets returns this:

```xml
<svg width="24" height="24" viewBox="0 0 24 24">
  <path stroke="#2D7FF9" .../>
</svg>
```

Complete. Fixed size. Resolved color. Works anywhere.

SVGs with embedded bitmaps (1.1MB) auto-export as PNG @2x (13KB). LLMs corrupt base64 when copying — this avoids that entirely.

### Why not call the REST API yourself?

You can. But a real frame needs: container grouping (3 vectors → 1 SVG), logo detection (20 nested vectors → 1 SVG), deduplication (9 checkmarks → 1 API call), raster detection, batching (max 50/request), parallel downloads, caching.

## API

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});
```

## Contributing

Issues and PRs welcome. See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Made by <a href="https://github.com/JungHoonGhae">@JungHoonGhae</a></sub><br/>
  <sub><a href="https://x.com/lucas_ghae">@lucas_ghae</a> on X</sub>
</p>
