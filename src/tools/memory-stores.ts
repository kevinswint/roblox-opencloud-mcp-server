/**
 * Memory Stores Tools
 *
 * Ephemeral, low-latency state: queues (FIFO with invisibility windows) and
 * sorted maps (ordered key-value by sort-key). Useful for matchmaking queues,
 * short-lived session state, cross-server coordination, throttled counters.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/universes/{id}/memory-store
 * API key scopes: memory-store:flush,
 *                 memory-store.queue:add, memory-store.queue:dequeue, memory-store.queue:discard,
 *                 memory-store.sorted-map:read, memory-store.sorted-map:write
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
import { MEMORY_STORE_BASE } from "../constants.js";
import {
  MemoryStoreQueueItem,
  MemoryStoreSortedMapItem,
  MemoryStoreSortedMapListResponse,
  ResponseFormat,
} from "../types.js";
import { wrapTool } from "../services/logger.js";

// ── Schema fragments ──────────────────────────────────────────────────────

const queueNameSchema = z
  .string()
  .min(1)
  .describe("Queue name (arbitrary; scoped per universe)");

const sortedMapNameSchema = z
  .string()
  .min(1)
  .describe("Sorted map name (arbitrary; scoped per universe)");

const itemValueSchema = z
  .unknown()
  .describe("Item value — any JSON-serializable structure");

// ── Path builders ─────────────────────────────────────────────────────────

function queueItemsPath(universeId: string, queueName: string): string {
  return `${MEMORY_STORE_BASE(universeId)}/queues/${encodeURIComponent(queueName)}/items`;
}

function sortedMapItemsPath(universeId: string, mapName: string): string {
  return `${MEMORY_STORE_BASE(universeId)}/sorted-maps/${encodeURIComponent(mapName)}/items`;
}

function sortedMapItemPath(universeId: string, mapName: string, itemId: string): string {
  return `${sortedMapItemsPath(universeId, mapName)}/${encodeURIComponent(itemId)}`;
}

export function registerMemoryStoreTools(server: McpServer): void {
  // ── Queue: Add (Enqueue) ──────────────────────────────────────────────
  const QueueAddSchema = z.object({
    universe_id: universeIdSchema,
    queue_name: queueNameSchema,
    value: itemValueSchema,
    priority: z
      .number()
      .optional()
      .describe("Priority — higher priority items are dequeued first"),
    expiration: z
      .string()
      .optional()
      .describe("Expiration duration (e.g. '300s'). Item is dropped if not dequeued in time."),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_memory_store_queue_add",
    {
      title: "Memory Store Queue — Add Item",
      description: `Enqueue a single item to a memory store queue.

Items are visible to readers in FIFO order, optionally prioritized. Use expiration
to auto-drop stale entries.

Requires API key scope: memory-store.queue:add`,
      inputSchema: QueueAddSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_memory_store_queue_add", async (params: z.infer<typeof QueueAddSchema>) => {
      try {
        const url = queueItemsPath(params.universe_id, params.queue_name);
        const body: Record<string, unknown> = { data: params.value };
        if (params.priority !== undefined) body.priority = params.priority;
        if (params.expiration !== undefined) body.expiration = params.expiration;

        const result = await makeApiRequest<MemoryStoreQueueItem>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Added item to queue **${params.queue_name}**${result.id ? ` (id: ${result.id})` : ""}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Queue: Read (Dequeue) ─────────────────────────────────────────────
  const QueueReadSchema = z.object({
    universe_id: universeIdSchema,
    queue_name: queueNameSchema,
    count: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(1)
      .describe("How many items to read in one call (1-200)"),
    all_or_nothing: z
      .boolean()
      .default(false)
      .describe("If true, return nothing unless the full count is available"),
    invisibility_window: z
      .string()
      .optional()
      .describe("Duration (e.g. '30s') items are hidden from other readers; discard within this window or they reappear"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_memory_store_queue_read",
    {
      title: "Memory Store Queue — Read Items",
      description: `Read (dequeue) items from a memory store queue with an optional
invisibility window.

Items read with an invisibility_window are hidden from other readers for that
duration. Call queue_discard with the returned itemIds to permanently remove them;
otherwise they reappear after the window expires.

Requires API key scope: memory-store.queue:dequeue`,
      inputSchema: QueueReadSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_memory_store_queue_read", async (params: z.infer<typeof QueueReadSchema>) => {
      try {
        const url = `${queueItemsPath(params.universe_id, params.queue_name)}:read`;
        const queryParams: Record<string, unknown> = {
          count: params.count,
          allOrNothing: params.all_or_nothing,
        };
        if (params.invisibility_window !== undefined) queryParams.invisibilityWindow = params.invisibility_window;

        const data = await makeApiRequest<{ items?: MemoryStoreQueueItem[]; [key: string]: unknown }>(
          url,
          "GET",
          undefined,
          queryParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const items = data.items || [];
        const lines = [`# Read from queue: ${params.queue_name}`, ""];
        if (items.length === 0) {
          lines.push("_No items available._");
        } else {
          lines.push(`Received ${items.length} item(s):`, "");
          items.forEach((item, i) => {
            lines.push(`${i + 1}. **${item.id || "(no id)"}** — \`${JSON.stringify(item.value)}\``);
          });
          if (params.invisibility_window) {
            lines.push("", `_Items hidden for ${params.invisibility_window} — call queue_discard with the returned IDs to remove permanently._`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Queue: Discard ────────────────────────────────────────────────────
  const QueueDiscardSchema = z.object({
    universe_id: universeIdSchema,
    queue_name: queueNameSchema,
    item_ids: z
      .array(z.string().min(1))
      .min(1)
      .describe("Item IDs returned from queue_read that you want to permanently remove"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_memory_store_queue_discard",
    {
      title: "Memory Store Queue — Discard Items",
      description: `Permanently remove items previously read from a queue (with an invisibility window).

Call this after you've successfully processed the items. If you don't call discard
before the invisibility window expires, the items will reappear for another reader.

Requires API key scope: memory-store.queue:discard`,
      inputSchema: QueueDiscardSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_memory_store_queue_discard", async (params: z.infer<typeof QueueDiscardSchema>) => {
      try {
        const url = `${queueItemsPath(params.universe_id, params.queue_name)}:discard`;
        await makeApiRequest<void>(url, "POST", { itemIds: params.item_ids });

        return {
          content: [{
            type: "text" as const,
            text: `✅ Discarded ${params.item_ids.length} item(s) from queue **${params.queue_name}**.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Sorted Map: List Items ────────────────────────────────────────────
  const ListSortedMapSchema = z.object({
    universe_id: universeIdSchema,
    sorted_map_name: sortedMapNameSchema,
    order_by: z
      .enum(["ASC", "DESC"])
      .default("ASC")
      .describe("Sort order by sort key: ASC (default) or DESC"),
    filter: z
      .string()
      .optional()
      .describe("Optional filter expression (e.g. 'sortKey > 100' — Roblox filter syntax)"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_memory_store_sorted_map_items",
    {
      title: "List Memory Store Sorted Map Items",
      description: `List items in a memory store sorted map, sorted by sort key.

Supports filter expressions and bidirectional ordering.

Requires API key scope: memory-store.sorted-map:read`,
      inputSchema: ListSortedMapSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_memory_store_sorted_map_items", async (params: z.infer<typeof ListSortedMapSchema>) => {
      try {
        const url = sortedMapItemsPath(params.universe_id, params.sorted_map_name);
        const queryParams: Record<string, unknown> = {
          maxPageSize: params.page_size,
          orderBy: params.order_by === "DESC" ? "desc" : "asc",
        };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.filter) queryParams.filter = params.filter;

        const data = await makeApiRequest<MemoryStoreSortedMapListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const items = data.memoryStoreSortedMapItems || data.items || [];
        const lines = [
          `# Sorted Map: ${params.sorted_map_name}`,
          `_Order: ${params.order_by}${params.filter ? ` · Filter: ${params.filter}` : ""}_`,
          "",
        ];
        if (items.length === 0) {
          lines.push("No items found.");
        } else {
          items.forEach((item, i) => {
            const id = item.id || item.path.split("/").pop();
            const sortKeyStr = item.sortKey !== undefined ? ` (sortKey: ${item.sortKey})` : "";
            const expires = item.expireTime ? ` — expires ${formatTimestamp(item.expireTime)}` : "";
            lines.push(`${i + 1}. **${id}**${sortKeyStr}${expires}`);
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

  // ── Sorted Map: Get Item ──────────────────────────────────────────────
  const GetSortedMapItemSchema = z.object({
    universe_id: universeIdSchema,
    sorted_map_name: sortedMapNameSchema,
    item_id: z.string().min(1).describe("The item ID (key) to read"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_memory_store_sorted_map_item",
    {
      title: "Get Memory Store Sorted Map Item",
      description: `Read a single item from a memory store sorted map.

Requires API key scope: memory-store.sorted-map:read`,
      inputSchema: GetSortedMapItemSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_memory_store_sorted_map_item", async (params: z.infer<typeof GetSortedMapItemSchema>) => {
      try {
        const url = sortedMapItemPath(params.universe_id, params.sorted_map_name, params.item_id);
        const item = await makeApiRequest<MemoryStoreSortedMapItem>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(item, null, 2) }], structuredContent: item };
        }

        const lines = [
          `# ${params.item_id}`,
          "",
          `**Value:** \`${JSON.stringify(item.value)}\``,
        ];
        if (item.sortKey !== undefined) lines.push(`**Sort key:** ${item.sortKey}`);
        if (item.expireTime) lines.push(`**Expires:** ${formatTimestamp(item.expireTime)}`);
        if (item.etag) lines.push(`**ETag:** \`${item.etag}\``);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Sorted Map: Create Item ───────────────────────────────────────────
  const CreateSortedMapItemSchema = z.object({
    universe_id: universeIdSchema,
    sorted_map_name: sortedMapNameSchema,
    item_id: z.string().min(1).describe("The item ID (key) to create"),
    value: itemValueSchema,
    sort_key: z
      .union([z.number(), z.string()])
      .optional()
      .describe("Optional sort key (number or string); determines ordering"),
    expire_time: z
      .string()
      .optional()
      .describe("Optional absolute expire time (ISO 8601)"),
    ttl: z
      .string()
      .optional()
      .describe("Optional relative TTL duration (e.g. '300s'). Ignored if expire_time is set."),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_memory_store_sorted_map_item",
    {
      title: "Create Memory Store Sorted Map Item",
      description: `Create a new item in a memory store sorted map. Fails if the item already exists.

Use sort_key to control ordering. Provide either expire_time or ttl to set expiration.

Requires API key scope: memory-store.sorted-map:write`,
      inputSchema: CreateSortedMapItemSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_memory_store_sorted_map_item", async (params: z.infer<typeof CreateSortedMapItemSchema>) => {
      try {
        const url = sortedMapItemsPath(params.universe_id, params.sorted_map_name);
        const body: Record<string, unknown> = { value: params.value };
        if (params.sort_key !== undefined) body.sortKey = params.sort_key;
        if (params.expire_time !== undefined) body.expireTime = params.expire_time;
        else if (params.ttl !== undefined) body.ttl = params.ttl;

        const result = await makeApiRequest<MemoryStoreSortedMapItem>(
          url,
          "POST",
          body,
          { id: params.item_id }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Created item **${params.item_id}** in sorted map ${params.sorted_map_name}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Sorted Map: Update Item ───────────────────────────────────────────
  const UpdateSortedMapItemSchema = z.object({
    universe_id: universeIdSchema,
    sorted_map_name: sortedMapNameSchema,
    item_id: z.string().min(1).describe("The item ID (key) to update"),
    value: itemValueSchema.optional(),
    sort_key: z
      .union([z.number(), z.string()])
      .optional()
      .describe("New sort key"),
    expire_time: z
      .string()
      .optional()
      .describe("New absolute expire time (ISO 8601)"),
    ttl: z
      .string()
      .optional()
      .describe("New relative TTL (e.g. '300s'). Ignored if expire_time is set."),
    allow_missing: z
      .boolean()
      .default(false)
      .describe("If true, creates the item when it doesn't exist (upsert)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_memory_store_sorted_map_item",
    {
      title: "Update Memory Store Sorted Map Item",
      description: `Update an existing sorted map item's value, sort key, or expiration.
Set allow_missing=true to upsert.

Requires API key scope: memory-store.sorted-map:write`,
      inputSchema: UpdateSortedMapItemSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_memory_store_sorted_map_item", async (params: z.infer<typeof UpdateSortedMapItemSchema>) => {
      try {
        const url = sortedMapItemPath(params.universe_id, params.sorted_map_name, params.item_id);
        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];
        if (params.value !== undefined) { body.value = params.value; updateMask.push("value"); }
        if (params.sort_key !== undefined) { body.sortKey = params.sort_key; updateMask.push("sortKey"); }
        if (params.expire_time !== undefined) {
          body.expireTime = params.expire_time;
          updateMask.push("expireTime");
        } else if (params.ttl !== undefined) {
          body.ttl = params.ttl;
          updateMask.push("ttl");
        }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update." }] };
        }

        const queryParams: Record<string, unknown> = {
          updateMask: updateMask.join(","),
          allowMissing: params.allow_missing,
        };

        const result = await makeApiRequest<MemoryStoreSortedMapItem>(url, "PATCH", body, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated item **${params.item_id}** in sorted map ${params.sorted_map_name}. Fields: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Sorted Map: Delete Item ───────────────────────────────────────────
  const DeleteSortedMapItemSchema = z.object({
    universe_id: universeIdSchema,
    sorted_map_name: sortedMapNameSchema,
    item_id: z.string().min(1).describe("The item ID (key) to delete"),
  }).strict();

  server.registerTool(
    "roblox_delete_memory_store_sorted_map_item",
    {
      title: "Delete Memory Store Sorted Map Item",
      description: `Delete an item from a memory store sorted map.

Requires API key scope: memory-store.sorted-map:write`,
      inputSchema: DeleteSortedMapItemSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_delete_memory_store_sorted_map_item", async (params: z.infer<typeof DeleteSortedMapItemSchema>) => {
      try {
        const url = sortedMapItemPath(params.universe_id, params.sorted_map_name, params.item_id);
        await makeApiRequest<void>(url, "DELETE");

        return {
          content: [{
            type: "text" as const,
            text: `✅ Deleted item **${params.item_id}** from sorted map ${params.sorted_map_name}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Flush Memory Store ────────────────────────────────────────────────
  const FlushSchema = z.object({
    universe_id: universeIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_flush_memory_store",
    {
      title: "Flush Memory Store",
      description: `Flush ALL memory store data (queues and sorted maps) for a universe.

⚠️ This is destructive and affects all running game servers. Returns an operation ID
you can poll with get_memory_store_operation.

Requires API key scope: memory-store:flush`,
      inputSchema: FlushSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_flush_memory_store", async (params: z.infer<typeof FlushSchema>) => {
      try {
        const url = `${MEMORY_STORE_BASE(params.universe_id)}:flush`;
        const result = await makeApiRequest<Record<string, unknown>>(url, "POST", {});

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const path = typeof result.path === "string" ? result.path : "";
        const opId = path.split("/").pop() || "(unknown)";
        return {
          content: [{
            type: "text" as const,
            text: `✅ Flush initiated for universe ${params.universe_id}. Operation: \`${opId}\`\n\n_Poll with roblox_get_memory_store_operation to check status._`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Flush Operation ───────────────────────────────────────────────
  const GetOperationSchema = z.object({
    universe_id: universeIdSchema,
    operation_id: z.string().min(1).describe("The operation ID returned from flush_memory_store"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_memory_store_operation",
    {
      title: "Get Memory Store Flush Operation",
      description: `Check the status of a memory store flush operation.

Requires API key scope: memory-store:flush`,
      inputSchema: GetOperationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_memory_store_operation", async (params: z.infer<typeof GetOperationSchema>) => {
      try {
        const url = `${MEMORY_STORE_BASE(params.universe_id)}/operations/${encodeURIComponent(params.operation_id)}`;
        const result = await makeApiRequest<Record<string, unknown>>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const done = result.done === true;
        const hasError = result.error !== undefined;
        const status = hasError ? "❌ FAILED" : done ? "✅ DONE" : "⏳ IN PROGRESS";
        return {
          content: [{
            type: "text" as const,
            text: `# Flush operation: ${params.operation_id}\n\n**Status:** ${status}${hasError ? `\n\n\`\`\`json\n${JSON.stringify(result.error, null, 2)}\n\`\`\`` : ""}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}
