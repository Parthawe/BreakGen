"""Security tests for Meshy provider downloads."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from server.ai.meshy_client import MeshyClient, MeshyError, validate_model_download_url


def test_model_download_url_rejects_non_https_and_private_hosts():
    with pytest.raises(MeshyError, match="https"):
        validate_model_download_url("http://93.184.216.34/model.glb")

    with pytest.raises(MeshyError, match="public address"):
        validate_model_download_url("https://127.0.0.1/model.glb")

    with pytest.raises(MeshyError, match="credentials"):
        validate_model_download_url("https://user:pass@93.184.216.34/model.glb")

    with pytest.raises(MeshyError, match="Unsupported"):
        validate_model_download_url("https://93.184.216.34/model.exe")


@pytest.mark.anyio
async def test_download_model_streams_public_model_to_disk(tmp_path: Path):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/model.glb"
        return httpx.Response(
            200,
            content=b"glb",
            headers={"content-type": "model/gltf-binary"},
        )

    client = MeshyClient(api_key="test", download_transport=httpx.MockTransport(handler))
    output_path = tmp_path / "model.glb"

    result = await client.download_model("https://93.184.216.34/model.glb", str(output_path))

    assert result == str(output_path)
    assert output_path.read_bytes() == b"glb"


@pytest.mark.anyio
async def test_download_model_enforces_size_limit_and_removes_partial_file(
    tmp_path: Path,
    monkeypatch,
):
    monkeypatch.setattr("server.ai.meshy_client.settings.meshy_model_download_max_bytes", 2)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"toolarge",
            headers={"content-type": "model/gltf-binary"},
        )

    client = MeshyClient(api_key="test", download_transport=httpx.MockTransport(handler))
    output_path = tmp_path / "model.glb"

    with pytest.raises(MeshyError, match="exceeds"):
        await client.download_model("https://93.184.216.34/model.glb", str(output_path))

    assert not output_path.exists()


@pytest.mark.anyio
async def test_download_model_rejects_unexpected_content_type(tmp_path: Path):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"<html></html>",
            headers={"content-type": "text/html"},
        )

    client = MeshyClient(api_key="test", download_transport=httpx.MockTransport(handler))

    with pytest.raises(MeshyError, match="content type"):
        await client.download_model("https://93.184.216.34/model.glb", str(tmp_path / "model.glb"))
