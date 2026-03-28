# figma-assets

AI 코딩 에이전트 (Cursor, Claude Code 등)는 Figma MCP로 디자인을 구현한다. 코드는 잘 나온다. 아이콘은 안 나온다.

MCP는 아이콘을 **7일 만료 URL**이나 **잘린 SVG 조각**으로 반환한다 — viewBox 누락, 고정 크기 없음, CSS 변수 색상. AI 에이전트는 죽은 URL을 링크하거나 SVG path를 "비슷하게" 추측해서 다시 그린다.

figma-assets는 아이콘과 이미지를 **실제 파일**로 추출한다 — 올바른 viewBox의 완결된 SVG, 확정된 색상, 비트맵 임베딩 노드의 래스터 자동 변환. 동일 컴포넌트 중복 제거, API 배치 호출, 병렬 다운로드, 캐싱으로 Figma API 사용을 최소화한다.

```bash
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

[English](README.md)

## 구체적인 문제

Figma MCP로 디자인을 구현하면 아이콘이 이렇게 온다.

```javascript
const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-...";
```

7일 뒤에 만료되는 외부 URL이다. 프로덕션에 쓸 수 없다.

이 URL을 다운받으면 되지 않을까? 실제로 다운받아 봤다.

```xml
<!-- MCP 에셋 URL을 다운받은 결과 -->
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path d="M12.33 1.5L5.67 8.17L1.5 4"
        stroke="var(--stroke-0, #2D7FF9)" stroke-width="3"/>
</svg>
```

이건 아이콘이 아니다. **path 조각**이다.

- `viewBox="0 0 13.83 9.67"` — 24×24 캔버스가 아닌 바운딩 박스로 잘려 있다
- `width="100%" height="100%"` — 고유 크기가 없다. 부모에 따라 찌그러진다
- `preserveAspectRatio="none"` — 비율 유지를 안 한다
- `stroke="var(--stroke-0, #2D7FF9)"` — CSS 변수에 의존한다

같은 아이콘을 Figma REST API `/v1/images?format=svg`로 직접 내보내면:

```xml
<!-- figma-assets가 추출한 결과 -->
<svg width="24" height="24" viewBox="0 0 24 24">
  <path d="M15.92 9.67L9.25 16.33L5.08 12.17"
        stroke="#2D7FF9" stroke-width="3"/>
</svg>
```

24×24 캔버스. 확정된 색상. 어디에 넣어도 동작하는 완결된 SVG.

---

래스터 이미지는 더 심하다.

SVG로 내보내면 1.1MB짜리가 나올 때가 있다. 열어보면 base64로 인코딩된 비트맵이 SVG 안에 들어 있다. Figma에서 이미지 fill을 쓰면 이렇게 된다.

이걸 AI 에이전트에게 넘기면? 17,212자의 base64를 HTML에 붙여넣다가 1~2글자가 변형된다. LLM은 문자를 "복사"하지 않고 토큰 단위로 "재생성"한다. 의미 없는 문자열에서는 자기교정이 불가능하다. 1글자만 틀려도 이미지가 깨진다.

figma-assets는 이걸 자동 감지해서 PNG @2x (13KB)로 내보낸다. 실제 파일로.

## REST API를 직접 쓰면 되지 않나?

된다. `/v1/images?format=svg`는 공개 엔드포인트다. 하지만 실제 Figma 프레임 하나를 처리하려면:

- 노드 트리를 순회해서 어떤 노드가 아이콘인지 판별해야 한다 (모든 FRAME이 SVG는 아니다)
- 24×24 INSTANCE 안에 VECTOR 3개가 있으면 SVG 3개가 아니라 1개로 내보내야 한다
- 로고 (93×32 INSTANCE, 벡터 20개 중첩)도 1개로 내보내야 한다
- 체크 아이콘 9개가 같은 componentId이면 API를 9번이 아니라 1번 호출해야 한다
- 1.1MB짜리 비트맵 임베딩 SVG는 13KB PNG로 바꿔야 한다
- API 호출을 배치(최대 50개)하고, 다운로드를 병렬화하고, 결과를 캐싱해야 한다

figma-assets는 이걸 전부 처리한다. 프로젝트마다 다시 짜는 스크립트 대신 명령어 하나.

## 사전 준비

### 1. Figma Personal Access Token

[Figma Settings → Personal Access Tokens](https://www.figma.com/settings)에서 토큰을 발급한다 (Account → Security → Personal access tokens → Generate new token).

환경 변수로 설정:

```bash
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. node-id가 포함된 Figma URL

