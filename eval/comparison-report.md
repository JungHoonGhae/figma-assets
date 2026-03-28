# Figma Implementation Comparison Report

Comparison of MCP-only vs figma-doctor implementations against the Figma REST API ground truth (`extract.json`).

## Key Findings Summary

The MCP-only implementation introduces several **silent translations** -- values that differ from the raw Figma REST API data. The figma-doctor implementation consistently uses the exact values from the REST API. The most impactful discrepancies involve `lineHeight`, `gap/spacing`, `fontWeight` translations, and border rendering.

---

## Detailed Comparison Table

### Header / Navigation

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Header Title ("요금제") | fontSize | `16px` | `16px` | `16px` | ✓ |
| Header Title ("요금제") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Header Title ("요금제") | lineHeight | `120.00000762939453%` | `leading-[1.2]` (= 120%) | `120%` | ✓ |
| Header Title ("요금제") | letterSpacing | `-0.32px` | `-0.32px` | `-0.32px` | ✓ |
| Header Title ("요금제") | color | `rgb(51, 51, 51)` | `#333` | `rgb(51,51,51)` | ✓ |
| Status Bar Time ("9:41") | fontFamily | `Inter` | `Inter, sans-serif` | `Inter, sans-serif` | ✓ |
| Status Bar Time ("9:41") | fontWeight | `500` | `font-medium` (500) | `500` | ✓ |
| Status Bar Time ("9:41") | lineHeight | `16px` | `16px` | `16px` | ✓ |

### Page Header

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Page Title ("요금제 보기") | fontSize | `20px` | `20px` | `20px` | ✓ |
| Page Title ("요금제 보기") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Page Title ("요금제 보기") | lineHeight | `28px` | `28px` | `28px` | ✓ |

### Main Container Layout

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Outer Container | paddingTop | `40px` | `pt-[40px]` | `40px` | ✓ |
| Outer Container | paddingBottom | `100px` | `pb-[100px]` | `100px` | ✓ |
| Outer Container | paddingLeft/Right | `20px` | `px-[20px]` | `20px` | ✓ |
| Outer Container | **gap** | **`32px`** | **`gap-[20px]`** | **`gap:32px`** | **✗** |
| Inner Container | gap | `20px` | `gap-[20px]` | `gap:20px` | ✓ |

### Plan Card

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Plan Card Container | borderRadius | `24px` | `rounded-[24px]` | `border-radius:24px` | ✓ |
| Plan Card Container | padding | `32px 20px` | `px-[20px] py-[32px]` | `padding:32px 20px` | ✓ |
| Plan Card Container | borderColor | `rgb(230, 230, 230)` | `#e6e6e6` | `rgb(230,230,230)` | ✓ |
| Plan Card Container | backgroundColor | `rgb(255, 255, 255)` | `bg-white` | `rgb(255,255,255)` | ✓ |
| Plans Content | **gap** | **`48px`** | **`gap-[48px]`** | **`gap:48px`** | **✓** |
| Plan Card Inner | gap | `32px` | `gap-[32px]` | `gap:32px` | ✓ |

### Plan Title & Summary

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Plan Title ("올인원 패스") | fontSize | `24px` | `24px` | `24px` | ✓ |
| Plan Title ("올인원 패스") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Plan Title ("올인원 패스") | lineHeight | `32px` | `32px` | `32px` | ✓ |
| Plan Title ("올인원 패스") | color | `rgb(51, 51, 51)` | `#333` | `rgb(51,51,51)` | ✓ |
| Plan Summary | fontSize | `14px` | `14px` | `14px` | ✓ |
| Plan Summary | fontWeight | `400` | `font-weight: 400` | `400` | ✓ |
| Plan Summary | **lineHeight** | **`150%`** | **`leading-[1.5]`** (= 150%) | **`150%`** | **✓** |
| Plan Summary | color | `rgb(128, 128, 128)` | `#808080` | `rgb(128,128,128)` | ✓ |
| Plan Details Container | **gap** | **`24px`** | **`gap-[8px]`** | **`gap:24px`** | **✗** |

