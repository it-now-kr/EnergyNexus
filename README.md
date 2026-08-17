# Energy Nexus 홈페이지 (1차 오픈)

초안 문서 기준으로 만든 단일 페이지(SPA)입니다. 회사소개, 인사말, 서비스, 인사이트, 문의하기가 한 화면 안에서 이동합니다.

Google Sites는 자체 페이지 빌더보다 **전체 페이지 삽입(Full page embed)** 이 이 사이트에 맞습니다. 사이트 HTML을 코드 칸에 붙여 넣기에는 용량이 크고, iframe 높이가 고정되므로 호스팅 URL을 넣는 방식을 권장합니다.

## 로컬 확인

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173` 을 엽니다.

## 공개 정보 입력

`assets/config.js` 만 수정하면 됩니다.

- `email`, `phone`, `bizNumber`, `addressDetail`
- 인사이트 원문 주소: `insightLinks`
- Google 설문지: `googleFormUrl` · `googleFormAction` · `googleFormFields` (문의 화면에서 바로 접수)

값이 비어 있으면 화면에 “준비 중”으로 표시됩니다.

## Google Sites에 올리는 방법

1. 이 폴더를 GitHub Pages, Cloudflare Pages, Firebase Hosting 등 HTTPS 주소로 배포합니다.
2. [Google Sites](https://sites.google.com)에서 새 사이트를 만듭니다.
3. 기본 제목 영역은 지우거나 최소화합니다.
4. 오른쪽 **페이지 → 추가 → 전체 페이지 삽입**.
5. 배포한 사이트 URL을 넣고 삽입한 뒤 게시합니다.

페이지 중간 삽입을 쓸 경우, 임베드 상자 높이를 충분히 늘려야 합니다. 사이트 내부 스크롤과 Google Sites 스크롤이 겹치면 전체 페이지 삽입으로 바꾸는 것이 낫습니다.

문의 화면은 기존 레이아웃을 유지하고, 제출 시 [홈페이지 문의 양식](https://docs.google.com/forms/d/e/1FAIpQLSehrVC28O0TsfrhHbXg6JAgaAqX98ZPKW1oDIEn5mRxoVfdqQ/viewform)으로 접수됩니다. 응답은 Google 설문지 또는 연결된 스프레드시트에서 확인합니다.

## 1차 오픈 전 확인할 항목

- 대표 이메일, 전화번호, 사업자등록번호, 본점 상세 주소
- 설계·감리 등 등록업무 공개 문구
- 인사이트 게시물 링크
- 개인정보처리방침 최종 검토
- PC / 모바일 화면
