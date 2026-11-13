from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.config import config
from src.schemas import ReviewContractRequest, ReviewContractResponse
from src.agent import review_contract, resolve_model_name

app = FastAPI(
    title="Real Estate Legal AI Agent",
    description="Analyzes real estate contract special clauses and detects toxic terms using Ollama or EXAONE",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "real-estate-ai-agent",
        "provider": config.llm_provider,
        "model": resolve_model_name(config.llm_provider),
        "ollama_url": config.ollama_base_url,
        "exaone_url": config.exaone_base_url
    }

@app.post("/api/ai/review", response_model=ReviewContractResponse)
async def review_contract_endpoint(request: ReviewContractRequest):
    """
    Analyzes contract details and special clauses for legal risks, toxic clauses, and checklists.
    Strictly stateless: No direct DB writes and no direct Web3 RPC calls.
    """
    try:
        return await review_contract(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
