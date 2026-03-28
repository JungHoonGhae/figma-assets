import type { DiffResult, AuditResult } from "@figma-doctor/core";

interface DiffMeta {
  page: string;
  nodeId: string;
  url: string;
}

export function formatDiffTable(result: DiffResult, meta: DiffMeta): string {
  const lines: string[] = [];
  lines.push(`figma-doctor · Figma vs Browser diff for ${meta.page}`);
  lines.push(`Figma node: ${meta.nodeId} → ${meta.url}`);
  lines.push("");

  const cols = ["Element", "Property", "Figma", "Browser", "Delta", "Status"];
  const widths = [20, 15, 12, 12, 10, 8];
  lines.push(cols.map((c, i) => c.padEnd(widths[i])).join(""));
  lines.push("-".repeat(widths.reduce((a, b) => a + b, 0)));

  for (const r of result.results) {
    const element = r.nodeName.length > 18 ? r.nodeName.slice(0, 18) + "…" : r.nodeName;
    const deltaStr = r.delta !== null ? (r.delta === 0 ? "0" : `${r.delta > 0 ? "+" : ""}${r.delta}px`) : "-";
    const status = r.pass ? "✓ pass" : "✗ FAIL";
    lines.push([
      element.padEnd(widths[0]), r.property.padEnd(widths[1]),
      r.expected.padEnd(widths[2]), r.actual.padEnd(widths[3]),
      deltaStr.padEnd(widths[4]), status,
    ].join(""));
  }

  lines.push("");
  if (result.pass) {
    lines.push(`PASS — all ${result.summary.total} checks passed`);
  } else {
    lines.push(`FAIL — ${result.summary.fail} of ${result.summary.total} checks have mismatches`);
  }
  return lines.join("\n");
}

export function formatAuditTable(result: AuditResult, nodeId: string): string {
  const lines: string[] = [];
  lines.push(`figma-doctor · Audit for node ${nodeId}`);
  lines.push(`Found ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
  lines.push("");

  if (result.issues.length === 0) {
    lines.push("No issues found.");
    return lines.join("\n");
  }

  const cols = ["Node", "Property", "Value", "Severity", "Reason"];
  const widths = [15, 15, 25, 10, 40];
  lines.push(cols.map((c, i) => c.padEnd(widths[i])).join(""));
  lines.push("-".repeat(widths.reduce((a, b) => a + b, 0)));

  for (const issue of result.issues) {
    lines.push([
      issue.nodeName.slice(0, 13).padEnd(widths[0]),
      issue.property.padEnd(widths[1]),
      issue.value.slice(0, 23).padEnd(widths[2]),
      issue.severity.padEnd(widths[3]),
      issue.reason.slice(0, 38),
    ].join(""));
  }

  lines.push("");
  lines.push(result.pass ? "PASS — no errors (warnings only)" : `FAIL — ${result.summary.errors} error(s) found`);
  return lines.join("\n");
}
