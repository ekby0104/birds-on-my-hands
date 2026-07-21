# 손 위의 새 카메라 (Hand Bird Camera)

웹브라우저에서 카메라를 켜면 손바닥 위에 손그림 새가 앉고, 정수리에는 계란 후라이가 얹히는 AR 카메라.
직접 그린 그림을 등록해서 내 캐릭터로 바꿀 수도 있다.
인스타그램 릴스(실사 영상 + 손그림 캐릭터 합성) 스타일을 웹에서 실시간으로 구현.

## 기능

- **손바닥 인식** (최대 4개): 손바닥 중심에 캐릭터가 앉음, 손 거리에 따라 크기 변화
- **정수리 인식** (최대 4명): 머리 위에 계란 후라이 (기본 그림)
- **그림판**: 시작 화면에서 브라우저로 직접 그림 — 펜/마커/형광펜/크레용/스프레이, 16색 팔레트 + 컬러피커, 지우개/되돌리기. 손가락·애플펜슬 지원
- **손그림 페어 등록**: 그린 그림(또는 업로드한 사진)마다 부위(손바닥/정수리)를 선택. 여러 개 등록 가능
- **녹화**: 소리 포함 mp4 저장 (iOS 사진 앱에서 바로 재생). 마이크 거부 시 무음 녹화
- **세로 화면 대응**: 카메라가 가로 영상을 줘도 화면 비율에 맞게 자동 크롭

## 배포 — Railway (추천)

카메라(getUserMedia)는 **https에서만** 동작하므로 호스팅이 필요하다.
저장소에 정적 서빙용 `package.json`(`npx serve -l $PORT`)이 이미 포함되어 있다.

1. [railway.app](https://railway.app) 접속 → GitHub 계정으로 로그인
2. **New Project** → **Deploy from GitHub repo** → 이 저장소 선택
   - 처음이면 "Configure GitHub App"으로 저장소 접근 권한을 먼저 허용
3. 배포 브랜치 확인: 서비스 클릭 → **Settings** → Source에서 브랜치가 작업 브랜치(`claude/hand-bird-camera-ar-6a3ym1`)인지 확인. 기본값이 `main`이면 브랜치를 바꾸거나 main에 머지
4. **Settings → Networking → Generate Domain** 클릭
5. 생성된 `https://xxxx.up.railway.app` 주소를 Safari/Chrome에서 열면 끝

이후에는 브랜치에 푸시할 때마다 Railway가 자동으로 재배포한다.

## 배포 — GitHub Pages (대안)

1. 저장소 **Settings → Pages**
2. Source: "Deploy from a branch", 브랜치 선택, 폴더 `/ (root)` → Save
3. 1~2분 뒤 `https://<계정>.github.io/<저장소명>/` 접속
   (무료 계정은 저장소가 Public이어야 함. 저장소 이름을 바꾸면 주소도 바뀜)

## 로컬 실행

```bash
npx serve
# http://localhost:3000 접속 (localhost는 http여도 카메라 허용됨)
```

## 기술 스택

| 역할 | 기술 |
|---|---|
| 손 인식 | MediaPipe Hand Landmarker (`@mediapipe/tasks-vision@0.10.14`, CDN import, GPU delegate, VIDEO 모드, numHands: 4) |
| 얼굴 인식 | MediaPipe Face Detector (blaze_face_short_range) |
| 카메라 | `getUserMedia` (facingMode: user) + 화면 비율 맞춤 크롭 |
| 렌더링 | Canvas 2D — 매 프레임 비디오를 좌우반전으로 그린 뒤 그 위에 캐릭터 드로잉 |
| 녹화 | `MediaRecorder` + `canvas.captureStream(30)` + 마이크 트랙 → mp4 우선(iOS 호환), webm 폴백 |
| 그림판 | Canvas 2D + Pointer Events, 투명 배경 PNG로 내보내기 |
| 빌드 | 없음. 순수 HTML 단일 파일 (`index.html`), `<script type="module">` |

## 핵심 로직 (index.html)

- **새 위치**: 손목(랜드마크 0)과 중지 뿌리(랜드마크 9)의 중간 = 손바닥 중심
- **정수리 위치**: 얼굴 박스 윗변에서 박스 높이의 25%만큼 위 (박스 윗변은 이마 근처라서)
- **화면 크롭**: 카메라 원본에서 화면 비율에 맞는 가운데 영역만 사용. 랜드마크 좌표는
  `crop.w - (x * videoWidth - crop.x)` 식으로 크롭 오프셋 + 미러링을 함께 보정
- **크기**: 손목~중지 뿌리 픽셀 거리(정수리는 얼굴 폭)에 비례 → 가까워지면 캐릭터도 커짐
- **지터 제거**: 위치/크기에 lerp 스무딩 (`k = 0.35`)
- **손그림 애니메이션 느낌**: 시간을 83ms 단위로 양자화해 12fps처럼 뚝뚝 끊기게.
  위아래 bob, 좌우 tilt, 새는 주기적 눈 깜빡임
- **슬롯 구조**: 손바닥 4개 + 정수리 4개, phase를 다르게 줘서 움직임이 어긋나게. 미검출 시 즉시 숨김
- **커스텀 그림**: 등록된 부위는 기본 벡터 그림 대신 이미지 드로잉.
  같은 부위 여러 장이면 슬롯 인덱스로 순환 배정. 그림판 저장 시 투명 여백 자동 크롭
- **반투명 브러시**: 스트로크 시작 시점 이미지를 저장해두고 전체 경로를 매번 다시 그려 겹침 얼룩 방지

## 주의사항

- 캔버스 CSS 크기와 실제 해상도가 다름 — 좌표 계산은 항상 캔버스 픽셀 기준
- `detectForVideo`는 `video.currentTime` 변경 시에만 호출 (중복 추론 방지)
- 모델 로딩(최초 수 초)·카메라/마이크 권한 실패는 status 오버레이에 표시
- 모델은 CDN(jsdelivr, Google Storage)에서 로드하므로 오프라인에서는 동작하지 않음
