/** The score in percent: wins count 1, draws ½; a rounded integer, 0 with no game. */
export function scorePercent(wins: number, draws: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((100 * (wins + 0.5 * draws)) / games);
}
