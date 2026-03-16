import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const modelsToTest = ["gemini-2.5-flash"];

    for (const model of modelsToTest) {
      try {
        console.log(`Testing model: ${model}`);
        const response = await ai.models.generateContent({ model, contents: "Hello" });
        console.log(`Success with ${model}:`, response.text);
        break;
      } catch (e: any) {
        console.error(`Failed with ${model}:`, e.message);
      }
    }
  } catch (error: any) {
    console.error("Test Failed:", error.message);
  }
}

test();
