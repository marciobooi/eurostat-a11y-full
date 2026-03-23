/**
 * Handles initial page loading and cookie banner (CCK) dismissal.
 */
module.exports = async function handleSetup(page, BASE_URL) {
  console.log('🚀 Loading page: ' + BASE_URL);
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) {
    console.log('⚠️ Warning: Page load might have timed out, but proceeding.');
  }

  console.log('🧐 Checking for Cookie Banner (CCK)...');
  const banner = page.locator('.wt-cck--container');
  try {
    if (await banner.isVisible({ timeout: 5000 })) {
      console.log('   🍪 Banner found. Clicking "Accept all cookies"...');
      // Try multiple ways to click it
      const acceptBtn = page.locator('a[href="#accept"], .wt-cck--actions-button').first();
      await acceptBtn.click({ force: true });
      await page.waitForTimeout(1000);
      
      if (await banner.isVisible()) {
        console.log('   🛠️ Banner still there, forcing click via JS...');
        await page.evaluate(() => {
          const b = document.querySelector('a[href="#accept"], .wt-cck--actions-button');
          if (b) b.click();
        });
        await page.waitForTimeout(1000);
      }
      console.log('   ✅ Banner check complete.');
    } else {
      console.log('   ⏭️ No cookie banner detected.');
    }
  } catch (e) {
     console.log('   ⏭️ Cookie banner skip.');
  }
};
