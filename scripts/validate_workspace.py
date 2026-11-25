#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the RUNE workspace contract.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--release", action="store_true", help="Validate an extracted release package including its generated manifest and tree.")
    return parser.parse_args()


ARGS = parse_args()
ROOT = ARGS.root.resolve()
errors: list[str] = []


def relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def require(path: str) -> Path:
    value = ROOT / path
    if not value.exists():
        errors.append(f"missing: {path}")
    return value


def read(path: str) -> str:
    value = require(path)
    return value.read_text(encoding="utf-8", errors="replace") if value.is_file() else ""


required = [
    "VERSION", "Directory.Build.props", "Directory.Packages.props", "global.json", "NuGet.config",
    "RUNE.slnx", "RUNE-PROJECT_GOVERNANCE.md", "README.md", "CHANGELOG.md", "RELEASE_NOTES.md",
    "VALIDATION.md", "CANDIDATE_STATUS.md", f"IMPLEMENTATION_REPORT_{(ROOT / 'VERSION').read_text(encoding='utf-8').strip()}.md",
    "docker-compose.yml", "docker-compose.resilience.yml", "services/rune/Rune.slnx", "services/rune/apps/rune-api/Dockerfile",
    "services/rune/apps/rune-worker/Dockerfile", "services/rune/apps/rune-studio/Dockerfile",
    "services/rune/apps/rune-studio/app.py", "services/rune/sdk/dotnet/Rune.Client/Rune.Client.csproj",
    "services/rune/sdk/python/pyproject.toml", "services/rune/sdk/typescript/package.json",
    "services/rune/docs/README.md", "services/rune/docs/ARCHITECTURE.md",
    "services/rune/docs/PROJECT_STRUCTURE.md", "services/rune/docs/API.md",
    "services/rune/docs/RENDERING.md", "services/rune/docs/TESTING.md",
    "services/rune/docs/REFERENCE_BASELINE.md", "services/rune/docs/FEATURE_MATRIX.md",
    "services/rune/docs/catalog/catalog.json", "services/rune/schemas/render-request.v1.schema.json",
    "services/rune/tools/validate_feature_catalog.py", "services/rune/tools/validate_schemas.py",
    "services/rune/tools/Rune.Validation/Rune.Validation.csproj",
    "services/rune/tests/Rune.Browser.Tests/Rune.Browser.Tests.csproj",
    "messaging/nats/Nats.slnx", "messaging/nats/server/Dockerfile", "messaging/nats/docs/README.md",
    "messaging/nats/docs/SUBJECTS.md", "messaging/nats/docs/JETSTREAM.md",
    "scripts/install.sh", "scripts/run.sh", "scripts/test.sh", "scripts/stop.sh", "scripts/smoke.py",
    "scripts/verify_recovery_runtime.py", "scripts/verify_studio_pipeline.py",
    "scripts/verify_resilience_contract.py", "scripts/verify_multi_node_resilience.py",
    "scripts/run_resilience_load.py", "scripts/verify_dispatch_recovery.py", "scripts/verify_native_pdf_pipeline.py",
    "services/rune/docs/operations/distributed-resilience.md",
    "services/rune/docs/operations/failure-injection.md",
    "services/rune/docs/operations/resilience-load-and-soak.md",
    "services/rune/docs/operations/durable-dispatch-and-dead-letter.md",
    "services/rune/docs/operations/distributed-tracing.md",
    "services/rune/src/engine/Rune.ReactFlow/Rune.ReactFlow.csproj",
]
if ARGS.release:
    required.extend(("TREE.txt", "MANIFEST.sha256"))
for item in required:
    require(item)

# Structured file syntax.
for file in ROOT.rglob("*.json"):
    if any(part in {"bin", "obj", ".pytest_cache", "__pycache__"} for part in file.parts):
        continue
    try:
        json.loads(file.read_text(encoding="utf-8"))
    except Exception as error:
        errors.append(f"invalid JSON {relative(file)}: {error}")

for file in [ROOT / "docker-compose.yml", *ROOT.rglob("*.yaml"), *ROOT.rglob("*.yml")]:
    if not file.is_file():
        continue
    try:
        yaml.safe_load(file.read_text(encoding="utf-8"))
    except Exception as error:
        errors.append(f"invalid YAML {relative(file)}: {error}")

for file in ROOT.rglob("*.toml"):
    if any(part in {"bin", "obj", ".pytest_cache", "__pycache__"} for part in file.parts):
        continue
    try:
        tomllib.loads(file.read_text(encoding="utf-8"))
    except Exception as error:
        errors.append(f"invalid TOML {relative(file)}: {error}")

