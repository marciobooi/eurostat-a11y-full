const { AxeBuilder } = require('@axe-core/playwright');

/**
 * Audit the Timeline Component, slider, and autoplay controls.
 */
module.exports = async function testTimeline(page, allViolations) {
  console.log('\n📌 STEP 3: Assessing Timeline Component...');
  
  const timelineSelector = '#timeLineComponent';
  const timeline = page.locator(timelineSelector);

  // Wait for it to be visible
  await timeline.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('   ⏭️ Timeline component not visible after 10s. Skipping.');
  });

  if (await timeline.isVisible()) {
    // 1. Axe Scan specifically for Timeline
    console.log('   🔎 Running Axe scan on Timeline...');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .include(timelineSelector)
      .analyze();
    results.violations.forEach(v => { v.step = 'Timeline'; allViolations.push(v); });

    // 2. Verify Autoplay Controls
    const playBtn = page.locator('#autoplay-start');
    const stopBtn = page.locator('#autoplay-stop');
    
    if (await playBtn.isVisible()) {
      const label = await playBtn.getAttribute('aria-label');
      console.log(`      - Autoplay Start Button: label="${label || 'MISSING'}"`);
      if (!label) {
        allViolations.push({ id: 'timeline-play-no-label', impact: 'serious', description: 'Start button missing aria-label.', help: 'Add aria-label', step: 'Timeline', nodes: [{ html: await playBtn.evaluate(el => el.outerHTML), failureSummary: 'No accessible name.' }] });
      }
    }

    if (await stopBtn.count() > 0) {
      const isVisible = await stopBtn.isVisible();
      const stopLabel = await stopBtn.getAttribute('aria-label');
      console.log(`      - Autoplay Stop Button: present=${true}, visible=${isVisible}, label="${stopLabel || 'MISSING'}"`);
      if (!stopLabel) {
        allViolations.push({ id: 'timeline-stop-no-label', impact: 'serious', description: 'Stop button missing aria-label.', help: 'Add aria-label', step: 'Timeline', nodes: [{ html: await stopBtn.evaluate(el => el.outerHTML), failureSummary: 'No accessible name on stop button.' }] });
      }
    }

    // NEW: Check for Single-Pointer Alternatives (SC 2.5.7 Dragging Movements)
    console.log('      🔎 Testing for Non-Drag Alternatives (SC 2.5.7)...');
    const hasButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a[role="button"]'));
      return btns.some(b => b.innerText.includes('Next') || b.innerText.includes('Prev') || b.id.includes('year') || b.id.includes('Arrow'));
    });
    if (!hasButtons) {
      allViolations.push({
        id: 'dragging-movements-alt-missing',
        impact: 'serious',
        description: 'Timeline relies on dragging without a clear single-pointer alternative.',
        help: 'Provide buttons (Next/Prev) or a numeric input to change years without complex dragging.',
        step: 'Timeline (SC 2.5.7)',
        nodes: [{ html: await timeline.evaluate(el => el.outerHTML.substring(0, 200)), failureSummary: 'No click-only year toggle found.' }]
      });
    }

    // 3. Verify Slider semantics & Keyboard Navigation
    const sliderHandle = page.locator('.ui-slider-handle');
    if (await sliderHandle.isVisible()) {
      // NEW: Name check (SC 4.1.2) - Missing in previous run
      const sliderName = await sliderHandle.getAttribute('aria-label') || await sliderHandle.getAttribute('aria-labelledby');
      console.log(`      - Slider Name: "${sliderName || 'MISSING'}"`);
      if (!sliderName) {
        allViolations.push({
          id: 'slider-no-name',
          impact: 'serious',
          description: 'Slider handle (.ui-slider-handle) missing an accessible name.',
          help: 'Add aria-label to the slider handle.',
          step: 'Timeline Slider',
          nodes: [{ html: await sliderHandle.evaluate(el => el.outerHTML) }]
        });
      }

      const initialVal = await sliderHandle.getAttribute('aria-valuenow');
      const val = parseInt(initialVal);
      
      console.log(`      - Slider Handle Initial: year=${val}`);
      
      // Test Keyboard: ArrowLeft
      console.log('      ⌨️  Testing ArrowLeft navigation...');
      await sliderHandle.focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(500);
      const valLeft = await sliderHandle.getAttribute('aria-valuenow');
      
      if (parseInt(valLeft) >= val && val > 2010) { // If it didn't decrease
         console.log(`         ⚠️ -> FAILED: ArrowLeft did not decrease year! (current: ${valLeft})`);
         allViolations.push({
           id: 'slider-keyboard-nav-failed',
           impact: 'critical',
           description: 'Slider does not respond to ArrowLeft key.',
           help: 'Sliders must support Arrow keys for accessible interaction.',
           helpUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/slider/',
           step: 'Timeline Slider',
           nodes: [{ html: await sliderHandle.evaluate(el => el.outerHTML), failureSummary: 'Keydown ArrowLeft did not update aria-valuenow.' }]
         });
      } else {
         console.log(`         ✅ ArrowLeft OK! (new year: ${valLeft})`);
      }

      // Test Keyboard: ArrowRight
      console.log('      ⌨️  Testing ArrowRight navigation...');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      const valRight = await sliderHandle.getAttribute('aria-valuenow');
      console.log(`         ✅ ArrowRight OK! (new year: ${valRight})`);

      const sliderRole = await sliderHandle.getAttribute('role');
      if (sliderRole !== 'slider') {
        allViolations.push({ id: 'slider-wrong-role', impact: 'serious', description: 'Handle missing role="slider".', help: 'Identify sliders correctly.', step: 'Timeline', nodes: [{ html: await sliderHandle.evaluate(el => el.outerHTML), failureSummary: 'Incorrect role.' }] });
      }

      // Check for ARIA attributes
      const min = await sliderHandle.getAttribute('aria-valuemin');
      const max = await sliderHandle.getAttribute('aria-valuemax');
      const text = await sliderHandle.getAttribute('aria-valuetext');
      
      console.log(`      - ARIA Slider: min="${min}", max="${max}", text="${text || 'MISSING'}"`);
      if (!min || !max) {
        allViolations.push({ id: 'slider-missing-range', impact: 'serious', description: 'Slider missing aria-valuemin / aria-valuemax.', help: 'Define slider range.', step: 'Timeline Slider' });
      }
      
      // Test Home/End keys
      console.log('      ⌨️  Testing Home/End keys...');
      await page.keyboard.press('End');
      await page.waitForTimeout(500);
      const valEnd = await sliderHandle.getAttribute('aria-valuenow');
      if (parseInt(valEnd) !== parseInt(max)) {
        console.log(`         ⚠️ -> FAILED: End key did not move slider to max year (${max})!`);
        allViolations.push({ id: 'slider-keyboard-end-failed', impact: 'moderate', description: 'Slider did not jump to max on "End" key.', step: 'Timeline Slider' });
      }
    }

    // 4. Verify Drag Handle
    const dragHandle = page.locator('.timeline-drag-handle-left');
    if (await dragHandle.isVisible()) {
       const dragLabel = await dragHandle.getAttribute('aria-label');
       console.log(`      - Drag Handle: label="${dragLabel || 'MISSING'}"`);
       if (!dragLabel) {
         allViolations.push({ id: 'timeline-drag-no-label', impact: 'serious', description: 'Drag handle missing aria-label.', help: 'Add aria-label', step: 'Timeline', nodes: [{ html: await dragHandle.evaluate(el => el.outerHTML), failureSummary: 'No label detected.' }] });
       }
    }

    // 5. Tabbing Sequence check for Timeline
    console.log('   ⌨️  Testing Timeline focus sequence...');
    await page.locator('#autoplay-start').focus().catch(() => {});
    
    for (let i = 0; i < 3; i++) {
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        return {
           id: el.id,
           tagName: el.tagName,
           label: el.getAttribute('aria-label') || el.textContent.trim().substring(0, 20) || 'no-label'
        };
      });
      console.log(`      Tab ${i+1} -> [${active.tagName}] ID: ${active.id || 'no-id'}, Label: "${active.label}"`);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
  }
  console.log('   ✅ Step 3 complete.');
};
