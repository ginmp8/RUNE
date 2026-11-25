---
title: Fraud Decision Orchestration
version: "0.18.0"
reference: markdown-pdf-studio-1.8.7
---
# Fraud Decision Orchestration

Decision orchestration with services, queues, risk stages, and review paths.

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
  "id": "fraud-decision-orchestration",
  "title": "Fraud Decision Orchestration",
  "description": "Parallel signals, multi-handle decisions, manual review and feedback loops.",
  "nodes": [
    {
      "id": "request",
      "type": "input",
      "position": {
        "x": 0,
        "y": 280
      },
      "data": {
        "label": "Transaction Request",
        "channel": "payments"
      }
    },
    {
      "id": "normalize",
      "type": "service",
      "position": {
        "x": 260,
        "y": 280
      },
      "data": {
        "label": "Normalize & Enrich",
        "technology": ".NET"
      }
    },
    {
      "id": "fanout",
      "type": "decision",
      "position": {
        "x": 540,
        "y": 280
      },
      "data": {
        "label": "Parallel Risk Fan-out",
        "result": "aggregate"
      },
      "handles": [
        {
          "id": "in",
          "type": "target",
          "position": "left"
        },
        {
          "id": "identity",
          "type": "source",
          "position": "top"
        },
        {
          "id": "device",
          "type": "source",
          "position": "right"
        },
        {
          "id": "velocity",
          "type": "source",
          "position": "bottom"
        },
        {
          "id": "ml",
          "type": "source",
          "position": "right"
        }
      ]
    },
    {
      "id": "identity-risk",
      "type": "risk",
      "position": {
        "x": 820,
        "y": 40
      },
      "data": {
        "label": "Identity Risk",
        "severity": "medium"
      }
    },
    {
      "id": "device-risk",
      "type": "risk",
      "position": {
        "x": 820,
        "y": 190
      },
      "data": {
        "label": "Device Fingerprint",
        "severity": "high"
      }
    },
    {
      "id": "velocity-risk",
      "type": "risk",
      "position": {
        "x": 820,
        "y": 340
      },
      "data": {
        "label": "Velocity Rules",
        "severity": "medium"
      }
    },
    {
      "id": "ml-score",
      "type": "metric",
      "position": {
        "x": 820,
        "y": 500
      },
      "data": {
        "label": "ML Fraud Score",
        "value": "0.83",
        "status": "high"
      }
    },
    {
      "id": "aggregate",
      "type": "service",
      "position": {
        "x": 1130,
        "y": 270
      },
      "data": {
        "label": "Decision Aggregator",
        "technology": "weighted policy"
      }
    },
    {
      "id": "decision",
      "type": "decision",
      "position": {
        "x": 1430,
        "y": 270
      },
      "data": {
        "label": "Final Decision",
        "result": "approve/review/deny"
      },
      "handles": [
        {
          "id": "in",
          "type": "target",
          "position": "left"
        },
        {
          "id": "approve",
          "type": "source",
          "position": "top"
        },
        {
          "id": "review",
          "type": "source",
          "position": "right"
        },
        {
          "id": "deny",
          "type": "source",
          "position": "bottom"
        }
      ]
    },
    {
      "id": "approve",
      "type": "output",
      "position": {
        "x": 1720,
        "y": 40
      },
      "data": {
        "label": "Approved"
      }
    },
    {
      "id": "manual",
      "type": "form",
      "position": {
        "x": 1720,
        "y": 230
      },
      "data": {
        "label": "Manual Review",
        "fields": [
          {
            "name": "reason",
            "label": "Reason",
            "type": "select"
          },
          {
            "name": "evidence",
            "label": "Evidence",
            "type": "file"
          },
          {
            "name": "decision",
            "label": "Decision",
            "type": "buttons"
          }
        ]
      }
    },
    {
      "id": "deny",
      "type": "output",
      "position": {
        "x": 1720,
        "y": 500
      },
      "data": {
        "label": "Denied"
      }
    },
    {
      "id": "analyst",
      "type": "service",
      "position": {
        "x": 2030,
        "y": 230
      },
      "data": {
        "label": "Analyst Workbench",
        "technology": "case management"
      }
    },
    {
      "id": "feedback",
      "type": "queue",
      "position": {
        "x": 2030,
        "y": 430
      },
      "data": {
        "label": "Feedback Stream",
        "technology": "Kafka",
        "topic": "fraud.feedback"
      }
    },
    {
      "id": "feature-store",
      "type": "database",
      "position": {
        "x": 1120,
        "y": 520
      },
      "data": {
        "label": "Online Feature Store",
        "technology": "Redis"
      }
    },
    {
      "id": "rules",
      "type": "database",
      "position": {
        "x": 1120,
        "y": 40
      },
      "data": {
        "label": "Policy Repository",
        "technology": "versioned rules"
      }
    },
    {
      "id": "audit",
      "type": "database",
      "position": {
        "x": 2300,
        "y": 230
      },
      "data": {
        "label": "Decision Audit",
        "technology": "append-only"
      }
    },
    {
      "id": "latency-metric",
      "type": "metric",
      "position": {
        "x": 2300,
        "y": 430
      },
      "data": {
        "label": "P99 decision latency",
        "value": "186 ms",
        "status": "healthy"
      }
    }
  ],
  "edges": [
    {
      "id": "request-normalize",
      "source": "request",
      "target": "normalize",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "request"
    },
    {
      "id": "normalize-fanout",
      "source": "normalize",
      "target": "fanout",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "enriched context",
      "targetHandle": "in"
    },
    {
      "id": "fanout-identity",
      "source": "fanout",
      "target": "identity-risk",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "identity",
      "sourceHandle": "identity"
    },
    {
      "id": "fanout-device",
      "source": "fanout",
      "target": "device-risk",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "device",
      "sourceHandle": "device"
    },
    {
      "id": "fanout-velocity",
      "source": "fanout",
      "target": "velocity-risk",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "velocity",
      "sourceHandle": "velocity"
    },
    {
      "id": "fanout-ml",
      "source": "fanout",
      "target": "ml-score",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "features",
      "sourceHandle": "ml"
    },
    {
      "id": "identity-aggregate",
      "source": "identity-risk",
      "target": "aggregate",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "risk vector"
    },
    {
      "id": "device-aggregate",
      "source": "device-risk",
      "target": "aggregate",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "risk vector"
    },
    {
      "id": "velocity-aggregate",
      "source": "velocity-risk",
      "target": "aggregate",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "risk vector"
    },
    {
      "id": "ml-aggregate",
      "source": "ml-score",
      "target": "aggregate",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "probability"
    },
    {
      "id": "feature-identity",
      "source": "feature-store",
      "target": "identity-risk",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "features"
    },
    {
      "id": "feature-device",
      "source": "feature-store",
      "target": "device-risk",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "features"
    },
    {
      "id": "feature-velocity",
      "source": "feature-store",
      "target": "velocity-risk",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "features"
    },
    {
      "id": "feature-ml",
      "source": "feature-store",
      "target": "ml-score",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "features"
    },
    {
      "id": "rules-aggregate",
      "source": "rules",
      "target": "aggregate",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "policy version"
    },
    {
      "id": "aggregate-decision",
      "source": "aggregate",
      "target": "decision",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "score + reasons",
      "targetHandle": "in"
    },
    {
      "id": "decision-approve",
      "source": "decision",
      "target": "approve",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "approve",
      "sourceHandle": "approve"
    },
    {
      "id": "decision-review",
      "source": "decision",
      "target": "manual",
      "type": "button",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "review",
      "sourceHandle": "review"
    },
    {
      "id": "decision-deny",
      "source": "decision",
      "target": "deny",
      "type": "temporary",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "deny",
      "sourceHandle": "deny"
    },
    {
      "id": "manual-analyst",
      "source": "manual",
      "target": "analyst",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "case assignment"
    },
    {
      "id": "analyst-feedback",
      "source": "analyst",
      "target": "feedback",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "labeled outcome"
    },
    {
      "id": "feedback-feature",
      "source": "feedback",
      "target": "feature-store",
      "type": "status",
      "animated": true,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "online updates"
    },
    {
      "id": "decision-audit",
      "source": "decision",
      "target": "audit",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "decision envelope"
    },
    {
      "id": "manual-audit",
      "source": "manual",
      "target": "audit",
      "type": "status",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "human rationale"
    },
    {
      "id": "aggregate-latency",
      "source": "aggregate",
      "target": "latency-metric",
      "type": "smoothstep",
      "animated": false,
      "markerEnd": {
        "type": "arrowclosed"
      },
      "label": "telemetry"
    }
  ]
}
```
