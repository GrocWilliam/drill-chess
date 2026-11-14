# UI guide

The design every UI story follows. Stories add their pages' details and `data-testid`s here.

## Direction

A calm, focused tool in the spirit of Lichess: the board is the hero, no decoration around it. Dark and light themes.
Mobile first: players drill openings on their phone.

## Tokens

In `src/app.css` (`@theme`), as CSS variables switched by `data-theme` on `<html>` (`light`, `dark`, or absent →
`prefers-color-scheme`):

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f6f7f9` | `#16181c` |
| `--surface` | `#ffffff` | `#1f2228` |
| `--border` | `#d9dde3` | `#333842` |
| `--text` | `#1b1e23` | `#e7e9ec` |
| `--muted` | `#5d6470` | `#9aa1ac` |
| `--accent` | `#3f9b6a` | `#5cbf8a` |
| `--accent-text` | `#ffffff` | `#0e1a13` |
| `--danger` | `#c43c3c` | `#ef6b6b` |
| `--best` | `#3f9b6a` | `#5cbf8a` |
| `--inaccuracy` | `#b7870f` | `#e6b84a` |
| `--mistake` | `#d9701e` | `#f0924a` |
| `--blunder` | `#c43c3c` | `#ef6b6b` |

- Board squares: light `#f0d9b5`, dark `#b58863` (both themes); last move `rgba(155, 199, 0, 0.41)`; check: red radial.
- Text contrast is at least 4.5:1 on `--bg` and `--surface` in both themes.
- Type: system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`); numbers and moves in
  `ui-monospace` with `font-variant-numeric: tabular-nums`. Sizes 14 (small, meta), 16 (body), 20 (h3), 24 (h2),
  32px (h1, 24px below 768px). No web fonts.
- Spacing: Tailwind's scale (4px steps). Radius 6px for controls, 10px for cards. Shadows: none; cards use `--border`.

## Breakpoints and grid

- Mobile first, `md:` 768px and `lg:` 1024px only. Target viewports: 375×812, 768×1024, 1024×768, 1440×900.
- Page body: full width with 16px gutters; max 72rem centred from 1024px.
- Board pages (`/games/[id]`, `/games/demo`, `/openings/[colour]`, `/openings/drill`, `/endgames/[id]`):
  - below 1024px: eval bar as a 12px horizontal strip above the board, the board at full width (max 100vw − 32px,
    square), then the panel;
  - from 1024px: three columns, eval bar 24px vertical, board `min(640px, 100vh − 160px)` square, panel 380px; all
    tops aligned.
- List pages: one column below 768px; cards grid of 2 from 768px, 3 from 1024px where it holds cards.

## Navigation

- Signed in, below 768px: a fixed bottom tab bar `nav-tabs` (64px high, safe-area padding) with `nav-games`,
  `nav-stats`, `nav-openings`, `nav-endgames` (icon in inline SVG and label); the current one has
  `aria-current="page"` and `--accent` colour. A top bar holds the app name and `nav-account`.
- From 768px: one top bar with the name (link to `/games`), the same four links, and `nav-account` at the right.
- Signed out: the top bar holds the name, `nav-login` and `nav-signup` (primary).
- Keyboard on board pages: ← previous, → next, Home start, End end, F flip.

## Pages

| Page | Content | Links |
|---|---|---|
| `/` | signed out: pitch (three features as cards), `nav-signup`, `landing-demo` (link to `/games/demo`); signed in: redirect 303 to `/games` | |
| `/signup`, `/login` | one card, centred, max 24rem: fields, primary submit, link to the other and to `/reset` | `next` param kept |
| `/reset`, `/reset/[token]` | email form; new password form | to `/login` |
| `/account` | linked usernames (one row per site: username or a link form, Unlink), language, theme, Delete account (danger, in a modal) | |
| `/games` | import status line, Sync per site, filters row, list (table from 768px, cards below), empty state | each row to `/games/[id]` |
| `/games/[id]`, `/games/demo` | board page: board, eval bar, panel with players, the move list, analysis progress, best move, accuracy, eval curve | back to `/games` |
| `/stats` | filter by site and time control; results by colour, by opening (top 10), by time control; rating curve; mistakes per game by phase | to filtered `/games` |
| `/openings` | two repertoire cards (White, Black: positions, due today, learned), `drill-start` | to `/openings/[colour]`, `/openings/drill` |
| `/openings/[colour]` | board page: play moves to add them, tree of the current position's moves, delete a move (danger) | |
| `/openings/drill` | board page: the line so far, the opening name, right/wrong feedback, cards left | back to `/openings` |
| `/endgames` | the 4 levels, each a grid of position cards (name, goal, mastered badge, streak) | to `/endgames/[id]` |
| `/endgames/[id]` | board page: goal, lesson, result of the attempt, Retry | back to `/endgames` |

## Board page (game review)

The panel holds, in this order: the game details (players with ratings, result; the demo shows the event),
`review-progress`, `move-list`, `review-best`, `review-accuracy`, `eval-curve`, the controls row (`review-start`,
`review-prev`, `review-next`, `review-end`, `review-flip`: 44px ghost buttons), `review-reanalyse` (secondary, not on
the demo), and the link to the game on its site.

States:
- analysing: `review-progress` reads "Analysing move N/M"; the board stays usable;
- done: marks, best move, accuracies, eval curve;
- error: `review-error` (`role="alert"`) with a `review-retry` button;
- stored: shown at once, with no analysis;
- free play on the demo: `review-back-to-game` link;
- no JavaScript: players, result and moves as text, with the `review-noscript` line.

## Components

In `src/lib/components/` unless said otherwise:
- `Button` variants `primary` (accent background, `--accent-text`), `secondary` (border `--border`, `--text`),
  `ghost` (no border), `danger` (border and text `--danger`); 44px minimum height; `aria-busy` while submitting.
- `Field`: label above, input, hint, error below (`role="alert"`, text in the user's language); the input gets
  `aria-invalid` and `aria-describedby`.
- `Card` (surface, border, 10px radius, 16px padding). `Badge` (time class, mark, mastered). `EmptyState` (title,
  text, one action). `Skeleton` (blocks while loading). `Toast` (bottom, 4s, `role="status"`). `Modal` (native
  `<dialog>`, opener `?modal=<kind>` so it works without JavaScript).
- `ResponsiveTable`: a `<table>` from 768px, a list of cards below, same `data-testid` per row.
- Chess (in `src/lib/chess/`): `Board.svelte` (chessground; props `fen`, `orientation`, `movable`, `lastMove`,
  `onMove`; a `board-move-input` text field accepting SAN or UCI, for keyboard and screen readers), `EvalBar.svelte`
  (white share = `W(cp)`), `MoveList.svelte` (an `<ol>` of move pairs; each move a button with its mark symbol and
  an `aria-label` like "14. Nf3, mistake"), `EvalCurve.svelte` (inline SVG, 0–100 win chance per ply, marks as dots).
- Charts are inline SVG built in the component, with a text table alternative (`<details>`).
- Marks always show their symbol (`?!`, `?`, `??`, best `!`) with their colour, never the colour alone.

## Screen states

Every page has: empty (an `EmptyState` with the next action, e.g. `/games`: "Link a chess.com or Lichess username to
import your games" with the link form), loading (`Skeleton`, or a progress line on board pages: "Analysing move
23/61"), error (`role="alert"` in the panel or form concerned, with Retry when it makes sense), success (content,
and a `Toast` after a write).

## Accessibility

WCAG 2.2 AA. 44×44px targets, visible focus (2px `--accent` outline, 2px offset), no sideways scroll at 375px,
nothing only on hover, `prefers-reduced-motion` turns piece animation off. Board pages without JavaScript show a
`<noscript>` message.

## Test ids

kebab-case `<page>-<element>` (`games-sync-chesscom`, `review-eval-bar`, `drill-board`), shared components their own
name (`board`, `board-move-input`, `move-list`, `eval-bar`, `toast`, `empty-state`).

Board and game review ids:
- `board` (also `data-fen`, the FEN shown, and `data-orientation` `white|black`), `board-move-input`,
  `board-move-invalid`, `board-promotion` (buttons `board-promotion-q`, `board-promotion-r`, `board-promotion-b`,
  `board-promotion-n`);
- `eval-bar` (`role="meter"`, `aria-valuenow` = White's win chance, one decimal);
- `move-list`, `move` (with `data-ply`; the current one `aria-current="true"`);
- `eval-curve`, `eval-curve-ply` (one click target per ply, with `data-ply`);
- `review-progress`, `review-best`, `review-accuracy` (with `review-accuracy-white` and `review-accuracy-black`),
  `review-start`, `review-prev`, `review-next`, `review-end`, `review-flip`, `review-reanalyse`,
  `review-back-to-game`, `review-error`, `review-retry`, `review-noscript`;
- `landing-demo`, `games-analysed`. Repeated items carry their id
(`games-row` with `data-game-id`). Keep ids stable when restyling.

Ids of the visitor layout and account pages (shared by the stories):
- navigation: `nav-login`, `nav-signup`, `nav-games`, `nav-account`, `nav-logout`;
- sign up, log in and reset: `signup-email|password|submit`, `login-email|password|submit`, `reset-email|submit`,
  `reset-password`, `reset-password-submit`;
- account: `account-email|lang|theme|save|delete`, `modal-delete-account`, `delete-password`, `delete-confirm`;
- linked usernames: `link-chesscom`, `link-lichess`, `link-<site>-username`, `link-<site>-submit`, `unlink-<site>`,
  `modal-unlink-<site>`, `unlink-<site>-confirm`;
- games list: `games-empty`, `games-status`, `games-sync-<site>`, `games-filters`, `games-filter-submit`,
  `games-filter-reset`, `games-list`, `games-row` (with `data-game-id`), `games-next`, `games-prev`, `games-none`;
- game page: `game-details`, `game-site-link`, `game-moves`;
- shared: `toast`.
