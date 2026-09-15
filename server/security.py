import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def check_key(
    access_key: str,
    header_key: str | None,
    query_key: str | None,
    *,
    path: str = "",
    client: str | None = None,
) -> None:
    if not access_key:
        return
    if header_key != access_key and query_key != access_key:
        logger.warning("auth_denied path=%s client=%s reason=invalid-key", path, client)
        raise HTTPException(status_code=401, detail="invalid access key")
