from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.config import config
from src.schemas import ReviewContractRequest, ReviewContractResponse
from src.agent import review_contract_with_ollama

app = FastAPI(
    title="Real Estate Legal AI Agent",
    description="Analyzes real estate contract special clauses and detects toxic terms using Ollama local model",
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
        "model": config.ollama_model,
        "ollama_url": config.ollama_base_url
    }

@app.post("/api/ai/review", response_model=ReviewContractResponse)
async def review_contract(request: ReviewContractRequest):
    """
    Analyzes contract details and special clauses for legal risks, toxic clauses, and checklists.
    Strictly stateless: No direct DB writes and no direct Web3 RPC calls.
    """
    try:
        result = await review_contract_with_ollama(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

