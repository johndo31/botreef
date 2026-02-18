import { loadConfig } from "./config/index.js";
import { initDatabase, closeDatabase } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { createRedisConnection, closeRedisConnection } from "./queue/connection.js";
import { createJobQueue, closeJobQueue } from "./queue/producer.js";
import { createWorker, closeWorker } from "./queue/worker.js";
import { initRouter, submitMessage } from "./router/message-router.js";
import { dispatchEvent } from "./router/event-dispatcher.js";
import { registerAdapter, startAllAdapters, stopAllAdapters } from "./adapters/registry.js";
import { RestAdapter } from "./adapters/rest/routes.js";
import { SshAdapter } from "./adapters/ssh/server.js";
import { WebAdapter } from "./adapters/web/websocket.js";
import { TelegramAdapter } from "./adapters/telegram/bot.js";
import { SlackAdapter } from "./adapters/slack/app.js";
import { DiscordAdapter } from "./adapters/discord/client.js";
import { GitHubWebhookAdapter } from "./adapters/github/webhook.js";
import { EmailAdapter } from "./adapters/email/receiver.js";
import { KanbanWebhookAdapter } from "./adapters/kanban/webhook.js";
import { startAllBotLoops, stopAllBotLoops } from "./kanban/agent-loop.js";
import { configureSandbox } from "./sandbox/manager.js";
import { configureDevServer } from "./sandbox/dev-server.js";
import { setWorkspaceBaseDir } from "./git/workspace.js";
import { buildServer } from "./server.js";
import { logger } from "./util/logger.js";

async function main() {
  logger.info("Starting Botreef...");

  // 1. Load configuration
  const config = loadConfig();
  logger.level = config.server.logLevel;

  // 2. Initialize database
  initDatabase(config.database.path);
  runMigrations();

  // 3. Configure subsystems
  configureSandbox({
    image: config.sandbox.image,
    runtime: config.sandbox.runtime,
    memoryMb: config.sandbox.memoryMb,
    cpus: config.sandbox.cpus,
    networkEnabled: config.sandbox.networkEnabled,
  });
  configureDevServer(config.server.baseUrl);
  setWorkspaceBaseDir(config.sandbox.workspaceDir);

  // 4. Initialize Redis and job queue
  const redis = createRedisConnection({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  });
  createJobQueue(redis);

  // 5. Initialize router
  initRouter({ config });

  // 6. Build Fastify server
  const server = await buildServer();

  // 7. Register adapters
  const adapterDeps = { submitMessage, logger };

  await registerAdapter(new RestAdapter(), config.interfaces.rest, adapterDeps);
  await registerAdapter(new WebAdapter(), config.interfaces.web, adapterDeps);
  await registerAdapter(new SshAdapter(), config.interfaces.ssh, adapterDeps);
  await registerAdapter(new TelegramAdapter(), config.interfaces.telegram, adapterDeps);
  await registerAdapter(new SlackAdapter(), config.interfaces.slack, adapterDeps);
  await registerAdapter(new DiscordAdapter(), config.interfaces.discord, adapterDeps);
  await registerAdapter(new GitHubWebhookAdapter(), config.interfaces.github, adapterDeps);
  await registerAdapter(new EmailAdapter(), config.interfaces.email, adapterDeps);
  await registerAdapter(new KanbanWebhookAdapter(), config.interfaces.kanban, adapterDeps);

  // 8. Start adapters
  await startAllAdapters();

  // 9. Start job worker
  createWorker({
    connection: redis,
    concurrency: config.server.maxConcurrentJobs,
    onTaskEvent: dispatchEvent,
  });

  // 10. Start bot loops (each bot polls its own kanban stories)
  startAllBotLoops({ submitMessage });

  // 11. Start HTTP server
  const address = await server.listen({
    host: config.server.host,
    port: config.server.port,
  });
  logger.info(`Botreef listening on ${address}`);

  // 12. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");

    stopAllBotLoops();
    await closeWorker();
    await stopAllAdapters();
    await server.close();
    await closeJobQueue();
    await closeRedisConnection();
    closeDatabase();

    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start Botreef");
  process.exit(1);
});
