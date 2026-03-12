"use client";

import { createContext, useContext, useMemo } from "react";
import type PusherClient from "pusher-js";
import { getPusherClient } from "@/lib/pusher-client";

const PusherContext = createContext<PusherClient | null>(null);

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const pusher = useMemo(() => getPusherClient(), []);

  return (
    <PusherContext.Provider value={pusher}>{children}</PusherContext.Provider>
  );
}

export function usePusherClient(): PusherClient {
  const ctx = useContext(PusherContext);
  if (!ctx) {
    throw new Error("usePusherClient must be used within a <PusherProvider>");
  }
  return ctx;
}
