# figma-doctor

Diagnose the gap between Figma's rendering engine and browser CSS engine.

Figma runs inside a browser, but its design canvas uses a custom C++/WebAssembly rendering engine — not the browser's CSS engine. This means values from Figma don't always match what CSS produces. `figma-doctor` catches these discrepancies.

## Install

```bash
npx figma-doctor init
```

## Commands

```bash
# Audit — check for CSS-incompatible Figma properties before implementation
npx figma-doctor audit <figma-url>

# Diff — compare Figma values with actual browser-rendered values
npx figma-doctor diff <page-name>

# Extract — get raw Figma values normalized to CSS units
npx figma-doctor extract <figma-url>

# Cache — manage cached Figma API responses
npx figma-doctor cache clear
```

## How It Works

1. **audit** — Reads Figma nodes via REST API, checks each property against a lookup table of CSS-incompatible values (OUTSIDE strokes, LINEAR_BURN blend, etc.)
2. **extract** — Fetches raw values from Figma REST API and normalizes them to CSS units (px, rgb, %)
3. **measure** — Opens your page in a headless browser, finds matching DOM elements, reads `getComputedStyle` values
4. **diff** — Compares Figma values with browser values, reports mismatches with configurable tolerance

## Config

`.figma-doctor.json`:

```json
{
  "figma": {
    "fileKey": "your-file-key",
    "token": "$FIGMA_TOKEN"
  },
  "pages": {
    "login": {
      "figmaNodeId": "2784:11151",
      "url": "http://localhost:3000/login"
    }
  }
}
```

## License

MIT
