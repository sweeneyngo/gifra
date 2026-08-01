const API = "https://discord.com/api/v10";

/**
 * Edit the original deferred reply for an interaction. No auth header needed —
 * the interaction token in the URL is the credential. Called after the slow
 * enrichment work finishes.
 */
export async function editOriginalReply(
  interactionToken: string,
  content: string,
): Promise<void> {
  const appId = process.env.DISCORD_APPLICATION_ID;
  await fetch(
    `${API}/webhooks/${appId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
}

/** Pull the first string option value (our single `url` arg) out of a command. */
export function getOption(
  data: { options?: { name: string; value: unknown }[] },
  name: string,
): string | null {
  const opt = data.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : null;
}
