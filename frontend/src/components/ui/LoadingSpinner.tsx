'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

export function LoadingSpinner({ size = 'md', className, label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)} role="status">
      <Loader2 className={cn('animate-spin text-teal', sizeMap[size])} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </div>
  );
}
