// Headless reproduction: open the app, open search, type a query, check results.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'networkidle' });

await page.evaluate(() => document.querySelector('.search-trigger')?.click());
await page.waitForSelector('.palette-input input', { state: 'visible' });

await page.fill('.palette-input input', 'Grover');
await page.waitForTimeout(400);

const result = await page.evaluate(() => {
  const el = document.querySelector('.palette-input input');
  const groups = Array.from(document.querySelectorAll('.palette-group')).map(g => ({
    label: g.querySelector('.palette-group-label span')?.textContent,
    hits: Array.from(g.querySelectorAll('.palette-hit')).map(h => h.textContent),
  }));
  const noResults = document.querySelector('.muted.small');
  return { groups, noResults: noResults ? noResults.textContent : null, inputVal: el ? el.value : '' };
});

console.log('SEARCH RESULT:', JSON.stringify(result, null, 2));
if (errors.length) console.log('CONSOLE ERRORS:', errors);
await browser.close();
