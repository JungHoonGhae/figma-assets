# figma-doctor Design Spec

Figma 렌더링 엔진과 브라우저 CSS 엔진 사이의 간극을 진단하는 CLI 도구.

## Problem

Figma는 브라우저 안에서 돌아가지만, 디자인 캔버스는 CSS 엔진이 아닌 C++/WebAssembly 자체 렌더링 엔진으로 그린다. Figma MCP의 get_design_context가 반환하는 값은 이 자체 엔진의 값을 CSS/Tailwind로 번역한 결과물이며, 이 과정에서 세 가지 문제가 발생한다:

1. **오역** — 값이 미묘하게 달라진다 (lineHeight, card height 등)
2. **브라우저 미지원 속성 유입** — Figma의 Vertical Trim(text-box-trim)처럼 일부 브라우저가 미지원하는 속성이 포함된다
3. **조용한 누락** — CSS에 대응이 없는 Figma 속성(stroke Outside, LINEAR_BURN 등)이 경고 없이 사라진다

## Solution

상류에서 문제를 잡고(audit), 하류에서 결과를 검증(diff)하는 도구. 구현(가운데)은 사용자의 영역으로 남긴다. 기계적 비교는 코드로, 판단이 필요한 부분만 LLM/사람으로 — 이 분리가 핵심.

```
0. audit    → CSS 미지원 속성 탐지 (상류)
1. extract  → REST API 원본 수치 추출
2. (사용자가 구현)
3. measure  → getComputedStyle 브라우저 실측
4. diff     → 양 끝 비교, 불일치 보고 (하류)
```

## Decisions

| 항목 | 결정 | 근거 |
|------|------|------|
| 사용자 | 오픈소스 커뮤니티 | Figma→CSS 간극을 문제로 느끼는 웹 개발자 |
| 이름 | figma-doctor | 진단 도구 메타포. brew doctor, flutter doctor 패턴 |
| 런타임 | Node.js + TypeScript | 타겟 사용자의 툴체인과 100% 겹침. npx zero-install. Playwright/Figma API 1등 시민 |
| 구조 | 모노레포 2 패키지 | core + cli. 장기적으로 분리 유지. MCP 추가 시 3번째 패키지로 |
| 매핑 | 하이브리드 | 페이지=설정 파일, 요소=textContent 자동 매칭 |
| 출력 | 터미널 테이블 + JSON | 기본은 사람용 테이블. --format json으로 CI/AI 소비 |
| MCP | 후순위 | CLI의 --format json이면 AI 에이전트가 bash로 소비 가능. 수요 시 @figma-doctor/mcp 추가 |
| 포지셔닝 | 공식 Figma MCP와 공존 | 대체가 아닌 보완. 한 가지를 확실히 해결하는 도구 |

## Architecture

### Monorepo Structure

```
figma-doctor/
├── packages/
│   ├── core/              ← @figma-doctor/core
│   │   └── src/
│   │       ├── audit/     ← Figma 속성 → CSS 호환성 검사
│   │       ├── extract/   ← REST API → CSS 단위 정규화 + 캐시
│   │       ├── measure/   ← Playwright → getComputedStyle
│   │       ├── diff/      ← 양 끝 비교 + 허용 오차 판정
│   │       ├── config/    ← 설정 파일 로더
│   │       └── index.ts   ← public API
│   │
│   └── cli/               ← figma-doctor (npx figma-doctor)
│       └── src/
│           ├── commands/  ← init, audit, diff, extract, cache
│           └── formatters/ ← table, json
│
├── pnpm-workspace.yaml
└── turbo.json
```

### Dependency Direction

```
cli ───→ core ←─── (future: mcp)
```

cli는 core만 의존. core는 cli를 모름. 단방향 강제.

## Core Modules

### 1. audit — 상류 감사

Figma 노드를 읽고, CSS로 재현 불가능한 속성을 찾아낸다.

**입력:** fileKey, nodeId, figmaToken
**출력:** AuditIssue[] — `{ property, value, severity, reason, suggestion }`

**룩업 테이블 (확장 가능):**

| Figma 속성 | 문제 | severity |
|---|---|---|
| effects: LINEAR_BURN blend | CSS mix-blend-mode 대응 없음 | error |
| effects: LINEAR_DODGE blend | CSS mix-blend-mode 대응 없음 | error |
| strokes: OUTSIDE alignment | CSS border로 재현 불가 | error |
| leadingTrim: CAP_HEIGHT | text-box-trim — Firefox 미지원 | warning |
| textAutoResize: TRUNCATE | CSS text-overflow 근사 필요 | warning |
| constraints: SCALE / CENTER | CSS position: absolute와 동작 다름 | warning |

룩업 테이블은 JSON 파일로 관리. 커뮤니티가 PR로 확장 가능.

### 2. extract — 원본 수치 추출

Figma REST API로 노드 트리를 읽고, CSS 비교 가능한 형태로 정규화한다.

**입력:** fileKey, nodeId, figmaToken
**출력:** FigmaNode[] — 정규화된 노드 배열

**정규화 규칙:**
- color `{r:1, g:0, b:0, a:1}` → `"rgb(255, 0, 0)"`
- fontSize `16` → `"16px"`
- lineHeight `{unit:"PIXELS", value:24}` → `"24px"`
- lineHeight `{unit:"PERCENT", value:150}` → `"150%"`
- padding `[16,24,16,24]` → `{top:"16px", right:"24px", bottom:"16px", left:"24px"}`
- cornerRadius `8` → `"8px"`

