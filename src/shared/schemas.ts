import { z } from 'zod';

// --- Extracted diet (from image/PDF) ---
export const DietItemSchema = z.object({
  foodName: z.string(),
  unit: z.enum(['g', 'ml', 'serving', 'unit']),
  baseQuantity: z.number(),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
  estimatedCalories: z.number().optional(),
  estimatedProteinG: z.number().optional(),
  estimatedCarbsG: z.number().optional(),
  estimatedFatG: z.number().optional(),
});

export const DietMealSchema = z.object({
  name: z.string(),
  items: z.array(DietItemSchema),
});

export const ExtractedDietSchema = z.object({
  meals: z.array(DietMealSchema),
  confidence: z.number(),
  requiresUserConfirmation: z.boolean().optional(),
  extractionWarnings: z.array(z.string()).optional(),
});

export type DietItem = z.infer<typeof DietItemSchema>;
export type DietMeal = z.infer<typeof DietMealSchema>;
export type ExtractedDiet = z.infer<typeof ExtractedDietSchema>;

// --- Routine context (from transcript / audio) ---
export const RoutineContextSchema = z.object({
  summary: z.string(),
  eatingLessWhen: z.array(z.string()).optional(),
  eatingMoreWhen: z.array(z.string()).optional(),
  trainingDays: z.array(z.string()).optional(),
  restDays: z.array(z.string()).optional(),
  stressEnergySchedule: z.array(z.string()).optional(),
});

export type RoutineContext = z.infer<typeof RoutineContextSchema>;

// --- Adjusted diet (output: same structure, adjusted quantities) ---
export const AdjustedDietItemSchema = z.object({
  foodName: z.string(),
  unit: z.string(),
  quantity: z.number(),
  previousQuantity: z.number(),
  note: z.string().optional(),
  estimatedCalories: z.number().optional(),
  estimatedProteinG: z.number().optional(),
  estimatedCarbsG: z.number().optional(),
  estimatedFatG: z.number().optional(),
});

export const AdjustedDietMealSchema = z.object({
  name: z.string(),
  items: z.array(AdjustedDietItemSchema),
});

export const AdjustedDietSchema = z.object({
  meals: z.array(AdjustedDietMealSchema),
  notes: z.array(z.string()),
});

export type AdjustedDietItem = z.infer<typeof AdjustedDietItemSchema>;
export type AdjustedDietMeal = z.infer<typeof AdjustedDietMealSchema>;
export type AdjustedDiet = z.infer<typeof AdjustedDietSchema>;

// --- Client session state (ephemeral, no persistence) ---
export type SessionStatus =
  | 'idle'
  | 'extracting'
  | 'ready'
  | 'listening'
  | 'generating'
  | 'done'
  | 'error'
  | 'live'
  | 'live_connecting';

export type SessionState = {
  fileName?: string;
  extractedDiet?: ExtractedDiet | null;
  transcript?: string;
  routineContext?: RoutineContext | null;
  adjustedDiet?: AdjustedDiet | null;
  healthScreenshotCount: number;
  healthFileNames: string[];
  status: SessionStatus;
  logs: string[];
  errorMessage?: string | null;
  liveTranscript: LiveTurn[];
  liveActive: boolean;
  agentSpeaking: boolean;
  liveGenerating?: boolean;
};

// --- Live session transcript ---
export type LiveTurn = {
  role: 'user' | 'agent';
  text: string;
};

// --- WebSocket message contract ---
export type ClientWsMessage =
  | { type: 'diet_upload'; payload: { base64: string; mimeType: string; filename?: string } }
  | { type: 'transcript'; payload: { text: string } }
  | { type: 'health_upload'; payload: { base64: string; mimeType: string; filename?: string } }
  | { type: 'clear_health' }
  | { type: 'generate_adjusted' }
  | { type: 'start_live' }
  | { type: 'audio_chunk'; payload: { data: string } }
  | { type: 'live_text'; payload: { text: string } }
  | { type: 'end_live' };

export type ServerWsMessage =
  | { type: 'progress'; payload: { step: string; detail?: string } }
  | { type: 'extraction_result'; payload: { diet: ExtractedDiet } }
  | { type: 'extraction_error'; payload: { message: string } }
  | { type: 'health_uploaded'; payload: { count: number } }
  | { type: 'health_cleared'; payload: { count: number } }
  | { type: 'adjusted_diet'; payload: AdjustedDiet }
  | { type: 'adjusted_diet_error'; payload: { message: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'live_ready' }
  | { type: 'live_audio'; payload: { data: string } }
  | { type: 'live_input_transcript'; payload: { text: string } }
  | { type: 'live_output_transcript'; payload: { text: string } }
  | { type: 'live_interrupted' }
  | { type: 'live_turn_complete' }
  | { type: 'live_error'; payload: { message: string } }
  | { type: 'live_ended' };
