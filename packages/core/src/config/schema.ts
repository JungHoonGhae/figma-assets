import type { ToleranceConfig } from "../types.js";

export const DEFAULT_TOLERANCE: Required<ToleranceConfig> = {
  size: 1,
  color: 1.0,
  fontSize: 0,
  lineHeight: 0.5,
};

export const DEFAULT_CACHE_DIR = ".figma-doctor/cache";