xml_files = [
    *ROOT.rglob("*.csproj"), *ROOT.rglob("*.slnx"), ROOT / "Directory.Build.props",
    ROOT / "Directory.Packages.props", ROOT / "NuGet.config",
]
for file in xml_files:
    try:
        ET.parse(file)
    except Exception as error:
        errors.append(f"invalid XML {relative(file)}: {error}")

# Version identity.
version = read("VERSION").strip()
if not re.fullmatch(r"0\.\d+\.\d+", version):
    errors.append(f"invalid pre-1.0 release version: {version!r}")
for release_document in (f"MIGRATION_{version}.md", f"ROLLBACK_{version}.md", f"RECOVERY_{version}.md"):
    require(release_document)
if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", version):
    errors.append(f"invalid semantic version: {version}")
version_files = [
    "Directory.Build.props", "CHANGELOG.md", "RELEASE_NOTES.md", "VALIDATION.md",
    "services/rune/apps/rune-studio/pyproject.toml",
    "services/rune/sdk/python/pyproject.toml", "services/rune/sdk/typescript/package.json",
    "services/rune/docs/catalog/catalog.json",
]
for path in version_files:
    if version not in read(path):
        errors.append(f"version {version} missing from {path}")
api_program = read("services/rune/apps/rune-api/Program.cs")
if "RuneVersion.Current" not in api_program:
    errors.append("rune-api must report the assembly-derived RuneVersion.Current")

# Solution and project-reference integrity.
projects = sorted(
    path for path in ROOT.rglob("*.csproj")
    if not any(part in {"bin", "obj"} for part in path.parts)
)
root_solution_paths: set[Path] = set()
for solution in ROOT.rglob("*.slnx"):
    try:
        tree = ET.parse(solution)
    except Exception:
        continue
    for element in tree.findall(".//Project"):
        project_path = element.attrib.get("Path")
        if not project_path:
            errors.append(f"solution project without Path: {relative(solution)}")
            continue
        resolved = (solution.parent / project_path).resolve()
        if not resolved.is_file():
            errors.append(f"broken solution project path {relative(solution)} -> {project_path}")
        if solution == ROOT / "RUNE.slnx":
            root_solution_paths.add(resolved)
for project in projects:
    if project.resolve() not in root_solution_paths:
        errors.append(f"root solution missing project: {relative(project)}")

central_packages: set[str] = set()
try:
    central_tree = ET.parse(ROOT / "Directory.Packages.props")
    central_packages = {
        item.attrib["Include"] for item in central_tree.findall(".//PackageVersion")
        if "Include" in item.attrib
    }
except Exception:
    pass
# Release regression contracts for the 0.5.0 build correction.
api_project = read("services/rune/apps/rune-api/Rune.Api.csproj")
if 'Sdk="Microsoft.NET.Sdk.Web"' not in api_project:
    errors.append("rune-api must use Microsoft.NET.Sdk.Web")
if '../../assets/**/*' not in api_project or 'CopyToOutputDirectory="PreserveNewest"' not in api_project:
    errors.append("rune-api must copy shared renderer assets to local output")
worker_program = read("services/rune/apps/rune-worker/Program.cs")
for namespace in (
    "Microsoft.Extensions.Configuration",
    "Microsoft.Extensions.DependencyInjection",
    "Microsoft.Extensions.Hosting",
    "Microsoft.Extensions.Logging",
):
    if f"using {namespace};" not in worker_program:
        errors.append(f"rune-worker missing explicit host import: {namespace}")
for test_directory in (
    "services/rune/tests/Rune.Engine.Tests",
    "services/rune/tests/Rune.Jobs.Tests",
    "services/rune/tests/Rune.Browser.Tests",
    "messaging/nats/tests/Rune.Messaging.Nats.Tests",
):
    global_usings = read(f"{test_directory}/GlobalUsings.cs")
    if "global using Xunit;" not in global_usings:
        errors.append(f"test project missing xUnit global import: {test_directory}")

for project in projects:
    try:
        tree = ET.parse(project)
    except Exception:
        continue
    for reference in tree.findall(".//ProjectReference"):
        path = reference.attrib.get("Include", "")
        if not (project.parent / path).resolve().is_file():
            errors.append(f"broken ProjectReference {relative(project)} -> {path}")
    for package in tree.findall(".//PackageReference"):
        package_id = package.attrib.get("Include", "")
        if package.attrib.get("Version") or package.find("Version") is not None:
            errors.append(f"non-central package version in {relative(project)}: {package_id}")
        if package_id and package_id not in central_packages:
            errors.append(f"package missing from Directory.Packages.props: {package_id}")

