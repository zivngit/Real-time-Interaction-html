import importlib
import logging
import re

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

import server.config
import server.logging as server_logging
import server.main
from server.logging import LOG_FORMAT, configure_logging, client_host, resolve_level


@pytest.fixture(autouse=True)
def isolated_log_file(tmp_path, monkeypatch):
    monkeypatch.setattr(server_logging, "LOG_FILE", str(tmp_path / "server.log"))


@pytest.fixture(autouse=True)
def restore_default_logging(isolated_log_file):
    yield
    configure_logging()


def _make_request(headers=(), client=None):
    scope = {"type": "http", "headers": list(headers)}
    if client is not None:
        scope["client"] = client
    return Request(scope)


def test_configure_idempotent(caplog):
    configure_logging()
    configure_logging()
    handlers = logging.getLogger("server").handlers
    assert len(handlers) == 2
    assert any(
        isinstance(h, logging.StreamHandler)
        and not isinstance(h, logging.handlers.RotatingFileHandler)
        for h in handlers
    )
    assert any(isinstance(h, logging.handlers.RotatingFileHandler) for h in handlers)
    caplog.set_level(logging.INFO, logger="server")
    logging.getLogger("server.test").info("once_only")
    assert sum("once_only" in r.getMessage() for r in caplog.records) == 1


def test_default_level_info():
    configure_logging()
    assert logging.getLogger("server").getEffectiveLevel() == logging.INFO


def test_invalid_level_falls_back_to_info():
    configure_logging(level="BOGART")
    assert logging.getLogger("server").getEffectiveLevel() == logging.INFO
    assert resolve_level("BOGART") == logging.INFO


def test_debug_level_enabled(caplog):
    configure_logging(level="DEBUG")
    assert logging.getLogger("server").getEffectiveLevel() == logging.DEBUG
    caplog.set_level(logging.DEBUG, logger="server")
    logging.getLogger("server.test").debug("debug_check")
    assert any(r.getMessage() == "debug_check" for r in caplog.records)


def test_log_format_iso_timestamp(caplog):
    caplog.set_level(logging.INFO, logger="server")
    configure_logging()
    logging.getLogger("server.test").info("format_check")
    assert len(caplog.records) == 1
    handler = next(
        h
        for h in logging.getLogger("server").handlers
        if isinstance(h, logging.StreamHandler)
    )
    line = handler.formatter.format(caplog.records[0])
    assert LOG_FORMAT == "%(asctime)s %(levelname)-7s %(name)s %(message)s"
    assert re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-](?:\d{2}:\d{2}|\d{4}) INFO    server\.test format_check",
        line,
    )


def test_file_output(tmp_path, caplog):
    caplog.set_level(logging.INFO, logger="server")
    log_file = tmp_path / "server.log"
    configure_logging(file_path=str(log_file))
    logging.getLogger("server.test").info("file_check")
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    assert re.search(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-](?:\d{2}:\d{2}|\d{4}) INFO    server\.test file_check",
        content,
    )
    handlers = logging.getLogger("server").handlers
    assert any(
        isinstance(h, logging.StreamHandler)
        and not isinstance(h, logging.handlers.RotatingFileHandler)
        for h in handlers
    )


def test_default_file_output(tmp_path):
    configure_logging()
    logging.getLogger("server.test").info("default_file_check")
    content = (tmp_path / "server.log").read_text(encoding="utf-8")
    assert "default_file_check" in content


def test_file_rotation(tmp_path):
    log_file = tmp_path / "server.log"
    configure_logging(file_path=str(log_file), max_bytes=200, backup_count=2)
    logger = logging.getLogger("server.test")
    for i in range(30):
        logger.info("rotation line %d with extra padding to exceed the limit", i)
    assert (tmp_path / "server.log.1").exists()


def test_client_host_prefers_xff():
    req = _make_request(
        headers=[(b"x-forwarded-for", b"1.2.3.4, 5.6.7.8")], client=("9.9.9.9", 1234)
    )
    assert client_host(req) == "1.2.3.4"


def test_client_host_falls_back_to_scope_client():
    req = _make_request(client=("9.9.9.9", 1234))
    assert client_host(req) == "9.9.9.9"


def test_client_host_unknown_when_no_client():
    assert client_host(_make_request()) == "unknown"


def test_startup_shutdown_log(caplog):
    caplog.set_level(logging.INFO, logger="server")
    with TestClient(server.main.app):
        pass
    messages = [r.getMessage() for r in caplog.records if r.name == "server.main"]
    started = [m for m in messages if m.startswith("server_started ")]
    stopped = [m for m in messages if m.startswith("server_stopped ")]
    assert len(started) == 1
    assert len(stopped) == 1
    assert re.fullmatch(r"server_started level=\w+ rev=\S* version=\d+ enabled=\d+", started[0])
    assert re.fullmatch(r"server_stopped subscribers=\d+", stopped[0])


def test_config_defaults(monkeypatch):
    for name in (
        "RTX_LOG_LEVEL",
        "RTX_LOG_FILE",
        "RTX_LOG_FILE_MAX_BYTES",
        "RTX_LOG_FILE_BACKUP_COUNT",
    ):
        monkeypatch.delenv(name, raising=False)
    cfg = importlib.reload(server.config)
    assert cfg.LOG_LEVEL == "INFO"
    assert cfg.LOG_FILE == "server.log"
    assert cfg.LOG_FILE_MAX_BYTES == 5242880
    assert cfg.LOG_FILE_BACKUP_COUNT == 3
