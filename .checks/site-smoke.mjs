// Run with Node and an installed Playwright package. See README.md in this folder.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat, mkdir} from 'node:fs/promises';
import {resolve, dirname, extname, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'news.html', 'news-bookmark-focus.html', 'news-v2-chrome-web-store.html', 'guide.html', 'privacy.html', 'terms.html', 'request.html', 'bugs.html'];
const mime = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml', '.txt':'text/plain'};
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Outside root');
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []
  });
  const context = await browser.newContext({reducedMotion:'reduce', permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('request', req => requests.push({url:req.url(), method:req.method()}));
  const references = [], documents = new Map();
  let layouts = 0;
  for (const name of pages) {
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({width, height:1000});
      assert.equal((await page.goto(`${origin}/${name}`)).status(), 200);
      await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
      const report = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth > innerWidth + 1,
        h1:document.querySelectorAll('h1').length,
        title:document.title,
        description:document.querySelector('meta[name=description]')?.content,
        brokenImages:[...document.images].filter(img => !img.naturalWidth || !img.alt).map(img => img.src),
        canonical:document.querySelector('link[rel=canonical]')?.href,
        og:document.querySelector('meta[property="og:url"]')?.content,
        ids:[...document.querySelectorAll('[id]')].map(el => el.id),
        links:[...document.querySelectorAll('a[href],link[href],script[src],img[src]')].map(el => el.getAttribute('href') || el.getAttribute('src')),
        footer:[...document.querySelectorAll('footer a')].map(el => el.getAttribute('href'))
      }));
      assert.equal(report.overflow, false, `${name} overflows at ${width}px`);
      assert.equal(report.h1, 1, `${name}: exactly one H1`);
      assert.ok(report.title && report.description, `${name}: metadata`);
      assert.deepEqual(report.brokenImages, []);
      assert.equal(report.canonical, 'https://1sttab-app.web.app/' + (name === 'index.html' ? '' : name.replace('.html','')));
      assert.equal(report.canonical, report.og);
      assert.equal(new Set(report.ids).size, report.ids.length, `${name}: duplicate IDs`);
      assert.ok(report.footer.includes('privacy.html') && report.footer.includes('terms.html') && report.footer.includes('guide.html') && report.footer.includes('LICENSE.txt'));
      if (width === 1440) { documents.set(name, new Set(report.ids)); references.push(...report.links.map(href => ({name, href}))); }
      layouts++;
    }
  }
  for (const {name, href} of references) {
    const url = new URL(href, `${origin}/${name}`);
    assert.ok(!['javascript:', 'data:'].includes(url.protocol), `Unsafe link in ${name}`);
    if (url.origin !== origin) continue;
    const path = url.pathname.slice(1) || 'index.html';
    assert.ok((await stat(resolve(root, path))).isFile(), `${name}: missing ${href}`);
    if (url.hash) assert.ok(documents.get(path)?.has(decodeURIComponent(url.hash.slice(1))), `${name}: missing anchor ${href}`);
  }
  await page.goto(`${origin}/index.html`);
  await page.locator('[data-preview=cards]').click();
  assert.equal(await page.locator('[data-preview=cards]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#workspace-image').getAttribute('src'), /cards/);
  await page.locator('[data-preview=list]').click();
  assert.equal(await page.locator('[data-preview=cards]').getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('#workspace-image').getAttribute('src'), /list/);
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.menu-toggle').evaluate(el => el === document.activeElement), true);
  await page.locator('.menu-toggle').click();
  await page.locator('#site-menu a').first().click();
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  for (const summary of await page.locator('.faq-list summary').all()) {
    await summary.click();
    assert.equal(await summary.evaluate(el => el.parentElement.open), true);
  }
  for (const name of ['request.html', 'bugs.html']) {
    await page.goto(`${origin}/${name}`);
    const form = page.locator('[data-feedback]');
    const submit = form.locator('button[type=submit]');
    await submit.click();
    assert.equal(await form.locator('.draft-result').isVisible(), false);
    await form.locator('select').selectOption({index:1});
    for (const field of await form.locator('input[required],textarea[required]').all()) await field.fill('   ');
    await submit.click();
    assert.equal(await form.locator('.draft-result').isVisible(), false, 'Whitespace-only reports rejected');
    const title = 'Folder & tags + café #1 <script>test</script>';
    for (const field of await form.locator('input[required],textarea[required]').all()) await field.fill('Meaningful report\nWith details');
    await form.locator('#title').fill(title);
    await submit.click();
    assert.equal(await form.locator('.draft-result').isVisible(), true);
    assert.equal(await form.locator('.draft-status').evaluate(el => el === document.activeElement), true);
    const message = await form.locator('#draft-message').inputValue();
    const mail = new URL(await form.locator('.draft-email').getAttribute('href'));
    assert.equal(mail.protocol, 'mailto:');
    assert.equal(mail.pathname, 'aablotia@ablotia.com');
    assert.equal(mail.searchParams.get('body'), message);
    assert.ok(mail.searchParams.get('subject').endsWith(title));
    await form.locator('.copy-draft').click();
    await page.waitForFunction(() => document.querySelector('.draft-status').textContent.startsWith('Message copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), message);
    await form.locator('#title').fill('Updated report');
    assert.equal(await form.locator('.draft-result').isVisible(), false, 'Stale drafts hidden after editing');
    assert.equal(await form.locator('.draft-email').getAttribute('href'), null);
    await submit.click();
    assert.match(await form.locator('#draft-message').inputValue(), /Updated report/);
    await form.locator('select').selectOption({index:2});
    assert.equal(await form.locator('.draft-result').isVisible(), false, 'Select changes invalidate drafts');
    await submit.click();
    await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', {configurable:true,value:async () => {throw new Error('Clipboard denied');}}); });
    await form.locator('.copy-draft').click();
    await page.waitForFunction(() => document.querySelector('.draft-status').textContent.startsWith('Select and copy'));
    assert.equal(await form.locator('#draft-message').evaluate(el => el.selectionEnd-el.selectionStart), (await form.locator('#draft-message').inputValue()).length);
  }
  const noJs = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:844}});
  const fallback = await noJs.newPage();
  await fallback.goto(`${origin}/request.html`);
  assert.equal(await fallback.locator('#site-menu').isVisible(), true);
  assert.equal(await fallback.locator('button[type=submit]').isDisabled(), true);
  assert.equal(await fallback.locator('noscript a').getAttribute('href'), 'mailto:aablotia@ablotia.com');
  await noJs.close();
  assert.deepEqual(errors, [], 'No browser or network errors');
  assert.deepEqual(requests.filter(req => !req.url.startsWith(origin) || req.method !== 'GET'), [], 'No external or form-submission requests');
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, {recursive:true});
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(`${origin}/index.html`);
      await page.screenshot({path:resolve(process.env.SCREENSHOT_DIR, `home-${width}.png`),fullPage:true});
    }
  }
  console.log(`PASS: ${pages.length} pages, ${layouts} layouts, ${references.length} links/assets; navigation, previews, FAQs, feedback validation, draft invalidation, clipboard success/fallback, and no-JS fallback.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
