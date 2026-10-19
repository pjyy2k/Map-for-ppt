# Map for PPT

PPT 슬라이드에 넣을 지도를 만드는 **정적 웹 지도 편집기**입니다. 회원가입, 백엔드, 지도 API 키 없이 브라우저에서 동작합니다.

## 기능

- **선택 단위:** 대륙, 국가·지역, 시도·주 등 1차 행정구역.
- **지도 범위:** 전 세계, 대륙 한 곳, 국가 한 곳. 한국 17개 시도를 포함한 행정구역을 제공합니다.
- 검색, 체크박스, 지도 클릭으로 지역 선택. 검색 결과 전체 선택·해제.
- 색칠, 단색 깃발 표식, 테두리 강조. 전체 선택 지역 또는 개별 지역별 색상·스타일 조정.
- 육지·경계·배경색, 경계 두께, 깃발 크기 조정.
- 알래스카·하와이·그린란드·남극 표시/숨김. 미국 단독 지도에서는 알래스카·하와이를 삽입 지도로 표시하는 옵션.
- 지역별 가장 큰 육지만 표시하는 옵션. 군도 국가에서도 여러 섬을 생략하므로 필요한 경우에만 켜세요.
- 지도 제목, 선택 지역 이름, 범례, 확대·축소·이동, 선택 지역에 맞춤.
- **PNG:** 가로 1920 / 3840 / 7680 px, 투명 또는 지정 배경색.
- **SVG:** 벡터 다운로드. PPT에서 확대해도 선명한 지도.
- **캔버스:** 16:9 / 4:3 / 1:1.
- 설정과 선택을 브라우저에 자동 저장. JSON 파일로 작업 저장·불러오기.

## 실행

배포할 파일은 `public/` 안에 모두 있습니다. 운영 시 Node.js나 npm 설치, 빌드 과정이 필요하지 않습니다. 파일을 직접 더블클릭하는 `file://` 실행은 지원하지 않습니다. HTTP 서버로 열어주세요.

```bash
python3 -m http.server 8080 --directory public
```

브라우저에서 `http://localhost:8080`에 접속합니다.

## Coolify 배포

### Dockerfile 방식

1. 이 GitHub 저장소를 새 Application으로 연결합니다.
2. Build Pack을 **Dockerfile**로 선택합니다.
3. Dockerfile 경로는 `/Dockerfile`, Build Context는 저장소 루트(`/`)로 지정합니다.
4. **Ports Exposes: `80`**으로 설정합니다. Nginx가 컨테이너 내부의 80번 포트에서 서비스합니다.
5. 도메인을 연결하고 Deploy합니다.

별도의 환경변수나 데이터베이스는 필요하지 않습니다. URL 하위 경로에서도 상대 경로로 동작합니다.

### 정적 호스팅

Cloudflare Pages 등에서는 빌드 명령을 비우고 출력/게시 디렉터리를 **`public`**으로 지정합니다. GitHub Pages를 사용하는 경우 `public/` 내용을 Pages 게시 디렉터리로 배포하세요. `.mjs` 파일은 JavaScript MIME 타입으로 제공해야 합니다. 포함된 Nginx 설정은 이를 처리합니다.

## 사용 흐름

1. 국가 또는 대륙 단위로 강조하거나, 시도 단위를 골라 국가를 선택합니다.
2. 지역 체크박스를 선택하거나 지도에서 직접 클릭합니다.
3. 오른쪽에서 강조 방식·색상을 변경합니다. 현재 단위에서 선택한 지역 전체에 적용됩니다.
4. 지도 아래의 선택 지역 카드에서 지역별 색상·방식을 조정할 수 있습니다.
5. 분리 지역, 이름·범례, 투명 배경, 비율을 정한 뒤 PNG 또는 SVG를 다운로드합니다.
6. PPT에서 **삽입 → 그림**으로 파일을 넣습니다.

단위별 선택은 서로 독립적으로 유지됩니다. 국가 단위에서 현재 범위 밖이거나 숨겨진 선택은 아래 카드에 `숨김`으로 표시되며 내보내기에는 나타나지 않습니다. 시도 단위의 카드에는 현재 국가의 선택만 표시됩니다. 전체 선택·해제는 **현재 검색 결과**에 적용됩니다. 초기화는 모든 단위의 선택과 설정을 지웁니다. 확대·이동 위치는 내보내기에 반영되지만 작업 파일에는 저장되지 않습니다. 범례는 두 줄까지 표시하며 초과 지역 수를 표시합니다.

