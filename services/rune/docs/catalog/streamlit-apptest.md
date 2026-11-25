# Streamlit AppTest

RUNE Studio includes an exact `streamlit.testing.v1.AppTest` runtime gate for Streamlit `1.59.2`.

The AppTest loads the complete application, verifies the Editor, PDF-to-HTML, Jobs, and Documentation surfaces, edits a SchemaTex document, updates the interactive preview through a live RUNE API, and generates a real Static HTML export. The fixture exercises both SchemaTex `entity-structure` and `orgchart` diagrams.

`services/rune/apps/rune-studio/tests/test_app.py` uses a controlled HTTP fixture for deterministic UI interaction tests. `scripts/verify_streamlit_apptest.py` is the live API gate and fails when the exact Streamlit runtime or its declared dependencies are unavailable; it does not simulate AppTest success.
