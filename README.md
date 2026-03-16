# NutriFlow Agent

Multimodal daily diet planning assistant built for hackathon speed and reliability.

Users upload a baseline diet (image or PDF), optionally add smartwatch/activity screenshots, provide daily context in text, and receive an adjusted daily plan that preserves the original diet structure.

## Architecture Diagram

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

This diagram reflects the current implementation: a single stateless backend service on Cloud Run, WebSocket communication, Gemini for extraction and generation, and no database/auth/queue/microservice layer.

For Devpost upload: use [docs/architecture-diagram.md](/home/matheus/Documentos/nutriflow/Nutriflow-agent/docs/architecture-diagram.md) (or export the Mermaid diagram from that file as an image).

## Product Flow

1. User opens the web app.
2. User uploads a baseline diet file (image/PDF).
3. User provides daily context in text.
4. User can optionally upload Apple Watch/smartwatch/health screenshots.
5. Frontend sends inputs to backend over WebSocket.
6. Backend calls Gemini to:
   - extract baseline diet into structured data
   - generate an adjusted daily plan based on baseline + text context + optional screenshots
7. Frontend shows:
   - baseline summary
   - adjusted daily plan
   - analytics/dashboard views
   - PDF export

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4
- Backend: Node.js + TypeScript + Express + `ws`
- AI: Gemini via `@google/genai` SDK
- Deployment: Google Cloud Run
- Architecture: Stateless, no database, no auth, no queues, no microservices

## WebSocket Protocol

- Client -> Server: `diet_upload`, `transcript`, `health_upload`, `clear_health`, `generate_adjusted`, `start_live`, `live_text`, `end_live`
- Server -> Client: `progress`, `extraction_result`, `extraction_error`, `health_uploaded`, `health_cleared`, `adjusted_diet`, `adjusted_diet_error`, `error`, `live_ready`, `live_input_transcript`, `live_output_transcript`, `live_turn_complete`, `live_error`, `live_ended`

## Getting Started

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm install
npm run dev
# Open http://localhost:3000
```

## Deployment (Cloud Run)

```bash
gcloud run deploy nutriflow-live \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key-here \
  --port 8080
```

## Project Structure

```text
src/                  Frontend (React)
  pages/              Home, IntakePage, ResultsPage
  context/            SessionContext (WS + state)
  components/         Layout, GlassCard, Button, MacroDisplay
  shared/schemas.ts   Zod schemas + WS message types
server.ts             HTTP server + Vite + WS
server/ws.ts          WebSocket handler (session + generation flow)
server/services/
  gemini.ts           Diet extraction + adjusted plan generation
  gemini-live.ts      Live session helper + tool-calling wiring
  logger.ts           Error logging
docs/
  architecture-diagram.md
Dockerfile            Cloud Run deployment
```
