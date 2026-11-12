# Product requirements

The agreed product. Specs build it module by module (ids in `code` match `docs/architecture.md`); nothing listed under
Non-goals or Later is built until a spec says so.

## Problem

Club and online players improve by reviewing their own games, knowing their openings and converting endgames. Today
that means three tools: the sites' own review (partly paid on chess.com), a paid repertoire trainer, and scattered
endgame drills. This app puts the three together, free, on the player's own games from chess.com and Lichess.

## Users

- **Player** (the only role): signs up with an email and a password, links a chess.com and/or a Lichess username, and
  trains. Public and free: anyone may sign up.
- **Visitor** (signed out): sees the landing page and one demo game review (a bundled game, nothing saved).
- No admin role in the app: operations go through the database.

## Goals

- A new player sees their imported games within 2 minutes of signing up (3 months of games, up to 5,000).
- Any game can be reviewed with engine marks in under 60 seconds for a 40-move game on a mid-range phone (depth 14).
- A player with a repertoire gets a daily drill of the positions due, and their retention is visible (due, learned).
- Running cost near zero: the engine runs in the browser; the server only stores data and relays the public APIs.

## Non-goals

Playing live games against people or the engine for fun; a server-side engine; export or import of games or
repertoires to other apps; a native mobile app; payments, ads, premium tiers; chess variants (Chess960 and others);
social features (friends, comments).

## Features

MVP, in build order:

1. `accounts`: sign up, log in, log out, password reset by email, change language and theme, delete the account and
   all its data.
2. `game-import`: link a chess.com and/or a Lichess username; the last 3 months of standard games are imported in the
   background; Sync fetches games since the last import; the game list with filters (site, colour, result, time
   control, opening).
3. `board`: the shared board (drag and click moves, typed moves), the rules, and the browser Stockfish engine.
4. `game-review`: replay a game move by move; evaluation bar and curve; best move per position; each of the player's
   moves marked inaccuracy, mistake or blunder; the analysis is saved; the bundled demo game for visitors.
5. `stats`: win/draw/loss by colour, by opening, by time control; rating over time per site and time control;
   mistakes per game by phase (opening, middlegame, endgame).
6. `openings`: a White and a Black repertoire built by playing moves; drill with spaced repetition; opening names.
7. `endgames`: about 20 curated positions in 4 levels played against tablebase-perfect replies; progress per position.

Later (not planned): sign in with Lichess; puzzles from the player's own mistakes; sharing a repertoire; openings from
master games; "where you left your repertoire" in game review.

## MVP journey

1. The visitor opens `/`, chooses Sign up, enters an email and a password (10+ characters), and lands on `/games`.
2. `/games` is empty and asks for a username. The player enters a chess.com and/or a
   Lichess username on `/account` (or the empty state's form); each link starts an import job.
3. `/games` shows "Importing… 340 games" and refreshes every 2 seconds, then the list, newest first.
4. The player filters on blitz games as Black and opens one: `/games/[id]` analyses it move by move ("move 23/61"),
   then shows the marks, the evaluation curve and the best moves. The analysis is saved.
5. `/stats` shows their results by opening and their mistakes by phase.

## Business rules

Import:
- Standard chess only (chess.com `rules: chess`, Lichess `variant: standard`), from the normal start position. Other
  games, and games started from a custom position, are skipped and counted as skipped.
- A game is unique by (site, site game id); importing it again changes nothing.
- First link: games of the current month and the 2 previous calendar months. Sync: games after the newest stored game
  of that site. Unlinking a username deletes that site's games and their analyses.
- At most 5,000 games per account: beyond, the oldest (by end time) are deleted with their analyses.
- Time control: the site's category, mapped to `bullet`, `blitz`, `rapid`, `classical` or `daily` (Lichess
  `ultraBullet` → `bullet`, `correspondence` → `daily`).
