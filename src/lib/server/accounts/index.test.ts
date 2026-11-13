import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { close, db, migrate } from '../db';
import { getSessionUser, login, logout, requestPasswordReset, resetPassword, secureCookieFor, sessionCookie, signup, updatePreferences, validateSignup, deleteAccount } from './index';
import { loginFailures, sessions, users } from './schema';

const outbox = mkdtempSync(join(tmpdir(), 'outbox-'));

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('ORIGIN', 'http://localhost:8080');
  vi.stubEnv('SMTP_URL', '');
  vi.stubEnv('MAIL_OUTBOX', outbox);
  await migrate();
});
afterAll(async () => {
  await close();
  vi.unstubAllEnvs();
});

const ok = async (email: string, password = 'correct-horse-1', lang: 'en' | 'fr' = 'en') => {
  const r = await signup(email, password, lang);
  if ('errors' in r) throw new Error(JSON.stringify(r.errors));
  return r;
};

describe('validateSignup', () => {
  test('email and password rules, both reported at once', () => {
    expect(validateSignup('a@example.test', 'p'.repeat(10))).toEqual({});
    expect(validateSignup('a@example.test', 'p'.repeat(200))).toEqual({});
    expect(validateSignup('bad', 'p'.repeat(5))).toEqual({ email: 'email_invalid', password: 'password_short' });
    expect(validateSignup('a@example.test', 'p'.repeat(9))).toEqual({ password: 'password_short' });
    expect(validateSignup('a@example.test', 'p'.repeat(201))).toEqual({ password: 'password_long' });
  });
});

describe('signup and sessions', () => {
  test('creates the user with the language and theme system, and a session stored as SHA-256', async () => {
    const { userId, token } = await ok('new.player@example.test', 'correct-horse-1', 'fr');
    expect(await getSessionUser(token)).toEqual({ id: userId, email: 'new.player@example.test', lang: 'fr', theme: 'system' });
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const [s] = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(s.id).toMatch(/^[0-9a-f]{64}$/);
    expect(s.id).not.toBe(token);
    const days = (s.expiresAt.getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThanOrEqual(30);
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.passwordHash).toMatch(/^scrypt\$/);
  });

  test('an email taken in another case is refused', async () => {
    await ok('A.Player@example.test');
    expect(await signup('a.player@example.test', 'correct-horse-1', 'en')).toEqual({ errors: { email: 'email_taken' } });
  });

  test('an invalid signup creates nothing', async () => {
    expect(await signup('bad', 'short', 'en')).toEqual({ errors: { email: 'email_invalid', password: 'password_short' } });
    expect(await db.select().from(users).where(eq(users.email, 'bad'))).toEqual([]);
  });

  test('unknown tokens give null', async () => {
    expect(await getSessionUser('bogus')).toBeNull();
    expect(await getSessionUser(undefined)).toBeNull();
  });

  test('a session expires after 30 days', async () => {
    const { token } = await ok('expiring@example.test');
    const in29 = new Date(Date.now() + 29 * 86400000);
    const in31 = new Date(Date.now() + 31 * 86400000);
    expect(await getSessionUser(token, in29)).not.toBeNull();
    expect(await getSessionUser(token, in31)).toBeNull();
    // The expired session is gone, even for an earlier clock.
    expect(await getSessionUser(token)).toBeNull();
  });

  test('logout ends the session', async () => {
    const { token } = await ok('leaving@example.test');
    await logout(token);
    expect(await getSessionUser(token)).toBeNull();
    await expect(logout('unknown')).resolves.toBeUndefined();
  });

  test('the session cookie is HttpOnly, Lax, Path=/, 30 days, Secure only off localhost', () => {
    expect(sessionCookie.options()).toEqual({ path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 2592000 });
  });

  test('Secure everywhere but localhost and 127.0.0.1', () => {
    expect(secureCookieFor('http://localhost:8080')).toBe(false);
    expect(secureCookieFor('http://127.0.0.1:3000')).toBe(false);
    expect(secureCookieFor('https://drill-chess.example.test')).toBe(true);
  });
});

