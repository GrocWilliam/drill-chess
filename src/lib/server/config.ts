// Every environment variable of docs/architecture.md (Configuration), parsed once with Zod.
import { z } from 'zod';

/** An empty variable counts as unset, so its default applies. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const httpUrl = z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' });

const schema = z.object({
  PORT: optional(z.coerce.number({ error: 'must be a number' }).int('must be an integer').min(1).max(65535).default(8080)),
  DATABASE_URL: optional(z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }).optional()),
  PGLITE_DATA_DIR: optional(z.string().default('./data/pglite')),
  CHESSCOM_URL: optional(httpUrl.default('https://api.chess.com')),
  LICHESS_URL: optional(httpUrl.default('https://lichess.org')),
  TABLEBASE_URL: optional(httpUrl.default('https://tablebase.lichess.ovh')),
  CONTACT_EMAIL: optional(z.email('must be an email address').default('contact@example.invalid')),
  SMTP_URL: optional(z.url({ protocol: /^smtps?$/, error: 'must be an smtp:// or smtps:// URL' }).optional()),
  MAIL_OUTBOX: optional(z.string().default('./data/outbox')),
  PUBLIC_ENGINE_DEPTH: optional(z.coerce.number({ error: 'must be a number' }).int('must be an integer').min(1).max(30).default(14)),
  ORIGIN: optional(httpUrl.default('http://localhost:8080')),
});

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {
  constructor(readonly issues: { name: string; reason: string }[]) {
    super(issues.map((i) => `Invalid env var ${i.name}: ${i.reason}`).join('\n'));
    this.name = 'ConfigError';
  }
}

/** Parses `env`; throws a ConfigError naming every invalid variable. */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  throw new ConfigError(result.error.issues.map((i) => ({ name: String(i.path[0]), reason: i.message })));
}

let cached: Config | undefined;

/**
 * The configuration of this process, parsed from `process.env` on first call. On an invalid value it prints
 * `Invalid env var <NAME>: <reason>` to stderr and exits with code 1.
 */
export function config(): Config {
  if (cached) return cached;
  try {
    cached = parseConfig(process.env);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    console.error(e.message);
    process.exit(1);
  }
  return cached;
}
