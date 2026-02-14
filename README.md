# 🏫 동성초등학교 온라인 승낙서 관리 시스템

학부모와 교감선생님이 온라인으로 쉽게 이용할 수 있는 승낙서 관리 시스템입니다.

## 📋 주요 기능

### 1. 학부모 페이지 (👨‍👩‍👧)
- **학생 인증**: 학번과 이름으로 간편 로그인
- **신청서 작성**: 3가지 유형의 신청서 작성
  - 📱 휴대전화 소지 승낙서
  - 💻 태블릿PC 소지 승낙서
  - 🚪 정문출입 허가서
- **허가서 다운로드**: 승인된 신청서를 PDF로 인쇄

### 2. 교감 승인 페이지 (✅)
- **비밀번호 인증**: 관리자 권한 확인
- **신청서 승인**: 대기 중인 신청서 검토 및 승인
- **신청서 반려**: 필요시 반려 및 사유 입력
- **현황 모니터링**: 실시간 신청 현황 확인

### 3. 관리 페이지 (⚙️)
- **학생 명단 관리**: CSV 업로드 또는 개별 추가
- **승인 모드 설정**: 자동 발급 또는 승인 필요 선택
- **통계 대시보드**: 신청 현황 시각화
- **문서 관리**: 규정/양식 업로드 (추후 업데이트)

## 🚀 설치 및 실행

### 1. 환경 설정

```bash
# Python 3.9 이상 필요

# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 또는
venv\Scripts\activate  # Windows

# 패키지 설치
pip install -r requirements.txt
```

### 2. 데이터베이스 초기화

```bash
python -c "from database.db_manager import init_database; init_database()"
```

### 3. 로컬 실행

```bash
streamlit run app.py
```

브라우저에서 `http://localhost:8501`에 접속하세요.

### 4. 관리자 비밀번호 설정

`.streamlit/secrets.toml` 파일 생성:

```toml
ADMIN_PASSWORD = "your_secure_password_here"
```

**주의**: 이 파일은 절대 Git에 커밋하지 마세요. `.gitignore`에 이미 추가되어 있습니다.

## 📊 학생 명단 업로드

**CSV 파일 형식** (UTF-8 또는 EUC-KR 인코딩):

```csv
학번,이름,학년,반
20250101,홍길동,1,1
20250102,김영희,1,1
20250103,이순신,2,3
```

관리 페이지에서 "학생 명단 관리" → "CSV 업로드"로 파일을 업로드하세요.

## 🔐 보안 주의사항

### 1. 비밀번호 관리
- `.streamlit/secrets.toml`은 절대 공유하지 마세요
- 강력한 비밀번호를 사용하세요 (최소 8자)
- 정기적으로 비밀번호를 변경하세요

### 2. 데이터 백업
- SQLite 데이터베이스 파일 (`data/database.db`)을 정기적으로 백업하세요
- 특히 신청서 데이터는 중요하므로 주간 백업을 권장합니다

### 3. 파일 업로드
- 업로드된 파일은 `data/uploads/` 디렉토리에 저장됩니다
- 최대 파일 크기는 제한되어 있습니다 (현재 무제한)

## 📱 페이지별 접근 방법

### 홈페이지 (메인)
```
http://your-domain.com
```

### 학부모 페이지
```
좌측 사이드바 → 1️⃣ 학부모_페이지
```

### 교감 승인 페이지
```
좌측 사이드바 → 2️⃣ 교감_승인_페이지
```

### 관리 페이지
```
좌측 사이드바 → 3️⃣ 관리_페이지
```

## 🌐 배포 (Streamlit Cloud)

### 1. GitHub 저장소 생성

```bash
git init
git add .
git commit -m "초기 커밋"
git remote add origin https://github.com/your-username/gate_phone.git
git push -u origin main
```

### 2. Streamlit Cloud 배포

1. [Streamlit Cloud](https://streamlit.io/cloud)에 접속
2. GitHub 계정으로 로그인
3. "Deploy an app" 클릭
4. Repository: `gate_phone`
5. Branch: `main`
6. Main file path: `app.py`
7. "Deploy!" 클릭

### 3. Secrets 설정

Streamlit Cloud 대시보드에서:
1. 앱 설정 → "Secrets"
2. 다음 내용 입력:

```toml
ADMIN_PASSWORD = "your_secure_password"
```

## 📈 시스템 업그레이드 계획

- [ ] PostgreSQL 데이터베이스 지원
- [ ] 다중 학년도 관리
- [ ] 문서 관리 기능 완성
- [ ] 이메일 알림 기능
- [ ] 모바일 앱
- [ ] 영어 다국어 지원

## 🐛 문제 해결

### "학번이 일치하지 않음"
- CSV 파일에서 해당 학번의 학생이 등록되었는지 확인하세요
- 학번과 이름을 정확히 입력하세요

### "비밀번호가 일치하지 않음"
- `.streamlit/secrets.toml`에 설정한 비밀번호를 정확히 입력하세요
- 파일을 변경한 경우 Streamlit을 재시작하세요

### PDF 다운로드 오류
- 브라우저의 팝업 차단 해제
- 최신 브라우저 버전 사용

## 📞 문의 및 지원

- 학교: 동성초등학교
- 담당: 교감실, 생활부장실
- 기술 문의: IT 담당자

## 📄 라이센스

이 프로젝트는 동성초등학교의 내부용 시스템입니다.

---

**버전**: 1.0.0
**마지막 업데이트**: 2025년 2월 14일
