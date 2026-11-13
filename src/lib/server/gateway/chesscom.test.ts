import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchArchive, listArchives, parseArchiveUrl } from './chesscom';
import { GatewayError } from './http';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('CHESSCOM_URL', 'http://fake.test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseArchiveUrl', () => {
  it('keeps the path of a month archive', () => {
    expect(parseArchiveUrl('https://api.chess.com/pub/player/made_up/games/2026/01')).toEqual({
      year: 2026,
      month: 1,
      path: '/pub/player/made_up/games/2026/01',
    });
  });
  it('drops other URLs', () => {
    for (const u of ['https://api.chess.com/other/path', 'not a url', 'https://api.chess.com/pub/player/x/games/2026/13'])
      expect(parseArchiveUrl(u)).toBeNull();
  });
});

describe('listArchives', () => {
  it('reads the lowercased player archives and keeps the month ones', async () => {
    fetchMock.mockResolvedValue(
      reply({ archives: ['https://api.chess.com/pub/player/made_up/games/2026/01', 'https://api.chess.com/other/path'] }),
    );
    expect(await listArchives('Made_Up')).toEqual([{ year: 2026, month: 1, path: '/pub/player/made_up/games/2026/01' }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://fake.test/pub/player/made_up/games/archives');
  });
  it('rejects an unexpected shape as unavailable', async () => {
    fetchMock.mockResolvedValue(reply({ archives: 'nope' }));
    await expect(listArchives('x')).rejects.toBeInstanceOf(GatewayError);
  });
});

describe('fetchArchive', () => {
  it('validates each game, null for a malformed one', async () => {
    const ok = {
      url: 'https://www.chess.com/game/live/1',
      pgn: '1. e4',
      time_control: '60',
      end_time: 1,
      time_class: 'bullet',
      rules: 'chess',
      white: { username: 'a', rating: 1, result: 'win' },
      black: { username: 'b', rating: 1, result: 'resigned' },
    };
    fetchMock.mockResolvedValue(reply({ games: [ok, { url: 1 }] }));
    const games = await fetchArchive('/pub/player/a/games/2026/01');
    expect(games[0]).toMatchObject({ url: ok.url });
    expect(games[1]).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://fake.test/pub/player/a/games/2026/01');
  });
});
