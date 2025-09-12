// src/components/page-header.tsx (oder dein Pfad)
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react"

// ⚠️ Lokalen Typ NICHT BreadcrumbItem nennen (würde mit Import kollidieren)
interface Crumb {
  href: string
  label: string
}

interface PageHeaderProps {
  items: Crumb[]
}

export function PageHeader({ items }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        {/* SidebarTrigger & Separator entfernt */}
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => (
              <React.Fragment key={item.href}>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={item.href}>
                    {item.label}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {index < items.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
