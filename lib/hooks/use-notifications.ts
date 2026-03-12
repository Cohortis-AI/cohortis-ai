"use client";

import { useEffect, useRef, useCallback } from "react";
import { mutate } from "swr";
import { toast } from "sonner";

/**
 * SSE-based real-time notification hook.
 * Listens to /api/notifications/stream and triggers SWR revalidation
 * when agent tasks complete.
 */
export function useNotifications() {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    if (esRef.current) return;

    try {
      const es = new EventSource("/api/notifications/stream");
      esRef.current = es;

      es.addEventListener("notification", (event) => {
        // Revalidate key SWR caches
        mutate("/api/dashboard");
        mutate((key) => typeof key === "string" && key.startsWith("/api/runs"), undefined, { revalidate: true });
        mutate((key) => typeof key === "string" && key.startsWith("/api/agents"), undefined, { revalidate: true });
        mutate((key) => typeof key === "string" && key.startsWith("/api/messages"), undefined, { revalidate: true });

        toast.info("Agent task completed", {
          duration: 3000,
          position: "bottom-right",
        });
      });

      es.addEventListener("error", () => {
        es.close();
        esRef.current = null;
        // Reconnect after 5s
        reconnectTimer.current = setTimeout(connect, 5000);
      });
    } catch {
      // SSE not supported or connection failed
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
