const { AxeBuilder } = require('@axe-core/playwright');
const auditChart = require('./chart-tester');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit Sankey Nodes and their detail Modals.
 */
module.exports = async function testNodeModal(page, allViolations, runChart = true) {
  console.log('\n📌 STEP 7: Assessing Sankey Nodes & Detail Modals...');
  
  // 1. Find a focusable node path
  // Using IDs like #node_N2 as suggested by the user
  const nodeSelector = 'path[id^="node_N"], g.node path';
  const node = page.locator(nodeSelector).first();

  if (await node.count() > 0) {
    console.log(`   🔎 Auditing Sankey Node accessibility (Target: ${await node.getAttribute('id')})...`);
    
    const nodeData = await node.evaluate(el => {
       const label = el.getAttribute('aria-label') || el.id;
       return {
         id: el.id,
         label: label,
         tabIndex: el.tabIndex || 0
       };
    });

    console.log(`      - Target Node [${nodeData.id}]: label="${nodeData.label}"`);
    
    // 2. Click to open modal
    console.log('   🖱️  Opening Node Detail Modal...');
    
    // Ensure the node is in view
    await node.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    // Try a direct click followed by the coordinate fallback if needed
    try {
      await node.click({ force: true, timeout: 5000 });
    } catch (e) {
      console.log('      🔄 Direct click failed. Trying coordinate-based mouse click...');
      const box = await node.boundingBox();
      if (box) {
         await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    }

    const modal = page.locator('.modal-content').first();
    try {
      await modal.waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
       console.log('      🔄 Modal still not visible. Trying final JS click on the path element...');
       await node.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
       try {
          await modal.waitFor({ state: 'visible', timeout: 5000 });
       } catch (err) {
          console.log('      ❌ Error: Node Modal failed to open after multiple attempts.');
          allViolations.push({
            id: 'node-modal-trigger-failed',
            severity: 'serious',
            description: `Modal failed to trigger for node ${await node.getAttribute('id')}`,
            step: 'Node Modal'
          });
          return;
       }
    }

    if (await modal.isVisible()) {
      console.log('   ✅ Modal visible. Auditing content...');

      // NEW: ARIA Dialog Pattern Check
      const dialogAttrs = await modal.evaluate(el => ({
        role: el.getAttribute('role'),
        ariaModal: el.getAttribute('aria-modal'),
        ariaLabelledBy: el.getAttribute('aria-labelledby')
      }));
      console.log(`      - ARIA Dialog: role="${dialogAttrs.role}", aria-modal="${dialogAttrs.ariaModal}"`);
      if (dialogAttrs.ariaModal !== 'true') {
        allViolations.push({ id: 'modal-missing-aria-modal', impact: 'serious', description: 'Modal missing aria-modal="true". Screen readers may leak focus to background.', step: 'Node Modal' });
      }
      if (!['dialog', 'alertdialog'].includes(dialogAttrs.role)) {
        allViolations.push({ id: 'modal-invalid-role', impact: 'serious', description: 'Modal element should have role="dialog" or "alertdialog".', step: 'Node Modal' });
      }

      // Axe Scan Modal
      const axeResults = await new AxeBuilder({ page }).include('.modal-content').analyze();
      axeResults.violations.forEach(v => { v.step = 'Node Modal'; allViolations.push(v); });

      // NEW: Scan for undefined/null/NaN while modal is open
      console.log('      🔎 Scanning Node Modal for missing translations...');
      await performScan(page, allViolations, 'Node Modal');

      // Verify Modal Title
      const title = await modal.locator('.modal-title').textContent();
      console.log(`      - Modal Title: "${title ? title.trim() : 'MISSING'}"`);

      // Verify Image Alt text
      const img = modal.locator('img.card-img-top');
      if (await img.isVisible()) {
         const alt = await img.getAttribute('alt');
         console.log(`      - Modal Image Alt: "${alt || 'MISSING'}"`);
         if (!alt && alt !== '') {
            allViolations.push({ id: 'modal-img-no-alt', impact: 'serious', description: 'Node modal image missing alt attribute.', help: 'Add descriptive alt or empty string for decorative.', step: 'Node Modal', nodes: [{ html: await img.evaluate(el => el.outerHTML) }] });
         }
      }

      // 3. Verify Tab List
      console.log('   🔎 Auditing Tab List accessibility...');
      const tabList = modal.locator('[role="tablist"]');
      const tabs = await page.$$eval('.modal-content [role="tab"]', (ts) => {
         return ts.map(t => ({
            id: t.id,
            text: t.textContent.trim(),
            selected: t.getAttribute('aria-selected') === 'true',
            controls: t.getAttribute('aria-controls')
         }));
      });

      console.log(`      Found ${tabs.length} tabs.`);
      tabs.forEach(t => {
         console.log(`      - Tab [${t.id}]: label="${t.text}", active=${t.selected}`);
      });

      // 4. Keyboard Navigation - Focus Trap Check
      console.log('   ⌨️  Verifying Modal Focus Trap...');
      await modal.locator('.btn-close').focus();
      
      let focusEscaped = false;
      for (let i = 0; i < 10; i++) {
         await page.keyboard.press('Tab');
         const trapped = await page.evaluate(() => {
            return !!document.activeElement.closest('.modal-content');
         });
         if (!trapped) {
            focusEscaped = true;
            break;
         }
      }
      if (focusEscaped) {
         console.log('      ⚠️ -> FAILED: Focus drifted out of the modal!');
         allViolations.push({ id: 'modal-focus-trap-failed', impact: 'critical', description: 'Focus escaped Node Modal.', help: 'Use a focus trap to keep keyboard users inside active modals.', step: 'Node Modal' });
      } else {
         console.log('      ✅ Modal Focus Trap OK!');
      }

      // 5. Audit Right Column Options & Navigate to Chart
      const options = await page.$$eval('#optionsBtnSection .nav-link', (links) => {
         return links.map(l => ({
            id: l.id,
            text: l.textContent.trim().replace(/\s+/g, ' '),
            visible: window.getComputedStyle(l).display !== 'none'
         }));
      });
      console.log(`      Found ${options.filter(o => o.visible).length} active action buttons.`);

      // Open the Time Chart specifically
      const timeChartBtn = page.locator('#time-chart');
      if (runChart && await timeChartBtn.isVisible()) {
         console.log('   🖱️  Opening Time Graph Visualization...');
         await timeChartBtn.click({ force: true });

         // Some apps close the node modal when opening the chart
         await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

         // Use #chartControls bar as reliable signal the chart view is active
         const chartControls = page.locator('#chartControls');
         try {
            await chartControls.waitFor({ state: 'visible', timeout: 8000 });
            console.log('   ✅ Chart view appeared. Auditing accessibility...');

            // Call specialized Chart Auditor
            await auditChart(page, allViolations);

            // Close using the exact button ID provided by the user
            const closeChart = page.locator('#btnCloseModalChart');
            if (await closeChart.isVisible()) {
               console.log('   ⌨️  Clicking #btnCloseModalChart to return to Sankey...');
               await closeChart.click({ force: true }).catch(() => {});
               await page.waitForTimeout(300);
               // JS fallback if chart controls still showing
               if (await chartControls.isVisible().catch(() => false)) {
                  await closeChart.evaluate(el => el.click()).catch(() => {});
               }
               // Wait for controls bar to disappear = chart fully closed
               await chartControls.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
                  console.log('      ⚠️ Chart controls still visible after close.');
               });
            } else {
               console.log('      ⚠️ #btnCloseModalChart not found.');
            }
            console.log('   ✅ Chart closed. Returned to Sankey.');
         } catch (e) {
            console.log('      ⚠️ Chart view did not appear or timed out.');
         }
      }


      // 6. Ensure all modals are closed to return to main view
      const visibleModals = page.locator('.modal.show, .modal-content:visible, .modal-backdrop');
      if (await visibleModals.count() > 0) {
         console.log('   ⌨️  Cleaning up remaining modals and backdrops...');
         const anyClose = page.locator('.modal.show .btn-close, .modal.show .modalCloseBtn, #btnCloseModalChart').first();
         if (await anyClose.isVisible()) {
            await anyClose.click({ force: true }).catch(() => {});
            await anyClose.evaluate(el => el.click()).catch(() => {});
         }
         
         // Force hide remaining backdrops via JS if they persist
         await page.evaluate(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
         });
      }
      
      // Final confirmation that we can see the Sankey again
      await page.locator('.node, .link, #subnavbar-container').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      
      // NEW: Focus Return Check
      const currentFocus = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
      console.log(`   🔎 Focus Return Check: Current focus is on [${currentFocus}]`);
      // We expect it to be back on the node or a parent container, not just 'BODY'
      if (currentFocus === 'BODY') {
        allViolations.push({ id: 'modal-focus-return-failed', impact: 'moderate', description: 'Focus did not return to the trigger element after closing the modal.', step: 'Node Modal' });
      }
      
      console.log('   ✅ Main view interaction restored.');

    } else {
      console.log('   ⚠️ Node modal failed to open, skipping audit.');
    }
  } else {
    console.log('   ⏭️ No Sankey nodes found to test modal.');
  }

  console.log('   ✅ Step 7 complete.');
};
