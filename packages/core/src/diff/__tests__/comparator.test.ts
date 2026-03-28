import { describe, it, expect } from "vitest";
import { compareValues, comparePx, compareColor } from "../comparator.js";
import type { ToleranceConfig } from "../../types.js";

const defaultTolerance: Required<ToleranceConfig> = {
  size: 1, color: 1.0, fontSize: 0, lineHeight: 0.5,
};

describe("comparePx", () => {
  it("passes when values are equal", () => {
    const result = comparePx("32px", "32px", 0);
    expect(result.pass).toBe(true);
    expect(result.delta).toBe(0);
  });
  it("passes within tolerance", () => {
    const result = comparePx("100px", "100.8px", 1);
    expect(result.pass).toBe(true);
    expect(result.delta).toBeCloseTo(0.8);
  });
  it("fails outside tolerance", () => {
    const result = comparePx("40px", "44.8px", 0.5);
    expect(result.pass).toBe(false);
    expect(result.delta).toBeCloseTo(4.8);
  });
});

describe("compareColor", () => {
  it("passes for identical colors", () => {
    expect(compareColor("rgb(255, 0, 0)", "rgb(255, 0, 0)", 1.0).pass).toBe(true);
  });
  it("passes for perceptually similar colors", () => {
    expect(compareColor("rgb(255, 0, 0)", "rgb(254, 0, 0)", 1.0).pass).toBe(true);
  });
  it("fails for noticeably different colors", () => {
    expect(compareColor("rgb(255, 0, 0)", "rgb(200, 0, 0)", 1.0).pass).toBe(false);
  });
});

describe("compareValues", () => {
  it("compares fontSize with zero tolerance", () => {
    expect(compareValues("fontSize", "16px", "16px", defaultTolerance).pass).toBe(true);
  });
  it("fails fontSize with any difference", () => {
    expect(compareValues("fontSize", "16px", "16.5px", defaultTolerance).pass).toBe(false);
  });
  it("compares lineHeight with 0.5px tolerance", () => {
    expect(compareValues("lineHeight", "24px", "24.3px", defaultTolerance).pass).toBe(true);
  });
  it("compares width with 1px tolerance", () => {
    expect(compareValues("width", "320px", "320.8px", defaultTolerance).pass).toBe(true);
  });
  it("compares color with ΔE tolerance", () => {
    expect(compareValues("color", "rgb(26, 26, 26)", "rgb(26, 26, 26)", defaultTolerance).pass).toBe(true);
  });
  it("compares fontWeight as string equality", () => {
    expect(compareValues("fontWeight", "700", "700", defaultTolerance).pass).toBe(true);
  });
});
