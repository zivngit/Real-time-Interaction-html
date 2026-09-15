import os

ACCESS_KEY = os.getenv("ACCESS_KEY", "").strip()
RATE_LIMIT_PER_SEC = 20

LOG_LEVEL = os.getenv("RTX_LOG_LEVEL", "INFO").strip()
LOG_FILE = os.getenv("RTX_LOG_FILE", "server.log").strip()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "")
    try:
        return int(raw)
    except ValueError:
        return default


LOG_FILE_MAX_BYTES = _int_env("RTX_LOG_FILE_MAX_BYTES", 5242880)
LOG_FILE_BACKUP_COUNT = _int_env("RTX_LOG_FILE_BACKUP_COUNT", 3)
