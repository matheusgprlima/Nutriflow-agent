import { GoogleGenAI, Type } from "@google/genai";
import { 
  DietTemplateSchema, 
  DailyMetricsSchema, 
  BioImpedanceSchema, 
  TomorrowPlanSchema, 
  UiActionsSchema 
} from "../../src/shared/schemas.js"; // Note: .js extension for ESM in Node
import { z } from "zod";

// Lazy initialization to ensure environment variables are loaded
let ai: GoogleGenAI | null = null;

const getAi = () => {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key) {
      console.error("CRITICAL: GEMINI_API_KEY (or API_KEY) is missing in environment variables.");
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    console.log(`Gemini Service initialized lazily with key: '${key.substring(0, 5)}...${key.substring(key.length - 5)}' (Length: ${key.length})`);
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
};

// Helper to get model
const getModel = (modelName: string = "gemini-flash-lite-latest") => {
  return getAi().models;
};

// --- Prompts ---

const DIET_EXTRACTION_PROMPT = `
Extract the diet plan from the provided image.
CRITICAL RULES:
1. Identify all meals and their items.
2. Extract quantities and units precisely (g, ml, units).
3. If a range is given (e.g., 100-150g), set min and max.
4. DO NOT hallucinate foods not present.
5. If the image is not a diet plan, return low confidence.
`;

const METRICS_EXTRACTION_PROMPT = `
Extract health metrics from the provided image (Apple Watch, Health app, etc.).
CRITICAL RULES:
1. Extract steps, calories, sleep, heart rate.
2. Identify the date if visible.
3. If multiple days are shown, extract the MOST RECENT completed day.
4. DO NOT hallucinate values.
`;

const BIOIMPEDANCE_EXTRACTION_PROMPT = `
Extract bioimpedance data from the report.
CRITICAL RULES:
1. Extract weight, body fat %, lean mass.
2. Identify the date of the scan.
`;

const PLAN_GENERATION_PROMPT = `
You are a Diet Execution Coach.
Your goal is to adjust TOMORROW's diet quantities based on TODAY's metrics and the original plan.

INPUTS:
- Original Diet Plan (Allowed foods)
- Daily Metrics (Activity, Sleep, etc.)
- Goal (Deficit/Surplus)

CRITICAL HARD RULES:
1. NEVER suggest new foods. ONLY adjust quantities of existing items.
2. If activity was HIGH, you may slightly increase carbs/protein if goal permits.
3. If sleep was POOR, suggest maintenance or slight reduction to avoid stress.
4. Respect the goal (Deficit = strict, Surplus = generous).
5. Output the plan for TOMORROW.
6. Use the user's timezone for date calculation.

OUTPUT:
- A structured JSON plan for tomorrow.
- A summary of changes.
- Warnings if metrics are concerning (e.g., very low sleep).
`;

const NAVIGATOR_ACTIONS_PROMPT = `
Generate a list of UI actions to input this diet plan into a tracking app.
Assume a generic tracking app interface.
- "click" on meal add buttons.
- "type" food names and quantities.
- "submit" to save.
`;

const LEGIBILITY_CHECK_PROMPT = `
Analyze the provided images/documents for legibility for a diet and health tracking agent.
We need to extract:
1. Diet Plan: Meal names, food items, quantities.
2. Health Metrics: Steps, calories, sleep data.
3. Bioimpedance: Weight, body fat %.

OUTPUT JSON ONLY:
{
  "category": "diet" | "metrics" | "bioimpedance" | "training",
  "passed": boolean,
  "reason": "string explanation",
  "suggestions": ["string suggestion 1", "string suggestion 2"],
  "confidence": number (0-1)
}

Fail if:
- Text is too blurry to read numbers.
- Glare obscures critical data.
- The document is unrelated.
`;

// ... existing prompts ...

// --- Service Methods ---

export async function checkLegibility(imagePaths: string[], mimeType: string) {
  const fs = await import("fs");
  const parts: any[] = [];
  
  for (const path of imagePaths) {
    const fileData = fs.readFileSync(path).toString("base64");
    parts.push({ inlineData: { mimeType, data: fileData } });
  }
  parts.push({ text: LEGIBILITY_CHECK_PROMPT });

  const response = await getModel().generateContent({
    model: "gemini-flash-lite-latest",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function extractDiet(imagePaths: string | string[], mimeType: string) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const fs = await import("fs");
  
  const parts: any[] = [];
  for (const path of paths) {
    const fileData = fs.readFileSync(path).toString("base64");
    parts.push({ inlineData: { mimeType, data: fileData } });
  }
  parts.push({ text: DIET_EXTRACTION_PROMPT });

  const response = await getModel().generateContent({
    model: "gemini-flash-lite-latest",
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
                      unit: { type: Type.STRING, enum: ["g", "ml", "serving", "unit"] },
                      baseQuantity: { type: Type.NUMBER },
                      minQuantity: { type: Type.NUMBER },
                      maxQuantity: { type: Type.NUMBER }
                    },
                    required: ["foodName", "unit", "baseQuantity"]
                  }
                }
              },
              required: ["name", "items"]
            }
          },
          constraints: {
            type: Type.OBJECT,
            properties: { forbiddenNewFoods: { type: Type.BOOLEAN } },
            required: ["forbiddenNewFoods"]
          },
          confidence: { type: Type.NUMBER },
          requiresUserConfirmation: { type: Type.BOOLEAN },
          extractionWarnings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["meals", "confidence", "requiresUserConfirmation", "extractionWarnings"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function extractMetrics(imagePaths: string | string[], mimeType: string) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const fs = await import("fs");

  const parts: any[] = [];
  for (const path of paths) {
    const fileData = fs.readFileSync(path).toString("base64");
    parts.push({ inlineData: { mimeType, data: fileData } });
  }
  parts.push({ text: METRICS_EXTRACTION_PROMPT });

  const response = await getModel().generateContent({
    model: "gemini-flash-lite-latest",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      // We can use loose schema or strict. Let's use loose for now to avoid complexity in this snippet
      // but ideally we map to DailyMetricsSchema.
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generatePlan(
  diet: any,
  metrics: any,
  goal: any,
  userTimezone: string
) {
  const prompt = `
    User Timezone: ${userTimezone}
    Diet: ${JSON.stringify(diet)}
    Metrics: ${JSON.stringify(metrics)}
    Goal: ${JSON.stringify(goal)}
    
    ${PLAN_GENERATION_PROMPT}
  `;

  const response = await getModel().generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      // Schema matching TomorrowPlanSchema
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generateNavigatorActions(plan: any) {
  const prompt = `
    Plan: ${JSON.stringify(plan)}
    ${NAVIGATOR_ACTIONS_PROMPT}
  `;

  const response = await getModel().generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || "{}");
}