**캐싱:**
- 경로: `.figma-doctor/cache/nodes/{nodeId}.json`
- `--refresh` 시 캐시 무효화
- depth 파라미터 사용 금지 (TEXT 노드 잘림 방지)

### 3. measure — 브라우저 실측

Playwright로 페이지를 열고, getComputedStyle로 실제 렌더링된 CSS 값을 읽는다.

**입력:** url, FigmaNode[] (매칭 대상)
**출력:** DOMElement[] — `{ selector, computedStyles, matchedFigmaNodeId }`

**요소 매칭 전략 (우선순위):**
1. textContent 일치 → TEXT 노드 매칭
2. 구조적 위치 (부모-자식 관계) → FRAME/GROUP 매칭
3. 시각적 속성 유사도 (크기, 색상) → fallback

**측정 속성:**
width, height, padding (4방향), margin, gap, fontSize, fontWeight, fontFamily, lineHeight, letterSpacing, color, backgroundColor, borderWidth, borderColor, borderRadius, borderStyle, boxShadow, opacity

### 4. diff — 비교 판정

FigmaNode[]와 DOMElement[]를 대조하여 불일치를 찾는다.

**입력:** FigmaNode[], DOMElement[]
**출력:** DiffResult[] — `{ nodeId, selector, property, expected, actual, delta, pass }`

**허용 오차 (설정 가능):**
- 크기/간격: ±1px (서브픽셀 반올림 차이)
- 색상: ΔE ≤ 1.0 (CIE76, 사람 눈에 구분 불가)
- 폰트 크기: 정확 일치 (0 허용)
- line-height: ±0.5px

**판정:**
- 전체 PASS = 모든 DiffResult.pass === true
- exit code 0 (pass) / 1 (fail) — CI 통합용

## CLI Commands

```bash
# 초기 설정
npx figma-doctor init

# 감사 — 구현 전 CSS 호환성 체크
npx figma-doctor audit <figma-url>
npx figma-doctor audit <figma-url> --format json
npx figma-doctor audit <figma-url> --severity error

# 디프 — 구현 후 Figma vs 브라우저 비교
npx figma-doctor diff <page-name>
npx figma-doctor diff --figma-url <url> --page-url <url>
npx figma-doctor diff <page-name> --refresh
npx figma-doctor diff <page-name> --format json
npx figma-doctor diff <page-name> --tolerance 2

# 원본 수치 추출
npx figma-doctor extract <figma-url>
npx figma-doctor extract <figma-url> --format json

# 캐시 관리
npx figma-doctor cache clear
npx figma-doctor cache clear <page-name>
```

## Config File

`.figma-doctor.json` — 프로젝트 루트에 위치.

```json
{
  "figma": {
    "fileKey": "abc123def456",
    "token": "$FIGMA_TOKEN"
  },
  "pages": {
    "login": {
      "figmaNodeId": "2784:11151",
      "url": "http://localhost:3000/login"
    },
    "dashboard": {
      "figmaNodeId": "2784:11200",
      "url": "http://localhost:3000/dashboard"
    }
  },
  "diff": {
    "tolerance": {
      "size": 1,
      "color": 1.0,
      "fontSize": 0,
      "lineHeight": 0.5
    }
  },
  "cache": {
    "dir": ".figma-doctor/cache"
  }
}
```

- `token`은 환경변수 참조 (`$FIGMA_TOKEN`)를 지원
- `pages`는 페이지명 → Figma nodeId + 브라우저 URL 매핑
- `tolerance`는 속성 카테고리별 허용 오차

## Output Format

### Terminal Table (기본)

```
figma-doctor · Figma vs Browser diff for login
Figma node: 2784:11151 → http://localhost:3000/login
Extracted 23 nodes · Matched 21 DOM elements

Element         Property     Figma    Browser   Delta     Status
h1 "로그인"     fontSize     32px     32px      0         ✓ pass
h1 "로그인"     lineHeight   40px     44.8px    +4.8px    ✗ FAIL
.card           height       280px    284px     +4px      ✗ FAIL
.card           padding-top  24px     24px      0         ✓ pass
... 17 more rows

FAIL — 2 of 21 elements have mismatches (exit code 1)
```

### JSON (--format json)

```json
{
  "results": [
    {
      "nodeId": "2784:11160",
      "selector": "h1",
      "property": "lineHeight",
      "expected": "40px",
      "actual": "44.8px",
      "delta": 4.8,
      "pass": false
    }
  ],
  "summary": { "total": 21, "pass": 19, "fail": 2 },
  "pass": false
}
```

## Non-Goals (MVP에서 하지 않는 것)

- MCP 서버 — 수요 시 @figma-doctor/mcp으로 추가
- HTML 리포트 — 후순위
- Figma 공식 MCP 대체 — 공존. 스크린샷/메타데이터/Code Connect는 공식 MCP 영역
- 자동 수정 (--fix) — 진단만. 수정은 사용자/AI의 영역
- 디자인 시스템 연동 — 범용 도구. 특정 디자인 시스템에 결합하지 않음
