from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./drishti.db"
    secret_key: str = "change-me-sih26124"
    upload_dir: str = "data/uploads"
    sample_dir: str = "data/sample"
    cluster_radius_m: float = 20.0
    frame_stride: int = 12
    detect_max_width: int = 640
    jpeg_quality: int = 70
    commit_every: int = 8
    ws_bus_every: int = 3
    progress_every_pct: int = 12

    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
