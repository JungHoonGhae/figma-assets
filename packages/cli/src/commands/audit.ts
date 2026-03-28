import { parseFigmaUrl, loadConfig, auditNode, fetchFigmaNode } from "@figma-doctor/core";
import type { AuditSeverity } from "@figma-doctor/core";
import { formatAuditTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";

interface AuditCommandOptions {
  format?: "table" | "json";
  severity?: AuditSeverity;
}

export async function auditCommand(figmaUrl: string, options: AuditCommandOptions): Promise<void> {
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  let token: string;
  try {
    const config = loadConfig(process.cwd());
    token = config.figma.token;
  } catch {
    token = process.env.FIGMA_TOKEN ?? "";
    if (!token) { console.error("Error: FIGMA_TOKEN not set."); process.exit(1); }
  }

  const raw = await fetchFigmaNode(fileKey, nodeId, token);
  const result = auditNode(raw, { severity: options.severity });

  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    console.log(formatAuditTable(result, nodeId));
  }
  process.exit(result.pass ? 0 : 1);
}
