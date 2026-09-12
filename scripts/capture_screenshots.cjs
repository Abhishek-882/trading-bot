const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\577b1800-7c72-461f-a27c-bfcafc4e43d5';

async function capture() {
  console.log('Launching Chrome via puppeteer-core at:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
  });

  try {
    const page = await browser.newPage();

    // 1. Desktop Capture (1920x1080)
    console.log('Navigating to http://localhost:3001/ on Desktop Viewport...');
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000)); // Allow Three.js and tokens to hydrate

    const desktopPath = path.join(OUTPUT_DIR, 'desktop_view.png');
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log('✓ Desktop screenshot saved:', desktopPath);

    // 2. Click "Most Watching" tab to capture Most Watching sorted view
    console.log('Clicking "Most Watching" tab...');
    const buttons = await page.$$('button');
    for (const b of buttons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text.includes('Most Watching')) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    const mostWatchingPath = path.join(OUTPUT_DIR, 'desktop_most_watching.png');
    await page.screenshot({ path: mostWatchingPath, fullPage: false });
    console.log('✓ Desktop Most Watching screenshot saved:', mostWatchingPath);

    // 2.5 Open Token Details Modal on Desktop to verify Security & Risk Matrix
    console.log('Clicking token to open Security & Risk Matrix modal on Desktop...');
    const coinCards = await page.$$('.cursor-pointer, button[title*="Inspect"]');
    if (coinCards && coinCards.length > 0) {
      // Click first token card
      await coinCards[0].click();
      await new Promise(r => setTimeout(r, 1200));
      const modalDesktopPath = path.join(OUTPUT_DIR, 'desktop_modal_security_matrix.png');
      await page.screenshot({ path: modalDesktopPath, fullPage: false });
      console.log('✓ Desktop Modal Security Matrix screenshot saved:', modalDesktopPath);

      // Close modal
      const closeBtn = await page.$('button[title*="Close Details"]');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // 3. Mobile Viewport (390x844 — iPhone 14/15/16)
    console.log('Switching to Mobile Viewport (390x844)...');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));

    const mobilePath = path.join(OUTPUT_DIR, 'mobile_view.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log('✓ Mobile screenshot saved:', mobilePath);

    // 4. Open Mobile Filter Drawer
    console.log('Opening mobile filter drawer...');
    const mobileFilterBtn = await page.$('button.lg\\:hidden');
    if (mobileFilterBtn) {
      await mobileFilterBtn.click();
      await new Promise(r => setTimeout(r, 1200));
      const drawerPath = path.join(OUTPUT_DIR, 'mobile_drawer.png');
      await page.screenshot({ path: drawerPath, fullPage: false });
      console.log('✓ Mobile Drawer screenshot saved:', drawerPath);

      // Close drawer
      const closeBtn = await page.$('button.text-slate-300');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // 5. Open Inspection Modal on Mobile
    console.log('Opening token inspection modal on mobile...');
    const inspectBtn = await page.$('button[title*="Inspect 3D"]');
    if (inspectBtn) {
      await inspectBtn.click();
      await new Promise(r => setTimeout(r, 2000));
      const modalPath = path.join(OUTPUT_DIR, 'mobile_inspection_modal.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log('✓ Mobile Inspection Modal screenshot saved:', modalPath);
    }

    console.log('==============================================');
    console.log(' ALL MULTI-VIEWPORT SCREENSHOTS CAPTURED');
    console.log('==============================================');
  } finally {
    await browser.close();
  }
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
