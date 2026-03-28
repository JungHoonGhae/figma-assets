import { describe, it, expect } from "vitest";
import { parseFigmaUrl } from "../figma.js";

describe("parseFigmaUrl", () => {
  it("extracts fileKey and nodeId from design URL", () => {
    const r = parseFigmaUrl("https://www.figma.com/design/abc123/MyFile?node-id=2784-11151");
    expect(r.fileKey).toBe("abc123");
    expect(r.nodeId).toBe("2784:11151");
  });

  it("handles branch URLs", () => {
    const r = parseFigmaUrl("https://figma.com/design/abc/branch/brKey/File?node-id=1-2");
    expect(r.fileKey).toBe("brKey");
    expect(r.nodeId).toBe("1:2");
  });

  it("throws for invalid URL", () => {
    expect(() => parseFigmaUrl("https://google.com")).toThrow("Invalid Figma URL");
  });

  it("throws for missing node-id", () => {
    expect(() => parseFigmaUrl("https://figma.com/design/abc/File")).toThrow("missing node-id");
  });
});
