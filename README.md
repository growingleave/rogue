# 사이보그 파츠 로그라이크 (초안)

파츠 판에 파츠를 배치해 무기를 만드는 웹 액션 로그라이크의 허수아비 테스트 초안.
기획은 `docs/GAME_DESIGN.md`, 개발 계획은 `docs/DEVELOPMENT_PLAN.md`에 있다.

## 바로 플레이

https://growingleave.github.io/rogue/

`main` 브랜치에 올라가면 GitHub Actions가 자동으로 빌드·테스트 후 위 주소에 배포한다.

## 로컬 실행

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

- `src/parts.ts`: 파츠 목록, 파츠별 수치와 화면에 보여줄 수치 설명.
- `src/tuning.ts`: 공통 임시 수치(이동속도, 레이저, 폭발·분열 비율 등).
- `src/laser.ts`: 레이저 경로(유도로 구부러짐, 분열로 갈라짐).
- `src/board.ts`: 판, 와이어 규칙, 자동 연계, 발동 간격.
- `src/game.ts`: 이동, 허수아비, 투사체·레이저, 폭발·분열·화상·관통·유도, DPS.
- `src/ui.ts`: 판 화면, 파츠 고르기, 와이어 긋기.
