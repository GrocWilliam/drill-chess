import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { currentPath } from '../support/account-pages.mjs';
import { signedUpUser } from '../support/accounts.mjs';
import { resetLinkIn, waitForMailTo } from '../support/mail.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
import { requestResetThroughForm, setNewPasswordThroughForm } from '../support/reset.mjs';
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

describe('a French visitor resets their password on a phone', () => {
  test('requests a link, opens it from the outbox, sets a password and lands on /games; both pages fit', async () => {
    const user = await signedUpUser(app.url, { acceptLanguage: 'fr' });
    const p = await newVisitorPage(browser, {
      baseUrl: app.url, lang: 'fr', acceptLanguage: 'fr-FR', viewport: VIEWPORTS.mobile,
    });
    await requestResetThroughForm(p, app.url, user.email);
    const s1 = await horizontalScroll(p);
    assert.ok(s1.scrollWidth <= s1.innerWidth, `/reset scrollWidth ${s1.scrollWidth} > ${s1.innerWidth}`);
    assert.deepEqual(await undersizedTargets(p), []);

    const mail = await waitForMailTo(app.outbox, user.email);
    assert.ok(mail, 'a mail was sent');
    const link = resetLinkIn(mail.text);
    assert.ok(link);
    await p.goto(link.url);
    const s2 = await horizontalScroll(p);
    assert.ok(s2.scrollWidth <= s2.innerWidth, `/reset/<token> scrollWidth ${s2.scrollWidth} > ${s2.innerWidth}`);
    assert.deepEqual(await undersizedTargets(p), []);

    await setNewPasswordThroughForm(p, 'brand-new-pass-2');
    assert.equal(currentPath(p), '/games');
    await p.context().close();
  });
});
