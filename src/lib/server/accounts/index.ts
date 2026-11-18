// The accounts module: sign up, sessions (cookie token → user), log out.
import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, gt, gte, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Lang } from '../../i18n';
import { messagesFor, translate } from '../../i18n';
import { config } from '../config';
import { db } from '../db';
import { sendMail } from '../gateway/mail';
import { hashPassword, verifyPassword } from './password';
import { loginFailures, passwordResets, sessions, users } from './schema';

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 3600 * 1000;

export type Theme = 'system' | 'light' | 'dark';
export interface SessionUser {
  id: string;
  email: string;
  lang: Lang;
  theme: Theme;
}

export type SignupErrors = {
  email?: 'email_invalid' | 'email_taken';
  password?: 'password_short' | 'password_long';
};

const emailSchema = z.email();

/** Validates the signup fields → the errors found (empty when valid). Does not check whether the email is taken. */
export function validateSignup(email: string, password: string): SignupErrors {
  const errors: SignupErrors = {};
  if (!emailSchema.safeParse(email.trim()).success) errors.email = 'email_invalid';
  if (password.length < 10) errors.password = 'password_short';
  else if (password.length > 200) errors.password = 'password_long';
  return errors;
}

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

/** Starts a session for the user → the cookie token (only its SHA-256 is stored). */
export async function startSession(userId: string, now = new Date()): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt: new Date(now.getTime() + SESSION_MS) });
  return token;
}

/** Creates the user (theme `system`) and starts a session, or returns the field errors. */
export async function signup(
  email: string,
  password: string,
  lang: Lang,
): Promise<{ userId: string; token: string } | { errors: SignupErrors }> {
  const errors = validateSignup(email, password);
  if (errors.email || errors.password) return { errors };
  const passwordHash = await hashPassword(password);
  // users_email_lower_idx makes the email unique case-insensitively: a conflict means it is taken.
  const [user] = await db
    .insert(users)
    .values({ email: email.trim(), passwordHash, lang, theme: 'system' })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!user) return { errors: { email: 'email_taken' } };
  return { userId: user.id, token: await startSession(user.id) };
}

const DUMMY_HASH = hashPassword('dummy-password-for-timing');

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Logs in by `lower(email)` and password → the session token, `login_limited` (10 failures for this email in 15 minutes, even with the right password), or `login_failed` (same for unknown email and wrong password). Limited attempts are not recorded. */
export async function login(
  email: string,
  password: string,
  now = new Date(),
): Promise<{ token: string } | { error: 'login_failed' | 'login_limited' }> {
  if (password.length > 200 || email.length > 320) return { error: 'login_failed' };
  const emailLower = email.trim().toLowerCase();
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const [{ n }] = await db
    .select({ n: count() })
    .from(loginFailures)
    .where(and(eq(loginFailures.emailLower, emailLower), gte(loginFailures.at, since)));
  if (n >= LOGIN_LIMIT) return { error: 'login_limited' };
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${emailLower}`);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok) {
    await db.insert(loginFailures).values({ emailLower, at: now });
    return { error: 'login_failed' };
  }
  return { token: await startSession(user.id) };
}

/** The user of a session cookie token, or null when the token is unknown or expired (an expired session is deleted). */
export async function getSessionUser(token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ id: users.id, email: users.email, lang: users.lang, theme: users.theme, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  if (row.expiresAt <= now) {
    await db.delete(sessions).where(and(eq(sessions.id, id), lte(sessions.expiresAt, now)));
    return null;
  }
  return { id: row.id, email: row.email, lang: row.lang as Lang, theme: row.theme as Theme };
}

/** Ends the session of this cookie token (nothing happens for an unknown one). */
export async function logout(token: string | undefined): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Whether the session cookie is `Secure` for this ORIGIN: always, except on localhost and 127.0.0.1. */
export const secureCookieFor = (origin: string) => !LOCAL_HOSTS.has(new URL(origin).hostname);

/** The `session` cookie: HttpOnly, SameSite=Lax, Path=/, 30 days, Secure unless ORIGIN is localhost/127.0.0.1. */
export const sessionCookie = {
  name: 'session',
  maxAge: SESSION_MS / 1000,
  options() {
    return {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: secureCookieFor(config().ORIGIN),
      maxAge: this.maxAge,
    };
  },
};

export const RESET_MS = 3600 * 1000;

/** Sends a reset link to the account matching `lower(email)`, if any. Never reveals whether it exists. */
export async function requestPasswordReset(email: string, now = new Date()): Promise<void> {
  const trimmed = email.trim();
  if (trimmed.length > 320 || !emailSchema.safeParse(trimmed).success) return;
  const [user] = await db
    .select({ id: users.id, email: users.email, lang: users.lang })
    .from(users)
    .where(sql`lower(${users.email}) = ${trimmed.toLowerCase()}`);
  if (!user) return;
  const token = randomBytes(32).toString('base64url');
  await db
    .insert(passwordResets)
    .values({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(now.getTime() + RESET_MS) });
  const messages = messagesFor(user.lang as Lang);
  await sendMail({
    to: user.email,
    subject: translate(messages, 'mail.reset.subject'),
    text: translate(messages, 'mail.reset.body', { link: `${config().ORIGIN}/reset/${token}` }),
  });
}

/** Whether the token is unused and unexpired. */
export async function isResetTokenValid(token: string, now = new Date()): Promise<boolean> {
  if (token.length > 200) return false;
  const [row] = await db
    .select({ tokenHash: passwordResets.tokenHash })
    .from(passwordResets)
    .where(
      and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)),
    );
  return !!row;
}

/** Sets a new password with a reset token: marks it used, ends all the user's sessions, starts a new one. */
export async function resetPassword(
  token: string,
  password: string,
  now = new Date(),
): Promise<{ token: string } | { error: 'reset_invalid' } | { errors: SignupErrors }> {
  if (!(await isResetTokenValid(token, now))) return { error: 'reset_invalid' };
  const errors = validateSignup('a@b.co', password);
  if (errors.password) return { errors: { password: errors.password } };
  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    // The conditional update makes the token single-use even with concurrent requests.
    const [used] = await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(
        and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)),
      )
      .returning({ userId: passwordResets.userId });
    if (!used) return null;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, used.userId));
    await tx.delete(sessions).where(eq(sessions.userId, used.userId));
    return used.userId;
  });
  if (!userId) return { error: 'reset_invalid' };
  return { token: await startSession(userId, now) };
}

const preferencesSchema = z.object({ lang: z.enum(['en', 'fr']), theme: z.enum(['system', 'light', 'dark']) });

/** Saves the user's language and theme → true, or false (nothing changed) when a value is not allowed. */
export async function updatePreferences(userId: string, prefs: { lang: string; theme: string }): Promise<boolean> {
  const parsed = preferencesSchema.safeParse(prefs);
  if (!parsed.success) return false;
  await db.update(users).set(parsed.data).where(eq(users.id, userId));
  return true;
}

/** Deletes the account after checking the password → ok, or `password_wrong` (nothing deleted). Cascades remove sessions, resets and other user-owned rows; the user's `login_failures` go too. */
export async function deleteAccount(userId: string, password: string): Promise<'ok' | 'password_wrong'> {
  if (password.length > 200) return 'password_wrong';
  const [user] = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!user || !(await verifyPassword(password, user.passwordHash))) return 'password_wrong';
  await db.transaction(async (tx) => {
    await tx.delete(loginFailures).where(eq(loginFailures.emailLower, user.email.toLowerCase()));
    await tx.delete(users).where(eq(users.id, userId));
  });
  return 'ok';
}
