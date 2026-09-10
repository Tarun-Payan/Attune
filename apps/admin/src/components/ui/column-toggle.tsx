"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface ColumnDef<T extends string = string> {
  id: T;
  label: string;
  defaultVisible?: boolean;
  required?: boolean;
}

export function useColumnVisibility<T extends string>(
  tableKey: string,
  columns: ColumnDef<T>[],
) {
  const defaultMap = useMemo(() => {
    const map = {} as Record<T, boolean>;
    for (const col of columns) {
      map[col.id] = col.defaultVisible !== false;
    }
    return map;
  }, [columns]);

  const [visibleColumns, setVisibleColumns] = useState<Record<T, boolean>>(defaultMap);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`attune_cols_${tableKey}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<T, boolean>;
        setVisibleColumns((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore localStorage errors in private browsing or iframe
    }
  }, [tableKey]);

  const toggleColumn = useCallback(
    (id: T, checked?: boolean) => {
      setVisibleColumns((prev) => {
        const next = {
          ...prev,
          [id]: checked !== undefined ? checked : !prev[id],
        };
        try {
          localStorage.setItem(`attune_cols_${tableKey}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [tableKey],
  );

  const resetColumns = useCallback(() => {
    setVisibleColumns(defaultMap);
    try {
      localStorage.removeItem(`attune_cols_${tableKey}`);
    } catch {
      // ignore
    }
  }, [defaultMap, tableKey]);

  const isVisible = useCallback(
    (id: T) => {
      return visibleColumns[id] ?? true;
    },
    [visibleColumns],
  );

  const visibleCount = useMemo(() => {
    return columns.filter((c) => isVisible(c.id)).length;
  }, [columns, isVisible]);

  return {
    visibleColumns,
    isVisible,
    toggleColumn,
    resetColumns,
    visibleCount,
  };
}

export function ColumnVisibilityDropdown<T extends string>({
  columns,
  isVisible,
  onToggle,
  onReset,
}: {
  columns: ColumnDef<T>[];
  isVisible: (id: T) => boolean;
  onToggle: (id: T, checked: boolean) => void;
  onReset?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer text-xs h-9">
            <SlidersHorizontal size={13} className="text-muted-foreground" />
            <span>Columns</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Toggle Columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={isVisible(col.id)}
              disabled={col.required}
              onCheckedChange={(checked) => onToggle(col.id, checked)}
              className="cursor-pointer text-xs"
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {onReset ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onReset}
              className="text-xs text-muted-foreground cursor-pointer justify-center"
            >
              <RotateCcw size={12} className="mr-1.5" />
              Reset to default
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
