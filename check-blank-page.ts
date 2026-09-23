import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[console ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[page-error] ${err.message}`);
    consoleErrors.push(`[stack] ${err.stack}`);
  });

  page.on('requestfailed', request => {
    const resp = request.failure();
    networkErrors.push(`[network-error] ${request.url()} - ${resp?.errorText || 'unknown'}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`[http-${response.status()}] ${response.url()}`);
    }
  });

  // Navigate to the site
  console.log('Navigating to https://qubitverse-green.vercel.app...');
  await page.goto('https://qubitverse-green.vercel.app', { waitUntil: 'networkidle' });

  // Wait for React to mount
  await page.waitForTimeout(2000);

  // Check initial state
  const initialContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  console.log(`Initial root HTML length: ${initialContent}`);

  // Check localStorage state
  const lsKeys = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i) || '');
    }
    return keys;
  });
  console.log(`localStorage keys: ${JSON.stringify(lsKeys)}`);

  // Log any console errors from initial load
  console.log(`\nConsole errors from initial load: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  ${e}`));

  // Clear errors for next test
  consoleErrors.length = 0;

  // Navigate to dashboard (requires sign-in, should redirect to login)
  console.log('\n--- Navigating to #/dashboard ---');
  await page.evaluate(() => { window.location.hash = '#/dashboard'; });
  await page.waitForTimeout(2000);

  const dashboardContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  console.log(`Dashboard root HTML length: ${dashboardContent}`);
  console.log(`Current URL hash: ${await page.evaluate(() => window.location.hash)}`);
  console.log(`Console errors:`);
  consoleErrors.forEach(e => console.log(`  ${e}`));
  await page.screenshot({ path: '/tmp/qv-dashboard.png', fullPage: true });

  consoleErrors.length = 0;

  // Navigate to login
  console.log('\n--- Navigating to #/login ---');
  await page.evaluate(() => { window.location.hash = '#/login'; });
  await page.waitForTimeout(2000);

  const loginContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  console.log(`Login root HTML length: ${loginContent}`);
  console.log(`Console errors:`);
  consoleErrors.forEach(e => console.log(`  ${e}`));

  // Try signing up
  console.log('\n--- Attempting signup ---');
  const inputInfo = await page.$$eval('input', els =>
    els.map(e => ({ name: e.getAttribute('name'), placeholder: e.getAttribute('placeholder') }))
  );
  console.log(`Input fields: ${JSON.stringify(inputInfo)}`);

  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'testuser@example.com');
  await page.fill('input[name="password"]', 'testpass123');

  const levelSelect = await page.$('select[name="level"]');
  if (levelSelect) {
    await levelSelect.selectOption('Beginner');
  }

  const buttonInfo = await page.$$eval('button', els =>
    els.map(e => ({ text: e.textContent?.trim(), type: e.type }))
  );
  console.log(`Buttons: ${JSON.stringify(buttonInfo)}`);

  // Click the signup button
  const submitBtn = await page.$('button[type="submit"]') || await page.$('button');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(3000);

    consoleErrors.length = 0;

    const afterSignupContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.length : 0;
    });
    console.log(`After signup root HTML length: ${afterSignupContent}`);
    console.log(`Current hash: ${await page.evaluate(() => window.location.hash)}`);
    console.log(`Console errors after signup:`);
    consoleErrors.forEach(e => console.log(`  ${e}`));
    console.log(`Network errors after signup:`);
    networkErrors.forEach(e => console.log(`  ${e}`));
    await page.screenshot({ path: '/tmp/qv-after-signup.png', fullPage: true });
  }

  await browser.close();
  console.log('\nDone!');
})().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