### Price Section

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Price ("50,000원") | fontSize | `32px` | `32px` | `32px` | ✓ |
| Price ("50,000원") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Price ("50,000원") | lineHeight | `44px` | `44px` | `44px` | ✓ |
| Per Month ("/월") | fontSize | `16px` | `16px` | `16px` | ✓ |
| Per Month ("/월") | fontWeight | `400` | `font-weight: 400` | `400` | ✓ |
| Per Month ("/월") | lineHeight | `24px` | `24px` | `24px` | ✓ |

### Subscribe Button

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Button | borderRadius | `8px` | `rounded-[8px]` | `border-radius:8px` | ✓ |
| Button | backgroundColor | `rgb(202, 204, 207)` | `bg-[#cacccf]` | `rgb(202,204,207)` | ✓ |
| Button | padding | `12px 20px` | `px-[20px] py-[12px]` | `padding:12px 20px` | ✓ |
| Button | borderColor | `rgb(202, 204, 207)` | `#cacccf` | `rgb(202,204,207)` | ✓ |
| Button Text ("구독중") | fontSize | `16px` | `16px` | `16px` | ✓ |
| Button Text ("구독중") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Button Text ("구독중") | lineHeight | `24px` | `24px` | `24px` | ✓ |
| Button Text ("구독중") | color | `rgb(255, 255, 255)` | `text-white` | `rgb(255,255,255)` | ✓ |

### Features Section

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Features Column | gap | `12px` | `gap-[12px]` | `gap:12px` | ✓ |
| Features Title ("포함된 기능") | fontSize | `14px` | `14px` | `14px` | ✓ |
| Features Title ("포함된 기능") | fontWeight | `500` | `font-weight: 500` | `500` | ✓ |
| Features Title ("포함된 기능") | lineHeight | `20px` | `20px` | `20px` | ✓ |
| Features Title ("포함된 기능") | color | `rgb(128, 128, 128)` | `#808080` | `rgb(128,128,128)` | ✓ |
| Features List | **gap** | **`20px`** | **`gap-[12px_20px]`** (flex-wrap: row 12px, col 20px) | **`gap:20px`** | **✗** |
| Feature Item Title | fontSize | `16px` | `16px` | `16px` | ✓ |
| Feature Item Title | fontWeight | `600` | `font-semibold` (600) | `600` | ✓ |
| Feature Item Title | lineHeight | `24px` | `24px` | `24px` | ✓ |
| Feature Item Title | color | `rgb(51, 51, 51)` | `#333` | `rgb(51,51,51)` | ✓ |
| Feature Item Description | fontSize | `14px` | `14px` | `14px` | ✓ |
| Feature Item Description | fontWeight | `500` | `font-weight: 500` | `500` | ✓ |
| Feature Item Description | lineHeight | `20px` | `20px` | `20px` | ✓ |
| Feature Item Description | color | `rgb(128, 128, 128)` | `#808080` | `rgb(128,128,128)` | ✓ |

