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

const command = {
  name: "wishlist",
  description: "Add a link to your wishlist",
  options: [
    {
      name: "url",
      description: "The product link",
      type: 3, // STRING
      required: true,
    },
  ],
};

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
});

if (res.ok) {
  console.log(`✅ /wishlist registered (${guildId ? "guild" : "global"}).`);
} else {
  console.error(`❌ ${res.status}:`, await res.text());
  process.exit(1);
}
