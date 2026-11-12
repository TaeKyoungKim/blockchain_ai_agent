import asyncio
import httpx

async def test_ai_agent():
    print("==================================================")
    print("Testing Python AI Agent (Ollama gemma4:e2b)")
    print("==================================================")

    url = "http://127.0.0.1:8000/api/ai/review"
    payload = {
        "contract_type": "JEONSE",
        "property_address": "서울특별시 마포구 공덕동 100 래미안아파트 102동 501호",
        "deposit_amount": 380000000,
        "monthly_rent": 0,
        "special_clauses": [
            "임차인은 현 시설 상태대로 임차하며, 보일러 및 배관 고장 시 수리비용은 전액 임차인이 부담한다.",
            "임대인은 잔금 지급일 당일 타 금융기관에 근저당권을 설정할 수 있다.",
            "전세자금대출 미승인 시에도 계약금은 일체 반환하지 아니한다."
        ]
    }

    print("\n[Request] Sending toxic clauses to AI Agent...")
    async with httpx.AsyncClient(timeout=180.0) as client:
        res = await client.post(url, json=payload)
        print(f"[Response Status] {res.status_code}")
        data = res.json()
        print("\n[AI Review Result]")
        print(f"- Risk Score: {data.get('risk_score')}/100 ({data.get('risk_grade')})")
        print(f"- Summary: {data.get('summary')}")
        print("\n[Detected Toxic Clauses]:")
        for idx, clause in enumerate(data.get("toxic_clauses", []), 1):
            print(f"  {idx}. [{clause.get('risk_level')}] {clause.get('original_clause')}")
            print(f"     -> 문제점: {clause.get('issue_description')}")
            print(f"     -> 수정안: {clause.get('suggested_revision')}")

        print("\n[Checklist Verification]:")
        for item in data.get("checklist", []):
            status = "✅ PASS" if item.get("passed") else "❌ FAIL"
            print(f"  - {status} [{item.get('category')}]: {item.get('detail')}")

        print("\n[Recommended Additional Clauses]:")
        for clause in data.get("recommended_additional_clauses", []):
            print(f"  + {clause}")

if __name__ == "__main__":
    asyncio.run(test_ai_agent())

