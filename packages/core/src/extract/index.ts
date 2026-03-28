import type { FigmaNode } from "../types.js";
import { fetchFigmaNode, parseFigmaUrl } from "./client.js";
import { normalizeNode } from "./normalizer.js";
import { NodeCache } from "./cache.js";
import { collectSvgNodeIds, fetchSvgs } from "./svg.js";

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
  svgs: Record<string, string>;  // nodeId → SVG string
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
  let raw: any;
  if (cache && !options.refresh) {
    const cached = cache.get(nodeId);
    if (cached) {
      raw = cached;
    }
  }

  if (!raw) {
    // Fetch from API
    raw = await fetchFigmaNode(fileKey, nodeId, options.token);

    // Cache the raw response
    if (cache) {
      cache.set(nodeId, raw);
    }
  }

  // Collect SVG node IDs
  const svgNodeIds = collectSvgNodeIds(raw);

  // Resolve SVGs from cache or fetch
  const svgs: Record<string, string> = {};
  const missingIds: string[] = [];

  for (const id of svgNodeIds) {
    if (cache && !options.refresh) {
      const cached = cache.getSvg(id);
      if (cached) {
        svgs[id] = cached;
        continue;
      }
    }
    missingIds.push(id);
  }

  if (missingIds.length > 0) {
    const fetched = await fetchSvgs(fileKey, missingIds, options.token);
    for (const [id, svg] of Object.entries(fetched)) {
      svgs[id] = svg;
      if (cache) {
        cache.setSvg(id, svg);
      }
    }
  }

  const node = normalizeNode(raw);
  attachSvgs(node, svgs);
  const nodes = flattenNodes(node);
  return { nodes, svgs, count: nodes.length };
}

function attachSvgs(node: FigmaNode, svgs: Record<string, string>): void {
  if (svgs[node.id]) {
    node.svg = svgs[node.id];
  }
  if (node.children) {
    for (const child of node.children) {
      attachSvgs(child, svgs);
    }
  }
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
