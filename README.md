# 사이보그 파츠 로그라이크 (초안)

파츠 판에 파츠를 배치해 무기를 만드는 웹 액션 로그라이크의 허수아비 테스트 초안.
기획은 `docs/GAME_DESIGN.md`, 개발 계획은 `docs/DEVELOPMENT_PLAN.md`에 있다.

## 실행

Node.js가 필요하다.

```bash
npm install
```

```bash
npm run dev
```

터미널에 나오는 주소(기본 `http://localhost:5173`)를 브라우저로 연다.

## 검증

```bash
npm test
```

```bash
npm run build
```

## 구조

- `src/parts.ts`: 파츠 목록과 임시 수치.
- `src/board.ts`: 판, 화살표 범위, 자동 연계, 연쇄 상한.
- `src/game.ts`: 이동, 허수아비, 투사체, 폭발·분열·화상, DPS.
- `src/ui.ts`: 판 화면, 파츠 고르기, 화살표 표시.
