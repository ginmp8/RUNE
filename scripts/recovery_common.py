from __future__ import annotations

import os
import re
import signal
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
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
    worker_dll = os.environ.get("RUNE_RECOVERY_WORKER_DLL")
    with tempfile.TemporaryDirectory(prefix="rune-recovery-") as temporary:
        root = Path(temporary)
        html_path = root / "index.html"
        pdf_path = output_pdf or root / "output.pdf"
        html_path.write_text(html, encoding="utf-8")
        if worker_dll:
            dom_path = root / "rendered.html"
            command = [
                "dotnet", worker_dll, "--validate-recovery-browser",
                str(html_path), str(dom_path), str(pdf_path.resolve()), str(timeout_seconds),
            ]
            override = executable or os.environ.get("RUNE_CHROMIUM_EXECUTABLE_PATH") or os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
            if override:
                command.append(find_chromium(override))
            result = run_browser_command(command, timeout_seconds)
            if result.returncode != 0 or not dom_path.is_file() or not pdf_path.is_file():
                raise RuntimeError(f"Playwright recovery probe failed: {result.stderr.strip()}")
            pdf = pdf_path.read_bytes()
            if not pdf.startswith(b"%PDF") or len(pdf) < 10_000:
                raise RuntimeError(f"Chromium produced an invalid PDF ({len(pdf)} bytes).")
            return dom_path.read_text(encoding="utf-8"), pdf

        # Retain the standalone Chromium command for historical host tooling.
        chromium = find_chromium(executable)
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


class _ReactFlowDomInspector(HTMLParser):
    """Count materialized elements, not markup in embedded scripts or other diagrams."""

    _VOID_TAGS = frozenset({
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    })

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.counts: dict[str, Any] = {
            "documents": 0, "ready": 0, "svgs": 0,
            "nodes": 0, "edges": 0, "markers": [],
        }
        self._stack: list[tuple[str, bool, bool, bool]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = (values.get("class") or "").split()
        _, in_document, in_canvas, in_svg = (
            self._stack[-1] if self._stack else ("", False, False, False)
        )
        if "reactflow-document" in classes:
            self.counts["documents"] += 1
            if values.get("data-render-state") == "ready":
                self.counts["ready"] += 1
            in_document, in_canvas, in_svg = True, False, False
        in_canvas = in_document and (in_canvas or "reactflow-canvas" in classes)
        if in_canvas and tag == "svg":
            self.counts["svgs"] += 1
            in_svg = True
        if in_svg:
            if "data-node-id" in values:
                self.counts["nodes"] += 1
            if "data-edge-id" in values:
                self.counts["edges"] += 1
            marker = values.get("id") or ""
            if tag == "marker" and re.fullmatch(r"rf-arrow-\d+", marker):
                self.counts["markers"].append(marker)
        if tag not in self._VOID_TAGS:
            self._stack.append((tag, in_document, in_canvas, in_svg))

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == tag:
                del self._stack[index:]
                break

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self._VOID_TAGS:
            self.handle_endtag(tag)


def inspect_dom(dom: str) -> dict[str, Any]:
    inspector = _ReactFlowDomInspector()
    inspector.feed(dom)
    inspector.close()
    return inspector.counts
