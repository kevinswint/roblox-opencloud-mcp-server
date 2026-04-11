/**
 * Monetization Tools
 *
 * Manage Developer Products and Game Passes for Roblox experiences.
 * These APIs were released December 2025.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema, pageTokenSchema, pageSizeSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, truncateResponse } from "../services/api-client.js";
import { DEVELOPER_PRODUCTS_BASE, GAME_PASSES_BASE } from "../constants.js";
import { DeveloperProduct, GamePass, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

interface ListDevProductsResponse {
  developerProducts: DeveloperProduct[];
  nextPageToken?: string;
}

interface ListGamePassesResponse {
  gamePasses: GamePass[];
  nextPageToken?: string;
}

export function registerMonetizationTools(server: McpServer): void {
  // ── List Developer Products ──────────────────────────────────────────
  const ListDevProductsSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_developer_products",
    {
      title: "List Developer Products",
      description: `List all developer products for an experience.

Developer products are repeatable in-game purchases (e.g., currency packs, potions, boosts).

Requires API key scope: universe-developer-products:read`,
      inputSchema: ListDevProductsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_developer_products", async (params: z.infer<typeof ListDevProductsSchema>) => {
      try {
        const url = `${DEVELOPER_PRODUCTS_BASE(params.universe_id)}/creator`;
        const queryParams: Record<string, unknown> = { pageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<ListDevProductsResponse>(url, "GET", undefined, queryParams);
        const products = data.developerProducts || [];

        if (params.response_format === ResponseFormat.JSON) {
          const output = { products, nextPageToken: data.nextPageToken, count: products.length };
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        const lines = [`# Developer Products`, ""];
        if (products.length === 0) {
          lines.push("No developer products found.");
        } else {
          for (const p of products) {
            lines.push(`- **${p.displayName}** — ${p.priceInRobux != null ? `R$${p.priceInRobux}` : "Free"}`);
            if (p.description) lines.push(`  ${p.description}`);
          }
          if (data.nextPageToken) {
            lines.push("", `_More results available. Use page_token: \`${data.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Create Developer Product ─────────────────────────────────────────
  const CreateDevProductSchema = z.object({
    universe_id: universeIdSchema,
    display_name: z.string().min(1).max(100).describe("Product display name"),
    description: z.string().max(1000).default("").describe("Product description"),
    price_in_robux: z.number().int().min(0).describe("Price in Robux (0 for free)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_developer_product",
    {
      title: "Create Developer Product",
      description: `Create a new developer product (repeatable purchase) for an experience.

Developer products can be purchased multiple times by players (unlike game passes).
Common examples: coin packs, speed boosts, inventory expansions.

Requires API key scope: universe-developer-products:write`,
      inputSchema: CreateDevProductSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_developer_product", async (params: z.infer<typeof CreateDevProductSchema>) => {
      try {
        const url = DEVELOPER_PRODUCTS_BASE(params.universe_id);
        const body = {
          displayName: params.display_name,
          description: params.description,
          priceInRobux: params.price_in_robux,
        };

        const result = await makeApiRequest<DeveloperProduct>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Created developer product **"${result.displayName}"** at R$${params.price_in_robux}.\n\nPath: ${result.path}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Game Passes ─────────────────────────────────────────────────
  const ListGamePassesSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_game_passes",
    {
      title: "List Game Passes",
      description: `List all game passes for an experience.

Game passes are one-time purchases that grant permanent benefits (VIP access, special abilities, etc.).

Requires API key scope: universe-game-passes:read`,
      inputSchema: ListGamePassesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_game_passes", async (params: z.infer<typeof ListGamePassesSchema>) => {
      try {
        const url = `${GAME_PASSES_BASE(params.universe_id)}/creator`;
        const queryParams: Record<string, unknown> = { pageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<ListGamePassesResponse>(url, "GET", undefined, queryParams);
        const passes = data.gamePasses || [];

        if (params.response_format === ResponseFormat.JSON) {
          const output = { gamePasses: passes, nextPageToken: data.nextPageToken, count: passes.length };
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        const lines = [`# Game Passes`, ""];
        if (passes.length === 0) {
          lines.push("No game passes found.");
        } else {
          for (const gp of passes) {
            const price = gp.priceInRobux != null ? `R$${gp.priceInRobux}` : "Not for sale";
            const sale = gp.forSale ? "🟢 For sale" : "🔴 Not for sale";
            lines.push(`- **${gp.displayName}** — ${price} (${sale})`);
            if (gp.description) lines.push(`  ${gp.description}`);
          }
          if (data.nextPageToken) {
            lines.push("", `_More results available. Use page_token: \`${data.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Create Game Pass ─────────────────────────────────────────────────
  const CreateGamePassSchema = z.object({
    universe_id: universeIdSchema,
    display_name: z.string().min(1).max(100).describe("Game pass display name"),
    description: z.string().max(1000).default("").describe("Game pass description"),
    price_in_robux: z.number().int().min(0).optional().describe("Price in Robux (omit to create as not for sale)"),
    for_sale: z.boolean().default(false).describe("Whether the game pass is available for purchase"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_game_pass",
    {
      title: "Create Game Pass",
      description: `Create a new game pass (one-time purchase) for an experience.

Game passes grant permanent benefits that persist across sessions.
Common examples: VIP access, double XP, special abilities.

Requires API key scope: universe-game-passes:write`,
      inputSchema: CreateGamePassSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_game_pass", async (params: z.infer<typeof CreateGamePassSchema>) => {
      try {
        const url = GAME_PASSES_BASE(params.universe_id);
        const body: Record<string, unknown> = {
          displayName: params.display_name,
          description: params.description,
          forSale: params.for_sale,
        };
        if (params.price_in_robux !== undefined) body.priceInRobux = params.price_in_robux;

        const result = await makeApiRequest<GamePass>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Created game pass **"${result.displayName}"**` +
              (params.price_in_robux != null ? ` at R$${params.price_in_robux}` : "") +
              ` (${params.for_sale ? "for sale" : "not yet for sale"}).\n\nPath: ${result.path}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Developer Product ────────────────────────────────────────────
  const GetDevProductSchema = z.object({
    universe_id: universeIdSchema,
    developer_product_id: z
      .string()
      .regex(/^\d+$/, "Developer product ID must be a numeric string")
      .describe("The developer product ID"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_developer_product",
    {
      title: "Get Developer Product",
      description: `Get details of a single developer product by ID.

Returns display name, description, price, and metadata.

Requires API key scope: universe-developer-products:read`,
      inputSchema: GetDevProductSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_developer_product", async (params: z.infer<typeof GetDevProductSchema>) => {
      try {
        const url = `${DEVELOPER_PRODUCTS_BASE(params.universe_id)}/${params.developer_product_id}`;
        const product = await makeApiRequest<DeveloperProduct>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(product, null, 2) }], structuredContent: product };
        }

        return {
          content: [{
            type: "text" as const,
            text: [
              `# ${product.displayName}`,
              "",
              `**Price:** ${product.priceInRobux != null ? `R$${product.priceInRobux}` : "Free"}`,
              "",
              "## Description",
              product.description || "_No description_",
              "",
              `**Path:** ${product.path}`,
            ].join("\n"),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Developer Product ─────────────────────────────────────────
  const UpdateDevProductSchema = z.object({
    universe_id: universeIdSchema,
    developer_product_id: z
      .string()
      .regex(/^\d+$/, "Developer product ID must be a numeric string")
      .describe("The developer product ID to update"),
    display_name: z.string().min(1).max(100).optional().describe("New display name"),
    description: z.string().max(1000).optional().describe("New description"),
    price_in_robux: z.number().int().min(0).optional().describe("New price in Robux"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_developer_product",
    {
      title: "Update Developer Product",
      description: `Update an existing developer product's fields.

Only provided fields are updated — omitted fields remain unchanged.

⚠️ This modifies a live monetization item.

Requires API key scope: universe-developer-products:write`,
      inputSchema: UpdateDevProductSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_developer_product", async (params: z.infer<typeof UpdateDevProductSchema>) => {
      try {
        const url = `${DEVELOPER_PRODUCTS_BASE(params.universe_id)}/${params.developer_product_id}`;

        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];

        if (params.display_name !== undefined) { body.displayName = params.display_name; updateMask.push("displayName"); }
        if (params.description !== undefined) { body.description = params.description; updateMask.push("description"); }
        if (params.price_in_robux !== undefined) { body.priceInRobux = params.price_in_robux; updateMask.push("priceInRobux"); }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update. Provide at least one field to change." }] };
        }

        const result = await makeApiRequest<DeveloperProduct>(url, "PATCH", body, { updateMask: updateMask.join(",") });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated developer product **"${result.displayName}"**.\n\nFields changed: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Game Pass ────────────────────────────────────────────────────
  const GetGamePassSchema = z.object({
    universe_id: universeIdSchema,
    game_pass_id: z
      .string()
      .regex(/^\d+$/, "Game pass ID must be a numeric string")
      .describe("The game pass ID"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_game_pass",
    {
      title: "Get Game Pass",
      description: `Get details of a single game pass by ID.

Returns display name, description, price, and sale status.

Requires API key scope: universe-game-passes:read`,
      inputSchema: GetGamePassSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_game_pass", async (params: z.infer<typeof GetGamePassSchema>) => {
      try {
        const url = `${GAME_PASSES_BASE(params.universe_id)}/${params.game_pass_id}`;
        const gamePass = await makeApiRequest<GamePass>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(gamePass, null, 2) }], structuredContent: gamePass };
        }

        return {
          content: [{
            type: "text" as const,
            text: [
              `# ${gamePass.displayName}`,
              "",
              `**Price:** ${gamePass.priceInRobux != null ? `R$${gamePass.priceInRobux}` : "Not for sale"}`,
              `**For Sale:** ${gamePass.forSale ? "🟢 Yes" : "🔴 No"}`,
              "",
              "## Description",
              gamePass.description || "_No description_",
              "",
              `**Path:** ${gamePass.path}`,
            ].join("\n"),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Game Pass ─────────────────────────────────────────────────
  const UpdateGamePassSchema = z.object({
    universe_id: universeIdSchema,
    game_pass_id: z
      .string()
      .regex(/^\d+$/, "Game pass ID must be a numeric string")
      .describe("The game pass ID to update"),
    display_name: z.string().min(1).max(100).optional().describe("New display name"),
    description: z.string().max(1000).optional().describe("New description"),
    price_in_robux: z.number().int().min(0).optional().describe("New price in Robux"),
    for_sale: z.boolean().optional().describe("Whether the game pass is available for purchase"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_game_pass",
    {
      title: "Update Game Pass",
      description: `Update an existing game pass's fields.

Only provided fields are updated — omitted fields remain unchanged.
Use this to put a game pass on or off sale, change the price, or edit copy.

⚠️ This modifies a live monetization item.

Requires API key scope: universe-game-passes:write`,
      inputSchema: UpdateGamePassSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_game_pass", async (params: z.infer<typeof UpdateGamePassSchema>) => {
      try {
        const url = `${GAME_PASSES_BASE(params.universe_id)}/${params.game_pass_id}`;

        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];

        if (params.display_name !== undefined) { body.displayName = params.display_name; updateMask.push("displayName"); }
        if (params.description !== undefined) { body.description = params.description; updateMask.push("description"); }
        if (params.price_in_robux !== undefined) { body.priceInRobux = params.price_in_robux; updateMask.push("priceInRobux"); }
        if (params.for_sale !== undefined) { body.forSale = params.for_sale; updateMask.push("forSale"); }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update. Provide at least one field to change." }] };
        }

        const result = await makeApiRequest<GamePass>(url, "PATCH", body, { updateMask: updateMask.join(",") });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated game pass **"${result.displayName}"**.\n\nFields changed: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}