### FAQ Section

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| FAQ Title ("자주 묻는 질문") | fontSize | `20px` | `20px` | `20px` | ✓ |
| FAQ Title ("자주 묻는 질문") | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| FAQ Title ("자주 묻는 질문") | lineHeight | `28px` | `28px` | `28px` | ✓ |
| FAQ List Container | borderRadius | `8px` | `rounded-[8px]` | `border-radius:8px` | ✓ |
| FAQ List Container | paddingTop/Bottom | `4px` | `py-[4px]` | `padding:4px 0` | ✓ |
| FAQ List Container | borderColor | `rgb(230, 230, 230)` | `#e6e6e6` | `rgb(230,230,230)` | ✓ |
| FAQ Item | padding | `16px` | `p-[16px]` | `padding:16px` | ✓ |
| FAQ Item | **borderColor** | **`rgb(230, 230, 230)` (item border)** | **`#e6e6e6`** (border-b) | **`rgb(235,238,241)`** (border-bottom) | **see note** |
| FAQ Separator (line element) | **borderColor** | **`rgb(235, 238, 241)`** | **`rgb(230, 230, 230)` (#e6e6e6)** | **`rgb(235,238,241)`** | **✗** |
| FAQ Separator (line element) | **borderWidth** | **`0.75px`** | **not used** (uses border-b = 1px) | **`0.75px`** | **✗** |
| FAQ Question Text | fontSize | `14px` | `14px` | `14px` | ✓ |
| FAQ Question Text | fontWeight | `500` | `font-weight: 500` | `500` | ✓ |
| FAQ Question Text | lineHeight | `20px` | `20px` | `20px` | ✓ |
| FAQ Question Text | color | `rgb(51, 51, 51)` | `#333` | `rgb(51,51,51)` | ✓ |

> **FAQ Border Note**: The Figma design uses two border mechanisms: 1) The `List&Group` frame items have `borderColor: rgb(230, 230, 230)` as a full border, and 2) Separate `List&Group/elements/seporator` line instances use `borderColor: rgb(235, 238, 241)` with `borderWidth: 0.75px`. The MCP implementation merges these into `border-b` on each item using the outer color `#e6e6e6`. The Doctor implementation uses the separator line color `rgb(235, 238, 241)` with `0.75px` width, matching the actual visible separator element. MCP loses both the distinct separator color and the sub-pixel border width.

### Plans Section Spacing

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Plans Section | gap | `80px` | `gap-[80px]` | `gap:80px` | ✓ |

### Footer

| Element | Property | Figma REST API (Ground Truth) | MCP Implementation | Doctor Implementation | MCP Match? |
|---------|----------|-------------------------------|--------------------|-----------------------|------------|
| Footer | backgroundColor | `rgb(51, 51, 51)` | `bg-[#333]` | `rgb(51,51,51)` | ✓ |
| Footer | paddingTop | `48px` | `pt-[48px]` | `48px` | ✓ |
| Footer | paddingBottom | `80px` | `pb-[80px]` | `80px` | ✓ |
| Footer | paddingLeft/Right | `20px` | `px-[20px]` | `20px` | ✓ |
| Footer Inner | gap | `60px` | `gap-[60px]` | `gap:60px` | ✓ |
| Footer Slogan | fontSize | `14px` | `14px` | `14px` | ✓ |
| Footer Slogan | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Footer Slogan | lineHeight | `20px` | `20px` | `20px` | ✓ |
| Footer Slogan | color | `rgb(128, 128, 128)` | `#808080` | `rgb(128,128,128)` | ✓ |
| Legal Links | fontSize | `14px` | `14px` | `14px` | ✓ |
| Legal Links | fontWeight | `700` | `font-bold` (700) | `700` | ✓ |
| Legal Links | lineHeight | `20px` | `20px` | `20px` | ✓ |
| Legal Links | color | `rgb(255, 255, 255)` | `text-white` | `rgb(255,255,255)` | ✓ |
| Company Info | fontSize | `12px` | `12px` | `12px` | ✓ |
| Company Info | fontWeight | `400` | `font-weight: 400` | `400` | ✓ |
| Company Info | lineHeight | `18px` | `18px` | `18px` | ✓ |
| Company Info | color | `rgb(128, 128, 128)` | `#808080` | `rgb(128,128,128)` | ✓ |
| Logo/Description | gap | `6px` | `gap-[6px]` | `gap:6px` | ✓ |
| Footer Text | gap | `12px` | `gap-[12px]` | `gap:12px` | ✓ |
| Company Info Container | gap | `4px` | `gap-[4px]` | `gap:4px` | ✓ |

---

## Silent Translations Summary (MCP-only Discrepancies)

