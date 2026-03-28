# figma-assets

Extract production-ready SVG and raster assets from Figma.

One command. Real files. No expiring URLs, no AI approximation.

## Why

Figma MCP returns icons as temporary URLs that expire in 7 days, or as cropped SVG fragments with `preserveAspectRatio="none"` and CSS variables. AI agents then "approximate" the icons by regenerating similar paths.

`figma-assets` calls Figma's REST API directly to export complete, self-contained SVG files and auto-detects raster-embedded SVGs for PNG export.

## Install

```bash
npx figma-assets <figma-url> --out-dir ./assets
```

## Usage

```bash
# Set your Figma token
export FIGMA_TOKEN=figd_...

# Extract all assets from a Figma frame
figma-assets "https://figma.com/design/abc/File?node-id=123-456" --out-dir ./assets

# Custom raster scale
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --scale 3

# JSON manifest (for scripting)
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --json
```

## What it does

1. Walks the Figma node tree and finds icon/vector nodes
2. Groups small containers (≤48px) as single SVGs instead of individual paths
3. Exports INSTANCE/COMPONENT with all-vector children as single SVGs (logos)
4. Deduplicates identical components (same componentId = one API call)
5. Detects raster-embedded SVGs (>50KB or base64 images) → exports as PNG
6. Saves everything as actual files to your project directory

## Output

```
./assets/
├── arrow-narrow-left.svg    # nav back button
├── menu-01.svg              # hamburger menu
├── check.svg                # feature checkmark
├── check-1.svg              # (deduplicated, same content)
├── logo.svg                 # complete logo SVG
├── Plan_Icon@2x.png         # auto-detected raster (was 1.1MB SVG → 13KB PNG)
└── ...
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --out-dir` | (required) | Output directory |
| `--scale` | `2` | Raster export scale (1-4) |
| `--format` | `png` | Raster format: `png` or `jpg` |
| `--threshold` | `50000` | SVG bytes threshold for raster detection |
| `--cache-dir` | `.figma-assets/cache` | Cache directory |
| `--refresh` | `false` | Bypass cache |
| `--json` | `false` | Output JSON manifest |

## Programmatic usage

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
  rasterScale: 2,
});

console.log(result.assets); // [{ id, name, fileName, type }, ...]
```

## License

MIT
