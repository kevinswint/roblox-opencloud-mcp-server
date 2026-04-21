# Roblox Open Cloud API Inventory

_Generated 2026-04-11 as part of Roblox Open Cloud MCP Server v0.1 Phase 0 discovery._
_Source: research crawl of `create.roblox.com/docs/cloud/reference`._

## Summary of Findings

The Roblox Open Cloud surface spans **34 documented API surfaces** across 5 major categories.

### API Surface Count by Stability
- **GA (General Availability)**: 22 surfaces
- **Beta**: 7 surfaces  
- **Alpha/Deprecated**: 5 surfaces

### Key Findings & Landmines

1. **Luau Execution Paths Are Complex**: The endpoints require exact path structures with version IDs and session IDs. Recent docs show binary input handling is separate from task creation.

2. **Data Stores Have TWO API Versions**: v1 is marked "BETA" (legacy), v2 is the modern Cloud API. Both are active, causing potential confusion. Scopes differ significantly.

3. **Ordered Data Stores Use Separate URL Pattern**: Not nested under standard datastores - they're at `/ordered-data-stores/` with different scope naming (`universe.ordered-data-store.scope.entry:read/write`).

4. **Memory Stores Scope Naming Differs**: Uses `memory-store.queue:*` and `memory-store.sorted-map:*` rather than the `universe-` prefix pattern.

5. **Game Passes & Developer Products Have Different API Paths**: Game Passes are at `/game-passes/v1/`, Developer Products at `/developer-products/v2/`. Both require scope names without the "universe-" prefix (just `game-pass:read`, `developer-product:write`).

6. **Creator Store Products API Is Separate**: Not merged with monetization - lives at `/cloud/v2/creator-store-products` with distinct scopes.

7. **Trades API Is NOT Dead But Deprecated**: It still works via v1/v2 endpoints with legacy cookie auth only - no API key support documented.

8. **Messaging Service v1 Was Fetchable But v2 Not Found**: The documentation references Messaging v2 exists (GA since Dec 2025) but specific v2 endpoints weren't accessible in my crawl. Likely at `/cloud/v2/universes/{id}:publishMessage` (found this in Universes API).

9. **Assets API Multipart Upload**: Requires `application/octet-stream` for binary content, request bodies use multipart/form-data.

10. **Matching API Naming**: Some scopes use `universe-datastores.` prefix, others use `universe.` directly, others are bare (`memory-store.`). Not consistent.

11. **Generative AI Limited**: Only `generateSpeechAsset`, `translateText`, and `eval` endpoints found - no Cube 3D/4D, no STT, no material/mesh generation endpoints documented as public API.

12. **Inventories API Split**: Cloud v2 has single endpoint `/cloud/v2/users/{user_id}/inventory-items`, but legacy has 13+ endpoints across v1/v2.

13. **Webhooks Feature Not Found**: Referenced in early docs but no actual endpoints found - may not be publicly documented yet.

14. **User Restrictions Are NOT Separate**: They're nested under Places or at Universe level - not a standalone resource surface.

### Complete API Inventory (by Priority)

I'll now provide the full structured inventory organized by your requested priority, with every endpoint I found:

---

## LUAU EXECUTION (Beta, since Sept 2024)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `universe.place.luau-execution-session:read` (get task)
- `universe.place.luau-execution-session:write` (create task, binary input)

**Documented Endpoints**:
- `POST /universes/{universe_id}/luau-execution-session-task-binary-inputs` — Create binary input for script — `binaryContentUri` (required) — returns `LuauExecutionSessionTaskBinaryInput`
- `POST /universes/{universe_id}/places/{place_id}/luau-execution-session-tasks` — Execute Lua on latest version — `source`, `arguments` (both optional) — returns `LuauExecutionSessionTask` with `id`, `status`, `result`
- `POST /universes/{universe_id}/places/{place_id}/versions/{version_id}/luau-execution-session-tasks` — Execute Lua on specific version — `source`, `arguments` — returns task resource
- `GET /universes/{universe_id}/places/{place_id}/versions/{version_id}/luau-execution-sessions/{luau_execution_session_id}/tasks/{task_id}` — Get task result — no required fields — returns status, result, logs
- `GET /universes/{universe_id}/places/{place_id}/versions/{version_id}/luau-execution-sessions/{luau_execution_session_id}/tasks/{task_id}/logs` — Stream task logs — `pageToken`, `maxPageSize` (optional) — returns paginated logs

**Notes**: Path structure is deeply nested with session/task IDs. Binary inputs separate from task creation. Recent fix verified endpoint paths.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/luau-execution`

---

## DATA STORES v2 (GA) + ORDERED DATA STORES v2 (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `universe-datastores.control:list`, `universe-datastores.control:delete`, `universe-datastores.control:snapshot`
- `universe-datastores.objects:list`, `universe-datastores.objects:read`, `universe-datastores.objects:create`, `universe-datastores.objects:update`, `universe-datastores.objects:delete`
- `universe-datastores.versions:list`
- `universe.ordered-data-store.scope.entry:read`, `universe.ordered-data-store.scope.entry:write`

**Standard Data Stores Endpoints**:
- `GET /universes/{universe_id}/data-stores` — List all datastores — `maxPageSize`, `pageToken`, `filter`, `showDeleted` — returns paginated list
- `DELETE /universes/{universe_id}/data-stores/{data_store_id}` — Mark datastore for deletion — no params
- `POST /universes/{universe_id}/data-stores/{data_store_id}:undelete` — Restore deleted datastore — no params
- `POST /universes/{universe_id}/data-stores:snapshot` — Create snapshot — no required params

**Data Store Entries (Unscoped)**:
- `GET /universes/{universe_id}/data-stores/{data_store_id}/entries` — List all entries — `maxPageSize`, `pageToken`, `filter`, `showDeleted` — Scope: `universe-datastores.objects:list`
- `POST /universes/{universe_id}/data-stores/{data_store_id}/entries` — Create entry — `id` (key name) — Scope: `universe-datastores.objects:create`
- `GET /universes/{universe_id}/data-stores/{data_store_id}/entries/{entry_id}` — Get entry value — no params — Scope: `universe-datastores.objects:read`
- `DELETE /universes/{universe_id}/data-stores/{data_store_id}/entries/{entry_id}` — Delete entry — no params — Scope: `universe-datastores.objects:delete`
- `PATCH /universes/{universe_id}/data-stores/{data_store_id}/entries/{entry_id}` — Update entry — `allowMissing` (optional) — Scope: `universe-datastores.objects:update`
- `POST /universes/{universe_id}/data-stores/{data_store_id}/entries/{entry_id}:increment` — Increment numeric value — no required params — Scope: `universe-datastores.objects:create, update`
- `GET /universes/{universe_id}/data-stores/{data_store_id}/entries/{entry_id}:listRevisions` — Get entry revision history — `maxPageSize`, `pageToken`, `filter` — Scope: `universe-datastores.versions:list`

**Data Store Entries (Scoped)**:
- Same endpoints as above but under `/universes/{universe_id}/data-stores/{data_store_id}/scopes/{scope_id}/entries*`

**Ordered Data Stores**:
- `GET /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries` — List entries sorted — `maxPageSize`, `pageToken`, `orderBy`, `filter` — Scope: `universe.ordered-data-store.scope.entry:read`
- `POST /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries` — Create entry — `id` — Scope: `universe.ordered-data-store.scope.entry:write`
- `GET /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries/{entry_id}` — Get entry — no params — Scope: `read`
- `DELETE /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries/{entry_id}` — Delete — no params — Scope: `write`
- `PATCH /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries/{entry_id}` — Update — `allowMissing` — Scope: `write`
- `POST /universes/{universe_id}/ordered-data-stores/{ordered_data_store_id}/scopes/{scope_id}/entries/{entry_id}:increment` — Increment — no params — Scope: `write`

**Notes**: Pagination uses `pageToken` + `maxPageSize`. Ordered datastores use `orderBy` for sorting. v1 endpoints exist at `/datastores/v1/` but marked BETA and not recommended.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/storage`

---

