import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'warning' | 'success' | 'error' | 'neutral';
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const styles = {
    active: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    inactive: 'bg-white/5 text-gray-400 border-white/10',
    neutral: 'bg-white/5 text-gray-400 border-white/10',
  };

  return (
    <span className={clsx(
      'px-2.5 py-0.5 rounded-full text-xs font-medium border',
      styles[status] || styles.neutral,
      className
    )}>
      {label}
    </span>
  );
}
