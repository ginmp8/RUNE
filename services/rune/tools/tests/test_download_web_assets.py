from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "download-web-assets.py"
spec = importlib.util.spec_from_file_location("download_web_assets", SCRIPT)
assert spec and spec.loader
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


def _npm_tarball(files: dict[str, bytes]) -> bytes:
    import io
    import tarfile

    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, content in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()


def test_install_schematex_writes_validated_package_license_and_integrity(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    module = ("export function render(){};export function renderPreview(){};"
              "export function renderResult(){return {ok:true,svg:'<svg/>'}};" + "x" * 20_000).encode()
    license_text = b"GNU AFFERO GENERAL PUBLIC LICENSE"
    package = _npm_tarball({
        "package/dist/index.js": module,
        "package/LICENSE": license_text,
        "package/package.json": b'{"name":"schematex","version":"1.0.1"}',
        "package/README.md": b"official package",
    })
    monkeypatch.setattr(assets, "ROOT", tmp_path)
    monkeypatch.setattr(assets, "download_first", lambda urls: (package, urls[0]))

    assets.install_schematex()

    assert (tmp_path / "schematex/package/dist/index.js").read_bytes() == module
    assert (tmp_path / "schematex/package/package.json").is_file()
    assert (tmp_path / "schematex/LICENSE").read_bytes() == license_text
    assert (tmp_path / "schematex/SOURCE.json").is_file()
    assert (tmp_path / "schematex/SHA256SUMS").is_file()


def test_install_schematex_rejects_external_import(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    module = ("import x from 'https://example.invalid/x.js';"
              "export function render(){};export function renderPreview(){};"
              "export function renderResult(){};" + "x" * 20_000).encode()
    package = _npm_tarball({
        "package/dist/index.js": module,
        "package/LICENSE": b"GNU AFFERO GENERAL PUBLIC LICENSE",
        "package/package.json": b'{"name":"schematex","version":"1.0.1"}',
    })
    monkeypatch.setattr(assets, "ROOT", tmp_path)
    monkeypatch.setattr(assets, "download_first", lambda urls: (package, urls[0]))

    with pytest.raises(RuntimeError, match="external import"):
        assets.install_schematex()


def test_install_mermaid_uses_npm_tarball_and_writes_integrity_metadata(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    package = _npm_tarball({
        "package/dist/mermaid.min.js": b"/*! mermaid */" + b"x" * 1_000_000,
        "package/LICENSE": b"MIT License\n",
        "package/package.json": b'{"name":"mermaid","version":"11.16.0"}',
    })
    monkeypatch.setattr(assets, "ROOT", tmp_path)
    monkeypatch.setattr(assets, "download_first", lambda urls: (package, urls[0]))

    assets.install_mermaid()

    source = (tmp_path / "mermaid/SOURCE.json").read_text(encoding="utf-8")
    assert "registry.npmjs.org/mermaid" in source
    assert (tmp_path / "mermaid/SHA256SUMS").is_file()
    assert (tmp_path / "mermaid/LICENSE").read_text(encoding="utf-8").startswith("MIT License")


def test_main_installs_all_local_renderer_assets_by_default(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    calls: list[str] = []
    monkeypatch.setattr(assets, "ROOT", tmp_path)
    monkeypatch.setattr(assets, "install_mermaid", lambda: calls.append("mermaid"))
    monkeypatch.setattr(assets, "install_katex", lambda: calls.append("katex"))
    monkeypatch.setattr(assets, "install_schematex", lambda: calls.append("schematex"))
    monkeypatch.delenv("RUNE_ENABLE_AGPL_SCHEMATEX", raising=False)

    assert assets.main() == 0
    assert calls == ["mermaid", "katex", "schematex"]