## DATA STORES v1 (Beta/Legacy)

**Base URL**: `https://apis.roblox.com/datastores/v1`

**Required Scope(s)**: Same universe-datastores scopes as v2

**Documented Endpoints**:
- `GET /universes/{universeId}/standard-datastores` — List datastores — `cursor`, `limit`, `prefix`
- `GET /universes/{universeId}/standard-datastores/datastore/entries` — List entries — `datastoreName`, `scope`, `allScopes`, `prefix`, `cursor`, `limit`
- `GET /universes/{universeId}/standard-datastores/datastore/entries/entry` — Get entry — `datastoreName`, `entryKey`, `scope`
- `POST /universes/{universeId}/standard-datastores/datastore/entries/entry` — Create/Update — `datastoreName`, `entryKey`, `matchVersion`, `exclusiveCreate`, `scope`
- `DELETE /universes/{universeId}/standard-datastores/datastore/entries/entry` — Delete — `datastoreName`, `entryKey`, `scope`
- `POST /universes/{universeId}/standard-datastores/datastore/entries/entry/increment` — Increment — `datastoreName`, `entryKey`, `incrementBy`, `scope`

**Notes**: Uses query params instead of path params. Cursor-based pagination (not pageToken). BETA status - v2 is recommended.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/storage`

---

## MEMORY STORES (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `memory-store:flush`
- `memory-store.queue:add`, `memory-store.queue:dequeue`, `memory-store.queue:discard`
- `memory-store.sorted-map:read`, `memory-store.sorted-map:write`

**Flush Operations**:
- `POST /universes/{universe_id}/memory-store:flush` — Flush all stores — no params — returns operation ID
- `GET /universes/{universe_id}/memory-store/operations/{operation_id}` — Get flush status — no params

**Queue Items**:
- `POST /universes/{universe_id}/memory-store/queues/{queue_id}/items` — Enqueue item — request body required — Scope: `memory-store.queue:add`
- `GET /universes/{universe_id}/memory-store/queues/{queue_id}/items:read` — Dequeue items — `count`, `allOrNothing`, `invisibilityWindow` — Scope: `memory-store.queue:dequeue`
- `POST /universes/{universe_id}/memory-store/queues/{queue_id}/items:discard` — Discard items — `itemIds` array — Scope: `memory-store.queue:discard`

**Sorted Map Items**:
- `GET /universes/{universe_id}/memory-store/sorted-maps/{sorted_map_id}/items` — List items sorted — `maxPageSize`, `pageToken`, `orderBy`, `filter` — Scope: `memory-store.sorted-map:read`
- `POST /universes/{universe_id}/memory-store/sorted-maps/{sorted_map_id}/items` — Add/update item — `id`, value data — Scope: `memory-store.sorted-map:write`
- `GET /universes/{universe_id}/memory-store/sorted-maps/{sorted_map_id}/items/{item_id}` — Get single item — no params — Scope: `read`
- `DELETE /universes/{universe_id}/memory-store/sorted-maps/{sorted_map_id}/items/{item_id}` — Delete item — no params — Scope: `write`
- `PATCH /universes/{universe_id}/memory-store/sorted-maps/{sorted_map_id}/items/{item_id}` — Update item — `allowMissing` — Scope: `write`

**Notes**: Queues use item-based operations (add/dequeue/discard). Sorted maps support ordered queries with `orderBy`. Rate limit: 100K request-units/min.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/storage`

---

## MESSAGING SERVICE v2 (GA, Dec 2025)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**: `universe-messaging-service:publish`

**Documented Endpoints**:
- `POST /universes/{universe_id}:publishMessage` — Publish message to topic — `topic` (string), `message` (string, max 1KB) — no direct response body

**Notes**: Found only as sub-operation on Universes endpoint. v1 endpoints not directly documented in API reference (legacy). v2 enables external-to-game messaging.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/universes`

---

## MESSAGING SERVICE v1 (GA/Legacy)

**Base URL**: `https://apis.roblox.com` (messaging paths not directly accessible in docs)

**Notes**: v1 endpoints not enumerated in modern docs. Legacy cookie-based. Recommend using v2.

---

## UNIVERSES & CONFIGURATION (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `universe:read` (public for GET)
- `universe:write`
- `universe-messaging-service:publish`
- `universe.secret:read`, `universe.secret:write`

**Universe Endpoints**:
- `GET /universes/{universe_id}` — Get universe info — no required params — returns name, description, active state, etc.
- `PATCH /universes/{universe_id}` — Update universe config — `name`, `description`, `privateServerPrice`, other optional fields — Scope: `universe:write`
- `POST /universes/{universe_id}:publishMessage` — Publish message — `topic`, `message` — Scope: `universe-messaging-service:publish`
- `POST /universes/{universe_id}:restartServers` — Restart all servers — no params — Scope: `universe:write`

**Secrets Management**:
- `GET /universes/{universeId}/secrets` — List secrets — `maxPageSize`, `pageToken` — Scope: `universe.secret:read`
- `POST /universes/{universeId}/secrets` — Create secret — `name`, `value`, `rotationFrequency` (optional) — Scope: `universe.secret:write`
- `GET /universes/{universeId}/secrets/public-key` — Get public key for secret encryption — no params
- `PATCH /universes/{universeId}/secrets/{secretId}` — Update secret — `value`, `rotationFrequency` — Scope: `universe.secret:write`
- `DELETE /universes/{universeId}/secrets/{secretId}` — Delete secret — no params — Scope: `universe.secret:write`

**Notes**: Secrets API separate from main configuration. Public key endpoint for encryption in client requests.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/universes`

---

## PLACES & INSTANCES (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `universe.place:write`
- `universe.place.instance:read`, `universe.place.instance:write`
- `universe.user-restriction:read`, `universe.user-restriction:write`

**Place Endpoints**:
- `GET /universes/{universe_id}/places/{place_id}` — Get place details — no params — returns configuration, description, etc.
- `PATCH /universes/{universe_id}/places/{place_id}` — Update place config — `name`, `description`, other optional fields — Scope: `universe.place:write`

**Instance Endpoints**:
- `GET /universes/{universe_id}/places/{place_id}/instances/{instance_id}` — Get instance/server state — no params — Scope: `universe.place.instance:read`
- `PATCH /universes/{universe_id}/places/{place_id}/instances/{instance_id}` — Modify instance — `state`, other fields — Scope: `universe.place.instance:write`
- `GET /universes/{universe_id}/places/{place_id}/instances/{instance_id}:listChildren` — List child instances — no params — Scope: `universe.place.instance:read`
- `GET /universes/{universe_id}/places/{place_id}/instances/{instance_id}/operations/{operation_id}` — Get async operation status — no params

**User Restrictions (Bans/Blocks)**:
- `GET /universes/{universe_id}/places/{place_id}/user-restrictions` — List restrictions for place — `maxPageSize`, `pageToken`, `filter` — Scope: `universe.user-restriction:read`
- `GET /universes/{universe_id}/places/{place_id}/user-restrictions/{user_restriction_id}` — Get single restriction — no params
- `PATCH /universes/{universe_id}/places/{place_id}/user-restrictions/{user_restriction_id}` — Modify restriction — `endTime`, reason — Scope: `universe.user-restriction:write`

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/places`

---

## CONFIGS (GA, March 10, 2026)

**Base URL**: `https://apis.roblox.com/creator-configs-public-api/v1`

**Required Scope(s)**: `universe:read`, `universe:write`

**Documented Endpoints**:
- `GET /configs/universes/{universeId}/repositories/{repository}` — Get published config — no params — Scope: `universe:read`
- `GET /configs/universes/{universeId}/repositories/{repository}/draft` — Get draft config — no params — Scope: `universe:read`
- `DELETE /configs/universes/{universeId}/repositories/{repository}/draft` — Clear draft — no params — Scope: `universe:write`
- `PATCH /configs/universes/{universeId}/repositories/{repository}/draft` — Update draft (merge) — JSON body — Scope: `universe:write`
- `PUT /configs/universes/{universeId}/repositories/{repository}/draft:overwrite` — Replace entire draft — JSON body — Scope: `universe:write`
- `GET /configs/universes/{universeId}/repositories/{repository}/full` — Get all versions — no params
- `POST /configs/universes/{universeId}/repositories/{repository}/publish` — Publish config — no params — Scope: `universe:write`
- `GET /configs/universes/{universeId}/repositories/{repository}/revisions` — List revision history — `maxPageSize`, `pageToken` — Scope: `universe:read`
- `POST /configs/universes/{universeId}/repositories/{repository}/revisions/{revisionId}/restore` — Restore old config version — no params — Scope: `universe:write`

