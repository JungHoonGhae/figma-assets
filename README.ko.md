# figma-assets

Figma MCP는 만료 URL과 잘린 SVG 조각을 준다.
이건 실제 파일을 준다.

```bash
export FIGMA_TOKEN=figd_...    # figma.com/settings에서 발급
npx figma-assets "https://figma.com/design/abc/File?node-id=123-456" -o ./assets
```

```
./assets/
├── arrow-narrow-left.svg     24×24, 완결된 SVG
├── check.svg                 중복 제거 (9개 동일 → 1회 요청)
├── logo.svg                  93×32, 통째로 추출
├── Plan_Icon@2x.png          래스터 자동 감지 (1.1MB SVG → 13KB PNG)
└── ...
```

[English](README.md)

## 준비

**1.** [Figma Personal Access Token](https://www.figma.com/settings) 발급 후 `FIGMA_TOKEN` 설정:

```bash
export FIGMA_TOKEN=figd_xxxxxxxx
```

**2.** Figma URL 복사 — 프레임 선택 → 우클릭 → **Copy link**. URL에 `node-id` 필요.

**3.** Node.js 18+.

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

반복 사용 시 `.figma-assets.json` (선택):

```json
{
  "token": "$FIGMA_TOKEN",
  "outDir": "./src/assets",
  "rasterScale": 2
}
```

그러면: `figma-assets "https://figma.com/design/..."`

캐시는 `.figma-assets/cache/`. 두 번째 실행은 즉시. 디자인 변경 시 `--refresh`.

---

## 왜 필요한가

MCP 에셋 URL을 다운받으면 이게 나온다:

```xml
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path stroke="var(--stroke-0, #2D7FF9)" .../>
</svg>
```

잘린 viewBox. 크기 없음. `preserveAspectRatio="none"`. CSS 변수 색상.

figma-assets는 이걸 준다:

```xml
<svg width="24" height="24" viewBox="0 0 24 24">
  <path stroke="#2D7FF9" .../>
</svg>
```

완결. 고정 크기. 확정 색상. 어디서든 동작.

비트맵 임베딩 SVG (1.1MB)는 PNG @2x (13KB)로 자동 변환. LLM이 base64를 복사하면 깨지는데 — 이걸 원천 차단.

### REST API 직접 쓰면?

된다. 하지만 실제 프레임에서는: 컨테이너 그룹핑 (벡터 3개 → SVG 1개), 로고 감지 (벡터 20개 → SVG 1개), 중복 제거 (체크 9개 → API 1회), 래스터 감지, 배치 (최대 50/요청), 병렬 다운로드, 캐싱이 필요. 이걸 다 한다.

## API

```typescript
import { extract } from "figma-assets";

const result = await extract({
  figmaUrl: "https://figma.com/design/abc/File?node-id=123-456",
  token: process.env.FIGMA_TOKEN,
  outDir: "./assets",
});
// result.assets: [{ id, name, fileName, type }, ...]
// result.stats: { total: 20, svgs: 19, rasters: 1, deduplicated: 10 }
```

## License

MIT
