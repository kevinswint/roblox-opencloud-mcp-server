# Roblox Open Cloud MCP Server

A production-shape MCP (Model Context Protocol) server that wraps the
public Roblox Open Cloud surface as typed tools for AI agents. Use it
to manage experiences, run Luau headlessly, read and write Data Stores
and Memory Stores, ship monetization products, handle moderation,
send experience notifications, and more — from inside Claude Code,
Claude Desktop, Cursor, or any MCP-compatible client.

> **v0.1.1** — **96 tools** across **18 domains**.
> Paired with a strategic [LIMITATIONS.md](LIMITATIONS.md) that maps
> the programmatic gaps in the Open Cloud surface. The server is
> as useful for telling you what you _can't_ do from outside Roblox
> as it is for what you can.

---

## Quickstart (5 minutes)

```bash
# 1. Clone and build
git clone https://github.com/kevinswint/roblox-opencloud-mcp-server.git
cd roblox-opencloud-mcp-server
npm install
npm run build

# 2. Create an API key at
#    https://create.roblox.com/dashboard/credentials
#    with the scopes you need (see "Scopes" below)

# 3. Register with Claude Code (stdio transport)
claude mcp add roblox-opencloud-mcp \
  -e ROBLOX_API_KEY=your_key_here \
  -- node "$(pwd)/dist/index.js"

# 4. Verify — lists every registered tool
npm run list-tools
```

You should now be able to ask Claude Code things like:

> "Pull the last 5 data store entries for user 12345 from the
> `UserProgress` store in universe 123456."

And have it happen without any manual Creator Hub clicking.

See [DEMOS.md](DEMOS.md) for 11 end-to-end agent flows you can copy-paste.

---

## Transport modes

**stdio** (default, recommended for local desktop clients):

```bash
ROBLOX_API_KEY=your_key node dist/index.js
```

**HTTP** (for remote multi-client access):

```bash
TRANSPORT=http ROBLOX_API_KEY=your_key PORT=3000 node dist/index.js
# Server listens on http://localhost:3000/mcp
# Health check: http://localhost:3000/health
```

Both modes are powered by the official `@modelcontextprotocol/sdk` —
no custom transport. Swap between them by flipping `TRANSPORT`.

---

## Configuration

| Env var           | Required | Default     | Purpose                                    |
|-------------------|----------|-------------|--------------------------------------------|
| `ROBLOX_API_KEY`  | ✅       | —           | Open Cloud API key from Creator Hub        |
| `TRANSPORT`       |          | `stdio`     | `stdio` or `http`                          |
| `PORT`            |          | `3000`      | Only used when `TRANSPORT=http`            |

---

## Tool index (96 tools)

Run `npm run list-tools` to regenerate this list from the source of
truth. Below is a hand-grouped view.

### Luau Execution (2)
| Tool | What it does |
|---|---|
| `roblox_execute_luau` | Submit a Luau script against a place and return a task path |
| `roblox_get_luau_task` | Poll a Luau task until `COMPLETE` and read its output |

### Data Stores (7)
| Tool | What it does |
|---|---|
| `roblox_list_data_stores` | List all data stores in a universe |
| `roblox_list_data_store_entries` | List entries (keys) in a store |
| `roblox_get_data_store_entry` | Read a single entry by key |
| `roblox_set_data_store_entry` | Create or update an entry |
| `roblox_delete_data_store_entry` | Delete an entry |
| `roblox_increment_data_store_entry` | Atomically add to a numeric entry |
| `roblox_list_data_store_entry_revisions` | List prior revisions for audit/rollback |

### Ordered Data Stores (6)
| Tool | What it does |
|---|---|
| `roblox_list_ordered_data_store_entries` | List entries sorted by value |
| `roblox_get_ordered_data_store_entry` | Read a single ordered entry |
| `roblox_create_ordered_data_store_entry` | Create a new ordered entry |
| `roblox_update_ordered_data_store_entry` | Update an ordered entry's value |
| `roblox_increment_ordered_data_store_entry` | Atomically bump a numeric value |
| `roblox_delete_ordered_data_store_entry` | Delete an ordered entry |