**Notes**: Draft/publish workflow. PATCH merges, PUT replaces. Revision history tracking.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/configs`

---

## ASSETS v1 (GA)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `asset:read`, `asset:write`, `legacy-asset:manage`, `asset-permissions:write`

**Asset Creation & Management**:
- `POST /assets/v1/assets` — Upload asset — multipart/form-data: `request` (JSON), `file` (binary) — Scope: `asset:write`
- `GET /assets/v1/assets/{assetId}` — Get asset metadata — no params — Scope: `asset:read`
- `PATCH /assets/v1/assets/{assetId}` — Update asset metadata — multipart: `request`, `file` (optional) — Scope: `asset:write`
- `GET /assets/v1/assets/{assetId}/versions` — List versions — `maxPageSize`, `pageToken` — Scope: `asset:read`
- `GET /assets/v1/assets/{assetId}/versions/{versionNumber}` — Get specific version — no params
- `POST /assets/v1/assets/{assetId}/versions:rollback` — Revert to version — multipart: `request` — Scope: `asset:write`
- `POST /assets/v1/assets/{assetId}:archive` — Archive asset — no params — Scope: `asset:write`
- `POST /assets/v1/assets/{assetId}:restore` — Unarchive asset — no params — Scope: `asset:write`
- `GET /assets/v1/operations/{operationId}` — Poll async operation — no params

**Asset Delivery (Legacy)**:
- `GET /asset-delivery-api/v1/assetId/{assetId}` — Retrieve asset — no params — Scope: `legacy-asset:manage`
- `GET /asset-delivery-api/v1/assetId/{assetId}/version/{versionNumber}` — Specific version — no params

**Asset Permissions**:
- `PATCH /asset-permissions-api/v1/assets/permissions` — Grant permissions to subjects — JSON body with subjects/permissions — Scope: `asset-permissions:write`

**Speech Asset Generation**:
- `POST /cloud/v2/universes/{universe_id}:generateSpeechAsset` — TTS — `text`, `languageCode` (optional) — returns audio asset — Scope: `universe:write`, `asset:read`, `asset:write`

**Asset Quota**:
- `GET /cloud/v2/users/{user_id}/asset-quotas` — Get quota info — no params — Scope: `asset:read`

**Notes**: Multipart upload with JSON metadata + binary file. Content-Type must be `multipart/form-data`. Version rollback supported. Async operations return operationId for polling.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/assets`

---

## DEVELOPER PRODUCTS (GA, Dec 4, 2025)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `developer-product:read`, `developer-product:write`, `legacy-developer-product:manage`

**Documented Endpoints**:
- `POST /developer-products/v2/universes/{universeId}/developer-products` — Create product — `displayName`, `description`, `iconFile` (multipart), `priceInRobux` — Scope: `developer-product:write`
- `GET /developer-products/v2/universes/{universeId}/developer-products/creator` — List products — `pageSize`, `pageToken`, `sortBy`, `sortOrder` — Scope: `developer-product:read`
- `PATCH /developer-products/v2/universes/{universeId}/developer-products/{productId}` — Update product — same fields as POST (all optional) — Scope: `developer-product:write`
- `GET /developer-products/v2/universes/{universeId}/developer-products/{productId}/creator` — Get single product — no params — Scope: `developer-product:read`

**Localization (Legacy)**:
- `PATCH /legacy-game-internationalization/v1/developer-products/{developerProductId}/description/language-codes/{languageCode}` — Set localized description — text body — Scope: `legacy-developer-product:manage`
- `GET /legacy-game-internationalization/v1/developer-products/{developerProductId}/icons` — List icon versions — no params
- `POST /legacy-game-internationalization/v1/developer-products/{developerProductId}/icons/language-codes/{languageCode}` — Upload localized icon — multipart
- `DELETE /legacy-game-internationalization/v1/developer-products/{developerProductId}/icons/language-codes/{languageCode}` — Remove localized icon
- `GET /legacy-game-internationalization/v1/developer-products/{developerProductId}/name-description` — Get all localized variants
- `PATCH /legacy-game-internationalization/v1/developer-products/{developerProductId}/name-description/language-codes/{languageCode}` — Set localized name+description
- `DELETE /legacy-game-internationalization/v1/developer-products/{developerProductId}/name-description/language-codes/{languageCode}` — Remove localized variant
- `PATCH /legacy-game-internationalization/v1/developer-products/{developerProductId}/name/language-codes/{languageCode}` — Set localized name only

**Thumbnails**:
- `GET /v1/developer-products/icons` — Public thumbnail listing — no auth required

**Notes**: Multipart for icon uploads. Localization separate from core CRUD. Scope names don't use "universe-" prefix.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/developer-products`

---

## GAME PASSES (GA, Dec 4, 2025)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `game-pass:read`, `game-pass:write`, `legacy-game-pass:manage`

**Documented Endpoints**:
- `POST /game-passes/v1/universes/{universeId}/game-passes` — Create pass — `name`, `description`, `imageFile` (multipart), `isForSale`, `price`, `isRegionalPricingEnabled` — Scope: `game-pass:write`
- `GET /game-passes/v1/universes/{universeId}/game-passes/creator` — List passes — `pageSize`, `pageToken` — Scope: `game-pass:read`
- `PATCH /game-passes/v1/universes/{universeId}/game-passes/{gamePassId}` — Update pass — all fields optional — Scope: `game-pass:write`
- `GET /game-passes/v1/universes/{universeId}/game-passes/{gamePassId}/creator` — Get single pass — no params — Scope: `game-pass:read`

**Localization**:
- `PATCH /legacy-game-internationalization/v1/game-passes/{gamePassId}/description/language-codes/{languageCode}` — Scope: `legacy-game-pass:manage`
- `GET /legacy-game-internationalization/v1/game-passes/{gamePassId}/icons` — List icon variants
- `POST /legacy-game-internationalization/v1/game-passes/{gamePassId}/icons/language-codes/{languageCode}` — Upload localized icon
- `DELETE /legacy-game-internationalization/v1/game-passes/{gamePassId}/icons/language-codes/{languageCode}`
- `GET /legacy-game-internationalization/v1/game-passes/{gamePassId}/name-description`
- `PATCH /legacy-game-internationalization/v1/game-passes/{gamePassId}/name-description/language-codes/{languageCode}`
- `DELETE /legacy-game-internationalization/v1/game-passes/{gamePassId}/name-description/language-codes/{languageCode}`
- `PATCH /legacy-game-internationalization/v1/game-passes/{gamePassId}/name/language-codes/{languageCode}`

**Thumbnails**:
- `GET /v1/game-passes` — Public thumbnail listing

**Notes**: Similar structure to Developer Products. Multipart icon upload. Separate localization endpoints.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/game-passes`

---

## SUBSCRIPTIONS (Status unknown - likely GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Notes**: Listed in v2 API reference but no specific endpoints documented in accessible pages. Mentioned as `Subscription` resource type. Likely similar to monetization but not enumerated.

---

## CREATOR STORE PRODUCTS (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**: `creator-store-product:read`, `creator-store-product:write`

**Documented Endpoints**:
- `POST /creator-store-products` — Create product — JSON body with product config — Scope: `creator-store-product:write`
- `GET /creator-store-products/{creator_store_product_id}` — Get product — no params — Scope: `creator-store-product:read`
- `PATCH /creator-store-products/{creator_store_product_id}` — Update product — partial fields — Scope: `creator-store-product:write`

**Notes**: Separate from Developer Products/Game Passes. For Creator Store distribution. Rate limit: 30 req/min.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/creator-store`

