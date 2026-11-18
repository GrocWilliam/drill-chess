// HTTP domain layer for recording endgame attempts (US-108). No assertions of a criterion here.

/** POST /api/endgames/<id>/attempts with a JSON body (or `raw` text) → { status, body } (body parsed JSON or null). */
export async function recordAttempt(baseUrl, token, id, body, { raw } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: baseUrl };
  if (token) headers.Cookie = `session=${token}`;
  const r = await fetch(`${baseUrl}/api/endgames/${id}/attempts`, {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await r.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: r.status, body: parsed };
}

export const passAttempt = (baseUrl, token, id) => recordAttempt(baseUrl, token, id, { passed: true });
export const failAttempt = (baseUrl, token, id) => recordAttempt(baseUrl, token, id, { passed: false });
