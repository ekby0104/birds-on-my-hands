# 개발 문서

## 로컬 실행

```bash
npx serve
# http://localhost:3000 접속 (localhost는 http여도 카메라 허용됨)
```

카메라(getUserMedia)는 **https 또는 localhost**에서만 동작한다.

## 배포 — Railway

저장소에 정적 서빙용 `package.json`(`npx serve -l $PORT`)이 포함되어 있다.

1. [railway.app](https://railway.app) 접속 → GitHub 계정으로 로그인
2. **New Project** → **Deploy from GitHub repo** → 이 저장소 선택
3. 서비스 **Settings → Source**에서 배포 브랜치 확인
4. **Settings → Networking → Generate Domain**
5. 이후 브랜치에 푸시할 때마다 자동 재배포

## 배포 — GitHub Pages (대안)

1. 저장소 **Settings → Pages**
2. Source: "Deploy from a branch", 브랜치 선택, 폴더 `/ (root)` → Save
3. `https://<계정>.github.io/<저장소명>/` 접속 (무료 계정은 Public 저장소만 가능)

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
  `crop.w - (x * videoWidth - crop.x)` 식으로 크롭 오프셋 + 미러링을 함께 보정.
  원본의 30% 이상은 잘라내지 않고 나머지는 레터박스 (과도 확대 방지)
- **크기**: 손목~중지 뿌리 픽셀 거리(정수리는 얼굴 폭)에 비례 → 가까워지면 캐릭터도 커짐
- **지터 제거**: 위치/크기에 lerp 스무딩 (`k = 0.35`)
- **손그림 애니메이션 느낌**: 시간을 83ms 단위로 양자화해 12fps처럼 뚝뚝 끊기게.
  위아래 bob, 좌우 tilt, 새는 주기적 눈 깜빡임
- **주먹 제스처**: 손끝(8/12/16/20)이 중간 관절(6/10/14/18)보다 손목에 가까우면 접힌 손가락,
  3개 이상이면 주먹. fist 값(0~1)을 lerp로 전환해 찌부 스케일 + >< 눈 렌더링
- **슬롯 구조**: 손바닥 4개 + 정수리 4개, phase를 다르게 줘서 움직임이 어긋나게. 미검출 시 즉시 숨김
- **커스텀 그림**: 등록된 부위는 기본 벡터 그림 대신 이미지 드로잉.
  같은 부위 여러 장이면 슬롯 인덱스로 순환 배정. 그림판 저장 시 투명 여백 자동 크롭
- **눈 깜빡임(커스텀)**: 눈 위치를 탭으로 지정하면, 깜빡일 때 주변 최빈색으로 덮고 가로선을 그림
- **반투명 브러시**: 스트로크 시작 시점 이미지를 저장해두고 전체 경로를 매번 다시 그려 겹침 얼룩 방지

## 주의사항

- 캔버스 CSS 크기와 실제 해상도가 다름 — 좌표 계산은 항상 캔버스 픽셀 기준
- `detectForVideo`는 `video.currentTime` 변경 시에만 호출 (중복 추론 방지)
- iOS는 카메라 모드를 가로 기준으로 고른 뒤 기기 방향에 맞춰 회전해주므로,
  세로 비율을 강제로 요청하면 안 됨. 회전 시 카메라 재연결도 금지 (멈춤 원인) — 크롭만 재계산
- 모델 로딩(최초 수 초)·카메라/마이크 권한 실패는 status 오버레이에 표시
- 모델은 CDN(jsdelivr, Google Storage)에서 로드하므로 오프라인에서는 동작하지 않음