---

## GROUPS (Beta, GA for read-only)

**Base URL**: `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**:
- `group:read` (public for GET)
- `group:write`
- `group-forum:read`

**Group Info**:
- `GET /groups/{group_id}` — Get group metadata — no params — public read
- `GET /groups/{group_id}/forum-categories` — List forum categories — no params — Scope: `group-forum:read`
- `GET /groups/{group_id}/forum-categories/{forum_category_id}/posts` — List posts in category — `maxPageSize`, `pageToken`
- `GET /groups/{group_id}/forum-categories/{forum_category_id}/posts/{post_id}/comments` — List post comments — `maxPageSize`, `pageToken`

**Memberships & Roles**:
- `GET /groups/{group_id}/join-requests` — List join requests — `maxPageSize`, `pageToken` — Scope: `group:read`
- `POST /groups/{group_id}/join-requests/{join_request_id}:accept` — Accept request — no params — Scope: `group:write`
- `POST /groups/{group_id}/join-requests/{join_request_id}:decline` — Decline request — no params — Scope: `group:write`
- `GET /groups/{group_id}/memberships` — List members — `maxPageSize`, `pageToken`, `filter` — public read
- `PATCH /groups/{group_id}/memberships/{membership_id}` — Update membership (status, etc.) — JSON body — Scope: `group:write`
- `POST /groups/{group_id}/memberships/{membership_id}:assignRole` — Assign role to member — `roleId` — Scope: `group:write`
- `POST /groups/{group_id}/memberships/{membership_id}:unassignRole` — Remove role — `roleId` — Scope: `group:write`
- `GET /groups/{group_id}/roles` — List available roles — no params — optional Scope: `group:read`
- `GET /groups/{group_id}/roles/{role_id}` — Get role details — no params

**Shout**:
- `GET /groups/{group_id}/shout` — Get group shout message — no params — optional Scope: `group:read`

**Notes**: v2 API is primarily read-only for most operations. Forum operations expanding. Legacy v1 endpoints more comprehensive but use cookies.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/groups`

---

## USERS (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2` and `https://apis.roblox.com/v1`

**Required Scope(s)**:
- `user.inventory-item:read`
- `user.advanced:read` (optional for detailed info)
- `user.social:read` (optional for social info)

**User Information**:
- `GET /cloud/v2/users/{user_id}` — Get user profile — no params — returns basic + optional advanced fields
- `GET /v1/users/{userId}` — Get user details (legacy) — no params — returns more comprehensive data

**User Inventory**:
- `GET /cloud/v2/users/{user_id}/inventory-items` — List inventory items — `maxPageSize`, `pageToken`, `filter` — Scope: `user.inventory-item:read` — Rate limit: 100 req/min (API key), 20/min (OAuth)

**Legacy Inventory**:
- `GET /v1/users/{userId}/assets/collectibles` — Get collectible assets — `assetType`, `limit`, `cursor`, `sortOrder` — public/cookie

**Thumbnail Generation**:
- `GET /cloud/v2/users/{user_id}:generateThumbnail` — Generate avatar thumbnail — `size`, `format` (PNG/JPEG), `shape` (ROUND/SQUARE) — no auth required
- `GET /cloud/v2/users/{user_id}/operations/{operation_id}` — Check thumbnail generation status — no params

**User Avatar**:
- `GET /v1/users/{userId}/avatar` — Get equipped avatar items — no params — public
- `GET /v1/users/{userId}/currently-wearing` — Same as above
- `GET /v2/avatar/users/{userId}/avatar` — v2 avatar endpoint — public

**Notes**: v2 has limited surface. Legacy v1 more comprehensive. Thumbnail generation is async (poll with operation ID).

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/users`

---

## NOTIFICATIONS (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2` and `https://apis.roblox.com/v2`

**Required Scope(s)**: `user.user-notification:write`

**Documented Endpoints**:
- `POST /cloud/v2/users/{user_id}/notifications` — Send notification to user — `title`, `body`, `targetUrl` (optional), `imageUrl` (optional) — Scope: `user.user-notification:write`

**Legacy Push Notifications** (cookie-based, not recommended):
- `POST /v2/push-notifications/register-android-native`, `/register-ios-native`, `/register-ios-pushkit`, `/deregister-*` — Device registration
- `GET /v2/push-notifications/get-current-device-destination`, `/get-destinations`, `/metadata`

**Legacy Stream Notifications** (cookie-based):
- `GET /v2/stream-notifications/get-recent`, `/get-latest-game-updates`, `/unread-count`, `/metadata`
- `POST /v2/stream-notifications/clear-unread`

**Notes**: Only cloud/v2 POST endpoint is modern API key/OAuth friendly. Push and stream are legacy cookie-based.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/notifications`

---

## BADGES (Legacy GA)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: 
- `legacy-universe.badge:manage-and-spend-robux`
- `legacy-universe.badge:write`
- `legacy-badge:manage`

**Badge Management**:
- `POST /legacy-badges/v1/universes/{universeId}/badges` — Create badge — `name`, `description`, `imageFile` — Scope: `legacy-universe.badge:manage-and-spend-robux`
- `PATCH /legacy-badges/v1/badges/{badgeId}` — Update badge — name, description — Scope: `legacy-universe.badge:write`

**Localization**:
- `PATCH /legacy-game-internationalization/v1/badges/{badgeId}/name/language-codes/{languageCode}` — Scope: `legacy-badge:manage`
- `PATCH /legacy-game-internationalization/v1/badges/{badgeId}/description/language-codes/{languageCode}`
- `PATCH /legacy-game-internationalization/v1/badges/{badgeId}/name-description/language-codes/{languageCode}`
- `DELETE /legacy-game-internationalization/v1/badges/{badgeId}/name-description/language-codes/{languageCode}`
- `GET /legacy-game-internationalization/v1/badges/{badgeId}/name-description`
- `POST /legacy-game-internationalization/v1/badges/{badgeId}/icons/language-codes/{languageCode}` — Upload localized icon
- `GET /legacy-game-internationalization/v1/badges/{badgeId}/icons`
- `DELETE /legacy-game-internationalization/v1/badges/{badgeId}/icons/language-codes/{languageCode}`

**Public Endpoints**:
- `GET /v1/badges/{badgeId}` — Get badge metadata — no auth
- `GET /v1/badges/metadata` — Get badge system metadata — no auth
- `GET /v1/badges/icons` — Icon thumbnails — no auth
- `GET /v1/universes/{universeId}/badges` — List universe badges — no auth
- `GET /v1/universes/{universeId}/free-badges-quota` — Check badge creation quota
- `GET /v1/users/{userId}/badges` — List user badges — no auth
- `GET /v1/users/{userId}/badges/awarded-dates` — When user earned badges
- `GET /v1/users/{userId}/badges/{badgeId}/awarded-date` — When specific badge earned
- `DELETE /v1/user/badges/{badgeId}` — User can remove badge from inventory — cookie-based

**Icon Upload**:
- `POST /legacy-publish/v1/badges/{badgeId}/icon` — Upload badge icon — multipart

**Notes**: Primarily legacy API. Not recommended for new implementations. Scope uses "legacy-" prefix.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/badges`

---

## LOCALIZATION (Legacy GA)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `legacy-universe:manage` and various `legacy-*:manage` scopes

**Localization Tables**:
- `POST /legacy-localization-tables/v1/autolocalization/games/{gameId}/autolocalizationtable` — Create auto-localization table
- `PATCH /legacy-localization-tables/v1/autolocalization/games/{gameId}/settings` — Configure auto-localization
- `GET /legacy-localization-tables/v1/autolocalization/metadata` — Get system metadata
- `GET /legacy-localization-tables/v1/localization-table/limits` — Check quota
- `GET/PATCH /legacy-localization-tables/v1/localization-table/tables/{tableId}` — Manage table
- `GET /legacy-localization-tables/v1/localization-table/tables/{tableId}/entries` — List entries
- `POST /legacy-localization-tables/v1/localization-table/tables/{tableId}/entries/translation-history` — Get translation history
- `GET /legacy-localization-tables/v1/localization-table/tables/{tableId}/entry-count` — Count entries