service_solution = read("services/rune/Rune.slnx")
for required_project in ("Rune.Ownership.csproj", "Rune.ReactFlow.csproj", "Rune.Client.csproj"):
    if required_project not in service_solution:
        errors.append(f"services/rune/Rune.slnx missing {required_project}")
if "Rune.Messaging.Nats.csproj" in service_solution or "messaging/nats" in service_solution.lower():
    errors.append("services/rune/Rune.slnx must not contain the concrete NATS adapter")

# Architectural boundary: concrete NATS belongs only to composition roots and messaging/nats.
for file in (ROOT / "services/rune/src").rglob("*"):
    if any(part in {"bin", "obj"} for part in file.parts):
        continue
    if file.is_file() and file.suffix in {".cs", ".csproj", ".json", ".conf", ".md"}:
        text = file.read_text(encoding="utf-8", errors="ignore")
        if any(token in text for token in ("NATS.Client", "NATS.Net", "JetStream", "Rune.Messaging.Nats")):
            errors.append(f"concrete NATS dependency inside RUNE libraries: {relative(file)}")

# Deployment contracts.
compose = yaml.safe_load(read("docker-compose.yml")) or {}
services = compose.get("services", {})
for service in ("nats", "rune-api", "rune-worker", "rune-studio"):
    if service not in services:
        errors.append(f"compose missing service: {service}")
for service in ("rune-api", "rune-worker", "rune-studio"):
    dockerfile = services.get(service, {}).get("build", {}).get("dockerfile")
    if not dockerfile or not (ROOT / dockerfile).is_file():
        errors.append(f"compose {service} has invalid Dockerfile")
if services.get("rune-worker", {}).get("environment", {}).get("RUNE_BROWSER_CONCURRENCY") != "1":
    errors.append("local worker concurrency must be 1 until message processing is parallelized")

resilience_compose = yaml.safe_load(read("docker-compose.resilience.yml")) or {}
resilience_services = resilience_compose.get("services", {})
for service in ("nats", "storage", "cache", "rune-api-a", "rune-api-b", "rune-worker-a", "rune-worker-b"):
    if service not in resilience_services:
        errors.append(f"resilience compose missing service: {service}")
for service in ("rune-api-a", "rune-api-b"):
    if resilience_services.get(service, {}).get("environment", {}).get("RUNE_DISPATCH_PROVIDER") != "nats":
        errors.append(f"resilience compose {service} must dispatch through NATS")
for service in ("rune-worker-a", "rune-worker-b"):
    volumes = " ".join(resilience_services.get(service, {}).get("volumes", []))
    if "rune-data:/data" not in volumes or "rune-cache:/cache" not in volumes:
        errors.append(f"resilience compose {service} must use shared data and cache volumes")

expected_images = {
    "services/rune/apps/rune-api/Dockerfile": ["mcr.microsoft.com/dotnet/sdk:10.0.302", "mcr.microsoft.com/dotnet/aspnet:10.0.10"],
    "services/rune/apps/rune-worker/Dockerfile": ["mcr.microsoft.com/dotnet/sdk:10.0.302", "mcr.microsoft.com/dotnet/aspnet:10.0.10"],
    "services/rune/apps/rune-studio/Dockerfile": ["python:3.13-slim"],
    "messaging/nats/server/Dockerfile": ["nats:2.14.3-alpine3.22"],
}
for path, images in expected_images.items():
    text = read(path)
    for image in images:
        if image not in text:
            errors.append(f"{path} missing pinned image {image}")
    if re.search(r"^HEALTHCHECK[^\n]*\bCMD-SHELL\b", text, re.MULTILINE):
        errors.append(f"{path} uses Compose-only CMD-SHELL syntax in Dockerfile HEALTHCHECK")
worker_dockerfile = read("services/rune/apps/rune-worker/Dockerfile")
if "COPY VERSION /validation/VERSION" not in worker_dockerfile:
    errors.append("worker Dockerfile must copy the version consumed by its recovery validators")
