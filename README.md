# 🎵 음원 랭킹 (Music AI Ranking)

YouTube URL을 입력하면 곡 **제목 · 채널 · 조회수**를 자동으로 가져와,
**조회수 기준 랭킹**으로 보여주는 Next.js 사이트입니다.
각 항목을 클릭하면 원본 YouTube 영상으로 이동합니다.

## ✨ 특징

- YouTube URL 붙여넣기 → 제목/조회수 자동 수집 (**API 키 불필요**)
- **채널 URL 입력 시 최신 영상(최대 30개)을 한 번에 일괄 추가**
- **기본(대상) 채널이 항상 기본 표시** — 다른 채널을 넣으면 대상 채널과 **한 랭킹에서 비교** (대상/비교 배지로 구분)
- 조회수 내림차순 랭킹 자동 정렬
- 클릭 시 원본 YouTube로 이동
- SQLite에 자동 저장 (재실행해도 데이터 유지)
- 같은 URL 재등록 시 최신 조회수로 갱신, 삭제 지원

> 기본 대상 채널은 [lib/config.ts](lib/config.ts)의 `TARGET_CHANNEL`에서 변경할 수 있습니다.
> 사이트 최초 접속 시 대상 채널 영상이 자동으로 수집됩니다.

## 🚀 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 **http://localhost:3000** 접속.

> 프로덕션 실행은 `npm run build` 후 `npm run start`.

## 🧩 지원하는 URL 형식

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://music.youtube.com/watch?v=VIDEO_ID`
- 순수 11자리 영상 ID
- **채널**: `https://www.youtube.com/@handle` · `/channel/ID` · `/c/name` · `/user/name`

## 🗂️ 프로젝트 구조

```
app/
  layout.tsx            루트 레이아웃
  page.tsx              메인 UI (입력 폼 + 랭킹 목록)
  globals.css           스타일
  api/tracks/route.ts   GET(목록+대상정보) / POST(단건 추가)
  api/tracks/[id]/route.ts  DELETE(삭제)
  api/channel/route.ts  POST(채널 영상 일괄 추가/비교)
  api/seed/route.ts     POST(대상 채널 최초 자동 수집)
lib/
  config.ts             기본 대상 채널 설정
  db.ts                 SQLite 초기화 및 쿼리
  import.ts             채널 영상 수집·저장 (재사용 로직)
  youtube.ts            URL 파싱 + 영상 메타데이터 수집
data/
  ranking.db            SQLite 파일 (최초 실행 시 자동 생성)
```

## ⚙️ 기술 스택

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **Material Design 3** 테마 (Roboto · Material Symbols)
- 모바일 반응형 UI (Top App Bar, elevation, state layer)
- **better-sqlite3** (사전 빌드 바이너리 → 별도 컴파일 불필요)

## 📝 참고

- 조회수는 **곡을 추가한 시점** 기준으로 저장됩니다. 최신화하려면 같은 URL을 다시 추가하세요.
- 데이터는 `data/ranking.db`에 저장됩니다. 초기화하려면 이 파일을 삭제하세요.
- YouTube 페이지 구조 변경 시 수집이 실패할 수 있습니다(API 키 없이 페이지를 파싱하는 방식).
