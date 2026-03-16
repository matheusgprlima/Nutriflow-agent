# NutriFlow Live

**Real-time multimodal daily diet planning agent** powered by Gemini Live API.

Upload your current diet plan → speak to the AI agent about your routine → get an adjusted daily plan with the same foods, portions tuned for your day.

## Architecture

```
Browser (React + Vite)
  │
  │  WebSocket (/ws)
  ▼
Node.js + Express (server.ts)
  │
  ├── Diet extraction ──────► Gemini 2.5 Flash (structured JSON)
  │
  ├── Live voice session ───► Gemini Live API (bidirectional audio + tool calling)
  │     │
  │     └── Tool: generate_adjusted_plan
  │           └── Gemini 2.5 Flash (structured JSON)
  │
  └── Health screenshots ───► Passed as multimodal context to Gemini
```

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express + WebSocket (`ws` library)
- **AI**: Google Gemini via `@google/genai` SDK
  - Diet extraction: `gemini-2.5-flash` (multimodal, structured output)
  - Live agent: Gemini Live API (`gemini-2.5-flash-preview-native-audio-dialog`)
  - Adjusted plan: `gemini-2.5-flash` (structured output, tool-called from live session)
- **No database**: Ephemeral in-memory session per WebSocket connection
- **Deployment**: Docker → Google Cloud Run

## Product flow

1. **Home** — Explains the product, drives user to start
2. **Intake** — Unified page:
   - Upload baseline diet (image/PDF) → Gemini extracts meals + macros
   - Optionally add Apple Watch / smartwatch screenshots
   - **Start live voice conversation** with the NutriFlow agent
   - Agent asks about routine, training, eating patterns
   - Agent calls `generate_adjusted_plan` tool when ready
   - (Fallback: type routine context + click Generate)
3. **Results** — Analytics dashboard + adjusted daily plan + PDF export

## Multimodal capabilities

| Modality | Input | Processing |
|----------|-------|------------|
| Image | Diet photo, health screenshots | Gemini multimodal extraction |
| PDF | Diet document | Gemini document understanding |
| Audio | Live voice conversation | Gemini Live API (bidirectional) |
| Text | Typed routine context | Gemini text understanding |

## Google technologies used

| Technology | Role |
|-----------|------|
| Gemini 2.5 Flash | Diet extraction, adjusted plan generation |
| Gemini Live API | Real-time voice agent conversation |
| Google GenAI SDK (`@google/genai`) | All Gemini API interactions |
| Google Cloud Run | Deployment target |

## WebSocket protocol

### Existing flow (diet extraction + text generation)
- **Client → Server**: `diet_upload`, `transcript`, `health_upload`, `clear_health`, `generate_adjusted`
- **Server → Client**: `progress`, `extraction_result`, `extraction_error`, `health_uploaded`, `health_cleared`, `adjusted_diet`, `adjusted_diet_error`, `error`

### Live agent flow
- **Client → Server**: `start_live`, `audio_chunk`, `live_text`, `end_live`
- **Server → Client**: `live_ready`, `live_audio`, `live_input_transcript`, `live_output_transcript`, `live_interrupted`, `live_error`, `live_ended`
- **Tool calling**: Agent calls `generate_adjusted_plan` → server executes → sends `adjusted_diet` to client

## Getting started

```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm install
npm run dev
# Open http://localhost:3000
```

## Deployment (Cloud Run)

```bash
# Build and deploy
gcloud run deploy nutriflow-live \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key-here \
  --port 8080
```

## AI constraints

- No new foods in the adjusted diet — only quantity/portion adjustments
- No medical or nutrition advice
- No supplements or medication recommendations
- Uncertainty is surfaced, not hidden
- Original diet is preserved as the baseline

## Project structure

```
src/                  Frontend (React)
  pages/              Home, IntakePage, ResultsPage
  context/            SessionContext (WS + state)
  components/         Layout, GlassCard, Button, MacroDisplay
  shared/schemas.ts   Zod schemas + WS message types
server.ts             HTTP server + Vite + WS
server/ws.ts          WebSocket handler (session, live relay)
server/services/
  gemini.ts           Diet extraction + adjusted plan generation
  gemini-live.ts      Gemini Live API relay + tool calling
  logger.ts           Error logging
Dockerfile            Cloud Run deployment
```
