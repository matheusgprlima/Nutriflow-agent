# DietCoach Navigator

AI Diet Execution Coach that adjusts food quantities based on daily metrics without introducing new foods.

## Architecture

- **Frontend**: React + Vite (simulating Next.js App Router structure)
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (via `better-sqlite3`) mocking Firestore
- **Storage**: Local filesystem mocking Cloud Storage
- **AI**: Google Gemini via `@google/genai` SDK

## Features

1.  **Upload**: Upload screenshots of Diet Plans and Health Metrics.
2.  **Extraction**: Gemini extracts structured data from images.
3.  **Review**: View extracted data.
4.  **Plan**: Generate tomorrow's diet plan with adjusted quantities.
5.  **Navigator**: Generate UI actions to input the plan into tracking apps.

## Getting Started

1.  Install dependencies: `npm install`
2.  Start the development server: `npm run dev` (or `npm start` in production)
3.  Open http://localhost:3000

## Project Structure

- `/src`: Frontend code
  - `/pages`: Application pages
  - `/components`: Reusable UI components
  - `/shared`: Shared Zod schemas
- `/server`: Backend code
  - `/services`: Business logic (Gemini, DB, Storage)
  - `/routes`: API endpoints
- `/uploads`: Local storage for uploaded files

## Critical Rules

1.  **No New Foods**: The AI never introduces foods not present in the original plan.
2.  **Timezone Awareness**: All dates are handled using Luxon and user timezone.
3.  **Validation**: All data is validated using Zod schemas.
