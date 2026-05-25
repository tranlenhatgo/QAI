from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Quiz API
    quiz_api_url: str = "http://localhost:8080"

    # LM Studio (local LLM — Lite tier)
    lm_studio_url: str = "http://127.0.0.1:1234"

    # External LLM provider (Full tier)
    external_llm_provider: str = "deepseek"
    external_llm_api_key: str = ""  # DeepSeek API key for Full tier
    external_llm_model: str = ""  # e.g. "deepseek-v4-flash"

    # Supabase (pgvector RAG)
    supabase_url: str = ""
    supabase_key: str = ""

    # Search API (web_search tool)
    search_api_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./study_coach.db"

    # Security
    api_key: str = ""  # Set COACH_API_KEY to require X-API-Key header on protected endpoints

    # App
    app_name: str = "AI Study Coach"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    model_config = {"env_file": ".env", "env_prefix": "COACH_"}


settings = Settings()
