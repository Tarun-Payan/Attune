"use client"

import { ChevronDown } from "lucide-react"
import { Select } from "@base-ui/react/select"

import { cn } from "@/lib/utils"

type LineSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type LineSelectProps = {
  id: string
  value: string
  options: LineSelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  className?: string
}

function LineSelect({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  name,
  className,
}: LineSelectProps) {
  return (
    <Select.Root
      disabled={disabled}
      id={id}
      items={options}
      name={name}
      required={required}
      value={value || null}
      onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
    >
      <Select.Trigger
        className={cn(
          "group flex h-9 w-full items-center justify-between rounded-none border-x-0 border-t-0 border-b border-transparent bg-transparent px-0 text-left text-sm outline-none transition-colors hover:border-[#e7e9ed] data-popup-open:border-[#017e84] focus-visible:border-[#017e84] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-[#3c3e4b] dark:data-popup-open:border-[#02c7b5] dark:focus-visible:border-[#02c7b5]",
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[#017e84] opacity-0 transition-opacity group-hover:opacity-100 group-data-popup-open:opacity-100 dark:text-[#02c7b5]"
        />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner align="start" side="bottom" sideOffset={4}>
          <Select.Popup className="z-50 min-w-(--anchor-width) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
            <Select.List className="max-h-72 overflow-y-auto py-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  className="cursor-pointer px-4 py-2 text-sm outline-none data-highlighted:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"
                  disabled={option.disabled}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export { LineSelect }
export type { LineSelectOption }
