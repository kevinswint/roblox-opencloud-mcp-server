# Roblox Open Cloud MCP Server — Demos

This file walks through end-to-end agent flows that exercise the server
against a real Roblox experience. Each demo is written as a prompt you
can paste into Claude Code (or any MCP-compatible agent) after the
server is installed and configured per the [README](README.md).

> **Prerequisite:** A test universe with an API key that holds every
> scope referenced below. If you're missing a scope, the affected tool
> will return `403 Forbidden` with a structured error message pointing
> at the exact scope name — add it in the Creator Hub credentials page
> and retry.

## Setup

```bash
# 1. Build
git clone https://github.com/kevinswint/roblox-opencloud-mcp-server.git
cd roblox-opencloud-mcp-server
npm install
npm run build

# 2. Register with Claude Code (stdio)
claude mcp add roblox-opencloud-mcp \
  -e ROBLOX_API_KEY=YOUR_TEST_KEY \
  -- node "$(pwd)/dist/index.js"

# 3. Sanity check — list every tool
npm run list-tools
```

You should see 96 tools grouped into 18 domains.

---

## Demo 1 — Monetization hands-on

**Scenario:** your experience's cheapest Developer Product is wildly
underpriced and you want to raise it by 10%. This shows paginated list
+ reading + partial update in a single agent turn.

**Prompt:**

> List the Developer Products for universe `123456`, identify the
> cheapest one, and raise its price by 10% (rounded up). Show me the
> before and after.

**What the agent does:**

1. `roblox_list_developer_products(universe_id=123456)` → paginated
   list of products.
2. For each, reads `priceInRobux` and picks the minimum.
3. `roblox_get_developer_product(product_id=...)` to confirm current
   state.
4. `roblox_update_developer_product(product_id=..., price_in_robux=...)`
   with the new value.
5. Reads back to confirm the update took.

**Scopes exercised:** `universe.developer-product:read`,
`universe.developer-product:write`.

---

## Demo 2 — DataStore read-through

**Scenario:** player support ticket asking "what level is user 12345
at?" Agent has to find the right datastore, find the right key, and
return the level without touching any other data.

**Prompt:**

> In universe `123456`, look up the DataStore named `UserProgress`
> and fetch the entry for user 12345. Return their `level` field
> and the timestamp of the last update.

**What the agent does:**

1. `roblox_list_data_stores(universe_id=123456, prefix="UserProgress")`
   to confirm the store exists.
2. `roblox_get_data_store_entry(universe_id=123456, data_store_name="UserProgress", entry_id="12345")`
3. Parses the structured value for `level` and returns it alongside
   `revisionCreateTime`.

**Scopes exercised:** `universe-datastores.objects:list`,
`universe-datastores.objects:read`.

---

## Demo 3 — Create a Game Pass from scratch

**Scenario:** you want a new 100-Robux "Early Access" Game Pass
spun up without touching the Creator Hub UI.

**Prompt:**

> For universe `123456`, create a Game Pass called "Early Access"
> priced at 100 Robux with description "Support development and
> unlock beta content." Then list all the game passes for the
> universe and confirm it appears.

**What the agent does:**

1. `roblox_create_game_pass(universe_id=123456, display_name="Early Access", price_in_robux=100, description="…")`
2. `roblox_list_game_passes(universe_id=123456)` — verifies the new pass
   is returned.

**Scopes exercised:** `universe.game-pass:write`, `universe.game-pass:read`.

---

## Demo 4 — Luau execution end-to-end

**Scenario:** stress-test the Beta Luau Execution API by running three
distinct scripts against the same place.

**Prompts** (run sequentially):

1. > Execute this Luau in universe `123456`, place `789012`:
   > ```lua
   > return #game:GetService("Players"):GetPlayers()
   > ```
2. > Execute this Luau in the same place:
   > ```lua
   > local ds = game:GetService("DataStoreService"):GetDataStore("UserProgress")
   > return ds:GetAsync("12345")
   > ```
3. > Execute this Luau in the same place:
   > ```lua
   > return {
   >   name = workspace.Name,
   >   childCount = #workspace:GetChildren(),
   >   gravity = workspace.Gravity,
   > }
   > ```

**What the agent does:**

1. `roblox_execute_luau(universe_id, place_id, script=...)` returns a
   task path.
2. `roblox_get_luau_task(task_path=...)` polls until `COMPLETE`.
3. Parses `output.results` for the return value.

**Scopes exercised:**
`universe.place.luau-execution-session:write`,
`universe.place.luau-execution-session:read`.

> ⚠️ **Known-beta surface.** If this flow fails, check
> [LIMITATIONS.md](LIMITATIONS.md) for the current state of the Luau
> Execution API. This is the single most fragile tool in the server and
> the most important to validate against a live universe before trusting.

---

## Demo 5 — Memory Store leaderboard

**Scenario:** drop high-score entries into a Memory Store Sorted Map
and read them back in rank order.

**Prompt:**

> In universe `123456`, create a Memory Store Sorted Map called
> `daily-leaderboard` and populate it with these three entries:
> - player1 → score 1000
> - player2 → score 850
> - player3 → score 1200
>
> Then list the top 10 entries in descending order.

**What the agent does:**

