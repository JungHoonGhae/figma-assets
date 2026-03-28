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
    node.children = raw.children.map(normalizeNode);
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

  // Gap
  if (raw.itemSpacing !== undefined) styles.gap = px(raw.itemSpacing);

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

  // Colors (from fills)
  if (raw.fills?.length) {
    const fill = raw.fills[0] as { type: string; color?: FigmaColor };
    if (fill.type === "SOLID" && fill.color) {
      const colorStr = rgbString(fill.color);
      if (raw.type === "TEXT") {
        styles.color = colorStr;
      } else {
        styles.backgroundColor = colorStr;
      }
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

  return styles;
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
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
