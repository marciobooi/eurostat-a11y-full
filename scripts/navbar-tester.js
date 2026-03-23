const { AxeBuilder } = require('@axe-core/playwright');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit the Navbar, logo, and language modal.
 */
module.exports = async function testNavbar(page, allViolations, runLanguageModal = true) {
  console.log('\n📌 STEP 2: Assessing Navbar & Language Toggle...');
  
  const navSelector = '#navbar-container';
  const nav = page.locator(navSelector);
  
  // Wait for it because some sites load it after cookies/tutorial
  await nav.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    console.log('   ⏭️ Navbar container not visible after 10s. Skipping audit.');
  });

  if (await nav.isVisible()) {
    // 1. General Navbar Scan
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .include(navSelector)
      .analyze();
    results.violations.forEach(v => { v.step = 'Navbar'; allViolations.push(v); });

    // 2. Logo Check
    const logo = page.locator('#eurostatLogo');
    if (await logo.isVisible()) {
      const alt = await logo.getAttribute('alt');
      console.log(`      - Logo Alt Text: "${alt || 'MISSING'}"`);
      if (!alt) {
        allViolations.push({ id: 'image-missing-alt', impact: 'critical', description: 'Logo missing alt text', help: 'Images must have alt text', step: 'Navbar', nodes: [{ html: await logo.evaluate(el => el.outerHTML), failureSummary: 'No alt attribute found.' }] });
      }
    }

    // 3. Social Media Buttons Check
    const socialBtns = await page.$$eval('#social-media .navBtn', b => b.map(x => ({ id: x.id, label: x.getAttribute('aria-label'), html: x.outerHTML.substring(0, 150) })));
    console.log(`      Found ${socialBtns.length} social media buttons.`);
    socialBtns.forEach(b => {
      console.log(`      - Button [${b.id}]: label="${b.label || 'MISSING'}"`);
      if (!b.label) {
        allViolations.push({ id: 'btn-missing-label', impact: 'serious', description: 'Social icon button missing label', help: 'Add aria-label', step: 'Navbar', nodes: [{ html: b.html, target: [`#${b.id}`], failureSummary: 'No label found'}] });
      }
    });

    // 4. Language Modal Interaction
    const langTrigger = page.locator('#toggleLanguageBtn');
    if (!runLanguageModal) {
      console.log('   ⏭️  Language Modal sub-audit skipped (not selected).');
    } else if (await langTrigger.isVisible()) {
      console.log('   ⌨️  Testing Language Modal Accessibility & Focus...');
      
      // Ensure it's in view
      await langTrigger.scrollIntoViewIfNeeded();
      await langTrigger.click({ force: true }).catch(() => console.log('      ⚠️ Playwright click failed, trying JS...'));

      const overlay = page.locator('#language-list-overlay');
      try {
        // Wait and check if it actually appeared
        await overlay.waitFor({ state: 'visible', timeout: 5000 });
      } catch (e) {
        console.log('      🔄 Modal not visible. Trying JS click fallback...');
        await page.evaluate(() => {
          const btn = document.getElementById('toggleLanguageBtn');
          if (btn) btn.click();
        });
        try {
           await overlay.waitFor({ state: 'visible', timeout: 5000 });
        } catch (err) {
           console.log('      ❌ Error: Language Modal failed to open even with JS click. Skipping internal audit.');
           allViolations.push({
             id: 'modal-interaction-failed',
             impact: 'serious',
             description: 'Language toggle clicked but overlay did not appear.',
             help: 'Ensure toggle button correctly triggers the modal for all users.',
             step: 'Language Modal',
             nodes: [{ html: await langTrigger.evaluate(el => el.outerHTML), failureSummary: 'Modal failed to open on click.' }]
           });
        }
      }

      if (await overlay.isVisible()) {
        console.log('   ✅ Language Modal visible. Conducting Focus Trap check...');
        
        // Focus Trap Test
        await page.evaluate(() => {
          const m = document.querySelector('#language-list-overlay');
          const f = m.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
          if (f.length > 0) f[0].focus();
        });

        let focusEscapedModal = false;
        for (let j = 0; j < 5; j++) {
          await page.keyboard.press('Tab');
          const trapped = await page.evaluate(() => {
            const act = document.activeElement;
            return !!act.closest('#language-list-overlay');
          });
          if (!trapped) {
            focusEscapedModal = true;
            const nodeHtml = await page.evaluate(() => document.activeElement ? document.activeElement.outerHTML.substring(0, 100) : 'body');
            allViolations.push({
              id: 'keyboard-trap-language',
              impact: 'serious',
              description: 'Focus escaped Language Modal during trapped tab test.',
              help: 'Modal focus must be strictly trapped.',
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/keyboard-trap',
              step: 'Language Modal',
              nodes: [{ html: nodeHtml, target: ['document.activeElement'], failureSummary: 'Focus hit background element' }]
            });
            break;
          }
        }
        if (!focusEscapedModal) console.log('      ✅ Language Modal Focus Trap OK!');

        // AXE scan overlay
        const resOverlay = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
          .include('#language-list-overlay')
          .analyze();
        resOverlay.violations.forEach(v => { v.step = 'Language Overlay'; allViolations.push(v); });

        // NEW: Scan for undefined/null/NaN while modal is open
        console.log('      🔎 Scanning Language Modal for missing translations...');
        await performScan(page, allViolations, 'Language Modal');

        // ARIA Role Check for Language list items
        const langItemsData = await page.$$eval('.ecl-site-header__language-list li', (lis) => {
          return lis.map(li => ({
            id: li.id,
            role: li.getAttribute('role'),
            text: li.textContent.trim().split('\n')[0]
          }));
        });
        
        langItemsData.forEach(li => {
          if (li.role === 'button') {
            console.log(`      - Language Item [${li.id}]: "${li.text}" has role="button". Correcting context.`);
            allViolations.push({
              id: 'invalid-aria-role-li',
              impact: 'moderate',
              description: 'LI elements should not have role="button" directly inside a list.',
              help: 'Use native semantics or <button> inside <li>.',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
              step: 'Language Modal',
              nodes: [{ html: `<li id="${li.id}" role="button">${li.text}</li>`, target: [`#${li.id}`], failureSummary: 'Invalid role for list child.' }]
            });
          } else {
            console.log(`      - Language Item [${li.id}]: "${li.text}" role="${li.role || 'none'}"`);
          }
        });

        console.log('   ⌨️  Closing Language Modal...');
        await page.locator('#languageClsBtn').click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 5. Post-Modal Tabbing & "aria-hidden" Container Check
    console.log('   🔎 Verifying post-modal Navbar focus sequence...');
    
    // Check for the "aria-hidden" container issue
    const socialParent = page.locator('#social-media').locator('..'); // The div with col-2...
    const isHidden = await socialParent.getAttribute('aria-hidden');
    if (isHidden === 'true') {
       console.log('      ⚠️ -> DETECTED: Navbar container has aria-hidden="true" blocking screen readers!');
       allViolations.push({
         id: 'aria-hidden-interactive-container',
         impact: 'critical',
         description: 'Interactive container (social/logo) is aria-hidden="true".',
         help: 'Interactive elements must not be children of aria-hidden containers.',
         helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/aria-hidden-focus',
         step: 'Navbar',
         nodes: [{ html: await socialParent.evaluate(el => el.outerHTML.substring(0, 200)), failureSummary: 'aria-hidden="true" attribute is present on a container with focusable elements.' }]
       });
    }

    // Tab through social buttons and logo
    if (await langTrigger.isVisible()) await langTrigger.focus();
    console.log('      - Tabbing from Language Toggle onwards:');
    for (let k = 0; k < 6; k++) {
      await page.keyboard.press('Tab');
      const focusData = await page.evaluate(() => {
        const el = document.activeElement;
        const label = el.getAttribute('aria-label') || el.alt || (el.querySelector('img') ? el.querySelector('img').alt : null) || el.textContent.trim().substring(0, 25);
        return {
          id: el.id,
          tagName: el.tagName,
          label: label || '--- NO ACCESSIBLE NAME ---'
        };
      });
      console.log(`      Tab ${k+1} -> [${focusData.tagName}] ID: ${focusData.id || 'no-id'}, Label: "${focusData.label}"`);
      
      if (focusData.label === '--- NO ACCESSIBLE NAME ---') {
        allViolations.push({
          id: 'link-missing-label',
          impact: 'serious',
          description: `Interactive element ${focusData.id} is missing an accessible name.`,
          help: 'Links and buttons must have an accessible name for screen readers.',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
          step: 'Navbar Tabbing',
          nodes: [{ html: await page.evaluate(() => document.activeElement.outerHTML.substring(0, 200)), target: [focusData.id], failureSummary: 'No label/alt/aria-label found.' }]
        });
      }
    }
  }
  console.log('   ✅ Step 2 complete.');
};
