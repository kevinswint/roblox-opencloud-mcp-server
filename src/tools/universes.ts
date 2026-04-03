/**
 * Universe & Place Management Tools
 *
 * Read and manage Roblox experiences (universes) and their places.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, placeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp } from "../services/api-client.js";
import { UNIVERSES_V2_BASE, PLACES_V2_BASE } from "../constants.js";
import { Universe, Place, ResponseFormat } from "../types.js";

export function registerUniverseTools(server: McpServer): void {
  // ── Get Universe ─────────────────────────────────────────────────────
  const GetUniverseSchema = z.object({
    universe_id: universeIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_universe",
    {
      title: "Get Experience Details",
      description: `Get detailed information about a Roblox experience (universe).

Returns name, description, visibility, platform support, social links, voice chat status, and more.

Requires API key scope: universe:read`,
      inputSchema: GetUniverseSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: z.infer<typeof GetUniverseSchema>) => {
      try {
        const url = `${UNIVERSES_V2_BASE}/${params.universe_id}`;
        const universe = await makeApiRequest<Universe>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(universe, null, 2) }], structuredContent: universe };
        }

        const lines = [
          `# ${universe.displayName}`,
          "",
          `**Visibility:** ${universe.visibility}`,
          `**Created:** ${formatTimestamp(universe.createTime)}`,
          `**Updated:** ${formatTimestamp(universe.updateTime)}`,
          `**Voice Chat:** ${universe.voiceChat}`,
          "",
          "## Description",
          universe.description || "_No description_",
          "",
          "## Platform Support",
          `- Desktop: ${universe.desktopEnabled ? "✅" : "❌"}`,
          `- Mobile: ${universe.mobileEnabled ? "✅" : "❌"}`,
          `- Tablet: ${universe.tabletEnabled ? "✅" : "❌"}`,
          `- Console: ${universe.consoleEnabled ? "✅" : "❌"}`,
          `- VR: ${universe.vrEnabled ? "✅" : "❌"}`,
        ];

        const socials: string[] = [];
        if (universe.discordSocialLink) socials.push(`Discord: ${universe.discordSocialLink}`);
        if (universe.twitterSocialLink) socials.push(`Twitter: ${universe.twitterSocialLink}`);
        if (universe.youtubeSocialLink) socials.push(`YouTube: ${universe.youtubeSocialLink}`);
        if (universe.twitchSocialLink) socials.push(`Twitch: ${universe.twitchSocialLink}`);
        if (socials.length) {
          lines.push("", "## Social Links");
          socials.forEach((s) => lines.push(`- ${s}`));
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Universe ──────────────────────────────────────────────────
  const UpdateUniverseSchema = z.object({
    universe_id: universeIdSchema,
    display_name: z.string().optional().describe("New display name for the experience"),
    description: z.string().optional().describe("New description"),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional().describe("Set visibility"),
    desktop_enabled: z.boolean().optional().describe("Enable/disable desktop"),
    mobile_enabled: z.boolean().optional().describe("Enable/disable mobile"),
    tablet_enabled: z.boolean().optional().describe("Enable/disable tablet"),
    console_enabled: z.boolean().optional().describe("Enable/disable console"),
    vr_enabled: z.boolean().optional().describe("Enable/disable VR"),
    voice_chat: z.enum(["ENABLED", "DISABLED"]).optional().describe("Enable/disable voice chat"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_universe",
    {
      title: "Update Experience Settings",
      description: `Update settings for a Roblox experience (universe).

Only the fields you provide will be updated — omitted fields remain unchanged.

⚠️ This modifies your live experience configuration.

Requires API key scope: universe:write`,
      inputSchema: UpdateUniverseSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: z.infer<typeof UpdateUniverseSchema>) => {
      try {
        const url = `${UNIVERSES_V2_BASE}/${params.universe_id}`;

        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];

        if (params.display_name !== undefined) { body.displayName = params.display_name; updateMask.push("displayName"); }
        if (params.description !== undefined) { body.description = params.description; updateMask.push("description"); }
        if (params.visibility !== undefined) { body.visibility = params.visibility; updateMask.push("visibility"); }
        if (params.desktop_enabled !== undefined) { body.desktopEnabled = params.desktop_enabled; updateMask.push("desktopEnabled"); }
        if (params.mobile_enabled !== undefined) { body.mobileEnabled = params.mobile_enabled; updateMask.push("mobileEnabled"); }
        if (params.tablet_enabled !== undefined) { body.tabletEnabled = params.tablet_enabled; updateMask.push("tabletEnabled"); }
        if (params.console_enabled !== undefined) { body.consoleEnabled = params.console_enabled; updateMask.push("consoleEnabled"); }
        if (params.vr_enabled !== undefined) { body.vrEnabled = params.vr_enabled; updateMask.push("vrEnabled"); }
        if (params.voice_chat !== undefined) { body.voiceChat = params.voice_chat; updateMask.push("voiceChat"); }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update. Provide at least one field to change." }] };
        }

        const result = await makeApiRequest<Universe>(
          url, "PATCH", body,
          { updateMask: updateMask.join(",") }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated experience **${result.displayName}**.\n\nFields changed: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // ── Restart Experience Servers ───────────────────────────────────────
  const RestartServersSchema = z.object({
    universe_id: universeIdSchema,
  }).strict();

  server.registerTool(
    "roblox_restart_servers",
    {
      title: "Restart All Experience Servers",
      description: `Restart (shutdown) all running servers for an experience.

⚠️ This disconnects ALL players currently in the experience. Servers will respawn automatically
with the latest published version. Use this after deploying a new version or to resolve
server-wide issues.

Requires API key scope: universe:write`,
      inputSchema: RestartServersSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params: z.infer<typeof RestartServersSchema>) => {
      try {
        const url = `${UNIVERSES_V2_BASE}/${params.universe_id}:restartServers`;
        await makeApiRequest<void>(url, "POST");

        return {
          content: [{
            type: "text" as const,
            text: `✅ Server restart initiated for universe **${params.universe_id}**.\n\n` +
              "All running servers will shut down and restart with the latest published version. " +
              "Players will be temporarily disconnected.",
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Place ────────────────────────────────────────────────────────
  const GetPlaceSchema = z.object({
    universe_id: universeIdSchema,
    place_id: placeIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_place",
    {
      title: "Get Place Details",
      description: `Get details about a specific place within an experience.

Returns name, description, server size, and timestamps.

Requires API key scope: universe:read`,
      inputSchema: GetPlaceSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: z.infer<typeof GetPlaceSchema>) => {
      try {
        const url = `${PLACES_V2_BASE(params.universe_id)}/${params.place_id}`;
        const place = await makeApiRequest<Place>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(place, null, 2) }], structuredContent: place };
        }

        return {
          content: [{
            type: "text" as const,
            text: [
              `# ${place.displayName}`,
              "",
              `**Server Size:** ${place.serverSize} players`,
              `**Created:** ${formatTimestamp(place.createTime)}`,
              `**Updated:** ${formatTimestamp(place.updateTime)}`,
              "",
              "## Description",
              place.description || "_No description_",
            ].join("\n"),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // ── Update Place ─────────────────────────────────────────────────────
  const UpdatePlaceSchema = z.object({
    universe_id: universeIdSchema,
    place_id: placeIdSchema,
    display_name: z.string().optional().describe("New display name"),
    description: z.string().optional().describe("New description"),
    server_size: z.number().int().min(1).max(700).optional().describe("Max players per server (1-700)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_place",
    {
      title: "Update Place Settings",
      description: `Update settings for a place within an experience.

Only provided fields are updated. Omitted fields remain unchanged.

Requires API key scope: universe:write`,
      inputSchema: UpdatePlaceSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: z.infer<typeof UpdatePlaceSchema>) => {
      try {
        const url = `${PLACES_V2_BASE(params.universe_id)}/${params.place_id}`;
        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];

        if (params.display_name !== undefined) { body.displayName = params.display_name; updateMask.push("displayName"); }
        if (params.description !== undefined) { body.description = params.description; updateMask.push("description"); }
        if (params.server_size !== undefined) { body.serverSize = params.server_size; updateMask.push("serverSize"); }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update." }] };
        }

        const result = await makeApiRequest<Place>(url, "PATCH", body, { updateMask: updateMask.join(",") });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated place **${result.displayName}**.\n\nFields changed: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );
}