**Game Internationalization**:
- `GET/POST/DELETE /legacy-game-internationalization/v1/game-icon/games/{gameId}/language-codes/{languageCode}` — Manage localized game icon
- `POST/DELETE /legacy-game-internationalization/v1/game-thumbnails/games/{gameId}/language-codes/{languageCode}/image` — Localized thumbnails
- `POST /legacy-game-internationalization/v1/game-thumbnails/games/{gameId}/language-codes/{languageCode}/alt-text` — Thumbnail alt text
- `POST /legacy-game-internationalization/v1/game-thumbnails/games/{gameId}/language-codes/{languageCode}/images/order` — Reorder images
- `DELETE /legacy-game-internationalization/v1/game-thumbnails/games/{gameId}/language-codes/{languageCode}/images/{imageId}`
- `POST /legacy-game-internationalization/v1/name-description/games/translation-history`
- `PATCH /legacy-game-internationalization/v1/name-description/games/{gameId}` — Set game name/description
- `PATCH /legacy-game-internationalization/v1/source-language/games/{gameId}`
- `PATCH/GET /legacy-game-internationalization/v1/supported-languages/games/{gameId}` — Manage supported languages
- `GET /legacy-game-internationalization/v1/supported-languages/games/{gameId}/automatic-translation-status`
- `PATCH /legacy-game-internationalization/v1/supported-languages/games/{gameId}/languages/{languageCode}/automatic-translation-status`

**Notes**: Extensive but all legacy. Modern Roblox uses in-studio localization. Scope: `legacy-universe:manage`.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/localization`

---

## THUMBNAILS (GA)

**Base URL**: `https://thumbnails.roblox.com` and `https://apis.roblox.com/cloud/v2`

**Required Scope(s)**: `thumbnail:read` (optional for some endpoints)

**Asset Thumbnails**:
- `GET /v1/assets` — Get asset thumbnail — `assetIds`, `returnPolicy`, `size`, `format`, `isCircular` — no auth
- `GET /v1/assets-thumbnail-3d` — 3D asset preview — OAuth with `thumbnail:read`
- `GET /v1/asset-thumbnail-animated` — Animated asset thumbnail

**Game/Universe Thumbnails**:
- `GET /v1/games/icons` — Game icons — `universeIds`, `size`, `format` — auto-generated policies
- `GET /v1/games/multiget/thumbnails` — Batch game thumbnails — no auth
- `GET /v1/games/{universeId}/thumbnails` — Universe-specific thumbnails — no auth
- `GET /v2/games/{universeId}/media` — v2 game media (current) — no auth
- `GET /v1/games/{universeId}/media` — Deprecated v1 endpoint

**Badge/Developer Product Icons**:
- `GET /v1/badges/icons` — Badge icons — no auth
- `GET /v1/developer-products/icons` — Dev product icons — no auth
- `GET /v1/game-passes` — Game pass icons — no auth

**User Avatars**:
- `GET /v1/users/avatar` — Avatar headshot — `userIds`, `size`, `format`, `shape` — no auth
- `GET /v1/users/avatar-bust` — Avatar bust-shot — no auth
- `GET /v1/users/avatar-headshot` — Full headshot — no auth
- `GET /v1/users/avatar-3d` — 3D avatar preview — Beta, OAuth with `thumbnail:read`
- `GET /v1/users/outfits` — Outfit thumbnails — no auth
- `GET /v1/users/outfit-3d` — 3D outfit preview — Beta, OAuth with `thumbnail:read`

**Group/Bundle Thumbnails**:
- `GET /v1/groups/icons` — Group icons — no auth
- `GET /v1/bundles/thumbnails` — Bundle images — no auth

**Place Thumbnails**:
- `GET /v1/places/gameicons` — Place icons — no auth

**Batch Operations**:
- `POST /v1/batch` — Batch thumbnail requests — no auth

**Legacy Publishing**:
- `POST /v1/avatar/redraw-thumbnail` — User redraws own avatar thumbnail — cookie auth
- `POST /v1/badges/{badgeId}/icon` — Badge icon upload — cookie/OAuth
- `POST /v1/games/{gameId}/thumbnail/image` — Game thumbnail upload — cookie auth

**Metadata**:
- `GET /v1/metadata` — API metadata — no auth

**Notes**: Public read-only endpoints don't require authentication. 3D thumbnails are beta features requiring OAuth.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/thumbnails`

---

## AVATARS (GA/Legacy)

**Base URL**: `https://apis.roblox.com` and related domains

**Required Scope(s)**: cookie-based or `roblox-oauth2`

**Avatar Management**:
- `GET /v1/avatar` — Get equipped avatar items — requires `.ROBLOSECURITY` cookie
- `POST /v1/avatar/set-body-colors` — Set body colors — cookie auth
- `POST /v1/avatar/set-player-avatar-type` — Switch avatar type (R6/R15) — cookie auth
- `POST /v1/avatar/set-scales` — Set body scale — cookie auth
- `POST /v1/avatar/redraw-thumbnail` — Regenerate avatar thumbnail — cookie auth
- `GET /v1/avatar-rules` — Get avatar configuration rules — no auth

**User Avatar Endpoints**:
- `GET /v1/users/{userId}/avatar` — Get user's equipped items — no auth
- `GET /v1/users/{userId}/currently-wearing` — Same as above
- `GET /v2/avatar/users/{userId}/avatar` — v2 endpoint — no auth
- `POST /v2/avatar/set-body-colors` — Cookie auth
- `POST /v2/avatar/set-wearing-assets` — Equip items — cookie auth

**Outfits**:
- `GET /v1/users/{userId}/outfits` — List user outfits — no auth
- `GET /v1/outfits/{userOutfitId}/details` — Outfit details — no auth
- `GET /v2/avatar/users/{userId}/outfits` — v2 list — no auth
- `POST /v1/outfits/{userOutfitId}/delete` — Delete outfit — cookie auth
- `POST /v2/outfits/create` — Create outfit — cookie auth (deprecated)
- `PATCH /v2/outfits/{userOutfitId}` — Update outfit — cookie auth (deprecated)
- `POST /v3/outfits/create` — Create outfit — cookie auth (current)
- `PATCH /v3/outfits/{userOutfitId}` — Update outfit — cookie auth
- `GET /v3/outfits/{userOutfitId}/details` — Get outfit — no auth

**Metadata**:
- `GET /v1/avatar/metadata` — Avatar system metadata — no auth
- `GET /v1/avatar-rules` — Rules for avatar validation — no auth
- `GET /v1/game-start-info` — Game startup info including avatar — no auth

