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
