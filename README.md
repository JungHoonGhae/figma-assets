# figma-assets

Figma MCP gives you expiring URLs and cropped SVG fragments.
This gives you actual files.

```bash
export FIGMA_TOKEN=figd_...    # from figma.com/settings
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

```
./assets/
├── arrow-narrow-left.svg     24×24, self-contained
├── check.svg                 deduplicated (9 identical → 1 fetch)
├── logo.svg                  93×32, single unit
├── Plan_Icon@2x.png          raster auto-detected (1.1MB SVG → 13KB PNG)
└── ...
```

[한국어](README.ko.md)

## Setup

**1.** Get a [Figma Personal Access Token](https://www.figma.com/settings) and set `FIGMA_TOKEN`:

```bash
export FIGMA_TOKEN=figd_xxxxxxxx
```

**2.** Copy a Figma URL — select a frame → right-click → **Copy link**. Needs `node-id` in the URL.

**3.** Node.js 18+.

## Use with AI agents

### MCP server (recommended)

Add to Claude Code or Cursor settings — the agent gets an `extract_assets` tool automatically:

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

Optional `.figma-assets.json` for repeated use:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2
}
```

Then just: `figma-assets "https://figma.com/design/..."`

Cache goes to `.figma-assets/cache/` — second run is instant. `--refresh` when the design changes.

---

## Why

MCP asset URLs return this:

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

You can. But a real frame needs: container grouping (3 vectors → 1 SVG), logo detection (20 nested vectors → 1 SVG), deduplication (9 checkmarks → 1 API call), raster detection, batching (max 50/request), parallel downloads, caching. That's what this does.

## API

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});
// result.assets: [{ id, name, fileName, type }, ...]
// result.stats: { total: 20, svgs: 19, rasters: 1, deduplicated: 10 }
```

## License

MIT
