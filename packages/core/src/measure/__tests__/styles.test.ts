import { describe, it, expect } from "vitest";

describe("CSS property mapping", () => {
  const CSS_PROPERTY_MAP: Record<string, string> = {
    paddingTop: "padding-top", paddingRight: "padding-right",
    paddingBottom: "padding-bottom", paddingLeft: "padding-left",
    fontSize: "font-size", fontWeight: "font-weight",
    fontFamily: "font-family", lineHeight: "line-height",
    letterSpacing: "letter-spacing", backgroundColor: "background-color",
    borderWidth: "border-top-width", borderColor: "border-top-color",
    borderRadius: "border-top-left-radius", borderStyle: "border-top-style",
  };

  it("maps borderWidth to border-top-width", () => {
    expect(CSS_PROPERTY_MAP["borderWidth"]).toBe("border-top-width");
  });
  it("maps borderRadius to border-top-left-radius", () => {
    expect(CSS_PROPERTY_MAP["borderRadius"]).toBe("border-top-left-radius");
  });
  it("does not map simple properties", () => {
    expect(CSS_PROPERTY_MAP["width"]).toBeUndefined();
    expect(CSS_PROPERTY_MAP["opacity"]).toBeUndefined();
  });
});
