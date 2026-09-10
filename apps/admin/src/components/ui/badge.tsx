import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
        outline: "text-foreground border-border",
        success: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
        warning: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20",
        info: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  tone?: "neutral" | "green" | "red" | "yellow" | "blue"
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  let resolvedVariant = variant
  if (tone) {
    if (tone === "green") resolvedVariant = "success"
    else if (tone === "red") resolvedVariant = "destructive"
    else if (tone === "yellow") resolvedVariant = "warning"
    else if (tone === "blue") resolvedVariant = "info"
    else resolvedVariant = "secondary"
  }
  return (
    <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
