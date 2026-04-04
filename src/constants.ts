/**
 * Roblox Open Cloud MCP Server — Constants
 */

// API base URLs
export const OPEN_CLOUD_BASE_URL = "https://apis.roblox.com";
export const CLOUD_V2_BASE_URL = `${OPEN_CLOUD_BASE_URL}/cloud/v2`;

// Specific API base paths
export const DATA_STORES_V2_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/data-stores`;

export const MESSAGING_V1_BASE = (universeId: string) =>
  `${OPEN_CLOUD_BASE_URL}/messaging-service/v1/universes/${universeId}`;

export const LUAU_EXECUTION_BASE = (universeId: string, placeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/places/${placeId}`;

export const UNIVERSES_V2_BASE = `${CLOUD_V2_BASE_URL}/universes`;

export const PLACES_V2_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/places`;

// Monetization APIs (separate from Cloud v2)
export const DEVELOPER_PRODUCTS_BASE = (universeId: string) =>
  `${OPEN_CLOUD_BASE_URL}/developer-products/v2/universes/${universeId}/developer-products`;

export const GAME_PASSES_BASE = (universeId: string) =>
  `${OPEN_CLOUD_BASE_URL}/game-passes/v1/universes/${universeId}/game-passes`;

// Response limits
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const API_TIMEOUT_MS = 30000;
export const LUAU_EXECUTION_TIMEOUT_MS = 60000;
export const LUAU_POLL_INTERVAL_MS = 2000;
export const LUAU_MAX_POLL_ATTEMPTS = 30;
