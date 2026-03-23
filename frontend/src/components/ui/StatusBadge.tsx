'use client';

import { cn } from '@/lib/utils';
import type { ProjectStatus, QualityTier, WaterStressZone, ListingStatus, TradeStatus } from '@/types';

type StatusType = ProjectStatus | QualityTier | WaterStressZone | ListingStatus | TradeStatus | string;

const colorMap: Record<string, string> = {
  // Project status
  registered: 'bg-blue-100 text-blue-700',
  pending_verification: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  // Quality tier
  tier_1: 'bg-green-100 text-green-700',
  tier_2: 'bg-blue-100 text-blue-700',
  tier_3: 'bg-gray-100 text-gray-700',
  // Water stress zone
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  extreme: 'bg-red-100 text-red-700',
  // Listing status
  partially_filled: 'bg-yellow-100 text-yellow-700',
  sold: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  // Trade status
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

const labelMap: Record<string, string> = {
  pending_verification: 'Pending Verification',
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
  partially_filled: 'Partially Filled',
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = colorMap[status] || 'bg-gray-100 text-gray-700';
  const label = labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

  return (
    <span className={cn('badge', colors, className)}>
      {label}
    </span>
  );
}
