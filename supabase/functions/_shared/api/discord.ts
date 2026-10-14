// The Discord webhook (section 12.2). Free, one way, no bot hosting. Posting is best effort: a Tide
// that has been resolved stays resolved even if Discord is down.

import type { Gazette } from "../engine/types.ts";

/** Discord rejects messages over 2000 characters. */
const LIMIT = 1900;

export function gazetteMessage(seasonName: string, tide: number, gazette: Gazette, siteUrl?: string): string {
  const head = `**The Brine Gazette: ${seasonName}, Tide ${tide}**`;
  const tail = siteUrl ? `\nSee the replays: ${siteUrl}` : "";
  const lines: string[] = [];
  let used = head.length + tail.length + 1;
  for (const [i, headline] of gazette.headlines.entries()) {
    const line = `• ${headline}`;
    if (used + line.length + 1 > LIMIT - 40) {
      lines.push(`…and ${gazette.headlines.length - i} more in the Gazette.`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return `${head}\n${lines.join("\n")}${tail}`;
}

export function failureMessage(seasonName: string, tide: number): string {
  return `Tide ${tide} of ${seasonName} could not be resolved. The captains' orders are safe, and the admin can retry it.`;
}

/** Post to a Discord webhook URL. Throws on a non 2xx answer so the caller can log it. */
export async function postToDiscord(
  webhookUrl: string, content: string, fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) throw new Error(`Discord answered ${response.status}`);
}
