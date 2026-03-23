'use client';

import { ExternalLink } from 'lucide-react';
import { hashScanUrl, truncateMiddle } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface HashScanLinkProps {
  entityType: 'transaction' | 'topic' | 'token' | 'account' | 'contract' | 'file';
  entityId: string;
  label?: string;
  className?: string;
}

export function HashScanLink({ entityType, entityId, label, className }: HashScanLinkProps) {
  // Don't render as a link if the ID is a placeholder
  const isPlaceholder = !entityId || entityId.startsWith('pending-hedera-seed') || entityId.startsWith('demo-');
  if (isPlaceholder) {
    return <span className="text-xs text-gray-400 font-mono">pending</span>;
  }

  return (
    <a
      href={hashScanUrl(entityType, entityId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-teal hover:text-teal-600 text-sm font-mono', className)}
    >
      {label || truncateMiddle(entityId)}
      <ExternalLink className="h-3 w-3 flex-shrink-0" />
    </a>
  );
}
