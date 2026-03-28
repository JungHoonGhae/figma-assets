/**
 * Figma REST API client — URL parsing, node fetching, image export.
 */

export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string;
}

export function parseFigmaUrl(url: string): FigmaUrlParts {
  const parsed = new URL(url);
  if (!parsed.hostname.includes("figma.com")) {
    throw new Error("Invalid Figma URL");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const typeIndex = segments.findIndex((s) => s === "design" || s === "file");
  if (typeIndex === -1 || segments.length < typeIndex + 2) {
    throw new Error("Invalid Figma URL: cannot extract fileKey");
  }

  const branchIndex = segments.indexOf("branch");
  const fileKey = branchIndex !== -1 && segments.length > branchIndex + 1
    ? segments[branchIndex + 1]
    : segments[typeIndex + 1];

  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new Error("Invalid Figma URL: missing node-id parameter");
  }

  return { fileKey, nodeId: nodeIdParam.replace(/-/g, ":") };
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  componentId?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: unknown[];
  children?: FigmaNode[];
}

export interface FetchNodeResult {
  node: FigmaNode;
  lastModified: string;
}

export async function fetchNode(fileKey: string, nodeId: string, token: string): Promise<FetchNodeResult> {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`;
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const node = data.nodes?.[nodeId]?.document;
  if (!node) throw new Error(`Node ${nodeId} not found`);
  return { node, lastModified: data.lastModified ?? "" };
}

export async function fetchImageUrls(
  fileKey: string,
  nodeIds: string[],
  token: string,
  format: "svg" | "png" | "jpg",
  scale = 1
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};
  const ids = nodeIds.join(",");
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${ids}&format=${format}${format !== "svg" ? `&scale=${scale}` : ""}`;
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma images API error: ${res.status}`);
  const data = await res.json() as { images: Record<string, string | null> };
  const result: Record<string, string> = {};
  for (const [id, imgUrl] of Object.entries(data.images ?? {})) {
    if (imgUrl) result[id] = imgUrl;
  }
  return result;
}
