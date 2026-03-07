import 'dotenv/config';
import { checkLegibility } from './server/services/gemini.js';
import fs from 'fs';
import path from 'path';

// Create a dummy image file for testing
const dummyImagePath = path.join(process.cwd(), 'test-image.txt');
fs.writeFileSync(dummyImagePath, 'dummy image content');

async function test() {
  try {
    // Testing direct model access...
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const modelsToTest = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"];
    
    for (const model of modelsToTest) {
        try {
            console.log(`Testing model: ${model}`);
            const response = await ai.models.generateContent({
                model: model,
                contents: "Hello",
            });
            console.log(`Success with ${model}:`, response.text);
            break; // Stop on first success
        } catch (e: any) {
            console.error(`Failed with ${model}:`, e.message);
        }
    }
  } catch (error: any) {
    console.error("Test Failed:", error.message);
    if (error.response) {
        console.error("Response Details:", JSON.stringify(error.response, null, 2));
    }
  } finally {
    fs.unlinkSync(dummyImagePath);
  }
}

test();
