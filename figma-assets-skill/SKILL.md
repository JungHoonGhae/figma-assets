---
name: figma-assets
description: Extract production-ready SVG and raster assets from Figma designs. Use when implementing Figma designs, when icons/images are needed from Figma, when user shares a Figma URL and needs assets, or when MCP returns expiring asset URLs that need to be replaced with actual files. Also trigger when user says "에셋 추출", "아이콘 뽑아", "Figma에서 SVG", "extract assets", "get icons from Figma", or mentions needing actual SVG/PNG files instead of MCP asset URLs.
---

# figma-assets

Extract SVG icons and raster images from Figma as actual files. Replaces MCP's expiring URLs and cropped SVG fragments with complete, self-contained assets.

## Why this exists

Figma MCP's `get_design_context` returns icons as temporary URLs (`figma.com/api/mcp/asset/...`) that expire in 7 days. If you download those URLs, you get cropped SVG path fragments — wrong viewBox, no fixed dimensions, `preserveAspectRatio="none"`, CSS variable colors. They break when used in production.

This skill uses Figma's REST API `/v1/images?format=svg` to export complete SVGs with proper viewBox and resolved colors. It also detects raster-embedded SVGs (base64 bitmaps inside SVG wrappers) and re-exports them as PNG.

## Before you start

Two things are required:

### 1. FIGMA_TOKEN

The user needs a Figma Personal Access Token set as an environment variable. Check if it exists:

```bash
echo ${FIGMA_TOKEN:+set}
```

If not set, tell the user:
> FIGMA_TOKEN이 설정되어 있지 않습니다. Figma Settings → Personal Access Tokens에서 발급 후 `export FIGMA_TOKEN=figd_...`로 설정해주세요.

If using doppler or other secret managers, check those too (e.g., `doppler secrets get FIGMA_TOKEN`).

### 2. Figma URL with node-id

The user needs to provide a Figma URL that includes `node-id`. It looks like:

```
https://www.figma.com/design/abc123/FileName?node-id=2912-13356
```

If the user provides a URL without `node-id`, tell them to select the frame in Figma and right-click → Copy link.

## How to extract

### Install (one-time)

```bash
npm install -g figma-assets
```

Or use without installing:

```bash
npx figma-assets "<figma-url>" --out-dir ./assets
```

### Run

```bash
figma-assets "<figma-url>" --out-dir ./assets
```

This will:
1. Walk the Figma node tree and find all icon/vector nodes
2. Group small containers (≤48px) as single SVGs instead of individual paths
3. Export logos and complex icons (INSTANCE with all-vector children) as single SVGs
4. Deduplicate identical components (same componentId = one API call)
5. Detect raster-embedded SVGs (>50KB or base64 content) → export as PNG @2x
6. Save everything as actual files to `./assets/`

### Options

| Flag | Default | What it does |
|------|---------|-------------|
| `-o, --out-dir` | (required) | Where to save files |
| `--scale` | `2` | PNG export scale (1-4) |
| `--format` | `png` | Raster format: png or jpg |
| `--refresh` | `false` | Bypass cache |
| `--json` | `false` | Output JSON manifest |

### JSON manifest

Add `--json` to get a machine-readable manifest of extracted assets:

```bash
npx figma-assets "<url>" -o ./assets --json
```

Returns an array of `{ id, name, fileName, type, width, height }` for each asset.

## How to use the extracted assets

After extraction, reference the files directly:

```html
<!-- SVG icons -->
<img src="./assets/arrow-narrow-left.svg" width="24" height="24" />

<!-- Raster images (PNG) -->
<img src="./assets/Plan_Icon@2x.png" width="64" height="64" />
```

**Important rules:**
- Do NOT recreate SVG icons manually. Use the extracted files.
- Do NOT use base64 data URLs for raster images. Use the actual PNG file path.
- Raster assets (marked as `[png @2x]` in output) already include visual styles (border, background, radius). Use `<img>` directly without adding container styling.

## When implementing a Figma design

The recommended workflow is:

1. **Extract assets first**: `npx figma-assets "<url>" -o ./assets`
2. **Then implement the design** using MCP or any other method — but reference `./assets/` for all icons and images
3. This way you get MCP's speed for layout/code generation + actual SVG/PNG files for assets

## Troubleshooting

- **"FIGMA_TOKEN not set"** → `export FIGMA_TOKEN=figd_...`
- **"missing node-id"** → The Figma URL needs `?node-id=123-456`. Right-click the frame in Figma → Copy link.
- **Large SVGs detected** → Normal. figma-assets auto-converts these to PNG. Check the output for `[png @2x]` entries.
- **Cached results** → Second run uses cache. Use `--refresh` if the Figma design changed.
