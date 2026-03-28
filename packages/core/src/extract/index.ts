import type { FigmaNode } from "../types.js";
import { fetchFigmaNode, fetchFileLastModified, parseFigmaUrl } from "./client.js";
import { normalizeNode } from "./normalizer.js";
import { NodeCache } from "./cache.js";
import { collectSvgNodeIds, collectSvgNodeIdsWithDedup, fetchSvgs } from "./svg.js";

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
  svgStats: {
    total: number;       // 전체 SVG 엔트리 수
    unique: number;      // 유니크 SVG 수 (실제 API 호출 수)
    deduplicated: number; // 중복 제거로 절약한 수
  };
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

  // Check file version cache: if lastModified matches, skip heavy API calls
  if (cache && !options.refresh) {
    const cachedLastModified = cache.getLastModified(fileKey);
    if (cachedLastModified) {
      const currentLastModified = await fetchFileLastModified(fileKey, options.token);
      if (cachedLastModified === currentLastModified) {
        const cached = cache.get(nodeId);
        if (cached) {
          const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(cached as any);
          const allIds = [...uniqueIds, ...Object.keys(duplicateMap)];
          const svgs: Record<string, string> = {};
          let allCached = true;
          for (const id of uniqueIds) {
            const svg = cache.getSvg(id);
            if (svg) {
              svgs[id] = svg;
            } else {
              allCached = false;
              break;
            }
          }
          if (allCached) {
            // Copy duplicate SVGs from their originals
            for (const [dupId, origId] of Object.entries(duplicateMap)) {
              if (svgs[origId]) {
                svgs[dupId] = svgs[origId];
              }
            }
            const node = normalizeNode(cached as any);
            attachSvgs(node, svgs);
            const nodes = flattenNodes(node);
            const dupCount = Object.keys(duplicateMap).length;
            return { nodes, svgs, count: nodes.length, svgStats: { total: Object.keys(svgs).length, unique: uniqueIds.length, deduplicated: dupCount } };
          }
        }
      }
    }
  }

  // Check node data cache (when no version cache available or version changed)
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

  // Collect SVG node IDs with deduplication
  const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(raw);

  // Resolve SVGs from cache or fetch (only unique IDs)
  const svgs: Record<string, string> = {};
  const missingIds: string[] = [];

  for (const id of uniqueIds) {
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

  // Copy duplicate SVGs from their originals (no extra fetch needed)
  for (const [dupId, origId] of Object.entries(duplicateMap)) {
    if (svgs[origId]) {
      svgs[dupId] = svgs[origId];
    }
  }

  // Save lastModified for future warm runs
  if (cache) {
    const lastModified = await fetchFileLastModified(fileKey, options.token);
    cache.setLastModified(fileKey, lastModified);
  }

  const node = normalizeNode(raw);
  attachSvgs(node, svgs);
  const nodes = flattenNodes(node);
  const dupCount = Object.keys(duplicateMap).length;
  return { nodes, svgs, count: nodes.length, svgStats: { total: Object.keys(svgs).length, unique: uniqueIds.length, deduplicated: dupCount } };
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
