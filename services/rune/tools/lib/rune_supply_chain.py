from __future__ import annotations

import hashlib
import json
import re
import tomllib
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

RELEASE_TIMESTAMP = "2026-07-28T00:00:00Z"
SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _component(kind: str, name: str, version: str, *, source: str) -> dict[str, Any]:
    ecosystem = {"nuget": "nuget", "pypi": "pypi", "npm": "npm"}[kind]
    return {
        "type": "library",
        "name": name,
        "version": version,
        "purl": f"pkg:{ecosystem}/{name}@{version}",
        "properties": [{"name": "rune:source", "value": source}],
    }


def collect_components(root: Path) -> list[dict[str, Any]]:
    components: dict[str, dict[str, Any]] = {}

    packages = root / "Directory.Packages.props"
    if packages.is_file():
        tree = ET.parse(packages)
        for node in tree.findall(".//PackageVersion"):
            name = node.attrib.get("Include") or node.attrib.get("Update")
            version = node.attrib.get("Version")
            if name and version:
                item = _component("nuget", name, version, source="Directory.Packages.props")
                components[item["purl"]] = item

    for path in sorted(root.rglob("pyproject.toml")):
        if any(part in {"bin", "obj", ".venv", "node_modules"} for part in path.relative_to(root).parts):
            continue
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        for dependency in data.get("project", {}).get("dependencies", []):
            match = re.match(r"\s*([A-Za-z0-9_.-]+)\s*(?:==|~=|>=|<=|>|<)?\s*([0-9][^,; ]*)?", dependency)
            if not match:
                continue
            name, version = match.group(1), match.group(2) or "unspecified"
            item = _component("pypi", name.lower(), version, source=path.relative_to(root).as_posix())
            components[item["purl"]] = item

    for path in sorted(root.rglob("requirements.txt")):
        if any(part in {"bin", "obj", ".venv", "node_modules"} for part in path.relative_to(root).parts):
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            match = re.match(r"([A-Za-z0-9_.-]+)==([^;\s]+)$", line)
            if match:
                item = _component("pypi", match.group(1).lower(), match.group(2), source=path.relative_to(root).as_posix())
                components[item["purl"]] = item

    for path in sorted((root / "services/rune/assets/vendor").glob("*/package.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("name") and data.get("version"):
            item = _component("npm", data["name"], data["version"], source=path.relative_to(root).as_posix())
            components[item["purl"]] = item

    # Modified source-derived browser assets may intentionally omit an npm
    # package.json. Their SOURCE.json is the canonical supply-chain identity.
    for path in sorted((root / "services/rune/assets/vendor").glob("*/SOURCE.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        name = data.get("package")
        version = data.get("upstreamVersion") or data.get("version")
        if name and version:
            item = _component("npm", str(name), str(version), source=path.relative_to(root).as_posix())
            item["properties"].extend([
                {"name": "rune:license", "value": str(data.get("license") or "unknown")},
                {"name": "rune:modified", "value": str(bool(data.get("modified"))).lower()},
                {"name": "rune:upstreamCommit", "value": str(data.get("upstreamCommit") or "unknown")},
            ])
            components[item["purl"]] = item

    package = root / "services/rune/sdk/typescript/package.json"
    if package.is_file():
        data = json.loads(package.read_text(encoding="utf-8"))
        for section in ("dependencies", "devDependencies"):
            for name, version in data.get(section, {}).items():
                item = _component("npm", name, str(version).lstrip("^~"), source=package.relative_to(root).as_posix())
                components[item["purl"]] = item

    return [components[key] for key in sorted(components)]


def generate_sbom(root: Path) -> dict[str, Any]:
    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    components = collect_components(root)
    identity = hashlib.sha256(json.dumps(components, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.6",
        "serialNumber": f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, 'rune:'+version+':'+identity)}",
        "version": 1,
        "metadata": {
            "timestamp": RELEASE_TIMESTAMP,
            "component": {"type": "application", "name": "RUNE", "version": version},
            "tools": {"components": [{"type": "application", "name": "RUNE SBOM generator", "version": version}]},
        },
        "components": components,
    }


def parse_version(value: str) -> tuple[int, ...]:
    main = value.strip().split("+", 1)[0].split("-", 1)[0]
    numbers: list[int] = []
    for part in main.split("."):
        match = re.match(r"\d+", part)
        numbers.append(int(match.group()) if match else 0)
    while len(numbers) < 4:
        numbers.append(0)
    return tuple(numbers)


def version_in_range(version: str, expression: str) -> bool:
    expression = expression.strip()
    if not expression:
        return False
    current = parse_version(version)
    if expression[0] not in "[(":
        return current == parse_version(expression)
    if expression[-1] not in ")]":
        raise ValueError(f"invalid version range: {expression}")
    lower_inclusive = expression[0] == "["
    upper_inclusive = expression[-1] == "]"
    lower_raw, upper_raw = (part.strip() for part in expression[1:-1].split(",", 1))
    if lower_raw:
        lower = parse_version(lower_raw)
        if current < lower or (current == lower and not lower_inclusive):
            return False
    if upper_raw:
        upper = parse_version(upper_raw)
        if current > upper or (current == upper and not upper_inclusive):
            return False
    return True


def scan_sbom(sbom: dict[str, Any], database: dict[str, Any], *, database_digest: str) -> dict[str, Any]:
    components = sbom.get("components") or []
    report: dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": RELEASE_TIMESTAMP,
        "status": "completed",
        "database": {
            "source": database.get("source"),
            "generatedAt": database.get("generatedAt"),
            "coverage": database.get("coverage"),
            "sha256": database_digest,
        },
        "componentsScanned": len(components),
        "advisoriesEvaluated": len(database.get("advisories") or []),
        "findings": [],
        "summary": {"low": 0, "medium": 0, "high": 0, "critical": 0, "total": 0},
    }
    if database.get("coverage") != "complete":
        report["status"] = "blocked-incomplete-advisory-database"
        return report

    by_purl = {str(item.get("purl", "")).lower(): item for item in components}
    by_name = {str(item.get("name", "")).lower(): item for item in components}
    for advisory in database.get("advisories") or []:
        component = by_purl.get(str(advisory.get("purl", "")).lower()) or by_name.get(str(advisory.get("package", "")).lower())
        if not component or not version_in_range(str(component.get("version", "0")), str(advisory.get("versions", ""))):
            continue
        severity = str(advisory.get("severity", "medium")).lower()
        finding = {
            "id": advisory.get("id"), "severity": severity, "url": advisory.get("url"),
            "component": {"name": component.get("name"), "version": component.get("version"), "purl": component.get("purl")},
            "versions": advisory.get("versions"),
        }
        report["findings"].append(finding)
        report["summary"][severity] += 1
    report["findings"].sort(key=lambda item: (-SEVERITY_ORDER.get(item["severity"], 1), str(item["id"])))
    report["summary"]["total"] = len(report["findings"])
    return report


def generate_provenance(subjects: Iterable[Path], *, version: str, builder_id: str, invocation: dict[str, Any], materials: list[dict[str, Any]]) -> dict[str, Any]:
    subject_items = [{"name": item.name, "digest": {"sha256": sha256_file(item)}} for item in subjects]
    subject_items.sort(key=lambda item: item["name"])
    seed = hashlib.sha256(json.dumps(subject_items, sort_keys=True).encode()).hexdigest()
    return {
        "_type": "https://in-toto.io/Statement/v1",
        "subject": subject_items,
        "predicateType": "https://slsa.dev/provenance/v1",
        "predicate": {
            "buildDefinition": {
                "buildType": "https://rune.local/build-types/source-release/v1",
                "externalParameters": invocation,
                "internalParameters": {"productVersion": version},
                "resolvedDependencies": materials,
            },
            "runDetails": {
                "builder": {"id": builder_id},
                "metadata": {"invocationId": str(uuid.uuid5(uuid.NAMESPACE_URL, seed)), "startedOn": RELEASE_TIMESTAMP, "finishedOn": RELEASE_TIMESTAMP},
            },
        },
    }
