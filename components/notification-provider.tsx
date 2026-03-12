"use client";

import { useNotifications } from "@/lib/hooks/use-notifications";

export function NotificationProvider() {
  useNotifications();
  return null;
}
