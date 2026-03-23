const { AxeBuilder } = require('@axe-core/playwright');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit Floating Controls: Zoom controls and Legend Box.
 */
module.exports = async function testFloatingControls(page, allViolations, runLegend = true) {
  console.log('\n📌 STEP 4: Assessing Floating Controls (Zoom & Legend)...');
  
  // --- 1. Zoom Controls Audit ---
  const zoomSelector = '#zoomControls';
  const zoom = page.locator(zoomSelector);
  
  if (await zoom.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   🔎 Auditing Zoom Controls...');
    const axeZoom = await new AxeBuilder({ page }).include(zoomSelector).analyze();
    axeZoom.violations.forEach(v => { v.step = 'Zoom Controls'; allViolations.push(v); });

    // Verify Zoom Buttons
    const buttons = await page.$$eval(`${zoomSelector} .btn-zoom`, (btns) => {
      return btns.map(b => ({
         id: b.id,
         label: b.getAttribute('aria-label'),
         rel: b.getAttribute('rel'),
         html: b.outerHTML.substring(0, 100)
      }));
    });

    buttons.forEach(btn => {
      console.log(`      - Zoom Button [${btn.id}] (${btn.rel}): label="${btn.label || 'MISSING'}"`);
      if (!btn.label) {
        allViolations.push({
          id: 'zoom-button-no-label',
          impact: 'serious',
          description: `Zoom button (${btn.id}) is missing an aria-label.`,
          help: 'Buttons must have an accessible name.',
          step: 'Zoom Controls',
          nodes: [{ html: btn.html, target: [`#${btn.id}`], failureSummary: 'No aria-label detected.' }]
        });
      }
    });

    // Drag handle check
    const drag = page.locator('.zoom-drag-handle-top');
    if (await drag.isVisible()) {
      const label = await drag.getAttribute('aria-label');
      console.log(`      - Zoom Drag Handle: label="${label || 'MISSING'}"`);
      if (!label) {
        allViolations.push({ id: 'zoom-drag-no-label', impact: 'serious', description: 'Zoom drag handle missing label.', help: 'Add aria-label', step: 'Zoom Controls', nodes: [{ html: await drag.evaluate(el => el.outerHTML), failureSummary: 'Missing label.' }] });
      }
    }
  } else {
    console.log('   ⏭️ Zoom controls not visible.');
  }

  // --- 2. Legend Box Audit ---
  if (!runLegend) {
    console.log('   ⏭️  Legend Box sub-audit skipped (not selected).');
  } else {
  const legendSelector = '.jBox-container';
  const legend = page.locator(legendSelector);
  if (await legend.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   🔎 Auditing Legend Box...');
    const axeLegend = await new AxeBuilder({ page }).include(legendSelector).analyze();
    axeLegend.violations.forEach(v => { v.step = 'Legend Box'; allViolations.push(v); });

    // NEW: Scan for undefined/null/NaN in legend content
    console.log('      🔎 Scanning Legend for missing translations...');
    await performScan(page, allViolations, 'Legend Box');

    const legendList = page.locator('#graph-legend-box-content');
    if (await legendList.isVisible()) {
       const listLabel = await legendList.getAttribute('aria-label');
       console.log(`      - Legend List aria-label: "${listLabel || '--- MISSING ---'}"`);
       
       if (!listLabel) {
         allViolations.push({
            id: 'legend-list-no-label',
            impact: 'serious',
            description: 'Legend list container is missing an aria-label.',
            help: 'Lists should have a label if they act as a navigation/control panel.',
            step: 'Legend Box',
            nodes: [{ html: await legendList.evaluate(el => el.outerHTML.substring(0, 200)), failureSummary: 'No aria-label found on legend list.' }]
         });
       }
    }

    // Verify Legend Items (buttons)
    const items = await page.$$eval('.button-legend a[role="button"]', (links) => {
       return links.map(l => ({
          id: l.id,
          text: l.textContent.trim(),
          role: l.getAttribute('role'),
          html: l.outerHTML.substring(0, 150)
       }));
    });

    console.log(`      Found ${items.length} legend buttons.`);
    items.forEach(it => {
       console.log(`      - [${it.id}] "${it.text}"`);
       // Check if text is present
       if (!it.text) {
          allViolations.push({
            id: 'legend-item-empty',
            impact: 'serious',
            description: `Legend item ${it.id} has no visible text.`,
            help: 'Legend items must be identifiable by text.',
            step: 'Legend Box',
            nodes: [{ html: it.html, failureSummary: 'Empty label on legend button.' }]
          });
       }
    });

  } else if (runLegend) {
    console.log('   ⏭️ Legend box not visible.');
  }
  } // end legend block

  console.log('   ✅ Step 4 complete.');
};
