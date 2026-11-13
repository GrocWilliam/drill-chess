import { describe, expect, it } from 'vitest';
import { health } from './health';

describe('health', () => {
  it('is 200 ok once migrated', () => expect(health(() => true)).toEqual({ status: 200, body: { status: 'ok' } }));
  it('is 503 before', () => expect(health(() => false).status).toBe(503));
});
