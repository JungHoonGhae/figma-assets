export const VERSION = "0.1.0";

export { loadConfig } from "./config/loader.js";
export { DEFAULT_TOLERANCE, DEFAULT_CACHE_DIR } from "./config/schema.js";

export type {
  FigmaDoctorConfig,
  PageConfig,
  DiffConfig,
  ToleranceConfig,
  CacheConfig,
  FigmaNode,
  NormalizedStyles,
  AuditSeverity,
  AuditIssue,
  AuditResult,
  DOMElement,
  DiffEntry,
  DiffResult,
} from "./types.js";

export { extract, parseFigmaUrl, NodeCache } from "./extract/index.js";
export { fetchFigmaNode } from "./extract/client.js";
export type { ExtractOptions, ExtractResult } from "./extract/index.js";

export { auditNode } from "./audit/index.js";
export { AUDIT_RULES } from "./audit/rules.js";
export type { AuditOptions } from "./audit/index.js";

export { measure, closeBrowser } from "./measure/index.js";
export type { MeasureOptions, MeasureResult } from "./measure/index.js";

export { diff } from "./diff/index.js";
export type { DiffOptions } from "./diff/index.js";
