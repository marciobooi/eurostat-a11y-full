const { AxeBuilder } = require('@axe-core/playwright');

/**
 * Audit the Main Toolbar / Subnavbar area.
 */
module.exports = async function testToolbar(page, allViolations) {
  console.log('\n📌 STEP 6: Assessing Main Toolbar & Toolbox...');
  
  const toolbarSelector = '#mainToolbar';
  const toolbar = page.locator(toolbarSelector);

  if (await toolbar.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('   🔎 Auditing Toolbar structure...');
    const axeResults = await new AxeBuilder({ page }).include(toolbarSelector).analyze();
    axeResults.violations.forEach(v => { v.step = 'Main Toolbar'; allViolations.push(v); });

    // 1. Verify Dimension Displays (Geo/Unit)
    const displays = ['#countryDisplay', '#unitDisplay'];
    for (const selector of displays) {
       const display = page.locator(selector);
       if (await display.isVisible()) {
          const hiddenText = await display.locator('.visually-hidden').textContent();
          const visibleText = await display.locator('.sankey-category').textContent();
          const title = await display.getAttribute('title');
          
          console.log(`      - Display [${selector}]: label="${hiddenText.trim()}", title="${title}", value="${visibleText.trim()}"`);
          
          if (!hiddenText.trim() && !title) {
             console.log(`         ⚠️ -> Display ${selector} missing accessible label.`);
          }
       }
    }

    // 2. Audit Toolbox Buttons (Menubar)
    console.log('   🔎 Auditing Sankey Toolbox Menubar...');
    const toolbox = page.locator('#sankeyToolbox');
    const role = await toolbox.getAttribute('role');
    if (role !== 'menubar') {
       allViolations.push({
         id: 'invalid-menubar-role',
         impact: 'moderate',
         description: 'Sankey toolbox container should have role="menubar".',
         help: 'Use correct ARIA roles for navigation menus.',
         step: 'Toolbox',
         nodes: [{ html: await toolbox.evaluate(el => el.outerHTML.substring(0, 100)), failureSummary: 'Incorrect role.' }]
       });
    }

    // NEW: Check for invalid children (SC 1.3.1 / 4.1.2)
    const invalidChildren = await toolbox.evaluate(el => {
      return Array.from(el.children)
        .filter(c => c.tagName === 'LI' && c.getAttribute('role') !== 'none' && c.getAttribute('role') !== 'presentation')
        .map(c => c.outerHTML.substring(0, 100));
    });
    if (invalidChildren.length > 0) {
      allViolations.push({
        id: 'menubar-invalid-children',
        impact: 'critical',
        description: 'Direct children of role="menubar" must be role="menuitem" or role="none". Found <li> with native focus or role.',
        help: 'Give <li> tags in menubars role="none" and put role="menuitem" on inner interactives.',
        step: 'Toolbox',
        nodes: invalidChildren.map(html => ({ html }))
      });
    }

    // Individual Buttons
    const toolboxBtns = await page.$$eval('#sankeyToolbox button', (btns) => {
       return btns.map(b => ({
          id: b.id,
          label: b.getAttribute('aria-label'),
          role: b.getAttribute('role'),
          html: b.outerHTML.substring(0, 120)
       }));
    });

    console.log(`      Found ${toolboxBtns.length} toolbox buttons.`);
    toolboxBtns.forEach(btn => {
       // Skip the select toggle logic here as it is covered in Step 6
       if (btn.html.includes('ecl-select__multiple-toggle')) return;

       console.log(`      - Button [${btn.id}]: label="${btn.label || '--- MISSING ---'}", role="${btn.role || 'none'}"`);
       
       if (!btn.label) {
          allViolations.push({
             id: 'toolbox-btn-no-label',
             impact: 'serious',
             description: `Toolbox button ${btn.id} is missing an aria-label.`,
             help: 'Add descriptive labels to icon-only buttons.',
             step: 'Toolbox',
             nodes: [{ html: btn.html, failureSummary: 'No aria-label detected.' }]
          });
       }

       if (btn.role !== 'menuitem') {
          allViolations.push({
             id: 'toolbox-btn-wrong-role',
             impact: 'moderate',
             description: `Toolbox item ${btn.id} should have role="menuitem".`,
             help: 'Interactive menubar children should use role="menuitem".',
             step: 'Toolbox',
             nodes: [{ html: btn.html, failureSummary: 'Missing role="menuitem".' }]
          });
       }
    });

    // 3. Focus test within toolbar
    console.log('   ⌨️  Testing Toolbox focus sequence...');
    await page.locator('#tb-unit-btn').focus().catch(() => {});
    for (let i = 0; i < 4; i++) {
        const active = await page.evaluate(() => {
           const el = document.activeElement;
           return {
              tagName: el.tagName,
              id: el.id || 'no-id',
              label: el.getAttribute('aria-label') || el.textContent.trim().substring(0, 20) || 'no-label'
           };
        });
        console.log(`      Tab ${i+1} -> [${active.tagName}] ID: ${active.id}, Label: "${active.label}"`);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
    }

  } else {
    console.log('   ⏭️ Subnavbar / Toolbar not visible.');
  }

  console.log('   ✅ Step 6 complete.');
};
