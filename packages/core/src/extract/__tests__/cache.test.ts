import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NodeCache } from "../cache.js";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("NodeCache", () => {
  let cacheDir: string;
  let cache: NodeCache;

  beforeEach(() => {
    cacheDir = join(tmpdir(), `figma-doctor-cache-${Date.now()}`);
    cache = new NodeCache(cacheDir);
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("returns null for cache miss", () => {
    expect(cache.get("2784:11151")).toBeNull();
  });

  it("stores and retrieves cached data", () => {
    const data = { id: "2784:11151", name: "Test", type: "FRAME" };
    cache.set("2784:11151", data);

    const result = cache.get("2784:11151");
    expect(result).toEqual(data);
  });

  it("converts colons to hyphens in filename", () => {
    cache.set("2784:11151", { id: "test" });
    expect(existsSync(join(cacheDir, "nodes", "2784-11151.json"))).toBe(true);
  });

  it("clears specific node", () => {
    cache.set("2784:11151", { id: "test" });
    cache.clear("2784:11151");
    expect(cache.get("2784:11151")).toBeNull();
  });

  it("clears all cache", () => {
    cache.set("100:1", { id: "a" });
    cache.set("100:2", { id: "b" });
    cache.clearAll();
    expect(cache.get("100:1")).toBeNull();
    expect(cache.get("100:2")).toBeNull();
  });
});
