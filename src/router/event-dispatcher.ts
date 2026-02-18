import type { TaskEvent } from "../types/task-event.js";
import { logger } from "../util/logger.js";

type EventHandler = (event: TaskEvent) => Promise<void> | void;

const _handlers = new Map<string, Set<EventHandler>>();
const _globalHandlers = new Set<EventHandler>();

export function onTaskEvent(handler: EventHandler): () => void {
  _globalHandlers.add(handler);
  return () => _globalHandlers.delete(handler);
}

export function onChannelEvent(channel: string, handler: EventHandler): () => void {
  if (!_handlers.has(channel)) {
    _handlers.set(channel, new Set());
  }
  _handlers.get(channel)!.add(handler);
  return () => _handlers.get(channel)?.delete(handler);
}

export async function dispatchEvent(event: TaskEvent): Promise<void> {
  logger.debug({ type: event.type, jobId: event.jobId, channel: event.channel }, "Dispatching event");

  // Dispatch to global handlers
  for (const handler of _globalHandlers) {
    try {
      await handler(event);
    } catch (err) {
      logger.error({ err, type: event.type }, "Global event handler error");
    }
  }

  // Dispatch to channel-specific handlers
  const channelHandlers = _handlers.get(event.channel);
  if (channelHandlers) {
    for (const handler of channelHandlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error({ err, type: event.type, channel: event.channel }, "Channel event handler error");
      }
    }
  }
}

export function clearEventHandlers(): void {
  _handlers.clear();
  _globalHandlers.clear();
}
