import logging
from logging.handlers import RotatingFileHandler

from server.config import LOG_FILE, LOG_FILE_BACKUP_COUNT, LOG_FILE_MAX_BYTES, LOG_LEVEL

LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"
_VALID_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")


def resolve_level(level: str) -> int:
    name = (level or "").strip().upper()
    if name in _VALID_LEVELS:
        return getattr(logging, name)
    return logging.INFO


def client_host(request) -> str:
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


def configure_logging(
    level: str | None = None,
    file_path: str | None = None,
    max_bytes: int | None = None,
    backup_count: int | None = None,
) -> None:
    effective_level = resolve_level(LOG_LEVEL if level is None else level)
    file_path = LOG_FILE if file_path is None else file_path
    max_bytes = LOG_FILE_MAX_BYTES if max_bytes is None else max_bytes
    backup_count = LOG_FILE_BACKUP_COUNT if backup_count is None else backup_count

    server_logger = logging.getLogger("server")
    server_logger.setLevel(effective_level)
    for handler in list(server_logger.handlers):
        server_logger.removeHandler(handler)
        handler.close()
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    server_logger.addHandler(stream_handler)
    if file_path:
        file_handler = RotatingFileHandler(
            file_path, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        server_logger.addHandler(file_handler)
