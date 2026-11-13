from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class ToxicClauseDetail(BaseModel):
    original_clause: str = Field(..., description="원본 특약 문구")
    risk_level: str = Field(..., description="위험 수준: 'HIGH' | 'MEDIUM' | 'LOW'")
    issue_description: str = Field(..., description="발생 가능한 법률적 또는 경제적 불이익 설명")
    suggested_revision: str = Field(..., description="임차인 또는 당사자를 보호하는 추천 수정 문구")

class ChecklistItem(BaseModel):
    category: str = Field(..., description="점검 항목 (예: 대출, 보증금 보호, 원상복구)")
    passed: bool = Field(..., description="해당 점검 기준을 충족하는지 여부")
    detail: str = Field(..., description="점검 내용 상세 설명")

class ReviewContractRequest(BaseModel):
    contract_type: str = Field(..., description="'SALE' | 'JEONSE' | 'MONTHLY_RENT'")
    property_address: str = Field(..., description="부동산 소재지 주소")
    deposit_amount: float = Field(default=0, description="보증금 (원)")
    monthly_rent: float = Field(default=0, description="월세 (원)")
    special_clauses: List[str] = Field(default_factory=list, description="계약서에 기재된 특약사항 목록")
    provider: Optional[Literal["ollama", "exaone"]] = Field(
        default=None,
        description="사용할 LLM 프로바이더 ('ollama' | 'exaone'). 미지정 시 .env의 LLM_PROVIDER 기본값 사용"
    )

class ReviewContractResponse(BaseModel):
    contract_type: str
    risk_score: int = Field(..., ge=0, le=100, description="계약 위험도 점수 (0: 매우 안전 ~ 100: 극도로 위험)")
    risk_grade: str = Field(..., description="'SAFE' | 'CAUTION' | 'DANGEROUS'")
    summary: str = Field(..., description="전체 계약서 및 특약 분석 총평")
    toxic_clauses: List[ToxicClauseDetail] = Field(default_factory=list, description="독소 조항 및 불리한 조항 분석")
    checklist: List[ChecklistItem] = Field(default_factory=list, description="필수 법률 체크리스트 검토 결과")
    recommended_additional_clauses: List[str] = Field(default_factory=list, description="추가로 삽입해야 할 안전 필수 특약")

