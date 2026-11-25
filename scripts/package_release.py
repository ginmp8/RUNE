#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

BLOCKED = {".git", ".venv", ".pytest_cache", "__pycache__", "bin", "obj", "node_modules", "TestResults", "artifacts", "build", ".vs", ".idea", ".mypy_cache", ".ruff_cache", "coverage", ".artifacts"}
BLOCKED_SUFFIXES = {".pyc", ".pyo", ".tmp", ".log", ".zip", ".user", ".suo", ".nupkg", ".snupkg"}
GENERATED_RELEASE_FILES = {"TREE.txt", "MANIFEST.sha256", "SBOM.cdx.json", "VULNERABILITY_SCAN.json"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and validate an immutable RUNE source release.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True, help="Release directory, for example rune-0.7.0")
    return parser.parse_args()


def blocked_path(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    return (
        bool(BLOCKED.intersection(relative.parts))
        or path.suffix.lower() in BLOCKED_SUFFIXES
        or relative.parts[0] == "dist"
        or (path.name.startswith(".env") and path.name != ".env.example")
    )


def release_files(root: Path) -> list[Path]:
    if (root / ".git").exists():
        # Only tracked source and explicitly generated release evidence may enter
        # a Git-derived package; ignored local credentials and build state cannot.
        tracked = subprocess.run(["git", "ls-files", "-z"], cwd=root, capture_output=True, check=True)
        paths = {root / name for name in tracked.stdout.decode("utf-8").split("\0") if name}
        paths.update(root / name for name in GENERATED_RELEASE_FILES if (root / name).is_file())
    else:
        paths = {path for path in root.rglob("*") if path.is_file()}
    result = []
    for path in sorted(paths, key=lambda item: item.relative_to(root).as_posix()):
        if blocked_path(path, root):
            continue
        if path.is_symlink() or not path.is_file():
            raise RuntimeError(f"release input is missing or is a symlink: {path.relative_to(root)}")
        result.append(path)
    return result


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate_tree(root: Path) -> str:
    files = {path.relative_to(root) for path in release_files(root)}
    files.update((Path("TREE.txt"), Path("MANIFEST.sha256")))
    directories = {parent for path in files for parent in path.parents if parent != Path(".")}
    lines = ["RUNE/"]
    for relative in sorted(files | directories, key=lambda item: item.as_posix()):
        depth = len(relative.parts)
        lines.append(f"{'    ' * depth}{relative.name}{'/' if relative in directories else ''}")
    return "\n".join(lines) + "\n"


def generate_manifest(root: Path) -> str:
    entries = []
    for path in release_files(root):
        if path.relative_to(root).as_posix() == "MANIFEST.sha256":
            continue
        entries.append(f"{sha256(path)}  {path.relative_to(root).as_posix()}")
    return "\n".join(entries) + "\n"


def verify_manifest(root: Path) -> None:
    manifest = root / "MANIFEST.sha256"
    for line in manifest.read_text(encoding="utf-8").splitlines():
        expected, relative = line.split("  ", 1)
        path = root / relative
        if not path.is_file() or sha256(path) != expected:
            raise RuntimeError(f"manifest verification failed: {relative}")


def write_zip(source_root: Path, archive: Path) -> None:
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for path in release_files(source_root):
            relative = path.relative_to(source_root)
            info = zipfile.ZipInfo((Path("RUNE") / relative).as_posix(), date_time=(2026, 7, 28, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if path.suffix in {".sh", ".py"} else 0o644) << 16
            output.writestr(info, path.read_bytes())


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    expected_name = f"rune-{version}"
    if output.name != expected_name:
        raise SystemExit(f"output directory must be named {expected_name}")

    subprocess.run([sys.executable, str(root / "scripts/generate_sbom.py"), "--root", str(root), "--output", str(root / "SBOM.cdx.json")], check=True)
    (root / "TREE.txt").write_text(generate_tree(root), encoding="utf-8")
    (root / "MANIFEST.sha256").write_text(generate_manifest(root), encoding="utf-8")
    subprocess.run([sys.executable, str(root / "scripts/validate_workspace.py"), "--root", str(root)], check=True)
    verify_manifest(root)

    output.mkdir(parents=True, exist_ok=False)
    archive = output / f"RUNE-{version}.zip"
    write_zip(root, archive)

    with tempfile.TemporaryDirectory(prefix="rune-release-") as temp:
        with zipfile.ZipFile(archive) as source:
            source.extractall(temp)
        extracted = Path(temp) / "RUNE"
        verify_manifest(extracted)
        subprocess.run([sys.executable, str(extracted / "scripts/validate_workspace.py"), "--root", str(extracted), "--release"], check=True)

    checksum = sha256(archive)
    (output / f"RUNE-{version}.sha256").write_text(f"{checksum}  {archive.name}\n", encoding="utf-8")
    for name in (
        "CHANGELOG.md",
        "RELEASE_NOTES.md",
        "VALIDATION.md",
        f"IMPLEMENTATION_REPORT_{version}.md",
        f"MIGRATION_{version}.md",
        f"ROLLBACK_{version}.md",
        f"RECOVERY_{version}.md",
        f"SPECIFICATION_CONVERGENCE_{version}.md",
        "SBOM.cdx.json",
        "CANDIDATE_STATUS.md",
    ):
        source = root / name
        if source.is_file():
            shutil.copy2(source, output / name)
    print(f"RELEASE PACKAGE PASSED: {archive}")
    print(f"SHA256: {checksum}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
