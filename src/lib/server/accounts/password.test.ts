import { describe, expect, test } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  test('scrypt with N=2^15, r=8, p=1 and a 16-byte salt; verifies the right password only', async () => {
    const hash = await hashPassword('correct-horse-1');
    const [scheme, n, r, p, salt] = hash.split('$');
    expect([scheme, n, r, p]).toEqual(['scrypt', '32768', '8', '1']);
    expect(Buffer.from(salt, 'base64')).toHaveLength(16);
    expect(await verifyPassword('correct-horse-1', hash)).toBe(true);
    expect(await verifyPassword('correct-horse-2', hash)).toBe(false);
  });

  test('salted: the same password hashes differently', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });

  test('a malformed hash never verifies', async () => {
    expect(await verifyPassword('x', 'nope')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$a$b$c$$')).toBe(false);
  });
});
