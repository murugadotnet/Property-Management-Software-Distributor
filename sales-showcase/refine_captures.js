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

async function refine() {
  console.log('Spawning NestJS server on port 3005...');
  const server = spawn('node', ['dist/main.js'], {
    cwd: '/home/user/business/pg-software/apps/local-app',
    env: { ...process.env, PORT: '3005', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let browser;
  try {
    await waitHttp('http://127.0.0.1:3005/api/v1/health');
    console.log('Server is UP!');

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
    console.log('Logging in...');
    await page.goto('http://127.0.0.1:3005/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'raj@pg.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);

    // 1. Refine 03_property_room_grid.png by clicking "Rooms & Beds" tab
    console.log('Capturing Rooms & Beds grid...');
    await page.goto('http://127.0.0.1:3005/properties/2a0c2509-6a06-4c9d-b703-0d0623a9c226', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Click "Rooms & Beds" tab button
    const roomsTab = await page.getByRole('button', { name: /Rooms & Beds/i }).or(page.locator('button:has-text("Rooms & Beds")')).first();
    if (await roomsTab.isVisible()) {
      await roomsTab.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '03_property_room_grid.png'), fullPage: false });
    console.log('Updated 03_property_room_grid.png');

    // 2. Refine 05_tenant_profile_360.png with Aditya Nair (occupancy 0ff2dc4c-9c15-4614-92f9-fda5f12b3d90)
    console.log('Capturing Tenant Profile 360...');
    await page.goto('http://127.0.0.1:3005/tenants/0ff2dc4c-9c15-4614-92f9-fda5f12b3d90', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '05_tenant_profile_360.png'), fullPage: false });
    console.log('Updated 05_tenant_profile_360.png');

    // 3. Refine 10_ledger_profile_passbook.png with Shree Balaji Electricals (7b241a2b-7e2f-4206-86a5-4f0f82fdaf60)
    console.log('Capturing Ledger Passbook...');
    await page.goto('http://127.0.0.1:3005/ledgers/7b241a2b-7e2f-4206-86a5-4f0f82fdaf60', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '10_ledger_profile_passbook.png'), fullPage: false });
    console.log('Updated 10_ledger_profile_passbook.png');

    // 4. Capture 15_property_wizard.png (/properties/new)
    console.log('Capturing Property Wizard...');
    await page.goto('http://127.0.0.1:3005/properties/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, '15_property_wizard.png'), fullPage: false });
    console.log('Captured 15_property_wizard.png');

    // 5. Refine 14_settings_smtp_automation.png: scroll down to show SMTP Mail Pool & Automation rules
    console.log('Capturing Settings SMTP & Reminders...');
    await page.goto('http://127.0.0.1:3005/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Scroll down to reveal email / reminders / license
    await page.evaluate(() => window.scrollBy(0, 750));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, '14_settings_smtp_automation.png'), fullPage: false });
    console.log('Updated 14_settings_smtp_automation.png');

    console.log('All refined captures complete!');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

refine().catch(e => {
  console.error('Refine error:', e);
  process.exit(1);
});

