from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("recovery_common", ROOT / "scripts/recovery_common.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_inspect_dom_counts_only_materialized_reactflow_elements() -> None:
    dom = """
    <!doctype html><html><head><script>
      const ownership = '<svg class="ownership-formal-svg"></svg>';
      const fake = '<figure class="reactflow-document" data-render-state="ready"><svg data-node-id="fake"></svg></figure>';
    </script></head><body>
      <svg class="unrelated" data-edge-id="outside"></svg>
      <figure data-render-state="ready" class="diagram reactflow-document">
        <img src="thumbnail.png">
        <div class="reactflow-canvas">
          <svg><defs><marker id="rf-arrow-0"/></defs>
            <g data-node-id="node-1"></g><path data-edge-id="edge-1"/>
          </svg>
        </div>
      </figure>
      <figure class="reactflow-document" data-render-state="loading">
        <div class="reactflow-canvas"></div>
      </figure>
      <svg><marker id="rf-arrow-99"/></svg>
    </body></html>
    """
    assert MODULE.inspect_dom(dom) == {
        "documents": 2, "ready": 1, "svgs": 1,
        "nodes": 1, "edges": 1, "markers": ["rf-arrow-0"],
    }


def test_inspect_dom_does_not_hide_duplicate_or_missing_rendered_elements() -> None:
    dom = """
    <figure class="reactflow-document" data-render-state="ready">
      <div class="reactflow-canvas">
        <svg><marker id="rf-arrow-0"/></svg><svg><marker id="rf-arrow-0"/></svg>
      </div>
    </figure>
    <figure class="reactflow-document" data-render-state="ready">
      <div class="reactflow-canvas"></div>
    </figure>
    """
    assert MODULE.inspect_dom(dom) == {
        "documents": 2, "ready": 2, "svgs": 2,
        "nodes": 0, "edges": 0, "markers": ["rf-arrow-0", "rf-arrow-0"],
    }
