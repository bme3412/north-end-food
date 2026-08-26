"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type ServiceMode = "dine-in" | "takeout";

type ServiceModeContextValue = {
  mode: ServiceMode;
  setMode: (next: ServiceMode) => void;
};

const ServiceModeContext = createContext<ServiceModeContextValue | null>(null);

export function ServiceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ServiceMode>("dine-in");
  return <ServiceModeContext.Provider value={{ mode, setMode }}>{children}</ServiceModeContext.Provider>;
}

// Read by both the header toggle and the search query builder, so picking
// Takeout in the header actually filters results instead of being purely
// cosmetic.
export function useServiceMode(): ServiceModeContextValue {
  const ctx = useContext(ServiceModeContext);
  if (!ctx) throw new Error("useServiceMode must be used within ServiceModeProvider");
  return ctx;
}

// `service_mode` query param the API's /menu-items filter understands.
// Excludes only restaurants Google has *explicitly confirmed* don't offer
// the selected mode -- most won't have an answer yet (null), and those are
// kept, not excluded (see app/routers/menu_items.py).
export function serviceModeToParams(mode: ServiceMode): Record<string, string | undefined> {
  return { service_mode: mode === "takeout" ? "takeout" : "dine_in" };
}
