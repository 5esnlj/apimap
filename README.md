# 어디까지?

출발지와 도착지를 검색해 자동차 경로 거리를 확인하는 정적 웹앱입니다.

## 실행

`index.html`을 브라우저에서 열거나 이 폴더를 Vercel에 가져오면 됩니다. 빌드 명령, 서버리스 함수, Redis, API 키, 환경변수는 필요하지 않습니다.

## 배포

GitHub에 이 폴더를 저장소로 올린 뒤 Vercel에서 해당 저장소를 Import하면 됩니다. 정적 HTML 앱이므로 별도 빌드 설정 없이 기본값으로 배포할 수 있습니다.

## 데이터 제공자 및 이용 안내

- 장소 검색: [Nominatim](https://nominatim.openstreetmap.org/)
- 자동차 경로: [OSRM demo server](https://router.project-osrm.org/)
- 지도 데이터: [OpenStreetMap](https://www.openstreetmap.org/copyright)

검색은 공개 Nominatim 서버의 이용 정책을 고려해 자동완성 없이 사용자가 직접 요청하도록 했고, 한 브라우저에서 검색 요청 간 최소 1.1초 간격을 둡니다. 경로는 OSRM 공개 데모 서버의 자동차 경로를 사용하므로 서비스 가용성이나 응답 속도는 보장되지 않습니다. 서비스 규모가 커지면 각 제공자의 이용 정책을 확인하고 별도 서비스나 자체 호스팅으로 전환해야 합니다.
