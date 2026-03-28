<div align="center">
  <h1>figma-assets</h1>
  <p>Figma에서 SVG/PNG 에셋을 뽑아서 실제 파일로 저장한다.</p>
</div>

<p align="center">
  <a href="#시작하기"><strong>시작하기</strong></a> ·
  <a href="#ai-에이전트에서-쓰기"><strong>AI 에이전트</strong></a> ·
  <a href="#옵션"><strong>옵션</strong></a> ·
  <a href="#왜-만들었나"><strong>왜</strong></a>
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

Cursor나 Claude Code 같은 AI 에이전트로 Figma 디자인을 구현하면, 아이콘이 7일 뒤 만료되는 임시 URL로 오거나 이런 깨진 SVG로 온다:

```xml
<!-- Figma 공식 MCP가 주는 것 -->
<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 13.83 9.67">
  <path stroke="var(--stroke-0, #2D7FF9)" .../>
</svg>
```

크기가 없어서 부모에 따라 찌그러지고, 캔버스가 잘려 있고, 색상이 CSS 변수라서 Figma 밖에서는 안 먹는다.

**figma-assets**로 뽑으면 이렇게 나온다:

```xml
<!-- figma-assets가 주는 것 -->
<svg width="24" height="24" viewBox="0 0 24 24">
  <path stroke="#2D7FF9" .../>
</svg>
```

24×24 캔버스 그대로. 색상 확정. 어디 넣어도 그냥 된다.

## 준비할 것

**1.** [Figma Personal Access Token](https://www.figma.com/settings) 발급하고 환경변수 설정:

```bash
export FIGMA_TOKEN=figd_xxxxxxxx
```

**2.** Node.js 18 이상.

## 시작하기

Claude Code나 Cursor MCP 설정에 추가한다:

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

끝. 에이전트가 `extract_assets` 도구를 갖게 된다. Figma URL(`node-id` 포함)을 주면 알아서 에셋을 뽑는다.

```
./assets/
├── back-arrow.svg            24×24 SVG
├── check.svg                 같은 아이콘 9개 → 1번만 요청
├── company-logo.svg          로고 통째로
├── hero-image@2x.png         비트맵 포함 SVG(1.1MB) → PNG(13KB)로 자동 변환
└── ...
```

### MCP 없이 쓰기 (CLI)

직접 실행할 수도 있다:

```bash
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

Figma URL에 `node-id`가 있어야 한다. 프레임 선택 → 우클릭 → **Copy link**로 복사.

## 옵션

| 플래그 | 기본값 | |
|--------|--------|---|
| `-o, --out-dir` | 필수 | 저장할 폴더 |
| `--scale` | `2` | PNG 배수 (1-4) |
| `--format` | `png` | PNG 또는 JPG |
| `--threshold` | `50000` | 비트맵 감지 기준 (bytes) |
| `--refresh` | `false` | 캐시 무시하고 새로 받기 |
| `--json` | `false` | 결과를 JSON으로 출력 |
| `--serve` | | MCP 서버 모드 |

## 설정 파일

반복해서 쓸 때 `.figma-assets.json` 만들어두면 편하다:

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2
}
```

캐시는 `.figma-assets/cache/`에 저장된다. 두 번째부터는 API 안 타고 바로 끝난다. Figma에서 디자인이 바뀌면 자동으로 감지해서 새로 받는다 (`lastModified` 체크). `--refresh`는 강제로 전부 다시 받을 때 쓴다.

---

## 왜 만들었나

1. Figma 노드 트리를 돌면서 아이콘/벡터 노드를 찾는다
2. 작은 컨테이너(≤48px)는 path 쪼개지 않고 하나의 SVG로 뽑는다
3. 로고처럼 벡터만으로 이루어진 컴포넌트도 하나로 뽑는다
4. 같은 컴포넌트는 한 번만 API 호출한다
5. SVG 안에 비트맵이 들어 있으면 감지해서 PNG로 바꾼다
6. API를 50개씩 묶어서 보내고, 다운로드는 20개 동시에, 결과는 캐싱한다

비트맵이 박힌 SVG는 1.1MB짜리가 나올 수 있다. 이걸 AI한테 넘기면 base64를 복사하다가 1~2글자가 바뀌어서 이미지가 깨진다. LLM은 복사가 아니라 토큰 단위로 다시 생성하기 때문이다. 실제 파일로 저장하면 이 문제가 없다.

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

이슈, PR 환영. [CHANGELOG.md](CHANGELOG.md)에서 변경 내역 확인.

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Made by <a href="https://github.com/JungHoonGhae">@JungHoonGhae</a></sub><br/>
  <sub><a href="https://x.com/lucas_ghae">@lucas_ghae</a> on X</sub>
</p>
