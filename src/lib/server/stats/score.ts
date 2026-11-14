/** The score in percent: wins count 1, draws ½; a rounded integer, 0 with no game. */
export function scorePercent(wins: number, draws: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((100 * (wins + 0.5 * draws)) / games);
}

/**
 * The index of the rating series to show: the one named `requested` (`<site>-<time>`) when it exists, else the one
 * with the most points (the earlier one on a tie), -1 with no series.
 */
export function pickSeries(series: { site: string; time: string; points: unknown[] }[], requested?: string): number {
  if (series.length === 0) return -1;
  const named = requested ? series.findIndex((s) => `${s.site}-${s.time}` === requested) : -1;
  if (named >= 0) return named;
  let best = 0;
  series.forEach((s, i) => {
    if (s.points.length > series[best].points.length) best = i;
  });
  return best;
}
