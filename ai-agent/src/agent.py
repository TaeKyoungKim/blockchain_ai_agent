import asyncio
import json
import re
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage
from src.config import config
from src.schemas import ReviewContractRequest, ReviewContractResponse, ChecklistItem
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

tools = [lookup_housing_lease_protection_law]
_agent_cache: dict[str, object] = {}


def extract_json_from_text(text: str) -> dict:
    """Extract clean JSON object from LLM response text."""
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


def build_llm(provider: str):
    """Build LangChain chat model instance for the given provider ('ollama' | 'exaone')."""
    if provider == "ollama":
        return ChatOllama(
            base_url=config.ollama_base_url,
            model=config.ollama_model,
            temperature=0.1,
        )
    if provider == "exaone":
        if not config.exaone_api_key or config.exaone_api_key == "your_exaone_api_key_here":
            raise ValueError("EXAONE_API_KEY is not configured in .env")
        return ChatOpenAI(
            base_url=config.exaone_base_url,
            api_key=config.exaone_api_key,
            model=config.exaone_model,
            temperature=0.1,
            max_retries=0,
            timeout=20.0,
        )
    raise ValueError(f"Unsupported LLM provider: '{provider}'. Expected 'ollama' or 'exaone'.")


def get_agent(provider: str):
    """Return a cached LangGraph ReAct agent for the requested provider."""
    if provider not in _agent_cache:
        llm = build_llm(provider)
        _agent_cache[provider] = create_react_agent(
            model=llm,
            tools=tools,
            prompt=SYSTEM_PROMPT,
        )
    return _agent_cache[provider]


def resolve_model_name(provider: str) -> str:
    return config.exaone_model if provider == "exaone" else config.ollama_model


def _is_rate_limit_error(err: Exception) -> bool:
    msg = str(err).lower()
    return "429" in msg or "too many concurrent requests" in msg or "rate limit" in msg or "service is busy" in msg


async def _invoke_agent(provider: str, user_prompt: str, contract_type: str) -> ReviewContractResponse:
    """Invoke the selected provider's agent with a single quick retry on 429 rate-limit errors."""
    agent_app = get_agent(provider)
    max_attempts = 2 if provider == "exaone" else 1

    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = await agent_app.ainvoke({"messages": [HumanMessage(content=user_prompt)]})
            last_message = response["messages"][-1]
            raw_content = last_message.content
            if isinstance(raw_content, list):
                raw_content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in raw_content])

            parsed_data = extract_json_from_text(raw_content)
            parsed_data["contract_type"] = contract_type
            return ReviewContractResponse(**parsed_data)
        except Exception as err:
            last_error = err
            if attempt < max_attempts and _is_rate_limit_error(err):
                await asyncio.sleep(1.5 * attempt)
                continue
            raise last_error


async def review_contract(request: ReviewContractRequest) -> ReviewContractResponse:
    provider = (request.provider or config.llm_provider).strip().lower()
    model_name = resolve_model_name(provider)

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
        return await _invoke_agent(provider, user_prompt, request.contract_type)
    except Exception as primary_err:
        # Automatic fallback to local Ollama if EXAONE API fails (e.g., 429 busy / network error)
        if provider == "exaone":
            try:
                fallback_result = await _invoke_agent("ollama", user_prompt, request.contract_type)
                fallback_result.summary = (
                    f"[EXAONE API 혼잡/오류로 로컬 모델({config.ollama_model})로 자동 전환 분석됨] "
                    f"{fallback_result.summary}"
                )
                return fallback_result
            except Exception as fallback_err:
                primary_err = f"EXAONE({primary_err}) / Ollama Fallback({fallback_err})"

        return ReviewContractResponse(
            contract_type=request.contract_type,
            risk_score=50,
            risk_grade="CAUTION",
            summary=f"LangChain Agent ({provider}/{model_name}) 분석 중 오류가 발생하여 기본 검토를 제공합니다. ({primary_err})",
            toxic_clauses=[],
            checklist=[
                ChecklistItem(
                    category="시스템 연동",
                    passed=False,
                    detail=f"LangChain Agent ({provider}/{model_name}) 실행 또는 응답 파싱 실패",
                )
            ],
            recommended_additional_clauses=[
                "임대인은 잔금 지급일 익일까지 해당 부동산에 근저당권 등 제한물권을 설정하지 아니한다.",
                "임대인은 국세 및 지방세 완납증명서를 잔금 지급 전까지 제시한다.",
            ],
        )
