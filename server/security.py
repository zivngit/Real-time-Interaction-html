from fastapi import HTTPException


def check_key(access_key: str, header_key: str | None, query_key: str | None) -> None:
    if not access_key:
        return
    if header_key != access_key and query_key != access_key:
        raise HTTPException(status_code=401, detail="invalid access key")
