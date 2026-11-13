import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { repoRoot, startServer } from '../support/server.mjs';
import { messageKeys, pageLang, pageTheme, htmlTag, visit } from '../support/visitor.mjs';

let app;
before(async () => (app = await startServer()));
after(async () => app?.stop());

const FR = ['Analysez vos parties', 'Entraînez vos ouvertures', 'Maîtrisez les finales'];
const EN = ['Review your games', 'Drill your openings', 'Master endgames'];
const lang = async (o) => pageLang((await visit(app.url, o)).html);
const theme = async (o) => pageTheme((await visit(app.url, o)).html);

describe('visitor language', () => {
  test('French Accept-Language gives a French page', async () => {
    const r = await visit(app.url, { acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' });
    assert.equal(r.status, 200);
    assert.match(r.html, /<html[^>]*\blang="fr"/);
    for (const t of FR) assert.ok(r.html.includes(t), t);
  });

  test('English Accept-Language gives an English page', async () => {
    const r = await visit(app.url, { acceptLanguage: 'en-US,en;q=0.9' });
    assert.equal(r.status, 200);
    assert.match(r.html, /<html[^>]*\blang="en"/);
    for (const t of EN) assert.ok(r.html.includes(t), t);
  });

  test('only the first language counts', async () => {
    assert.equal(await lang({ acceptLanguage: 'de-DE,fr;q=0.9' }), 'en');
  });

  test('no Accept-Language gives English', async () => {
    assert.equal(await lang({}), 'en');
  });

  test('the lang cookie overrides Accept-Language', async () => {
    assert.equal(await lang({ acceptLanguage: 'fr', cookies: { lang: 'en' } }), 'en');
    assert.equal(await lang({ acceptLanguage: 'en', cookies: { lang: 'fr' } }), 'fr');
  });

  test('an invalid lang cookie is ignored', async () => {
    assert.equal(await lang({ acceptLanguage: 'fr', cookies: { lang: 'xx' } }), 'fr');
    assert.equal(await lang({ acceptLanguage: 'en', cookies: { lang: 'xx' } }), 'en');
  });
});

describe('visitor theme', () => {
  test('theme=dark and theme=light set data-theme', async () => {
    assert.equal(await theme({ cookies: { theme: 'dark' } }), 'dark');
    assert.equal(await theme({ cookies: { theme: 'light' } }), 'light');
  });

  test('theme=system, an invalid value or no cookie leaves data-theme out', async () => {
    for (const cookies of [{ theme: 'system' }, { theme: 'blue' }, {}]) {
      const r = await visit(app.url, { cookies });
      assert.equal(r.status, 200);
      assert.ok(htmlTag(r.html).startsWith('<html'));
      assert.doesNotMatch(htmlTag(r.html), /data-theme/, JSON.stringify(cookies));
    }
  });
});

describe('translations', () => {
  test('en.json and fr.json have exactly the same keys', () => {
    const load = (l) => JSON.parse(readFileSync(`${repoRoot}/src/lib/i18n/${l}.json`, 'utf8'));
    const en = messageKeys(load('en')).sort();
    const fr = messageKeys(load('fr')).sort();
    assert.ok(en.length > 0);
    assert.deepEqual(fr, en);
  });
});
