---
title: Enterprise Event-Driven Platform
version: "0.18.0"
reference: markdown-pdf-studio-1.8.7
---
# Enterprise Event-Driven Platform

Multi-zone architecture with 27 nodes, events, DLQ, observability, and operations.

The embedded RUNE preview and export path uses the local deterministic SVG renderer. Interactive editing remains a separate frontend concern.

```reactflow
{
  "schemaVersion": "1.0",
  "mode": "view",
  "preset": "generic",
  "viewport": {
    "fitView": true,
    "fitViewOptions": {
      "padding": 0.12
    },
    "minZoom": 0.05,
    "maxZoom": 3,
    "onlyRenderVisibleElements": false
  },
  "interaction": {
    "nodesDraggable": false,
    "nodesConnectable": false,
    "nodesFocusable": true,
    "edgesFocusable": true,
    "elementsSelectable": true,
    "panOnDrag": true,
    "zoomOnScroll": true,
    "zoomOnPinch": true,
    "zoomOnDoubleClick": true
  },
  "components": {
    "background": {
      "enabled": true,
      "variant": "dots",
      "gap": 20,
      "size": 1
    },
    "controls": {
      "enabled": true,
      "position": "bottom-left"
    },
    "miniMap": {
      "enabled": true,
      "position": "bottom-right",
      "pannable": true,
      "zoomable": true
    }
  },
  "accessibility": {
    "label": "Complex React Flow diagram",
    "keyboardNavigation": true,
    "textAlternative": true
  },
  "id": "enterprise-event-platform",
  "title": "Enterprise Event-Driven Onboarding Platform",
  "description": "Multi-zone architecture with events, retries, risk, observability and operational controls.",
  "nodes": [
    {
      "id": "edge-zone",
      "type": "group",
      "position": {
        "x": 0,
        "y": 0
      },
      "initialWidth": 780,
      "initialHeight": 600,
      "data": {
        "label": "Edge & Experience"
      }
    },
    {
      "id": "core-zone",
      "type": "group",
      "position": {
        "x": 900,
        "y": 0
      },
      "initialWidth": 980,
      "initialHeight": 760,
      "data": {
        "label": "Core Event Platform"
      }
    },
    {
      "id": "data-zone",
      "type": "group",
      "position": {
        "x": 2000,
        "y": 0
      },
      "initialWidth": 850,
      "initialHeight": 760,
      "data": {
        "label": "Data, Risk & Operations"
      }
    },
    {
      "id": "web",
      "type": "service",
      "position": {
        "x": 60,
        "y": 80
      },
      "data": {
        "label": "Web Portal",
        "technology": "React",
        "region": "global",
        "sla": "99.95%"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "mobile",
      "type": "service",
      "position": {
        "x": 60,
        "y": 240
      },
      "data": {
        "label": "Mobile App",
        "technology": "Flutter",
        "region": "global"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "partner",
      "type": "service",
      "position": {
        "x": 60,
        "y": 400
      },
      "data": {
        "label": "Partner API",
        "technology": "REST + mTLS",
        "sla": "99.9%"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "waf",
      "type": "risk",
      "position": {
        "x": 330,
        "y": 80
      },
      "data": {
        "label": "WAF & Bot Defense",
        "severity": "high"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "gateway",
      "type": "service",
      "position": {
        "x": 520,
        "y": 220
      },
      "data": {
        "label": "API Gateway",
        "technology": "YARP",
        "region": "sa-east-1"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "identity",
      "type": "service",
      "position": {
        "x": 330,
        "y": 400
      },
      "data": {
        "label": "Identity Broker",
        "technology": "OIDC/FIDO2"
      },
      "parentId": "edge-zone",
      "extent": "parent"
    },
    {
      "id": "onboarding",
      "type": "service",
      "position": {
        "x": 80,
        "y": 100
      },
      "data": {
        "label": "Onboarding Orchestrator",
        "technology": ".NET 10"
      },
      "handles": [
        {
          "id": "http",
          "type": "target",
          "position": "left",
          "presentation": {
            "label": "HTTP"
          }
        },
        {
          "id": "events",
          "type": "source",
          "position": "right",
          "presentation": {
            "label": "events"
          }
        },
        {
          "id": "sync",
          "type": "source",
          "position": "bottom",
          "presentation": {
            "label": "sync"
          }
        }
      ],
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "account",
      "type": "service",
      "position": {
        "x": 400,
        "y": 80
      },
      "data": {
        "label": "Account Service",
        "technology": ".NET 10 + PostgreSQL"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "document",
      "type": "service",
      "position": {
        "x": 680,
        "y": 80
      },
      "data": {
        "label": "Document Service",
        "technology": "S3 + OCR"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "eventbus",
      "type": "queue",
      "position": {
        "x": 360,
        "y": 300
      },
      "data": {
        "label": "Event Backbone",
        "technology": "Kafka",
        "topic": "onboarding.*"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "commandbus",
      "type": "queue",
      "position": {
        "x": 680,
        "y": 300
      },
      "data": {
        "label": "Command Queue",
        "technology": "SQS FIFO",
        "topic": "commands"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "worker-a",
      "type": "service",
      "position": {
        "x": 120,
        "y": 500
      },
      "data": {
        "label": "Eligibility Worker",
        "technology": "KEDA consumer"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "worker-b",
      "type": "service",
      "position": {
        "x": 400,
        "y": 500
      },
      "data": {
        "label": "Provisioning Worker",
        "technology": "KEDA consumer"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "saga",
      "type": "decision",
      "position": {
        "x": 680,
        "y": 500
      },
      "data": {
        "label": "Saga Coordinator",
        "result": "compensate/retry"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "state-db",
      "type": "database",
      "position": {
        "x": 380,
        "y": 640
      },
      "data": {
        "label": "Operational Store",
        "technology": "PostgreSQL",
        "region": "Multi-AZ"
      },
      "parentId": "core-zone",
      "extent": "parent"
    },
    {
      "id": "fraud",
      "type": "risk",
      "position": {
        "x": 70,
        "y": 100
      },
      "data": {
        "label": "Fraud Decisioning",
        "severity": "critical"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "compliance",
      "type": "service",
      "position": {
        "x": 340,
        "y": 100
      },
      "data": {
        "label": "Compliance Rules",
        "technology": "rules engine"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "lake",
      "type": "database",
      "position": {
        "x": 610,
        "y": 100
      },
      "data": {
        "label": "Onboarding Data Vault",
        "technology": "S3 + Iceberg"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "outbox",
      "type": "queue",
      "position": {
        "x": 70,
        "y": 330
      },
      "data": {
        "label": "Audit Stream",
        "technology": "Kafka",
        "topic": "audit"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "observability",
      "type": "service",
      "position": {
        "x": 340,
        "y": 330
      },
      "data": {
        "label": "Observability",
        "technology": "OTLP + Datadog"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "dlq",
      "type": "queue",
      "position": {
        "x": 610,
        "y": 330
      },
      "data": {
        "label": "Dead Letter Queue",
        "technology": "SQS DLQ"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "slo",
      "type": "metric",
      "position": {
        "x": 70,
        "y": 560
      },
      "data": {
        "label": "End-to-end SLO",
        "value": "99.90%",
        "status": "healthy"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "latency",
      "type": "metric",
      "position": {
        "x": 340,
        "y": 560
      },
      "data": {
        "label": "P95 onboarding",
        "value": "2m 18s",
        "status": "warning"
      },
      "parentId": "data-zone",
      "extent": "parent"
    },
    {
      "id": "ops",
      "type": "form",
      "position": {
        "x": 610,
        "y": 550
      },
      "data": {
        "label": "Operations Console",
        "fields": [
          {
            "name": "retry",
            "label": "Retry case",
            "type": "button"
          },
          {
            "name": "timeline",
            "label": "Timeline",
            "type": "link"
          }
        ]
      },
      "parentId": "data-zone",
      "extent": "parent"
    }
  ],
  "edges": [
    {
      "id": "web-waf",
      "source": "web",
      "target": "waf",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "HTTPS"
    },
    {
      "id": "mobile-waf",
      "source": "mobile",
      "target": "waf",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "HTTPS"
    },
    {
      "id": "partner-gw",
      "source": "partner",
      "target": "gateway",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "mTLS"
    },
    {
      "id": "waf-gw",
      "source": "waf",
      "target": "gateway",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "allowed"
    },
    {
      "id": "identity-gw",
      "source": "identity",
      "target": "gateway",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "tokens"
    },
    {
      "id": "gw-onboarding",
      "source": "gateway",
      "target": "onboarding",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "commands",
      "targetHandle": "http"
    },
    {
      "id": "onboarding-events",
      "source": "onboarding",
      "target": "eventbus",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "domain events",
      "sourceHandle": "events"
    },
    {
      "id": "onboarding-account",
      "source": "onboarding",
      "target": "account",
      "type": "default",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "sync",
      "sourceHandle": "sync"
    },
    {
      "id": "onboarding-doc",
      "source": "onboarding",
      "target": "document",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "documents"
    },
    {
      "id": "account-event",
      "source": "account",
      "target": "eventbus",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "account.updated"
    },
    {
      "id": "document-event",
      "source": "document",
      "target": "eventbus",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "document.ready"
    },
    {
      "id": "event-worker-a",
      "source": "eventbus",
      "target": "worker-a",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "eligibility requested"
    },
    {
      "id": "event-worker-b",
      "source": "eventbus",
      "target": "worker-b",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "provision requested"
    },
    {
      "id": "event-saga",
      "source": "eventbus",
      "target": "saga",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "state changes"
    },
    {
      "id": "command-worker",
      "source": "commandbus",
      "target": "worker-b",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "ordered commands"
    },
    {
      "id": "worker-state",
      "source": "worker-b",
      "target": "state-db",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "transaction"
    },
    {
      "id": "worker-event",
      "source": "worker-b",
      "target": "eventbus",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "provisioned"
    },
    {
      "id": "saga-command",
      "source": "saga",
      "target": "commandbus",
      "type": "temporary",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "retry/compensate"
    },
    {
      "id": "event-fraud",
      "source": "eventbus",
      "target": "fraud",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "score request"
    },
    {
      "id": "fraud-compliance",
      "source": "fraud",
      "target": "compliance",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "risk signals"
    },
    {
      "id": "compliance-event",
      "source": "compliance",
      "target": "eventbus",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "decision"
    },
    {
      "id": "event-lake",
      "source": "eventbus",
      "target": "lake",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "CDC"
    },
    {
      "id": "event-audit",
      "source": "eventbus",
      "target": "outbox",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "immutable audit"
    },
    {
      "id": "event-observe",
      "source": "eventbus",
      "target": "observability",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "metrics/traces"
    },
    {
      "id": "command-dlq",
      "source": "commandbus",
      "target": "dlq",
      "type": "temporary",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "exhausted retries"
    },
    {
      "id": "dlq-ops",
      "source": "dlq",
      "target": "ops",
      "type": "button",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "manual action"
    },
    {
      "id": "observe-slo",
      "source": "observability",
      "target": "slo",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "availability"
    },
    {
      "id": "observe-latency",
      "source": "observability",
      "target": "latency",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "latency"
    },
    {
      "id": "state-ops",
      "source": "state-db",
      "target": "ops",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "case state"
    }
  ]
}
```
