import React from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  breadcrumbs?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4", className)}>
      <div>
        {breadcrumbs ? <div className="mb-2">{breadcrumbs}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}