### Memory Stores (10)
| Tool | What it does |
|---|---|
| `roblox_memory_store_queue_add` | Enqueue an item with optional priority + expiry |
| `roblox_memory_store_queue_read` | Dequeue items with invisibility window |
| `roblox_memory_store_queue_discard` | Discard previously-read items |
| `roblox_list_memory_store_sorted_map_items` | List sorted-map entries |
| `roblox_get_memory_store_sorted_map_item` | Get one sorted-map entry |
| `roblox_create_memory_store_sorted_map_item` | Create a new sorted-map entry |
| `roblox_update_memory_store_sorted_map_item` | Update an existing sorted-map entry |
| `roblox_delete_memory_store_sorted_map_item` | Delete a sorted-map entry |
| `roblox_flush_memory_store` | Flush the whole memory store (async op) |
| `roblox_get_memory_store_operation` | Poll a memory-store long-running op |

### Messaging (1)
| Tool | What it does |
|---|---|
| `roblox_publish_message` | Publish to a topic using Messaging v2 (with v1 fallback) |

### Experience & Place Management (5)
| Tool | What it does |
|---|---|
| `roblox_get_universe` | Read experience metadata |
| `roblox_update_universe` | Patch experience settings (name, visibility, voice, etc.) |
| `roblox_restart_servers` | Force-restart all running servers |
| `roblox_get_place` | Read place metadata |
| `roblox_update_place` | Patch place settings |

### Monetization — Developer Products & Game Passes (8)
| Tool | What it does |
|---|---|
| `roblox_list_developer_products` | List all developer products for a universe |
| `roblox_create_developer_product` | Create a new developer product |
| `roblox_get_developer_product` | Read one developer product |
| `roblox_update_developer_product` | Update a developer product (price, name, desc) |
| `roblox_list_game_passes` | List all game passes |
| `roblox_create_game_pass` | Create a new game pass |
| `roblox_get_game_pass` | Read one game pass |
| `roblox_update_game_pass` | Update a game pass (price, name, desc, forSale) |

### Creator Store Products (2)
| Tool | What it does |
|---|---|
| `roblox_get_creator_store_product` | Read a Creator Store product |
| `roblox_update_creator_store_product` | Update metadata or base price |

### Configs (GA March 10 2026) (8)
| Tool | What it does |
|---|---|
| `roblox_get_config` | Read the currently-published config |
| `roblox_get_config_draft` | Read the unpublished draft |
| `roblox_update_config_draft` | Merge partial data into the draft |
| `roblox_replace_config_draft` | Overwrite the entire draft |
| `roblox_delete_config_draft` | Discard the draft |
| `roblox_publish_config` | Publish the current draft |
| `roblox_list_config_revisions` | List revision history |
| `roblox_restore_config_revision` | Restore a previous revision as current |

### Universe Secrets (5)
| Tool | What it does |
|---|---|
| `roblox_list_secrets` | List secrets for a universe |
| `roblox_get_secret_public_key` | Get the encryption public key for a universe |
| `roblox_create_secret` | Create a new secret (auto-encrypts with LibSodium sealed box) |
| `roblox_update_secret` | Rotate a secret value (auto-encrypts with LibSodium sealed box) |
| `roblox_delete_secret` | Delete a secret |

### Moderation — User Restrictions (4)
| Tool | What it does |
|---|---|
| `roblox_list_user_restrictions` | List all bans on a universe |
| `roblox_get_user_restriction` | Get ban details for one user |
| `roblox_update_user_restriction` | Ban, unban, or extend a restriction |
| `roblox_list_user_restriction_logs` | Audit log of restriction changes |

