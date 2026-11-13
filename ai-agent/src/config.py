import os
from pathlib import Path
from dotenv import load_dotenv

# Load root .env
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=root_dir / ".env")

class Config:
    port: int = int(os.getenv("AI_PORT", "8000"))
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama").strip().lower()

    # Local Ollama settings
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma4:e2b")

    # EXAONE API settings (OpenAI-compatible)
    exaone_base_url: str = os.getenv("EXAONE_BASE_URL", "https://api.exaone.ai/v1")
    exaone_model: str = os.getenv("EXAONE_MODEL", "k-exaone_v2.5")
    exaone_api_key: str = os.getenv("EXAONE_API_KEY", "")

config = Config()
