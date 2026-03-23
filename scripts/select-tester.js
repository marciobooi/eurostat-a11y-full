const { AxeBuilder } = require('@axe-core/playwright');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit the ECL Multiple Select Component.
 */
module.exports = async function testSelect(page, allViolations, runDropdown = true) {
  console.log('\n📌 STEP 5: Assessing ECL Multiple Select Component...');
  
  const selectToggleSelector = '.ecl-select__multiple-toggle';
  const toggle = page.locator(selectToggleSelector);

  if (await toggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   🔎 Auditing Select Toggle...');
    const axeToggle = await new AxeBuilder({ page }).include('.ecl-select__multiple').analyze();
    axeToggle.violations.forEach(v => { v.step = 'Select Toggle'; allViolations.push(v); });

    const ariaLabel = await toggle.getAttribute('aria-label');
    console.log(`      - Select Toggle: aria-label="${ariaLabel || 'MISSING'}"`);
    if (!ariaLabel) {
       allViolations.push({
         id: 'select-missing-label',
         impact: 'serious',
         description: 'Select toggle input is missing an aria-label.',
         help: 'Input elements must have an accessible name.',
         step: 'Select Component',
         nodes: [{ html: await toggle.evaluate(el => el.outerHTML), failureSummary: 'No aria-label detected.' }]
       });
    }

    // 2. Open Dropdown
    if (!runDropdown) {
       console.log('   ⏭️ Select Dropdown sub-audit skipped (not selected).');
    } else {
       console.log('   ⌨️  Opening Select Dropdown...');
       await toggle.click({ force: true });
    
       const dropdown = page.locator('.ecl-select__multiple-dropdown');
       try {
         await dropdown.waitFor({ state: 'visible', timeout: 5000 });
         console.log('   ✅ Dropdown visible. Auditing options...');

         // Axe Scan Dropdown
         const axeDropdown = await new AxeBuilder({ page }).include('.ecl-select__multiple-dropdown').analyze();
         axeDropdown.violations.forEach(v => { v.step = 'Select Dropdown'; allViolations.push(v); });

         // NEW: Scan for undefined/null/NaN while dropdown is open
         console.log('      🔎 Scanning Select Dropdown for missing translations...');
         await performScan(page, allViolations, 'Select Dropdown');

         // Check Search Input
         const searchInput = page.locator('#select-multiple-search');
         if (await searchInput.isVisible()) {
           const placeholder = await searchInput.getAttribute('placeholder');
           const sLabel = await searchInput.getAttribute('aria-label');
           console.log(`      - Multi-Select Search: placeholder="${placeholder}", aria-label="${sLabel || 'MISSING'}"`);
           
           if (!sLabel && !placeholder) {
              allViolations.push({
                id: 'select-search-no-label',
                impact: 'serious',
                description: 'Search input inside Select dropdown is missing an accessible name.',
                help: 'Add aria-label or a visible label to the search filter.',
                step: 'Select Dropdown',
                nodes: [{ html: await searchInput.evaluate(el => el.outerHTML), failureSummary: 'No aria-label or placeholder found.' }]
              });
           }
         }

         // Check Toolbar Buttons (Clear/Submit)
         const toolbar = page.locator('.ecl-select-multiple-toolbar');
         if (await toolbar.isVisible()) {
            const clearBtn = toolbar.locator('.ecl-button--ghost');
            const submitBtn = toolbar.locator('.ecl-button--primary');
            
            const clearText = await clearBtn.textContent();
            const submitText = await submitBtn.textContent();
            
            console.log(`      - Toolbar Buttons: Clear="${clearText.trim()}", Submit="${submitText.trim()}"`);
            
            if (!clearText.trim()) {
              allViolations.push({ id: 'select-clear-no-text', impact: 'serious', description: 'Clear all button has no text/label.', help: 'Add button text', step: 'Select Dropdown', nodes: [{ html: await clearBtn.evaluate(el => el.outerHTML) }] });
            }
         }

         // Check Checkboxes (labels and IDs)
         const checkboxData = await page.$$eval('.ecl-select__multiple-options .ecl-checkbox', (cboxs) => {
            return cboxs.map(cb => {
               const input = cb.querySelector('input');
               const label = cb.querySelector('label');
               return {
                  id: input ? input.id : 'no-id',
                  labelFor: label ? label.getAttribute('for') : 'no-for',
                  text: label ? label.textContent.trim() : 'no-text'
               };
            });
         });

         console.log(`      Found ${checkboxData.length} options.`);
         checkboxData.slice(0, 5).forEach(cb => { // Just log top 5 for brevity
            if (cb.id !== cb.labelFor) {
               allViolations.push({
                  id: 'checkbox-label-mismatch',
                  impact: 'serious',
                  description: `Checkbox ${cb.text} has mismatched ID/For.`,
                  help: 'Ensure label "for" attribute matches input "id".',
                  step: 'Select Dropdown',
                  nodes: [{ html: `Input ID: ${cb.id}, Label For: ${cb.labelFor}`, failureSummary: 'ID/For mismatch.' }]
               });
            }
         });

         // Keyboard navigation check inside dropdown
         console.log('   ⌨️  Testing dropdown focus sequence...');
         await searchInput.focus();
         for (let i = 0; i < 5; i++) {
           await page.keyboard.press('Tab');
           const active = await page.evaluate(() => {
              const el = document.activeElement;
              return {
                 tagName: el.tagName,
                 id: el.id || 'no-id',
                 label: el.getAttribute('aria-label') || el.textContent.trim().substring(0, 20) || 'no-label'
              };
           });
           console.log(`      Tab ${i+1} -> [${active.tagName}] ID: ${active.id}, Label: "${active.label}"`);
         }

         // Close / Submit
         console.log('   ⌨️  Closing dropdown (Clicking Submit)...');
         const submitBtn = page.locator('.ecl-select-multiple-toolbar .ecl-button--primary');
         if (await submitBtn.isVisible()) {
            await submitBtn.click({ force: true });
         } else {
            await page.keyboard.press('Escape');
         }
         await page.waitForTimeout(500);

       } catch (e) {
         console.log('   ⚠️ Dropdown did not appear or interaction failed.');
       }
    }
  } else {
    console.log('   ⏭️ Multiple select component not detected.');
  }

  console.log('   ✅ Step 5 complete.');
};