- Stored per game: site, site id, URL, end time, time control category and clock (e.g. `180+2`), the player's colour,
  result for the player (`win`, `draw`, `loss`), both usernames and ratings, the ECO code and opening name (from the
  site's data; games without one get it from the openings dataset once `openings` is built), and the PGN.
- One import job at a time per account; a second request while one runs answers 409.

Analysis:
- Engine: Stockfish 17 lite, single thread, fixed depth (`PUBLIC_ENGINE_DEPTH`, default 14), one evaluation per
  position from the start position to the final one, from White's point of view, in centipawns or mate in N.
- Win chance for White: `W(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`; cp is clamped to ±1000; mate for
  White is 100, mate against is 0.
- A move's loss: the mover's win chance before minus after (from the mover's side). Marks: loss ≥ 30 blunder `??`,
  ≥ 20 mistake `?`, ≥ 10 inaccuracy `?!`; else none. A move equal to the engine's best move is never marked.
- Accuracy per side (shown, not graded): `103.1668 * exp(-0.04354 * mean loss) - 3.1669`, clamped to 0–100.
- The browser sends evaluations; the server validates them (count = plies + 1, cp within ±100,000, mate within ±250)
  and computes the marks itself. An analysis is stored once per game; re-analysing replaces it.

Phases (per position before the move):
- Opening: plies 1–20. Endgame: from ply 21, when non-pawn, non-king material of both sides together is ≤ 13
  (queen 9, rook 5, bishop 3, knight 3). Middlegame: everything else.

Openings trainer:
- One repertoire per colour. A repertoire is a tree of moves from the start position; the player's moves are unique
  per position (one answer each), the opponent's moves may branch. At most 2,000 positions per repertoire.
- Each of the player's positions is a card scheduled with SM-2: ease starts at 2.5, min 1.3; grade 5 (right first
  try) or 1 (wrong). Right: interval 1, 6, then previous × ease days; ease + 0.1. Wrong: interval 1 day, ease − 0.2,
  the right move is shown and must be played to continue.
- A drill plays lines from the start: the app plays the opponent's moves (a branch picked at random, weighted towards
  lines holding due cards) and asks the player's move at each due card; non-due moves of the player are played for them.
  A drill ends after 20 due cards or when none is left. "Due today" counts cards with due date ≤ today (UTC).
- Opening names come from the Lichess `chess-openings` dataset (CC0), by longest matching move sequence.

Endgame trainer:
- Positions are bundled (FEN, level 1–4, goal `win` or `draw`, name and short lesson in English and French): level 1
  basic mates (K+Q v K, K+R v K, K+2B v K), level 2 pawn endings (opposition, square rule, key squares), level 3 rook
  endings (Lucena, Philidor, Vancura), level 4 harder (K+Q v K+R, K+B+N v K, R+P v R defence), about 20 in all.
- The opponent plays the tablebase's best move (Lichess tablebase, ≤ 7 pieces). An attempt passes when a `win` goal
  ends in mate, or a `draw` goal reaches a draw (repetition, stalemate, 50-move rule, insufficient material, or the
  tablebase says draw after the player's move with ≤ 4 pieces left and 30 moves played). It fails when the tablebase
  result gets worse for the player after one of their moves (win → draw/loss, draw → loss): the failing move is shown.
- Three passes in a row: the position is mastered. Progress (attempts, passes, mastered) is kept per position.

Accounts:
- Email unique (case-insensitive), password 10–200 characters, hashed with `scrypt`. 10 failed logins per email per
  15 minutes → 429 for the rest of the window.
- Reset: a single-use link valid 1 hour, sent by email; the answer never tells whether the email exists.
- Deleting the account (password confirmation) deletes every row it owns at once.

## Data

- Personal: the email and the password hash only. No tracking, no analytics, no third-party scripts.
- Must never be lost: repertoires, their cards, and endgame progress (backed up with the database; deletions only by
  the player).
- Can be rebuilt: imported games and analyses (public data, re-imported and re-analysed).
- Retention: everything lives until the player deletes it or the account; sessions expire after 30 days, reset links
  after 1 hour.

## Success criteria

- The MVP journey above works end to end against the fake chess.com and Lichess servers, in English and French.
- Each module's spec reaches `main` with its acceptance tests green and its page usable at 375 and 1024px.
