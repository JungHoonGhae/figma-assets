import { describe, it, expect } from "vitest";
import { buildSelectors } from "../matcher.js";
import type { FigmaNode } from "../../types.js";

describe("buildSelectors", () => {
  it("builds selector for TEXT node using textContent", () => {
    const nodes: FigmaNode[] = [{ id: "1:1", name: "Title", type: "TEXT", characters: "로그인", styles: { fontSize: "32px" } }];
    const selectors = buildSelectors(nodes);
    expect(selectors).toHaveLength(1);
    expect(selectors[0].strategy).toBe("text");
    expect(selectors[0].textContent).toBe("로그인");
  });

  it("skips nodes without measurable styles", () => {
    const nodes: FigmaNode[] = [{ id: "1:2", name: "Empty", type: "GROUP", styles: {} }];
    expect(buildSelectors(nodes)).toHaveLength(0);
  });

  it("handles FRAME nodes with structural matching", () => {
    const nodes: FigmaNode[] = [{ id: "1:3", name: "Card", type: "FRAME", styles: { width: "320px", height: "280px" } }];
    const selectors = buildSelectors(nodes);
    expect(selectors[0].strategy).toBe("structural");
  });

  it("deduplicates text content matches", () => {
    const nodes: FigmaNode[] = [
      { id: "1:4", name: "L1", type: "TEXT", characters: "확인", styles: { fontSize: "14px" } },
      { id: "1:5", name: "L2", type: "TEXT", characters: "확인", styles: { fontSize: "14px" } },
    ];
    const ambiguous = buildSelectors(nodes).filter((s) => s.ambiguous);
    expect(ambiguous).toHaveLength(2);
  });
});
