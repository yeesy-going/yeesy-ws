# 와인 가격 비교

와인 메뉴판·와인병 사진, 엑셀(.xlsx), PDF, 텍스트 등 무엇이든 올리면 와인을 인식해 표로 정리하고,
Wine-Searcher 평균가 대비 비율을 계산해 높은 순으로 보여주는 웹앱.

| 입력 와인명 | 영어 이름 | 내 가격 | 서쳐가 | 서쳐가 대비 |
|---|---|---|---|---|

- **영어 이름**: Wine-Searcher 표기에 맞춘 이름. 누르면 해당 Wine-Searcher 페이지가 열린다.
- **서쳐가**: Wine-Searcher에서 본 평균가를 직접 입력한다 (All 빈티지 · Worldwide · KRW · Inc. tax 기준으로 볼 것).
- **서쳐가 대비**: 내 가격 ÷ 서쳐가. 입력 자료에 가격이 있을 때만 계산된다.

## 실행

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local`에 Claude API 키(`ANTHROPIC_API_KEY`)를 넣은 뒤:

```bash
npm run dev
```

http://localhost:3000 에서 사용.

## 구조

- `app/page.tsx` — 화면 (업로드, 결과 표, CSV 저장)
- `app/api/extract/route.ts` — 입력에서 와인 목록을 뽑는 API
- `lib/extract.ts` — Claude 호출 (이미지·PDF·텍스트 → 와인 목록)
- `lib/files.ts` — 브라우저에서 파일을 Claude가 읽을 형태로 변환 (사진 축소, 엑셀 → 텍스트)
- `lib/ratio.ts` — 비율 계산, 정렬, Wine-Searcher 링크 생성

## 테스트

```bash
npm test
```
