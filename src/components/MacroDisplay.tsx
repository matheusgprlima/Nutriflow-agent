import React from 'react';

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

export function sumItemMacros(items: Array<{ estimatedCalories?: number; estimatedProteinG?: number; estimatedCarbsG?: number; estimatedFatG?: number }>): Macros {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const item of items) {
    calories += item.estimatedCalories ?? 0;
    protein += item.estimatedProteinG ?? 0;
    carbs += item.estimatedCarbsG ?? 0;
    fat += item.estimatedFatG ?? 0;
  }
  return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}

export function hasMacroData(m: Macros): boolean {
  return m.calories > 0 || m.protein > 0 || m.carbs > 0 || m.fat > 0;
}

export function MacroBar({ protein, carbs, fat, className = '' }: { protein: number; carbs: number; fat: number; className?: string }) {
  const total = protein + carbs + fat;
  if (total === 0) return null;
  return (
    <div className={`flex h-2.5 rounded-full overflow-hidden bg-white/5 ${className}`}>
      <div style={{ width: `${(protein / total) * 100}%` }} className="bg-sky-400 transition-all" />
      <div style={{ width: `${(carbs / total) * 100}%` }} className="bg-emerald-400 transition-all" />
      <div style={{ width: `${(fat / total) * 100}%` }} className="bg-amber-400 transition-all" />
    </div>
  );
}

function Stat({ label, value, unit, color, prev }: { label: string; value: number; unit: string; color: string; prev?: number }) {
  const diff = prev != null ? value - prev : null;
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}<span className="text-sm font-normal ml-0.5">{unit}</span></p>
      {diff != null && diff !== 0 && (
        <p className={`text-[10px] font-medium ${diff > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {diff > 0 ? '+' : ''}{diff}{unit}
        </p>
      )}
    </div>
  );
}

export function MacroGrid({ macros, comparison }: { macros: Macros; comparison?: Macros | null }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Protein" value={macros.protein} unit="g" color="text-sky-400" prev={comparison?.protein} />
      <Stat label="Carbs" value={macros.carbs} unit="g" color="text-emerald-400" prev={comparison?.carbs} />
      <Stat label="Fat" value={macros.fat} unit="g" color="text-amber-400" prev={comparison?.fat} />
      <Stat label="Calories" value={macros.calories} unit="kcal" color="text-white" prev={comparison?.calories} />
    </div>
  );
}