for compose_path in ("docker-compose.yml", "docker-compose.resilience.yml"):
    definition = yaml.safe_load(read(compose_path))
    for name, service in definition.get("services", {}).items():
        build = service.get("build", {})
        if isinstance(build, dict) and build.get("dockerfile") == "services/rune/apps/rune-worker/Dockerfile" and build.get("target") != "runtime":
            errors.append(f"{compose_path}: {name} must select the worker runtime stage")
for marker in ("AS browser-test", "ghostscript", "icc-profiles-free", "--install-playwright", "verify_recovery_runtime.py"):
    if marker not in worker_dockerfile:
        errors.append(f"worker Dockerfile missing browser/PDF-A contract: {marker}")

# Feature, asset, and schema contracts.
renderer = read("services/rune/assets/runtime/renderers.js")
reactflow = read("services/rune/assets/reactflow/reactflow-renderer.js")
for marker in ("renderOwnership", "MarkdownPdfReactFlow.renderAll"):
    if marker not in renderer:
        errors.append(f"renderer contract missing: {marker}")
schematex_adapter = read("services/rune/src/engine/Rune.Markdown/OfficialSchemaTexAdapter.cs")
schematex_bridge = read("services/rune/assets/vendor/schematex/render.mjs")
schematex_package = require("services/rune/assets/vendor/schematex/package/dist/index.js")
for marker in ("OfficialSchemaTexAdapter", "PackageVersion = \"1.0.1\"", "SanitizeSvg", "renderResult API"):
    if marker not in schematex_adapter:
        errors.append(f"official SchemaTex adapter contract missing: {marker}")
for marker in ("'render'", "'renderPreview'", "'renderResult'", "module.renderResult"):
    if marker not in schematex_bridge:
        errors.append(f"official SchemaTex bridge contract missing: {marker}")
if schematex_package.is_file() and schematex_package.stat().st_size < 10_000:
    errors.append("official SchemaTex package entry is unexpectedly small")
for marker in (
    "for (const [diagramIndex, node] of nodes.entries())",
    "renderDocument(node, diagramIndex)",
    "rf-arrow-${diagramIndex}",
    "window.MarkdownPdfReactFlow",
):
    if marker not in reactflow:
        errors.append(f"stable React Flow renderer contract missing: {marker}")
for forbidden in ("@xyflow/react", "ReactFlowProvider", "runtime-prelude.js"):
    if forbidden in reactflow or (ROOT / "services/rune/assets/reactflow/runtime-prelude.js").exists():
        errors.append(f"withdrawn embedded React Flow runtime is present: {forbidden}")
downloader = read("services/rune/tools/download-web-assets.py")
for marker in (
    'SCHEMATEX_VERSION = "1.0.1"', 'MERMAID_VERSION = "11.16.0"',
    'KATEX_VERSION = "0.18.1"',
):
    if marker not in downloader:
        errors.append(f"asset downloader contract missing: {marker}")
for forbidden in ("XYFLOW_REACT_VERSION", "install_reactflow_runtime", "REACTFLOW_ASSETS"):
    if forbidden in downloader:
        errors.append(f"withdrawn React Flow asset download remains: {forbidden}")

example_root = ROOT / "services/rune/examples/reactflow"
example_files = (
    "enterprise-event-driven-platform.md",
    "fraud-decision-orchestration.md",
    "multi-region-resilience.md",
)
example_pattern = re.compile(r"```(?:reactflow|react-flow|xyflow|flow-json)\s*\n(.*?)\n```", re.DOTALL | re.IGNORECASE)
example_documents = example_nodes = example_edges = 0
for name in example_files:
    path = example_root / name
    if not path.is_file():
        errors.append(f"missing recovery example: {relative(path)}")
        continue
    if f'version: "{version}"' not in path.read_text(encoding="utf-8"):
        errors.append(f"recovery example version mismatch: {relative(path)}")
    for payload in example_pattern.findall(path.read_text(encoding="utf-8")):
        try:
            document = json.loads(payload)
            example_documents += 1
            example_nodes += len(document.get("nodes", []))
            example_edges += len(document.get("edges", []))
        except Exception as error:
            errors.append(f"invalid recovery example {relative(path)}: {error}")
if (example_documents, example_nodes, example_edges) != (3, 72, 82):
    errors.append(f"recovery inventory mismatch: documents={example_documents}, nodes={example_nodes}, edges={example_edges}")

for schema in (ROOT / "services/rune/schemas").glob("*.schema.json"):
    if not re.fullmatch(r"[a-z0-9-]+\.v\d+\.schema\.json", schema.name):
        errors.append(f"schema name is not versioned: {relative(schema)}")

