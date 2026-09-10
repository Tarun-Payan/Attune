import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function LineInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "rounded-none border-x-0 border-t-0 border-b bg-transparent px-0 shadow-none transition-colors hover:not-focus-visible:border-[#e7e9ed] dark:hover:not-focus-visible:border-[#3c3e4b] focus-visible:border-[#017e84] dark:focus-visible:border-[#02c7b5] focus-visible:ring-0 aria-invalid:border-x-0 aria-invalid:border-t-0 aria-invalid:border-b aria-invalid:border-destructive aria-invalid:ring-0",
        className,
      )}
      {...props}
    />
  )
}

export { LineInput }