1. Three calls to `roblox_create_memory_store_sorted_map_item` (one per
   player), using `sort_key` = score.
2. `roblox_list_memory_store_sorted_map_items(..., order_by="sortKey desc", max_page_size=10)`

**Scopes exercised:** `memory-store.sorted-map:write`,
`memory-store.sorted-map:read`.

---

## Demo 6 — Experience Config round-trip

**Scenario:** the GA (March 10 2026) Configs API lets you edit
structured experience config outside of Studio. This demo shows the
draft → publish → revision-history loop.

**Prompt:**

> For universe `123456`, repository `my-config`, read the current
> published config. Then update the draft to set
> `features.betaMessage = "Hello from Open Cloud!"`, publish the
> draft, and list the last 5 revisions.

**What the agent does:**

1. `roblox_get_config(universe_id, repository)`
2. `roblox_update_config_draft(..., partial_data={features: {betaMessage: "..."}})`
3. `roblox_publish_config(universe_id, repository)`
4. `roblox_list_config_revisions(universe_id, repository, page_size=5)`

**Scopes exercised:** `universe.creator-configs:read`,
`universe.creator-configs:write`.

---

## Demo 7 — Asset upload round-trip

**Scenario:** upload a local PNG as a decal, poll until the upload
operation completes, then read the asset metadata.

**Prompt:**

> Upload the image at `./fixtures/badge-icon.png` as a decal named
> "Beta Tester Badge" under user `12345`. Wait for the upload to
> complete, then show me the final asset ID and moderation state.

**What the agent does:**

1. `roblox_upload_asset(file_path="./fixtures/badge-icon.png", asset_type="Decal", display_name="Beta Tester Badge", creator={user_id: "12345"})`
   — returns an operation.
2. `roblox_get_asset_operation(operation_id=...)` — polls until `done`.
3. Returns the resulting `assetId` and `moderationResult.moderationState`.

**Scopes exercised:** `asset:read`, `asset:write`.

---

## Demo 8 — Send an experience notification

**Scenario:** a user just hit a milestone and you want to fire off a
pre-configured notification template so they see a push in the Roblox
app.

**Prompt:**

> Send an experience notification to user `12345` from universe
> `123456` using the `milestone-reached` template. Fill in the
> parameter `milestoneName=First Victory`.

**What the agent does:**

1. `roblox_send_user_notification(user_id="12345", universe_id="123456", message_id="milestone-reached", parameters={milestoneName: "First Victory"})`

**Scope exercised:** `user.user-notification:write`.

**Prerequisite:** the `milestone-reached` template must already exist in
Creator Hub → Experience Notifications.

---

## Demo 9 — Translation (generative AI)

**Prompt:**

> Translate "Welcome to the arena, warrior!" into Japanese (ja-JP),
> French (fr-FR), and Brazilian Portuguese (pt-BR) using universe
> `123456`.

**What the agent does:**

1. `roblox_translate_text(universe_id="123456", text="…", target_language_codes=["ja-JP", "fr-FR", "pt-BR"])`

**Scope exercised:** `universe:write`.

---

## Demo 10 — Ban a griefer

**Scenario:** a griefer has been reported. Temp-ban them for 24 hours
with a private reason and an age-appropriate public reason.

**Prompt:**

> In universe `123456`, ban user `98765` for 24 hours. Private reason:
> "griefing + alt abuse". Display reason: "violation of community
> standards — temporary restriction". Exclude alt accounts so they
> can't evade.

**What the agent does:**

1. `roblox_update_user_restriction(universe_id=..., user_id="98765", active=true, duration="86400s", private_reason="...", display_reason="...", exclude_alt_accounts=true)`

**Scope exercised:** `universe.user-restriction:write`.

---

## Demo 11 — Rate limit proof

**Scenario:** deliberately burst 600 quick reads at the server to
confirm the token-bucket rate limiter kicks in and paces the calls
instead of failing.

**Prompt:**

> List data stores for universe `123456` 600 times in a row and
> report the total wall-clock time and whether any request was
> rejected.

**What the agent does:**

1. Loops `roblox_list_data_stores` 600 times.
2. Internal rate limiter paces them under the 500 req/min shared
   ceiling. With a test key that has no other traffic, expect about
   72 seconds of wall-clock time for 600 calls.
3. No request should error out — all should succeed, just paced.

**Observability:** tail stderr while the demo runs. Each call emits a
JSON-per-line log with `tool_name`, `latency_ms`, and `result_status`.
When the bucket is >80% full, you'll see a warning line flagging
rate-limit pressure.

---

## Troubleshooting demos

- **403 on any write path** → the API key is missing the required
  scope. The error message from the tool names the exact scope. Add it
  in Creator Hub → Credentials → your key.
- **404 on `roblox_get_luau_task`** → the task path format is
  deeply nested. Use the path string the server handed back from
  `roblox_execute_luau`, not a reconstructed one.
- **Large DataStore entries get truncated** → the server caps text
  responses at 25k characters. Use `response_format="json"` and pipe
  through your own parser if you need the raw blob.
- **Silence on an operation poll** → `get_asset_operation` and
  `get_user_thumbnail_operation` return "still in progress" when the
  Roblox side hasn't finished. Wait a second and re-poll.
