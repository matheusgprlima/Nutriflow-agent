import { z } from 'zod';

// --- Diet Template ---
export const DietItemSchema = z.object({
  foodName: z.string(),
  unit: z.enum(["g", "ml", "serving", "unit"]),
  baseQuantity: z.number(),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
});

export const DietMealSchema = z.object({
  name: z.string(),
  items: z.array(DietItemSchema),
});

export const DietTemplateSchema = z.object({
  meals: z.array(DietMealSchema),
  constraints: z.object({
    forbiddenNewFoods: z.boolean().default(true),
  }),
  confidence: z.number(),
  requiresUserConfirmation: z.boolean(),
  extractionWarnings: z.array(z.string()),
});

// --- Daily Metrics ---
export const TrainingSessionSchema = z.object({
  type: z.enum(["strength", "crossfit", "cardio", "other"]),
  durationMin: z.number().optional(),
  intensity: z.enum(["low", "medium", "high"]).optional(),
});

export const DailyMetricsSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  timezone: z.string(),
  steps: z.number().optional(),
  activeCaloriesKcal: z.number().optional(),
  sleepHours: z.number().optional(),
  restingHR: z.number().optional(),
  avgHR: z.number().optional(),
  hrvMs: z.number().optional(),
  training: z.array(TrainingSessionSchema).default([]),
  confidence: z.number(),
  extractionWarnings: z.array(z.string()),
});

// --- BioImpedance ---
export const BioImpedanceSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  timezone: z.string(),
  weightKg: z.number().optional(),
  bodyFatPercent: z.number().optional(),
  leanMassKg: z.number().optional(),
  confidence: z.number(),
  extractionWarnings: z.array(z.string()),
});

// --- Goal ---
export const GoalSchema = z.object({
  mode: z.enum(["deficit", "surplus", "maintenance"]),
  targetKcalDelta: z.number().optional(),
  notes: z.string().optional(),
});

// --- Tomorrow Plan ---
export const PlanItemSchema = z.object({
  foodName: z.string(),
  unit: z.string(),
  quantity: z.number(),
  reason: z.string().optional(),
});

export const PlanMealSchema = z.object({
  name: z.string(),
  items: z.array(PlanItemSchema),
});

export const TomorrowPlanSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  timezone: z.string(),
  meals: z.array(PlanMealSchema),
  summary: z.object({
    expectedAdjustment: z.enum(["increase", "decrease", "none"]),
    notes: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
  generatedLocalDateTime: z.string(),
  validations: z.object({
    noNewFoods: z.boolean(),
    withinRanges: z.boolean(),
    needsUserConfirmation: z.boolean(),
    issues: z.array(z.string()),
  }),
});

// --- UI Actions ---
export const UiActionSchema = z.object({
  type: z.enum(["click", "type", "select", "submit"]),
  fieldId: z.string().optional(),
  value: z.string().optional(),
  option: z.string().optional(),
});

export const UiActionsSchema = z.object({
  actions: z.array(UiActionSchema),
  confidence: z.number(),
});

// --- API Request/Response Types ---
export type DietTemplate = z.infer<typeof DietTemplateSchema>;
export type DailyMetrics = z.infer<typeof DailyMetricsSchema>;
export type BioImpedance = z.infer<typeof BioImpedanceSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type TomorrowPlan = z.infer<typeof TomorrowPlanSchema>;
export type UiActions = z.infer<typeof UiActionsSchema>;
