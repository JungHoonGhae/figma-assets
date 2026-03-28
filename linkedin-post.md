Figma가 사실상 웹 개발 표준인 것이 점점 더 불편해지는 이유 — 그 후속편.

지난 글에서 이런 이야기를 했다.

Figma는 브라우저 안에서 돌아가지만 디자인 캔버스는 CSS 엔진이 아닌 C++/WebAssembly 자체 렌더링 엔진으로 그린다. Figma MCP가 반환하는 값은 이 자체 엔진의 값을 CSS로 번역한 결과물이다. 이 과정에서 오역, 미지원 속성 유입, 조용한 누락이 발생한다.

"거의 같은 건 틀린 거다."

그 글을 쓰고 나서 직접 도구를 만들었다.

figma-doctor.

Figma 렌더링 엔진과 브라우저 CSS 엔진 사이의 간극을 진단하는 오픈소스 CLI 도구다.

---

에셋 하나만으로도 이 도구가 필요한 이유가 설명된다.

MCP로 Figma 디자인을 구현하면 아이콘이 이렇게 온다:

```javascript
const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-...";
```

7일 뒤에 만료되는 외부 URL이다. 프로덕션에 이걸 넣을 수 없다.

이 URL을 다운받으면 되지 않냐고? 실제로 다운받아 봤다.

```xml
<!-- MCP 에셋 URL을 다운받은 SVG -->
<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path d="M12.33 1.5L5.67 8.17L1.5 4"
        stroke="var(--stroke-0, #2D7FF9)" stroke-width="3"/>
</svg>
```

```xml
<!-- figma-doctor가 추출한 같은 아이콘 -->
<svg width="24" height="24" viewBox="0 0 24 24">
  <path d="M15.92 9.67L9.25 16.33L5.08 12.17"
        stroke="#2D7FF9" stroke-width="3"/>
</svg>
```

같은 체크 아이콘인데 다르다.

MCP 에셋은 벡터 path만 잘라낸 조각이다. viewBox가 13.8×9.7로 crop되어 있고, width/height가 100%라 부모 크기에 의존하고, preserveAspectRatio="none"이라 비율이 찌그러질 수 있고, 색상이 CSS 변수(`var(--stroke-0)`)를 참조한다.

figma-doctor는 /v1/images?format=svg로 노드 전체를 SVG 이미지로 export한다. 24×24 캔버스가 유지되고, 색상이 확정값이고, 어디에 넣어도 동작하는 자체 완결된 SVG다.

```bash
figma-doctor extract <figma-url> --out-dir ./assets
```

이 한 줄이면 아이콘 19개가 실제 SVG 파일로 나온다.
arrow-narrow-left.svg, check.svg, menu-01.svg, logo.svg.
path d 값, viewBox, stroke-width — 전부 Figma 파일에 있는 그대로.

래스터 이미지는 더 문제였다.
Plan Icon이라는 아이콘이 있었다. SVG로 내보냈더니 1.1MB. 열어보니 base64로 인코딩된 비트맵이 SVG 안에 들어 있었다. Figma에서 이미지 fill을 쓰면 이렇게 된다.

figma-doctor는 이걸 자동 감지한다. SVG가 50KB를 넘거나 base64 이미지를 포함하면 래스터로 판단하고, /v1/images?format=png&scale=2로 다시 요청해서 실제 PNG 파일로 저장한다.

1.1MB SVG → 13KB PNG @2x.

에이전트는 `<img src="./assets/Plan_Icon@2x.png">` 한 줄이면 된다. base64 변환 없음, URL 만료 없음, AI 추측 없음.

이게 왜 중요하냐면 — base64를 LLM에게 복사시키면 깨진다.
17,212자의 base64를 에이전트가 HTML에 넣으면 1~2글자가 바뀐다. LLM은 문자를 "복사"하는 게 아니라 토큰 단위로 "재생성"하기 때문이다. 의미 없는 문자열에서는 자기교정이 불가능하다. 1글자만 틀려도 이미지 전체가 깨진다.

그래서 LLM이 바이너리 데이터를 만질 이유가 없다.
파일은 파일로, 참조는 경로로. 이게 맞다.

---

CSS 값은 다른 문제다.

MCP와 figma-doctor의 CSS 값을 비교하면서 "어느 쪽이 더 정확한가"를 검증하려 했다. 결론은 — 둘 다 틀릴 수 있다. 같은 이름의 노드가 다른 depth에 있어서 다른 값을 읽는 경우, 부모와 자식 중 어느 쪽을 참조하느냐의 판단 차이, figma-doctor가 속성을 놓쳐서 MCP가 맞았던 경우도 있었다.

어떤 도구를 써서 구현하든, 결국 중요한 건 하나다 — 브라우저에서 렌더된 결과가 디자인과 같은가.

figma-doctor diff는 이걸 확인한다. Figma REST API 값과 브라우저의 getComputedStyle 실측값을 비교한다. MCP로 구현했든, 직접 코딩했든, 어떤 AI 도구를 썼든 상관없이 최종 렌더링 결과를 검증한다.

---

내가 쓰는 워크플로우.

```bash
# 1. 에셋을 실제 파일로 추출 — 이것만으로도 가치 있다
figma-doctor extract <figma-url> --out-dir ./assets

# 2. 원하는 방식으로 구현 (MCP, AI, 직접 코딩 — 뭐든)

# 3. 브라우저 렌더링 결과를 Figma와 대조
figma-doctor diff <page-name>
```

에셋은 figma-doctor. 구현은 자유. 검증은 figma-doctor.

---

AI 도구가 추상화에 추상화를 얹고 있다.
블랙박스가 늘어날수록 어디서 틀렸는지 찾기 어려워진다.

figma-doctor가 하려는 건 블랙박스를 하나 줄이는 것이다.

도구가 뭘 쓰든 최종 검증은 브라우저의 CSS 엔진이 계산한 값으로 해야 한다.
figma-doctor는 그 검증을 자동화한다.

GitHub: (링크)

#Figma #WebDevelopment #CSS #OpenSource #DeveloperTools #FigmaToCode #DesignEngineering
