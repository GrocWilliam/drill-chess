// Made-up Lichess games for the fake (no real players or games). Each template carries a `monthOffset`
// (0 = the current UTC month, -1 = the previous one...): its `lastMoveAt` is computed from now.
//
// `beta_rook`: months 0, -1, -2 and -3 → the fake returns those with lastMoveAt >= `since`. A first import
// (since = the 1st of month -2) gets 9 lines: 6 standard games, a chess960 game, a custom start and an invalid line.
// Each game has its own opponent name, so a test finds a game by it.
import { STANDARD_START, utcMonth } from './chesscom-games.mjs';

export const LICHESS_PLAYER = 'beta_rook';

/** Epoch ms of 00:00 UTC on the first day of the UTC month `offset` months from `now`. */
export const monthStartMs = (offset, now = new Date()) => {
  const { year, month } = utcMonth(offset, now);
  return Date.UTC(year, month - 1, 1);
};

const HOUR = 3600 * 1000;
// me: the side of beta_rook; meName: how the game names it.
const TEMPLATES = [
  // The newest game: US-17 pins its values.
  { id: 'AbCdEf12', monthOffset: 0, hour: 22, me: 'white', winner: 'white', speed: 'blitz', clock: [180, 2],
    opp: 'made_up_foe', oppRating: 1610, opening: ['B01', 'Scandinavian Defense'], moves: '1. e4 d5 2. exd5 Qxd5 1-0' },
  { id: 'UltraB01x', monthOffset: 0, hour: 12, me: 'black', winner: 'black', speed: 'ultraBullet', clock: [15, 0],
    opp: 'made_up_ultra', oppRating: 1700, moves: '1. f3 e5 2. g4 Qh4# 0-1' },
  { id: 'Corresp1x', monthOffset: -1, hour: 9, me: 'white', winner: 'white', speed: 'correspondence', clock: null,
    opp: 'made_up_daily', oppRating: 1550, moves: '1. e4 e5 2. Nf3 Nc6 1-0' },
  { id: 'Drawn01x', monthOffset: -1, hour: 5, me: 'black', winner: null, speed: 'rapid', clock: [600, 0],
    opp: 'made_up_draw', oppRating: 1580, moves: '1. e4 e5 2. Nf3 Nf6 1/2-1/2' },
  { id: 'StdFen01', monthOffset: -2, hour: 15, me: 'white', winner: 'white', speed: 'blitz', clock: [300, 3], initialFen: STANDARD_START,
    opp: 'made_up_stdfen', oppRating: 1490, moves: '1. d4 e6 2. c4 b6 1-0' },
  { id: 'UpperCs1', monthOffset: -2, hour: 8, me: 'black', meName: 'BETA_ROOK', winner: 'white', speed: 'rapid', clock: [900, 10],
    opp: 'made_up_upper', oppRating: 1520, moves: '1. c4 e5 2. Nc3 Nf6 1-0' },
  // Skipped.
  { id: 'Chess960x', monthOffset: 0, hour: 3, me: 'white', winner: 'white', speed: 'blitz', clock: [180, 0], variant: 'chess960',
    initialFen: 'bnrqkrnb/pppppppp/8/8/8/8/PPPPPPPP/BNRQKRNB w KQkq - 0 1', opp: 'made_up_960', oppRating: 1500, moves: '1. e4 e5 2. Nf3 Nc6 1-0' },
  { id: 'CustFen1', monthOffset: -1, hour: 20, me: 'black', winner: 'black', speed: 'blitz', clock: [180, 0],
    initialFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', opp: 'made_up_custom', oppRating: 1500, moves: '1. e4 Kd7 0-1' },
  { id: 'BadLine01', monthOffset: -1, hour: 12, invalid: true },
  // Outside a first import (month -3): never returned for since = the 1st of month -2.
  { id: 'OldGame01', monthOffset: -3, hour: 10, me: 'white', winner: 'white', speed: 'blitz', clock: [180, 0],
    opp: 'made_up_old', oppRating: 1500, moves: '1. e4 e5 2. Nf3 d6 1-0' },
  { id: 'OldGame02', monthOffset: -3, hour: 2, me: 'black', winner: 'black', speed: 'rapid', clock: [600, 0],
    opp: 'made_up_old2', oppRating: 1500, moves: '1. f3 e5 2. g4 Qh4# 0-1' },
];

/** The end time (epoch ms) of the Lichess game `id`. */
export function lastMoveAtOf(id, now = new Date()) {
  const t = TEMPLATES.find((x) => x.id === id);
  return monthStartMs(t.monthOffset, now) + t.hour * HOUR;
}

function toLine(t, player, now) {
  const lastMoveAt = monthStartMs(t.monthOffset, now) + t.hour * HOUR;
  if (t.invalid) return { id: t.id, lastMoveAt };
  const me = { user: { name: t.meName ?? player, id: player }, rating: 1500 };
  const opp = { user: { name: t.opp, id: t.opp }, rating: t.oppRating };
  const players = t.me === 'white' ? { white: me, black: opp } : { white: opp, black: me };
  const result = t.moves.trim().split(/\s+/).pop();
  const headers = [
    ['Event', 'Rated game'], ['Site', `https://lichess.org/${t.id}`], ['Date', '2026.01.01'],
    ['White', players.white.user.name], ['Black', players.black.user.name], ['Result', result],
    ...(t.initialFen ? [['SetUp', '1'], ['FEN', t.initialFen]] : []),
    ...(t.variant ? [['Variant', 'Chess960']] : []),
  ];
  const pgn = `${headers.map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${t.moves}\n`;
  return {
    id: t.id,
    rated: true,
    variant: t.variant ?? 'standard',
    speed: t.speed,
    perf: t.speed,
    createdAt: lastMoveAt - 600000,
    lastMoveAt,
    status: 'resign',
    source: 'lobby',
    players,
    ...(t.winner ? { winner: t.winner } : {}),
    ...(t.opening ? { opening: { eco: t.opening[0], name: t.opening[1], ply: 2 } } : {}),
    ...(t.initialFen ? { initialFen: t.initialFen } : {}),
    ...(t.clock ? { clock: { initial: t.clock[0], increment: t.clock[1], totalTime: t.clock[0] + 40 * t.clock[1] } } : {}),
    pgn,
  };
}

/** The NDJSON lines (newest first) of `player` with lastMoveAt >= sinceMs. */
export function streamLines(player, sinceMs, now = new Date(), extras = []) {
  if (player === MANY_PLAYER) return manyLines(sinceMs, now);
  if (player !== LICHESS_PLAYER) return [];
  return [...TEMPLATES.map((t) => toLine(t, player, now)), ...extras]
    .filter((g) => g.lastMoveAt >= sinceMs)
    .sort((a, b) => b.lastMoveAt - a.lastMoveAt)
    .map((g) => JSON.stringify(g));
}

/** US-20: a new game of `player` for POST /__fake/add-game: `game` = { id, opponent?, moves? }; lastMoveAt in epoch ms. */
export function extraLine(player, game, lastMoveAt, now = new Date()) {
  const t = { id: game.id, monthOffset: 0, hour: 0, me: 'white', winner: 'white', speed: 'blitz', clock: [180, 0],
    opp: game.opponent ?? 'made_up_fresh', oppRating: 1500, moves: game.moves ?? '1. e4 e5 2. Nf3 Nc6 1-0' };
  return { ...toLine(t, player, now), lastMoveAt, createdAt: lastMoveAt - 600000 };
}

// US-23: `many_pawns` has 5,005 standard games mp000001 (oldest) .. mp005005 (newest), spread evenly over the
// window from the 1st of month -2 (+1 h) to now (-1 h); odd numbers are blitz, even ones rapid. PGN `1. e4 e5`.
export const MANY_PLAYER = 'many_pawns';
export const MANY_COUNT = 5005;
export const manyId = (n) => `mp${String(n).padStart(6, '0')}`;

function manyLines(sinceMs, now) {
  const start = monthStartMs(-2, now) + HOUR;
  const step = (now.getTime() - HOUR - start) / (MANY_COUNT - 1);
  const out = [];
  for (let n = MANY_COUNT; n >= 1; n--) {
    const lastMoveAt = Math.floor(start + (n - 1) * step);
    if (lastMoveAt < sinceMs) break;
    const id = manyId(n);
    const speed = n % 2 ? 'blitz' : 'rapid';
    const headers = [['Event', 'Rated game'], ['Site', `https://lichess.org/${id}`], ['Date', '2026.01.01'],
      ['White', MANY_PLAYER], ['Black', `made_up_mp${n}`], ['Result', '1/2-1/2']];
    out.push(JSON.stringify({
      id, rated: true, variant: 'standard', speed, perf: speed, createdAt: lastMoveAt - 600000, lastMoveAt,
      status: 'draw', source: 'lobby',
      players: { white: { user: { name: MANY_PLAYER, id: MANY_PLAYER }, rating: 1500 }, black: { user: { name: `made_up_mp${n}`, id: `made_up_mp${n}` }, rating: 1500 } },
      clock: { initial: speed === 'blitz' ? 180 : 600, increment: 0, totalTime: speed === 'blitz' ? 180 : 600 },
      pgn: `${headers.map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n1. e4 e5\n`,
    }));
  }
  return out;
}
