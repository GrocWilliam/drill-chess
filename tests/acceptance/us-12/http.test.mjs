import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { logOut, redirectTarget, signedUpUser, visitAs } from '../support/accounts.mjs';
import { followRedirect, openAccount, savePreferences, selectOptions, selectedOption, toastText } from '../support/preferences.mjs';
import { startServer } from '../support/server.mjs';
import { pageLang, pageTheme, visit } from '../support/visitor.mjs';

let app;
before(async () => {
  app = await startServer();
});
after(async () => app?.stop());

const prefs = async (token) => {
  const { html } = await openAccount(app.url, token);
  return { lang: selectedOption(html, 'account-lang'), theme: selectedOption(html, 'account-theme') };
};

describe('the account page shows the preferences', () => {
  test('a user who signed up with Accept-Language fr has fr and system selected', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const r = await openAccount(app.url, u.token);
    assert.equal(r.status, 200);
    assert.equal(selectedOption(r.html, 'account-lang'), 'fr');
    assert.equal(selectedOption(r.html, 'account-theme'), 'system');
  });

  test('shows the email and offers the languages and themes', async () => {
    const u = await signedUpUser(app.url);
    const { html } = await openAccount(app.url, u.token);
    assert.ok(html.includes(u.email));
    assert.ok(/data-testid="account-email"/.test(html));
    assert.ok(/data-testid="account-save"/.test(html));
    const langs = selectOptions(html, 'account-lang');
    assert.deepEqual(langs.filter(([v]) => ['en', 'fr'].includes(v)), [['en', 'English'], ['fr', 'Français']]);
    const themes = selectOptions(html, 'account-theme');
    assert.deepEqual(
      themes.filter(([v]) => ['system', 'light', 'dark'].includes(v)),
      [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']],
    );
  });
});

describe('saving the preferences', () => {
  test('lang=fr and theme=dark: 303 to /account?saved=1, French dark page with the toast, /games too', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'en' });
    const r = await savePreferences(app.url, u.token, { lang: 'fr', theme: 'dark' });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(app.url, r.location), '/account?saved=1');
    const page = await followRedirect(app.url, u.token, r.location);
    assert.equal(pageLang(page.html), 'fr');
    assert.equal(pageTheme(page.html), 'dark');
    assert.equal(toastText(page.html), 'Préférences enregistrées.');
    const games = await visitAs(app.url, u.token, { path: '/games' });
    assert.equal(pageLang(games.html), 'fr');
    assert.equal(pageTheme(games.html), 'dark');
  });

  test('English toast text when saving lang=en', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const r = await savePreferences(app.url, u.token, { lang: 'en', theme: 'light' });
    assert.equal(r.status, 303);
    const page = await followRedirect(app.url, u.token, r.location);
    assert.equal(pageLang(page.html), 'en');
    assert.equal(pageTheme(page.html), 'light');
    assert.equal(toastText(page.html), 'Preferences saved.');
  });

  test('the toast is absent without ?saved=1', async () => {
    const u = await signedUpUser(app.url);
    const { html } = await openAccount(app.url, u.token);
    assert.equal(toastText(html), null);
  });

  test('theme=system removes data-theme from the next page', async () => {
    const u = await signedUpUser(app.url);
    await savePreferences(app.url, u.token, { lang: 'en', theme: 'dark' });
    const r = await savePreferences(app.url, u.token, { lang: 'en', theme: 'system' });
    assert.equal(r.status, 303);
    const page = await followRedirect(app.url, u.token, r.location);
    assert.equal(pageTheme(page.html), null);
  });

  test('lang=de is refused with 400 and nothing changes', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'en' });
    await savePreferences(app.url, u.token, { lang: 'fr', theme: 'dark' });
    const r = await savePreferences(app.url, u.token, { lang: 'de', theme: 'light' });
    assert.equal(r.status, 400);
    assert.deepEqual(await prefs(u.token), { lang: 'fr', theme: 'dark' });
  });

  test('theme=blue is refused with 400 and nothing changes', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'en' });
    await savePreferences(app.url, u.token, { lang: 'fr', theme: 'dark' });
    const r = await savePreferences(app.url, u.token, { lang: 'en', theme: 'blue' });
    assert.equal(r.status, 400);
    assert.deepEqual(await prefs(u.token), { lang: 'fr', theme: 'dark' });
  });

  test('a missing value is refused with 400', async () => {
    const u = await signedUpUser(app.url);
    const r = await savePreferences(app.url, u.token, { lang: 'fr' });
    assert.equal(r.status, 400);
    assert.deepEqual(await prefs(u.token), { lang: 'en', theme: 'system' });
  });
});

describe('the user preferences override the visitor rules', () => {
  test('a French user with cookies lang=en and theme=light gets French and their own theme', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'en' });
    await savePreferences(app.url, u.token, { lang: 'fr', theme: 'dark' });
    const r = await visitAs(app.url, u.token, {
      path: '/games', acceptLanguage: 'en', cookies: { lang: 'en', theme: 'light' },
    });
    assert.equal(pageLang(r.html), 'fr');
    assert.equal(pageTheme(r.html), 'dark');
  });

  test('after logout the visitor rules apply again: Accept-Language en gives lang="en"', async () => {
    const u = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const before = await visitAs(app.url, u.token, { path: '/games', acceptLanguage: 'en' });
    assert.equal(pageLang(before.html), 'fr');
    await logOut(app.url, u.token);
    const r = await visit(app.url, { path: '/', acceptLanguage: 'en' });
    assert.equal(pageLang(r.html), 'en');
  });
});
