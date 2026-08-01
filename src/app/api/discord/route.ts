import { verifyKey } from "discord-interactions";
import { after } from "next/server";
import {
  insertItem,
  updateItemMeta,
  findItemsByQuery,
  listItems,
  setStatus,
  deleteItem,
} from "@/lib/db";
import { enrich, storeName } from "@/lib/enrich";
import { getOption } from "@/lib/discord";

// Give the background enrichment room to finish.
export const maxDuration = 30;

// Discord interaction & response type constants.
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const EPHEMERAL = 64;

interface Interaction {
  type: number;
  token: string;
  data?: { name?: string; options?: { name: string; value: unknown }[] };
  member?: { user?: { id?: string } };
  user?: { id?: string };
}

function reply(content: string, ephemeral = false): Response {
  return Response.json({
    type: CHANNEL_MESSAGE,
    data: { content, ...(ephemeral ? { flags: EPHEMERAL } : {}) },
  });
}

export async function POST(req: Request): Promise<Response> {
  // Verify the Ed25519 signature over the RAW body.
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();
  if (!signature || !timestamp) {
    return new Response("Bad request", { status: 401 });
  }
  const valid = await verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!,
  );
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const body = JSON.parse(rawBody) as Interaction;

  if (body.type === PING) return Response.json({ type: PONG });

  if (body.type === APPLICATION_COMMAND) {
    const name = body.data?.name;
    if (name === "wishlist") return handleWishlist(body);
    if (name === "list") return handleList(body);
    if (name === "received" || name === "remove") {
      return handleManage(body, name);
    }
  }
  return new Response("Unhandled interaction", { status: 400 });
}

/** Returns a denial response if the caller isn't the configured owner. */
function ownerGate(body: Interaction): Response | null {
  const uid = body.member?.user?.id ?? body.user?.id;
  const owner = process.env.DISCORD_OWNER_ID;
  if (owner && uid !== owner) {
    return reply("⛔ Only the list owner can do that.", true);
  }
  return null;
}

const STATUS_EMOJI: Record<string, string> = {
  wanted: "🛒",
  ordered: "📦",
  received: "✅",
};

async function handleList(body: Interaction): Promise<Response> {
  const denied = ownerGate(body);
  if (denied) return denied;

  const items = await listItems();
  if (items.length === 0) return reply("The wishlist is empty.", true);

  const lines = items.map((i) => {
    const label = i.title ?? i.url;
    const where = i.store ? ` _(${i.store})_` : "";
    return `${STATUS_EMOJI[i.status] ?? "•"} ${label}${where}`;
  });

  let listText = lines.join("\n");
  if (listText.length > 1900) listText = listText.slice(0, 1900) + "\n… (truncated)";

  return reply(`**Wishlist — ${items.length} item(s)**\n${listText}`, true);
}

async function handleWishlist(body: Interaction): Promise<Response> {
  const url = body.data ? getOption(body.data, "url") : null;
  if (!url || !/^https?:\/\//i.test(url)) {
    return reply("⚠️ That doesn't look like a link.", true);
  }

  const store = storeName(url);

  // Save the item SYNCHRONOUSLY so it's never lost — even if the background
  // enrichment below gets frozen/killed after the response is sent.
  let itemId: string;
  try {
    const item = await insertItem({
      url,
      title: null,
      image_url: null,
      store,
    });
    itemId = item.id;
  } catch (err) {
    return reply(`⚠️ Couldn't save that: ${String(err)}`, true);
  }

  // Best-effort: fill in title/image after responding. Non-critical.
  after(async () => {
    try {
      const data = await enrich(url);
      if (data.title || data.image_url) {
        await updateItemMeta(
          itemId,
          data.title,
          data.image_url,
          data.focal_x,
          data.focal_y,
        );
      }
    } catch {
      /* item is already saved; it just keeps the URL as its label */
    }
  });

  return reply(`✅ Added${store ? ` from **${store}**` : ""}: ${url}`);
}

async function handleManage(
  body: Interaction,
  name: "received" | "remove",
): Promise<Response> {
  // Owner gate (defense-in-depth alongside the command's default permissions).
  const denied = ownerGate(body);
  if (denied) return denied;

  const query = body.data ? getOption(body.data, "query") : null;
  if (!query) return reply("Give me a search term.", true);

  const matches = await findItemsByQuery(query, 5);
  if (matches.length === 0) {
    return reply(`No item matches “${query}”.`, true);
  }

  const item = matches[0];
  const label = item.title ?? item.url;
  const extra =
    matches.length > 1
      ? ` _(${matches.length} matched — picked the newest)_`
      : "";

  if (name === "received") {
    await setStatus(item.id, "received");
    return reply(`✅ Marked received: **${label}**${extra}`, true);
  }

  await deleteItem(item.id);
  return reply(`🗑️ Removed: **${label}**${extra}`, true);
}
