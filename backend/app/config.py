"""Central settings — everything comes from environment (§23A)."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://vc:localdev@db:5432/visioncare"
    jwt_secret: str = "change-me"
    model_service_url: str = "http://model:8001"
    demo_mode: bool = False
    upload_root: str = "/data/uploads"


settings = Settings()
