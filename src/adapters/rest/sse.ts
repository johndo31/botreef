import type { FastifyRequest, FastifyReply } from "fastify";
import { onTaskEvent } from "../../router/event-dispatcher.js";
import { logger } from "../../util/logger.js";

export function handleSSEStream(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
): void {
  const { jobId } = request.params;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  reply.raw.write(`data: ${JSON.stringify({ type: "connected", jobId })}\n\n`);

  const unsubscribe = onTaskEvent((event) => {
    if (event.jobId !== jobId) return;

    reply.raw.write(`event: ${event.type}\n`);
    reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);

    if (event.type === "task:completed" || event.type === "task:failed") {
      reply.raw.end();
    }
  });

  request.raw.on("close", () => {
    unsubscribe();
    logger.debug({ jobId }, "SSE connection closed");
  });
}