### Assets (10)
| Tool | What it does |
|---|---|
| `roblox_upload_asset` | Upload a new asset (multipart) |
| `roblox_get_asset` | Fetch asset metadata |
| `roblox_update_asset` | Update metadata or swap file content |
| `roblox_list_asset_versions` | List prior asset versions |
| `roblox_get_asset_version` | Read one asset version |
| `roblox_rollback_asset_version` | Revert to a prior version |
| `roblox_archive_asset` | Hide asset from Creator Hub |
| `roblox_restore_asset` | Unarchive a hidden asset |
| `roblox_get_asset_operation` | Poll a long-running upload operation |
| `roblox_get_user_asset_quota` | Read a user's asset upload quota |

### Groups (9)
| Tool | What it does |
|---|---|
| `roblox_get_group` | Read group metadata |
| `roblox_list_group_memberships` | List members |
| `roblox_list_group_roles` | List roles |
| `roblox_get_group_role` | Get role details |
| `roblox_list_group_join_requests` | Pending join requests |
| `roblox_accept_group_join_request` | Accept a join request |
| `roblox_decline_group_join_request` | Decline a join request |
| `roblox_update_group_membership_role` | Change a member's role |
| `roblox_get_group_shout` | Read the group shout |

### Users & Inventory (4)
| Tool | What it does |
|---|---|
| `roblox_get_user` | Read user profile |
| `roblox_generate_user_thumbnail` | Kick off avatar thumbnail generation |
| `roblox_get_user_thumbnail_operation` | Poll the thumbnail op |
| `roblox_list_user_inventory` | List a user's inventory items (filterable) |

### Badges (6)
| Tool | What it does |
|---|---|
| `roblox_get_badge` | Read badge metadata + stats |
| `roblox_list_universe_badges` | List badges for a universe |
| `roblox_list_user_badges` | List badges owned by a user |
| `roblox_get_badge_awarded_date` | When a user earned a specific badge |
| `roblox_get_universe_badge_quota` | Free-badge quota remaining |
| `roblox_update_badge` | Update badge metadata (legacy PATCH) |

### Thumbnails (5)
| Tool | What it does |
|---|---|
| `roblox_get_user_headshots` | Batch avatar headshots |
| `roblox_get_game_icons` | Batch experience icons |
| `roblox_get_asset_thumbnails` | Batch asset thumbnails |
| `roblox_get_group_icons` | Batch group icons |
| `roblox_batch_get_thumbnails` | Mixed-type batch request |

### Notifications (1)
| Tool | What it does |
|---|---|
| `roblox_send_user_notification` | Send an experience notification via template |

### Generative AI (3)
| Tool | What it does |
|---|---|
| `roblox_generate_speech_asset` | Text-to-speech → audio asset (async op) |
| `roblox_translate_text` | Translate text into one or more locales |
| `roblox_get_generative_operation` | Poll a generative AI operation |

---

## Scopes

Configure your API key with the scopes you actually need. The server
reports a structured error pointing at the exact missing scope on a
`403` so you can react without guessing.

| Domain | Scopes |
|---|---|
| Luau Execution | `universe.place.luau-execution-session:read`, `universe.place.luau-execution-session:write` |
| Data Stores (std) | `universe-datastores.objects:list/read/create/update/delete`, `universe-datastores.versions:list`, `universe-datastores.control:list/delete/snapshot` |
| Ordered Data Stores | `universe.ordered-data-store.scope.entry:read`, `universe.ordered-data-store.scope.entry:write` |
| Memory Stores | `universe.memory-store.queue:read/write`, `universe.memory-store.sorted-map:read/write` |
| Messaging | `universe.messaging-service:publish` |
| Universes/Places | `universe:read`, `universe:write` |
| Developer Products | `universe.developer-product:read`, `universe.developer-product:write` |
| Game Passes | `universe.game-pass:read`, `universe.game-pass:write` |
| Creator Store | `creator-store-product:read`, `creator-store-product:write` |
| Configs | `universe.creator-configs:read`, `universe.creator-configs:write` |
| Universe Secrets | `universe.secrets:list/read/write/delete` |
| User Restrictions | `universe.user-restriction:read`, `universe.user-restriction:write` |
| Assets | `asset:read`, `asset:write` |
| Groups | `group:read`, `group:write` |
| Users / Inventory | `user.inventory-item:read`, optionally `user.advanced:read`, `user.social:read` |
| Badges (legacy) | `legacy-universe.badge:manage-and-spend-robux`, `legacy-universe.badge:write` |
| Thumbnails | _none_ (public endpoint) |
| Notifications | `user.user-notification:write` |
| Generative AI (speech) | `universe:write`, `asset:read`, `asset:write` |
| Generative AI (translate) | `universe:write` |

