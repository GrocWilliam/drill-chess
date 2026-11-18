// Pure progress arithmetic of one endgame position.
export interface Counters {
  attempts: number;
  passes: number;
  streak: number;
  mastered: boolean;
}

export const MASTERY_STREAK = 3;

export const emptyProgress = (): Counters => ({ attempts: 0, passes: 0, streak: 0, mastered: false });

/** Progress after one attempt; mastery, once reached, is never lost. */
export function nextProgress(p: Counters, passed: boolean): Counters {
  const streak = passed ? p.streak + 1 : 0;
  return {
    attempts: p.attempts + 1,
    passes: p.passes + (passed ? 1 : 0),
    streak,
    mastered: p.mastered || streak >= MASTERY_STREAK,
  };
}
