# gifra

My public page. First surface is a dead-simple, cross-storefront **wishlist**:
post a product link with `/wishlist` in Discord and it appears as a card
(image · name · link). Click **✓ received** to gray it out.

Works with any storefront that exposes Open Graph tags (Etsy, Big Cartel,
Shopify stores, most of the web). Amazon/eBay often serve thin or blocked HTML
to bots — those links still save, just with less rich data.

## Stack

- **Next.js 15** (App Router) — hosts both the web UI and the Discord endpoint
- **Neon serverless Postgres** — via `@neondatabase/serverless`
- **Discord slash command** (`/wishlist <url>`) — the "add item" doorway

## How the Discord flow works

```
/wishlist <url>
   → POST /api/discord     (Ed25519 signature verified)
   → reply "type 5" deferred ack   (beats Discord's 3s deadline)
   → after(): scrape OG tags → insert row → PATCH reply "✅ Added: <title>"
```

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

### 2. Database (Neon)

Create a project at [neon.tech](https://neon.tech), copy the **pooled**
connection string into `DATABASE_URL`, then:

```bash
node --env-file=.env.local scripts/db-init.mjs
```

### 3. Discord app

1. [Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Copy **Application ID** and **Public Key** into `.env.local`.
3. **Bot** tab → reset token → copy into `DISCORD_BOT_TOKEN`.
4. **OAuth2 → URL Generator** → scope `applications.commands` → invite to your server.
5. Register the command:

   ```bash
   # instant in one server: also set DISCORD_GUILD_ID in .env.local
   node --env-file=.env.local scripts/register-command.mjs
   ```

### 4. Run & expose

```bash
npm run dev          # http://localhost:3000
```

Discord must reach your endpoint over HTTPS. For local testing, tunnel it:

```bash
npx localtunnel --port 3000     # or ngrok, cloudflared
```

Then in the Developer Portal set **Interactions Endpoint URL** to
`https://<your-tunnel>/api/discord`. Discord sends a PING to verify it — the
route answers automatically. In production this is just
`https://<your-vercel-app>/api/discord`.

## Deploy (Vercel)

```bash
vercel
```

Add the same env vars in the Vercel dashboard, set the Interactions Endpoint URL
to your deployed `/api/discord`, and you're done.

## Adding more storefronts

Enrichment is generic (Open Graph), so new stores work with zero code. To add a
friendly name, extend the `known` map in [`src/lib/enrich.ts`](src/lib/enrich.ts).
For hostile stores (Amazon), swap the `enrich()` fetch for that store's official
API (PA-API, eBay Browse, Etsy API) keyed off `storeName()`.
