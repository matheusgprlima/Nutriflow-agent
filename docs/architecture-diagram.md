# NutriFlow Agent - Architecture Diagram

Use this file as the source for Devpost architecture upload.

```mermaid
flowchart LR
    U[User]

    subgraph FE[Frontend - React + Vite]
      IN[Intake Page]
      RES[Results Page]
      PDF[PDF Export]
    end

    subgraph BE[Backend - Node.js + TypeScript<br/>Google Cloud Run (Stateless)]
      WS[WebSocket API (/ws)]
      EX[Diet Extraction Service]
      GEN[Adjusted Plan Generation Service]
    end

    G[Gemini via Google GenAI SDK]

    U -->|Upload baseline diet<br/>(image/PDF)| IN
    U -->|Enter daily context text| IN
    U -->|Optional smartwatch/<br/>health screenshots| IN

    IN <-->|WebSocket messages| WS
    WS --> EX
    WS --> GEN

    EX -->|Structured baseline diet| G
    GEN -->|Diet + text context +<br/>optional screenshots| G
    G -->|Extracted baseline + adjusted plan| WS

    WS --> RES
    RES -->|Baseline summary + analytics +<br/>adjusted daily plan| U
    RES --> PDF
    PDF -->|Downloadable report| U
```

Notes:
- Current architecture is intentionally simple and stateless.
- No database, no auth, no queues, no microservices.
