import { describe, expect, test } from 'vitest';
import { guard } from './guard';

const u = (p: string) => new URL(p, 'http://localhost');

describe('guard', () => {
  test('signed-out visits to private pages go to /login with the encoded path and query', () => {
    expect(guard(u('/games?site=lichess'), false)).toBe('/login?next=%2Fgames%3Fsite%3Dlichess');
    expect(guard(u('/games/123'), false)).toBe('/login?next=%2Fgames%2F123');
    expect(guard(u('/account'), false)).toBe('/login?next=%2Faccount');
    expect(guard(u('/openings/drill'), false)).toBe('/login?next=%2Fopenings%2Fdrill');
  });

  test('public pages stay open to visitors', () => {
    for (const p of ['/', '/signup', '/login', '/games/demo', '/health', '/gamesx']) expect(guard(u(p), false)).toBeNull();
  });

  test('signed-in users leave / and /signup for /games', () => {
    expect(guard(u('/'), true)).toBe('/games');
    expect(guard(u('/signup'), true)).toBe('/games');
    expect(guard(u('/games'), true)).toBeNull();
    expect(guard(u('/account'), true)).toBeNull();
  });
});
