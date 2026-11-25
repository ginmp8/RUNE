#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("RUNE_VENDOR_ASSET_ROOT", Path(__file__).resolve().parents[1] / "assets" / "vendor"))
MERMAID_VERSION = "11.16.0"
KATEX_VERSION = "0.18.1"
SCHEMATEX_VERSION = "1.0.1"
MAX_DOWNLOAD_BYTES = 50_000_000
PRODUCT_ROOT = Path(__file__).resolve().parents[3]
USER_AGENT = f"rune/{(PRODUCT_ROOT / 'VERSION').read_text(encoding='utf-8').strip() if (PRODUCT_ROOT / 'VERSION').is_file() else 'unknown'}"


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    chunks: list[bytes] = []
    total = 0
    with urlopen(request, timeout=120) as response:
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_DOWNLOAD_BYTES:
                raise RuntimeError(f"Asset exceeded {MAX_DOWNLOAD_BYTES} bytes: {url}")
            chunks.append(chunk)
    return b"".join(chunks)


def download_first(urls: tuple[str, ...]) -> tuple[bytes, str]:
    errors: list[str] = []
    for url in urls:
        try:
            return download(url), url
        except Exception as error:
            errors.append(f"{url}: {error}")
    raise RuntimeError("No asset mirror succeeded:\n- " + "\n- ".join(errors))


def extract_files(package_data: bytes, wanted: dict[str, Path], destination: Path) -> None:
    extracted: set[str] = set()
    with tarfile.open(fileobj=io.BytesIO(package_data), mode="r:gz") as archive:
        for member in archive.getmembers():
            source_path = PurePosixPath(member.name)
            if source_path.is_absolute() or ".." in source_path.parts:
                raise RuntimeError(f"Unsafe path in npm package: {member.name}")
            relative = wanted.get(member.name)
            if relative is None or not member.isfile():
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            source_file = archive.extractfile(member)
            if source_file is None:
                raise RuntimeError(f"Could not read npm package member: {member.name}")
            with source_file, target.open("wb") as output:
                shutil.copyfileobj(source_file, output)
            extracted.add(member.name)
    missing = sorted(set(wanted) - extracted)
    if missing:
        raise RuntimeError("npm package did not contain expected files: " + ", ".join(missing))


def write_source_record(install_dir: Path, package: str, version: str, selected: str, archive_data: bytes, license_name: str) -> None:
    source = {
        "package": package,
        "version": version,
        "sourceType": "npm-tarball",
        "upstream": selected,
        "archiveSha256": hashlib.sha256(archive_data).hexdigest(),
        "archiveSha512": hashlib.sha512(archive_data).hexdigest(),
        "license": license_name,
    }
    (install_dir / "SOURCE.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    entries: list[str] = []
    for path in sorted(install_dir.rglob("*")):
        if path.is_file() and path.name != "SHA256SUMS":
            entries.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(install_dir).as_posix()}")
    (install_dir / "SHA256SUMS").write_text("\n".join(entries) + "\n", encoding="utf-8")


def install_mermaid() -> None:
    install_dir = ROOT / "mermaid"
    target = install_dir / "mermaid.min.js"
    license_target = install_dir / "LICENSE"
    source_target = install_dir / "SOURCE.json"
    if target.is_file() and license_target.is_file() and source_target.is_file() and target.stat().st_size > 1_000_000:
        return
    archive_data, selected = download_first((
        f"https://registry.npmjs.org/mermaid/-/mermaid-{MERMAID_VERSION}.tgz",
        f"https://registry.yarnpkg.com/mermaid/-/mermaid-{MERMAID_VERSION}.tgz",
    ))
    with tempfile.TemporaryDirectory(prefix="rune-mermaid-") as temporary:
        extracted = Path(temporary)
        extract_files(archive_data, {
            "package/dist/mermaid.min.js": Path("mermaid.min.js"),
            "package/LICENSE": Path("LICENSE"),
            "package/package.json": Path("package.json"),
        }, extracted)
        data = (extracted / "mermaid.min.js").read_bytes()
        if len(data) < 1_000_000 or b"mermaid" not in data[:100_000].lower():
            raise RuntimeError("Downloaded Mermaid package failed distribution validation.")
        if b"MIT License" not in (extracted / "LICENSE").read_bytes():
            raise RuntimeError("Downloaded Mermaid license failed validation.")
        if install_dir.exists():
            shutil.rmtree(install_dir)
        shutil.copytree(extracted, install_dir)
    write_source_record(install_dir, "mermaid", MERMAID_VERSION, selected, archive_data, "MIT")
    print(f"Mermaid {MERMAID_VERSION}: {len(archive_data)} package bytes from {selected}; sha256={hashlib.sha256(archive_data).hexdigest()}")


