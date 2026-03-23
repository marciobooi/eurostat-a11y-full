const path = require('path');

/**
 * Opens the visual test selector page in Playwright and waits
 * for the user to click "Start Audit". Returns the selected test IDs.
 */
module.exports = async function showTestSelector(page) {
  const selectorPath = path.resolve(__dirname, '../test-selector.html');
  const fileUrl = `file:///${selectorPath.replace(/\\/g, '/')}`;

  console.log('\n🎛️  Opening Test Selector UI...');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  console.log('⏳ Waiting for test selection (click "Start Audit" in the browser)...');

  let selectedTests;
  try {
    await page.waitForFunction(
      () => Array.isArray(window.__a11ySelectedTests),
      { timeout: 5 * 60 * 1000 } // 5 minutes max
    );
    selectedTests = await page.evaluate(() => window.__a11ySelectedTests);
  } catch (e) {
    console.log('\n⚠️  Test selector closed or timed out. Exiting audit runner.');
    process.exit(0);
  }

  console.log(`\n✅ Tests selected: ${selectedTests.join(', ')}`);
  return selectedTests;
};
