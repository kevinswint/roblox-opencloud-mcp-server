# Roblox Open Cloud MCP Server

An MCP (Model Context Protocol) server that exposes Roblox Open Cloud APIs as tools for AI agents. Enables agents to manage experiences, execute Luau scripts, interact with data stores, publish messages to game servers, and manage monetization products.

## Tools (16 total)

### Luau Execution (most powerful)
- `roblox_execute_luau` — Execute Luau scripts headlessly in running experiences
- `roblox_get_luau_task` — Check status of a previously submitted execution task

### Data Stores
- `roblox_list_data_stores` — List all data stores in an experience
- `roblox_list_data_store_entries` — List entries (keys) in a data store
- `roblox_get_data_store_entry` — Read a single entry by key
- `roblox_set_data_store_entry` — Create or update an entry
- `roblox_delete_data_store_entry` — Delete an entry

### Messaging
- `roblox_publish_message` — Publish messages to running game servers via topics

### Experience Management
- `roblox_get_universe` — Get experience details (name, visibility, platforms, etc.)
- `roblox_update_universe` — Update experience settings
- `roblox_restart_servers` — Restart all servers (deploy new version)
- `roblox_get_place` — Get place details
- `roblox_update_place` — Update place settings

### Monetization
- `roblox_list_developer_products` — List developer products (repeatable purchases)
- `roblox_create_developer_product` — Create a new developer product
- `roblox_list_game_passes` — List game passes (one-time purchases)
- `roblox_create_game_pass` — Create a new game pass

## Setup

### 1. Get a Roblox API Key

Go to [create.roblox.com/dashboard/credentials](https://create.roblox.com/dashboard/credentials) and create an API key with the scopes you need.

### 2. Install & Build

```bash
npm install
npm run build
```

### 3. Add to Claude Desktop / Claude Code

```bash
# Claude Code
claude mcp add roblox-opencloud -- env ROBLOX_API_KEY=your_key node /path/to/dist/index.js

# Or set the env var globally
export ROBLOX_API_KEY=your_key
claude mcp add roblox-opencloud -- node /path/to/dist/index.js
```

### 4. Or run as HTTP server

```bash
TRANSPORT=http ROBLOX_API_KEY=your_key npm start
# Server available at http://localhost:3000/mcp
```

## API Key Scopes

| Tool Domain | Required Scopes |
|------------|----------------|
| Luau Execution | `luau-execution-sessions:write`, `luau-execution-sessions:read` |
| Data Stores | `universe-datastores.objects:list`, `universe-datastores.objects:read`, `universe-datastores.objects:write` |
| Messaging | `universe.messaging-service:publish` |
| Universes/Places | `universe:read`, `universe:write` |
| Developer Products | `universe-developer-products:read`, `universe-developer-products:write` |
| Game Passes | `universe-game-passes:read`, `universe-game-passes:write` |

## Architecture

```
src/
├── index.ts              # Entry point, server init, transport setup
├── constants.ts          # API URLs, limits, timeouts
├── types.ts              # TypeScript interfaces for API responses
├── schemas/
│   └── common.ts         # Shared Zod schemas (universe_id, pagination, etc.)
├── services/
│   └── api-client.ts     # HTTP client, auth, error handling, formatting utils
└── tools/
    ├── luau-execution.ts # Execute Luau scripts via Open Cloud
    ├── data-stores.ts    # CRUD on persistent data stores
    ├── messaging.ts      # Publish to game server topics
    ├── universes.ts      # Experience & place management
    └── monetization.ts   # Developer products & game passes
```

## License

MIT
