/**
 * Creator Store Products Tools
 *
 * Manage Creator Store products — these are the marketplace items (asset bundles,
 * plugins, models, audio, meshes) that creators sell to other creators, NOT the
 * in-experience monetization surface (see monetization.ts for those).
 *
 * Base URL: https://apis.roblox.com/cloud/v2/creator-store-products
 * API key scopes: creator-store-product:read, creator-store-product:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp } from "../services/api-client.js";
import { CREATOR_STORE_PRODUCTS_BASE } from "../constants.js";
import { CreatorStoreProduct, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

function formatProductLines(product: CreatorStoreProduct): string[] {
  const lines: string[] = [];
  if (product.displayName) lines.push(`# ${product.displayName}`);
  lines.push("");
  if (product.productType) lines.push(`**Type:** ${product.productType}`);
  if (product.purchaseable !== undefined) lines.push(`**Purchasable:** ${product.purchaseable ? "Yes" : "No"}`);
  if (product.basePrice?.quantity) {
    const { significand, exponent } = product.basePrice.quantity;
    const price = significand * Math.pow(10, exponent);
    lines.push(`**Price:** ${price} ${product.basePrice.currencyCode}`);
  }
  if (product.assetId) lines.push(`**Asset ID:** ${product.assetId}`);
  if (product.description) {
    lines.push("", "## Description", product.description);
  }
  lines.push("", `**Path:** ${product.path}`);
  return lines;
}

export function registerCreatorStoreTools(server: McpServer): void {
  // ── Get Creator Store Product ─────────────────────────────────────────
  const GetProductSchema = z.object({
    creator_store_product_id: z
      .string()
      .min(1)
      .describe("The creator store product ID"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_creator_store_product",
    {
      title: "Get Creator Store Product",
      description: `Get details of a Creator Store product by ID.

Returns display name, type, price, description, and associated asset ID.

Requires API key scope: creator-store-product:read`,
      inputSchema: GetProductSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_creator_store_product", async (params: z.infer<typeof GetProductSchema>) => {
      try {
        const url = `${CREATOR_STORE_PRODUCTS_BASE}/${encodeURIComponent(params.creator_store_product_id)}`;
        const product = await makeApiRequest<CreatorStoreProduct>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(product, null, 2) }], structuredContent: product };
        }

        return { content: [{ type: "text" as const, text: formatProductLines(product).join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Creator Store Product ──────────────────────────────────────
  const UpdateProductSchema = z.object({
    creator_store_product_id: z
      .string()
      .min(1)
      .describe("The creator store product ID"),
    display_name: z.string().min(1).max(100).optional().describe("New display name"),
    description: z.string().max(1000).optional().describe("New description"),
    purchaseable: z.boolean().optional().describe("Whether the product is available for purchase"),
    price_significand: z.number().int().optional().describe("Price significand (paired with price_exponent; e.g. 299 with exponent -2 = 2.99)"),
    price_exponent: z.number().int().optional().describe("Price exponent (paired with price_significand)"),
    price_currency_code: z.string().length(3).optional().describe("ISO 4217 currency code (e.g. USD)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_creator_store_product",
    {
      title: "Update Creator Store Product",
      description: `Update a Creator Store product's metadata or price.

Only provided fields are updated — omitted fields remain unchanged.

⚠️ This modifies a live marketplace listing. Price changes affect new purchases immediately.

Requires API key scope: creator-store-product:write`,
      inputSchema: UpdateProductSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_creator_store_product", async (params: z.infer<typeof UpdateProductSchema>) => {
      try {
        const url = `${CREATOR_STORE_PRODUCTS_BASE}/${encodeURIComponent(params.creator_store_product_id)}`;

        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];

        if (params.display_name !== undefined) { body.displayName = params.display_name; updateMask.push("displayName"); }
        if (params.description !== undefined) { body.description = params.description; updateMask.push("description"); }
        if (params.purchaseable !== undefined) { body.purchaseable = params.purchaseable; updateMask.push("purchaseable"); }

        if (
          params.price_significand !== undefined ||
          params.price_exponent !== undefined ||
          params.price_currency_code !== undefined
        ) {
          if (
            params.price_significand === undefined ||
            params.price_exponent === undefined ||
            params.price_currency_code === undefined
          ) {
            return {
              content: [{
                type: "text" as const,
                text: "Error: To change price, supply all three of price_significand, price_exponent, and price_currency_code.",
              }],
            };
          }
          body.basePrice = {
            currencyCode: params.price_currency_code,
            quantity: { significand: params.price_significand, exponent: params.price_exponent },
          };
          updateMask.push("basePrice");
        }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update. Provide at least one field to change." }] };
        }

        const result = await makeApiRequest<CreatorStoreProduct>(
          url,
          "PATCH",
          body,
          { updateMask: updateMask.join(",") }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated creator store product **${result.displayName || params.creator_store_product_id}**.\n\nFields changed: ${updateMask.join(", ")}\n\n_Updated: ${formatTimestamp(result.updateTime as string | undefined)}_`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}
