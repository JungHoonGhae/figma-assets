# figma-assets

AI 코딩 에이전트 (Cursor, Claude Code 등)는 Figma MCP로 디자인을 구현한다. 코드는 잘 나온다. 아이콘은 안 나온다.

MCP는 아이콘을 **7일 만료 URL**이나 **잘린 SVG 조각**으로 반환한다 — viewBox 누락, 고정 크기 없음, CSS 변수 색상. AI 에이전트는 죽은 URL을 링크하거나 SVG path를 "비슷하게" 추측해서 다시 그린다.

figma-assets는 아이콘과 이미지를 **실제 파일**로 추출한다 — 올바른 viewBox의 완결된 SVG, 확정된 색상, 비트맵 임베딩 노드의 래스터 자동 변환. 동일 컴포넌트 중복 제거, API 배치 호출, 병렬 다운로드, 캐싱으로 Figma API 사용을 최소화한다.

[English](README.md)

## 사전 준비

### 1. Figma Personal Access Token

[Figma Settings → Personal Access Tokens](https://www.figma.com/settings) (Account → Security → Generate new token).

```bash
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. node-id가 포함된 Figma URL

Figma에서 프레임 선택 → 우클릭 → **Copy link**. URL에 `node-id`가 포함되어야 한다:

```
https://www.figma.com/design/hlN4c1rV2dQCzyEMbowCHX/MyProject?node-id=2912-13356
```

### 3. Node.js 18+

내장 `fetch` 사용. 추가 의존성 없음.

## 설치

```bash
# 설치 없이 실행
npx figma-assets <figma-url> -o ./assets

# 또는 글로벌 설치
npm install -g figma-assets
```

## 빠른 시작

```bash
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

끝. 에셋이 `./assets/`에 들어간다.

### AI 에이전트용

에이전트 (Claude Code, Cursor 등)에 이걸 붙여넣는다:

```
Figma 에셋을 ./assets로 추출해:

1. 실행: npx figma-assets "여기에_FIGMA_URL" -o ./assets
2. SVG 참조: <img src="./assets/아이콘이름.svg" />
3. PNG 참조: <img src="./assets/이미지이름@2x.png" />

SVG 아이콘을 직접 다시 그리지 마. 추출된 파일을 써.
```

## 결과

```
./assets/
├── arrow-narrow-left.svg       # 24×24, 완결된 SVG
├── menu-01.svg
├── check.svg                   # 체크 아이콘 9개 중 1개 (중복 제거됨)
├── logo.svg                    # 93×32, 통째로 추출
├── Plan_Icon@2x.png            # 래스터 감지: 1.1MB SVG → 13KB PNG
└── ...
```

## 옵션

```bash
figma-assets <figma-url> -o <dir> [options]
```

| 플래그 | 기본값 | 설명 |
|--------|--------|------|
| `-o, --out-dir` | (필수) | 출력 디렉토리 |
| `--scale` | `2` | 래스터 내보내기 배수 (1-4) |
| `--format` | `png` | 래스터 포맷: `png` 또는 `jpg` |
| `--threshold` | `50000` | 래스터 감지 임계값 (bytes) |
| `--cache-dir` | `.figma-assets/cache` | 캐시 디렉토리 |
| `--refresh` | `false` | 캐시 무시 |
| `--json` | `false` | JSON 매니페스트 출력 |

## 설정

반복 사용 시 프로젝트 루트에 `.figma-assets.json`을 만든다:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2,
  "rasterFormat": "png"
}
```

그러면: `figma-assets "https://figma.com/design/..."`

**토큰 우선순위:** `--token` 플래그 → `.figma-assets.json` → `FIGMA_TOKEN` 환경 변수

**캐시:** API 응답은 `.figma-assets/cache/`에 캐싱. 두 번째 실행은 즉시 완료. 디자인 변경 시 `--refresh`. `.figma-assets/`를 `.gitignore`에 추가.

---

## 이 도구가 필요한 이유

### MCP 에셋 URL은 망가져 있다

```javascript
const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-...";
```

이 URL을 다운받으면:

```xml
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path d="M12.33 1.5L5.67 8.17L1.5 4"
        stroke="var(--stroke-0, #2D7FF9)" stroke-width="3"/>
</svg>
```

이건 아이콘이 아니다. **path 조각**이다 — 잘린 viewBox, 고유 크기 없음, `preserveAspectRatio="none"`, CSS 변수 색상.

같은 아이콘을 figma-assets로 추출하면:

```xml
<svg width="24" height="24" viewBox="0 0 24 24">
  <path d="M15.92 9.67L9.25 16.33L5.08 12.17"
        stroke="#2D7FF9" stroke-width="3"/>
</svg>
```

24×24 캔버스. 확정된 색상. 어디에 넣어도 동작.

### 래스터 임베딩 SVG

SVG 내보내기가 1.1MB일 때가 있다 — SVG 안에 base64 비트맵이 들어 있다. AI 에이전트가 17,212자의 base64를 HTML에 넣으면 1~2글자가 변형된다. LLM은 "복사"하지 않고 토큰 단위로 "재생성"한다. 1글자만 틀려도 이미지가 깨진다.

figma-assets는 이걸 감지해서 PNG @2x (13KB)로 내보낸다. 실제 파일로.

### REST API를 직접 쓰면 되지 않나?

된다. 하지만 실제 Figma 프레임을 처리하려면:

- 24×24 INSTANCE 안에 VECTOR 3개 → SVG 3개가 아니라 1개
- 93×32 로고에 벡터 20개 중첩 → 1개로 내보내야 함
- 체크 아이콘 9개가 같은 componentId → API 1번이면 충분
- 1.1MB 비트맵 임베딩 SVG → 13KB PNG로 변환
- API 배치 (최대 50개), 병렬 다운로드, 캐싱 필요

figma-assets는 이걸 전부 처리한다. 프로젝트마다 다시 짜는 스크립트 대신 명령어 하나.

## 동작 방식

1. Figma 노드 트리를 순회하면서 벡터/아이콘 노드를 찾는다
2. 작은 컨테이너(≤48px)는 개별 path가 아닌 단일 SVG로 내보낸다
3. INSTANCE/COMPONENT의 모든 자식이 벡터이면 통째로 내보낸다 (로고 등)
4. 같은 componentId는 한 번만 API 호출한다 (중복 제거)
5. 래스터 임베딩 SVG를 감지하면 PNG로 대체한다
6. 전부 실제 파일로 저장한다

## 라이브러리로 사용

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});

// result.assets: [{ id, name, fileName, type: "svg" | "raster" }, ...]
// result.stats: { total: 20, svgs: 19, rasters: 1, deduplicated: 10 }
```

## License

MIT
