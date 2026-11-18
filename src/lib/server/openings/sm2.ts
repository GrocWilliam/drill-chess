// Pure SM-2 scheduler for repertoire cards.
export interface CardState {
  ease: number;
  intervalDays: number;
  reps: number;
}
export interface Scheduled extends CardState {
  dueOn: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Applies one review; `today` is `YYYY-MM-DD` (UTC). */
export function review(card: CardState, correct: boolean, today: string): Scheduled {
  let ease: number;
  let intervalDays: number;
  let reps: number;
  if (correct) {
    reps = card.reps + 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.intervalDays * card.ease);
    ease = round2(card.ease + 0.1);
  } else {
    reps = 0;
    intervalDays = 1;
    ease = Math.max(1.3, round2(card.ease - 0.2));
  }
  const due = new Date(`${today}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + intervalDays);
  return { ease, intervalDays, reps, dueOn: due.toISOString().slice(0, 10) };
}
