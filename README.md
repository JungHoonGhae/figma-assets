# figma-assets

Extract production-ready SVG and raster assets from Figma.

[한국어](README.ko.md)

## The Problem

When you implement a Figma design with MCP, icons come back like this:

```javascript
const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-...";
```

An external URL that expires in 7 days. You can't ship this.

So you download it. Here's what you get:

```xml
<!-- Downloaded from MCP asset URL -->
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path d="M12.33 1.5L5.67 8.17L1.5 4"
        stroke="var(--stroke-0, #2D7FF9)" stroke-width="3"/>
</svg>
```

This is not an icon. It's a **path fragment**.

- `viewBox="0 0 13.83 9.67"` — cropped to the bounding box, not the 24×24 canvas
- `width="100%" height="100%"` — no intrinsic size. Stretches to whatever parent gives it
- `preserveAspectRatio="none"` — aspect ratio will break
- `stroke="var(--stroke-0, #2D7FF9)"` — depends on a CSS variable that doesn't exist outside Figma

The same icon exported via Figma REST API `/v1/images?format=svg`:

```xml
<!-- Extracted by figma-assets -->
<svg width="24" height="24" viewBox="0 0 24 24">
  <path d="M15.92 9.67L9.25 16.33L5.08 12.17"
        stroke="#2D7FF9" stroke-width="3"/>
</svg>
```

24×24 canvas. Resolved colors. A self-contained SVG that works anywhere.

---

Raster images are worse.

Some SVG exports come back at 1.1MB — a base64-encoded bitmap embedded inside the SVG. This happens when a Figma node uses image fills.

Hand this to an AI agent and it tries to paste 17,212 characters of base64 into HTML. 1-2 characters will mutate. LLMs don't "copy" — they "regenerate" token by token. One wrong character and the entire image breaks.

figma-assets detects this automatically and re-exports as PNG @2x (13KB). As an actual file.

## Install

```bash
npx figma-assets <figma-url> --out-dir ./assets
```

## Usage

```bash
export FIGMA_TOKEN=figd_...

# Extract all assets from a Figma frame
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets

# Custom raster scale
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --scale 3

# JSON manifest for scripting
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --json
```

## What It Does

1. Walks the Figma node tree to find vector/icon nodes
2. Groups small containers (≤48px) as single SVGs instead of individual paths
3. Exports INSTANCE/COMPONENT with all-vector leaves as single SVGs (logos)
4. Deduplicates identical components (same componentId = one API call)
5. Detects raster-embedded SVGs (>50KB or base64 content) → exports as PNG
6. Saves everything as actual files

## Output

```
./assets/
├── arrow-narrow-left.svg       # 24×24, self-contained
├── menu-01.svg
├── check.svg                   # 1 of 9 identical checkmarks (deduplicated)
├── check-1.svg
├── logo.svg                    # 93×32, exported as single unit
├── Plan_Icon@2x.png            # raster detected: 1.1MB SVG → 13KB PNG
└── ...
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --out-dir` | (required) | Output directory |
| `--scale` | `2` | Raster export scale (1-4) |
| `--format` | `png` | Raster format: `png` or `jpg` |
| `--threshold` | `50000` | SVG size threshold for raster detection (bytes) |
| `--cache-dir` | `.figma-assets/cache` | Cache directory |
| `--refresh` | `false` | Bypass cache |
| `--json` | `false` | Output JSON asset manifest |

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
