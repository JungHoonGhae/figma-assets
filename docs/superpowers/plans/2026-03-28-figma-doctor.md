# figma-doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma 렌더링 엔진과 브라우저 CSS 엔진 사이의 간극을 진단하는 CLI 도구를 구현한다.

**Architecture:** 모노레포 2 패키지(@figma-doctor/core + figma-doctor CLI). Core는 audit/extract/measure/diff 4개 모듈로 구성. CLI는 core를 호출하는 얇은 껍질. Vitest로 테스트, Commander.js로 CLI.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest, Playwright, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-28-figma-doctor-design.md`

---

## File Structure

```
figma-doctor/
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                  ← public API re-exports
│   │       ├── types.ts                  ← 공유 타입 (FigmaNode, DOMElement, DiffResult 등)
│   │       ├── config/
│   │       │   ├── loader.ts             ← .figma-doctor.json 로더
│   │       │   └── schema.ts             ← 설정 스키마 + 검증
│   │       ├── extract/
│   │       │   ├── client.ts             ← Figma REST API 호출
│   │       │   ├── normalizer.ts         ← Figma 값 → CSS 단위 정규화
│   │       │   ├── cache.ts              ← 노드 JSON 캐시
│   │       │   └── index.ts              ← extract() 함수 (client + normalizer + cache 조합)
│   │       ├── audit/
│   │       │   ├── rules.ts              ← 룩업 테이블 (CSS 미지원 속성)
│   │       │   └── index.ts              ← audit() 함수
│   │       ├── measure/
│   │       │   ├── browser.ts            ← Playwright 브라우저 관리
│   │       │   ├── matcher.ts            ← Figma 노드 → DOM 요소 매칭
│   │       │   ├── styles.ts             ← getComputedStyle 측정
│   │       │   └── index.ts              ← measure() 함수
│   │       └── diff/
│   │           ├── comparator.ts         ← 값 비교 + 허용 오차
│   │           └── index.ts              ← diff() 함수
│   │
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                  ← CLI 진입점 (commander 설정)
│           ├── commands/
│           │   ├── init.ts               ← figma-doctor init
│           │   ├── audit.ts              ← figma-doctor audit <url>
│           │   ├── diff.ts               ← figma-doctor diff <page>
│           │   ├── extract.ts            ← figma-doctor extract <url>
│           │   └── cache.ts              ← figma-doctor cache clear
│           └── formatters/
│               ├── table.ts              ← 터미널 테이블 출력
│               └── json.ts              ← JSON 출력
│
├── package.json                          ← root (scripts, devDependencies)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json                    ← 공유 TS 설정
└── .gitignore
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`

- [ ] **Step 1: Root package.json**

```json
{
  "name": "figma-doctor-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist"
  }
}
```

- [ ] **Step 5: packages/core/package.json**

```json
{
  "name": "@figma-doctor/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "playwright": "^1.50"
  },
  "devDependencies": {
    "vitest": "^3",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 6: packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: packages/cli/package.json**

```json
{
  "name": "figma-doctor",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "figma-doctor": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@figma-doctor/core": "workspace:*",
    "commander": "^13"
  },
  "devDependencies": {
    "vitest": "^3",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 8: packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 9: .gitignore**

```
node_modules/
dist/
.figma-doctor/
.turbo/
*.tsbuildinfo
```

- [ ] **Step 10: Install dependencies and verify build**

Run: `pnpm install`
Expected: dependencies installed, no errors

- [ ] **Step 11: Create minimal entry points to verify build**

`packages/core/src/index.ts`:
```typescript
export const VERSION = "0.1.0";
```

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { VERSION } from "@figma-doctor/core";
console.log(`figma-doctor v${VERSION}`);
```

Run: `pnpm build`
Expected: both packages compile without errors

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with core and cli packages"
```

---

### Task 2: Core Types

**Files:**
- Create: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Define shared types**

`packages/core/src/types.ts`:
```typescript
// --- Config ---

export interface FigmaDoctorConfig {
  figma: {
    fileKey: string;
    token: string;
  };
  pages: Record<string, PageConfig>;
  diff?: DiffConfig;
  cache?: CacheConfig;
}

export interface PageConfig {
  figmaNodeId: string;
  url: string;
}

export interface DiffConfig {
  tolerance?: ToleranceConfig;
}

export interface ToleranceConfig {
  size?: number;       // ±px, default 1
  color?: number;      // ΔE, default 1.0
  fontSize?: number;   // ±px, default 0
  lineHeight?: number; // ±px, default 0.5
}

export interface CacheConfig {
  dir?: string; // default ".figma-doctor/cache"
}

// --- Extract ---

export interface FigmaNode {
  id: string;
  name: string;
  type: "TEXT" | "FRAME" | "INSTANCE" | "COMPONENT" | "GROUP" | "RECTANGLE" | "VECTOR" | "ELLIPSE";
  characters?: string; // TEXT 노드의 텍스트 내용
  styles: NormalizedStyles;
  children?: FigmaNode[];
}

export interface NormalizedStyles {
  width?: string;
  height?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  gap?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
  backgroundColor?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderStyle?: string;
  opacity?: string;
}

// --- Audit ---

export type AuditSeverity = "error" | "warning";

export interface AuditIssue {
  nodeId: string;
  nodeName: string;
  property: string;
  value: string;
  severity: AuditSeverity;
  reason: string;
  suggestion: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  summary: { errors: number; warnings: number };
  pass: boolean;
}

// --- Measure ---

export interface DOMElement {
  selector: string;
  textContent?: string;
  computedStyles: NormalizedStyles;
  matchedFigmaNodeId?: string;
}

// --- Diff ---

export interface DiffEntry {
  nodeId: string;
  nodeName: string;
  selector: string;
  property: string;
  expected: string;
  actual: string;
  delta: number | null; // null for non-numeric (color, fontFamily)
  pass: boolean;
}

export interface DiffResult {
  results: DiffEntry[];
  summary: { total: number; pass: number; fail: number };
  pass: boolean;
}
```

- [ ] **Step 2: Re-export types from index.ts**

`packages/core/src/index.ts`:
```typescript
export type {
  FigmaDoctorConfig,
  PageConfig,
  DiffConfig,
  ToleranceConfig,
  CacheConfig,
  FigmaNode,
  NormalizedStyles,
  AuditSeverity,
  AuditIssue,
  AuditResult,
  DOMElement,
  DiffEntry,
  DiffResult,
} from "./types.js";
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: compiles, types exported

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add shared type definitions"
```

---

### Task 3: Config Loader

**Files:**
- Create: `packages/core/src/config/schema.ts`
- Create: `packages/core/src/config/loader.ts`
- Create: `packages/core/src/config/__tests__/loader.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/config/__tests__/loader.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/config/__tests__/loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema.ts**

`packages/core/src/config/schema.ts`:
```typescript
import type { ToleranceConfig } from "../types.js";

export const DEFAULT_TOLERANCE: Required<ToleranceConfig> = {
  size: 1,
  color: 1.0,
  fontSize: 0,
  lineHeight: 0.5,
};

export const DEFAULT_CACHE_DIR = ".figma-doctor/cache";
```

- [ ] **Step 4: Implement loader.ts**

`packages/core/src/config/loader.ts`:
```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FigmaDoctorConfig } from "../types.js";
import { DEFAULT_TOLERANCE, DEFAULT_CACHE_DIR } from "./schema.js";

const CONFIG_FILENAME = ".figma-doctor.json";

export function loadConfig(dir: string): FigmaDoctorConfig {
  const configPath = join(dir, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new Error(
      `.figma-doctor.json not found in ${dir}. Run 'figma-doctor init' to create one.`
    );
  }

  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  validate(raw);

  const config: FigmaDoctorConfig = {
    figma: {
      fileKey: raw.figma.fileKey,
      token: resolveEnvVar(raw.figma.token),
    },
    pages: raw.pages ?? {},
    diff: {
      tolerance: { ...DEFAULT_TOLERANCE, ...raw.diff?.tolerance },
    },
    cache: {
      dir: raw.cache?.dir ?? DEFAULT_CACHE_DIR,
    },
  };

  return config;
}

function resolveEnvVar(value: string): string {
  if (value.startsWith("$")) {
    const envName = value.slice(1);
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(
        `Environment variable ${envName} is not set. Set it or use a literal token.`
      );
    }
    return envValue;
  }
  return value;
}

function validate(raw: unknown): asserts raw is { figma: { fileKey: string; token: string } } {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Config must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.figma || typeof obj.figma !== "object") {
    throw new Error("Config must have a 'figma' section with fileKey and token");
  }
  const figma = obj.figma as Record<string, unknown>;
  if (typeof figma.fileKey !== "string" || typeof figma.token !== "string") {
    throw new Error("figma.fileKey and figma.token are required strings");
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/config/__tests__/loader.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 6: Export from index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { loadConfig } from "./config/loader.js";
export { DEFAULT_TOLERANCE, DEFAULT_CACHE_DIR } from "./config/schema.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config/ packages/core/src/index.ts
git commit -m "feat(core): add config loader with env var resolution and defaults"
```

---

### Task 4: Extract — Figma REST API Client

**Files:**
- Create: `packages/core/src/extract/client.ts`
- Create: `packages/core/src/extract/__tests__/client.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/extract/__tests__/client.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement client.ts**

`packages/core/src/extract/client.ts`:
```typescript
export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string;
}

