figma-assets — Figma에서 프로덕션용 SVG/PNG를 뽑아주는 MCP 서버 & CLI를 만들었습니다.

Cursor, Claude Code 등 AI 에이전트로 Figma 공식 MCP를 써보신 분들은 아실 겁니다. 현재 Figma 공식 MCP의 가장 큰 병목은 에셋입니다.

이전에 MCP의 CSS 값 변환 문제에 대해 쓴 적이 있는데 (https://www.linkedin.com/feed/update/urn:li:activity:7442802208674598912/), 직접 도구를 만들어보니 에셋이 더 심각했습니다.

아이콘이 7일 뒤 만료되는 임시 URL로 오기 때문에 대부분의 AI 에이전트는 아이콘을 "보고 비슷하게" 추측해서 다시 그립니다. viewBox도 다르고, path도 다르고, stroke-width도 다릅니다. 비슷하지만 같지 않습니다.

그럼 URL을 직접 다운받으면 되지 않냐고요? 실제로 다운받아 봤는데요:

preserveAspectRatio="none" width="100%" height="100%"
viewBox="0 0 13.83 9.67"
stroke="var(--stroke-0, #2D7FF9)"

24×24 캔버스가 13.8×9.7로 잘려 있고, 고정 크기가 없고, 색상이 CSS 변수입니다. 아이콘이라기보다 path 조각에 가깝습니다.

같은 아이콘을 Figma REST API의 /v1/images?format=svg로 뽑으면:

width="24" height="24" viewBox="0 0 24 24"
stroke="#2D7FF9"

캔버스가 그대로 유지되고, 색상이 확정되어 있어서 바로 쓸 수 있습니다. MCP는 컴포넌트 내부의 path만 잘라서 주고, REST API는 노드 전체를 이미지로 export하기 때문에 같은 아이콘이어도 내보내는 방식이 다릅니다.

Lucide 같은 아이콘 라이브러리를 쓰면 큰 문제는 없습니다. 하지만 디자이너가 만든 커스텀 아이콘, 브랜드 로고, 이미지 fill이 들어간 배지 — 실무에서는 이런 벡터 에셋이 수십, 수백 개가 되기도 합니다. 그때부터 이야기가 달라집니다.

래스터 이미지도 문제였습니다. SVG 안에 base64 비트맵이 들어 있으면 1.1MB가 되는데, AI 에이전트가 이걸 HTML에 붙여넣으면 1~2글자가 바뀝니다. LLM은 복사가 아니라 토큰 단위로 재생성하기 때문입니다. 1글자만 달라져도 이미지 전체가 깨집니다.

figma-assets를 만들었습니다.

Figma에서 에셋을 뽑아서 실제 파일로 저장하는 도구입니다.

- 완전한 SVG 파일 (24×24 캔버스, 확정된 색상)
- 벡터가 중첩된 로고는 통째로 SVG 하나로
- 같은 컴포넌트는 API 1번만 호출하고 나머지는 복사
- 비트맵이 포함된 SVG는 자동 감지해서 PNG @2x로 변환 (1.1MB → 13KB)
- API 배치 호출, 병렬 다운로드, 캐싱, 디자인 변경 자동 감지

참고로 CSS 값 비교도 시도해 봤는데, REST API 값도 Figma 내부 데이터의 직렬화일 뿐 원본이 아니었습니다. 노드 트리에서 어떤 노드가 화면의 어떤 요소에 대응하는지 매핑하기가 어려웠고, MCP가 선택한 쪽이 맞는 경우도 있었습니다. CSS 값은 MCP든 REST API든 둘 다 Figma 내부의 해석이라, 에셋에 집중하게 됐습니다.

저는 보통 CLI 도구를 선호하는 편입니다. MCP 서버는 상시 프로세스가 떠 있어야 하고, 에이전트의 컨텍스트 윈도우를 tool description으로 잡아먹고, 서버 연결도 관리해야 합니다. CLI는 필요할 때 실행하고 끝이니까요.

그런데 이번에는 MCP 서버도 같이 만들었습니다. CLI를 에이전트가 쓰려면 별도 스킬을 만들어야 하는데, 그걸 사용자가 직접 만들고 등록하고 관리하는 것 자체가 또 하나의 병목이라고 판단했습니다. MCP로 한번 등록해두면 에이전트가 알아서 호출합니다:

{
  "mcpServers": {
    "figma-assets": {
      "command": "npx",
      "args": ["figma-assets", "--serve"],
      "env": { "FIGMA_TOKEN": "figd_..." }
    }
  }
}

물론 CLI로도 쓸 수 있습니다: npx figma-assets "<url>" -o ./assets

에셋 병목이 해소되면 AI 에이전트를 활용한 Figma 구현 워크플로우의 많은 부분이 쾌적해질 것으로 기대합니다. 커스텀 에셋이 많은 프로젝트에서 한번 써보시면 차이를 느끼실 수 있을 겁니다.

GitHub: https://github.com/JungHoonGhae/figma-assets
npm: npx figma-assets

#Figma #MCP #SVG #OpenSource #DeveloperTools #AI #DesignToCode
