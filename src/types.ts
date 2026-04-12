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
  [key: string]: unknown;
  dataStores: Array<{ name: string; createTime?: string }>;
  nextPageToken?: string;
}

export interface DataStoreEntryListResponse {
  [key: string]: unknown;
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

// Creator Store
export interface CreatorStoreProduct {
  [key: string]: unknown;
  path: string;
  displayName?: string;
  description?: string;
  basePrice?: { currencyCode: string; quantity: { significand: number; exponent: number } };
  productType?: string;
  sellerId?: string;
  assetId?: string;
  purchaseable?: boolean;
}

// Config API
export interface ConfigVersion {
  [key: string]: unknown;
  path: string;
  etag?: string;
  createTime?: string;
  updateTime?: string;
  data?: Record<string, unknown>;
}

export interface ConfigRevisionListResponse {
  [key: string]: unknown;
  revisions: Array<{ path: string; createTime?: string; etag?: string }>;
  nextPageToken?: string;
}

// Secrets
export interface UniverseSecret {
  [key: string]: unknown;
  path?: string;
  id?: string;
  key_id?: string;
  domain?: string;
  createTime?: string;
  updateTime?: string;
}

export interface UniverseSecretListResponse {
  [key: string]: unknown;
  secrets: UniverseSecret[];
  nextPageToken?: string;
  cursor?: string;
}

// Ordered Data Stores
export interface OrderedDataStoreEntry {
  [key: string]: unknown;
  path: string;
  id?: string;
  value: number;
  createTime?: string;
  updateTime?: string;
}

export interface OrderedDataStoreEntryListResponse {
  [key: string]: unknown;
  orderedDataStoreEntries?: OrderedDataStoreEntry[];
  entries?: OrderedDataStoreEntry[];
  nextPageToken?: string;
}

// Memory Stores
export interface MemoryStoreQueueItem {
  [key: string]: unknown;
  id?: string;
  value: unknown;
  priority?: number;
  expiration?: string;
}

export interface MemoryStoreSortedMapItem {
  [key: string]: unknown;
  path: string;
  id?: string;
  value: unknown;
  sortKey?: number | string;
  expireTime?: string;
  etag?: string;
}

export interface MemoryStoreSortedMapListResponse {
  [key: string]: unknown;
  memoryStoreSortedMapItems?: MemoryStoreSortedMapItem[];
  items?: MemoryStoreSortedMapItem[];
  nextPageToken?: string;
}

// Assets
export interface Asset {
  [key: string]: unknown;
  path: string;
  revisionId?: string;
  revisionCreateTime?: string;
  assetId?: string;
  displayName?: string;
  description?: string;
  assetType?: string;
  creationContext?: { creator?: { userId?: string; groupId?: string } };
  moderationResult?: { moderationState?: string };
  state?: string;
}

export interface AssetOperation {
  [key: string]: unknown;
  path: string;
  done?: boolean;
  response?: Asset;
  error?: { code: string; message: string };
}

export interface AssetVersion {
  [key: string]: unknown;
  path: string;
  createTime?: string;
  creationContext?: { creator?: { userId?: string; groupId?: string } };
}

export interface AssetVersionListResponse {
  [key: string]: unknown;
  assetVersions?: AssetVersion[];
  nextPageToken?: string;
}

// Groups
export interface Group {
  [key: string]: unknown;
  path: string;
  id?: string;
  displayName?: string;
  description?: string;
  owner?: string;
  memberCount?: number;
  verified?: boolean;
  publicEntryAllowed?: boolean;
  locked?: boolean;
}

export interface GroupMembership {
  [key: string]: unknown;
  path: string;
  user?: string;
  role?: string;
  createTime?: string;
  updateTime?: string;
}

export interface GroupMembershipListResponse {
  [key: string]: unknown;
  groupMemberships?: GroupMembership[];
  nextPageToken?: string;
}

export interface GroupRole {
  [key: string]: unknown;
  path: string;
  id?: string;
  displayName?: string;
  description?: string;
  rank?: number;
  memberCount?: number;
  permissions?: Record<string, boolean>;
}

export interface GroupRoleListResponse {
  [key: string]: unknown;
  groupRoles?: GroupRole[];
  nextPageToken?: string;
}

export interface GroupJoinRequest {
  [key: string]: unknown;
  path: string;
  user?: string;
  createTime?: string;
}

export interface GroupJoinRequestListResponse {
  [key: string]: unknown;
  groupJoinRequests?: GroupJoinRequest[];
  nextPageToken?: string;
}

export interface GroupShout {
  [key: string]: unknown;
  path: string;
  content?: string;
  poster?: string;
  createTime?: string;
  updateTime?: string;
}

// Users
export interface User {
  [key: string]: unknown;
  path: string;
  id?: string;
  name?: string;
  displayName?: string;
  createTime?: string;
  about?: string;
  locale?: string;
  premium?: boolean;
  socialNetworkProfiles?: Record<string, string>;
}

export interface InventoryItem {
  [key: string]: unknown;
  path: string;
  assetDetails?: Record<string, unknown>;
  badgeDetails?: Record<string, unknown>;
  gamePassDetails?: Record<string, unknown>;
  privateServerDetails?: Record<string, unknown>;
  addTime?: string;
}

export interface InventoryItemListResponse {
  [key: string]: unknown;
  inventoryItems?: InventoryItem[];
  nextPageToken?: string;
}

// User Restrictions (bans)
export interface UserRestriction {
  [key: string]: unknown;
  path: string;
  user?: string;
  gameJoinRestriction?: {
    active?: boolean;
    startTime?: string;
    duration?: string;
    privateReason?: string;
    displayReason?: string;
    excludeAltAccounts?: boolean;
    inherited?: boolean;
  };
}

export interface UserRestrictionListResponse {
  [key: string]: unknown;
  userRestrictions?: UserRestriction[];
  nextPageToken?: string;
}

// Notifications
export interface UserNotification {
  [key: string]: unknown;
  path: string;
  source?: { universe: string };
  payload?: {
    type?: string;
    messageId?: string;
    parameters?: Record<string, { stringValue?: string }>;
    joinExperience?: { launchData?: string };
    analyticsData?: { category?: string };
  };
}

// Generative AI
export interface SpeechAssetOperation {
  [key: string]: unknown;
  path: string;
  done?: boolean;
  response?: { path: string; assetId?: string };
  error?: { code: string; message: string };
}

export interface TranslateTextResponse {
  [key: string]: unknown;
  translations?: Array<{
    targetLanguageCode: string;
    text: string;
  }>;
}

// Badges
export interface Badge {
  [key: string]: unknown;
  id?: number;
  name?: string;
  displayName?: string;
  description?: string;
  enabled?: boolean;
  iconImageId?: number;
  iconImageAssetId?: number;
  created?: string;
  updated?: string;
  statistics?: { pastDayAwardedCount?: number; awardedCount?: number; winRatePercentage?: number };
  awardingUniverse?: { id?: number; name?: string; rootPlaceId?: number };
}