export function parseFigmaUrl(url: string): FigmaUrlParts {
  const parsed = new URL(url);
  if (!parsed.hostname.includes("figma.com")) {
    throw new Error("Invalid Figma URL");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  // /design/:fileKey/branch/:branchKey/:fileName or /design/:fileKey/:fileName or /file/:fileKey/:fileName
  const typeIndex = segments.findIndex((s) => s === "design" || s === "file");
  if (typeIndex === -1 || segments.length < typeIndex + 2) {
    throw new Error("Invalid Figma URL: cannot extract fileKey");
  }

  let fileKey: string;
  const branchIndex = segments.indexOf("branch");
  if (branchIndex !== -1 && segments.length > branchIndex + 1) {
    fileKey = segments[branchIndex + 1];
  } else {
    fileKey = segments[typeIndex + 1];
  }

  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new Error("Invalid Figma URL: missing node-id parameter");
  }
  const nodeId = nodeIdParam.replace(/-/g, ":");

  return { fileKey, nodeId };
}

export interface RawFigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  style?: Record<string, unknown>;
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  constraints?: { vertical: string; horizontal: string };
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  strokeWeight?: number;
  strokeAlign?: string;
  blendMode?: string;
  opacity?: number;
  children?: RawFigmaNode[];
}

export async function fetchFigmaNode(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<RawFigmaNode> {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`;
  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const node = data.nodes?.[nodeId]?.document;
  if (!node) {
    throw new Error(`Node ${nodeId} not found in Figma file ${fileKey}`);
  }

  return node;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/client.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/extract/
git commit -m "feat(core): add Figma REST API client with URL parser"
```

---

### Task 5: Extract — Value Normalizer

**Files:**
- Create: `packages/core/src/extract/normalizer.ts`
- Create: `packages/core/src/extract/__tests__/normalizer.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/extract/__tests__/normalizer.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/normalizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement normalizer.ts**

`packages/core/src/extract/normalizer.ts`:
```typescript
import type { FigmaNode, NormalizedStyles } from "../types.js";
import type { RawFigmaNode } from "./client.js";

export function normalizeNode(raw: RawFigmaNode): FigmaNode {
  const styles = extractStyles(raw);
  const node: FigmaNode = {
    id: raw.id,
    name: raw.name,
    type: raw.type as FigmaNode["type"],
    styles,
  };

  if (raw.characters !== undefined) {
    node.characters = raw.characters;
  }

  if (raw.children?.length) {
    node.children = raw.children.map(normalizeNode);
  }

  return node;
}

function extractStyles(raw: RawFigmaNode): NormalizedStyles {
  const styles: NormalizedStyles = {};
  const bbox = raw.absoluteBoundingBox;

  // Dimensions
  if (bbox) {
    styles.width = px(bbox.width);
    styles.height = px(bbox.height);
  }

  // Padding
  if (raw.paddingTop !== undefined) styles.paddingTop = px(raw.paddingTop);
  if (raw.paddingRight !== undefined) styles.paddingRight = px(raw.paddingRight);
  if (raw.paddingBottom !== undefined) styles.paddingBottom = px(raw.paddingBottom);
  if (raw.paddingLeft !== undefined) styles.paddingLeft = px(raw.paddingLeft);

  // Gap
  if (raw.itemSpacing !== undefined) styles.gap = px(raw.itemSpacing);

  // Border radius
  if (raw.cornerRadius !== undefined) styles.borderRadius = px(raw.cornerRadius);

  // Typography (from style object)
  if (raw.style) {
    const s = raw.style as Record<string, unknown>;
    if (s.fontSize !== undefined) styles.fontSize = px(s.fontSize as number);
    if (s.fontWeight !== undefined) styles.fontWeight = String(s.fontWeight);
    if (s.fontFamily !== undefined) styles.fontFamily = s.fontFamily as string;
    if (s.letterSpacing !== undefined) styles.letterSpacing = px(s.letterSpacing as number);

    // lineHeight
    if (s.lineHeightUnit === "FONT_SIZE_%" && s.lineHeightPercentFontSize !== undefined) {
      styles.lineHeight = `${s.lineHeightPercentFontSize}%`;
    } else if (s.lineHeightPx !== undefined) {
      styles.lineHeight = px(s.lineHeightPx as number);
    }
  }

  // Colors (from fills)
  if (raw.fills?.length) {
    const fill = raw.fills[0] as { type: string; color?: FigmaColor };
    if (fill.type === "SOLID" && fill.color) {
      const colorStr = rgbString(fill.color);
      if (raw.type === "TEXT") {
        styles.color = colorStr;
      } else {
        styles.backgroundColor = colorStr;
      }
    }
  }

  // Border (from strokes)
  if (raw.strokes?.length && raw.strokeWeight) {
    const stroke = raw.strokes[0] as { type: string; color?: FigmaColor };
    styles.borderWidth = px(raw.strokeWeight);
    styles.borderStyle = "solid";
    if (stroke.type === "SOLID" && stroke.color) {
      styles.borderColor = rgbString(stroke.color);
    }
  }

  // Opacity
  if (raw.opacity !== undefined && raw.opacity !== 1) {
    styles.opacity = String(raw.opacity);
  }

  return styles;
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

function rgbString(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a !== undefined && color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/normalizer.test.ts`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/extract/normalizer.ts packages/core/src/extract/__tests__/normalizer.test.ts
git commit -m "feat(core): add Figma value normalizer (Figma units → CSS units)"
```

---

### Task 6: Extract — Cache

**Files:**
- Create: `packages/core/src/extract/cache.ts`
- Create: `packages/core/src/extract/__tests__/cache.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/extract/__tests__/cache.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/cache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cache.ts**

`packages/core/src/extract/cache.ts`:
```typescript
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class NodeCache {
  private nodesDir: string;

  constructor(cacheDir: string) {
    this.nodesDir = join(cacheDir, "nodes");
  }

  get(nodeId: string): unknown | null {
    const filePath = this.filePath(nodeId);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }

  set(nodeId: string, data: unknown): void {
    mkdirSync(this.nodesDir, { recursive: true });
    writeFileSync(this.filePath(nodeId), JSON.stringify(data, null, 2));
  }

  clear(nodeId: string): void {
    const filePath = this.filePath(nodeId);
    if (existsSync(filePath)) rmSync(filePath);
  }

  clearAll(): void {
    if (existsSync(this.nodesDir)) {
      rmSync(this.nodesDir, { recursive: true, force: true });
    }
  }

  private filePath(nodeId: string): string {
    const safeName = nodeId.replace(/:/g, "-");
    return join(this.nodesDir, `${safeName}.json`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/extract/__tests__/cache.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/extract/cache.ts packages/core/src/extract/__tests__/cache.test.ts
git commit -m "feat(core): add node cache with JSON file storage"
```

---

### Task 7: Extract — Module Integration

**Files:**
- Create: `packages/core/src/extract/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Implement extract/index.ts**

`packages/core/src/extract/index.ts`:
```typescript
import type { FigmaNode } from "../types.js";
import { fetchFigmaNode, parseFigmaUrl } from "./client.js";
import { normalizeNode } from "./normalizer.js";
import { NodeCache } from "./cache.js";

export interface ExtractOptions {
  figmaUrl?: string;
  fileKey?: string;
  nodeId?: string;
  token: string;
  cacheDir?: string;
  refresh?: boolean;
}

export interface ExtractResult {
  nodes: FigmaNode[];
  count: number;
}

export async function extract(options: ExtractOptions): Promise<ExtractResult> {
  let fileKey: string;
  let nodeId: string;

  if (options.figmaUrl) {
    const parsed = parseFigmaUrl(options.figmaUrl);
    fileKey = parsed.fileKey;
    nodeId = parsed.nodeId;
  } else if (options.fileKey && options.nodeId) {
    fileKey = options.fileKey;
    nodeId = options.nodeId;
  } else {
    throw new Error("Provide either figmaUrl or both fileKey and nodeId");
  }

  const cache = options.cacheDir ? new NodeCache(options.cacheDir) : null;

  // Check cache
  if (cache && !options.refresh) {
    const cached = cache.get(nodeId);
    if (cached) {
      const node = normalizeNode(cached as any);
      const nodes = flattenNodes(node);
      return { nodes, count: nodes.length };
    }
  }

  // Fetch from API
  const raw = await fetchFigmaNode(fileKey, nodeId, options.token);

  // Cache the raw response
  if (cache) {
    cache.set(nodeId, raw);
  }

  const node = normalizeNode(raw);
  const nodes = flattenNodes(node);
  return { nodes, count: nodes.length };
}

function flattenNodes(node: FigmaNode): FigmaNode[] {
  const result: FigmaNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenNodes(child));
    }
  }
  return result;
}

export { parseFigmaUrl } from "./client.js";
export { NodeCache } from "./cache.js";
```

- [ ] **Step 2: Export from core index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { extract, parseFigmaUrl, NodeCache } from "./extract/index.js";
export type { ExtractOptions, ExtractResult } from "./extract/index.js";
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: compiles without errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/extract/index.ts packages/core/src/index.ts
git commit -m "feat(core): add extract module (client + normalizer + cache integration)"
```

---

### Task 8: Audit — Lookup Table + Runner

**Files:**
- Create: `packages/core/src/audit/rules.ts`
- Create: `packages/core/src/audit/index.ts`
- Create: `packages/core/src/audit/__tests__/audit.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/audit/__tests__/audit.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { auditNode } from "../index.js";
import type { RawFigmaNode } from "../../extract/client.js";

describe("auditNode", () => {
  it("detects OUTSIDE stroke alignment", () => {
    const node: RawFigmaNode = {
      id: "1:1",
      name: "Card",
      type: "FRAME",
      strokeAlign: "OUTSIDE",
      strokeWeight: 2,
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
      id: "1:2",
      name: "Overlay",
      type: "FRAME",
      blendMode: "LINEAR_BURN",
    };

    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].property).toBe("blendMode");
  });

  it("detects leadingTrim CAP_HEIGHT", () => {
    const node: RawFigmaNode = {
      id: "1:3",
      name: "Text",
      type: "TEXT",
      characters: "Hello",
      style: { leadingTrim: "CAP_HEIGHT" },
    };

    const result = auditNode(node);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("warning");
  });

  it("passes clean node", () => {
    const node: RawFigmaNode = {
      id: "1:4",
      name: "Clean",
      type: "FRAME",
      strokeAlign: "INSIDE",
      blendMode: "NORMAL",
    };

    const result = auditNode(node);
    expect(result.issues).toHaveLength(0);
    expect(result.pass).toBe(true);
  });

  it("audits children recursively", () => {
    const node: RawFigmaNode = {
      id: "1:5",
      name: "Parent",
      type: "FRAME",
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
      id: "1:7",
      name: "Mixed",
      type: "FRAME",
      strokeAlign: "OUTSIDE",
      strokeWeight: 1,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/audit/__tests__/audit.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rules.ts**

`packages/core/src/audit/rules.ts`:
```typescript
import type { AuditSeverity } from "../types.js";

export interface AuditRule {
  property: string;
  test: (node: Record<string, unknown>) => { match: boolean; value: string } | null;
  severity: AuditSeverity;
  reason: string;
  suggestion: string;
}

const UNSUPPORTED_BLEND_MODES = new Set([
  "LINEAR_BURN",
  "LINEAR_DODGE",
]);

export const AUDIT_RULES: AuditRule[] = [
  {
    property: "strokeAlign",
    test: (node) => {
      if (node.strokeAlign === "OUTSIDE" && node.strokeWeight) {
        return { match: true, value: `OUTSIDE (weight: ${node.strokeWeight})` };
      }
      return null;
    },
    severity: "error",
    reason: "CSS border only supports inside rendering. Outside strokes cannot be replicated with border.",
    suggestion: "Change stroke alignment to INSIDE or CENTER, or use box-shadow/outline as CSS workaround.",
  },
  {
    property: "blendMode",
    test: (node) => {
      const mode = node.blendMode as string | undefined;
      if (mode && UNSUPPORTED_BLEND_MODES.has(mode)) {
        return { match: true, value: mode };
      }
      return null;
    },
    severity: "error",
    reason: "CSS mix-blend-mode does not support this blend mode.",
    suggestion: "Use a supported blend mode (multiply, screen, overlay, etc.) or flatten the layer.",
  },
  {
    property: "leadingTrim",
    test: (node) => {
      const style = node.style as Record<string, unknown> | undefined;
      if (style?.leadingTrim === "CAP_HEIGHT") {
        return { match: true, value: "CAP_HEIGHT" };
      }
      return null;
    },
    severity: "warning",
    reason: "Maps to CSS text-box-trim which is not supported in Firefox.",
    suggestion: "Consider removing leading trim or providing a fallback.",
  },
  {
    property: "textAutoResize",
    test: (node) => {
      if (node.textAutoResize === "TRUNCATE") {
        return { match: true, value: "TRUNCATE" };
      }
      return null;
    },
    severity: "warning",
    reason: "Requires CSS text-overflow: ellipsis + overflow: hidden approximation.",
    suggestion: "Ensure the implementation includes overflow: hidden and text-overflow: ellipsis.",
  },
  {
    property: "constraints",
    test: (node) => {
      const constraints = node.constraints as { horizontal?: string; vertical?: string } | undefined;
      if (constraints) {
        const problematic = ["SCALE", "CENTER"].filter(
          (c) => constraints.horizontal === c || constraints.vertical === c
        );
        if (problematic.length > 0) {
          return { match: true, value: problematic.join(", ") };
        }
      }
      return null;
    },
    severity: "warning",
    reason: "SCALE and CENTER constraints behave differently from CSS position: absolute fixed coordinates.",
    suggestion: "Use CSS flexbox/grid centering or responsive units instead of absolute positioning.",
  },
];
```

- [ ] **Step 4: Implement audit/index.ts**

`packages/core/src/audit/index.ts`:
```typescript
import type { AuditIssue, AuditResult, AuditSeverity } from "../types.js";
import type { RawFigmaNode } from "../extract/client.js";
import { AUDIT_RULES } from "./rules.js";

export interface AuditOptions {
  severity?: AuditSeverity;
}

export function auditNode(node: RawFigmaNode, options?: AuditOptions): AuditResult {
  const allIssues: AuditIssue[] = [];
  collectIssues(node, allIssues);

  const filtered = options?.severity
    ? allIssues.filter((i) => i.severity === options.severity)
    : allIssues;

  const errors = allIssues.filter((i) => i.severity === "error").length;
  const warnings = allIssues.filter((i) => i.severity === "warning").length;

  return {
    issues: filtered,
    summary: { errors, warnings },
    pass: errors === 0,
  };
}

function collectIssues(node: RawFigmaNode, issues: AuditIssue[]): void {
  const nodeRecord = node as unknown as Record<string, unknown>;

  for (const rule of AUDIT_RULES) {
    const result = rule.test(nodeRecord);
    if (result?.match) {
      issues.push({
        nodeId: node.id,
        nodeName: node.name,
        property: rule.property,
        value: result.value,
        severity: rule.severity,
        reason: rule.reason,
        suggestion: rule.suggestion,
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectIssues(child, issues);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/audit/__tests__/audit.test.ts`
Expected: all 6 tests PASS

- [ ] **Step 6: Export from core index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { auditNode } from "./audit/index.js";
export { AUDIT_RULES } from "./audit/rules.js";
export type { AuditOptions } from "./audit/index.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/audit/ packages/core/src/index.ts
git commit -m "feat(core): add audit module with CSS compatibility lookup table"
```

---

### Task 9: Measure — Browser + getComputedStyle

**Files:**
- Create: `packages/core/src/measure/browser.ts`
- Create: `packages/core/src/measure/styles.ts`
- Create: `packages/core/src/measure/__tests__/styles.test.ts`

- [ ] **Step 1: Implement browser.ts**

`packages/core/src/measure/browser.ts`:
```typescript
import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function openPage(url: string): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

- [ ] **Step 2: Implement styles.ts**

`packages/core/src/measure/styles.ts`:
```typescript
import type { Page } from "playwright";
import type { NormalizedStyles } from "../types.js";

const MEASURED_PROPERTIES: (keyof NormalizedStyles)[] = [
  "width",
  "height",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "color",
  "backgroundColor",
  "borderWidth",
  "borderColor",
  "borderRadius",
  "borderStyle",
  "opacity",
  "gap",
];

// CSS property name mapping: camelCase → kebab-case
const CSS_PROPERTY_MAP: Record<string, string> = {
  paddingTop: "padding-top",
  paddingRight: "padding-right",
  paddingBottom: "padding-bottom",
  paddingLeft: "padding-left",
  fontSize: "font-size",
  fontWeight: "font-weight",
  fontFamily: "font-family",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  backgroundColor: "background-color",
  borderWidth: "border-top-width",
  borderColor: "border-top-color",
  borderRadius: "border-top-left-radius",
  borderStyle: "border-top-style",
};

export async function getComputedStyles(
  page: Page,
  selector: string
): Promise<NormalizedStyles> {
  const properties = MEASURED_PROPERTIES.map(
    (prop) => CSS_PROPERTY_MAP[prop] ?? prop
  );

  const values = await page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      const result: Record<string, string> = {};
      const rect = el.getBoundingClientRect();
      result["width"] = `${rect.width}px`;
      result["height"] = `${rect.height}px`;
      for (const prop of props) {
        if (prop !== "width" && prop !== "height") {
          result[prop] = computed.getPropertyValue(prop);
        }
      }
      return result;
    },
    { sel: selector, props: properties }
  );

  if (!values) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Map back to NormalizedStyles
  const styles: NormalizedStyles = {};
  for (const prop of MEASURED_PROPERTIES) {
    const cssKey = CSS_PROPERTY_MAP[prop] ?? prop;
    const value = values[cssKey];
    if (value !== undefined && value !== "") {
      styles[prop] = value;
    }
  }

  return styles;
}
```

- [ ] **Step 3: Write unit test for CSS property mapping**

`packages/core/src/measure/__tests__/styles.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

// Test the property mapping logic without Playwright (unit test)
describe("CSS property mapping", () => {
  const CSS_PROPERTY_MAP: Record<string, string> = {
    paddingTop: "padding-top",
    paddingRight: "padding-right",
    paddingBottom: "padding-bottom",
    paddingLeft: "padding-left",
    fontSize: "font-size",
    fontWeight: "font-weight",
    fontFamily: "font-family",
    lineHeight: "line-height",
    letterSpacing: "letter-spacing",
    backgroundColor: "background-color",
    borderWidth: "border-top-width",
    borderColor: "border-top-color",
    borderRadius: "border-top-left-radius",
    borderStyle: "border-top-style",
  };

  it("maps borderWidth to border-top-width (not shorthand)", () => {
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
```

- [ ] **Step 4: Run test**

Run: `cd packages/core && pnpm test -- src/measure/__tests__/styles.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/measure/browser.ts packages/core/src/measure/styles.ts packages/core/src/measure/__tests__/
git commit -m "feat(core): add browser manager and getComputedStyle measurement"
```

---

### Task 10: Measure — Element Matcher

**Files:**
- Create: `packages/core/src/measure/matcher.ts`
- Create: `packages/core/src/measure/__tests__/matcher.test.ts`
- Create: `packages/core/src/measure/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/measure/__tests__/matcher.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildSelectors } from "../matcher.js";
import type { FigmaNode } from "../../types.js";

describe("buildSelectors", () => {
  it("builds selector for TEXT node using textContent", () => {
    const nodes: FigmaNode[] = [
      {
        id: "1:1",
        name: "Title",
        type: "TEXT",
        characters: "로그인",
        styles: { fontSize: "32px" },
      },
    ];

    const selectors = buildSelectors(nodes);
    expect(selectors).toHaveLength(1);
    expect(selectors[0].nodeId).toBe("1:1");
    expect(selectors[0].strategy).toBe("text");
    expect(selectors[0].textContent).toBe("로그인");
  });

  it("skips nodes without measurable styles", () => {
    const nodes: FigmaNode[] = [
      {
        id: "1:2",
        name: "Empty Group",
        type: "GROUP",
        styles: {},
      },
    ];

    const selectors = buildSelectors(nodes);
    expect(selectors).toHaveLength(0);
  });

  it("handles FRAME nodes with structural matching", () => {
    const nodes: FigmaNode[] = [
      {
        id: "1:3",
        name: "Card",
        type: "FRAME",
        styles: { width: "320px", height: "280px", backgroundColor: "rgb(255, 255, 255)" },
      },
    ];

    const selectors = buildSelectors(nodes);
    expect(selectors).toHaveLength(1);
    expect(selectors[0].strategy).toBe("structural");
  });

  it("deduplicates text content matches", () => {
    const nodes: FigmaNode[] = [
      { id: "1:4", name: "Label 1", type: "TEXT", characters: "확인", styles: { fontSize: "14px" } },
      { id: "1:5", name: "Label 2", type: "TEXT", characters: "확인", styles: { fontSize: "14px" } },
    ];

    const selectors = buildSelectors(nodes);
    // Both should still be returned, but marked as ambiguous
    const ambiguous = selectors.filter((s) => s.ambiguous);
    expect(ambiguous).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/measure/__tests__/matcher.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement matcher.ts**

`packages/core/src/measure/matcher.ts`:
```typescript
import type { FigmaNode, NormalizedStyles } from "../types.js";

export interface SelectorEntry {
  nodeId: string;
  nodeName: string;
  strategy: "text" | "structural";
  textContent?: string;
  ambiguous: boolean;
}

export function buildSelectors(nodes: FigmaNode[]): SelectorEntry[] {
  const entries: SelectorEntry[] = [];

  for (const node of nodes) {
    if (!hasMeasurableStyles(node.styles)) continue;

    if (node.type === "TEXT" && node.characters) {
      entries.push({
        nodeId: node.id,
        nodeName: node.name,
        strategy: "text",
        textContent: node.characters,
        ambiguous: false,
      });
    } else if (hasMeasurableStyles(node.styles)) {
      entries.push({
        nodeId: node.id,
        nodeName: node.name,
        strategy: "structural",
        ambiguous: false,
      });
    }
  }

  // Mark duplicate textContent as ambiguous
  const textCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.textContent) {
      textCounts.set(entry.textContent, (textCounts.get(entry.textContent) ?? 0) + 1);
    }
  }
  for (const entry of entries) {
    if (entry.textContent && (textCounts.get(entry.textContent) ?? 0) > 1) {
      entry.ambiguous = true;
    }
  }

  return entries;
}

function hasMeasurableStyles(styles: NormalizedStyles): boolean {
  return Object.keys(styles).length > 0;
}

/**
 * Playwright에서 textContent로 DOM 요소를 찾기 위한 XPath 생성
 */
export function textXPath(text: string): string {
  return `//*[normalize-space(text())="${text}"]`;
}
```

- [ ] **Step 4: Implement measure/index.ts**

`packages/core/src/measure/index.ts`:
```typescript
import type { FigmaNode, DOMElement } from "../types.js";
import { openPage, closeBrowser } from "./browser.js";
import { buildSelectors, textXPath, type SelectorEntry } from "./matcher.js";
import { getComputedStyles } from "./styles.js";

export interface MeasureOptions {
  url: string;
  nodes: FigmaNode[];
}

export interface MeasureResult {
  elements: DOMElement[];
  matched: number;
  total: number;
}

export async function measure(options: MeasureOptions): Promise<MeasureResult> {
  const selectors = buildSelectors(options.nodes);
  const page = await openPage(options.url);

  const elements: DOMElement[] = [];

  try {
    for (const entry of selectors) {
      try {
        const domElement = await measureEntry(page, entry);
        if (domElement) {
          elements.push(domElement);
        }
      } catch {
        // Element not found in DOM — skip
      }
    }
  } finally {
    await page.close();
    await closeBrowser();
  }

  return {
    elements,
    matched: elements.length,
    total: selectors.length,
  };
}

async function measureEntry(
  page: import("playwright").Page,
  entry: SelectorEntry
): Promise<DOMElement | null> {
  let selector: string;

  if (entry.strategy === "text" && entry.textContent) {
    // Use XPath for text matching
    const xpath = textXPath(entry.textContent);
    const locator = page.locator(`xpath=${xpath}`).first();
    const count = await locator.count();
    if (count === 0) return null;

    // Get a CSS selector for the matched element
    selector = await locator.evaluate((el) => {
      // Generate a unique selector
      const path: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        let seg = current.tagName.toLowerCase();
        if (current.id) {
          seg = `#${current.id}`;
          path.unshift(seg);
          break;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            seg += `:nth-of-type(${index})`;
          }
        }
        path.unshift(seg);
        current = parent;
      }
      return path.join(" > ");
    });

    const styles = await getComputedStyles(page, selector);
    return {
      selector,
      textContent: entry.textContent,
      computedStyles: styles,
      matchedFigmaNodeId: entry.nodeId,
    };
  }

  // Structural matching — skip for MVP (text matching covers most cases)
  return null;
}

export { closeBrowser } from "./browser.js";
```

- [ ] **Step 5: Run matcher tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/measure/__tests__/matcher.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 6: Export from core index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { measure, closeBrowser } from "./measure/index.js";
export type { MeasureOptions, MeasureResult } from "./measure/index.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/measure/ packages/core/src/index.ts
git commit -m "feat(core): add measure module with text-based DOM matching"
```

---

### Task 11: Diff — Comparator

**Files:**
- Create: `packages/core/src/diff/comparator.ts`
- Create: `packages/core/src/diff/index.ts`
- Create: `packages/core/src/diff/__tests__/comparator.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/diff/__tests__/comparator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { compareValues, comparePx, compareColor } from "../comparator.js";
import type { ToleranceConfig } from "../../types.js";

const defaultTolerance: Required<ToleranceConfig> = {
  size: 1,
  color: 1.0,
  fontSize: 0,
  lineHeight: 0.5,
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
    const result = compareColor("rgb(255, 0, 0)", "rgb(255, 0, 0)", 1.0);
    expect(result.pass).toBe(true);
  });

  it("passes for perceptually similar colors", () => {
    // Very slight difference — ΔE < 1
    const result = compareColor("rgb(255, 0, 0)", "rgb(254, 0, 0)", 1.0);
    expect(result.pass).toBe(true);
  });

  it("fails for noticeably different colors", () => {
    const result = compareColor("rgb(255, 0, 0)", "rgb(200, 0, 0)", 1.0);
    expect(result.pass).toBe(false);
  });
});

describe("compareValues", () => {
  it("compares fontSize with zero tolerance", () => {
    const result = compareValues("fontSize", "16px", "16px", defaultTolerance);
    expect(result.pass).toBe(true);
  });

  it("fails fontSize with any difference", () => {
    const result = compareValues("fontSize", "16px", "16.5px", defaultTolerance);
    expect(result.pass).toBe(false);
  });

  it("compares lineHeight with 0.5px tolerance", () => {
    const result = compareValues("lineHeight", "24px", "24.3px", defaultTolerance);
    expect(result.pass).toBe(true);
  });

  it("compares width with 1px tolerance", () => {
    const result = compareValues("width", "320px", "320.8px", defaultTolerance);
    expect(result.pass).toBe(true);
  });

  it("compares color with ΔE tolerance", () => {
    const result = compareValues("color", "rgb(26, 26, 26)", "rgb(26, 26, 26)", defaultTolerance);
    expect(result.pass).toBe(true);
  });

  it("compares fontWeight as string equality", () => {
    const result = compareValues("fontWeight", "700", "700", defaultTolerance);
    expect(result.pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test -- src/diff/__tests__/comparator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement comparator.ts**

`packages/core/src/diff/comparator.ts`:
```typescript
import type { ToleranceConfig } from "../types.js";

export interface CompareResult {
  pass: boolean;
  delta: number | null;
}

const SIZE_PROPERTIES = new Set([
  "width", "height",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "gap", "borderWidth", "borderRadius",
]);

const COLOR_PROPERTIES = new Set([
  "color", "backgroundColor", "borderColor",
]);

const STRING_PROPERTIES = new Set([
  "fontWeight", "fontFamily", "borderStyle", "opacity",
]);

export function compareValues(
  property: string,
  expected: string,
  actual: string,
  tolerance: Required<ToleranceConfig>
): CompareResult {
  if (property === "fontSize") {
    return comparePx(expected, actual, tolerance.fontSize);
  }
  if (property === "lineHeight") {
    return comparePx(expected, actual, tolerance.lineHeight);
  }
  if (SIZE_PROPERTIES.has(property)) {
    return comparePx(expected, actual, tolerance.size);
  }
  if (COLOR_PROPERTIES.has(property)) {
    return compareColor(expected, actual, tolerance.color);
  }
  // String equality for fontWeight, fontFamily, etc.
  return { pass: expected === actual, delta: null };
}

export function comparePx(expected: string, actual: string, tolerance: number): CompareResult {
  const exp = parsePx(expected);
  const act = parsePx(actual);
  if (exp === null || act === null) {
    return { pass: expected === actual, delta: null };
  }
  const delta = Math.abs(act - exp);
  return { pass: delta <= tolerance, delta: Math.round(delta * 100) / 100 };
}

export function compareColor(expected: string, actual: string, maxDeltaE: number): CompareResult {
  const expRgb = parseRgb(expected);
  const actRgb = parseRgb(actual);
  if (!expRgb || !actRgb) {
    return { pass: expected === actual, delta: null };
  }
  const deltaE = ciede76(expRgb, actRgb);
  return { pass: deltaE <= maxDeltaE, delta: Math.round(deltaE * 100) / 100 };
}

function parsePx(value: string): number | null {
  // Handle percentage lineHeight
  if (value.endsWith("%")) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

function parseRgb(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/**
 * CIE76 ΔE — simple Euclidean distance in Lab space.
 * Good enough for checking perceptual similarity.
 */
function ciede76(a: [number, number, number], b: [number, number, number]): number {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  return Math.sqrt(
    (labA[0] - labB[0]) ** 2 +
    (labA[1] - labB[1]) ** 2 +
    (labA[2] - labB[2]) ** 2
  );
}

function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  // RGB → XYZ → Lab
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
```

- [ ] **Step 4: Implement diff/index.ts**

`packages/core/src/diff/index.ts`:
```typescript
import type { FigmaNode, DOMElement, DiffEntry, DiffResult, ToleranceConfig, NormalizedStyles } from "../types.js";
import { compareValues } from "./comparator.js";
import { DEFAULT_TOLERANCE } from "../config/schema.js";

export interface DiffOptions {
  nodes: FigmaNode[];
  elements: DOMElement[];
  tolerance?: ToleranceConfig;
}

export function diff(options: DiffOptions): DiffResult {
  const tolerance: Required<ToleranceConfig> = {
    ...DEFAULT_TOLERANCE,
    ...options.tolerance,
  };

  const results: DiffEntry[] = [];

  for (const element of options.elements) {
    if (!element.matchedFigmaNodeId) continue;

    const node = options.nodes.find((n) => n.id === element.matchedFigmaNodeId);
    if (!node) continue;

    const properties = Object.keys(node.styles) as (keyof NormalizedStyles)[];
    for (const prop of properties) {
      const expected = node.styles[prop];
      const actual = element.computedStyles[prop];
      if (!expected || !actual) continue;

      const { pass, delta } = compareValues(prop, expected, actual, tolerance);

      results.push({
        nodeId: node.id,
        nodeName: node.name,
        selector: element.selector,
        property: prop,
        expected,
        actual,
        delta,
        pass,
      });
    }
  }

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.filter((r) => !r.pass).length;

  return {
    results,
    summary: { total: results.length, pass: passCount, fail: failCount },
    pass: failCount === 0,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && pnpm test -- src/diff/__tests__/comparator.test.ts`
Expected: all 10 tests PASS

- [ ] **Step 6: Export from core index.ts**

`packages/core/src/index.ts`에 추가:
```typescript
export { diff } from "./diff/index.js";
export type { DiffOptions } from "./diff/index.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/diff/ packages/core/src/index.ts
git commit -m "feat(core): add diff module with tolerance-based value comparison"
```

---

### Task 12: CLI — Formatters

**Files:**
- Create: `packages/cli/src/formatters/table.ts`
- Create: `packages/cli/src/formatters/json.ts`
- Create: `packages/cli/src/__tests__/formatters.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/cli/src/__tests__/formatters.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { formatDiffTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import type { DiffResult, AuditResult } from "@figma-doctor/core";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && pnpm test -- src/__tests__/formatters.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement table.ts**

`packages/cli/src/formatters/table.ts`:
```typescript
import type { DiffResult, AuditResult } from "@figma-doctor/core";

interface DiffMeta {
  page: string;
  nodeId: string;
  url: string;
}

export function formatDiffTable(result: DiffResult, meta: DiffMeta): string {
  const lines: string[] = [];

  lines.push(`figma-doctor · Figma vs Browser diff for ${meta.page}`);
  lines.push(`Figma node: ${meta.nodeId} → ${meta.url}`);
  lines.push("");

  // Header
  const cols = ["Element", "Property", "Figma", "Browser", "Delta", "Status"];
  const widths = [20, 15, 12, 12, 10, 8];
  lines.push(cols.map((c, i) => c.padEnd(widths[i])).join(""));
  lines.push("-".repeat(widths.reduce((a, b) => a + b, 0)));

  // Rows
  for (const r of result.results) {
    const element = r.nodeName.length > 18 ? r.nodeName.slice(0, 18) + "…" : r.nodeName;
    const deltaStr = r.delta !== null ? (r.delta === 0 ? "0" : `${r.delta > 0 ? "+" : ""}${r.delta}px`) : "-";
    const status = r.pass ? "✓ pass" : "✗ FAIL";

    lines.push([
      element.padEnd(widths[0]),
      r.property.padEnd(widths[1]),
      r.expected.padEnd(widths[2]),
      r.actual.padEnd(widths[3]),
      deltaStr.padEnd(widths[4]),
      status,
    ].join(""));
  }

  lines.push("");
  if (result.pass) {
    lines.push(`PASS — all ${result.summary.total} checks passed`);
  } else {
    lines.push(`FAIL — ${result.summary.fail} of ${result.summary.total} checks have mismatches`);
  }

  return lines.join("\n");
}

export function formatAuditTable(result: AuditResult, nodeId: string): string {
  const lines: string[] = [];

  lines.push(`figma-doctor · Audit for node ${nodeId}`);
  lines.push(`Found ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
  lines.push("");

  if (result.issues.length === 0) {
    lines.push("No issues found.");
    return lines.join("\n");
  }

  const cols = ["Node", "Property", "Value", "Severity", "Reason"];
  const widths = [15, 15, 25, 10, 40];
  lines.push(cols.map((c, i) => c.padEnd(widths[i])).join(""));
  lines.push("-".repeat(widths.reduce((a, b) => a + b, 0)));

  for (const issue of result.issues) {
    lines.push([
      issue.nodeName.slice(0, 13).padEnd(widths[0]),
      issue.property.padEnd(widths[1]),
      issue.value.slice(0, 23).padEnd(widths[2]),
      issue.severity.padEnd(widths[3]),
      issue.reason.slice(0, 38),
    ].join(""));
  }

  lines.push("");
  lines.push(result.pass ? "PASS — no errors (warnings only)" : `FAIL — ${result.summary.errors} error(s) found`);

  return lines.join("\n");
}
```

- [ ] **Step 4: Implement json.ts**

`packages/cli/src/formatters/json.ts`:
```typescript
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test -- src/__tests__/formatters.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/formatters/ packages/cli/src/__tests__/
git commit -m "feat(cli): add table and JSON formatters"
```

---

### Task 13: CLI — Commands

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/audit.ts`
- Create: `packages/cli/src/commands/diff.ts`
- Create: `packages/cli/src/commands/extract.ts`
- Create: `packages/cli/src/commands/cache.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Implement init.ts**

`packages/cli/src/commands/init.ts`:
```typescript
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const CONFIG_FILENAME = ".figma-doctor.json";

export async function initCommand(): Promise<void> {
  const configPath = join(process.cwd(), CONFIG_FILENAME);

  if (existsSync(configPath)) {
    console.log(`${CONFIG_FILENAME} already exists. Delete it first to re-initialize.`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log("figma-doctor init\n");

  const fileKey = await ask("Figma file key (from URL): ");
  const tokenSource = await ask("Figma token (or env var name like $FIGMA_TOKEN): ");
  const pageName = await ask("First page name (e.g., login): ");
  const nodeId = await ask(`Figma node ID for "${pageName}" (e.g., 2784:11151): `);
  const pageUrl = await ask(`Local URL for "${pageName}" (e.g., http://localhost:3000/login): `);

  rl.close();

  const config = {
    figma: {
      fileKey,
      token: tokenSource,
    },
    pages: {
      [pageName]: {
        figmaNodeId: nodeId,
        url: pageUrl,
      },
    },
    diff: {
      tolerance: {
        size: 1,
        color: 1.0,
        fontSize: 0,
        lineHeight: 0.5,
      },
    },
    cache: {
      dir: ".figma-doctor/cache",
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n✓ Created ${CONFIG_FILENAME}`);
  console.log("Add .figma-doctor/ to your .gitignore");
}
```

- [ ] **Step 2: Implement audit.ts**

`packages/cli/src/commands/audit.ts`:
```typescript
import { parseFigmaUrl, loadConfig } from "@figma-doctor/core";
import { auditNode } from "@figma-doctor/core";
import { fetchFigmaNode } from "@figma-doctor/core";
import { formatAuditTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import type { AuditSeverity } from "@figma-doctor/core";

interface AuditCommandOptions {
  format?: "table" | "json";
  severity?: AuditSeverity;
}

export async function auditCommand(figmaUrl: string, options: AuditCommandOptions): Promise<void> {
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  // Try loading config for token, fallback to env var
  let token: string;
  try {
    const config = loadConfig(process.cwd());
    token = config.figma.token;
  } catch {
    token = process.env.FIGMA_TOKEN ?? "";
    if (!token) {
      console.error("Error: FIGMA_TOKEN environment variable not set and no .figma-doctor.json found.");
      process.exit(1);
    }
  }

  const raw = await fetchFigmaNode(fileKey, nodeId, token);
  const result = auditNode(raw, { severity: options.severity });

  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    console.log(formatAuditTable(result, nodeId));
  }

  process.exit(result.pass ? 0 : 1);
}
```

- [ ] **Step 3: Implement diff.ts**

`packages/cli/src/commands/diff.ts`:
```typescript
import { loadConfig, extract, measure, diff } from "@figma-doctor/core";
import { formatDiffTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";

interface DiffCommandOptions {
  figmaUrl?: string;
  pageUrl?: string;
  format?: "table" | "json";
  refresh?: boolean;
  tolerance?: number;
}

export async function diffCommand(pageOrUrl: string, options: DiffCommandOptions): Promise<void> {
  let figmaNodeId: string;
  let url: string;
  let pageName: string;
  let token: string;
  let cacheDir: string;
  let fileKey: string;
  let toleranceConfig = {};

  if (options.figmaUrl && options.pageUrl) {
    // Direct URL mode
    const { parseFigmaUrl } = await import("@figma-doctor/core");
    const parsed = parseFigmaUrl(options.figmaUrl);
    figmaNodeId = parsed.nodeId;
    fileKey = parsed.fileKey;
    url = options.pageUrl;
    pageName = "direct";
    token = process.env.FIGMA_TOKEN ?? "";
    cacheDir = ".figma-doctor/cache";
  } else {
    // Config-based mode
    const config = loadConfig(process.cwd());
    const page = config.pages[pageOrUrl];
    if (!page) {
      console.error(`Page "${pageOrUrl}" not found in .figma-doctor.json`);
      console.error(`Available pages: ${Object.keys(config.pages).join(", ") || "(none)"}`);
      process.exit(1);
    }
    figmaNodeId = page.figmaNodeId;
    url = page.url;
    pageName = pageOrUrl;
    token = config.figma.token;
    fileKey = config.figma.fileKey;
    cacheDir = config.cache?.dir ?? ".figma-doctor/cache";
    toleranceConfig = config.diff?.tolerance ?? {};
  }

  if (options.tolerance !== undefined) {
    toleranceConfig = { ...toleranceConfig, size: options.tolerance };
  }

  // 1. Extract Figma values
  console.log(`Extracting Figma node ${figmaNodeId}...`);
  const extracted = await extract({
    fileKey,
    nodeId: figmaNodeId,
    token,
    cacheDir,
    refresh: options.refresh,
  });
  console.log(`Extracted ${extracted.count} nodes`);

  // 2. Measure browser values
  console.log(`Measuring ${url}...`);
  const measured = await measure({ url, nodes: extracted.nodes });
  console.log(`Matched ${measured.matched} of ${measured.total} elements`);

  // 3. Diff
  const result = diff({
    nodes: extracted.nodes,
    elements: measured.elements,
    tolerance: toleranceConfig,
  });

  // 4. Output
  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    console.log(formatDiffTable(result, { page: pageName, nodeId: figmaNodeId, url }));
  }

  process.exit(result.pass ? 0 : 1);
}
```

- [ ] **Step 4: Implement extract.ts**

`packages/cli/src/commands/extract.ts`:
```typescript
import { parseFigmaUrl, extract, loadConfig } from "@figma-doctor/core";
import { formatJson } from "../formatters/json.js";

interface ExtractCommandOptions {
  format?: "table" | "json";
  refresh?: boolean;
}

export async function extractCommand(figmaUrl: string, options: ExtractCommandOptions): Promise<void> {
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  let token: string;
  let cacheDir = ".figma-doctor/cache";
  try {
    const config = loadConfig(process.cwd());
    token = config.figma.token;
    cacheDir = config.cache?.dir ?? cacheDir;
  } catch {
    token = process.env.FIGMA_TOKEN ?? "";
    if (!token) {
      console.error("Error: FIGMA_TOKEN not set and no .figma-doctor.json found.");
      process.exit(1);
    }
  }

  const result = await extract({
    fileKey,
    nodeId,
    token,
    cacheDir,
    refresh: options.refresh,
  });

  if (options.format === "json") {
    console.log(formatJson(result));
  } else {
    console.log(`Extracted ${result.count} nodes from ${nodeId}\n`);
    for (const node of result.nodes) {
      const label = node.characters ? `${node.type} "${node.characters}"` : `${node.type} ${node.name}`;
      console.log(`  ${node.id} ${label}`);
      for (const [key, value] of Object.entries(node.styles)) {
        if (value) console.log(`    ${key}: ${value}`);
      }
    }
  }
}
```

- [ ] **Step 5: Implement cache.ts**

`packages/cli/src/commands/cache.ts`:
```typescript
import { NodeCache, loadConfig } from "@figma-doctor/core";

export function cacheCommand(action: string, pageName?: string): void {
  if (action !== "clear") {
    console.error(`Unknown cache action: ${action}. Use "clear".`);
    process.exit(1);
  }

  let cacheDir = ".figma-doctor/cache";
  try {
    const config = loadConfig(process.cwd());
    cacheDir = config.cache?.dir ?? cacheDir;
  } catch {
    // Use default
  }

  const cache = new NodeCache(cacheDir);

  if (pageName) {
    try {
      const config = loadConfig(process.cwd());
      const page = config.pages[pageName];
      if (page) {
        cache.clear(page.figmaNodeId);
        console.log(`✓ Cleared cache for "${pageName}" (${page.figmaNodeId})`);
      } else {
        console.error(`Page "${pageName}" not found in config.`);
        process.exit(1);
      }
    } catch {
      console.error("Cannot clear by page name without .figma-doctor.json");
      process.exit(1);
    }
  } else {
    cache.clearAll();
    console.log("✓ Cleared all cache");
  }
}
```

- [ ] **Step 6: Wire up CLI entry point**

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { auditCommand } from "./commands/audit.js";
import { diffCommand } from "./commands/diff.js";
import { extractCommand } from "./commands/extract.js";
import { cacheCommand } from "./commands/cache.js";

const program = new Command();

program
  .name("figma-doctor")
  .description("Diagnose the gap between Figma rendering engine and browser CSS engine")
  .version("0.1.0");

program
  .command("init")
  .description("Create .figma-doctor.json config file")
  .action(initCommand);

program
  .command("audit <figma-url>")
  .description("Audit Figma node for CSS-incompatible properties")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--severity <level>", "Filter by severity: error or warning")
  .action(auditCommand);

program
  .command("diff <page>")
  .description("Compare Figma design values with browser-rendered values")
  .option("--figma-url <url>", "Figma URL (instead of config)")
  .option("--page-url <url>", "Browser URL (instead of config)")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--refresh", "Bypass cache and fetch fresh data", false)
  .option("--tolerance <px>", "Override size tolerance in px", parseFloat)
  .action(diffCommand);

program
  .command("extract <figma-url>")
  .description("Extract raw Figma values normalized to CSS units")
  .option("--format <type>", "Output format: table or json", "table")
  .option("--refresh", "Bypass cache", false)
  .action(extractCommand);

program
  .command("cache <action> [page]")
  .description("Manage cache (clear [page])")
  .action(cacheCommand);

program.parse();
```

- [ ] **Step 7: Build and verify**

Run: `pnpm build`
Expected: both packages compile

- [ ] **Step 8: Verify CLI runs**

Run: `node packages/cli/dist/index.js --help`
Expected: shows help with all commands

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): add all CLI commands (init, audit, diff, extract, cache)"
```

---

### Task 14: Integration Test

**Files:**
- Create: `packages/core/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test for the full pipeline**

`packages/core/src/__tests__/integration.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeNode } from "../extract/normalizer.js";
import { diff } from "../diff/index.js";
import { auditNode } from "../audit/index.js";
import type { RawFigmaNode } from "../extract/client.js";
import type { DOMElement } from "../types.js";

describe("full pipeline (unit)", () => {
  const rawNode: RawFigmaNode = {
    id: "1:1",
    name: "Login Page",
    type: "FRAME",
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    paddingTop: 64,
    paddingRight: 120,
    paddingBottom: 64,
    paddingLeft: 120,
    itemSpacing: 32,
    children: [
      {
        id: "1:2",
        name: "Title",
        type: "TEXT",
        characters: "로그인",
        style: {
          fontFamily: "Pretendard",
          fontWeight: 700,
          fontSize: 32,
          lineHeightPx: 40,
        },
        fills: [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
        absoluteBoundingBox: { x: 120, y: 64, width: 200, height: 40 },
      },
      {
        id: "1:3",
        name: "Card",
        type: "FRAME",
        cornerRadius: 12,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        absoluteBoundingBox: { x: 120, y: 136, width: 400, height: 280 },
        fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
        strokeWeight: 1,
        strokeAlign: "INSIDE",
        strokes: [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } }],
      },
    ],
  };

  it("extract → normalize → diff with matching browser values → PASS", () => {
    const normalized = normalizeNode(rawNode);
    const flatNodes = flattenNodes(normalized);

    // Simulate perfect browser measurement
    const elements: DOMElement[] = [
      {
        selector: "h1",
        textContent: "로그인",
        computedStyles: {
          width: "200px",
          height: "40px",
          fontSize: "32px",
          fontWeight: "700",
          lineHeight: "40px",
          color: "rgb(26, 26, 26)",
        },
        matchedFigmaNodeId: "1:2",
      },
    ];

    const result = diff({ nodes: flatNodes, elements });
    expect(result.pass).toBe(true);
    expect(result.summary.fail).toBe(0);
  });

  it("extract → normalize → diff with mismatched values → FAIL", () => {
    const normalized = normalizeNode(rawNode);
    const flatNodes = flattenNodes(normalized);

    const elements: DOMElement[] = [
      {
        selector: "h1",
        textContent: "로그인",
        computedStyles: {
          width: "200px",
          height: "40px",
          fontSize: "32px",
          fontWeight: "700",
          lineHeight: "44.8px", // ← mismatch: Figma says 40px
          color: "rgb(26, 26, 26)",
        },
        matchedFigmaNodeId: "1:2",
      },
    ];

    const result = diff({ nodes: flatNodes, elements });
    expect(result.pass).toBe(false);
    expect(result.summary.fail).toBe(1);

    const failedEntry = result.results.find((r) => !r.pass);
    expect(failedEntry?.property).toBe("lineHeight");
    expect(failedEntry?.expected).toBe("40px");
    expect(failedEntry?.actual).toBe("44.8px");
  });

  it("audit detects OUTSIDE stroke", () => {
    const badNode: RawFigmaNode = {
      ...rawNode,
      children: [
        {
          id: "1:4",
          name: "BadBorder",
          type: "FRAME",
          strokeAlign: "OUTSIDE",
          strokeWeight: 2,
          strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
        },
      ],
    };

    const result = auditNode(badNode);
    expect(result.pass).toBe(false);
    expect(result.issues[0].property).toBe("strokeAlign");
  });
});

function flattenNodes(node: import("../types.js").FigmaNode): import("../types.js").FigmaNode[] {
  const result = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenNodes(child));
    }
  }
  return result;
}
```

- [ ] **Step 2: Run integration tests**

Run: `cd packages/core && pnpm test -- src/__tests__/integration.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS across both packages

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/__tests__/integration.test.ts
git commit -m "test: add integration tests for full extract → diff pipeline"
```

---

### Task 15: Final Wiring + README

**Files:**
- Modify: `packages/core/src/index.ts` (verify all exports)
- Create: `README.md`

- [ ] **Step 1: Verify core public API is complete**

`packages/core/src/index.ts` 최종 상태:
```typescript
// Types
export type {
  FigmaDoctorConfig,
  PageConfig,
  DiffConfig,
  ToleranceConfig,
  CacheConfig,
  FigmaNode,
  NormalizedStyles,
  AuditSeverity,
  AuditIssue,
  AuditResult,
  DOMElement,
  DiffEntry,
  DiffResult,
} from "./types.js";

// Config
export { loadConfig } from "./config/loader.js";
export { DEFAULT_TOLERANCE, DEFAULT_CACHE_DIR } from "./config/schema.js";

// Extract
export { extract, parseFigmaUrl, NodeCache } from "./extract/index.js";
export { fetchFigmaNode } from "./extract/client.js";
export type { ExtractOptions, ExtractResult } from "./extract/index.js";

// Audit
export { auditNode } from "./audit/index.js";
export { AUDIT_RULES } from "./audit/rules.js";
export type { AuditOptions } from "./audit/index.js";

// Measure
export { measure, closeBrowser } from "./measure/index.js";
export type { MeasureOptions, MeasureResult } from "./measure/index.js";

// Diff
export { diff } from "./diff/index.js";
export type { DiffOptions } from "./diff/index.js";
```

- [ ] **Step 2: Create README.md**

`README.md`:
```markdown
# figma-doctor

Diagnose the gap between Figma's rendering engine and browser CSS engine.

Figma runs inside a browser, but its design canvas uses a custom C++/WebAssembly rendering engine — not the browser's CSS engine. This means values from Figma don't always match what CSS produces. `figma-doctor` catches these discrepancies.

## Install

```bash
npx figma-doctor init
```

## Commands

```bash
# Audit — check for CSS-incompatible Figma properties before implementation
npx figma-doctor audit <figma-url>

# Diff — compare Figma values with actual browser-rendered values
npx figma-doctor diff <page-name>

# Extract — get raw Figma values normalized to CSS units
npx figma-doctor extract <figma-url>

# Cache — manage cached Figma API responses
npx figma-doctor cache clear
```

## How It Works

1. **audit** — Reads Figma nodes via REST API, checks each property against a lookup table of CSS-incompatible values (OUTSIDE strokes, LINEAR_BURN blend, etc.)
2. **extract** — Fetches raw values from Figma REST API and normalizes them to CSS units (px, rgb, %)
3. **measure** — Opens your page in a headless browser, finds matching DOM elements, reads `getComputedStyle` values
4. **diff** — Compares Figma values with browser values, reports mismatches with configurable tolerance

## Config

`.figma-doctor.json`:

```json
{
  "figma": {
    "fileKey": "your-file-key",
    "token": "$FIGMA_TOKEN"
  },
  "pages": {
    "login": {
      "figmaNodeId": "2784:11151",
      "url": "http://localhost:3000/login"
    }
  }
}
```

## License

MIT
```

- [ ] **Step 3: Full build + test**

Run: `pnpm build && pnpm test`
Expected: all builds and tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts README.md
git commit -m "docs: add README and finalize core public API"
```
