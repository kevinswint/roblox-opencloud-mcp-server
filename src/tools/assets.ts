/**
 * Assets Tools
 *
 * Upload, fetch, update, and version-manage assets (decals, audio, models,
 * animations, meshes, plugins). Asset creation is async — the upload returns
 * an operation ID which must be polled with get_asset_operation until done.
 *
 * Base URL: https://apis.roblox.com/assets/v1/assets
 * API key scopes: asset:read, asset:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import FormData from "form-data";
import { responseFormatSchema, pageSizeSchema, pageTokenSchema } from "../schemas/common.js";
import {
  makeApiRequest,
  makeMultipartRequest,
  handleApiError,
  formatTimestamp,
  truncateResponse,
} from "../services/api-client.js";
import { ASSETS_V1_BASE, OPEN_CLOUD_BASE_URL, CLOUD_V2_BASE_URL } from "../constants.js";
import { Asset, AssetOperation, AssetVersion, AssetVersionListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

// ── Asset type + content-type helpers ─────────────────────────────────────

const ASSET_TYPES = [
  "Audio",
  "Decal",
  "Model",
  "Plugin",
  "Animation",
  "MeshPart",
  "Image",
  "Video",
  "Font",
] as const;

const assetTypeSchema = z
  .enum(ASSET_TYPES)
  .describe(`Asset type — one of: ${ASSET_TYPES.join(", ")}`);

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".bmp": "image/bmp",
    ".tga": "image/tga",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".fbx": "application/octet-stream",
    ".obj": "application/octet-stream",
    ".rbxm": "application/octet-stream",
    ".rbxmx": "application/octet-stream",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
  };
  return map[ext] || "application/octet-stream";
}

function readFileOrThrow(filePath: string): Buffer {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }
  return fs.readFileSync(absolute);
}

// ── Creator schema (user OR group) ────────────────────────────────────────

const creatorSchema = z
  .object({
    user_id: z.string().regex(/^\d+$/).optional(),
    group_id: z.string().regex(/^\d+$/).optional(),
  })
  .refine((v) => (v.user_id ? 1 : 0) + (v.group_id ? 1 : 0) === 1, {
    message: "Provide exactly one of user_id or group_id",
  })
  .describe("Creator identity — supply either user_id or group_id");

function creationContextFor(creator: { user_id?: string; group_id?: string }): Record<string, unknown> {
  const creatorObj: Record<string, string> = {};
  if (creator.user_id) creatorObj.userId = creator.user_id;
  if (creator.group_id) creatorObj.groupId = creator.group_id;
  return { creator: creatorObj };
}

export function registerAssetTools(server: McpServer): void {
  // ── Upload Asset ──────────────────────────────────────────────────────
  const UploadSchema = z.object({
    display_name: z.string().min(1).describe("Asset display name"),
    description: z.string().default("").describe("Asset description"),
    asset_type: assetTypeSchema,
    file_path: z.string().min(1).describe("Absolute path to the file to upload"),
    creator: creatorSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_upload_asset",
    {
      title: "Upload Asset",
      description: `Upload a new asset (decal, audio, model, animation, mesh, etc.) from a local file.

Returns an operation ID. The upload is async — poll with get_asset_operation until
done, then fetch the asset ID from the operation response.

⚠️ Roblox moderates uploaded assets. Audio, images, and models may be held in
'MODERATED' state for review before becoming usable in experiences.

Requires API key scope: asset:write`,
      inputSchema: UploadSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_upload_asset", async (params: z.infer<typeof UploadSchema>) => {
      try {
        const fileBuf = readFileOrThrow(params.file_path);
        const fileName = path.basename(params.file_path);
        const contentType = contentTypeForFile(params.file_path);

        const requestJson = {
          assetType: params.asset_type,
          displayName: params.display_name,
          description: params.description,
          creationContext: creationContextFor(params.creator),
        };

        const form = new FormData();
        form.append("request", JSON.stringify(requestJson), { contentType: "application/json" });
        form.append("fileContent", fileBuf, { filename: fileName, contentType });

        const result = await makeMultipartRequest<AssetOperation>(ASSETS_V1_BASE, form, "POST");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const opId = (result.path || "").split("/").pop() || "(unknown)";
        return {
          content: [{
            type: "text" as const,
            text: `✅ Upload started. Operation: \`${opId}\`\n\n_Poll with roblox_get_asset_operation to retrieve the asset ID._`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Asset ─────────────────────────────────────────────────────────
  const GetSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID to read"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_asset",
    {
      title: "Get Asset",
      description: `Fetch asset metadata by ID.

Returns display name, description, asset type, creator, moderation state, and
revision info.

Requires API key scope: asset:read`,
      inputSchema: GetSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_asset", async (params: z.infer<typeof GetSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}`;
        const asset = await makeApiRequest<Asset>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(asset, null, 2) }], structuredContent: asset };
        }

        const lines = [
          `# Asset ${params.asset_id}`,
          "",
          `**Name:** ${asset.displayName || "(unnamed)"}`,
          asset.description ? `**Description:** ${asset.description}` : "",
          asset.assetType ? `**Type:** ${asset.assetType}` : "",
          asset.state ? `**State:** ${asset.state}` : "",
          asset.moderationResult?.moderationState
            ? `**Moderation:** ${asset.moderationResult.moderationState}`
            : "",
          asset.revisionId ? `**Revision:** ${asset.revisionId}` : "",
          asset.revisionCreateTime ? `**Last revision:** ${formatTimestamp(asset.revisionCreateTime)}` : "",
        ].filter(Boolean);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Asset (metadata and/or file) ───────────────────────────────
  const UpdateSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID to update"),
    display_name: z.string().optional(),
    description: z.string().optional(),
    file_path: z.string().optional().describe("Optional new file to upload as new revision"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_asset",
    {
      title: "Update Asset",
      description: `Update asset metadata (display name, description) and/or upload a new
revision of the asset content.

If file_path is provided, the file is uploaded as a new revision. Content updates
are async and return an operation ID.

Requires API key scope: asset:write`,
      inputSchema: UpdateSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_asset", async (params: z.infer<typeof UpdateSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}`;
        const requestJson: Record<string, unknown> = {};
        const updateMask: string[] = [];
        if (params.display_name !== undefined) {
          requestJson.displayName = params.display_name;
          updateMask.push("displayName");
        }
        if (params.description !== undefined) {
          requestJson.description = params.description;
          updateMask.push("description");
        }
        if (updateMask.length === 0 && !params.file_path) {
          return { content: [{ type: "text" as const, text: "No fields or file to update." }] };
        }

        const form = new FormData();
        form.append("request", JSON.stringify(requestJson), { contentType: "application/json" });
        if (params.file_path) {
          const fileBuf = readFileOrThrow(params.file_path);
          const fileName = path.basename(params.file_path);
          const contentType = contentTypeForFile(params.file_path);
          form.append("fileContent", fileBuf, { filename: fileName, contentType });
        }

        const queryParams = updateMask.length > 0 ? { updateMask: updateMask.join(",") } : undefined;
        const result = await makeMultipartRequest<AssetOperation>(url, form, "PATCH", queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const opId = (result.path || "").split("/").pop() || "(unknown)";
        const summary = params.file_path
          ? `Updated metadata + new revision uploaded. Operation: \`${opId}\``
          : `Updated metadata: ${updateMask.join(", ")}`;
        return { content: [{ type: "text" as const, text: `✅ ${summary}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Asset Versions ───────────────────────────────────────────────
  const ListVersionsSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_asset_versions",
    {
      title: "List Asset Versions",
      description: `List all versions of an asset, newest first.

Requires API key scope: asset:read`,
      inputSchema: ListVersionsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_asset_versions", async (params: z.infer<typeof ListVersionsSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}/versions`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<AssetVersionListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const versions = data.assetVersions || [];
        const lines = [`# Versions of asset ${params.asset_id}`, ""];
        if (versions.length === 0) {
          lines.push("No versions found.");
        } else {
          versions.forEach((v, i) => {
            const versionId = v.path.split("/").pop();
            lines.push(`${i + 1}. **v${versionId}** — created ${formatTimestamp(v.createTime)}`);
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

  // ── Get Asset Version ─────────────────────────────────────────────────
  const GetVersionSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID"),
    version_number: z.string().min(1).describe("Version number"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_asset_version",
    {
      title: "Get Asset Version",
      description: `Fetch metadata for a specific asset version.

Requires API key scope: asset:read`,
      inputSchema: GetVersionSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_asset_version", async (params: z.infer<typeof GetVersionSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}/versions/${encodeURIComponent(params.version_number)}`;
        const version = await makeApiRequest<AssetVersion>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(version, null, 2) }], structuredContent: version };
        }

        return {
          content: [{
            type: "text" as const,
            text: `**Asset ${params.asset_id} v${params.version_number}**\n\nCreated: ${formatTimestamp(version.createTime)}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Rollback Asset Version ────────────────────────────────────────────
  const RollbackSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID"),
    version_number: z.string().min(1).describe("Version number to roll back to"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_rollback_asset_version",
    {
      title: "Rollback Asset to Previous Version",
      description: `Revert an asset to a previous version. Creates a new revision matching the
old one — doesn't delete newer revisions.

Requires API key scope: asset:write`,
      inputSchema: RollbackSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_rollback_asset_version", async (params: z.infer<typeof RollbackSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}/versions:rollback`;
        const body = {
          assetVersion: `assets/${params.asset_id}/versions/${params.version_number}`,
        };
        const result = await makeApiRequest<AssetVersion>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Asset ${params.asset_id} rolled back to v${params.version_number}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Archive Asset ─────────────────────────────────────────────────────
  const ArchiveSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID to archive"),
  }).strict();

  server.registerTool(
    "roblox_archive_asset",
    {
      title: "Archive Asset",
      description: `Archive an asset. Archived assets are hidden from the creator hub but
not permanently deleted. Use restore_asset to unarchive.

Requires API key scope: asset:write`,
      inputSchema: ArchiveSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_archive_asset", async (params: z.infer<typeof ArchiveSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}:archive`;
        await makeApiRequest<void>(url, "POST", {});

        return {
          content: [{
            type: "text" as const,
            text: `✅ Asset ${params.asset_id} archived.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Restore Asset ─────────────────────────────────────────────────────
  const RestoreSchema = z.object({
    asset_id: z.string().regex(/^\d+$/).describe("Asset ID to unarchive"),
  }).strict();

  server.registerTool(
    "roblox_restore_asset",
    {
      title: "Restore (Unarchive) Asset",
      description: `Unarchive an asset, making it visible again.

Requires API key scope: asset:write`,
      inputSchema: RestoreSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_restore_asset", async (params: z.infer<typeof RestoreSchema>) => {
      try {
        const url = `${ASSETS_V1_BASE}/${params.asset_id}:restore`;
        await makeApiRequest<void>(url, "POST", {});

        return {
          content: [{
            type: "text" as const,
            text: `✅ Asset ${params.asset_id} restored.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Asset Operation (Poll Upload) ─────────────────────────────────
  const GetOperationSchema = z.object({
    operation_id: z.string().min(1).describe("Operation ID returned from upload or update"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_asset_operation",
    {
      title: "Get Asset Operation (Poll Upload)",
      description: `Poll an asset upload or update operation to check status and retrieve
the final asset ID once done.

Requires API key scope: asset:read`,
      inputSchema: GetOperationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_asset_operation", async (params: z.infer<typeof GetOperationSchema>) => {
      try {
        const url = `${OPEN_CLOUD_BASE_URL}/assets/v1/operations/${encodeURIComponent(params.operation_id)}`;
        const op = await makeApiRequest<AssetOperation>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(op, null, 2) }], structuredContent: op };
        }

        if (op.error) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Operation failed: ${op.error.message}\n\nCode: ${op.error.code}`,
            }],
          };
        }
        if (!op.done) {
          return {
            content: [{ type: "text" as const, text: `⏳ Operation ${params.operation_id} is still in progress.` }],
          };
        }
        const asset = op.response;
        if (!asset) {
          return { content: [{ type: "text" as const, text: "✅ Operation complete (no response body)." }] };
        }
        const assetId = asset.assetId || asset.path?.split("/").pop();
        return {
          content: [{
            type: "text" as const,
            text: `✅ Operation complete.\n\n**Asset ID:** ${assetId}\n**Name:** ${asset.displayName || "(unnamed)"}\n**Moderation:** ${asset.moderationResult?.moderationState || "PENDING"}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get User Asset Quota ──────────────────────────────────────────────
  const GetQuotaSchema = z.object({
    user_id: z.string().regex(/^\d+$/).describe("User ID to look up quota for"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_user_asset_quota",
    {
      title: "Get User Asset Quota",
      description: `Fetch the current asset upload quota for a user.

Requires API key scope: asset:read`,
      inputSchema: GetQuotaSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_user_asset_quota", async (params: z.infer<typeof GetQuotaSchema>) => {
      try {
        const url = `${CLOUD_V2_BASE_URL}/users/${params.user_id}/asset-quotas`;
        const data = await makeApiRequest<Record<string, unknown>>(url, "GET");

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}
