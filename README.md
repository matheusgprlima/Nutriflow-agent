# NutriFlow

Multimodal diet adjuster: upload your current diet (image/PDF), add routine context (text or audio), get an adjusted plan—same foods, quantities tuned to your life. No database, no persistence, realtime over WebSocket.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + Tailwind 4
- **Backend**: Node.js + Express (HTTP server) + WebSocket on `/ws`
- **No database**: Ephemeral in-memory session per WebSocket connection
- **AI**: Google Gemini (`@google/genai`) for diet extraction and adjusted-diet generation

## Product flow

1. **Home** — Explain product, CTA to upload diet
2. **Upload** — Single file (image or PDF) → sent over WebSocket as base64 → Gemini extracts diet → redirect to Dashboard
3. **Dashboard** — View extracted meals; optional transcript for routine (when you eat more/less, train, rest, stress/schedule); CTA “Generate adjusted diet”
4. **Adjusted diet** — Same foods, adjusted quantities + short notes; “Start over” back to Upload

## WebSocket protocol

- **Client → Server**: `diet_upload` (base64 + mimeType), `transcript` (text), `generate_adjusted`
- **Server → Client**: `progress`, `extraction_result`, `extraction_error`, `adjusted_diet`, `adjusted_diet_error`, `error`

## Getting started

1. `cp .env.example .env` and set `GEMINI_API_KEY`
2. `npm install`
3. `npm run dev` → http://localhost:3000 (WS: ws://localhost:3000/ws)

## Project structure

- `src/` — Frontend
  - `pages/` — Home, Upload, Dashboard, AdjustedDiet
  - `context/SessionContext.tsx` — WebSocket + session state
  - `components/` — Layout, GlassCard, Button, etc.
  - `shared/schemas.ts` — Zod schemas + WebSocket message types
- `server.ts` — HTTP server + Vite middleware + WebSocket attach
- `server/ws.ts` — WebSocket handler (session, diet extraction, adjusted diet)
- `server/services/gemini.ts` — `extractDietFromBuffer`, `generateAdjustedDiet`

## Rules

- No new foods in the adjusted diet; only quantity/portion adjustments
- No medical or nutrition advice; no supplements or medication
- No persistence: no DB, no stored uploads, no user history
