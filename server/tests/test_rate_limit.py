"""Unit tests for the rate-limit client identity resolution."""

from __future__ import annotations

from starlette.requests import Request

from server.config import settings
from server.services.rate_limit import client_rate_key


def _request(headers: dict[str, str] | None = None, client=("10.0.0.5", 5000)) -> Request:
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw_headers, "client": client})


def test_default_ignores_spoofable_headers(monkeypatch):
    """Without trusted-proxy/header config, only the socket peer is used."""
    monkeypatch.setattr(settings, "trusted_client_ip_header", "")
    monkeypatch.setattr(settings, "trusted_proxy_hosts", "")

    assert client_rate_key(_request()) == "10.0.0.5"
    # Client-supplied X-Forwarded-For must not change the bucket.
    assert client_rate_key(_request({"X-Forwarded-For": "203.0.113.10"})) == "10.0.0.5"


def test_trusted_client_ip_header_is_honored(monkeypatch):
    """A configured platform header (e.g. Fly-Client-IP) identifies the client."""
    monkeypatch.setattr(settings, "trusted_client_ip_header", "Fly-Client-IP")

    assert client_rate_key(_request({"Fly-Client-IP": "198.51.100.7"})) == "198.51.100.7"
    # Distinct platform client IPs get distinct buckets even behind one proxy peer.
    assert client_rate_key(_request({"Fly-Client-IP": "198.51.100.8"})) == "198.51.100.8"


def test_trusted_header_absent_falls_back_to_socket_peer(monkeypatch):
    """If the configured header is missing, fall back to the socket peer."""
    monkeypatch.setattr(settings, "trusted_client_ip_header", "Fly-Client-IP")

    assert client_rate_key(_request(client=("172.16.0.3", 443))) == "172.16.0.3"


def test_forwarded_for_honored_only_from_trusted_proxy(monkeypatch):
    """X-Forwarded-For is trusted only when the socket peer is a trusted proxy."""
    monkeypatch.setattr(settings, "trusted_client_ip_header", "")
    monkeypatch.setattr(settings, "trusted_proxy_hosts", "10.0.0.5")

    # Socket peer 10.0.0.5 is trusted -> use the forwarded client IP.
    assert client_rate_key(_request({"X-Forwarded-For": "203.0.113.10"})) == "203.0.113.10"
    # A non-trusted socket peer -> ignore the header.
    untrusted = _request({"X-Forwarded-For": "203.0.113.10"}, client=("8.8.8.8", 5000))
    assert client_rate_key(untrusted) == "8.8.8.8"
