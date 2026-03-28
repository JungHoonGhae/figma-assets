<div align="center">
  <h1>figma-assets</h1>
  <p>Figma 디자인에서 프로덕션용 SVG/PNG 에셋을 추출한다.</p>
</div>

<p align="center">
  <a href="#빠른-시작"><strong>빠른 시작</strong></a> ·
  <a href="#ai-에이전트와-사용"><strong>AI 에이전트</strong></a> ·
  <a href="#옵션"><strong>옵션</strong></a> ·
  <a href="#왜-필요한가"><strong>왜</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/figma-assets"><img src="https://img.shields.io/npm/v/figma-assets.svg" alt="npm" /></a>
  <a href="https://github.com/JungHoonGhae/figma-assets/stargazers"><img src="https://img.shields.io/github/stars/JungHoonGhae/figma-assets" alt="GitHub stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933.svg?logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

---

AI 에이전트(Cursor, Claude Code 등)가 Figma 공식 MCP로 디자인을 구현하면, 아이콘이 7일 뒤 만료되는 임시 URL로 오거나, 이런 SVG 조각으로 온다:

```xml
<!-- Figma 공식 MCP가 주는 것 -->
<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 13.83 9.67">
  <path stroke="var(--stroke-0, #2D7FF9)" .../>
</svg>
```

고정 크기 없음. 잘린 캔버스. 색상이 CSS 변수. 쓸 수 없다.

**figma-assets**는 이걸 준다:

```xml
<!-- figma-assets가 주는 것 -->
<svg width="24" height="24" viewBox="0 0 24 24">
  <path stroke="#2D7FF9" .../>
</svg>
```

완결된 아이콘. 고정 크기. 실제 색상. 프로젝트에 파일로 저장.

```bash
export FIGMA_TOKEN=figd_...
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

```
./assets/
├── back-arrow.svg            24×24, 완결된 SVG
├── check.svg                 중복 제거 (9개 동일 → 1회 API 호출)
├── company-logo.svg          복잡한 로고를 통째로 추출
├── hero-image@2x.png         래스터 자동 감지 (1.1MB SVG → 13KB PNG)
└── ...
```

## 준비

**1.** [Figma Personal Access Token](https://www.figma.com/settings) 발급 후 `FIGMA_TOKEN` 설정:

```bash
export FIGMA_TOKEN=figd_xxxxxxxx
```

**2.** Figma URL 복사 — 프레임 선택 → 우클릭 → **Copy link**. URL에 `node-id` 필요.

**3.** Node.js 18+.

## 빠른 시작

```bash
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

## AI 에이전트와 사용

### MCP 서버 (추천)

Claude Code 또는 Cursor 설정에 추가 — 에이전트가 `extract_assets` 도구를 자동으로 사용:

```json
{
  "mcpServers": {
    "figma-assets": {
      "command": "npx",
      "args": ["figma-assets", "--serve"],
      "env": { "FIGMA_TOKEN": "figd_..." }
    }
  }
}
```

### 수동 프롬프트

에이전트에 붙여넣기:

```
1. 실행: npx figma-assets "FIGMA_URL" -o ./assets
2. 사용: <img src="./assets/아이콘이름.svg" />
3. SVG를 직접 다시 그리지 마.
```

## 옵션

| 플래그 | 기본값 | |
|--------|--------|---|
| `-o, --out-dir` | 필수 | 출력 디렉토리 |
| `--scale` | `2` | 래스터 배수 (1-4) |
| `--format` | `png` | 래스터 포맷: png / jpg |
| `--threshold` | `50000` | 래스터 감지 임계값 (bytes) |
| `--refresh` | `false` | 캐시 무시 |
| `--json` | `false` | JSON 매니페스트 출력 |
| `--serve` | | MCP 서버 모드 |

## 설정 파일

`.figma-assets.json` (선택):

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2
}
```

캐시는 `.figma-assets/cache/`. 두 번째 실행은 즉시. 디자인 변경 시 `--refresh`.

---

## 동작 방식

1. Figma 노드 트리를 순회하면서 벡터/아이콘 노드를 찾는다
2. 작은 컨테이너(≤48px)는 개별 path가 아닌 단일 SVG로 내보낸다
3. 로고(INSTANCE의 모든 자식이 벡터)는 통째로 내보낸다
4. 같은 componentId는 한 번만 API 호출한다 (중복 제거)
5. 래스터 임베딩 SVG(>50KB 또는 base64 비트맵)를 감지하면 PNG로 대체한다
6. API 배치(최대 50/요청), 병렬 다운로드(20 동시), 캐싱

비트맵 임베딩 SVG(1.1MB)는 PNG @2x(13KB)로 자동 변환. LLM이 base64를 복사하면 깨지는데 — 실제 파일로 원천 차단.

## API

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});
```

## 기여

이슈와 PR 환영. [CHANGELOG.md](CHANGELOG.md)에서 릴리즈 히스토리 확인.

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Made by <a href="https://github.com/JungHoonGhae">@JungHoonGhae</a></sub><br/>
  <sub><a href="https://x.com/lucas_ghae">@lucas_ghae</a> on X</sub>
</p>
