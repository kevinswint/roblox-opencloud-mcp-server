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

// Creator Store Products (Cloud v2, separate from universe monetization)
export const CREATOR_STORE_PRODUCTS_BASE = `${CLOUD_V2_BASE_URL}/creator-store-products`;

// Configs API (GA March 10, 2026) — different hostname/path
export const CONFIGS_V1_BASE = `${OPEN_CLOUD_BASE_URL}/creator-configs-public-api/v1`;
export const CONFIGS_REPOSITORY_BASE = (universeId: string, repository: string) =>
  `${CONFIGS_V1_BASE}/configs/universes/${universeId}/repositories/${repository}`;

// Secrets (nested under Universes)
export const UNIVERSE_SECRETS_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/secrets`;

// Ordered Data Stores
export const ORDERED_DATA_STORES_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/ordered-data-stores`;

// Memory Stores
export const MEMORY_STORE_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/memory-store`;

// Assets v1
export const ASSETS_V1_BASE = `${OPEN_CLOUD_BASE_URL}/assets/v1/assets`;

// Messaging v2 — publish via universe sub-operation
export const MESSAGING_V2_PUBLISH = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}:publishMessage`;

// Groups v2
export const GROUPS_V2_BASE = `${CLOUD_V2_BASE_URL}/groups`;

// Users v2
export const USERS_V2_BASE = `${CLOUD_V2_BASE_URL}/users`;

// Notifications v2 (nested under users)
export const USER_NOTIFICATIONS_BASE = (userId: string) =>
  `${CLOUD_V2_BASE_URL}/users/${userId}/notifications`;

// User Restrictions (bans) — nested under universes + places
export const UNIVERSE_RESTRICTIONS_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/user-restrictions`;

export const PLACE_RESTRICTIONS_BASE = (universeId: string, placeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}/places/${placeId}/user-restrictions`;

// Generative AI (sub-operations on universes)
export const GENERATE_SPEECH_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}:generateSpeechAsset`;

export const TRANSLATE_TEXT_BASE = (universeId: string) =>
  `${CLOUD_V2_BASE_URL}/universes/${universeId}:translateText`;

// Legacy Badges
export const LEGACY_BADGES_BASE = `${OPEN_CLOUD_BASE_URL}/legacy-badges/v1`;

// Response limits
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const API_TIMEOUT_MS = 30000;
export const LUAU_EXECUTION_TIMEOUT_MS = 60000;
export const LUAU_POLL_INTERVAL_MS = 2000;
export const LUAU_MAX_POLL_ATTEMPTS = 30;
