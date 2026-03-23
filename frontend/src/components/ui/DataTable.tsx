'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  keyExtractor: (row: T) => string;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  keyExtractor,
  className,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = page * pageSize;
  const pageData = data.slice(start, start + pageSize);

  return (
    <div className={cn('w-full', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row) => (
                <tr key={keyExtractor(row)} className="border-b border-gray-100 hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 whitespace-nowrap', col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-sm text-gray-500">
            {start + 1}–{Math.min(start + pageSize, data.length)} of {data.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
