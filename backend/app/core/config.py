from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    APP_ENV: str = "development"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = int(os.environ.get("PORT", 8000))
    DATABASE_URL: str = "sqlite+aiosqlite:///./druginfo.db"
    
    # Firecrawl configuration
    FIRECRAWL_API_KEY: Optional[str] = None
    FIRECRAWL_API_URL: str = "https://api.firecrawl.dev"
    
    # LLM configuration
    LLM_PROVIDER: str = "gemini"  # "gemini", "openai", "mock"
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: Optional[str] = "gemini-3.1-flash-lite"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    
    # Memento configuration
    MEMENTO_ENABLED: bool = False
    MEMENTO_API_KEY: Optional[str] = None
    MEMENTO_BASE_URL: Optional[str] = None
    MEMENTO_DB_PATH: str = "./memento_storage"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
