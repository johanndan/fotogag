// ./src/components/nav-main.tsx
"use client"

import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import type { Route } from "next"
import type { NavMainItem } from "./app-sidebar"

type Props = {
  items: NavMainItem[]
}

export function NavMain({ items }: Props) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const Icon =
            item.icon as unknown as React.ComponentType<{ className?: string }>

          // Kein Child: direkter Link
          if (!item.items?.length) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link
                    href={item.url as Route}
                    onClick={() => setOpenMobile(false)}
                  >
                    {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // Mit Children: Collapsible + Submenu (mit Icons!)
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const SubIcon =
                        subItem.icon as unknown as React.ComponentType<{
                          className?: string
                        }>

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            {(subItem.url as unknown as string).startsWith("/")
                              ? (
                                <Link
                                  href={subItem.url as Route}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  {SubIcon ? (
                                    <SubIcon className="mr-2 h-4 w-4" />
                                  ) : null}
                                  <span>{subItem.title}</span>
                                </Link>
                              ) : (
                                <a
                                  href={subItem.url as unknown as string}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  {SubIcon ? (
                                    <SubIcon className="mr-2 h-4 w-4" />
                                  ) : null}
                                  <span>{subItem.title}</span>
                                </a>
                              )}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
