# 손 위의 새 카메라 (Hand Bird Camera)

웹브라우저에서 카메라를 켜면 손바닥 위에 손그림 스타일의 새가 앉아 있는 AR 효과 앱.
인스타그램 릴스(실사 영상 + 손그림 캐릭터 합성) 스타일을 웹에서 실시간으로 구현.

## 실행

카메라(getUserMedia)는 **https 또는 localhost**에서만 동작합니다.

- 로컬: `npx serve` 실행 후 `http://localhost:3000/hand-bird-camera.html`
- Railway: 저장소 연결 후 Generate Domain (포함된 `package.json`이 정적 서빙)
- GitHub Pages: Settings → Pages에서 브랜치 지정

## 기술 스택

| 역할 | 기술 |
|---|---|
| 손 인식 | MediaPipe Hand Landmarker (`@mediapipe/tasks-vision@0.10.14`, CDN import, GPU delegate, VIDEO 모드, numHands: 2) |
| 카메라 | `getUserMedia` (facingMode: user, 720x1280) |
| 렌더링 | Canvas 2D — 매 프레임 비디오를 좌우반전으로 그린 뒤 그 위에 새를 벡터로 직접 드로잉 |
| 녹화 | `MediaRecorder` + `canvas.captureStream(30)` → webm (vp9 우선, Safari는 mp4 폴백) 다운로드 |
| 빌드 | 없음. 순수 HTML 단일 파일, `<script type="module">` |

## 핵심 로직 (hand-bird-camera.html)

- **새 위치**: 손목(랜드마크 0)과 중지 뿌리(랜드마크 9)의 중간 = 손바닥 중심
- **좌우반전 보정**: 캔버스를 셀피 모드로 미러링하므로 랜드마크 x좌표는 `(1 - x) * canvas.width`
- **새 크기**: 손목~중지 뿌리 픽셀 거리에 비례 (`h = size * 2.1`) → 손이 가까워지면 새도 커짐
- **지터 제거**: 위치/크기에 lerp 스무딩 (`k = 0.35`)
- **손그림 애니메이션 느낌**: 애니메이션 시간을 83ms 단위로 양자화해 12fps처럼 뚝뚝 끊기게 함
  - 위아래 bob (sin), 좌우 tilt (sin), 주기적 눈 깜빡임(blink)
- **새 드로잉**: bezierCurve로 물방울형 몸통(크림색 #fdf8e4 + 굵은 외곽선 #1a1712), 흰 눈 2개, 주황 삼각 부리
- **양손 지원**: birds 배열 2개, 각각 phase를 다르게 줘서 움직임이 어긋나게 함
- **손 미검출 시**: `b.active = false`로 즉시 숨김

## 다음 작업 후보

1. **iOS 녹화 호환**: webm은 iOS에서 재생 불가할 수 있음 → mp4 저장 지원 (mp4-muxer/ffmpeg.wasm 검토)
2. **새 디자인 교체**: 캔버스 벡터 드로잉 대신 PNG/SVG 스프라이트 이미지 사용 옵션
3. **등장/퇴장 애니메이션**: 손이 인식되면 새가 날아와서 착지, 사라지면 날아감
4. **제스처 인식**: 주먹 쥐면 새가 날아가는 등 손 모양(랜드마크 각도) 기반 인터랙션

## 주의사항

- 캔버스 CSS 크기와 실제 해상도(`video.videoWidth/Height`)가 다름 — 좌표 계산은 항상 캔버스 픽셀 기준
- `detectForVideo`는 `video.currentTime` 변경 시에만 호출 (중복 추론 방지)
- 모델 로딩(최초 수 초)과 카메라 권한 실패 시 status 오버레이에 에러 표시
