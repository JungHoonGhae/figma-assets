# figma-assets

Figma 디자인에서 프로덕션용 SVG/PNG 에셋을 추출한다.

## 문제

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
