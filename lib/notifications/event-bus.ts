import { EventEmitter } from "events";

class NotificationBus extends EventEmitter {
  emitNotificationUpdate(userId: string) {
    this.emit("notification", { userId, timestamp: Date.now() });
  }
}

// Singleton on globalThis to survive hot reloads
const globalForBus = globalThis as unknown as {
  notificationBus: NotificationBus;
};

export const notificationBus =
  globalForBus.notificationBus || new NotificationBus();

if (process.env.NODE_ENV !== "production") {
  globalForBus.notificationBus = notificationBus;
}
