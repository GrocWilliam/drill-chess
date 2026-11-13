import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './config';

describe('parseConfig', () => {
  it('applies the defaults of docs/architecture.md', () => {
    expect(parseConfig({})).toEqual({
      PORT: 8080,
      DATABASE_URL: undefined,
      PGLITE_DATA_DIR: './data/pglite',
      CHESSCOM_URL: 'https://api.chess.com',
      LICHESS_URL: 'https://lichess.org',
      TABLEBASE_URL: 'https://tablebase.lichess.ovh',
      CONTACT_EMAIL: 'contact@example.invalid',
      SMTP_URL: undefined,
      MAIL_OUTBOX: './data/outbox',
      PUBLIC_ENGINE_DEPTH: 14,
      ORIGIN: 'http://localhost:8080',
    });
  });

  it('reads given values and treats empty ones as unset', () => {
    const c = parseConfig({
      PORT: '3000',
      DATABASE_URL: 'postgres://u:p@db:5432/drill',
      PGLITE_DATA_DIR: 'memory://',
      CHESSCOM_URL: 'http://127.0.0.1:9',
      CONTACT_EMAIL: 'forge@example.test',
      SMTP_URL: 'smtp://mail:25',
      PUBLIC_ENGINE_DEPTH: '6',
      ORIGIN: '',
    });
    expect(c.PORT).toBe(3000);
    expect(c.DATABASE_URL).toBe('postgres://u:p@db:5432/drill');
    expect(c.PGLITE_DATA_DIR).toBe('memory://');
    expect(c.CHESSCOM_URL).toBe('http://127.0.0.1:9');
    expect(c.CONTACT_EMAIL).toBe('forge@example.test');
    expect(c.SMTP_URL).toBe('smtp://mail:25');
    expect(c.PUBLIC_ENGINE_DEPTH).toBe(6);
    expect(c.ORIGIN).toBe('http://localhost:8080');
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['PORT', '80.5'],
    ['DATABASE_URL', 'mysql://x'],
    ['CHESSCOM_URL', 'not-a-url'],
    ['LICHESS_URL', 'ftp://lichess.org'],
    ['TABLEBASE_URL', 'nope'],
    ['CONTACT_EMAIL', 'nobody'],
    ['SMTP_URL', 'http://mail'],
    ['PUBLIC_ENGINE_DEPTH', 'deep'],
    ['ORIGIN', 'localhost'],
  ])('rejects %s=%s with "Invalid env var %s"', (name, value) => {
    try {
      parseConfig({ [name]: value });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toMatch(new RegExp(`^Invalid env var ${name}: .+`));
    }
  });

  it('names every invalid variable', () => {
    expect(() => parseConfig({ PORT: 'abc', ORIGIN: 'x' })).toThrow(/PORT[\s\S]*ORIGIN/);
  });
});
