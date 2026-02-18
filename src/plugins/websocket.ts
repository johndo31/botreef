import { type FastifyInstance } from "fastify";

export async function websocketPlugin(app: FastifyInstance): Promise<void> {
  // @fastify/websocket is registered in server.ts
  // This plugin provides any additional WebSocket configuration
  app.log.info("WebSocket plugin initialized");
}
