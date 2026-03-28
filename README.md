# figma-assets

AI coding agents (Cursor, Claude Code, etc.) use Figma MCP to implement designs. The code comes out fine. The icons don't.

MCP returns icons as **expiring URLs** (7 days) or **cropped SVG fragments** — missing viewBox, no fixed dimensions, CSS variable colors. AI agents then either link to dead URLs or "approximate" the icons by guessing SVG paths.

figma-assets extracts icons and images from Figma as **actual files** — complete SVGs with proper viewBox, resolved colors, and auto-detected raster fallback for bitmap-embedded nodes. It deduplicates identical components, batches API calls, parallelizes downloads, and caches results to minimize Figma API usage.

[한국어](README.ko.md)

## Prerequisites

### 1. Figma Personal Access Token

[Figma Settings → Personal Access Tokens](https://www.figma.com/settings) (Account → Security → Generate new token).

```bash
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Figma URL with node-id

Select the frame in Figma → Right-click → **Copy link**. The URL must include `node-id`:

```
https://www.figma.com/design/hlN4c1rV2dQCzyEMbowCHX/MyProject?node-id=2912-13356
```

### 3. Node.js 18+

Uses built-in `fetch`. No additional dependencies.

## Install

```bash
# Use without installing
npx figma-assets <figma-url> -o ./assets

# Or install globally
npm install -g figma-assets
```

## Quick Start

```bash
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

Done. Your assets are in `./assets/`.

### For AI agents (MCP server — zero friction)

Add to your Claude Code or Cursor MCP settings:

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

Once configured, the agent automatically gets an `extract_assets` tool. When implementing a Figma design, the agent calls it instead of using MCP's broken asset URLs. No manual commands needed.

### For AI agents (manual)

Or paste this to your agent:

```
Extract Figma assets to ./assets:
1. Run: npx figma-assets "PASTE_FIGMA_URL_HERE" -o ./assets
2. SVGs: <img src="./assets/icon-name.svg" />
3. PNGs: <img src="./assets/image-name@2x.png" />
Do NOT recreate SVG icons manually. Use the extracted files.
```

## Output

```
./assets/
├── arrow-narrow-left.svg       # 24×24, self-contained
├── menu-01.svg
├── check.svg                   # 1 of 9 identical checkmarks (deduplicated)
├── logo.svg                    # 93×32, exported as single unit
├── Plan_Icon@2x.png            # raster detected: 1.1MB SVG → 13KB PNG
└── ...
```

## Options

```bash
figma-assets <figma-url> -o <dir> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --out-dir` | (required) | Output directory |
| `--scale` | `2` | Raster export scale (1-4) |
| `--format` | `png` | Raster format: `png` or `jpg` |
| `--threshold` | `50000` | SVG size threshold for raster detection (bytes) |
| `--cache-dir` | `.figma-assets/cache` | Cache directory |
| `--refresh` | `false` | Bypass cache |
| `--json` | `false` | Output JSON asset manifest |

## Configuration

For repeated use, create `.figma-assets.json` in your project root:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2,
  "rasterFormat": "png"
}
```

Then just: `figma-assets "https://figma.com/design/..."`

**Token resolution order:** `--token` flag → `.figma-assets.json` → `FIGMA_TOKEN` env var

**Cache:** API responses are cached in `.figma-assets/cache/`. Second run is instant. Use `--refresh` when the design changes. Add `.figma-assets/` to `.gitignore`.

---

## Why This Exists

### MCP asset URLs are broken

```javascript
const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-...";
```

Download this URL. Here's what you get:

```xml
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path d="M12.33 1.5L5.67 8.17L1.5 4"
        stroke="var(--stroke-0, #2D7FF9)" stroke-width="3"/>
</svg>
```

This is not an icon. It's a **path fragment** — cropped viewBox, no intrinsic size, `preserveAspectRatio="none"`, CSS variable colors.

Same icon via figma-assets:

```xml
<svg width="24" height="24" viewBox="0 0 24 24">
  <path d="M15.92 9.67L9.25 16.33L5.08 12.17"
        stroke="#2D7FF9" stroke-width="3"/>
</svg>
```

24×24 canvas. Resolved colors. Works anywhere.

### Raster-embedded SVGs

Some SVG exports are 1.1MB — a base64 bitmap inside an SVG wrapper. AI agents try to paste 17,212 characters of base64 into HTML. LLMs don't "copy" — they regenerate token by token. One wrong character breaks the entire image.

figma-assets detects this and re-exports as PNG @2x (13KB). As an actual file.

### Why not just call the REST API directly?

You can. But for a typical Figma frame:

- A 24×24 INSTANCE with 3 VECTOR children → should be 1 SVG, not 3
- A 93×32 logo with 20 nested vectors → should be 1 SVG, not 20
- 9 identical checkmarks → should be 1 API call, not 9
- A 1.1MB SVG with embedded bitmap → should become 13KB PNG
- API calls need batching (max 50), downloads need parallelization, results need caching

figma-assets handles all of this. One command instead of a script you rewrite every project.

## How It Works

1. Walks the Figma node tree to find vector/icon nodes
2. Groups small containers (≤48px) as single SVGs instead of individual paths
3. Exports INSTANCE/COMPONENT with all-vector leaves as single SVGs (logos)
4. Deduplicates identical components (same componentId = one API call)
5. Detects raster-embedded SVGs (>50KB or base64) → exports as PNG
6. Saves everything as actual files

## Programmatic Usage

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});

// result.assets: [{ id, name, fileName, type: "svg" | "raster" }, ...]
// result.stats: { total: 20, svgs: 19, rasters: 1, deduplicated: 10 }
```

## License

MIT
