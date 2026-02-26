import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusBadgeProps {
  status: 'active' | 'processing' | 'idle' | 'error' | 'warning';
  label?: string;
}

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const variants = {
    active: "bg-primary/10 text-primary border-primary/20",
    processing: "bg-accent/10 text-accent border-accent/20 animate-pulse",
    idle: "bg-gray-800 text-gray-400 border-gray-700",
    error: "bg-error/10 text-error border-error/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-300 animate-in fade-in zoom-in-95",
        variants[status]
      )}
    >
      <span className={cn(
        "w-2 h-2 rounded-full",
        status === 'active' && "bg-primary animate-pulse-glow",
        status === 'processing' && "bg-accent animate-spin",
        status === 'idle' && "bg-gray-500",
        status === 'error' && "bg-error",
        status === 'warning' && "bg-warning"
      )} />
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
};
