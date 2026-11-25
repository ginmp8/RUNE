from __future__ import annotations

import os
import re
import signal
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

FENCE_RE = re.compile(r"```(?:reactflow|react-flow|xyflow|flow-json)\s*\n(.*?)\n```", re.DOTALL | re.IGNORECASE)


def run_browser_command(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as error:
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
        raise RuntimeError(
            f"Chromium timed out after {timeout_seconds} seconds: {' '.join(command)}\n{stderr.strip()}"
        ) from error
    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)


def find_chromium(explicit: str | None = None) -> str:
    candidates = [
        explicit,
        os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
    ]
    browser_root = Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "/ms-playwright"))
    if browser_root.exists():
        candidates.extend(str(path) for path in browser_root.glob("**/chrome") if path.is_file())
        candidates.extend(str(path) for path in browser_root.glob("**/headless_shell") if path.is_file())
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise RuntimeError("Chromium executable was not found.")


def run_chromium(html: str, *, executable: str | None, timeout_seconds: int, output_pdf: Path | None) -> tuple[str, bytes]:
    chromium = find_chromium(executable)
    with tempfile.TemporaryDirectory(prefix="rune-recovery-") as temporary:
        root = Path(temporary)
        html_path = root / "index.html"
        pdf_path = output_pdf or root / "output.pdf"
        html_path.write_text(html, encoding="utf-8")
        profile_path = root / "chromium-profile"
        base = [
            chromium,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--metrics-recording-only",
            "--no-first-run",
            f"--user-data-dir={profile_path}",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=10000",
        ]
        dump = run_browser_command([*base, "--dump-dom", html_path.as_uri()], timeout_seconds)
        if dump.returncode != 0:
            raise RuntimeError(f"Chromium DOM smoke failed: {dump.stderr.strip()}")
        printed = run_browser_command([*base, f"--print-to-pdf={pdf_path}", "--print-to-pdf-no-header", html_path.as_uri()], timeout_seconds)
        if printed.returncode != 0 or not pdf_path.is_file():
            raise RuntimeError(f"Chromium PDF smoke failed: {printed.stderr.strip()}")
        pdf = pdf_path.read_bytes()
        if not pdf.startswith(b"%PDF") or len(pdf) < 10_000:
            raise RuntimeError(f"Chromium produced an invalid PDF ({len(pdf)} bytes).")
        return dump.stdout, pdf


def inspect_dom(dom: str) -> dict[str, Any]:
    return {
        "documents": len(re.findall(r'class="[^"]*reactflow-document', dom)),
        "ready": len(re.findall(r'class="[^"]*reactflow-document[^>]+data-render-state="ready"|data-render-state="ready"[^>]+class="[^"]*reactflow-document', dom)),
        "svgs": len(re.findall(r'<svg\b', dom)),
        "nodes": len(re.findall(r'data-node-id=', dom)),
        "edges": len(re.findall(r'data-edge-id=', dom)),
        "markers": re.findall(r'<marker[^>]+id="(rf-arrow-\d+)"', dom),
    }
