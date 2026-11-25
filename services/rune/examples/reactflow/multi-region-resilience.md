---
title: Multi-Region Resilience
version: "0.18.0"
reference: markdown-pdf-studio-1.8.7
---
# Multi-Region Resilience

Multi-region resilience topology with failover, replication, and operational paths.

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
  "id": "multi-region-resilience",
  "title": "Multi-region Resilience and Failover",
  "description": "Primary/recovery regions, cross-region replication, operational runbook and RTO/RPO evidence.",
  "nodes": [
    {
      "id": "global",
      "type": "group",
      "position": {
        "x": 0,
        "y": 0
      },
      "initialWidth": 520,
      "initialHeight": 720,
      "data": {
        "label": "Global Control Plane"
      }
    },
    {
      "id": "sa",
      "type": "group",
      "position": {
        "x": 650,
        "y": 0
      },
      "initialWidth": 820,
      "initialHeight": 720,
      "data": {
        "label": "sa-east-1 Primary"
      }
    },
    {
      "id": "us",
      "type": "group",
      "position": {
        "x": 1600,
        "y": 0
      },
      "initialWidth": 820,
      "initialHeight": 720,
      "data": {
        "label": "us-east-1 Recovery"
      }
    },
    {
      "id": "ops-group",
      "type": "group",
      "position": {
        "x": 2550,
        "y": 0
      },
      "initialWidth": 700,
      "initialHeight": 720,
      "data": {
        "label": "Operations & Governance"
      }
    },
    {
      "id": "dns",
      "type": "service",
      "position": {
        "x": 60,
        "y": 80
      },
      "data": {
        "label": "Global Traffic Manager",
        "technology": "Route 53"
      },
      "parentId": "global",
      "extent": "parent"
    },
    {
      "id": "health",
      "type": "metric",
      "position": {
        "x": 60,
        "y": 270
      },
      "data": {
        "label": "Regional Health",
        "value": "SA healthy",
        "status": "healthy"
      },
      "parentId": "global",
      "extent": "parent"
    },
    {
      "id": "config",
      "type": "database",
      "position": {
        "x": 60,
        "y": 460
      },
      "data": {
        "label": "Global Configuration",
        "technology": "AppConfig"
      },
      "parentId": "global",
      "extent": "parent"
    },
    {
      "id": "sa-gw",
      "type": "service",
      "position": {
        "x": 70,
        "y": 80
      },
      "data": {
        "label": "Primary Gateway",
        "technology": "YARP",
        "region": "sa-east-1"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-api",
      "type": "service",
      "position": {
        "x": 330,
        "y": 80
      },
      "data": {
        "label": "Primary API",
        "technology": ".NET 10",
        "region": "sa-east-1"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-kafka",
      "type": "queue",
      "position": {
        "x": 590,
        "y": 80
      },
      "data": {
        "label": "Primary Event Bus",
        "technology": "MSK"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-worker",
      "type": "service",
      "position": {
        "x": 70,
        "y": 330
      },
      "data": {
        "label": "Primary Workers",
        "technology": "EKS + KEDA"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-db",
      "type": "database",
      "position": {
        "x": 330,
        "y": 330
      },
      "data": {
        "label": "Primary Database",
        "technology": "Aurora PostgreSQL"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-cache",
      "type": "database",
      "position": {
        "x": 590,
        "y": 330
      },
      "data": {
        "label": "Primary Cache",
        "technology": "Valkey"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "sa-outbox",
      "type": "queue",
      "position": {
        "x": 330,
        "y": 550
      },
      "data": {
        "label": "Replication Outbox",
        "technology": "Kafka"
      },
      "parentId": "sa",
      "extent": "parent"
    },
    {
      "id": "us-gw",
      "type": "service",
      "position": {
        "x": 70,
        "y": 80
      },
      "data": {
        "label": "Recovery Gateway",
        "technology": "YARP",
        "region": "us-east-1"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-api",
      "type": "service",
      "position": {
        "x": 330,
        "y": 80
      },
      "data": {
        "label": "Recovery API",
        "technology": ".NET 10",
        "region": "us-east-1"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-kafka",
      "type": "queue",
      "position": {
        "x": 590,
        "y": 80
      },
      "data": {
        "label": "Recovery Event Bus",
        "technology": "MSK"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-worker",
      "type": "service",
      "position": {
        "x": 70,
        "y": 330
      },
      "data": {
        "label": "Recovery Workers",
        "technology": "EKS + KEDA"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-db",
      "type": "database",
      "position": {
        "x": 330,
        "y": 330
      },
      "data": {
        "label": "Recovery Database",
        "technology": "Aurora Global DB"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-cache",
      "type": "database",
      "position": {
        "x": 590,
        "y": 330
      },
      "data": {
        "label": "Recovery Cache",
        "technology": "Valkey"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "us-inbox",
      "type": "queue",
      "position": {
        "x": 330,
        "y": 550
      },
      "data": {
        "label": "Replication Inbox",
        "technology": "Kafka"
      },
      "parentId": "us",
      "extent": "parent"
    },
    {
      "id": "incident",
      "type": "risk",
      "position": {
        "x": 70,
        "y": 80
      },
      "data": {
        "label": "Incident Commander",
        "severity": "critical"
      },
      "parentId": "ops-group",
      "extent": "parent"
    },
    {
      "id": "runbook",
      "type": "form",
      "position": {
        "x": 340,
        "y": 80
      },
      "data": {
        "label": "Failover Runbook",
        "fields": [
          {
            "name": "freeze",
            "label": "Freeze writes",
            "type": "check"
          },
          {
            "name": "promote",
            "label": "Promote region",
            "type": "check"
          },
          {
            "name": "verify",
            "label": "Verify SLO",
            "type": "check"
          }
        ]
      },
      "parentId": "ops-group",
      "extent": "parent"
    },
    {
      "id": "telemetry",
      "type": "service",
      "position": {
        "x": 70,
        "y": 330
      },
      "data": {
        "label": "Cross-region Telemetry",
        "technology": "OTLP"
      },
      "parentId": "ops-group",
      "extent": "parent"
    },
    {
      "id": "rto",
      "type": "metric",
      "position": {
        "x": 340,
        "y": 330
      },
      "data": {
        "label": "Recovery Time Objective",
        "value": "< 15 min",
        "status": "tracked"
      },
      "parentId": "ops-group",
      "extent": "parent"
    },
    {
      "id": "rpo",
      "type": "metric",
      "position": {
        "x": 70,
        "y": 540
      },
      "data": {
        "label": "Recovery Point Objective",
        "value": "< 60 sec",
        "status": "tracked"
      },
      "parentId": "ops-group",
      "extent": "parent"
    },
    {
      "id": "audit-dr",
      "type": "database",
      "position": {
        "x": 340,
        "y": 540
      },
      "data": {
        "label": "DR Audit Trail",
        "technology": "immutable"
      },
      "parentId": "ops-group",
      "extent": "parent"
    }
  ],
  "edges": [
    {
      "id": "dns-sa",
      "source": "dns",
      "target": "sa-gw",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "active traffic"
    },
    {
      "id": "dns-us",
      "source": "dns",
      "target": "us-gw",
      "type": "temporary",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "standby traffic"
    },
    {
      "id": "health-dns",
      "source": "health",
      "target": "dns",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "health policy"
    },
    {
      "id": "config-sa",
      "source": "config",
      "target": "sa-api",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "config"
    },
    {
      "id": "config-us",
      "source": "config",
      "target": "us-api",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "config"
    },
    {
      "id": "sa-gw-api",
      "source": "sa-gw",
      "target": "sa-api",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "HTTP"
    },
    {
      "id": "sa-api-kafka",
      "source": "sa-api",
      "target": "sa-kafka",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "events"
    },
    {
      "id": "sa-kafka-worker",
      "source": "sa-kafka",
      "target": "sa-worker",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "consume"
    },
    {
      "id": "sa-api-db",
      "source": "sa-api",
      "target": "sa-db",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "transactions"
    },
    {
      "id": "sa-api-cache",
      "source": "sa-api",
      "target": "sa-cache",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "cache"
    },
    {
      "id": "sa-db-outbox",
      "source": "sa-db",
      "target": "sa-outbox",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "CDC"
    },
    {
      "id": "us-gw-api",
      "source": "us-gw",
      "target": "us-api",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "HTTP"
    },
    {
      "id": "us-api-kafka",
      "source": "us-api",
      "target": "us-kafka",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "events"
    },
    {
      "id": "us-kafka-worker",
      "source": "us-kafka",
      "target": "us-worker",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "consume"
    },
    {
      "id": "us-api-db",
      "source": "us-api",
      "target": "us-db",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "transactions"
    },
    {
      "id": "us-api-cache",
      "source": "us-api",
      "target": "us-cache",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "cache"
    },
    {
      "id": "us-inbox-db",
      "source": "us-inbox",
      "target": "us-db",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "apply"
    },
    {
      "id": "replication",
      "source": "sa-outbox",
      "target": "us-inbox",
      "type": "bidirectional",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "cross-region replication"
    },
    {
      "id": "db-global",
      "source": "sa-db",
      "target": "us-db",
      "type": "bidirectional",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "Aurora replication"
    },
    {
      "id": "telemetry-sa",
      "source": "sa-api",
      "target": "telemetry",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "traces"
    },
    {
      "id": "telemetry-us",
      "source": "us-api",
      "target": "telemetry",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "traces"
    },
    {
      "id": "telemetry-health",
      "source": "telemetry",
      "target": "health",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "regional signals"
    },
    {
      "id": "health-incident",
      "source": "health",
      "target": "incident",
      "type": "temporary",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "SLO breach"
    },
    {
      "id": "incident-runbook",
      "source": "incident",
      "target": "runbook",
      "type": "button",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "activate"
    },
    {
      "id": "runbook-dns",
      "source": "runbook",
      "target": "dns",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "switch traffic"
    },
    {
      "id": "runbook-audit",
      "source": "runbook",
      "target": "audit-dr",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "evidence"
    },
    {
      "id": "telemetry-rto",
      "source": "telemetry",
      "target": "rto",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "measure"
    },
    {
      "id": "replication-rpo",
      "source": "sa-outbox",
      "target": "rpo",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "lag"
    }
  ]
}
```
