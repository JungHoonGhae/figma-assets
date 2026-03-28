import { describe, it, expect } from "vitest";
import { auditNode } from "../index.js";
import type { RawFigmaNode } from "../../extract/client.js";

describe("auditNode", () => {
  it("detects OUTSIDE stroke alignment", () => {
    const node: RawFigmaNode = {
      id: "1:1", name: "Card", type: "FRAME",
      strokeAlign: "OUTSIDE", strokeWeight: 2,
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
    };
    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].property).toBe("strokeAlign");
    expect(result.pass).toBe(false);
  });

  it("detects LINEAR_BURN blend mode", () => {
    const node: RawFigmaNode = {
      id: "1:2", name: "Overlay", type: "FRAME",
      blendMode: "LINEAR_BURN",
    };
    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].property).toBe("blendMode");
  });

  it("detects leadingTrim CAP_HEIGHT", () => {
    const node: RawFigmaNode = {
      id: "1:3", name: "Text", type: "TEXT",
      characters: "Hello",
      style: { leadingTrim: "CAP_HEIGHT" },
    };
    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("warning");
  });

  it("passes clean node", () => {
    const node: RawFigmaNode = {
      id: "1:4", name: "Clean", type: "FRAME",
      strokeAlign: "INSIDE", blendMode: "NORMAL",
    };
    const result = auditNode(node);
    expect(result.issues).toHaveLength(0);
    expect(result.pass).toBe(true);
  });

  it("audits children recursively", () => {
    const node: RawFigmaNode = {
      id: "1:5", name: "Parent", type: "FRAME",
      children: [
        { id: "1:6", name: "Bad Child", type: "FRAME", blendMode: "LINEAR_DODGE" },
      ],
    };
    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].nodeId).toBe("1:6");
  });

  it("filters by severity", () => {
    const node: RawFigmaNode = {
      id: "1:7", name: "Mixed", type: "FRAME",
      strokeAlign: "OUTSIDE", strokeWeight: 1,
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      children: [
        { id: "1:8", name: "Text", type: "TEXT", characters: "Hi", style: { leadingTrim: "CAP_HEIGHT" } },
      ],
    };
    const all = auditNode(node);
    expect(all.summary.errors).toBe(1);
    expect(all.summary.warnings).toBe(1);

    const errorsOnly = auditNode(node, { severity: "error" });
    expect(errorsOnly.issues).toHaveLength(1);
    expect(errorsOnly.issues[0].severity).toBe("error");
  });
});
