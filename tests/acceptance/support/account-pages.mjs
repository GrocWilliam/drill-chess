// Browser domain layer for the signup page and the signed-in layout. No assertions of a criterion here.

export const openSignup = (page, baseUrl) => page.goto(baseUrl + '/signup');
export const openGames = (page, baseUrl) => page.goto(baseUrl + '/games');

/** The current path of the page. */
export const currentPath = (page) => new URL(page.url()).pathname;

/** Fills the signup form and presses `signup-submit`; waits until the page leaves /signup or shows an alert. */
export async function signUpThroughForm(page, { email, password }) {
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill(password);
  await page.getByTestId('signup-submit').click();
  await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith('/signup')),
    page.getByRole('alert').first().waitFor(),
  ]);
}

/** Texts of the elements announced with role="alert". */
export async function alertTexts(page) {
  return (await page.getByRole('alert').allInnerTexts()).map((t) => t.trim());
}

/** Whether an element with this data-testid is visible on the page. */
export async function isShown(page, testid) {
  const all = page.getByTestId(testid);
  for (let i = 0; i < (await all.count()); i++) if (await all.nth(i).isVisible()) return true;
  return false;
}

/** The bottom tab bar's `nav-games` link: { visible, text, path }. */
export async function tabBarGamesLink(page) {
  const link = page.getByTestId('nav-tabs').getByTestId('nav-games');
  return {
    visible: await link.isVisible(),
    text: (await link.innerText()).trim(),
    path: new URL(await link.getAttribute('href'), 'http://x').pathname,
  };
}

/** Opens the account menu (`nav-account`) and presses Log out (`nav-logout`); waits until the page has navigated. */
export async function logOutThroughMenu(page) {
  const before = page.url();
  await page.getByTestId('nav-account').click();
  const logout = page.getByTestId('nav-logout');
  const isForm = await logout.evaluate((el) => el.tagName === 'FORM');
  const target = isForm ? logout.locator('button[type="submit"], button:not([type]), input[type="submit"]').first() : logout;
  await target.click();
  await page.waitForURL((u) => u.href !== before);
}

/** Links in the page body (outside the navigation's own `nav-*` links) whose path is `path`. */
export async function contentLinkCount(page, path) {
  return page.evaluate((p) =>
    [...document.querySelectorAll('a[href]')].filter(
      (a) => !(a.dataset.testid ?? '').startsWith('nav-') && new URL(a.href).pathname === p,
    ).length, path);
}

/** Whether a heading reads exactly `text`. */
export async function headingShown(page, text) {
  return (await page.getByRole('heading', { name: text, exact: true }).count()) > 0;
}

export const openLogin = (page, baseUrl, query = '') => page.goto(baseUrl + '/login' + query);

/** Fills the login form and presses `login-submit`; waits until the page leaves /login or shows an alert. */
export async function logInThroughForm(page, { email, password }) {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith('/login')),
    page.getByRole('alert').first().waitFor(),
  ]);
}
