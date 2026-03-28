import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFigmaNode, parseFigmaUrl } from "../client.js";

describe("parseFigmaUrl", () => {
  it("extracts fileKey and nodeId from design URL", () => {
    const url = "https://www.figma.com/design/abc123/MyFile?node-id=2784-11151";
    const result = parseFigmaUrl(url);
    expect(result.fileKey).toBe("abc123");
    expect(result.nodeId).toBe("2784:11151");
  });

  it("extracts from file URL format", () => {
    const url = "https://figma.com/file/xyz789/FileName?node-id=100-200";
    const result = parseFigmaUrl(url);
    expect(result.fileKey).toBe("xyz789");
    expect(result.nodeId).toBe("100:200");
  });

  it("handles branch URLs", () => {
    const url = "https://figma.com/design/abc123/branch/branchKey123/FileName?node-id=1-2";
    const result = parseFigmaUrl(url);
    expect(result.fileKey).toBe("branchKey123");
    expect(result.nodeId).toBe("1:2");
  });

  it("throws for invalid URL", () => {
    expect(() => parseFigmaUrl("https://google.com")).toThrow("Invalid Figma URL");
  });
});

describe("fetchFigmaNode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Figma API with correct URL and headers", async () => {
    const mockResponse = {
      nodes: {
        "2784:11151": {
          document: {
            id: "2784:11151",
            name: "Login",
            type: "FRAME",
            children: [],
          },
        },
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await fetchFigmaNode("abc123", "2784:11151", "figd_test");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.figma.com/v1/files/abc123/nodes?ids=2784:11151",
      { headers: { "X-Figma-Token": "figd_test" } }
    );
    expect(result.id).toBe("2784:11151");
    expect(result.name).toBe("Login");
  });

  it("throws on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    }));

    await expect(
      fetchFigmaNode("abc123", "2784:11151", "bad_token")
    ).rejects.toThrow("Figma API error: 403 Forbidden");
  });
});
