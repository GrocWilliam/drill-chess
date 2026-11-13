// Made-up chess.com games for the fake (no real players or games). Each template carries a `monthOffset`
// (0 = the current UTC month, -1 = the previous one...): its archive path and end time are computed from now.
//
// `alpha_pawn`: months 0, -1, -2 and -3 → fetched by a first import (0, -1, -2): 7 standard games, 3 skipped
// (a chess960 game, a custom start, a PGN chess.js cannot parse). The first game names the player `Alpha_Pawn` (US-16 pins the values of the month 0 games).

export const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** { year, month } (month 1-12) of the UTC month `offset` months from `now`. */
export function utcMonth(offset, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** `YYYY/MM` of a month. */
export const monthPath = ({ year, month }) => `${year}/${String(month).padStart(2, '0')}`;

const RIVAL = 'made_up_rival';
const TEMPLATES = [
  // Month 0: 3 standard games, a chess960 game, a standard-rules game from a custom position.
  // The three standard games are the newest ones (hours 20, 15, 10 of the 1st); US-16 pins their values.
  { id: '100000001', monthOffset: 0, hour: 20, me: 'black', meName: 'Alpha_Pawn', result: ['resigned', 'win'], timeClass: 'blitz', tc: '180+2',
    ratings: [1432, 1488], eco: 'B90', ecoUrl: 'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation',
    moves: '1. e4 c5 2. Nf3 d6 0-1' },
  { id: '100000002', monthOffset: 0, hour: 15, me: 'white', result: ['repetition', 'repetition'], timeClass: 'rapid', tc: '600',
    eco: 'C50', moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1/2-1/2' },
  { id: '100000003', monthOffset: 0, hour: 10, me: 'white', result: ['checkmated', 'win'], timeClass: 'daily', tc: '1/86400',
    eco: 'A00', ecoUrl: 'https://www.chess.com/openings/Barnes-Opening', moves: '1. f3 e5 2. g4 Qh4# 0-1' },
  { id: '91000004', monthOffset: 0, me: 'white', result: ['win', 'resigned'], timeClass: 'blitz', tc: '180', rules: 'chess960',
    setup: 'bnrqkrnb/pppppppp/8/8/8/8/PPPPPPPP/BNRQKRNB w KQkq - 0 1', moves: '1. e4 e5 2. Nf3 Nc6 1-0' },
  { id: '91000005', monthOffset: 0, me: 'black', result: ['resigned', 'win'], timeClass: 'blitz', tc: '180',
    setup: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: '1. e4 Kd7 0-1' },
  // Month -1: 2 standard games and one whose PGN chess.js cannot parse (an illegal move).
  { id: '92000001', monthOffset: -1, me: 'black', result: ['checkmated', 'win'], timeClass: 'daily', tc: '1/86400',
    eco: 'A00', ecoUrl: 'https://www.chess.com/openings/Barnes-Opening', moves: '1. f3 e5 2. g4 Qh4# 0-1' },
  { id: '92000002', monthOffset: -1, me: 'white', result: ['repetition', 'repetition'], timeClass: 'blitz', tc: '300+2',
    eco: 'C20', moves: '1. e4 e5 2. Nf3 Nf6 1/2-1/2' },
  { id: '92000003', monthOffset: -1, me: 'white', result: ['win', 'resigned'], timeClass: 'blitz', tc: '180',
    eco: 'C20', moves: '1. e4 e5 2. Ke3 Nf6 1-0' },
  // Month -2: 2 standard games.
  { id: '93000001', monthOffset: -2, me: 'black', result: ['win', 'resigned'], timeClass: 'rapid', tc: '900+10',
    eco: 'A40', moves: '1. d4 e6 2. Nf3 b6 1-0' },
  { id: '93000002', monthOffset: -2, me: 'white', result: ['stalemate', 'stalemate'], timeClass: 'blitz', tc: '180',
    eco: 'A10', ecoUrl: 'https://www.chess.com/openings/English-Opening', moves: '1. c4 e5 2. Nc3 Nf6 1/2-1/2' },
  // Month -3: 1 game (outside a first import).
  { id: '94000001', monthOffset: -3, me: 'white', result: ['win', 'resigned'], timeClass: 'blitz', tc: '180',
    eco: 'C40', moves: '1. e4 e5 2. Nf3 d6 1-0' },
];

// `slow_knight` (US-18): 4 standard games in month 0 and nothing else (`only` = the player that has the template).
const SLOW = [
  ['95000001', 'e4 e5 2. Nf3 Nc6', '1-0', 'white'],
  ['95000002', 'd4 d5 2. c4 e6', '1/2-1/2', 'black'],
  ['95000003', 'c4 e5 2. Nc3 Nf6', '0-1', 'white'],
  ['95000004', 'Nf3 d5 2. g3 c5', '1-0', 'black'],
];
SLOW.forEach(([id, mv, res, me], i) =>
  TEMPLATES.push({ id, only: 'slow_knight', monthOffset: 0, hour: 2 + i, me, result: ['win', 'resigned'], timeClass: 'blitz', tc: '180',
    eco: 'C20', moves: `1. ${mv} ${res}` }),
);

// US-21: `busy_bishop` has 2 standard games in month 0 and 1 in month -1; `failing_rook` has 2 in month -2 and 1 in
// month -1 (its month 0 archive always answers 500, see ./server.mjs).
[
  ['97000001', 'busy_bishop', 0, 'e4 e5 2. Nf3 Nc6', '1-0', 'white'],
  ['97000002', 'busy_bishop', 0, 'd4 d5 2. c4 e6', '0-1', 'black'],
  ['97000003', 'busy_bishop', -1, 'c4 e5 2. Nc3 Nf6', '1/2-1/2', 'white'],
  ['98000001', 'failing_rook', -2, 'e4 c5 2. Nf3 d6', '1-0', 'white'],
  ['98000002', 'failing_rook', -2, 'd4 Nf6 2. c4 g6', '0-1', 'black'],
  ['98000003', 'failing_rook', -1, 'Nf3 d5 2. g3 Nf6', '1-0', 'white'],
].forEach(([id, only, monthOffset, mv, res, me], i) =>
  TEMPLATES.push({ id, only, monthOffset, hour: 3 + i, me, result: ['win', 'resigned'], timeClass: 'blitz', tc: '180',
    eco: 'C20', moves: `1. ${mv} ${res}` }),
);

/** The players that only have their own (`only`) templates. */
const OWN_FIXTURES = new Set(TEMPLATES.filter((t) => t.only).map((t) => t.only));

const pgnResult = (moves) => moves.trim().split(/\s+/).pop();

function toGame(t, player, now) {
  const m = utcMonth(t.monthOffset, now);
  const endTime = Math.floor(Date.UTC(m.year, m.month - 1, 1) / 1000) + 3600 * (t.hour ?? 1 + (Number(t.id) % 20));
  const meName = t.meName ?? player;
  const rival = t.rival ?? RIVAL;
  const white = { username: t.me === 'white' ? meName : rival, rating: t.ratings?.[0] ?? 1500 + (Number(t.id) % 97), result: t.result[0] };
  const black = { username: t.me === 'black' ? meName : rival, rating: t.ratings?.[1] ?? 1450 + (Number(t.id) % 89), result: t.result[1] };
  const setup = t.setup ?? STANDARD_START;
  const date = `${m.year}.${String(m.month).padStart(2, '0')}.01`;
  const headers = [
    ['Event', 'Live Chess'], ['Site', 'Chess.com'], ['Date', date], ['Round', '-'],
    ['White', white.username], ['Black', black.username], ['Result', pgnResult(t.moves)],
    ...(t.setup ? [['SetUp', '1'], ['FEN', setup]] : []),
    ...(t.eco ? [['ECO', t.eco]] : []),
    ...(t.ecoUrl ? [['ECOUrl', t.ecoUrl]] : []),
    ['WhiteElo', String(white.rating)], ['BlackElo', String(black.rating)], ['TimeControl', t.tc],
    ['Termination', 'Made-up fixture game'],
  ];
  const pgn = `${headers.map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${t.moves}\n`;
  return {
    url: `https://www.chess.com/game/${t.timeClass === 'daily' ? 'daily' : 'live'}/${t.id}`,
    pgn,
    time_control: t.tc,
    end_time: endTime,
    rated: true,
    uuid: `00000000-0000-4000-8000-${t.id.padStart(12, '0')}`,
    initial_setup: setup,
    fen: setup,
    time_class: t.timeClass,
    rules: t.rules ?? 'chess',
    white: { ...white, '@id': `https://api.chess.com/pub/player/${white.username.toLowerCase()}`, uuid: `w-${t.id}` },
    black: { ...black, '@id': `https://api.chess.com/pub/player/${black.username.toLowerCase()}`, uuid: `b-${t.id}` },
    ...(t.ecoUrl ? { eco: t.ecoUrl } : {}),
  };
}

/** The months (offsets) that have an archive. */
export const ARCHIVE_OFFSETS = [...new Set(TEMPLATES.filter((t) => !t.only).map((t) => t.monthOffset))];

/** The games of `player`'s archive of `year`/`month` (empty when that month has none). */
export function archiveGames(player, year, month, now = new Date()) {
  return TEMPLATES.filter((t) => {
    if (t.only ? t.only !== player : OWN_FIXTURES.has(player)) return false;
    const m = utcMonth(t.monthOffset, now);
    return m.year === year && m.month === month;
  }).map((t) => toGame(t, player, now));
}

/** US-20: a new month 0 game of `player` for POST /__fake/add-game: `game` = { id (digits), opponent?, moves? }. */
export function extraGame(player, game, endTimeSec, now = new Date()) {
  const t = { id: game.id, monthOffset: 0, me: 'white', result: ['win', 'resigned'], timeClass: 'blitz', tc: '180', eco: 'C20',
    rival: game.opponent, moves: game.moves ?? '1. e4 e5 2. Nf3 Nc6 1-0' };
  return { ...toGame(t, player, now), end_time: endTimeSec };
}

/** The current month's games of `player` (without the added ones). */
export const month0Games = (player) => {
  const { year, month } = utcMonth(0);
  return archiveGames(player, year, month);
};