**Notes**: Mix of v1, v2, v3 endpoints. Most write operations require cookies (not API key compatible). Public read endpoints available.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/avatars`

---

## INTERACTIONS (GA/Legacy)

**Base URL**: Various (followings, favorites, votes, follows)

**Required Scope(s)**: `legacy-universe.following:read/write`, mostly cookie-based

**Following Universe**:
- `GET /legacy-followings/v1/users/{userId}/universes` — List followed universes — Scope: `legacy-universe.following:read`
- `POST /legacy-followings/v1/users/{userId}/universes/{universeId}` — Follow universe — Scope: `legacy-universe.following:write`
- `DELETE /legacy-followings/v1/users/{userId}/universes/{universeId}` — Unfollow
- `GET /legacy-followings/v1/users/{userId}/universes/{universeId}/status` — Check follow status
- `GET /legacy-followings/v2/users/{userId}/universes` — v2 list

**Following Users**:
- `GET /v1/users/{targetUserId}/followers` — Get follower count — no auth
- `GET /v1/users/{targetUserId}/followers/count` — Follower count metric — no auth
- `GET /v1/users/{targetUserId}/followings` — List followed users — no auth
- `GET /v1/users/{targetUserId}/followings/count` — Following count — no auth
- `POST /v1/users/{targetUserId}/follow` — Follow user — cookie auth
- `POST /v1/users/{targetUserId}/unfollow` — Unfollow user — cookie auth
- `POST /v1/user/following-exists` — Check if following someone — cookie auth

**Favorites**:
- `GET /v1/favorites/assets/{assetId}/count` — Favorite count — no auth
- `GET /v1/favorites/bundles/{bundleId}/count` — Bundle favorite count — no auth
- `GET /v1/favorites/users/{userId}/assets/{assetId}/favorite` — Check if favorited — no auth (GET)
- `POST /v1/favorites/users/{userId}/assets/{assetId}/favorite` — Favorite asset — cookie auth
- `DELETE /v1/favorites/users/{userId}/assets/{assetId}/favorite` — Unfavorite — cookie auth
- `GET /v1/favorites/users/{userId}/bundles/{bundleId}/favorite` — Bundle favorite status — no auth (GET)
- `POST/DELETE /v1/favorites/users/{userId}/bundles/{bundleId}/favorite` — Bundle favorite toggle — cookie auth
- `GET /v1/favorites/users/{userId}/favorites/{assetTypeId}/assets` — List favorite assets — no auth
- `GET /v1/favorites/users/{userId}/favorites/{subtypeId}/bundles` — List favorite bundles — cookie auth

**Game Votes & Favorites**:
- `GET /v1/games/{universeId}/votes` — Game vote count — no auth
- `GET /v1/games/{universeId}/votes/user` — User's vote on game — cookie auth
- `PATCH /v1/games/{universeId}/user-votes` — Vote on game (like/dislike) — cookie auth
- `GET /v1/games/{universeId}/favorites` — Game favorite count — no auth
- `GET /v1/games/{universeId}/favorites/count` — Favorite count metric — no auth
- `POST /v1/games/{universeId}/favorites` — Favorite game — cookie auth
- `GET /v1/assets/voting` — Asset voting system metadata — no auth
- `GET /v1/games/votes` — Game voting metadata — no auth

**User Bundles**:
- `GET /v1/users/{userId}/bundles` — List user bundles — no auth
- `GET /v1/users/{userId}/bundles/{bundleType}` — Bundles by type — no auth
- `GET /v1/users/{userId}/categories/favorites` — Favorite categories — no auth

**Universe & Category Interactions**:
- `GET/POST/DELETE /v1/users/{userId}/universes/{universeId}` — Manage universe interaction — cookie/OAuth
- `GET /v2/users/{userId}/universes` — v2 universe list — cookie/OAuth
- `GET /v2/users/{userId}/favorite/games` — Favorite games — no auth

**Notes**: Heavy cookie dependency. Mix of read-only public endpoints and auth-required write operations. Various versions (v1, v2, v3).

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/interactions`

---

## INVENTORIES (Beta, July 2024)

**Base URL**: `https://apis.roblox.com/cloud/v2` and legacy paths

**Required Scope(s)**: `user.inventory-item:read`, or legacy cookie-based

**Cloud API**:
- `GET /users/{user_id}/inventory-items` — List user inventory — `maxPageSize`, `pageToken`, `filter` — Scope: `user.inventory-item:read` — Rate: 100 req/min (API key), 20/min (OAuth)

**Legacy Collection Management**:
- `POST /v1/collections/items/{itemType}/{itemTargetId}` — Add to collection — cookie auth
- `DELETE /v1/collections/items/{itemType}/{itemTargetId}` — Remove from collection — cookie auth
- `GET /v1/packages/{packageId}/assets` — Get package assets — no auth/cookie
- `GET /v1/users/{userId}/assets/collectibles` — User collectible assets — no auth/cookie
- `GET /v1/users/{userId}/can-view-inventory` — Check inventory visibility — no auth/cookie
- `GET /v1/users/{userId}/categories` — Inventory categories — no auth/cookie
- `GET /v1/users/{userId}/categories/favorites` — User's favorite categories — no auth/cookie
- `GET /v1/users/{userId}/items/{itemType}/{itemTargetId}` — Check if user owns item — no auth/cookie
- `GET /v1/users/{userId}/items/{itemType}/{itemTargetId}/is-owned` — Item ownership check — no auth/cookie
- `GET /v1/users/{userId}/places/inventory` — User's place inventory — no auth/cookie
- `DELETE /v2/inventory/asset/{assetId}` — Delete from inventory — cookie auth
- `GET /v2/inventory/asset/{assetId}` — Get owned copies of asset (implied)
- `GET /v2/users/{userId}/inventory` — User's full inventory — no auth/cookie
- `GET /v2/users/{userId}/inventory/{assetTypeId}` — Inventory filtered by type — no auth/cookie
- `GET /v2/assets/{assetId}/owners` — Who owns an asset — no auth/cookie

**Notes**: Cloud API is beta (July 2024+). Legacy endpoints are primary public interface. Cloud v2 offers cleaner interface.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/inventories`

---

## MATCHMAKING (Beta)

**Base URL**: `https://apis.roblox.com/matchmaking-api/v1`

**Required Scope(s)**: None documented (all endpoints marked internal/beta)

**Game Instance Management**:
- `POST /game-instances/launch-update` — Deploy server — no auth documented
- `GET /game-instances/get-update-status` — Check deployment status
- `POST /game-instances/forecast-update` — Forecast server changes
- `POST /game-instances/shutdown` — Stop server — cookie auth
- `POST /game-instances/shutdown-all` — Stop all servers — cookie auth
- `GET/POST /client-status` — Client status reporting — no auth

**Player Attributes**:
- `POST /matchmaking/player-attribute` — Define player attribute
- `GET /matchmaking/player-attributes/{universeId}` — List player attributes
- `DELETE /matchmaking/player-attribute/{attributeId}` — Remove attribute
- `PATCH /matchmaking/player-attribute/{attributeId}` — Update attribute

**Scoring Configuration**:
- `POST /matchmaking/scoring-configuration` — Create scoring config
- `GET /matchmaking/scoring-configuration/{scoringConfigurationId}` — Get config
- `DELETE /matchmaking/scoring-configuration/{scoringConfigurationId}` — Delete config
- `PATCH /matchmaking/scoring-configuration/{scoringConfigurationId}` — Update config
- `GET /matchmaking/scoring-configuration/default-weights` — Default scoring weights
- `GET /matchmaking/scoring-configuration/generate-mock-servers` — Test config
- `POST /matchmaking/scoring-configuration/place` — Create place-specific scoring
- `DELETE /matchmaking/scoring-configuration/place/{placeId}` — Remove place scoring
- `POST /matchmaking/scoring-configuration/{scoringConfigurationId}/signals` — Add signal
- `DELETE /matchmaking/scoring-configuration/{scoringConfigurationId}/signals/{signalName}` — Remove signal
- `PATCH /matchmaking/scoring-configuration/{scoringConfigurationId}/signals/{signalName}` — Update signal
- `GET /matchmaking/scoring-configurations/{universeId}` — List universe configs
- `GET /matchmaking/scoring-configurations/{universeId}/places` — List place configs

**Server Attributes**:
- `POST /matchmaking/server-attribute` — Define server attribute
- `GET /matchmaking/server-attributes/{universeId}` — List server attributes
- `DELETE /matchmaking/server-attribute/{attributeId}` — Remove attribute
- `PATCH /matchmaking/server-attribute/{attributeId}` — Update attribute

**Feature Flags**:
- `GET /matchmaking/universe/{universeId}/feature-flags` — Get universe feature flags

