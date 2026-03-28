import { describe, it, expect } from "vitest";
import { normalizeNode } from "../normalizer.js";
import type { RawFigmaNode } from "../client.js";

describe("normalizeNode", () => {
  it("normalizes a TEXT node", () => {
    const raw: RawFigmaNode = {
      id: "100:1",
      name: "Title",
      type: "TEXT",
      characters: "로그인",
      style: {
        fontFamily: "Pretendard",
        fontWeight: 700,
        fontSize: 32,
        lineHeightPx: 40,
        letterSpacing: -0.5,
      },
      fills: [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 },
    };

    const result = normalizeNode(raw);
    expect(result.id).toBe("100:1");
    expect(result.characters).toBe("로그인");
    expect(result.styles.fontSize).toBe("32px");
    expect(result.styles.fontWeight).toBe("700");
    expect(result.styles.lineHeight).toBe("40px");
    expect(result.styles.letterSpacing).toBe("-0.5px");
    expect(result.styles.color).toBe("rgb(26, 26, 26)");
    expect(result.styles.width).toBe("200px");
    expect(result.styles.height).toBe("40px");
  });

  it("normalizes a FRAME node with padding and gap", () => {
    const raw: RawFigmaNode = {
      id: "100:2",
      name: "Card",
      type: "FRAME",
      paddingTop: 24,
      paddingRight: 16,
      paddingBottom: 24,
      paddingLeft: 16,
      itemSpacing: 12,
      cornerRadius: 8,
      absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 280 },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
    };

    const result = normalizeNode(raw);
    expect(result.styles.paddingTop).toBe("24px");
    expect(result.styles.paddingRight).toBe("16px");
    expect(result.styles.paddingBottom).toBe("24px");
    expect(result.styles.paddingLeft).toBe("16px");
    expect(result.styles.gap).toBe("12px");
    expect(result.styles.borderRadius).toBe("8px");
    expect(result.styles.backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("normalizes border (stroke) properties", () => {
    const raw: RawFigmaNode = {
      id: "100:3",
      name: "Input",
      type: "FRAME",
      strokeWeight: 1,
      strokeAlign: "INSIDE",
      strokes: [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8, a: 1 } }],
      absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 48 },
    };

    const result = normalizeNode(raw);
    expect(result.styles.borderWidth).toBe("1px");
    expect(result.styles.borderColor).toBe("rgb(204, 204, 204)");
    expect(result.styles.borderStyle).toBe("solid");
  });

  it("normalizes opacity", () => {
    const raw: RawFigmaNode = {
      id: "100:4",
      name: "Ghost",
      type: "FRAME",
      opacity: 0.5,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };

    const result = normalizeNode(raw);
    expect(result.styles.opacity).toBe("0.5");
  });

  it("handles lineHeight as percentage", () => {
    const raw: RawFigmaNode = {
      id: "100:5",
      name: "Body",
      type: "TEXT",
      characters: "Some text",
      style: {
        fontFamily: "Inter",
        fontWeight: 400,
        fontSize: 16,
        lineHeightPercentFontSize: 150,
        lineHeightUnit: "FONT_SIZE_%",
      },
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 24 },
    };

    const result = normalizeNode(raw);
    expect(result.styles.lineHeight).toBe("150%");
  });

  it("recursively normalizes children", () => {
    const raw: RawFigmaNode = {
      id: "100:6",
      name: "Container",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 400 },
      children: [
        {
          id: "100:7",
          name: "Child",
          type: "TEXT",
          characters: "Hello",
          style: { fontFamily: "Inter", fontWeight: 400, fontSize: 14 },
          absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
        },
      ],
    };

    const result = normalizeNode(raw);
    expect(result.children).toHaveLength(1);
    expect(result.children![0].styles.fontSize).toBe("14px");
  });
});
