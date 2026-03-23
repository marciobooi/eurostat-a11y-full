/**
 * Audit Global Page Structure (H1 Headings and Landmarks)
 * Matches standard Axe requirements for basic SEO/A11y health.
 */
async function testGlobalStructure(page, allViolations) {
  console.log('\n📌 STEP 14: Assessing Global Page structure (Headings & Landmarks)...');

  // 1. Level-One Heading Check (SC 1.3.1 / Best Practice)
  const h1Elements = await page.locator('h1');
  const h1Count = await h1Elements.count();
  
  // Also check iframes for H1
  let h1InIframes = 0;
  const frames = page.frames();
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;
    const count = await frame.locator('h1').count().catch(() => 0);
    h1InIframes += count;
  }

  const totalH1 = h1Count + h1InIframes;
  console.log(`      - H1 Heading Count: ${totalH1} (Main: ${h1Count}, Iframes: ${h1InIframes})`);

  if (totalH1 === 0) {
    allViolations.push({
      id: 'page-no-h1',
      impact: 'moderate',
      description: 'The page must have at least one level-one heading (<h1>).',
      help: 'Add an <h1> describing the context (e.g., Sankey Diagram Visualizer).',
      step: 'Global Structure',
      nodes: [{ html: await page.evaluate(() => document.documentElement.outerHTML.substring(0, 500) + '...'), failureSummary: 'No level-one heading was found in the main document or any frames.' }]
    });
  } else if (totalH1 > 1) {
    allViolations.push({ id: 'page-multiple-h1', impact: 'minor', description: 'Page has more than one <h1>.', step: 'Global Structure' });
  }

  // 2. Landmarks Check (WAI-ARIA)
  const landmarkInfo = await page.evaluate(() => {
    const roles = ['main', 'nav', 'header', 'footer', 'aside', 'search', 'form'];
    const found = [];
    roles.forEach(role => {
      const nodes = Array.from(document.querySelectorAll(`[role="${role}"], ${role === 'header' ? 'header:not(main header)' : role === 'footer' ? 'footer:not(main footer)' : role}`));
      if (nodes.length > 0) {
        found.push({ role, count: nodes.length, missingLabels: nodes.length > 1 && nodes.some(n => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')) });
      }
    });
    return found;
  });

  const landmarkRoles = landmarkInfo.map(l => l.role);
  console.log(`      - Landmarks detected: ${landmarkRoles.join(', ') || 'NONE'}`);
  
  if (!landmarkRoles.includes('main')) {
    allViolations.push({
      id: 'page-no-main-landmark',
      impact: 'serious',
      description: 'The page is missing a <main> landmark.',
      help: 'Wrap the primary content in a <main> tag or role="main".',
      step: 'Global Structure'
    });
  }

  landmarkInfo.forEach(l => {
    if (l.missingLabels) {
      allViolations.push({
        id: 'landmark-no-label',
        impact: 'moderate',
        description: `Multiple landmarks of type <${l.role}> found without unique labels.`,
        help: 'Use aria-label or aria-labelledby to distinguish between multiple landmarks of the same type.',
        step: 'Global Structure'
      });
    }
  });

  // 3. Content Outside Landmarks detection
  const outsideLandmarks = await page.evaluate(() => {
    // Basic heuristic: check if significant text/buttons are outside main landmarks
    const main = document.querySelector('main, [role="main"]');
    if (!main) return true;
    const items = Array.from(document.querySelectorAll('button, a, select, input'));
    return items.some(el => !el.closest('main, nav, header, footer, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]'));
  });

  if (outsideLandmarks) {
    allViolations.push({
      id: 'content-outside-landmarks',
      impact: 'moderate',
      description: 'Some interactive content exists outside of landmark regions.',
      help: 'Ensure all content is reachable via landmark navigation.',
      step: 'Global Structure'
    });
  }
}

module.exports = testGlobalStructure;