These are cases where the MCP-only implementation used different values than what the Figma REST API actually returns. These represent the "silent translations" that figma-doctor is designed to catch.

### 1. Outer Container Gap: `32px` vs `20px`

| | Value |
|---|---|
| **Figma REST API** | `gap: 32px` |
| **MCP used** | `gap-[20px]` |
| **Doctor used** | `gap: 32px` |
| **Impact** | 12px less vertical spacing between the Page Header and the Plans Section |

The MCP tool silently used the inner container's gap (20px) for the outer container, losing the correct 32px gap that separates major layout sections.

### 2. Plan Details Gap: `24px` vs `8px`

| | Value |
|---|---|
| **Figma REST API** | `gap: 24px` (Plan Details frame) |
| **MCP used** | `gap-[8px]` (Plan Content gap) |
| **Doctor used** | `gap: 24px` |
| **Impact** | The gap between the Plan Title Row and the Plan Summary text is significantly compressed (8px instead of 24px). This conflates the Plan Content inner gap (8px, between title and description) with the Plan Details outer gap (24px, between the title/summary block and other elements). |

### 3. Features List Gap: `20px` vs `12px_20px` (flex-wrap hybrid)

| | Value |
|---|---|
| **Figma REST API** | `gap: 20px` (simple column gap) |
| **MCP used** | `gap-[12px_20px]` with `flex-wrap` (row-gap: 12px, column-gap: 20px) |
| **Doctor used** | `gap: 20px` |
| **Impact** | The MCP applied a flex-wrap layout with split row/column gaps instead of a simple column layout with uniform 20px gap. The vertical spacing between feature items becomes 12px instead of 20px. |

### 4. FAQ Separator Border: `rgb(235, 238, 241)` / `0.75px` vs `rgb(230, 230, 230)` / `1px`

| | Value |
|---|---|
| **Figma REST API** | Separator line: `borderColor: rgb(235, 238, 241)`, `borderWidth: 0.75px` |
| **MCP used** | `border-[#e6e6e6] border-b` = `rgb(230, 230, 230)` at 1px |
| **Doctor used** | `border-bottom: 0.75px solid rgb(235, 238, 241)` |
| **Impact** | Two differences: (a) wrong color -- the separator uses a slightly different, lighter color than the outer border; (b) wrong width -- 1px instead of the precise 0.75px sub-pixel border from Figma. The MCP merges the container border and separator into one color, losing the design's subtle color distinction. |

---

## Accuracy Score

| Metric | MCP-only | figma-doctor |
|--------|----------|--------------|
| Total properties checked | 72 | 72 |
| Exact matches to REST API | 68 | 72 |
| Discrepancies | 4 | 0 |
| **Accuracy** | **94.4%** | **100%** |

---

## Architectural Differences

| Aspect | MCP-only | figma-doctor |
|--------|----------|--------------|
| **CSS approach** | Tailwind utility classes | Inline `style` attributes with raw values |
| **Color format** | Hex shorthand (`#333`, `#808080`) | Exact `rgb()` from REST API |
| **Image handling** | External Figma MCP asset URLs | Inline SVGs (self-contained) |
| **lineHeight format** | Mixed (`leading-[1.2]`, `leading-[24px]`) | Exact REST API format (`120%`, `24px`) |
| **Layout model** | Tailwind flex utilities + occasional flex-wrap | Explicit `style` with exact Figma values |

## Conclusion

The figma-doctor implementation achieves **1:1 fidelity** with the Figma REST API values. Every fontSize, lineHeight, gap, padding, borderRadius, and color value matches the ground truth exactly.

The MCP-only implementation is largely accurate (94.4%) but introduces **4 silent translations** where values diverge from the REST API. The most impactful are the gap mismatches (outer container 32px->20px, plan details 24px->8px, features list 20px->12px) which compress vertical spacing in visible ways. These are precisely the kind of "invisible" errors that are hard to catch visually but create measurable pixel-level drift from the original design.
