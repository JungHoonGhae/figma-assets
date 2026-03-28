import { describe, it, expect } from "vitest";
import { normalizeNode } from "../extract/normalizer.js";
import { diff } from "../diff/index.js";
import { auditNode } from "../audit/index.js";
import type { RawFigmaNode } from "../extract/client.js";
import type { DOMElement } from "../types.js";

describe("full pipeline (unit)", () => {
  const rawNode: RawFigmaNode = {
    id: "1:1", name: "Login Page", type: "FRAME",
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    paddingTop: 64, paddingRight: 120, paddingBottom: 64, paddingLeft: 120,
    itemSpacing: 32,
    children: [
      {
        id: "1:2", name: "Title", type: "TEXT", characters: "로그인",
        style: { fontFamily: "Pretendard", fontWeight: 700, fontSize: 32, lineHeightPx: 40 },
        fills: [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
        absoluteBoundingBox: { x: 120, y: 64, width: 200, height: 40 },
      },
      {
        id: "1:3", name: "Card", type: "FRAME", cornerRadius: 12,
        paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24,
        absoluteBoundingBox: { x: 120, y: 136, width: 400, height: 280 },
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
        strokeWeight: 1, strokeAlign: "INSIDE",
        strokes: [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } }],
      },
    ],
  };

  it("extract → normalize → diff with matching browser values → PASS", () => {
    const normalized = normalizeNode(rawNode);
    const flatNodes = flattenNodes(normalized);

    const elements: DOMElement[] = [{
      selector: "h1", textContent: "로그인",
      computedStyles: {
        width: "200px", height: "40px", fontSize: "32px",
        fontWeight: "700", lineHeight: "40px", color: "rgb(26, 26, 26)",
      },
      matchedFigmaNodeId: "1:2",
    }];

    const result = diff({ nodes: flatNodes, elements });
    expect(result.pass).toBe(true);
    expect(result.summary.fail).toBe(0);
  });

  it("extract → normalize → diff with mismatched values → FAIL", () => {
    const normalized = normalizeNode(rawNode);
    const flatNodes = flattenNodes(normalized);

    const elements: DOMElement[] = [{
      selector: "h1", textContent: "로그인",
      computedStyles: {
        width: "200px", height: "40px", fontSize: "32px",
        fontWeight: "700", lineHeight: "44.8px", color: "rgb(26, 26, 26)",
      },
      matchedFigmaNodeId: "1:2",
    }];

    const result = diff({ nodes: flatNodes, elements });
    expect(result.pass).toBe(false);
    expect(result.summary.fail).toBe(1);
    const failedEntry = result.results.find((r) => !r.pass);
    expect(failedEntry?.property).toBe("lineHeight");
    expect(failedEntry?.expected).toBe("40px");
    expect(failedEntry?.actual).toBe("44.8px");
  });

  it("audit detects OUTSIDE stroke", () => {
    const badNode: RawFigmaNode = {
      ...rawNode,
      children: [{
        id: "1:4", name: "BadBorder", type: "FRAME",
        strokeAlign: "OUTSIDE", strokeWeight: 2,
        strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      }],
    };
    const result = auditNode(badNode);
    expect(result.pass).toBe(false);
    expect(result.issues[0].property).toBe("strokeAlign");
  });
});

function flattenNodes(node: import("../types.js").FigmaNode): import("../types.js").FigmaNode[] {
  const result = [node];
  if (node.children) {
    for (const child of node.children) result.push(...flattenNodes(child));
  }
  return result;
}
