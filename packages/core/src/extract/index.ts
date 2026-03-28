import type { FigmaNode } from "../types.js";
import { fetchFigmaNode, parseFigmaUrl } from "./client.js";
import { normalizeNode } from "./normalizer.js";
import { NodeCache } from "./cache.js";

export interface ExtractOptions {
  figmaUrl?: string;
  fileKey?: string;
  nodeId?: string;
  token: string;
  cacheDir?: string;
  refresh?: boolean;
}

export interface ExtractResult {
  nodes: FigmaNode[];
  count: number;
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  let fileKey: string;
  let nodeId: string;

  if (options.figmaUrl) {
    const parsed = parseFigmaUrl(options.figmaUrl);
    fileKey = parsed.fileKey;
    nodeId = parsed.nodeId;
  } else if (options.fileKey && options.nodeId) {
    fileKey = options.fileKey;
    nodeId = options.nodeId;
  } else {
    throw new Error("Provide either figmaUrl or both fileKey and nodeId");
  }

  const cache = options.cacheDir ? new NodeCache(options.cacheDir) : null;

  // Check cache
  if (cache && !options.refresh) {
    const cached = cache.get(nodeId);
    if (cached) {
      const node = normalizeNode(cached as any);
      const nodes = flattenNodes(node);
      return { nodes, count: nodes.length };
    }
  }

  // Fetch from API
  const raw = await fetchFigmaNode(fileKey, nodeId, options.token);

  // Cache the raw response
  if (cache) {
    cache.set(nodeId, raw);
  }

  const node = normalizeNode(raw);
  const nodes = flattenNodes(node);
  return { nodes, count: nodes.length };
}

function flattenNodes(node: FigmaNode): FigmaNode[] {
  const result: FigmaNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenNodes(child));
    }
  }
  return result;
}

export { parseFigmaUrl } from "./client.js";
export { NodeCache } from "./cache.js";
