const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
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

async function capture() {
  console.log('Spawning NestJS server on port 3005...');
  const server = spawn('node', ['dist/main.js'], {
    cwd: '/home/user/business/pg-software/apps/local-app',
    env: { ...process.env, PORT: '3005', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('running') || s.includes('Error')) console.log('[Server stdout]:', s.trim());
  });
  server.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('Error')) console.error('[Server stderr]:', s.trim());
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

    const routes = [
      { name: '01_dashboard.png', path: '/' },
      { name: '02_properties_list.png', path: '/properties' },
      { name: '03_property_room_grid.png', path: '/properties/2a0c2509-6a06-4c9d-b703-0d0623a9c226' },
      { name: '04_tenants_directory.png', path: '/tenants' },
      { name: '05_tenant_profile_360.png', path: '/tenants/7f5c881d-cf6f-45f8-834f-36f5cd1becc4' },
      { name: '06_tenant_applications.png', path: '/tenant-applications' },
      { name: '07_rent_bills_payments.png', path: '/payments' },
      { name: '08_purchases_expenses.png', path: '/purchases' },
      { name: '09_account_ledgers.png', path: '/ledgers' },
      { name: '10_ledger_profile_passbook.png', path: '/ledgers/21d65d56-22f6-4f9f-9383-b71ac9b4cf22' },
      { name: '11_owner_ledger.png', path: '/accounts' },
      { name: '12_tasks_board.png', path: '/tasks' },
      { name: '13_announcements.png', path: '/notices' },
      { name: '14_settings_smtp_automation.png', path: '/settings' }
    ];

    for (const r of routes) {
      console.log(`Navigating to ${r.path}...`);
      await page.goto(`http://127.0.0.1:3005${r.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // let animations, charts & icons finish rendering
      const outPath = path.join(OUT_DIR, r.name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Captured ${r.name}`);
    }

    console.log('All screenshots captured successfully!');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

capture().catch(e => {
  console.error('Capture failed:', e);
  process.exit(1);
});

