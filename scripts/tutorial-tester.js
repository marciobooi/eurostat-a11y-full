const { AxeBuilder } = require('@axe-core/playwright');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit every step of the Intro.js tutorial.
 */
async function testTutorial(page, allViolations) {
  console.log('\n📌 STEP 1: Starting Intro.js Tutorial Scan...');
  const tooltipSelector = '.introjs-tooltip';
  const tooltipElement = page.locator(tooltipSelector);

  // Wait for it to trigger
  console.log('   ⏳ Waiting up to 10s for Tutorial tooltip triggers...');
  try {
    await page.waitForSelector(tooltipSelector, { state: 'visible', timeout: 10000 });
  } catch (e) {
    console.log('   ⏭️ Intro.js tooltip not visible. Skipping audit.');
    return 0;
  }

  let step = 1;
  let isVisible = true;
  while (isVisible) {
    console.log(`   🔎 Analyzing Tutorial Step ${step}...`);
    await page.waitForTimeout(1000);

    try {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .include(tooltipSelector)
        .analyze();

        results.violations.forEach(v => {
          v.step = `Tutorial Step ${step}`;
          allViolations.push(v);
        });

        // NEW: Scan for undefined/null/NaN in tooltip content
        console.log(`      🔎 Scanning Tutorial Step ${step} for missing translations...`);
        await performScan(page, allViolations, `Tutorial Step ${step}`);
      } catch (e) {
      console.error(`      ⚠️ Axe Error on Step ${step}: ${e.message}`);
    }

    // --- Focus Trap Test ---
    for (let j = 0; j < 5; j++) {
      await page.keyboard.press('Tab');
      const isTrapped = await page.evaluate(() => {
        const active = document.activeElement;
        return !!active.closest('.introjs-tooltip') || !!active.closest('.introjs-showElement');
      });
      if (!isTrapped) {
        const html = await page.evaluate(() => document.activeElement ? document.activeElement.outerHTML.substring(0, 100) : 'body');
        allViolations.push({
          id: 'keyboard-trap-tutorial',
          impact: 'serious',
          description: 'Focus escaped the tutorial modal.',
          help: 'Trap focus in active tooltips.',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/keyboard-trap',
          step: `Tutorial Step ${step}`,
          nodes: [{ html, target: ['document.activeElement'], failureSummary: 'Focus hit background element.' }]
        });
        break;
      }
    }

    // --- Navigation ---
    const next = page.locator('.introjs-nextbutton, .introjs-donebutton').first();
    if (await next.isVisible()) {
      const cls = (await next.getAttribute('class')) || '';
      if (cls.includes('introjs-disabled') || cls.includes('introjs-donebutton')) {
        isVisible = false;
        console.log('   🏁 Tutorial finished.');
      } else {
        await next.click({ force: true });
        step++;
        await page.waitForTimeout(1000);
      }
    } else {
      isVisible = false;
    }
    isVisible = isVisible && await page.locator(tooltipSelector).isVisible();
  }
  console.log(`   ✅ Step 1 complete. ${step} steps tested.`);
  return step;
}

/**
 * Quickly dismisses the tutorial if present, without auditing it.
 */
async function dismissTutorial(page) {
  console.log('\n📌 Bypassing Tutorial (Dismissing UI)...');
  const skipBtn = page.locator('.introjs-skipbutton, .introjs-donebutton').first();
  try {
    if (await skipBtn.isVisible({ timeout: 5000 })) {
      console.log('   🛑 Tutorial found. Dismissing it to prepare for Navbar audit...');
      await skipBtn.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('   ✅ Tutorial cleared.');
    } else {
      console.log('   ⏭️ No active tutorial tooltip.');
    }
  } catch (e) {
    console.log('   ⏭️ Tutorial not present.');
  }
}

module.exports = { testTutorial, dismissTutorial };
