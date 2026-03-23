/**
 * Global Tabbing Audit: Focuses everything on the page sequentially.
 */
module.exports = async function testGlobalTabbing(page, allViolations) {
  console.log('\n📌 STEP 5: Conducting Global Focus Sweep (All Interactive Elements)...');
  
  // Start from the top
  await page.keyboard.press('Home');
  await page.waitForTimeout(500);

  // Focus the first element (often a skip link or logo)
  await page.keyboard.press('Tab');
  
  const MAX_TABS = 100; // Large number to cover a complex dashboard
  const visited = new Set();
  
  console.log('      - Iterating through page focus order:');
  
  for (let i = 0; i < MAX_TABS; i++) {
    const focusData = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      
      const label = el.getAttribute('aria-label') || 
                    el.alt || 
                    (el.querySelector('img') ? el.querySelector('img').alt : null) || 
                    el.title ||
                    el.innerText.trim().substring(0, 30);

      return {
        tagName: el.tagName,
        id: el.id || 'no-id',
        label: label ? label.trim() : '--- NO ACCESSIBLE NAME ---',
        html: el.outerHTML.substring(0, 150),
        rect: el.getBoundingClientRect().top
      };
    });

    if (!focusData) break;
    
    // Create a unique key to detect loops (id + html snippet)
    const key = `${focusData.id}-${focusData.html}`;
    if (visited.has(key)) {
       console.log('      🏁 Focus sequence returned to a previously visited element. Ending sweep.');
       break;
    }
    visited.add(key);

    console.log(`      Tab ${i+1} -> [${focusData.tagName}] ID: ${focusData.id}, Label: "${focusData.label}"`);

    if (focusData.label === '--- NO ACCESSIBLE NAME ---' || focusData.label === '') {
       console.log(`         ⚠️ -> DETECTED: focusable [${focusData.tagName}] has no name!`);
       allViolations.push({
         id: 'element-missing-label',
         impact: 'serious',
         description: `Interactive [${focusData.tagName}] element is missing an accessible name.`,
         help: 'All focusable elements must have a label for assistive technologies.',
         helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/link-name',
         step: 'Global Tab Sweep',
         nodes: [{ 
            html: focusData.html, 
            target: [`#${focusData.id}`], 
            failureSummary: 'No aria-label, alt, title, or text detected during tab interaction.' 
         }]
       });
    }

    await page.keyboard.press('Tab');
    await page.waitForTimeout(100); // Small delay to let focus settle
  }
  
  console.log(`   ✅ Global sweep complete. ${visited.size} focusable elements verified.`);
};
