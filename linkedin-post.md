Figma가 사실상 웹 개발 표준인 것이 점점 더 불편해지는 이유 — 그 후속.

지난 글에서 이런 이야기를 했다.

Figma MCP의 블랙박스를 통과하면 값이 달라진다. 오역, 미지원 속성 유입, 조용한 누락. 출발점과 도착점이 다른 엔진이라서. 그래서 REST API로 직접 읽고, getComputedStyle로 검증하는 워크플로우를 만들었다고.

그 글을 쓰고 나서 실제로 도구를 만들어 봤다.

만들다 보니 CSS 값 비교는 생각보다 복잡했다. REST API 값이 MCP보다 "원본에 가깝다"고 생각했는데, 그것도 아니었다. REST API 값 역시 Figma 내부 데이터의 직렬화일 뿐 원본이 아니다. 어떤 노드를 읽느냐에 따라 달라졌고, 같은 이름의 노드가 다른 depth에 존재하기도 했고, Figma의 데이터 모델을 잘못 해석하면 도구 쪽이 틀리는 경우도 있었다. REST API는 노드 트리를 그대로 주기 때문에 어떤 노드가 화면의 어떤 요소에 대응하는지 정확히 매핑하기가 어려웠다. 같은 이름의 노드 중 MCP가 선택한 쪽이 맞는 경우도 있었다.

CSS 값은 MCP든 REST API든 둘 다 Figma 내부의 해석이다. "어느 쪽이 더 정확한가"라는 질문 자체가 성립하지 않았다.

그런데 만드는 과정에서 가장 큰 병목은 CSS 값이 아니라 에셋이었다.

솔직히 Lucide나 Heroicons 같은 아이콘 라이브러리를 쓰고, Figma에서도 같은 라이브러리를 쓰면 에셋 문제는 크지 않다. 코드에서 <LucideArrowLeft />를 쓰면 되니까.

하지만 실무는 그렇지 않은 경우가 많다. 디자이너가 만든 커스텀 아이콘, 브랜드 로고, 제품 고유 일러스트, 이미지 fill이 들어간 배지 — 이런 벡터 에셋이 수십 개씩 있는 프로젝트에서 MCP로 구현하면 문제가 시작된다.

MCP로 디자인을 구현하면 아이콘이 이렇게 온다:

const imgIcon = "https://www.figma.com/api/mcp/asset/db4e7bc7-..."

7일 뒤에 만료되는 임시 URL이다.

다운받으면 되지 않냐고? 실제로 다운받아 봤다:

<svg preserveAspectRatio="none" width="100%" height="100%"
     viewBox="0 0 13.83 9.67">
  <path stroke="var(--stroke-0, #2D7FF9)" .../>
</svg>

이건 아이콘이 아니다.

viewBox가 24×24가 아니라 13.8×9.7로 잘려 있다. 고정 크기가 없어서 부모에 따라 찌그러진다. preserveAspectRatio="none"이라 비율도 안 맞는다. 색상이 CSS 변수(var(--stroke-0))라서 Figma 밖에서는 안 먹는다.

같은 아이콘을 Figma REST API의 /v1/images?format=svg로 직접 뽑으면:

<svg width="24" height="24" viewBox="0 0 24 24">
  <path stroke="#2D7FF9" .../>
</svg>

24×24 캔버스 그대로. 색상 확정. 어디 넣어도 된다.

래스터가 섞인 에셋은 더 심했다. SVG로 내보내면 1.1MB짜리가 나올 때가 있다. base64로 인코딩된 비트맵이 SVG 안에 들어 있는 건데, 이걸 AI한테 넘기면 17,212자의 base64를 HTML에 붙여넣다가 1~2글자가 바뀐다. LLM은 "복사"가 아니라 토큰 단위로 "재생성"하기 때문이다. 1글자만 틀려도 이미지가 깨진다.

그래서 figma-assets를 만들었다. 하는 일은 하나다. Figma에서 에셋을 뽑아서 실제 파일로 저장한다.

- 24×24 아이콘은 완전한 SVG 파일로
- 벡터가 중첩된 로고는 통째로 SVG 하나로
- 같은 컴포넌트 9개는 API 1번만 호출
- 비트맵이 박힌 SVG는 자동 감지해서 PNG @2x로
- API는 50개씩 묶고, 다운로드는 20개 동시에, 결과는 캐싱
- 디자인이 바뀌면 자동 감지 (추가 API 호출 없이)

나는 보통 CLI 도구를 선호한다. npx 한 줄이면 되고, CI에도 넣을 수 있고, 동작이 결정론적이니까. CLI를 에이전트가 쓰게 하려면 별도 스킬을 만들면 되긴 한다. 하지만 그것도 결국 사용자가 스킬을 만들고 등록하고 관리하는 병목이 생긴다.

그래서 이번에는 MCP 서버도 만들었다. 이 도구의 타겟이 AI 에이전트 사용자이기 때문이다. Cursor나 Claude Code로 Figma 디자인을 구현하는 사람이 매번 터미널에서 먼저 npx를 치거나, 스킬을 별도로 세팅하는 건 — 그 자체가 병목이다. MCP 서버로 등록해두면 에이전트가 알아서 호출한다. 사용자가 의식할 필요가 없다.

Claude Code나 Cursor MCP 설정에 한 줄 추가하면 된다:

{
  "mcpServers": {
    "figma-assets": {
      "command": "npx",
      "args": ["figma-assets", "--serve"],
      "env": { "FIGMA_TOKEN": "figd_..." }
    }
  }
}

MCP 없이 CLI로도 된다:

npx figma-assets "https://figma.com/design/..." -o ./assets

커스텀 에셋이 많은 프로젝트에서 한번 써보길. 아이콘 20개를 AI가 추측해서 다시 그리는 것과, 실제 파일을 경로로 참조하는 것의 차이를 느낄 수 있을 거다.

지난 글에서 "도구가 뭘 쓰든 최종 검증은 브라우저의 CSS 엔진이 계산한 값으로 해야 한다"고 썼다. CSS 값의 간극은 여전히 열려 있는 문제다. 하지만 에셋 병목이 해소되면 AI 에이전트를 활용한 Figma 구현 워크플로우의 많은 부분이 쾌적해질 것으로 기대한다.

처음엔 Figma와 CSS의 간극 전체를 해결하려 했다. 만들면서 가장 병목이 큰 지점에 집중하게 됐다.

GitHub: https://github.com/JungHoonGhae/figma-assets
npm: npx figma-assets

#Figma #MCP #SVG #OpenSource #DeveloperTools #AI #ClaudeCode #Cursor #DesignToCode
