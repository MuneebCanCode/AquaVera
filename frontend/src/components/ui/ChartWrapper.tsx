'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface ChartWrapperProps {
  height?: number;
  children: React.ReactNode;
  className?: string;
}

export function ChartWrapper({ height = 300, children, className }: ChartWrapperProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
