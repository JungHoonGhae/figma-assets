import { describe, it, expect } from "vitest";
import { collectSvgNodeIds, collectSvgNodeIdsWithDedup } from "../svg.js";
import type { RawFigmaNode } from "../client.js";

describe("collectSvgNodeIds", () => {
  it("collects VECTOR nodes", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Arrow", type: "VECTOR" },
        { id: "1:3", name: "Title", type: "TEXT", characters: "Hello" },
      ],
    };
    const ids = collectSvgNodeIds(node);
    expect(ids).toContain("1:2");
    expect(ids).not.toContain("1:3");
  });

  it("collects BOOLEAN_OPERATION nodes", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Union", type: "BOOLEAN_OPERATION" },
      ],
    };
    expect(collectSvgNodeIds(node)).toContain("1:2");
  });

  it("exports small icon container instead of individual vectors", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        {
          id: "1:2", name: "Icon", type: "INSTANCE",
          absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
          children: [
            { id: "1:3", name: "Path", type: "VECTOR" },
            { id: "1:4", name: "Path2", type: "VECTOR" },
          ],
        },
      ],
    };
    const ids = collectSvgNodeIds(node);
    // Should export the INSTANCE container, not individual vectors
    expect(ids).toContain("1:2");
    expect(ids).not.toContain("1:3");
    expect(ids).not.toContain("1:4");
  });

  it("skips TEXT and large FRAME nodes", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Page", type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 360, height: 800 },
      children: [
        { id: "1:2", name: "Title", type: "TEXT", characters: "Hello" },
        {
          id: "1:3", name: "Card", type: "FRAME",
          absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 200 },
          children: [
            { id: "1:4", name: "Arrow", type: "VECTOR" },
          ],
        },
      ],
    };
    const ids = collectSvgNodeIds(node);
    expect(ids).not.toContain("1:2"); // TEXT
    expect(ids).not.toContain("1:3"); // Large FRAME
    expect(ids).toContain("1:4"); // VECTOR inside large frame
  });
});

describe("collectSvgNodeIdsWithDedup", () => {
  it("deduplicates identical component instances", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        {
          id: "1:2", name: "Check", type: "INSTANCE",
          componentId: "comp:check",
          absoluteBoundingBox: { x: 0, y: 0, width: 20, height: 20 },
          children: [{ id: "1:3", name: "Path", type: "VECTOR" }],
        },
        {
          id: "1:4", name: "Check", type: "INSTANCE",
          componentId: "comp:check",
          absoluteBoundingBox: { x: 100, y: 0, width: 20, height: 20 },
          children: [{ id: "1:5", name: "Path", type: "VECTOR" }],
        },
        {
          id: "1:6", name: "Check", type: "INSTANCE",
          componentId: "comp:check",
          absoluteBoundingBox: { x: 200, y: 0, width: 20, height: 20 },
          children: [{ id: "1:7", name: "Path", type: "VECTOR" }],
        },
      ],
    };
    const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(node);
    expect(uniqueIds).toHaveLength(1); // only first check icon
    expect(Object.keys(duplicateMap)).toHaveLength(2); // 2 duplicates
  });

  it("returns all IDs as unique when no duplicates exist", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        { id: "1:2", name: "Arrow", type: "VECTOR" },
        { id: "1:3", name: "Circle", type: "ELLIPSE" },
      ],
    };
    const { uniqueIds, duplicateMap } = collectSvgNodeIdsWithDedup(node);
    expect(uniqueIds).toHaveLength(2);
    expect(Object.keys(duplicateMap)).toHaveLength(0);
  });

  it("is backward compatible — same results as collectSvgNodeIds when no duplicates", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Root", type: "FRAME",
      children: [
        {
          id: "1:2", name: "Icon", type: "INSTANCE",
          componentId: "comp:unique-a",
          absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
          children: [{ id: "1:3", name: "Path", type: "VECTOR" }],
        },
        {
          id: "1:4", name: "OtherIcon", type: "INSTANCE",
          componentId: "comp:unique-b",
          absoluteBoundingBox: { x: 50, y: 0, width: 24, height: 24 },
          children: [{ id: "1:5", name: "Path", type: "VECTOR" }],
        },
      ],
    };
    const plain = collectSvgNodeIds(node);
    const { uniqueIds } = collectSvgNodeIdsWithDedup(node);
    expect(uniqueIds).toEqual(plain);
  });
});
