// --- Config ---

export interface FigmaDoctorConfig {
  figma: {
    fileKey: string;
    token: string;
  };
  pages: Record<string, PageConfig>;
  diff?: DiffConfig;
  cache?: CacheConfig;
  raster?: RasterConfig;
}

export interface RasterConfig {
  scale?: number;        // export scale: 1, 2, 3, 4 (default 2)
  format?: "png" | "jpg"; // default "png"
  threshold?: number;     // SVG size threshold in bytes to trigger raster (default 50000)
}

export interface PageConfig {
  figmaNodeId: string;
  url: string;
}

export interface DiffConfig {
  tolerance?: ToleranceConfig;
}

export interface ToleranceConfig {
  size?: number;       // ±px, default 1
  color?: number;      // ΔE, default 1.0
  fontSize?: number;   // ±px, default 0
  lineHeight?: number; // ±px, default 0.5
}

export interface CacheConfig {
  dir?: string; // default ".figma-doctor/cache"
}

// --- Extract ---

export interface FigmaNode {
  id: string;
  name: string;
  type: "TEXT" | "FRAME" | "INSTANCE" | "COMPONENT" | "GROUP" | "RECTANGLE" | "VECTOR" | "ELLIPSE" | "BOOLEAN_OPERATION" | "LINE";
  characters?: string;
  svg?: string;         // SVG markup for vector icons
  raster?: RasterImage; // PNG/JPG for raster-embedded nodes
  styles: NormalizedStyles;
  children?: FigmaNode[];
}

export interface RasterImage {
  format: "png" | "jpg";
  scale: number;
  filePath: string; // cached file path (.figma-doctor/cache/rasters/...)
  dataUrl?: string; // data:image/png;base64,... (lazy, only when --inline requested)
}

export type SVGMap = Record<string, string>; // nodeId → SVG string

export interface NormalizedStyles {
  width?: string;
  height?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  gap?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
  backgroundColor?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderStyle?: string;
  opacity?: string;
  textAlign?: string;
}

// --- Audit ---

export type AuditSeverity = "error" | "warning";

export interface AuditIssue {
  nodeId: string;
  nodeName: string;
  property: string;
  value: string;
  severity: AuditSeverity;
  reason: string;
  suggestion: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  summary: { errors: number; warnings: number };
  pass: boolean;
}

// --- Measure ---

export interface DOMElement {
  selector: string;
  textContent?: string;
  computedStyles: NormalizedStyles;
  matchedFigmaNodeId?: string;
}

// --- Diff ---

export interface DiffEntry {
  nodeId: string;
  nodeName: string;
  selector: string;
  property: string;
  expected: string;
  actual: string;
  delta: number | null; // null for non-numeric (color, fontFamily)
  pass: boolean;
}

export interface DiffResult {
  results: DiffEntry[];
  summary: { total: number; pass: number; fail: number };
  pass: boolean;
}
