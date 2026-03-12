import { getEffectiveSession } from "@/lib/auth-utils";
import { notificationBus } from "@/lib/notifications/event-bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Listen for notification events
      const handler = (data: { userId: string; timestamp: number }) => {
        if (data.userId === userId) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: notification\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          } catch {
            // Connection closed
          }
        }
      };

      notificationBus.on("notification", handler);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        notificationBus.off("notification", handler);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Send initial connected event
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ userId })}\n\n`
        )
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
