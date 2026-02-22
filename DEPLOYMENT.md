# Fastmail MCP — Fly.io Deployment & Poke Integration

This document covers how the server is deployed to Fly.io, how it integrates with Poke, and the problems encountered and fixed along the way.

---

## Architecture overview

```
Poke (cloud) ──HTTPS──► Fly.io (fastmail-mcp.fly.dev)
                              │
                         Express HTTP server (src/http-server.ts)
                              │  validates Bearer token
                              │  manages MCP sessions
                              │
                         MCP Server (src/server.ts)
                              │  createServer() factory
                              │
                         Fastmail JMAP API
```

The MCP server was originally stdio-only (for local use with Claude Desktop). For Poke, it needed to be wrapped in an HTTP transport and deployed to a public HTTPS endpoint.

---

## How it works

`src/http-server.ts` is the entry point when running on Fly.io. It:

1. Starts an Express server on `$PORT` (8080)
2. Validates `Authorization: Bearer $MCP_API_KEY` on every request
3. Manages MCP sessions — each new client gets a `StreamableHTTPServerTransport` instance stored in a `Map` by session ID
4. For each new session, calls `createServer()` from `src/server.ts` and connects it to the transport

`src/index.ts` remains the stdio entry point for local use (Claude Desktop, `npx`, etc.) and is completely unchanged in behavior.

---

## Deployment

### Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated
- A Fastmail API token (Settings → Privacy & Security → Connected Apps & API Tokens)
- Docker (for local build testing)

### Secrets

These secrets must be set on the Fly.io app before deploying:

```bash
# Generate and set a strong random API key for Poke to authenticate with
fly secrets set MCP_API_KEY=$(openssl rand -hex 32) --app fastmail-mcp

# Your Fastmail JMAP API token (Settings → Privacy & Security → Connected Apps & API Tokens)
fly secrets set FASTMAIL_API_TOKEN=<your_token> --app fastmail-mcp

# CalDAV credentials for calendar access (uses a separate app password, not the JMAP token)
# Step 1: Log into Fastmail → Settings → Privacy & Security → App Passwords
# Step 2: Click "New App Password", give it a name (e.g. "fastmail-mcp"), copy the generated password
fly secrets set FASTMAIL_USERNAME=<your_email@fastmail.com> --app fastmail-mcp
fly secrets set FASTMAIL_CALDAV_PASSWORD=<your_app_password> --app fastmail-mcp
```

Save the `MCP_API_KEY` value — you'll need to paste it into Poke.

> **Why a separate app password for calendars?**
> Fastmail does not yet expose calendars via JMAP. Calendar access uses CalDAV (a separate
> protocol over HTTPS) which authenticates with HTTP Basic auth — your email address plus a
> Fastmail *app password* (not the JMAP API token). The two credentials serve different APIs.

### Deploy

```bash
fly deploy --app fastmail-mcp
```

Or push to `main` to trigger the GitHub Actions workflow (`.github/workflows/fly-deploy.yml`).

### Verify

```bash
# 401 with no key
curl -i https://fastmail-mcp.fly.dev/mcp

# 401 with wrong key
curl -i -H "Authorization: Bearer wrongkey" https://fastmail-mcp.fly.dev/mcp

# Full handshake with correct key (replace KEY with your MCP_API_KEY value)
SESSION=$(curl -si -X POST https://fastmail-mcp.fly.dev/mcp \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

curl -s -X POST https://fastmail-mcp.fly.dev/mcp \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_mailboxes","arguments":{}}}'
```

---

## Poke integration setup

In Poke → Integration Library → Create Custom Integration:

| Field | Value |
|---|---|
| Name | Fastmail |
| MCP Server URL | `https://fastmail-mcp.fly.dev/mcp` |
| API Key | your `MCP_API_KEY` value |

Test it in a Poke chat: *"list my mailboxes"* or *"what are my most recent emails?"*

---

## Problems found and fixed

### Problem 1: No authentication on the original deployment

The original `dockerfile` ran `mcp-proxy` with no `--apiKey` flag:

```dockerfile
CMD ["mcp-proxy", "--port", "8080", "--", "node", "dist/index.js"]
```

Anyone who discovered the Fly.io URL could issue arbitrary MCP tool calls against the Fastmail account. The fix was to pass `--apiKey "$MCP_API_KEY"` using shell form so the env var is expanded at runtime:

