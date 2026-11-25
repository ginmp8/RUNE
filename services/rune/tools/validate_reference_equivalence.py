#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "tests/compatibility/reference-feature-cases.json"
REFERENCE = ROOT / "tests/compatibility/reference-feature-cases.1.8.7.json"

ID_MAP = {
    "estrutura-basica": "basic-structure", "formatacao-textual": "text-formatting",
    "caracteres-emojis": "characters-and-emoji", "links-ancoras": "links-and-anchors",
    "imagens-midia": "images-and-media", "listas": "lists", "citacoes": "quotes",
    "codigo": "code", "tabelas": "tables", "notas-abreviacoes": "footnotes-and-abbreviations",
    "front-matter": "front-matter", "sumario-numeracao": "toc-and-numbering",
    "alertas-callouts": "alerts-and-callouts", "tabs-details": "tabs-and-details",
    "atributos-html": "attributes-and-html", "includes-transclusoes": "includes",
    "github": "github-compatibility", "obsidian": "obsidian-compatibility",
    "mkdocs": "mkdocs-compatibility", "pandoc": "pandoc-compatibility",
    "matematica-katex": "katex-math", "mermaid": "mermaid",
    "schematex-orgchart": "schematex-and-orgchart", "ownership-chart": "ownership-chart",
    "mapas": "maps", "graficos": "charts", "stl": "stl", "tabelas-dados": "data-tables",
    "diagramas-preservados": "preserved-diagrams", "quebras-condicional": "conditional-content-and-page-breaks",
    "capa-metadados": "cover-metadata", "cabecalho-rodape": "header-and-footer",
    "layout-temas-css": "themes-and-print-css", "preview-timing": "preview-readiness",
    "recursos-seguranca": "resource-security", "acessibilidade": "accessibility",
    "download-fluxo": "download-flow", "reactflow-universal": "reactflow-stable-svg",
}


def main() -> int:
    current_bytes = CURRENT.read_bytes()
    reference_bytes = REFERENCE.read_bytes()
    current = json.loads(current_bytes)
    reference = json.loads(reference_bytes)
    expected_hash = (ROOT / "tests/compatibility/reference-1.8.7.sha256").read_text(encoding="utf-8").split()[0]
    actual_hash = hashlib.sha256(reference_bytes).hexdigest()
    if actual_hash != expected_hash:
        raise SystemExit(f"Reference baseline hash mismatch: expected={expected_hash}, actual={actual_hash}")
    current_ids = {item["id"] for item in current}
    reference_ids = {item["id"] for item in reference}
    if len(current) != 38 or len(reference) != 38:
        raise SystemExit(f"Expected 38 cases in each inventory; current={len(current)}, reference={len(reference)}")
    if set(ID_MAP) != reference_ids:
        raise SystemExit(f"Reference mapping is incomplete: missing={sorted(reference_ids-set(ID_MAP))}, extra={sorted(set(ID_MAP)-reference_ids)}")
    mapped = set(ID_MAP.values())
    if mapped != current_ids:
        raise SystemExit(f"Current inventory differs from mapped reference: missing={sorted(mapped-current_ids)}, extra={sorted(current_ids-mapped)}")
    print(f"REFERENCE EQUIVALENCE PASSED (38/38 mapped cases, baseline 1.8.7, sha256={actual_hash})")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
