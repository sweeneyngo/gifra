import { verifyKey } from "discord-interactions";
import { after } from "next/server";
import { insertItem } from "@/lib/db";
import { enrich } from "@/lib/enrich";
import { editOriginalReply, getOption } from "@/lib/discord";

// Discord interaction & response type constants.
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const DEFERRED_REPLY = 5;

export async function POST(req: Request): Promise<Response> {
  // 1. Verify the Ed25519 signature over the RAW body. Discord rejects the
  //    endpoint at registration time if this isn't enforced.
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
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // 2. Discord health-check handshake.
  if (body.type === PING) {
    return Response.json({ type: PONG });
  }

  // 3. Our /wishlist command.
  if (body.type === APPLICATION_COMMAND && body.data?.name === "wishlist") {
    const url = getOption(body.data, "url");
    const token = body.token;

    if (!url || !/^https?:\/\//i.test(url)) {
      return Response.json({
        type: 4, // immediate reply
        data: { content: "⚠️ That doesn't look like a link.", flags: 64 },
      });
    }

    // Do the slow scrape AFTER responding, so we beat Discord's 3s deadline.
    after(async () => {
      try {
        const data = await enrich(url);
        const item = await insertItem({
          url: data.url,
          title: data.title,
          image_url: data.image_url,
          store: data.store,
        });
        const label = item.title ?? item.url;
        const where = item.store ? ` · ${item.store}` : "";
        await editOriginalReply(token, `✅ Added: **${label}**${where}`);
      } catch (err) {
        await editOriginalReply(
          token,
          `⚠️ Saved the link but couldn't finish: ${String(err)}`,
        );
      }
    });

    // 4. Immediately acknowledge with a deferred ("⏳ thinking…") reply.
    return Response.json({ type: DEFERRED_REPLY });
  }

  return new Response("Unhandled interaction", { status: 400 });
}