브라우저별 글꼴에 따라 한글 레이블의 모양이 달라질 수 있습니다. SVG에는 별도 글꼴 파일을 포함하지 않습니다. 대형 PNG 생성 중 메모리가 부족하면 해상도를 낮추거나 SVG를 사용하세요. 최신 Chrome, Edge, Firefox, Safari를 대상으로 작성했습니다.

## 지도 데이터와 제한

- 출처: [Natural Earth](https://www.naturalearthdata.com/), [Natural Earth vector repository](https://github.com/nvkelso/natural-earth-vector).
- 국가: `ne_50m_admin_0_countries.geojson`, **242개 국가·지역 피처**.
- 행정구역: `ne_10m_admin_1_states_provinces.geojson`, 원본 기준 **4,596개 피처 / 251개 국가·지역 코드**. 국가 선택기에 있는 국가 중 대응하는 코드가 있는 경우 제공하며, 국가마다 행정구역의 명칭과 단계가 다를 수 있습니다.
- 준비일: 2026-10-19. 원본 SHA-256과 국가별 행정구역 개수는 `public/data/manifest.json`에 기록했습니다.
- 전체 배포 데이터는 약 5 MB이며 시도 파일은 선택한 국가별로 지연 로드합니다.
- 원본의 지형 경계를 토폴로지를 유지하며 간소화하고 D3에 맞는 좌표 방향으로 변환했습니다. 강원·전북 표시는 특별자치도 명칭으로 조정했습니다. 경계는 원본 기준입니다.
- **발표용 개략 지도**입니다. 공식 국경·행정 경계 확인용이 아니며 최신 개편이나 분쟁 관련 입장을 반영하지 않을 수 있습니다. 일부 초소형 지역·섬은 생략됩니다.
- 선택 단위의 `깃발`은 국기 이미지가 아닌 사용자가 정한 색상의 위치 표식입니다.
- Natural Earth 데이터는 [퍼블릭 도메인](https://www.naturalearthdata.com/about/terms-of-use/)입니다. D3는 `public/vendor/D3-LICENSE`의 라이선스를 따릅니다.

## 개발 및 검증

Node.js 22 이상을 권장합니다. 개발용 의존성은 테스트와 지도 데이터 준비에만 사용합니다.

```bash
npm ci
npm run check
npm test
```

검증 항목:

- 모든 국가·행정구역 데이터의 피처 수, 국가 코드, 지도 좌표 방향.
- 한국 17개 시도와 세종 포함 여부.
- 알래스카·하와이·그린란드·남극·주요 육지 표시 필터.
- DOM 환경에서 지도 선택, 스타일 변경, 단위·범위 전환, 선택 상태 유지.
- SVG 직렬화와 실제 PNG 인코딩의 해상도·투명도.
- 작업 파일 유효성 검사.

DOM 및 이미지 변환 테스트는 실제 브라우저의 화면 배치와 다운로드 동작 검증을 대체하지 않습니다. 배포 후 사용하는 브라우저에서 지도 선택, 드래그, PNG/SVG 다운로드와 PPT 삽입을 확인하세요.

### 지도 데이터 다시 준비하기

아래 원본 GeoJSON을 로컬에 다운로드한 후 실행합니다. 준비일과 SHA-256 기록도 검토하세요.

- `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson`
- `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson`

```bash
npm run prepare-data -- /path/to/countries.geojson /path/to/admin1.geojson
npm test
```

## 파일 구성

```text
public/
  index.html        편집 화면
  styles.css        반응형 스타일
  app.js            지도 렌더링·상호작용·다운로드
  core.mjs          상태 검증·지도 데이터 필터
  data/             국가·국가별 시도 GeoJSON
  vendor/           D3와 라이선스
scripts/            지도 데이터 준비
tests/             기능·데이터 검증
Dockerfile          Nginx 정적 호스팅
nginx.conf          포트·MIME·압축 설정
```

운영자: **JinYoungPark** · [GitHub](https://github.com/pjyy2k/Map-for-ppt)
