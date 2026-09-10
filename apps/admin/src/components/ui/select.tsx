"use client"

import * as React from "react"
import { Select as BaseSelect } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectProps<Value = string>
  extends Omit<BaseSelect.Root.Props<Value>, "onValueChange"> {
  onValueChange?: (value: Value) => void
}

export function Select<Value = string>({
  children,
  onValueChange,
  ...props
}: SelectProps<Value>) {
  return (
    <BaseSelect.Root
      {...props}
      onValueChange={(val) => {
        if (onValueChange && val !== null && val !== undefined) {
          onValueChange(val)
        }
      }}
    >
      {children}
    </BaseSelect.Root>
  )
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  BaseSelect.Trigger.Props
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.Trigger
      ref={ref}
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-2xl border border-border bg-input/40 px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors hover:bg-input/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30 dark:bg-input/20 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export const SelectValue = React.forwardRef<
  HTMLSpanElement,
  BaseSelect.Value.Props
>(({ className, placeholder, ...props }, ref) => {
  return (
    <BaseSelect.Value
      ref={ref}
      className={cn("truncate text-left text-foreground", className)}
      placeholder={placeholder}
      {...props}
    />
  )
})
SelectValue.displayName = "SelectValue"

export function SelectContent({
  className,
  children,
  sideOffset = 4,
  align = "start",
  side = "bottom",
  alignItemWithTrigger = false,
  ...props
}: BaseSelect.Popup.Props & {
  sideOffset?: number
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  alignItemWithTrigger?: boolean
}) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="z-[100]"
      >
        <BaseSelect.Popup
          className={cn(
            "z-[100] min-w-(--anchor-width) overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100",
            className
          )}
          {...props}
        >
          <BaseSelect.List className="max-h-72 overflow-y-auto">
            {children}
          </BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  BaseSelect.Item.Props
>(({ className, children, ...props }, ref) => {
  return (
    <BaseSelect.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="ml-2 flex items-center justify-center">
        <Check className="size-3.5 text-primary" />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  )
})
SelectItem.displayName = "SelectItem"

export const SelectGroup = BaseSelect.Group
export const SelectLabel = BaseSelect.GroupLabel
export const SelectSeparator = BaseSelect.Separator

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-2xl border border-border bg-input/40 px-3 py-1 text-sm text-foreground transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/20 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
NativeSelect.displayName = "NativeSelect"

