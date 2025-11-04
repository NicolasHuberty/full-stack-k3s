/**
 * Workers Entry Point
 *
 * This file starts all queue workers.
 * Run with: bun src/workers/index.ts
 */

import "./file-upload.worker";
import "./file-process.worker";

console.log("[Workers] All workers started successfully");

// Keep process alive
process.on("SIGTERM", () => {
  console.log("[Workers] Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Workers] Received SIGINT, shutting down...");
  process.exit(0);
});