def install_katex() -> None:
    install_dir = ROOT / "katex"
    js_target = install_dir / "katex.min.js"
    css_target = install_dir / "katex.min.css"
    fonts_target = install_dir / "fonts"
    license_target = install_dir / "LICENSE"
    source_target = install_dir / "SOURCE.json"
    if js_target.is_file() and css_target.is_file() and fonts_target.is_dir() and license_target.is_file() and source_target.is_file() and js_target.stat().st_size > 100_000:
        return
    archive_data, selected = download_first((
        f"https://registry.npmjs.org/katex/-/katex-{KATEX_VERSION}.tgz",
        f"https://registry.yarnpkg.com/katex/-/katex-{KATEX_VERSION}.tgz",
    ))
    if len(archive_data) < 1_000_000:
        raise RuntimeError("Downloaded KaTeX package is smaller than expected.")
    with tempfile.TemporaryDirectory(prefix="rune-katex-") as temporary:
        extracted = Path(temporary)
        wanted = {
            "package/dist/katex.min.js": Path("katex.min.js"),
            "package/dist/katex.min.css": Path("katex.min.css"),
            "package/LICENSE": Path("LICENSE"),
            "package/package.json": Path("package.json"),
        }
        with tarfile.open(fileobj=io.BytesIO(archive_data), mode="r:gz") as archive:
            for member in archive.getmembers():
                source_path = PurePosixPath(member.name)
                if source_path.is_absolute() or ".." in source_path.parts:
                    raise RuntimeError(f"Unsafe path in KaTeX package: {member.name}")
                if member.name.startswith("package/dist/fonts/") and member.isfile():
                    wanted[member.name] = Path(*source_path.relative_to("package/dist").parts)
        extract_files(archive_data, wanted, extracted)
        if b"MIT License" not in (extracted / "LICENSE").read_bytes():
            raise RuntimeError("Downloaded KaTeX license failed validation.")
        if install_dir.exists():
            shutil.rmtree(install_dir)
        shutil.copytree(extracted, install_dir)
    write_source_record(install_dir, "katex", KATEX_VERSION, selected, archive_data, "MIT")
    print(f"KaTeX {KATEX_VERSION}: {len(archive_data)} package bytes from {selected}; sha256={hashlib.sha256(archive_data).hexdigest()}")


def install_schematex() -> None:
    install_dir = ROOT / "schematex"
    package_dir = install_dir / "package"
    module_target = package_dir / "dist" / "index.js"
    license_target = install_dir / "LICENSE"
    source_target = install_dir / "SOURCE.json"
    if module_target.is_file() and module_target.stat().st_size > 10_000 and license_target.is_file() and source_target.is_file():
        return
    archive_data, selected = download_first((
        f"https://registry.npmjs.org/schematex/-/schematex-{SCHEMATEX_VERSION}.tgz",
        f"https://registry.yarnpkg.com/schematex/-/schematex-{SCHEMATEX_VERSION}.tgz",
    ))
    with tempfile.TemporaryDirectory(prefix="rune-schematex-") as temporary:
        extracted = Path(temporary)
        package_target = extracted / "package"
        with tarfile.open(fileobj=io.BytesIO(archive_data), mode="r:gz") as archive:
            for member in archive.getmembers():
                source_path = PurePosixPath(member.name)
                if source_path.is_absolute() or ".." in source_path.parts:
                    raise RuntimeError(f"Unsafe path in SchemaTex package: {member.name}")
                if not member.isfile() or not source_path.parts or source_path.parts[0] != "package":
                    continue
                relative = Path(*source_path.parts[1:])
                if not relative.parts:
                    continue
                target = package_target / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                source_file = archive.extractfile(member)
                if source_file is None:
                    raise RuntimeError(f"Could not read SchemaTex package member: {member.name}")
                with source_file, target.open("wb") as output:
                    shutil.copyfileobj(source_file, output)
        module_data = (package_target / "dist" / "index.js").read_bytes()
        module_text = module_data.decode("utf-8")
        package_metadata = json.loads((package_target / "package.json").read_text(encoding="utf-8"))
        if package_metadata.get("name") != "schematex" or package_metadata.get("version") != SCHEMATEX_VERSION:
            raise RuntimeError("Downloaded SchemaTex package identity failed validation.")
        if len(module_data) < 10_000 or not all(name in module_text for name in ("render", "renderPreview", "renderResult")):
            raise RuntimeError("Downloaded SchemaTex package failed official export validation.")
        if re.search(r'(?:\bfrom\s*|\bimport\s*\()\s*[\'"](?:https?:|/)', module_text):
            raise RuntimeError("Downloaded SchemaTex module contains an external import.")
        package_license = package_target / "LICENSE"
        if b"GNU AFFERO GENERAL PUBLIC LICENSE" not in package_license.read_bytes().upper():
            raise RuntimeError("Downloaded SchemaTex license failed validation.")
        shutil.copy2(package_license, extracted / "LICENSE")
        if install_dir.exists():
            shutil.rmtree(install_dir)
        shutil.copytree(extracted, install_dir)
    write_source_record(install_dir, "schematex", SCHEMATEX_VERSION, selected, archive_data, "AGPL-3.0-only")
    print(f"SchemaTex {SCHEMATEX_VERSION}: {len(archive_data)} package bytes from {selected}; sha256={hashlib.sha256(archive_data).hexdigest()}")


def main() -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    install_mermaid()
    install_katex()
    install_schematex()
    print(f"Browser assets installed in {ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
