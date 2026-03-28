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

  let fileKey: string;
  const branchIndex = segments.indexOf("branch");
  if (branchIndex !== -1 && segments.length > branchIndex + 1) {
    fileKey = segments[branchIndex + 1];
  } else {
    fileKey = segments[typeIndex + 1];
  }

  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new Error("Invalid Figma URL: missing node-id parameter");
  }
  const nodeId = nodeIdParam.replace(/-/g, ":");

  return { fileKey, nodeId };
}

export interface RawFigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  style?: Record<string, unknown>;
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  constraints?: { vertical: string; horizontal: string };
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  strokeWeight?: number;
  strokeAlign?: string;
  blendMode?: string;
  opacity?: number;
  componentId?: string;
  // Layout (Auto Layout)
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  clipsContent?: boolean;
  // Sizing
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children?: RawFigmaNode[];
}

export async function fetchFigmaNode(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<RawFigmaNode> {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`;
  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const node = data.nodes?.[nodeId]?.document;
  if (!node) {
    throw new Error(`Node ${nodeId} not found in Figma file ${fileKey}`);
  }

  return node;
}

export async function fetchFileLastModified(
  fileKey: string,
  token: string
): Promise<string> {
  // Use depth=1 for minimal response — we only need the lastModified field
  const url = `https://api.figma.com/v1/files/${fileKey}?depth=1`;
  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.lastModified ?? "";
}
