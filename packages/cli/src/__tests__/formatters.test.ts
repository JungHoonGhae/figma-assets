import { describe, it, expect } from "vitest";
import { formatDiffTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import type { DiffResult } from "@figma-doctor/core";

const mockDiffResult: DiffResult = {
  results: [
    { nodeId: "1:1", nodeName: "Title", selector: "h1", property: "fontSize", expected: "32px", actual: "32px", delta: 0, pass: true },
    { nodeId: "1:1", nodeName: "Title", selector: "h1", property: "lineHeight", expected: "40px", actual: "44.8px", delta: 4.8, pass: false },
  ],
  summary: { total: 2, pass: 1, fail: 1 },
  pass: false,
};

describe("formatDiffTable", () => {
  it("includes header with page info", () => {
    const output = formatDiffTable(mockDiffResult, { page: "login", nodeId: "1:1", url: "http://localhost:3000" });
    expect(output).toContain("login");
    expect(output).toContain("1:1");
  });
  it("shows pass/fail markers", () => {
    const output = formatDiffTable(mockDiffResult, { page: "login", nodeId: "1:1", url: "http://localhost:3000" });
    expect(output).toContain("FAIL");
    expect(output).toContain("pass");
  });
  it("shows summary line", () => {
    const output = formatDiffTable(mockDiffResult, { page: "login", nodeId: "1:1", url: "http://localhost:3000" });
    expect(output).toContain("1 of 2");
  });
});

describe("formatJson", () => {
  it("returns valid JSON string", () => {
    const output = formatJson(mockDiffResult);
    const parsed = JSON.parse(output);
    expect(parsed.pass).toBe(false);
    expect(parsed.summary.fail).toBe(1);
  });
});
