import type { AuditIssue, AuditResult, AuditSeverity } from "../types.js";
import type { RawFigmaNode } from "../extract/client.js";
import { AUDIT_RULES } from "./rules.js";

export interface AuditOptions {
  severity?: AuditSeverity;
}

export function auditNode(node: RawFigmaNode, options?: AuditOptions): AuditResult {
  const allIssues: AuditIssue[] = [];
  collectIssues(node, allIssues);

  const filtered = options?.severity
    ? allIssues.filter((i) => i.severity === options.severity)
    : allIssues;

  const errors = allIssues.filter((i) => i.severity === "error").length;
  const warnings = allIssues.filter((i) => i.severity === "warning").length;

  return {
    issues: filtered,
    summary: { errors, warnings },
    pass: errors === 0,
  };
}

function collectIssues(node: RawFigmaNode, issues: AuditIssue[]): void {
  const nodeRecord = node as unknown as Record<string, unknown>;

  for (const rule of AUDIT_RULES) {
    const result = rule.test(nodeRecord);
    if (result?.match) {
      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        property: rule.property,
        value: result.value,
        severity: rule.severity,
        reason: rule.reason,
        suggestion: rule.suggestion,
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectIssues(child, issues);
    }
  }
}
