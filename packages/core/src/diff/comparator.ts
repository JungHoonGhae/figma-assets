import type { ToleranceConfig } from "../types.js";

export interface CompareResult {
  pass: boolean;
  delta: number | null;
}

const SIZE_PROPERTIES = new Set([
  "width", "height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "gap", "borderWidth", "borderRadius",
]);

const COLOR_PROPERTIES = new Set(["color", "backgroundColor", "borderColor"]);

export function compareValues(
  property: string, expected: string, actual: string,
  tolerance: Required<ToleranceConfig>
): CompareResult {
  if (property === "fontSize") return comparePx(expected, actual, tolerance.fontSize);
  if (property === "lineHeight") return comparePx(expected, actual, tolerance.lineHeight);
  if (SIZE_PROPERTIES.has(property)) return comparePx(expected, actual, tolerance.size);
  if (COLOR_PROPERTIES.has(property)) return compareColor(expected, actual, tolerance.color);
  return { pass: expected === actual, delta: null };
}

export function comparePx(expected: string, actual: string, tolerance: number): CompareResult {
  const exp = parsePx(expected);
  const act = parsePx(actual);
  if (exp === null || act === null) return { pass: expected === actual, delta: null };
  const delta = Math.abs(act - exp);
  return { pass: delta <= tolerance, delta: Math.round(delta * 100) / 100 };
}

export function compareColor(expected: string, actual: string, maxDeltaE: number): CompareResult {
  const expRgb = parseRgb(expected);
  const actRgb = parseRgb(actual);
  if (!expRgb || !actRgb) return { pass: expected === actual, delta: null };
  const deltaE = ciede76(expRgb, actRgb);
  return { pass: deltaE <= maxDeltaE, delta: Math.round(deltaE * 100) / 100 };
}

function parsePx(value: string): number | null {
  if (value.endsWith("%")) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

function parseRgb(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function ciede76(a: [number, number, number], b: [number, number, number]): number {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  return Math.sqrt((labA[0]-labB[0])**2 + (labA[1]-labB[1])**2 + (labA[2]-labB[2])**2);
}

function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  let r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
  r = r > 0.04045 ? ((r+0.055)/1.055)**2.4 : r/12.92;
  g = g > 0.04045 ? ((g+0.055)/1.055)**2.4 : g/12.92;
  b = b > 0.04045 ? ((b+0.055)/1.055)**2.4 : b/12.92;
  let x = (r*0.4124564 + g*0.3575761 + b*0.1804375) / 0.95047;
  let y = (r*0.2126729 + g*0.7151522 + b*0.0721750);
  let z = (r*0.0193339 + g*0.1191920 + b*0.9503041) / 1.08883;
  x = x > 0.008856 ? x**(1/3) : 7.787*x + 16/116;
  y = y > 0.008856 ? y**(1/3) : 7.787*y + 16/116;
  z = z > 0.008856 ? z**(1/3) : 7.787*z + 16/116;
  return [116*y - 16, 500*(x-y), 200*(y-z)];
}