```dockerfile
CMD mcp-proxy --port 8080 --apiKey "$MCP_API_KEY" -- node dist/index.js
```

This worked as intended — unauthenticated curl requests returned 401.

---

### Problem 2: mcp-proxy is incompatible with Poke on three fronts

After adding the API key, Poke rejected the integration with *"Invalid MCP server URL"* and then *"Connection failed: Invalid API key"*. Investigation revealed that `mcp-proxy` and Poke are fundamentally mismatched:

| Requirement | mcp-proxy | Poke |
|---|---|---|
| Endpoint path | `/sse` | `/mcp` |
| HTTP transport | Legacy SSE (old spec) | Streamable HTTP (MCP spec 2025-03-26) |
| Auth header | `X-API-Key: <token>` | `Authorization: Bearer <token>` |

Poke uses the modern MCP Streamable HTTP transport where the client POSTs JSON to a single `/mcp` endpoint (with optional SSE upgrade for server-initiated messages). `mcp-proxy` only implements the older SSE transport (`GET /sse` to establish a stream, `POST /message` to send requests).

**Fix:** replaced `mcp-proxy` entirely with a custom `src/http-server.ts` that uses `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` v1.x. This required:

- Upgrading `@modelcontextprotocol/sdk` from `^0.6.0` to `^1.0.0` (the `StreamableHTTPServerTransport` class was introduced in 1.x)
- Adding `express` as a runtime dependency
- Extracting the MCP server logic into `src/server.ts` as a `createServer()` factory so that both the stdio entry point (`src/index.ts`) and the HTTP entry point share the same tool implementation
- Updating the `dockerfile` to remove `mcp-proxy` and run `node dist/http-server.js` instead

The auth check in `http-server.ts` looks for the `Authorization: Bearer <token>` header that Poke sends:

```typescript
function checkAuth(req, res): boolean {
  if (!apiKey) return true;
  if (req.headers['authorization'] === `Bearer ${apiKey}`) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
```

---

### Problem 3: MCP sessions broken by Fly.io load balancing across two machines

After fixing the transport mismatch, the MCP handshake failed with *"Session not found"* on every request after the initial `initialize`. The session IDs were being generated correctly (visible in response headers) but subsequent requests couldn't find the session.

**Root cause:** Fly.io was running **two machines** by default. MCP session state (`StreamableHTTPServerTransport` instances) is stored in a `Map` in memory on each Node.js process. A session created on machine A is invisible to machine B. Fly.io was load-balancing the `initialize` request to machine A and the subsequent tool call to machine B.

```
Request 1 (initialize) ──► Machine A  ← session stored here
Request 2 (tool call)  ──► Machine B  ← "Session not found"
```

This was confirmed via `fly status`:

```
PROCESS  ID              VERSION  REGION  STATE
app      8270ddbed60218  3        yyz     started
app      83756eb5427558  3        yyz     started
```

**Fix:** scaled down to a single machine and capped it there:

```bash
fly scale count 1 --app fastmail-mcp --yes
```

And in `fly.toml`:

```toml
[http_service]
  min_machines_running = 1
  max_machines_running = 1
```

With a single instance, session state is always local to the one process and the full MCP handshake works reliably.

> **Note:** If horizontal scaling becomes necessary in the future, the in-memory session `Map` would need to be replaced with an external store (Redis, etc.) or the server would need to be redesigned for stateless operation. For a personal single-user deployment this is not needed.

---

## File reference

| File | Purpose |
|---|---|
| `src/http-server.ts` | HTTP entry point for Fly.io. Handles Bearer auth, session management, Streamable HTTP transport |
| `src/server.ts` | `createServer()` factory — all MCP tool definitions and handlers |
| `src/caldav-client.ts` | CalDAV client for calendar access (uses `tsdav` + Fastmail app password) |
| `src/contacts-calendar.ts` | JMAP contacts client |
| `src/index.ts` | stdio entry point for local use (Claude Desktop, `npx`) |
| `src/__tests__/` | vitest test suites — must pass before Fly.io deploy |
| `dockerfile` | Two-stage build. Runs `node dist/http-server.js` |
| `fly.toml` | Fly.io config. Single machine, port 8080, HTTPS enforced |
| `.github/workflows/fly-deploy.yml` | CI/CD — runs `npm test` then deploys to Fly.io on push to `main` |
