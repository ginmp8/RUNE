#!/usr/bin/env python3
"""Execute every solution test project; isolate the known native PDF testhost crash."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PDF_PROJECT = "services/rune/tests/Rune.Pdf.Tests/Rune.Pdf.Tests.csproj"
BASE = ["dotnet", "test", "-c", "Release", "--no-build", "--no-restore"]


def run(project: str, *args: str, capture: bool = False) -> subprocess.CompletedProcess[str]:
    command = [*BASE, project, *args]
    print("+", " ".join(command), flush=True)
    result = subprocess.run(command, cwd=ROOT, text=True,
                            stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.STDOUT if capture else None, check=False)
    if capture:
        print(result.stdout, flush=True)
    return result


def discover_native_tests() -> list[str]:
    result = run(PDF_PROJECT, "--list-tests", capture=True)
    if result.returncode:
        raise RuntimeError("Native PDF test discovery failed.")
    names = [line.strip() for line in result.stdout.splitlines()
             if line.strip().startswith("Rune.Pdf.Tests.")]
    if len(names) < 17 or len(names) != len(set(names)):
        raise RuntimeError(f"Native PDF test inventory is incomplete or ambiguous: {names!r}")
    if any(not re.fullmatch(r"Rune\.Pdf\.Tests\.[A-Za-z0-9_.]+", name) for name in names):
        raise RuntimeError("Native PDF test inventory contains unsupported parameterized names; update the isolation runner.")
    return names


def passed_exactly_one(path: Path) -> bool:
    if not path.is_file():
        return False
    ns = {"trx": "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}
    summary = ET.parse(path).find(".//trx:Counters", ns)
    return (summary is not None
            and summary.get("total") == "1"
            and summary.get("executed") == "1"
            and summary.get("passed") == "1"
            and summary.get("failed") == "0")


def main() -> int:
    projects = [node.attrib["Path"] for node in ET.parse(ROOT / "RUNE.slnx").iter("Project")
                if node.attrib.get("Path", "").endswith(".Tests.csproj")]
    if PDF_PROJECT not in projects or len(projects) < 6:
        raise RuntimeError("Solution test project inventory is incomplete.")
    failures: list[str] = []
    for project in projects:
        if project == PDF_PROJECT:
            continue
        if run(project, "--logger", "console;verbosity=normal").returncode:
            failures.append(project)

    # RUNE 0.18.0 already records an aggregate native testhost crash in
    # VALIDATION.md. Keep every discovered case mandatory in a fresh process.
    # Verify TRX counters so an empty filter cannot be mistaken for a pass.
    names = discover_native_tests()
    with tempfile.TemporaryDirectory(prefix="rune-native-trx-",
                                     dir=os.environ.get("RUNNER_TEMP")) as temp:
        for index, name in enumerate(names):
            filename = f"case-{index}.trx"
            result = run(PDF_PROJECT, "--filter", f"FullyQualifiedName={name}",
                         "--results-directory", temp,
                         "--logger", f"trx;LogFileName={filename}",
                         "--logger", "console;verbosity=normal")
            if result.returncode or not passed_exactly_one(Path(temp) / filename):
                failures.append(name)
    print(f"Native PDF cases executed in isolation: {len(names)}")
    if failures:
        print("FAILED: " + "\n".join(failures), file=sys.stderr)
        return 1
    print("All solution test projects and native PDF cases passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
