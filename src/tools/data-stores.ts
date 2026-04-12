/**
 * Data Store Tools
 *
 * CRUD operations on persistent data stores in Roblox experiences.
 * Uses the v2 Open Cloud Data Store APIs.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  universeIdSchema,
  responseFormatSchema,
  pageTokenSchema,
  pageSizeSchema,
} from "../schemas/common.js";
import { makeApiRequest, handleApiError, truncateResponse, formatTimestamp } from "../services/api-client.js";
import { DATA_STORES_V2_BASE } from "../constants.js";
import { DataStoreListResponse, DataStoreEntry, DataStoreEntryListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

export function registerDataStoreTools(server: McpServer): void {
  // ── List Data Stores ─────────────────────────────────────────────────
  const ListDataStoresSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    prefix: z.string().optional().describe("Filter data stores by name prefix"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_data_stores",
    {
      title: "List Data Stores",
      description: `List all data stores in a Roblox experience.

Returns the names of all data stores. Use this to discover what data exists before reading entries.

Args:
  - universe_id: Experience universe ID
  - page_size: Results per page (default 20)
  - page_token: Pagination token for next page
  - prefix: Filter by name prefix

Requires API key scope: universe-datastores.objects:list`,
      inputSchema: ListDataStoresSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_data_stores", async (params: z.infer<typeof ListDataStoresSchema>) => {
      try {
        const url = DATA_STORES_V2_BASE(params.universe_id);
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.prefix) {
          const safe = params.prefix.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          queryParams.filter = `id.startsWith("${safe}")`;
        }

        const data = await makeApiRequest<DataStoreListResponse>(url, "GET", undefined, queryParams);

        const output = {
          dataStores: data.dataStores || [],
          nextPageToken: data.nextPageToken,
          count: (data.dataStores || []).length,
        };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        const lines = [`# Data Stores in Universe ${params.universe_id}`, ""];
        if (output.dataStores.length === 0) {
          lines.push("No data stores found.");
        } else {
          for (const ds of output.dataStores) {
            lines.push(`- **${ds.name}**`);
          }
          if (output.nextPageToken) {
            lines.push("", `_More results available. Use page_token: \`${output.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Data Store Entries ──────────────────────────────────────────
  const ListEntriesSchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    prefix: z.string().optional().describe("Filter entries by key prefix"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_data_store_entries",
    {
      title: "List Data Store Entries",
      description: `List entries (keys) in a specific data store.

Returns entry keys with metadata. Use page_token for pagination on large stores.

Requires API key scope: universe-datastores.objects:list`,
      inputSchema: ListEntriesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_data_store_entries", async (params: z.infer<typeof ListEntriesSchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries`;
        const queryParams: Record<string, unknown> = {
          maxPageSize: params.page_size,
          scope: params.scope,
        };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.prefix) {
          const safe = params.prefix.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          queryParams.filter = `id.startsWith("${safe}")`;
        }

        const data = await makeApiRequest<DataStoreEntryListResponse>(url, "GET", undefined, queryParams);

        const output = {
          entries: data.dataStoreEntries || [],
          nextPageToken: data.nextPageToken,
          count: (data.dataStoreEntries || []).length,
        };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        const lines = [`# Entries in "${params.data_store_name}" (scope: ${params.scope})`, ""];
        if (output.entries.length === 0) {
          lines.push("No entries found.");
        } else {
          for (const entry of output.entries) {
            lines.push(`- **${entry.id || entry.path}** — revision: ${entry.revisionId || "N/A"}`);
          }
          if (output.nextPageToken) {
            lines.push("", `_More results available. Use page_token: \`${output.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Data Store Entry ─────────────────────────────────────────────
  const GetEntrySchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    entry_id: z.string().min(1).describe("The key/ID of the entry to read"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_data_store_entry",
    {
      title: "Get Data Store Entry",
      description: `Read a single entry from a data store by key.

Returns the stored value and metadata (revision, timestamps, users, custom metadata).

Requires API key scope: universe-datastores.objects:read`,
      inputSchema: GetEntrySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_data_store_entry", async (params: z.infer<typeof GetEntrySchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries/${encodeURIComponent(params.entry_id)}`;
        const queryParams = { scope: params.scope };

        const entry = await makeApiRequest<DataStoreEntry>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(entry, null, 2) }], structuredContent: entry };
        }

        const lines = [
          `# Data Store Entry: ${params.entry_id}`,
          "",
          `**Store:** ${params.data_store_name}`,
          `**Scope:** ${params.scope}`,
          `**Revision:** ${entry.revisionId || "N/A"}`,
          `**Created:** ${formatTimestamp(entry.createTime)}`,
          `**Updated:** ${formatTimestamp(entry.revisionCreateTime)}`,
          "",
          "## Value",
          "```json",
          JSON.stringify(entry.value, null, 2),
          "```",
        ];

        if (entry.users && entry.users.length > 0) {
          lines.push("", `**Associated Users:** ${entry.users.join(", ")}`);
        }
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
          lines.push("", "**Custom Metadata:**", "```json", JSON.stringify(entry.metadata, null, 2), "```");
        }

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Set Data Store Entry ─────────────────────────────────────────────
  const SetEntrySchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    entry_id: z.string().min(1).describe("The key/ID for the entry"),
    value: z.unknown().describe("The value to store (any JSON-serializable data)"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
    users: z.array(z.string()).optional().describe("User IDs to associate with this entry (for GDPR Right to Erasure)"),
    metadata: z.record(z.string()).optional().describe("Custom key-value metadata to attach"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_set_data_store_entry",
    {
      title: "Set Data Store Entry",
      description: `Create or update an entry in a data store.

Writes the provided value to the specified key. If the entry already exists, it is overwritten.
Associate user IDs for GDPR compliance (Right to Erasure).

⚠️ This is a WRITE operation — it modifies persistent game data.

Requires API key scope: universe-datastores.objects:write`,
      inputSchema: SetEntrySchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_set_data_store_entry", async (params: z.infer<typeof SetEntrySchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries/${encodeURIComponent(params.entry_id)}`;
        const queryParams = { scope: params.scope };

        const body: Record<string, unknown> = { value: params.value };
        if (params.users) body.users = params.users;
        if (params.metadata) body.metadata = params.metadata;

        const result = await makeApiRequest<DataStoreEntry>(url, "PATCH", body, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Entry **${params.entry_id}** written to "${params.data_store_name}".\n\n` +
              `**Revision:** ${result.revisionId || "N/A"}\n**Updated:** ${formatTimestamp(result.revisionCreateTime)}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Delete Data Store Entry ──────────────────────────────────────────
  const DeleteEntrySchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    entry_id: z.string().min(1).describe("The key/ID of the entry to delete"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
  }).strict();

  server.registerTool(
    "roblox_delete_data_store_entry",
    {
      title: "Delete Data Store Entry",
      description: `Delete an entry from a data store.

⚠️ This permanently removes the entry. This cannot be undone.

Requires API key scope: universe-datastores.objects:write`,
      inputSchema: DeleteEntrySchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_delete_data_store_entry", async (params: z.infer<typeof DeleteEntrySchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries/${encodeURIComponent(params.entry_id)}`;
        const queryParams = { scope: params.scope };

        await makeApiRequest<void>(url, "DELETE", undefined, queryParams);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Entry **${params.entry_id}** deleted from "${params.data_store_name}".`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Increment Data Store Entry ───────────────────────────────────────
  const IncrementEntrySchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    entry_id: z.string().min(1).describe("The key/ID of the entry to increment"),
    amount: z
      .number()
      .describe("Amount to add to the current value (use a negative number to decrement)"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
    users: z.array(z.string()).optional().describe("User IDs to associate with this entry (GDPR)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_increment_data_store_entry",
    {
      title: "Increment Data Store Entry",
      description: `Atomically add to (or subtract from) a numeric data store entry.

Useful for counters and currency balances where racing writes would
otherwise corrupt the value. Pass a negative \`amount\` to decrement.

⚠️ Writes. Creates the entry if it does not exist.

Requires API key scope: universe-datastores.objects:create, universe-datastores.objects:update`,
      inputSchema: IncrementEntrySchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_increment_data_store_entry", async (params: z.infer<typeof IncrementEntrySchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries/${encodeURIComponent(params.entry_id)}:increment`;
        const queryParams = { scope: params.scope };
        const body: Record<string, unknown> = { amount: params.amount };
        if (params.users) body.users = params.users;

        const result = await makeApiRequest<DataStoreEntry>(url, "POST", body, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Incremented **${params.entry_id}** by ${params.amount}. New value: ${JSON.stringify(result.value)}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Data Store Entry Revisions ──────────────────────────────────
  const ListRevisionsSchema = z.object({
    universe_id: universeIdSchema,
    data_store_name: z.string().min(1).describe("Name of the data store"),
    entry_id: z.string().min(1).describe("The key/ID of the entry"),
    scope: z.string().default("global").describe("Data store scope (default: 'global')"),
    start_time: z.string().optional().describe("RFC3339 start of revision window (e.g. 2024-01-01T00:00:00Z)"),
    end_time: z.string().optional().describe("RFC3339 end of revision window"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_data_store_entry_revisions",
    {
      title: "List Data Store Entry Revisions",
      description: `List prior revisions of a specific data store entry.

Useful for auditing or rolling back changes. Returns revision IDs plus
creation timestamps; fetch a specific revision with get_data_store_entry
and a revisionId filter.

Requires API key scope: universe-datastores.versions:list`,
      inputSchema: ListRevisionsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_data_store_entry_revisions", async (params: z.infer<typeof ListRevisionsSchema>) => {
      try {
        const base = DATA_STORES_V2_BASE(params.universe_id);
        const url = `${base}/${encodeURIComponent(params.data_store_name)}/entries/${encodeURIComponent(params.entry_id)}:listRevisions`;
        const queryParams: Record<string, unknown> = {
          scope: params.scope,
          maxPageSize: params.page_size,
        };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.start_time) queryParams.startTime = params.start_time;
        if (params.end_time) queryParams.endTime = params.end_time;

        const data = await makeApiRequest<DataStoreEntryListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const entries = data.dataStoreEntries || [];
        const lines = [`# Revisions for ${params.entry_id}`, ""];
        if (entries.length === 0) {
          lines.push("_No revisions found in the specified window._");
        } else {
          entries.forEach((e) => {
            lines.push(`- **${e.revisionId || "(no id)"}** — ${formatTimestamp(e.revisionCreateTime)}`);
          });
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
}
