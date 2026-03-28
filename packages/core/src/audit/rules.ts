import type { AuditSeverity } from "../types.js";

export interface AuditRule {
  property: string;
  test: (node: Record<string, unknown>) => { match: boolean; value: string } | null;
  severity: AuditSeverity;
  reason: string;
  suggestion: string;
}

const UNSUPPORTED_BLEND_MODES = new Set(["LINEAR_BURN", "LINEAR_DODGE"]);

export const AUDIT_RULES: AuditRule[] = [
  {
    property: "strokeAlign",
    test: (node) => {
      if (node.strokeAlign === "OUTSIDE" && node.strokeWeight) {
        return { match: true, value: `OUTSIDE (weight: ${node.strokeWeight})` };
      }
      return null;
    },
    severity: "error",
    reason: "CSS border only supports inside rendering. Outside strokes cannot be replicated with border.",
    suggestion: "Change stroke alignment to INSIDE or CENTER, or use box-shadow/outline as CSS workaround.",
  },
  {
    property: "blendMode",
    test: (node) => {
      const mode = node.blendMode as string | undefined;
      if (mode && UNSUPPORTED_BLEND_MODES.has(mode)) {
        return { match: true, value: mode };
      }
      return null;
    },
    severity: "error",
    reason: "CSS mix-blend-mode does not support this blend mode.",
    suggestion: "Use a supported blend mode (multiply, screen, overlay, etc.) or flatten the layer.",
  },
  {
    property: "leadingTrim",
    test: (node) => {
      const style = node.style as Record<string, unknown> | undefined;
      if (style?.leadingTrim === "CAP_HEIGHT") {
        return { match: true, value: "CAP_HEIGHT" };
      }
      return null;
    },
    severity: "warning",
    reason: "Maps to CSS text-box-trim which is not supported in Firefox.",
    suggestion: "Consider removing leading trim or providing a fallback.",
  },
  {
    property: "textAutoResize",
    test: (node) => {
      if (node.textAutoResize === "TRUNCATE") {
        return { match: true, value: "TRUNCATE" };
      }
      return null;
    },
    severity: "warning",
    reason: "Requires CSS text-overflow: ellipsis + overflow: hidden approximation.",
    suggestion: "Ensure the implementation includes overflow: hidden and text-overflow: ellipsis.",
  },
  {
    property: "constraints",
    test: (node) => {
      const constraints = node.constraints as { horizontal?: string; vertical?: string } | undefined;
      if (constraints) {
        const problematic = ["SCALE", "CENTER"].filter(
          (c) => constraints.horizontal === c || constraints.vertical === c
        );
        if (problematic.length > 0) {
          return { match: true, value: problematic.join(", ") };
        }
      }
      return null;
    },
    severity: "warning",
    reason: "SCALE and CENTER constraints behave differently from CSS position: absolute fixed coordinates.",
    suggestion: "Use CSS flexbox/grid centering or responsive units instead of absolute positioning.",
  },
];
