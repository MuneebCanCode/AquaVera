'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ icon: Icon, label, value, trend, className }: StatCardProps) {
  return (
    <div className={cn('card flex items-start gap-4', className)}>
      <div className="flex-shrink-0 rounded-lg bg-teal/10 p-3">
        <Icon className="h-6 w-6 text-teal" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', trend.value >= 0 ? 'text-success' : 'text-danger')}>
            {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend.value)}% {trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