describe('login', () => {
  test('logs in case-insensitively and rejects wrong credentials alike', async () => {
    await signup('Login.Unit@example.test', 'correct-horse-1', 'en');
    const ok = await login('LOGIN.unit@example.test', 'correct-horse-1');
    expect('token' in ok && (await getSessionUser(ok.token))?.email).toBe('Login.Unit@example.test');
    expect(await login('login.unit@example.test', 'wrong-password-1')).toEqual({ error: 'login_failed' });
    expect(await login('nobody@example.test', 'correct-horse-1')).toEqual({ error: 'login_failed' });
  });

  test('limits after 10 failures in 15 minutes, until the oldest is 15 minutes old', async () => {
    const email = 'limit.unit@example.test';
    await signup(email, 'correct-horse-1', 'en');
    for (let i = 0; i < 9; i++) await login(email.toUpperCase(), 'wrong-password-1');
    expect('token' in (await login(email, 'correct-horse-1'))).toBe(true);
    expect(await login(email, 'wrong-password-1')).toEqual({ error: 'login_failed' });
    expect(await login(email, 'correct-horse-1')).toEqual({ error: 'login_limited' });
    expect(await login(email, 'correct-horse-1')).toEqual({ error: 'login_limited' });
    const later = new Date(Date.now() + 15 * 60 * 1000 + 1000);
    expect('token' in (await login(email, 'correct-horse-1', later))).toBe(true);
  });

  test('failures dated 15 minutes and 1 second ago do not limit', async () => {
    const email = 'old.failures@example.test';
    await signup(email, 'correct-horse-1', 'en');
    const at = new Date(Date.now() - 15 * 60 * 1000 - 1000);
    await db.insert(loginFailures).values(Array.from({ length: 10 }, () => ({ emailLower: email, at })));
    expect('token' in (await login(email, 'correct-horse-1'))).toBe(true);
  });

  test('unknown emails are limited too', async () => {
    for (let i = 0; i < 10; i++) await login('ghost.unit@example.test', 'x');
    expect(await login('ghost.unit@example.test', 'x')).toEqual({ error: 'login_limited' });
  });
});

describe('password reset', () => {
  const lastToken = () => {
    const files = readdirSync(outbox).sort();
    const mail = JSON.parse(readFileSync(join(outbox, files[files.length - 1]), 'utf8'));
    return { mail, token: /\/reset\/(\S+)/.exec(mail.text)![1] };
  };

  test('a token older than 1 hour gives reset_invalid', async () => {
    await ok('old.reset@example.test');
    await requestPasswordReset('old.reset@example.test', new Date(Date.now() - 2 * 3600 * 1000));
    expect(await resetPassword(lastToken().token, 'another-long-pass')).toEqual({ error: 'reset_invalid' });
  });

  test('a valid token is single-use and ends old sessions', async () => {
    const { token: session } = await ok('fresh.reset@example.test', 'correct-horse-1', 'fr');
    await requestPasswordReset('Fresh.Reset@example.test');
    const { mail, token } = lastToken();
    expect(mail.subject).toBe('Réinitialisation du mot de passe drill-chess');
    expect(await resetPassword(token, 'short')).toEqual({ errors: { password: 'password_short' } });
    expect(await resetPassword(token, 'brand-new-pass-2')).toHaveProperty('token');
    expect(await getSessionUser(session)).toBeNull();
    expect(await resetPassword(token, 'brand-new-pass-3')).toEqual({ error: 'reset_invalid' });
    expect(await login('fresh.reset@example.test', 'brand-new-pass-2')).toHaveProperty('token');
  });

  test('unknown or malformed emails send nothing', async () => {
    const before = readdirSync(outbox).length;
    await requestPasswordReset('nobody@example.test');
    await requestPasswordReset('not-an-email');
    expect(readdirSync(outbox).length).toBe(before);
  });
});

describe('updatePreferences', () => {
  test('saves valid values and rejects others', async () => {
    const { userId, token } = await ok('prefs@example.test', 'correct-horse-1', 'en');
    expect(await updatePreferences(userId, { lang: 'fr', theme: 'dark' })).toBe(true);
    expect(await getSessionUser(token)).toMatchObject({ lang: 'fr', theme: 'dark' });
    expect(await updatePreferences(userId, { lang: 'de', theme: 'light' })).toBe(false);
    expect(await updatePreferences(userId, { lang: 'en', theme: 'blue' })).toBe(false);
    expect(await getSessionUser(token)).toMatchObject({ lang: 'fr', theme: 'dark' });
  });
});

describe('deleteAccount', () => {
  test('wrong password keeps the account; right password removes it, its sessions and login failures', async () => {
    const { userId, token } = await ok('del@example.test');
    await login('DEL@example.test', 'nope');
    expect(await deleteAccount(userId, 'wrong-password')).toBe('password_wrong');
    expect(await getSessionUser(token)).not.toBeNull();
    expect(await deleteAccount(userId, 'correct-horse-1')).toBe('ok');
    expect(await getSessionUser(token)).toBeNull();
    expect(await db.select().from(loginFailures).where(eq(loginFailures.emailLower, 'del@example.test'))).toEqual([]);
    expect('token' in (await login('del@example.test', 'correct-horse-1'))).toBe(false);
    await ok('del@example.test');
  });
});
