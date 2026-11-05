const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright-core');

const OUT_DIR = '/home/user/business/pg-software/sales-showcase/screenshots';

async function waitHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error('status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error('Server timed out waiting for ' + url);
}

async function captureExtras() {
  console.log('Spawning server...');
  const server = spawn('node', ['dist/main.js'], {
    cwd: '/home/user/business/pg-software/apps/local-app',
    env: { ...process.env, PORT: '3005', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let browser;
  try {
    await waitHttp('http://127.0.0.1:3005/api/v1/health');
    browser = await chromium.launch({
      executablePath: '/home/user/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    // Login
    await page.goto('http://127.0.0.1:3005/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'raj@pg.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 1. SMTP Mail Settings
    console.log('Capturing Mail settings...');
    await page.goto('http://127.0.0.1:3005/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const el = document.querySelector('.card:last-child') || document.body;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '14_smtp_mail_engine.png') });

    // 2. Excel Bulk Onboard Modal on /tenants
    console.log('Capturing Bulk Onboard Modal...');
    await page.goto('http://127.0.0.1:3005/tenants', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const bulkBtn = await page.getByRole('button', { name: /Excel Bulk Onboard/i }).first();
    if (await bulkBtn.isVisible()) {
      await bulkBtn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT_DIR, '16_bulk_onboard_modal.png') });
    }

    // 3. New Tenant Bill / Due Modal on /payments
    console.log('Capturing New Bill / Due Modal...');
    await page.goto('http://127.0.0.1:3005/payments', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const billBtn = await page.getByRole('button', { name: /\+ New Tenant Bill \/ Due/i }).first();
    if (await billBtn.isVisible()) {
      await billBtn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT_DIR, '17_new_bill_modal.png') });
    }

    console.log('Extra screenshots done!');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

captureExtras().catch(e => {
  console.error(e);
  process.exit(1);
});

