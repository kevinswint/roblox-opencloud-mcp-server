/**
 * Ordered Data Stores Tools
 *
 * Sorted numeric data stores for leaderboards, rankings, etc. Entries are
 * scoped and sortable ascending/descending.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/universes/{id}/ordered-data-stores
 * API key scopes: universe.ordered-data-store.scope.entry:read,
 *                 universe.ordered-data-store.scope.entry:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  universeIdSchema,
  responseFormatSchema,
  pageSizeSchema,
  pageTokenSchema,
} from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { ORDERED_DATA_STORES_BASE } from "../constants.js";
import { OrderedDataStoreEntry, OrderedDataStoreEntryListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

const orderedDataStoreNameSchema = z
  .string()
  .min(1)
  .describe("Ordered data store name");

const scopeSchema = z
  .string()
  .default("global")
  .describe("Scope within the ordered data store (default: 'global')");

function entriesPath(universeId: string, storeName: string, scope: string): string {
  return `${ORDERED_DATA_STORES_BASE(universeId)}/${encodeURIComponent(storeName)}/scopes/${encodeURIComponent(scope)}/entries`;
}

function entryPath(universeId: string, storeName: string, scope: string, entryId: string): string {
  return `${entriesPath(universeId, storeName, scope)}/${encodeURIComponent(entryId)}`;
}

export function registerOrderedDataStoreTools(server: McpServer): void {
  // ── List Entries (Sorted) ─────────────────────────────────────────────
  const ListSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    order_by: z
      .enum(["ASC", "DESC"])
      .default("DESC")
      .describe("Sort order by value: DESC (highest first, default) or ASC"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_ordered_data_store_entries",
    {
      title: "List Ordered Data Store Entries (Sorted)",
      description: `List entries in an ordered data store, sorted by value.

Useful for leaderboards, rankings, and top-N queries. Defaults to descending
order (highest value first).

Requires API key scope: universe.ordered-data-store.scope.entry:read`,
      inputSchema: ListSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_ordered_data_store_entries", async (params: z.infer<typeof ListSchema>) => {
      try {
        const url = entriesPath(params.universe_id, params.ordered_data_store_name, params.scope);
        const queryParams: Record<string, unknown> = {
          maxPageSize: params.page_size,
          orderBy: params.order_by === "ASC" ? "value" : "value desc",
        };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<OrderedDataStoreEntryListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const entries = data.orderedDataStoreEntries || data.entries || [];
        const lines = [
          `# Ordered Data Store: ${params.ordered_data_store_name}`,
          `_Scope: ${params.scope} · Sort: ${params.order_by}_`,
          "",
        ];
        if (entries.length === 0) {
          lines.push("No entries found.");
        } else {
          entries.forEach((e, i) => lines.push(`${i + 1}. **${e.id || e.path.split("/").pop()}** — ${e.value}`));
          if (data.nextPageToken) {
            lines.push("", `_More results. Use page_token: \`${data.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Entry ─────────────────────────────────────────────────────────
  const GetSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    entry_id: z.string().min(1).describe("The entry ID (key) to read"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_ordered_data_store_entry",
    {
      title: "Get Ordered Data Store Entry",
      description: `Read a single numeric entry from an ordered data store.

Requires API key scope: universe.ordered-data-store.scope.entry:read`,
      inputSchema: GetSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_ordered_data_store_entry", async (params: z.infer<typeof GetSchema>) => {
      try {
        const url = entryPath(params.universe_id, params.ordered_data_store_name, params.scope, params.entry_id);
        const entry = await makeApiRequest<OrderedDataStoreEntry>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(entry, null, 2) }], structuredContent: entry };
        }

        return {
          content: [{
            type: "text" as const,
            text: `**${params.entry_id}** = ${entry.value}\n\n_Updated: ${formatTimestamp(entry.updateTime)}_`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Create Entry ──────────────────────────────────────────────────────
  const CreateSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    entry_id: z.string().min(1).describe("The entry ID (key) to create"),
    value: z.number().int().describe("Integer value to store (must be int64-compatible)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_ordered_data_store_entry",
    {
      title: "Create Ordered Data Store Entry",
      description: `Create a new entry in an ordered data store. Fails if the entry already exists.

Requires API key scope: universe.ordered-data-store.scope.entry:write`,
      inputSchema: CreateSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_ordered_data_store_entry", async (params: z.infer<typeof CreateSchema>) => {
      try {
        const url = entriesPath(params.universe_id, params.ordered_data_store_name, params.scope);
        const result = await makeApiRequest<OrderedDataStoreEntry>(
          url,
          "POST",
          { value: params.value },
          { id: params.entry_id }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Created entry **${params.entry_id}** = ${result.value} in ${params.ordered_data_store_name}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Entry ──────────────────────────────────────────────────────
  const UpdateSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    entry_id: z.string().min(1).describe("The entry ID (key) to update"),
    value: z.number().int().describe("New integer value"),
    allow_missing: z
      .boolean()
      .default(false)
      .describe("If true, creates the entry when it doesn't exist (upsert)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_ordered_data_store_entry",
    {
      title: "Update Ordered Data Store Entry",
      description: `Update an entry's numeric value. Set allow_missing=true to upsert (create if absent).

Requires API key scope: universe.ordered-data-store.scope.entry:write`,
      inputSchema: UpdateSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_ordered_data_store_entry", async (params: z.infer<typeof UpdateSchema>) => {
      try {
        const url = entryPath(params.universe_id, params.ordered_data_store_name, params.scope, params.entry_id);
        const result = await makeApiRequest<OrderedDataStoreEntry>(
          url,
          "PATCH",
          { value: params.value },
          { allowMissing: params.allow_missing }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Set **${params.entry_id}** = ${result.value}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Increment Entry ───────────────────────────────────────────────────
  const IncrementSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    entry_id: z.string().min(1).describe("The entry ID (key) to increment"),
    amount: z.number().int().describe("Integer amount to add (use negative to decrement)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_increment_ordered_data_store_entry",
    {
      title: "Increment Ordered Data Store Entry",
      description: `Atomically increment (or decrement) a numeric entry by a given amount.

Pass a negative amount to decrement. This is race-safe — two concurrent increments
will both apply.

Requires API key scope: universe.ordered-data-store.scope.entry:write`,
      inputSchema: IncrementSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_increment_ordered_data_store_entry", async (params: z.infer<typeof IncrementSchema>) => {
      try {
        const url = `${entryPath(params.universe_id, params.ordered_data_store_name, params.scope, params.entry_id)}:increment`;
        const result = await makeApiRequest<OrderedDataStoreEntry>(url, "POST", { amount: params.amount });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Incremented **${params.entry_id}** by ${params.amount} → now ${result.value}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Delete Entry ──────────────────────────────────────────────────────
  const DeleteSchema = z.object({
    universe_id: universeIdSchema,
    ordered_data_store_name: orderedDataStoreNameSchema,
    scope: scopeSchema,
    entry_id: z.string().min(1).describe("The entry ID (key) to delete"),
  }).strict();

  server.registerTool(
    "roblox_delete_ordered_data_store_entry",
    {
      title: "Delete Ordered Data Store Entry",
      description: `Delete an entry from an ordered data store. This is permanent.

Requires API key scope: universe.ordered-data-store.scope.entry:write`,
      inputSchema: DeleteSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_delete_ordered_data_store_entry", async (params: z.infer<typeof DeleteSchema>) => {
      try {
        const url = entryPath(params.universe_id, params.ordered_data_store_name, params.scope, params.entry_id);
        await makeApiRequest<void>(url, "DELETE");

        return {
          content: [{
            type: "text" as const,
            text: `✅ Deleted entry **${params.entry_id}** from ${params.ordered_data_store_name}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}