for validator in (
    "services/rune/tools/validate_feature_catalog.py",
    "services/rune/tools/validate_schemas.py",
    "services/rune/tools/validate_reference_equivalence.py",
    "scripts/verify_resilience_contract.py",
):
    result = subprocess.run([sys.executable, str(ROOT / validator)], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        errors.append(f"validator failed {validator}: {(result.stdout + result.stderr).strip()}")

# Syntax checks available without restore or Docker.
for script in ROOT.rglob("*.sh"):
    if any(part in {"bin", "obj"} for part in script.parts):
        continue
    result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
    if result.returncode:
        errors.append(f"shell syntax {relative(script)}: {result.stderr.strip()}")
for script in ROOT.rglob("*.py"):
    if any(part in {".pytest_cache", "__pycache__", "bin", "obj"} for part in script.parts):
        continue
    try:
        compile(script.read_text(encoding="utf-8"), str(script), "exec")
    except SyntaxError as error:
        errors.append(f"python syntax {relative(script)}: {error}")
if subprocess.run(["sh", "-c", "command -v node >/dev/null"], capture_output=True).returncode == 0:
    for script in [*ROOT.rglob("*.js"), *ROOT.rglob("*.mjs")]:
        if any(part in {"vendor", "bin", "obj"} for part in script.parts):
            continue
        result = subprocess.run(["node", "--check", str(script)], capture_output=True, text=True)
        if result.returncode:
            errors.append(f"JavaScript syntax {relative(script)}: {result.stderr.strip()}")

# Script parity and complete validation path.
for stem in ("install", "run", "test", "stop"):
    for suffix in ("sh", "ps1", "bat"):
        require(f"scripts/{stem}.{suffix}")
test_script = read("scripts/test.sh")
for marker in (
    "validate_workspace.py", "verify_resilience_contract.py", "dotnet test", "browser-test",
    "docker compose", "smoke.py", "verify_studio_pipeline.py", "verify_multi_node_resilience.py",
):
    if marker not in test_script:
        errors.append(f"scripts/test.sh missing validation stage: {marker}")

# Project-owned language policy. Input compatibility tokens are excluded deliberately.
english_roots = [ROOT / "README.md", ROOT / "CHANGELOG.md", ROOT / "RELEASE_NOTES.md", ROOT / "VALIDATION.md", ROOT / "services/rune/docs", ROOT / "messaging/nats/docs"]
portuguese_markers = re.compile(r"\b(implementado|implementada|funcionalidades|documentação|execução|versão|falha|erro interno|baixar|cancelar|tentar novamente)\b", re.IGNORECASE)
for base in english_roots:
    candidates = [base] if base.is_file() else list(base.rglob("*.md"))
    for file in candidates:
        if file.is_file() and portuguese_markers.search(file.read_text(encoding="utf-8", errors="ignore")):
            errors.append(f"project-owned documentation is not English: {relative(file)}")

# Hygiene and distribution policy.
blocked_parts = {"__pycache__", ".pytest_cache", ".git", ".venv", "node_modules", "bin", "obj", "TestResults", "artifacts", "build", ".vs", ".idea", ".mypy_cache", ".ruff_cache", "coverage", ".artifacts"}
# A Git checkout may contain ignored local files and Git metadata. Only tracked
# paths belong to the source contract. An extracted release must be entirely clean.
if not ARGS.release and (ROOT / ".git").exists():
    result = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
    hygiene_paths = [ROOT / name for name in result.stdout.decode("utf-8").split("\0") if name]
else:
    hygiene_paths = list(ROOT.rglob("*"))
for path in hygiene_paths:
    if blocked_parts.intersection(path.relative_to(ROOT).parts):
        errors.append(f"generated artifact present: {relative(path)}")
    if path.suffix.lower() in {".exe", ".msi", ".dmg", ".appimage", ".deb", ".rpm"}:
        errors.append(f"native executable distribution found: {relative(path)}")
    if path.suffix.lower() == ".zip":
        errors.append(f"nested archive present in source workspace: {relative(path)}")
    if not ARGS.release and (ROOT / ".git").exists() and path.relative_to(ROOT).as_posix() in {"TREE.txt", "MANIFEST.sha256", "SBOM.cdx.json", "VULNERABILITY_SCAN.json"}:
        errors.append(f"generated release evidence is tracked: {relative(path)}")

if errors:
    print("WORKSPACE VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"WORKSPACE VALIDATION PASSED ({len(projects)} .NET projects, version {version})")
