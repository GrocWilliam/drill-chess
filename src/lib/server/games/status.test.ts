import { describe, expect, it } from 'vitest';
import { visibleStatuses, type JobStatusView } from './index';
import { messagesFor, translatePlural } from '../../i18n';

const job = (o: Partial<JobStatusView>): JobStatusView => ({
  site: 'chesscom', status: 'done', imported: 7, skipped: 3, error: null, finishedAt: null, ...o,
});
const now = new Date('2026-01-02T12:00:00Z');

describe('visibleStatuses', () => {
  it('keeps active jobs and done jobs finished less than 24 h ago', () => {
    expect(visibleStatuses([job({ status: 'running' }), job({ site: 'lichess', status: 'queued' })], now)).toHaveLength(2);
    expect(visibleStatuses([job({ finishedAt: new Date('2026-01-01T12:00:01Z') })], now)).toHaveLength(1);
  });
  it('hides done jobs after 24 h and other states', () => {
    expect(visibleStatuses([job({ finishedAt: new Date('2026-01-01T12:00:00Z') })], now)).toHaveLength(0);
  });
  it('keeps a failed job (the latest of its site) whatever its age', () => {
    expect(visibleStatuses([job({ status: 'failed', error: 'site_unavailable', finishedAt: new Date('2025-01-01') })], now)).toHaveLength(1);
  });
});

describe('translatePlural', () => {
  it('picks the plural form', () => {
    expect(translatePlural(messagesFor('en'), 'en', 'games.status.running', 1)).toBe('Importing… 1 game');
    expect(translatePlural(messagesFor('fr'), 'fr', 'games.status.imported', 7)).toBe('7 parties importées');
  });
  it('has the failure line in both languages', () => {
    expect(messagesFor('en')['games.status.failed.site_unavailable']).toBe('Import failed: The site did not answer. Try again later.');
    expect(messagesFor('fr')['games.status.failed.site_unavailable']).toBe("Échec de l'importation : Le site n'a pas répondu. Réessayez plus tard.");
  });
});
