// Registers the /wishlist slash command with Discord.
// Run once (and again whenever the command definition changes):
//   node --env-file=.env.local scripts/register-command.mjs
//
// Global commands can take a few minutes to propagate. For instant testing in a
// single server, set DISCORD_GUILD_ID and it registers a guild command instead.

const appId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID; // optional

if (!appId || !token) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN.");
  process.exit(1);
}

const STRING = 3;

// Note: owner-only is enforced in code via DISCORD_OWNER_ID (see the route).
// We deliberately DON'T set default_member_permissions: "0" here — that flag
// hides commands from everyone (even you) unless you add per-command overrides
// in Server Settings → Integrations. The code gate is the real lock.
const commands = [
  {
    name: "wishlist",
    description: "Add a link to your wishlist",
    options: [
      { name: "url", description: "The product link", type: STRING, required: true },
    ],
  },
  {
    name: "list",
    description: "Show the whole wishlist (owner only)",
  },
  {
    name: "received",
    description: "Mark a wishlist item as received (owner only)",
    options: [
      {
        name: "query",
        description: "Search by title, store, or link",
        type: STRING,
        required: true,
      },
    ],
  },
  {
    name: "remove",
    description: "Remove a wishlist item (owner only)",
    options: [
      {
        name: "query",
        description: "Search by title, store, or link",
        type: STRING,
        required: true,
      },
    ],
  },
];

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

// PUT bulk-overwrites the full command set (idempotent; prunes old commands).
const res = await fetch(endpoint, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (res.ok) {
  const names = commands.map((c) => `/${c.name}`).join(", ");
  console.log(`✅ Registered ${names} (${guildId ? "guild" : "global"}).`);
} else {
  console.error(`❌ ${res.status}:`, await res.text());
  process.exit(1);
}