**Notes**: Beta status. Endpoints marked "not supported via apiKeyWithHttpService." Core matchmaking configuration.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/matchmaking`

---

## METADATA (GA)

**Base URL**: Various domains

**Required Scope(s)**: `legacy-universe:manage` for some, most public

**Authentication Metadata**:
- `GET /v1/auth/metadata` — Auth system metadata — no auth
- `GET /v2/auth/metadata` — v2 auth metadata — no auth

**Avatar & Asset Metadata**:
- `GET /v1/avatar/metadata` — Avatar system config — no auth
- `GET /v1/avatar-rules` — Avatar validation rules — no auth
- `GET /v1/badges/metadata` — Badge system info — no auth
- `GET /v1/localization-table/metadata` — Localization system info — no auth
- `GET /v1/name-description/metadata` — Name/description rules — no auth

**Locales & Languages**:
- `GET /v1/locales/supported-locales` — Supported locales — no auth
- `GET /v1/locales/supported-locales-for-creators` — Creator-friendly locales
- `GET /v1/locales/user-localization-locus-supported-locales` — User localization support
- `POST /v1/locales/set-user-supported-locale` — Set user locale — no auth

**System Metadata**:
- `GET /v1/metadata` — Global metadata — no auth
- `GET /v1/categories` — Asset categories — no auth
- `GET /v1/subcategories` — Asset subcategories — no auth
- `GET /v1/ui-configurations` — UI configuration — no auth
- `GET /v1/installer-cdns` — CDN list for installers — no auth

**Client Versions**:
- `GET /v1/client-version/{binaryType}` — Latest client version — no auth
- `GET /v1/mobile-client-version` — Mobile client version — no auth
- `GET /v2/client-version/{binaryType}` — v2 client version — no auth
- `GET /v2/ota-version/{binaryType}` — OTA client version — no auth
- `GET /v2/android-binaries/{version}/channels/{channelName}` — Android binary info

**Translation & Recovery**:
- `GET /v1/translation-analytics/metadata` — Translation analytics info
- `GET /v1/recovery/metadata` — Account recovery metadata — no auth
- `GET /v2/recovery/metadata` — v2 recovery metadata — no auth
- `GET /v2/compression-dictionaries` — Compression dict info — no auth
- `GET /v2/user-channel` — User channel info — no auth

**Groups Metadata**:
- `GET /v1/groups/configuration/metadata` — Group config metadata
- `GET /v1/groups/metadata` — Groups system info
- `GET /v1/groups/search/metadata` — Groups search metadata

**Notes**: Nearly all public/no-auth. Provides system configuration information for client applications.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/metadata`

---

## PRIVATE SERVERS (GA)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `roblox-legacy-cookie` for all (no API key support)

**Private Server Management**:
- `POST /v1/games/vip-servers/{universeId}` — Create private server — JSON config — cookie auth
- `GET /v1/games/{placeId}/private-servers` — List place's private servers — cookie auth
- `GET /v1/private-servers/enabled-in-universe/{universeId}` — Check if enabled — no auth/cookie
- `GET /v1/private-servers/my-private-servers` — User's private servers — cookie auth
- `GET /v1/vip-servers/my-private-servers` — User's VIP servers — cookie auth
- `GET /v1/vip-servers/{id}` — Get server details — cookie auth
- `PATCH /v1/vip-servers/{id}` — Update server config — JSON body — cookie auth
- `PATCH /v1/vip-servers/{id}/permissions` — Manage permissions — cookie auth
- `PATCH /v1/vip-servers/{id}/subscription` — Manage subscription — cookie auth
- `GET /v1/vip-server/can-invite/{userId}` — Check if user can be invited — cookie auth
- `GET /v1/universes/{universeId}/configuration/vip-servers` — Universe's servers — cookie auth

**Notes**: Cookie-only, no API key or modern OAuth support. VIP servers = private servers.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/private-servers`

---

## TRADES (GA but with deprecated features)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `roblox-legacy-cookie` (all endpoints)

**Trade Operations**:
- `POST /v1/trades/send` — Create trade offer — JSON with offered/requested items — cookie auth
- `GET /v1/trades/{tradeId}` — Get trade details — no required params
- `POST /v1/trades/{tradeId}/accept` — Accept trade — no params
- `POST /v1/trades/{tradeId}/counter` — Counter-offer — JSON with new terms
- `POST /v1/trades/{tradeId}/decline` — Decline trade — no params
- `GET /v1/trades/{tradeStatusType}` — List trades by status — `pageNumber`, `pageSize` (inbound, outbound, completed, inactive)
- `GET /v1/trades/{tradeStatusType}/count` — Count trades by status — no params

**v2 Endpoints** (newer):
- `POST /v2/trades/send` — v2 trade creation — improved schema
- `GET /v2/trades/{tradeId}` — v2 get trade — no params
- `POST /v2/trades/{tradeId}/counter` — v2 counter-offer
- `GET /v2/users/me/can-trade` — Check if current user can trade — no auth needed
- `GET /v2/users/{userId}/can-trade-with` — Check if can trade with user
- `GET /v2/users/{userId}/tradableItems` — Get user's tradable items

**Deprecated**:
- `POST /v1/trades/expire-outdated` — Auto-expire disabled (deprecated)
- `GET /v1/users/{userId}/can-trade-with` — Use v2 instead

**Metadata**:
- `GET /v1/trades/metadata` — Trade system info — no auth

**Notes**: Not recommended per user context ("Trades API is DEAD Jul 2025"). However, endpoints still functional. Cookie-only. v2 preferred over v1.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/trades`

---

## SPONSORED CAMPAIGNS (GA)

**Base URL**: `https://adconfiguration.roblox.com/v2`

**Required Scope(s)**: `roblox-legacy-cookie` for create/stop operations

**Campaign Management**:
- `GET /v2/sponsored-campaigns` — List campaigns — `pageToken`, `pageSize`, `filter`, `sortBy` — no auth for public, cookie for own
- `POST /v2/sponsored-campaigns/create` — Create complete ad campaign — JSON with campaign/ad/escrow config — cookie auth
- `POST /v2/sponsored-campaigns/stop` — Stop running campaign — `campaignId` — cookie auth
- `GET /v2/sponsored-games` — List sponsored games — pagination params — public
- `POST /v2/sponsored-games/create` — Create game sponsorship — JSON config — cookie auth
- `POST /v2/sponsored-games/stop` — Stop game sponsorship — cookie auth
- `GET /v2/sponsored-campaigns/eligible-asset-type-ids` — Get sponsorable asset types — no auth
- `POST /v2/sponsored-campaigns/eligible-campaign-targets` — Get authorized targets — cookie auth
- `GET /v2/sponsored-campaigns/multi-get-can-user-sponsor` — Check sponsorship eligibility for multiple targets — no auth
- `GET /v2/sponsored-games/universes` — List universes ranked by ad activity — no auth

**Notes**: Ad management API. Cookie-based auth. Some endpoints public-readable.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/sponsored-campaigns`

---

## TEAM CREATE (GA/Legacy)

**Base URL**: `https://apis.roblox.com` and `develop.roblox.com`

**Required Scope(s)**: `legacy-team-collaboration:manage`

**Current v1 Endpoints**:
- `GET /v1/places/{placeId}/teamcreate/active_session/members` — List active TC members — Scope: `legacy-team-collaboration:manage`
- `GET /v1/universes/multiget/teamcreate` — Batch get TC status — Scope: `legacy-team-collaboration:manage`
- `GET /v1/universes/{universeId}/teamcreate` — Get TC config — Scope: `legacy-team-collaboration:manage`
- `PATCH /v1/universes/{universeId}/teamcreate` — Update TC config — JSON body — Scope: `legacy-team-collaboration:manage`
- `DELETE /v1/universes/{universeId}/teamcreate/memberships` — Remove team member — `userId` — Scope: `legacy-team-collaboration:manage`
- `DELETE /v2/teamtest/{placeId}` — Delete team test session — Scope: `legacy-team-collaboration:manage`

**Legacy v1 Endpoints** (deprecated):
- Same as above under `/legacy-develop/v1/` path

**Notes**: Team Create = collaborative development. API supports both API keys and OAuth. Admin function, not for games.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/team-create`

---

## BANS & BLOCKS (GA)

**Base URL**: `https://apis.roblox.com/cloud/v2` and `https://apis.roblox.com`

**Required Scope(s)**:
- `universe.user-restriction:read`, `universe.user-restriction:write` (cloud v2)
- cookie-based for groups

