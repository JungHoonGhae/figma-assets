import { describe, it, expect } from "vitest";
import { collectAssetIds, isRasterSvg } from "../collect.js";
import type { FigmaNode } from "../figma.js";

describe("collectAssetIds", () => {
  it("collects VECTOR nodes", () => {
    const node: FigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Arrow", type: "VECTOR" },
        { id: "1:3", name: "Title", type: "TEXT" },
      ],
    };
    const { allIds } = collectAssetIds(node);
    expect(allIds).toContain("1:2");
    expect(allIds).not.toContain("1:3");
  });

  it("exports small icon container as single unit", () => {
    const node: FigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [{
        id: "1:2", name: "Icon", type: "INSTANCE",
        absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
        children: [
          { id: "1:3", name: "Path", type: "VECTOR" },
          { id: "1:4", name: "Path2", type: "VECTOR" },
        ],
      }],
    };
    const { allIds } = collectAssetIds(node);
    expect(allIds).toContain("1:2");
    expect(allIds).not.toContain("1:3");
  });

  it("deduplicates same componentId", () => {
    const node: FigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Check", type: "INSTANCE", componentId: "comp:check",
          absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
          children: [{ id: "1:3", name: "Path", type: "VECTOR" }] },
        { id: "1:4", name: "Check", type: "INSTANCE", componentId: "comp:check",
          absoluteBoundingBox: { x: 100, y: 0, width: 20, height: 20 },
          children: [{ id: "1:5", name: "Path", type: "VECTOR" }] },
      ],
    };
    const { uniqueIds, duplicateMap } = collectAssetIds(node);
    expect(uniqueIds).toHaveLength(1);
    expect(Object.keys(duplicateMap)).toHaveLength(1);
  });

  it("skips invisible nodes", () => {
    const node: FigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Hidden", type: "VECTOR", visible: false },
        { id: "1:3", name: "Visible", type: "VECTOR" },
      ],
    };
    const { allIds } = collectAssetIds(node);
    expect(allIds).not.toContain("1:2");
    expect(allIds).toContain("1:3");
  });

  it("exports INSTANCE with all-vector leaves as single unit (logo)", () => {
    const node: FigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [{
        id: "1:2", name: "Logo", type: "INSTANCE",
        absoluteBoundingBox: { x: 0, y: 0, width: 93, height: 32 },
        children: [{
          id: "1:3", name: "inner", type: "FRAME",
          children: [
            { id: "1:4", name: "V1", type: "VECTOR" },
            { id: "1:5", name: "V2", type: "VECTOR" },
          ],
        }],
      }],
    };
    const { allIds } = collectAssetIds(node);
    expect(allIds).toContain("1:2");
    expect(allIds).not.toContain("1:4");
  });
});

describe("isRasterSvg", () => {
  it("detects base64 embedded images", () => {
    expect(isRasterSvg('<svg><image href="data:image/png;base64,abc"/></svg>')).toBe(true);
  });

  it("passes clean SVG", () => {
    expect(isRasterSvg('<svg><path d="M0 0"/></svg>')).toBe(false);
  });

  it("detects large SVGs", () => {
    const large = "<svg>" + "x".repeat(60_000) + "</svg>";
    expect(isRasterSvg(large)).toBe(true);
  });
});
