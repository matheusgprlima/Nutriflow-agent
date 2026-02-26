import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MetricWidgetProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'accent' | 'warning' | 'error';
}

export const MetricWidget = ({ label, value, unit, trend, trendValue, icon, color = 'primary' }: MetricWidgetProps) => {
  const colors = {
    primary: "text-primary border-primary/20 bg-primary/5",
    accent: "text-accent border-accent/20 bg-accent/5",
    warning: "text-warning border-warning/20 bg-warning/5",
    error: "text-error border-error/20 bg-error/5",
  };

  return (
    <div
      className={cn(
        "glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all duration-300 animate-in fade-in zoom-in-95",
        colors[color]
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <div className={cn("p-2 rounded-lg bg-white/5", colors[color])}>{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
        {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
      </div>

      {trend && (
        <div className="flex items-center mt-3 text-xs font-medium">
          <span className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5",
            trend === 'up' ? "text-green-400" : trend === 'down' ? "text-red-400" : "text-gray-400"
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
          <span className="ml-2 text-gray-500">vs yesterday</span>
        </div>
      )}
      
      {/* Glow Effect */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-current opacity-[0.03] blur-3xl rounded-full pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-500" />
    </div>
  );
};
