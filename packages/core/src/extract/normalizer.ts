import type { FigmaNode, NormalizedStyles } from "../types.js";
import type { RawFigmaNode } from "./client.js";

export function normalizeNode(raw: RawFigmaNode): FigmaNode {
  const styles = extractStyles(raw);
  const node: FigmaNode = {
    id: raw.id,
    name: raw.name,
    type: raw.type as FigmaNode["type"],
    styles,
  };

  if (raw.characters !== undefined) {
    node.characters = raw.characters;
  }

  if (raw.children?.length) {
    node.children = raw.children
      .filter(child => child.visible !== false)
      .map(normalizeNode);
    if (node.children.length === 0) delete node.children;
  }

  return node;
}

function extractStyles(raw: RawFigmaNode): NormalizedStyles {
  const styles: NormalizedStyles = {};
  const bbox = raw.absoluteBoundingBox;

  // Dimensions
  if (bbox) {
    styles.width = px(bbox.width);
    styles.height = px(bbox.height);
  }

  // Padding
  if (raw.paddingTop !== undefined) styles.paddingTop = px(raw.paddingTop);
  if (raw.paddingRight !== undefined) styles.paddingRight = px(raw.paddingRight);
  if (raw.paddingBottom !== undefined) styles.paddingBottom = px(raw.paddingBottom);
  if (raw.paddingLeft !== undefined) styles.paddingLeft = px(raw.paddingLeft);

  // Gap — use rowGap/columnGap when counterAxisSpacing differs from itemSpacing
  if (raw.itemSpacing !== undefined) {
    if (raw.counterAxisSpacing !== undefined && raw.counterAxisSpacing !== raw.itemSpacing) {
      // Different spacing on each axis (e.g., wrapped flex layout)
      if (raw.layoutMode === "HORIZONTAL") {
        styles.columnGap = px(raw.itemSpacing);
        styles.rowGap = px(raw.counterAxisSpacing);
      } else {
        styles.rowGap = px(raw.itemSpacing);
        styles.columnGap = px(raw.counterAxisSpacing);
      }
    } else {
      styles.gap = px(raw.itemSpacing);
    }
  }

  // Flex wrap
  if (raw.layoutWrap === "WRAP") {
    styles.flexWrap = "wrap";
  }

  // Border radius
  if (raw.cornerRadius !== undefined) styles.borderRadius = px(raw.cornerRadius);

  // Typography (from style object)
  if (raw.style) {
    const s = raw.style as Record<string, unknown>;
    if (s.fontSize !== undefined) styles.fontSize = px(s.fontSize as number);
    if (s.fontWeight !== undefined) styles.fontWeight = String(s.fontWeight);
    if (s.fontFamily !== undefined) styles.fontFamily = s.fontFamily as string;
    if (s.letterSpacing !== undefined) styles.letterSpacing = px(s.letterSpacing as number);

    // lineHeight
    if (s.lineHeightUnit === "FONT_SIZE_%" && s.lineHeightPercentFontSize !== undefined) {
      styles.lineHeight = `${s.lineHeightPercentFontSize}%`;
    } else if (s.lineHeightPx !== undefined) {
      styles.lineHeight = px(s.lineHeightPx as number);
    }

    // textAlign
    if (s.textAlignHorizontal !== undefined) {
      const alignMap: Record<string, string> = {
        LEFT: "left",
        CENTER: "center",
        RIGHT: "right",
        JUSTIFIED: "justify",
      };
      const mapped = alignMap[s.textAlignHorizontal as string];
      if (mapped) styles.textAlign = mapped;
    }
  }

  // Layout (Auto Layout → Flexbox)
  if (raw.layoutMode && raw.layoutMode !== "NONE") {
    styles.display = "flex";
    styles.flexDirection = raw.layoutMode === "HORIZONTAL" ? "row" : "column";

    if (raw.primaryAxisAlignItems) {
      const justifyMap: Record<string, string> = {
        MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between",
      };
      styles.justifyContent = justifyMap[raw.primaryAxisAlignItems] ?? "flex-start";
    }

    if (raw.counterAxisAlignItems) {
      const alignMap: Record<string, string> = {
        MIN: "flex-start", CENTER: "center", MAX: "flex-end", BASELINE: "baseline",
      };
      styles.alignItems = alignMap[raw.counterAxisAlignItems] ?? "flex-start";
    }
  }

  // Overflow
  if (raw.clipsContent) {
    styles.overflow = "hidden";
  }

  // Position
  if (raw.layoutPositioning === "ABSOLUTE") {
    styles.position = "absolute";
  }

  // Layout sizing mode (FILL → stretch/grow, HUG → shrink)
  if (raw.layoutSizingHorizontal === "FILL") {
    styles.alignSelf = "stretch";
    styles.flexGrow = "1";
  }
  if (raw.layoutSizingVertical === "FILL") {
    styles.flexGrow = "1";
  }

  // Sizing constraints
  if (raw.minWidth !== undefined) styles.minWidth = px(raw.minWidth);
  if (raw.maxWidth !== undefined) styles.maxWidth = px(raw.maxWidth);
  if (raw.minHeight !== undefined) styles.minHeight = px(raw.minHeight);
  if (raw.maxHeight !== undefined) styles.maxHeight = px(raw.maxHeight);

  // Colors (from fills)
  if (raw.fills?.length) {
    const fill = raw.fills[0] as { type: string; color?: FigmaColor; gradientHandlePositions?: unknown[]; gradientStops?: GradientStop[] };
    if (fill.type === "SOLID" && fill.color) {
      const colorStr = rgbString(fill.color);
      if (raw.type === "TEXT") {
        styles.color = colorStr;
      } else {
        styles.backgroundColor = colorStr;
      }
    } else if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops) {
      styles.background = linearGradientString(fill.gradientStops);
    }
  }

  // Border (from strokes)
  if (raw.strokes?.length && raw.strokeWeight) {
    const stroke = raw.strokes[0] as { type: string; color?: FigmaColor };
    styles.borderWidth = px(raw.strokeWeight);
    styles.borderStyle = "solid";
    if (stroke.type === "SOLID" && stroke.color) {
      styles.borderColor = rgbString(stroke.color);
    }
  }

  // Opacity
  if (raw.opacity !== undefined && raw.opacity !== 1) {
    styles.opacity = String(raw.opacity);
  }

  // Box shadow (from effects)
  if (raw.effects?.length) {
    const shadows = (raw.effects as FigmaEffect[])
      .filter(e => (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") && e.visible !== false)
      .map(e => {
        const x = px(e.offset?.x ?? 0);
        const y = px(e.offset?.y ?? 0);
        const blur = px(e.radius ?? 0);
        const spread = px(e.spread ?? 0);
        const color = e.color ? rgbString(e.color) : "rgba(0, 0, 0, 0.25)";
        const inset = e.type === "INNER_SHADOW" ? "inset " : "";
        return `${inset}${x} ${y} ${blur} ${spread} ${color}`;
      });
    if (shadows.length > 0) {
      styles.boxShadow = shadows.join(", ");
    }
  }

  // Text decoration
  if (raw.style) {
    const s = raw.style as Record<string, unknown>;
    if (s.textDecoration === "UNDERLINE") styles.textDecoration = "underline";
    else if (s.textDecoration === "STRIKETHROUGH") styles.textDecoration = "line-through";
  }

  return styles;
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface GradientStop {
  position: number;
  color: FigmaColor;
}

interface FigmaEffect {
  type: string;
  visible?: boolean;
  radius?: number;
  spread?: number;
  offset?: { x: number; y: number };
  color?: FigmaColor;
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

function linearGradientString(stops: GradientStop[]): string {
  const colorStops = stops
    .map(s => `${rgbString(s.color)} ${Math.round(s.position * 100)}%`)
    .join(", ");
  return `linear-gradient(180deg, ${colorStops})`;
}

function rgbString(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a !== undefined && color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}
