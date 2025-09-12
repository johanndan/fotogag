"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const SidebarCtx = createContext<Ctx | null>(null);

export function SidebarProvider({
  children,
  defaultOpen = true,
}: { children: ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Zustand aus localStorage laden/persistieren (Client-only)
  useEffect(() => {
    const v = localStorage.getItem("sidebar:isOpen");
    if (v != null) setIsOpen(v === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar:isOpen", isOpen ? "1" : "0");
  }, [isOpen]);

  const value: Ctx = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(v => !v),
  };
  return <SidebarCtx.Provider value={value}>{children}</SidebarCtx.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
