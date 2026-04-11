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

  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "roblox-opencloud-mcp-server", version: "0.1.0" });
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
