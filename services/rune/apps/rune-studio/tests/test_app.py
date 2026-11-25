from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterator

import pytest

from rune_studio.pdf_import import conversion_artifact_names

APP = Path(__file__).resolve().parents[1] / "app.py"
EXPECTED_STREAMLIT = "1.59.2"
SCHEMATEX_SOURCE = '''---
title: Studio AppTest
---
# Studio AppTest

```schematex
entity-structure "Studio Ownership"
entity owner "Owner" individual@BR
entity rune "RUNE Ltda." llc@BR
owner -> rune : 100%
```

```orgchart
ceo: "RUNE Director" | "CEO"
  studio: "Studio Lead" | "Streamlit"
```
'''


def by_label(elements, label: str):
    matches = [element for element in elements if getattr(element, "label", None) == label]
    assert len(matches) == 1, [getattr(element, "label", None) for element in elements]
    return matches[0]


@contextmanager
def fake_rune_api() -> Iterator[str]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:
            return

        def send_json(self, payload: dict, status: int = 200) -> None:
            content = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def do_GET(self) -> None:
            if self.path.startswith("/v1/renders"):
                self.send_json({"items": [], "total": 0, "offset": 0, "limit": 50})
                return
            if self.path == "/v1/features":
                self.send_json({"version": "0.10.0", "dispatchProvider": "nats"})
                return
            self.send_json({"error": "not-found"}, status=404)

        def do_POST(self) -> None:
            if self.path != "/v1/render":
                self.send_json({"error": "not-found"}, status=404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length) or b"{}")
            output = request.get("outputFormat")
            content = request.get("content", "")
            assert "entity-structure" in content
            assert "```orgchart" in content
            if output == "interactiveHtml":
                self.send_json(
                    {
                        "contentType": "text/html; charset=utf-8",
                        "html": "<html><body>SchemaTex AppTest</body><script>window.__RUNE_RENDER_DONE__=true;window.__RUNE_SCHEMATEX_MODULE_BASE64__='fixture';</script></html>",
                        "diagnostics": [],
                    }
                )
                return
            if output == "structuredJson":
                self.send_json(
                    {
                        "contentType": "application/json",
                        "document": {
                            "schemaVersion": "1.0",
                            "blocks": [
                                {"type": "schematex", "source": "entity-structure"},
                                {"type": "orgchart", "source": "ceo"},
                            ],
                        },
                    }
                )
                return
            self.send_json({"error": "unsupported-output"}, status=400)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_conversion_artifact_names_is_safe_and_deduplicated() -> None:
    report = {"extractedArtifacts": [{"name": "image-1.png"}, {"name": "image-1.png"}, {"name": "../image-2.jpg"}, {}]}
    assert conversion_artifact_names(report) == ["image-1.png", "image-2.jpg"]


def test_streamlit_apptest_executes_editor_preview_and_export(monkeypatch: pytest.MonkeyPatch) -> None:
    streamlit = pytest.importorskip("streamlit")
    assert streamlit.__version__ == EXPECTED_STREAMLIT
    from streamlit.testing.v1 import AppTest

    with fake_rune_api() as api_url:
        monkeypatch.setenv("RUNE_API_URL", api_url)
        at = AppTest.from_file(str(APP), default_timeout=20).run()
        assert not at.exception
        assert at.title[0].value == "RUNE Studio"
        assert {tab.label for tab in at.tabs} == {"Editor", "Templates", "PDF to HTML", "Compare", "Jobs", "Documentation"}
        assert {"Conversion mode", "OCR mode"}.issubset({item.label for item in at.selectbox})
        assert {"Export formats", "Outputs"}.issubset({item.label for item in at.multiselect})
        assert {"Preserve safe links", "Extract images"}.issubset({item.label for item in at.checkbox})

        by_label(at.text_area, "Document source").input(SCHEMATEX_SOURCE)
        by_label(at.multiselect, "Export formats").set_value(["Structured JSON"])
        by_label(at.button, "Update preview").click()
        at.run(timeout=20)
        assert not at.exception
        assert "__RUNE_RENDER_DONE__" in at.session_state["preview_html"]
        assert "__RUNE_SCHEMATEX_MODULE_BASE64__" in at.session_state["preview_html"]

        by_label(at.button, "Generate export").click()
        at.run(timeout=20)
        assert not at.exception
        export = at.session_state["last_export"]
        assert export["label"] == "Structured JSON"
        document = json.loads(export["content"])
        assert {block["type"] for block in document["blocks"]} == {"schematex", "orgchart"}
