import { app } from "./app-simple";
import { env } from "./config/env";

const server = app.listen(env.PORT, () => {
  console.log(`
🚀 UllGetTheJob API MVP
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server: http://localhost:${env.PORT}
Health: http://localhost:${env.PORT}/api/health
Environment: ${env.NODE_ENV}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await server.stop();
  process.exit(0);
});

export type ServerType = typeof server;
