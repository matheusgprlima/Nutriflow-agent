/**
 * Verifies Gemini API key and model with a simple generateContent("Hello") call.
 * Run: npx tsx scripts/test-ai.ts
 */
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

async function main() {
  const key = (process.env.GEMINI_API_KEY || process.env.API_KEY)?.trim();
  if (!key) {
    console.error("Missing GEMINI_API_KEY (or API_KEY). Add it to .env and try again.");
    process.exit(1);
  }
  if (!key.startsWith("AIza")) {
    console.warn("Key does not start with 'AIza' — ensure it's an API Key from Google AI Studio, not a Vertex/service account token.");
  }

  console.log(`Using model: ${GEMINI_MODEL}`);
  const ai = new GoogleGenAI({ apiKey: key });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: "Reply with exactly: Hello",
    });
    const text = response.text?.trim() ?? "(empty)";
    console.log("Response:", text);
    console.log("OK — Gemini integration is working.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gemini request failed:", message);
    if (typeof (err as { status?: number }).status === "number") {
      console.error("Status:", (err as { status: number }).status);
    }
    process.exit(1);
  }
}

main();
