"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  className?: string;
  showPageSize?: boolean;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  disabled = false,
  className,
  showPageSize = true,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers with ellipses
  const pageNumbers = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-end" as const, totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [
        1,
        "ellipsis-start" as const,
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      "ellipsis-start" as const,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-end" as const,
      totalPages,
    ];
  }, [currentPage, totalPages]);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1 text-xs select-none",
        className,
      )}
    >
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>
          {totalCount === 0 ? (
            "No entries found"
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold text-foreground">{startItem}</span> to{" "}
              <span className="font-semibold text-foreground">{endItem}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> entries
            </>
          )}
        </span>

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/80">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                const newSize = Number(val);
                if (newSize > 0) {
                  onPageSizeChange(newSize);
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-[72px] text-xs px-2">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          className="h-7 w-7 rounded-lg"
          onClick={() => onPageChange(1)}
          disabled={disabled || currentPage <= 1}
          title="First page"
          aria-label="First page"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          className="h-7 w-7 rounded-lg"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (typeof p === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-0.5 text-muted-foreground text-xs"
                >
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <Button
                key={p}
                variant={isCurrent ? "default" : "ghost"}
                size="xs"
                className={cn(
                  "h-7 min-w-7 px-2 text-xs rounded-lg transition-colors font-medium",
                  isCurrent
                    ? "pointer-events-none shadow-xs"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onPageChange(p)}
                disabled={disabled}
                aria-current={isCurrent ? "page" : undefined}
              >
                {p}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon-xs"
          className="h-7 w-7 rounded-lg"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          title="Next page"
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          className="h-7 w-7 rounded-lg"
          onClick={() => onPageChange(totalPages)}
          disabled={disabled || currentPage >= totalPages}
          title="Last page"
          aria-label="Last page"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook for in-memory / client-side pagination of arrays.
 */
export function useClientPagination<T>(items: T[] | null | undefined, initialPageSize = 10) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const safeItems = items ?? [];
  const totalCount = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // If page exceeds total pages after items list changes (e.g. deletion or filter), reset to max page
  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return safeItems.slice(start, start + pageSize);
  }, [safeItems, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    totalCount,
    totalPages,
    paginatedItems,
  };
}
