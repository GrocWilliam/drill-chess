// Reads the mail outbox (MAIL_OUTBOX) written by the app's mail gateway. No assertions of a criterion here.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Names of the files in the outbox (empty when the folder does not exist yet). */
export function outboxFiles(outbox) {
  try {
    return readdirSync(outbox).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

export const outboxCount = (outbox) => outboxFiles(outbox).length;

/** Files sorted oldest → newest by their `<epochms>-<uuid>.json` name. */
function byAge(files) {
  return [...files].sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]) || a.localeCompare(b));
}

/** The names of files added since `before` (a list of names from outboxFiles). */
export function newFiles(outbox, before) {
  return outboxFiles(outbox).filter((f) => !before.includes(f));
}

/** The parsed `{to, subject, text}` of the newest outbox file whose `to` is `to`, or null. */
export function newestMailTo(outbox, to) {
  for (const f of byAge(outboxFiles(outbox)).reverse()) {
    const mail = JSON.parse(readFileSync(join(outbox, f), 'utf8'));
    if (mail.to === to) return { ...mail, file: f };
  }
  return null;
}

/** Like newestMailTo, but waits (up to 4 s) for the file to appear. */
export async function waitForMailTo(outbox, to) {
  const end = Date.now() + 4000;
  for (;;) {
    const m = newestMailTo(outbox, to);
    if (m || Date.now() > end) return m;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** The first `<origin>/reset/<token>` link of a mail text → { url, token } or null. */
export function resetLinkIn(text) {
  const m = /(https?:\/\/[^\s]+?\/reset\/([^\s/?#]+))/.exec(text ?? '');
  return m ? { url: m[1], token: m[2] } : null;
}