추출할 프레임을 Figma에서 연다. URL이 이런 형태다:

```
https://www.figma.com/design/hlN4c1rV2dQCzyEMbowCHX/MyProject?node-id=2912-13356
```

`node-id`가 포함된 전체 URL이 필요하다. 얻는 방법:
1. Figma에서 프레임을 선택
2. 우클릭 → **Copy/Paste as** → **Copy link**
3. 또는 URL 바에서 `node-id` 쿼리 파라미터 확인

### 3. Node.js

Node.js 18+ (내장 `fetch` 사용).

## 빠른 시작 (AI 에이전트용)

AI 에이전트 (Claude Code, Cursor 등)에 이걸 복사해서 붙여넣는다:

```
Figma 에셋을 ./assets로 추출해:

1. 실행: FIGMA_TOKEN=figd_xxx npx figma-assets "여기에_FIGMA_URL_붙여넣기" -o ./assets
2. SVG 참조: <img src="./assets/아이콘이름.svg" />
3. PNG 참조: <img src="./assets/이미지이름@2x.png" />

SVG 아이콘을 직접 다시 그리지 마. 추출된 파일을 써.
```

`figd_xxx`를 토큰으로, URL을 `node-id`가 포함된 Figma 프레임 URL로 교체.

## 설치

```bash
npx figma-assets <figma-url> --out-dir ./assets
```

## 사용법

```bash
export FIGMA_TOKEN=figd_...

# Figma 프레임의 모든 에셋을 실제 파일로 추출
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets

# 래스터 배수 지정
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --scale 3

# JSON 매니페스트 출력
figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets --json
```

## 하는 일

1. Figma 노드 트리를 순회하면서 벡터/아이콘 노드를 찾는다
2. 작은 컨테이너(≤48px)는 개별 path가 아닌 단일 SVG로 내보낸다
3. INSTANCE/COMPONENT의 모든 자식이 벡터이면 통째로 내보낸다 (로고 등)
4. 같은 componentId는 한 번만 API 호출한다 (중복 제거)
5. 래스터가 임베딩된 SVG를 감지하면 PNG로 대체한다
6. 전부 실제 파일로 저장한다

## 결과

```
./assets/
├── arrow-narrow-left.svg       # 24×24 완결된 SVG
├── menu-01.svg
├── check.svg                   # 체크 아이콘 (9개 중 1개 — 중복 제거됨)
├── check-1.svg
├── logo.svg                    # 93×32 로고 (통째로 추출)
├── Plan_Icon@2x.png            # 래스터 감지 → 1.1MB SVG → 13KB PNG
└── ...
```

## 옵션

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

모든 옵션은 CLI 플래그로 전달할 수 있다. 반복 사용 시 프로젝트 루트에 `.figma-assets.json`을 만든다:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2,
  "rasterFormat": "png",
  "rasterThreshold": 50000,
  "cacheDir": ".figma-assets/cache"
}
```

그러면 URL만 넘기면 된다:

```bash
figma-assets "https://figma.com/design/abc/File?node-id=123-456"
```

### 토큰

토큰은 이 순서로 찾는다:
1. `--token` CLI 플래그 (비추천 — 셸 히스토리에 남음)
2. `.figma-assets.json`의 `token` 필드 — `$환경변수` 문법 지원
3. `FIGMA_TOKEN` 환경 변수

### 캐시

Figma API 응답과 다운로드된 SVG는 `.figma-assets/cache/`에 캐싱된다:
- 두 번째 실행부터 API 호출 없이 즉시 완료
- `--refresh`로 디자인이 바뀌었을 때 캐시 무시
- `.figma-assets/`를 `.gitignore`에 추가할 것

### 래스터 감지

SVG 내보내기가 `--threshold` (기본 50KB)를 초과하거나 `data:image/` (base64 비트맵)을 포함하면 자동으로:
1. 비대한 SVG를 건너뜀
2. `/v1/images?format=png&scale=N`으로 해당 노드를 다시 요청
3. PNG를 실제 바이너리 파일로 저장

배수는 `--scale` (1-4), 포맷은 `--format` (png/jpg)으로 설정.

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
