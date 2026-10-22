# renameAB Web

Flow cytometry 원본 파일을 **서버에 업로드하지 않고**, 브라우저 안에서만 이름 변경한 복사본을 ZIP으로 만드는 정적 웹앱입니다. 기존 `renameAB.R` 및 Shiny `app.R`의 Human/Canine/Feline 항체 라벨과 순서를 유지합니다.

## 주요 기능

- Human(11개), Canine(11개), Feline(8개) 패널 지원
- Sample ID 접두어에 따른 패널 자동 선택: `AS` → Human, `C` → Canine, `F` → Feline
- 원본 파일명을 오름차순으로 정렬한 뒤 패널 순서대로 매핑
- 다운로드 전 `원본 파일명 → 변경 후 파일명` 전체 미리보기
- 파일 수, Sample ID, 중복 파일명, 확장자, ZIP 크기 오류 검증
- Sample ID가 포함되지 않은 파일 제외 안내
- 초기화 및 `ReName Rawdata` 폴더를 포함한 ZIP 다운로드
- 서버, 데이터베이스, 분석 로그, 외부 JavaScript 라이브러리 없음

> 이름이 바뀌는 대상은 ZIP 안의 복사본뿐입니다. 사용자가 선택한 원본 파일은 수정되지 않습니다.

## 변환 규칙

파일은 브라우저가 전달한 순서를 그대로 쓰지 않고 **원본 파일명 오름차순**으로 정렬합니다. 그 순서에 아래 라벨을 하나씩 배정합니다.

### Human · 11 files

1. `_Unstained(-FVD)`
2. `_Unstained(+FVD)`
3. `_CD3_CD5`
4. `_CD34_CD20`
5. `_CD4_CD8`
6. `_CD19_CD45_CD47`
7. `_Con19_Con45_Con47`
8. `_Con4_Con8`
9. `_Con3_34_Con5_20`
10. `_CD79a`
11. `_Con79a`

### Canine · 11 files

1. `_Unstained(-FVD)`
2. `_Unstained(FVD)`
3. `_CD3_CD4_CD8`
4. `_CD21_CD34_MHCII`
5. `_CD5_CD45_CD14`
6. `_Con5_Con45_Con14`
7. `_Con21_Con34_ConMHCII`
8. `_Con3_Con4_Con8`
9. `_CD45`
10. `_CD79a`
11. `_Con79a`

### Feline · 8 files

1. `_Unstained(-FVD)`
2. `_Unstained(FVD)`
3. `_CD4_CD8_CD18`
4. `_CD5_CD21_CD18`
5. `_CD3_CD14`
6. `_Con3_Con14`
7. `_Con5_Con21_Con18`
8. `_Con4_Con8_Con18`

새 파일명 형식은 다음과 같습니다.

```text
{Sample ID}{항체 라벨}.{원본 확장자}
```

예: `C0598_CD3_CD4_CD8.fcs`

## 로컬 실행

### 가장 간단한 방법

`index.html`을 Chrome, Edge, Firefox 또는 Safari에서 직접 엽니다. 별도 설치나 빌드가 필요 없습니다.

### 로컬 웹 서버로 실행

이 폴더에서 다음 명령을 실행합니다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## 사용 방법

1. Sample ID를 입력합니다.
2. 자동 선택된 패널이 맞는지 확인합니다. 필요하면 직접 바꿉니다.
3. 해당 패널의 원본 파일을 한 번에 선택하거나 드래그합니다.
4. 파일 순서 매핑 미리보기를 확인합니다.
5. `ZIP 다운로드`를 누릅니다.

파일 수가 패널 규칙과 다르거나 파일명에 Sample ID가 없으면 다운로드가 비활성화되고 오류가 표시됩니다.

## GitHub Pages 배포

### 방법 1 · 저장소 루트에 배포

1. 이 폴더의 `index.html`, `styles.css`, `app.js`, `README.md`를 GitHub 저장소 루트에 올립니다.
2. GitHub 저장소의 **Settings → Pages**로 이동합니다.
3. **Build and deployment**의 Source를 **Deploy from a branch**로 선택합니다.
4. Branch를 `main`, 폴더를 `/(root)`로 선택하고 저장합니다.
5. 잠시 후 Pages 화면에 표시되는 주소로 접속합니다.

### 방법 2 · `docs` 폴더에 배포

파일을 저장소의 `docs/` 아래에 두고 Pages 설정에서 `main` / `/docs`를 선택해도 됩니다.

이 앱은 상대 경로만 사용하므로 사용자 사이트와 프로젝트 사이트 모두에서 동작합니다. GitHub Pages가 제공하는 것은 HTML/CSS/JavaScript뿐이며, 사용자가 선택한 파일은 GitHub로 전송되지 않습니다.

## 개인정보 및 기술적 제한

- 파일 읽기, CRC 계산, ZIP 생성은 현재 브라우저에서만 수행됩니다.
- 네트워크 요청을 수행하는 앱 코드와 외부 런타임 의존성이 없습니다.
- ZIP은 호환성이 높은 무압축(Store) 방식입니다. 따라서 ZIP 크기는 원본 파일 전체 크기와 비슷합니다.
- 현재 구현은 ZIP64를 사용하지 않으므로 개별 파일 또는 전체 ZIP이 4 GB를 넘으면 처리하지 않습니다.
- ZIP 생성 중에는 CRC 계산을 위해 각 파일을 차례로 메모리에서 읽습니다. 매우 큰 파일은 충분한 기기 메모리가 필요합니다.

## 파일 구성

```text
renameAB-web/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## 참고한 기존 동작

- `renameAB.R`: Sample ID 포함 파일 필터, 종별 패널 라벨 및 순서, `ReName Rawdata` 결과 폴더
- Shiny `app.R`: 명시적 파일명 정렬, 파일 수/중복/확장자 검증, ZIP 다운로드, Sample ID 접두어 기반 패널 선택

