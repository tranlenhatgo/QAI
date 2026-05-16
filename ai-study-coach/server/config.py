from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Quiz API
    quiz_api_url: str = "http://localhost:8080"

    # LM Studio (local LLM)
    lm_studio_url: str = "http://127.0.0.1:1234"

    # External LLM provider
    external_llm_provider: str = "lm_studio"
    external_llm_api_key: str = ""  # Only needed for cloud providers (Google, etc.)
    external_llm_model: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./study_coach.db"

    # Security
    api_key: str = ""  # Set COACH_API_KEY to require X-API-Key header on protected endpoints

    # App
    app_name: str = "AI Study Coach"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    model_config = {"env_file": ".env", "env_prefix": "COACH_"}

settings = Settings()
