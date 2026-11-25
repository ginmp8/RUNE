#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_ROOT = ROOT / "services" / "rune" / "schemas"
EXAMPLE_ROOT = SCHEMA_ROOT / "examples"
errors: list[str] = []

schemas: dict[str, dict] = {}
resources: list[tuple[str, Resource[dict]]] = []
for path in sorted(SCHEMA_ROOT.glob("*.schema.json")):
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
        resource = Resource.from_contents(schema)
        resources.append((path.name, resource))
        resources.append((path.resolve().as_uri(), resource))
        if schema_id := schema.get("$id"):
            resources.append((str(schema_id), resource))
    except Exception as error:
        errors.append(f"{path.name}: invalid schema: {error}")

registry = Registry().with_resources(resources)

for schema_name, schema in schemas.items():
    example_name = schema_name.replace(".schema.json", ".example.json")
    example_path = EXAMPLE_ROOT / example_name
    if not example_path.is_file():
        errors.append(f"{schema_name}: missing example {example_name}")
        continue
    try:
        instance = json.loads(example_path.read_text(encoding="utf-8"))
        validator = Draft202012Validator(
            schema,
            registry=registry,
            format_checker=FormatChecker(),
        )
        failures = sorted(validator.iter_errors(instance), key=lambda item: list(item.absolute_path))
        for failure in failures:
            location = "/".join(str(part) for part in failure.absolute_path) or "$"
            errors.append(f"{example_name}:{location}: {failure.message}")
    except Exception as error:
        errors.append(f"{example_name}: validation error: {error}")

if errors:
    print("SCHEMA VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)
print(f"SCHEMA VALIDATION PASSED ({len(schemas)} schemas and examples)")
