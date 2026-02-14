# 애플리케이션 설정

# 학교 정보
SCHOOL_NAME = "동성초등학교"
SCHOOL_YEAR = 2025

# 유효기간
GATE_PERMIT_START = "2025.3.4"
GATE_PERMIT_END = "2026.2.28"

# 승인 모드
APPROVAL_MODES = {
    "auto": "자동 발급",
    "manual": "승인 필요"
}

APPLICATION_TYPES = {
    "phone": "휴대전화",
    "tablet": "태블릿PC",
    "gate": "정문출입"
}

# 신청서 상태
APPLICATION_STATUSES = {
    "pending": "승인 대기",
    "approved": "승인 완료",
    "rejected": "반려",
    "auto_approved": "자동 발급"
}

# 파일 저장 경로
UPLOAD_FOLDER = "data/uploads"
TEMP_FOLDER = "data/temp"

# 문서 타입
DOCUMENT_TYPES = {
    "regulation": "규정",
    "form": "양식",
    "notice": "가정통신문"
}

# 보안
ADMIN_PASSWORD_ENV = "ADMIN_PASSWORD"
