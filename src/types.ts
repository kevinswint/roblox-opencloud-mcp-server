/**
 * Roblox Open Cloud MCP Server — Type Definitions
 */

// Response format enum for tool outputs
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// Luau Execution types
export interface LuauExecutionTask {
  [key: string]: unknown;
  path: string;
  createTime: string;
  updateTime: string;
  state: "PROCESSING" | "COMPLETE" | "FAILED" | "CANCELLED";
  script: string;
  output?: LuauExecutionOutput;
  error?: LuauExecutionError;
}

export interface LuauExecutionOutput {
  results: Array<{ type: string; value: unknown }>;
}

export interface LuauExecutionError {
  code: string;
  message: string;
}

// Data Store types
export interface DataStoreEntry {
  [key: string]: unknown;
  path: string;
  value: unknown;
  id?: string;
  createTime?: string;
  revisionId?: string;
  revisionCreateTime?: string;
  etag?: string;
  users?: string[];
  metadata?: Record<string, string>;
}

export interface DataStoreListResponse {
  dataStores: Array<{ name: string; createTime?: string }>;
  nextPageToken?: string;
}

export interface DataStoreEntryListResponse {
  dataStoreEntries: DataStoreEntry[];
  nextPageToken?: string;
}

// Universe/Place types
export interface Universe {
  [key: string]: unknown;
  path: string;
  createTime: string;
  updateTime: string;
  displayName: string;
  description: string;
  user?: string;
  group?: string;
  visibility: "PUBLIC" | "PRIVATE";
  facebookSocialLink?: string;
  twitterSocialLink?: string;
  youtubeSocialLink?: string;
  twitchSocialLink?: string;
  discordSocialLink?: string;
  robloxGroupSocialLink?: string;
  guildedSocialLink?: string;
  voiceChat: "ENABLED" | "DISABLED";
  ageRating?: string;
  desktopEnabled: boolean;
  mobileEnabled: boolean;
  tabletEnabled: boolean;
  consoleEnabled: boolean;
  vrEnabled: boolean;
}

export interface Place {
  [key: string]: unknown;
  path: string;
  createTime: string;
  updateTime: string;
  displayName: string;
  description: string;
  serverSize: number;
}

// Developer Product / Game Pass types
export interface DeveloperProduct {
  [key: string]: unknown;
  path: string;
  displayName: string;
  description: string;
  iconImageAssetId?: string;
  priceInRobux?: number;
}

export interface GamePass {
  [key: string]: unknown;
  path: string;
  displayName: string;
  description: string;
  iconImageAssetId?: string;
  priceInRobux?: number;
  forSale: boolean;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  nextPageToken?: string;
}

// Error types
export interface RobloxApiError {
  code: string;
  message: string;
  details?: unknown[];
}