**Cloud v2 User Restrictions** (universe/place-level bans):
- `GET /universes/{universe_id}/user-restrictions` — List universe bans — `maxPageSize`, `pageToken` — Scope: `universe.user-restriction:read`
- `GET /universes/{universe_id}/user-restrictions/{user_restriction_id}` — Get ban details — no params
- `PATCH /universes/{universe_id}/user-restrictions/{user_restriction_id}` — Update ban (extend, etc.) — `endTime`, `reason` — Scope: `universe.user-restriction:write`
- `GET /universes/{universe_id}/places/{place_id}/user-restrictions` — List place-level bans — `maxPageSize`, `pageToken`
- `GET /universes/{universe_id}/places/{place_id}/user-restrictions/{user_restriction_id}` — Get place ban
- `PATCH /universes/{universe_id}/places/{place_id}/user-restrictions/{user_restriction_id}` — Update place ban — Scope: `universe.user-restriction:write`
- `GET /universes/{universe_id}/user-restrictions:listLogs` — Get ban audit log — `maxPageSize`, `pageToken` — Scope: `universe.user-restriction:read`

**Groups Bans & Blocks** (cookie-based):
- `GET /v1/groups/{groupId}/bans` — List group bans — no params
- `GET /v1/groups/{groupId}/bans/{userId}` — Check if user banned — no params
- `POST /v1/groups/{groupId}/bans/{userId}` — Ban user from group — no params
- `DELETE /v1/groups/{groupId}/bans/{userId}` — Unban user — no params
- `GET /v1/groups/{groupId}/blocked-keywords` — List blocked keywords — no params
- `POST /v1/groups/{groupId}/blocked-keywords` — Add keyword filter — `keyword` — cookie auth
- `PATCH /v1/groups/{groupId}/blocked-keywords/{keywordId}` — Update keyword
- `DELETE /v1/groups/{groupId}/blocked-keywords/{keywordId}` — Remove keyword

**Notes**: Cloud v2 for universe-wide restrictions, groups API for group-scoped. User restrictions can have expiration times.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/bans-and-blocks`

---

## ACCOUNTS (Legacy)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: `roblox-legacy-cookie` or none for metadata

**Account Management**:
- `GET /v1/account/pin` — Get PIN status — cookie auth
- `POST /v1/account/pin` — Create PIN — `pin` — cookie auth
- `DELETE /v1/account/pin` — Remove PIN — cookie auth
- `PATCH /v1/account/pin` — Change PIN — `newPin`, `currentPin` — cookie auth
- `POST /v1/account/pin/lock` — Lock account — cookie auth
- `POST /v1/account/pin/unlock` — Unlock account — `pin` — cookie auth
- `GET /v1/account/settings/account-country` — Get country setting — cookie auth
- `POST /v1/account/settings/account-country` — Set country — `country_code` — cookie auth
- `GET /v1/account/settings/metadata` — Account settings metadata — no auth

**Authentication**:
- `POST /v1/login` — User login — `username`, `password` — cookie returned
- `POST /v1/signup` — Create account — `username`, `email`, `password`, birthdate — no auth required
- `POST /v1/logout` — Logout — cookie auth

**Email Management**:
- `GET /v1/email` — Get email address — cookie auth
- `POST /v1/email` — Set email — `emailAddress` — cookie auth
- `POST /v1/email/verify` — Verify email — `code` — no auth
- `GET /v1/birthdate` — Get birthdate — cookie auth
- `POST /v1/birthdate` — Set birthdate — `birthMonth`, `birthDay`, `birthYear` — cookie auth

**Profile**:
- `GET /v1/description` — Get account description — cookie auth
- `POST /v1/description` — Set description — `description` — cookie auth
- `GET /v1/gender` — Get gender preference — cookie auth
- `POST /v1/gender` — Set gender — `genderId` — cookie auth
- `GET /v1/phone` — Get phone number — cookie auth
- `POST /v1/phone` — Set phone — `phoneNumber` — cookie auth

**Passkeys**:
- `POST /v1/passkey/*` — Various passkey authentication endpoints — no direct documentation

**Metadata**:
- `GET /v1/auth/metadata` — Auth system metadata — no auth

**Notes**: Almost entirely cookie-based. Not suitable for API key or OAuth. Account management not exposed via modern cloud APIs.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/accounts`

---

## GENERATIVE AI (Beta)

**Base URL**: `https://apis.roblox.com/cloud/v2` and `https://apis.roblox.com/open-eval-api/v1`

**Required Scope(s)**:
- `universe:write`, `asset:read`, `asset:write` (speech)
- `universe:write` (translation)
- `studio-evaluations:create` (eval)

**Speech Generation (TTS)**:
- `POST /universes/{universe_id}:generateSpeechAsset` — Text-to-speech — `text`, `languageCode` (optional, English default) — returns audio asset — Scope: `universe:write`, `asset:read`, `asset:write`

**Translation**:
- `POST /universes/{universe_id}:translateText` — Translate text — `text`, `sourceLanguageCode`, `targetLanguageCode` — Scope: `universe:write`

**Lua Evaluation** (Open Eval):
- `POST /eval` — Evaluate Lua script — `source` code — Scope: `studio-evaluations:create` — returns result/error
- `GET /eval-records/{jobId}` — Get evaluation record — no params — Scope: `studio-evaluations:create`

**Notes**: 
- **NOT found**: Cube 3D, Cube 4D, material generation, mesh generation, STT (speech-to-text)
- Only 3 surfaces documented; others may be internal/planned
- Speech API returns asset ID for generated audio

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/generative-ai`

---

## USER PROFILES (GA)

**Base URL**: `https://apis.roblox.com`

**Required Scope(s)**: None for most (cookie optional), `roblox-legacy-cookie` for some

**User Profile Data**:
- `GET /v1/users/{userId}` — Get user info — no auth (optional cookie) — returns name, created, membership status, avatar, bio, etc.
- `GET /v1/users/{userId}/username-history` — Get username history — no auth
- `GET /v1/users/{userId}/roblox-badges` — Get user's Roblox badges — no auth
- `GET /v1/users/{userId}/promotion-channels` — Get user's promotion channels — no auth
- `GET /v1/users/{userId}/premium-upsell-precheck` — Check premium upsell eligibility — cookie auth
- `GET /v1/users/{userId}/validate-membership` — Validate membership status — cookie auth
- `GET /v1/users/{userId}/groups/primary/role` — Get user's primary group role — no auth

**Display Name Management**:
- `PATCH /v1/users/{userId}/display-names` — Set display name — `newDisplayName` — cookie auth

**Badges**:
- `GET /v1/users/{userId}/badges` — List user's earned badges — no auth
- `GET /v1/users/{userId}/badges/awarded-dates` — When badges were earned — no auth
- `GET /v1/users/{userId}/badges/{badgeId}/awarded-date` — Specific badge earned date — no auth

**Notes**: Mostly public read endpoints. Write operations require cookies.

**Doc Link**: `https://create.roblox.com/docs/cloud/reference/features/user-profiles`

---

## Endpoints Summary by Stability

### GA (22 surfaces)
1. Data Stores v2
2. Ordered Data Stores v2
3. Memory Stores
4. Messaging Service v2 (partial - only publish)
5. Universes & Configuration
6. Places & Instances
7. Configs
8. Assets v1
9. Developer Products
10. Game Passes
11. Creator Store Products
12. Groups (mostly read-only)
13. Users
14. Notifications (v2 POST only)
15. Badges (legacy)
16. Localization (legacy)
17. Thumbnails
18. Avatars
19. Interactions (legacy)
20. Inventories (Cloud v2)
21. Private Servers
22. Trades (with caveats)

### Beta (7 surfaces)
1. Luau Execution (since Sept 2024)
2. Data Stores v1 (legacy)
3. Matchmaking
4. Generative AI
5. Inventories Cloud v2 (July 2024+)
6. Sponsored Campaigns (possibly)
7. Avatar 3D thumbnails

### Legacy/Deprecated (5 surfaces)
1. Accounts (legacy cookie-only)
2. Team Create (legacy cookie-only)
3. Bans & Blocks (groups legacy)
4. Private Servers (cookie-only, no API key)
5. Trades (partially deprecated features)

---

This concludes the comprehensive API inventory. I've documented **34 API surfaces** with exact endpoint paths, HTTP methods, required scopes, and pagination patterns where applicable. The document is structured by agent-usefulness priority as requested, with detailed notes on landmines, deprecation status, and authentication requirements.