---

## Architecture

```
src/
├── index.ts                  — Server init, transport setup, tool registration
├── constants.ts              — API base URLs, limits, timeouts
├── types.ts                  — Shared response-shape interfaces
├── schemas/
│   └── common.ts             — Shared Zod schemas (universe_id, pagination, etc.)
├── services/
│   ├── api-client.ts         — HTTP client, auth, rate-limited requests, error mapping
│   ├── rate-limiter.ts       — Token-bucket, 500 req/min shared ceiling per API key
│   └── logger.ts             — Structured JSON-per-line stderr logging
├── scripts/
│   └── list-tools.ts         — Discovery harness (`npm run list-tools`)
└── tools/
    ├── luau-execution.ts
    ├── data-stores.ts
    ├── ordered-data-stores.ts
    ├── memory-stores.ts
    ├── messaging.ts
    ├── universes.ts
    ├── monetization.ts
    ├── creator-store.ts
    ├── config.ts
    ├── secrets.ts
    ├── user-restrictions.ts
    ├── assets.ts
    ├── groups.ts
    ├── users.ts
    ├── badges.ts
    ├── thumbnails.ts
    ├── notifications.ts
    └── generative-ai.ts
```

Every tool handler goes through:

1. **`wrapTool`** (logger.ts) — records `(tool_name, input_hash, latency_ms, result_status)` as JSON to stderr. Stdout is reserved for the MCP protocol itself.
2. **`rateLimiter.acquire()`** (rate-limiter.ts) — paces calls under the 500 req/min shared Open Cloud ceiling per API key. Emits a warning to stderr when the bucket is >80% full.
3. **`makeApiRequest`** (api-client.ts) — adds `x-api-key`, applies timeout, parses structured API errors into human-readable messages that name the missing scope on 403s.
4. **`truncateResponse`** — caps markdown text responses at 25k characters so MCP clients don't choke on huge DataStore blobs. Use `response_format="json"` to bypass when you need raw data.

---

## Troubleshooting

**`Error: ROBLOX_API_KEY environment variable is required`**
Set the env var before starting the server. With Claude Code, use
`claude mcp add ... -- env ROBLOX_API_KEY=...`.

**`403 Forbidden: missing scope "..."`**
The API key doesn't have the scope the tool needs. Open
[create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials),
edit your key, add the scope, save, and retry.

**`429 Too Many Requests`**
Rate-limit ceiling exceeded despite the internal pacing. This usually
means the same API key is in use from another process. Check your
server logs for the rate-limit warning lines and either slow down or
provision a second key.

**Large responses are getting truncated**
The server caps markdown responses at 25,000 characters to protect
MCP clients. Pass `response_format="json"` to bypass the cap.

**Luau Execution task stuck in `PROCESSING`**
The Luau Execution API is still Beta. Check Creator Hub → Account
Settings → Beta Features → "Open Cloud Luau Execution" is enabled for
the owning user/group. See [LIMITATIONS.md](LIMITATIONS.md).

---

## What's not wrapped

See [LIMITATIONS.md](LIMITATIONS.md) for the full map of Open Cloud
surfaces this server deliberately doesn't wrap (cookie-only APIs,
unstable betas, and the long tail of Creator Hub features with no
public programmatic surface). That document is the strategic core of
this project — it turns the MCP server into a gap analysis you can act
on.

---

## License

MIT — see [LICENSE](LICENSE).
