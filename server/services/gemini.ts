import { GoogleGenAI, Type } from "@google/genai";
import { logError } from "./logger.js";

const VISION_MODEL = "gemini-2.5-flash";

let ai: GoogleGenAI | null = null;

const getAi = (): GoogleGenAI | null => {
  if (!ai) {
    const key = (process.env.GEMINI_API_KEY || process.env.API_KEY)?.trim();
    if (!key) {
      console.warn("GEMINI_API_KEY (or API_KEY) is not set.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
};

const getModels = () => {
  const client = getAi();
  if (!client) throw new Error("GEMINI_API_KEY is not configured.");
  return client.models;
};

const DIET_EXTRACTION_PROMPT = `You are a precision diet-plan OCR and nutrition estimation system.

TASK: Extract every meal and food item from the provided image or document, and estimate macronutrients.

EXTRACTION RULES:
1. Extract ALL meals — breakfast, mid-morning snack, lunch, afternoon snack, dinner, supper, pre-workout, post-workout, etc. Use the exact meal names from the document.
2. For each item: exact food name, quantity, and unit (g | ml | serving | unit).
3. If a range is given (e.g. "100-150g"), set minQuantity and maxQuantity and use the midpoint for baseQuantity.
4. If the document shows day-type variants (e.g. "cardio day" vs "rest day" or "Dia A / Dia B"), list them as separate meals prefixed with the variant name (e.g. "Dia A — Breakfast").
5. If the document shows "OR" substitution options within a meal, pick the first option as the item and add the alternative in a parenthetical note in the foodName.
6. Preserve the document's language for food names — do NOT translate.
7. Do NOT invent foods that are not in the document.

MACRO ESTIMATION:
8. For each food item, estimate macronutrients using common nutritional databases: estimatedCalories (kcal), estimatedProteinG, estimatedCarbsG, estimatedFatG. Base estimates on the extracted baseQuantity and unit.
9. If a food is ambiguous (e.g. generic "meat"), use a reasonable default.

CONFIDENCE:
10. Set confidence 0-1 for overall extraction quality. Set requiresUserConfirmation=true if anything is ambiguous or partially legible.
11. Return extractionWarnings for items that were hard to read or where macro estimates are very uncertain.`;

const ADJUSTED_DIET_PROMPT = `You are a daily diet planning adjuster. You do NOT give medical or nutritional advice. You do NOT recommend supplements or medication.

TASK: Adjust a diet's daily quantities to better fit the user's routine and activity level. This is DAILY PLANNING — you are not replacing the diet, only tuning portions for the day.

INPUTS:
1. Current extracted diet (meals with items, quantities, and estimated macros).
2. User's transcript describing routine, schedule, training, stress, energy levels.
3. (Optional) Health/activity screenshots from a smartwatch or health app — if present, use visible data (steps, calories burned, active minutes, heart rate, sleep) to inform adjustments.

CONSTRAINTS:
- Keep the EXACT same foods and meal structure. Do NOT add or remove foods.
- Only change quantities (up or down) based on routine and activity context.
- Each adjusted item MUST include previousQuantity (original baseQuantity) and quantity (adjusted).
- Each adjusted item MUST include estimated macros (estimatedCalories, estimatedProteinG, estimatedCarbsG, estimatedFatG) for the ADJUSTED quantity.
- If no change is needed for an item, keep quantity === previousQuantity but still include it with macros.
- Include concise neutral notes explaining major adjustments.
- Surface uncertainty — if the transcript is vague or health data is unclear, note it instead of guessing.

OUTPUT: { meals: [...], notes: [...] }`;

function parseJsonResponse(response: any, context: string): any {
  try {
    let text = "";
    if (response?.response) {
      if (typeof response.response.text === "function") text = response.response.text();
      else if (Array.isArray(response.response.candidates)) {
        const parts = response.response.candidates[0]?.content?.parts || [];
        text = parts.map((p: any) => p.text ?? "").join("");
      }
    }
    if (!text && typeof response?.text === "string") text = response.text;
    if (!text) {
      logError(`gemini:${context}`, new Error("Empty response from model"));
      return {};
    }
    return JSON.parse(text);
  } catch (err) {
    logError(`gemini:parse:${context}`, err instanceof Error ? err : new Error(String(err)));
    return {};
  }
}

const macroProps = {
  estimatedCalories: { type: Type.NUMBER },
  estimatedProteinG: { type: Type.NUMBER },
  estimatedCarbsG: { type: Type.NUMBER },
  estimatedFatG: { type: Type.NUMBER },
};

export async function extractDietFromBuffer(base64: string, mimeType: string) {
  const response = await getModels().generateContent({
    model: VISION_MODEL,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: DIET_EXTRACTION_PROMPT },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      foodName: { type: Type.STRING },
                      unit: { type: Type.STRING, enum: ["g", "ml", "serving", "unit"] },
                      baseQuantity: { type: Type.NUMBER },
                      minQuantity: { type: Type.NUMBER },
                      maxQuantity: { type: Type.NUMBER },
                      ...macroProps,
                    },
                    required: ["foodName", "unit", "baseQuantity"],
                  },
                },
              },
              required: ["name", "items"],
            },
          },
          confidence: { type: Type.NUMBER },
          requiresUserConfirmation: { type: Type.BOOLEAN },
          extractionWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["meals", "confidence", "requiresUserConfirmation", "extractionWarnings"],
      },
    },
  });

  return parseJsonResponse(response, "extractDiet");
}

export async function generateAdjustedDiet(
  extractedDiet: any,
  transcript: string,
  healthImages?: Array<{ base64: string; mimeType: string }>,
) {
  const dietCompact = JSON.stringify(extractedDiet);
  const textContent = `Current diet (JSON):\n${dietCompact}\n\nUser routine / context:\n${transcript}\n\n${ADJUSTED_DIET_PROMPT}`;

  const parts: any[] = [];
  if (healthImages?.length) {
    for (const img of healthImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }
  parts.push({ text: textContent });

  const response = await getModels().generateContent({
    model: VISION_MODEL,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      foodName: { type: Type.STRING },
                      unit: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      previousQuantity: { type: Type.NUMBER },
                      note: { type: Type.STRING },
                      ...macroProps,
                    },
                    required: ["foodName", "unit", "quantity", "previousQuantity"],
                  },
                },
              },
              required: ["name", "items"],
            },
          },
          notes: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["meals", "notes"],
      },
    },
  });

  return parseJsonResponse(response, "generateAdjustedDiet");
}
