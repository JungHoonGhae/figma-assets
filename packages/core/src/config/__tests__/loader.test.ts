import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../loader.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `figma-doctor-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("loads a valid config file", () => {
    const config = {
      figma: { fileKey: "abc123", token: "figd_test" },
      pages: {
        login: { figmaNodeId: "2784:11151", url: "http://localhost:3000/login" },
      },
    };
    writeFileSync(join(testDir, ".figma-doctor.json"), JSON.stringify(config));

    const result = loadConfig(testDir);
    expect(result.figma.fileKey).toBe("abc123");
    expect(result.pages.login.figmaNodeId).toBe("2784:11151");
  });

  it("resolves environment variable references in token", () => {
    process.env.TEST_FIGMA_TOKEN = "figd_from_env";
    const config = {
      figma: { fileKey: "abc123", token: "$TEST_FIGMA_TOKEN" },
      pages: {},
    };
    writeFileSync(join(testDir, ".figma-doctor.json"), JSON.stringify(config));

    const result = loadConfig(testDir);
    expect(result.figma.token).toBe("figd_from_env");
    delete process.env.TEST_FIGMA_TOKEN;
  });

  it("throws if config file not found", () => {
    expect(() => loadConfig(testDir)).toThrow("not found");
  });

  it("throws if required fields are missing", () => {
    writeFileSync(join(testDir, ".figma-doctor.json"), JSON.stringify({}));
    expect(() => loadConfig(testDir)).toThrow();
  });

  it("applies default tolerance values", () => {
    const config = {
      figma: { fileKey: "abc123", token: "figd_test" },
      pages: {},
    };
    writeFileSync(join(testDir, ".figma-doctor.json"), JSON.stringify(config));

    const result = loadConfig(testDir);
    expect(result.diff?.tolerance?.size).toBe(1);
    expect(result.diff?.tolerance?.color).toBe(1.0);
    expect(result.diff?.tolerance?.fontSize).toBe(0);
    expect(result.diff?.tolerance?.lineHeight).toBe(0.5);
  });
});
