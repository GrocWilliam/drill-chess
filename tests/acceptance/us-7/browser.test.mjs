import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  VIEWPORTS, demoLink, featureTitleCount, horizontalScroll, launchBrowser, linkInfo, loginLink, newVisitorPage,
  openLanding, pageBackground, recordRequests, signupLink, topBarText, undersizedTargets,
} from '../support/pages.mjs';
import { startServer } from '../support/server.mjs';

let app, browser;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

async function landing(opts) {
  const page = await newVisitorPage(browser, { baseUrl: app.url, ...opts });
  const requests = recordRequests(page);
  await openLanding(page, app.url);
  return { page, requests };
}

describe('theme colours', () => {
  test('dark theme background is rgb(22, 24, 28)', async () => {
    const { page } = await landing({ theme: 'dark' });
    assert.equal(await pageBackground(page), 'rgb(22, 24, 28)');
    await page.context().close();
  });

  test('light theme background is rgb(246, 247, 249)', async () => {
    const { page } = await landing({ theme: 'light' });
    assert.equal(await pageBackground(page), 'rgb(246, 247, 249)');
    await page.context().close();
  });
});

describe('signed-out layout and landing page', () => {
  test('English: brand, login, signup and three feature cards', async () => {
    const { page } = await landing({ lang: 'en' });
    assert.ok((await topBarText(page)).includes('drill-chess'));
    assert.deepEqual(await linkInfo(loginLink(page)), { text: 'Log in', path: '/login' });
    assert.deepEqual(await linkInfo(signupLink(page)), { text: 'Sign up', path: '/signup' });
    for (const t of ['Review your games', 'Drill your openings', 'Master endgames']) {
      assert.equal(await featureTitleCount(page, t), 1, t);
    }
    assert.deepEqual(await linkInfo(demoLink(page)), { text: 'Try the demo game', path: '/games/demo' });
    await page.context().close();
  });

  test('French: links read Se connecter and S\'inscrire', async () => {
    const { page } = await landing({ lang: 'fr' });
    assert.deepEqual(await linkInfo(loginLink(page)), { text: 'Se connecter', path: '/login' });
    assert.deepEqual(await linkInfo(signupLink(page)), { text: "S'inscrire", path: '/signup' });
    for (const t of ['Analysez vos parties', 'Entraînez vos ouvertures', 'Maîtrisez les finales']) {
      assert.equal(await featureTitleCount(page, t), 1, t);
    }
    assert.deepEqual(await linkInfo(demoLink(page)), { text: 'Essayer la partie de démo', path: '/games/demo' });
    await page.context().close();
  });
});

describe('responsive layout', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`${name} ${viewport.width}×${viewport.height}: no sideways scroll, targets ≥ 44×44`, async () => {
      const { page } = await landing({ viewport });
      const s = await horizontalScroll(page);
      assert.ok(s.scrollWidth <= s.innerWidth, `scrollWidth ${s.scrollWidth} > ${s.innerWidth}`);
      assert.deepEqual(await undersizedTargets(page), []);
      await page.context().close();
    });
  }
});

describe('no third party', () => {
  test('every request goes to the app origin and none loads a web font', async () => {
    const { page, requests } = await landing({});
    assert.ok(requests.length > 0);
    const foreign = requests.filter((u) => !/^(data|blob|about):/.test(u) && new URL(u).origin !== app.url);
    assert.deepEqual(foreign, []);
    assert.deepEqual(requests.filter((u) => /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u)), []);
    await page.context().close();
  });
});
