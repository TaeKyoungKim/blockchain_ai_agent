import json
import re
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage
from src.config import config
from src.schemas import ReviewContractRequest, ReviewContractResponse, ToxicClauseDetail, ChecklistItem
from src.tools import lookup_housing_lease_protection_law

SYSTEM_PROMPT = """당신은 대한민국 부동산 전문 변호사이자 계약서 특약사항 검토 AI 에이전트입니다.
사용자가 제공한 계약 정보(매매, 전세, 월세)와 특약사항 목록을 검토하여, 임차인/매수인에게 일방적으로 불리한 독소 조항, 법률적 하자, 누락된 필수 특약을 꼼꼼하게 분석해야 합니다.
필요한 경우 'lookup_housing_lease_protection_law' 도구를 사용하여 법률 판례 및 조항을 검색하십시오.

최종 답변은 반드시 아래 JSON 구조 하나만 출력해야 하며, 설명이나 마크다운 코드블록은 포함하지 마십시오:
{
  "contract_type": "JEONSE",
  "risk_score": 35,
  "risk_grade": "CAUTION",
  "summary": "총평 및 핵심 조언 요약",
  "toxic_clauses": [
    {
      "original_clause": "분석 대상 원본 특약",
      "risk_level": "HIGH",
      "issue_description": "문제점 및 위험성 설명",
      "suggested_revision": "수정 권고 문구"
    }
  ],
  "checklist": [
    {
      "category": "대항력 및 우선변제권",
      "passed": true,
      "detail": "잔금 익일까지 제한물권 설정 금지 특약 검토"
    }
  ],
  "recommended_additional_clauses": [
    "추가 권고 특약 문구"
  ]
}
"""

def extract_json_from_text(text: str) -> dict:
    """Extract clean JSON object from LLM response text."""
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)

# Initialize LangChain Ollama Chat Model
llm = ChatOllama(
    base_url=config.ollama_base_url,
    model=config.ollama_model,
    temperature=0.1
)

# Create LangGraph ReAct Agent with Tools
tools = [lookup_housing_lease_protection_law]
agent_app = create_react_agent(
    model=llm,
    tools=tools,
    prompt=SYSTEM_PROMPT
)

async def review_contract_with_ollama(request: ReviewContractRequest) -> ReviewContractResponse:
    clauses_formatted = "\n".join([f"- {clause}" for clause in request.special_clauses])
    if not clauses_formatted:
        clauses_formatted = "(기재된 특약사항 없음)"

    user_prompt = f"""[계약 정보]
- 계약 유형: {request.contract_type}
- 부동산 소재지: {request.property_address}
- 보증금: {request.deposit_amount:,.0f}원
- 월세: {request.monthly_rent:,.0f}원

[특약사항 목록]
{clauses_formatted}

위 계약 내용과 특약사항을 분석하고, 필요시 도구를 활용한 후 최종 결과를 지정된 JSON 형식으로만 응답해 주세요."""

    try:
        # Run LangChain create_react_agent
        inputs = {"messages": [HumanMessage(content=user_prompt)]}
        response = await agent_app.ainvoke(inputs)
        
        last_message = response["messages"][-1]
        raw_content = last_message.content
        if isinstance(raw_content, list):
            raw_content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in raw_content])

        parsed_data = extract_json_from_text(raw_content)
        parsed_data["contract_type"] = request.contract_type

        return ReviewContractResponse(**parsed_data)
    except Exception as e:
        # Fallback if parsing fails
        return ReviewContractResponse(
            contract_type=request.contract_type,
            risk_score=50,
            risk_grade="CAUTION",
            summary=f"LangChain Agent 분석 중 오류가 발생하여 기본 검토를 제공합니다. ({str(e)})",
            toxic_clauses=[],
            checklist=[
                ChecklistItem(
                    category="시스템 연동",
                    passed=False,
                    detail=f"LangChain Agent ({config.ollama_model}) 응답 파싱 실패"
                )
            ],
            recommended_additional_clauses=[
                "임대인은 잔금 지급일 익일까지 해당 부동산에 근저당권 등 제한물권을 설정하지 아니한다.",
                "임대인은 국세 및 지방세 완납증명서를 잔금 지급 전까지 제시한다."
            ]
        )
