#!/usr/bin/env node
/**
 * Roblox Open Cloud MCP Server
 *
 * An MCP server that exposes Roblox Open Cloud APIs as tools for AI agents.
 * Enables agents to manage experiences, execute Luau scripts, interact with
 * data stores, publish messages to game servers, and manage monetization products.
 *
 * Environment variables:
 *   ROBLOX_API_KEY  - Required. Your Roblox Open Cloud API key.
 *                     Create one at https://create.roblox.com/dashboard/credentials
 *   TRANSPORT       - Optional. "stdio" (default) or "http"
 *   PORT            - Optional. HTTP port (default 3000, only used with TRANSPORT=http)
 *
 * Usage:
 *   # stdio (for Claude Desktop, Cursor, etc.)
 *   ROBLOX_API_KEY=your_key node dist/index.js
 *
 *   # HTTP (for remote/multi-client access)
 *   TRANSPORT=http ROBLOX_API_KEY=your_key node dist/index.js
 *
 *   # Add to Claude Desktop config:
 *   claude mcp add roblox-opencloud -- env ROBLOX_API_KEY=your_key node /path/to/dist/index.js
 */

import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

// Tool registrations
import { registerLuauExecutionTools } from "./tools/luau-execution.js";
import { registerDataStoreTools } from "./tools/data-stores.js";
import { registerMessagingTools } from "./tools/messaging.js";
import { registerUniverseTools } from "./tools/universes.js";
import { registerMonetizationTools } from "./tools/monetization.js";
import { registerCreatorStoreTools } from "./tools/creator-store.js";
import { registerConfigTools } from "./tools/config.js";
import { registerSecretsTools } from "./tools/secrets.js";
import { registerUserRestrictionsTools } from "./tools/user-restrictions.js";
import { registerOrderedDataStoreTools } from "./tools/ordered-data-stores.js";
import { registerMemoryStoreTools } from "./tools/memory-stores.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerUserTools } from "./tools/users.js";
import { registerBadgeTools } from "./tools/badges.js";
import { registerThumbnailTools } from "./tools/thumbnails.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerGenerativeAiTools } from "./tools/generative-ai.js";

// ── Server Initialization ──────────────────────────────────────────────

const server = new McpServer({
  name: "roblox-opencloud-mcp-server",
  version: "0.1.0",
});

// Register all tool domains
registerLuauExecutionTools(server);
registerDataStoreTools(server);
registerMessagingTools(server);
registerUniverseTools(server);
registerMonetizationTools(server);
registerCreatorStoreTools(server);
registerConfigTools(server);
registerSecretsTools(server);
registerUserRestrictionsTools(server);
registerOrderedDataStoreTools(server);
registerMemoryStoreTools(server);
registerAssetTools(server);
registerGroupTools(server);
registerUserTools(server);
registerBadgeTools(server);
registerThumbnailTools(server);
registerNotificationTools(server);
registerGenerativeAiTools(server);

// ── Transport Setup ────────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  // Validate API key early
  if (!process.env.ROBLOX_API_KEY) {
    console.error(
      "ERROR: ROBLOX_API_KEY environment variable is required.\n" +
      "Create an API key at https://create.roblox.com/dashboard/credentials\n" +
      "Then set it: export ROBLOX_API_KEY=your_key_here"
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Roblox Open Cloud MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  if (!process.env.ROBLOX_API_KEY) {
    console.error("ERROR: ROBLOX_API_KEY environment variable is required.");
    process.exit(1);
  }

  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    console.error(
      "WARNING: MCP_AUTH_TOKEN not set. HTTP endpoint is UNAUTHENTICATED.\n" +
      "Set MCP_AUTH_TOKEN to require Bearer authentication on /mcp."
    );
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Auth middleware for /mcp — requires Bearer token when MCP_AUTH_TOKEN is set
  app.post("/mcp", (req, res, next) => {
    if (authToken) {
      const header = req.headers.authorization ?? "";
      const expected = `Bearer ${authToken}`;
      // Timing-safe comparison: hash both sides to normalize length,
      // preventing timing side-channel leaks on token value or length.
      const headerHash = crypto.createHash("sha256").update(header).digest();
      const expectedHash = crypto.createHash("sha256").update(expected).digest();
      if (!crypto.timingSafeEqual(headerHash, expectedHash)) {
        res.status(401).json({ error: "Unauthorized. Provide Authorization: Bearer <MCP_AUTH_TOKEN>." });
        return;
      }
    }
    next();
  }, async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check (no auth required)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "roblox-opencloud-mcp-server", version: "0.1.1" });
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`Roblox Open Cloud MCP server running on http://localhost:${port}/mcp`);
  });
}

// ── Main ───────────────────────────────────────────────────────────────

const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
