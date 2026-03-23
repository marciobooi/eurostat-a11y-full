const { AxeBuilder } = require('@axe-core/playwright');

/**
 * Audit Adaptive Modes (Forced Colors, Reduced Motion, Text Spacing)
 * and WCAG 2.2 specific rules (Target Size).
 */
async function emulateAdaptiveModes(page, allViolations, options = {}) {
  const { forcedColors, reducedMotion, textSpacing, targetSize } = options;

  // 1. Forced Colors (Windows High Contrast)
  if (forcedColors) {
    console.log('\n📌 STEP 10: Emulating Forced Colors (High Contrast Mode)...');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForTimeout(500);
    
    // Check for visibility of key UI elements that might disappear in HC mode
    const hcResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('svg, #eurostatLogo, .btn-zoom, .nav-link')
      .analyze();
    
    hcResults.violations.forEach(v => {
      v.step = 'High Contrast Emulation';
      allViolations.push(v);
    });
    
    // Check if SVG fills were lost (common bug in HC)
    const svgFillsPreserved = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return true;
      const styles = window.getComputedStyle(svg);
      return styles.forcedColorAdjust !== 'none'; // If adjusted by browser, good, but depends on design
    });
    
    if (!svgFillsPreserved) {
       console.log('      ⚠️ Warning: SVG elements might lack contrast in Forced Colors mode.');
    }
    
    // Reset
    await page.emulateMedia({ forcedColors: 'none' });
  }

  // 2. Reduced Motion
  if (reducedMotion) {
    console.log('\n📌 STEP 11: Emulating Reduced Motion preference...');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Basic check: Are transitions still happening?
    const hasTransitions = await page.evaluate(() => {
      const el = document.body;
      const style = window.getComputedStyle(el);
      return style.transitionDuration !== '0s' || style.animationDuration !== '0s';
    });
    
    if (hasTransitions) {
      console.log('      ⚠️ Transitions/Animations detected despite Reduced Motion preference.');
      // This is often okay if they are sub-second/functional, but good to know
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }

  // 3. Text Spacing (SC 1.4.12)
  if (textSpacing) {
    console.log('\n📌 STEP 12: Testing Text Spacing (SC 1.4.12)...');
    
    // WCAG spacing values
    const spacingCss = `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p {
        margin-bottom: 2em !important;
      }
    `;
    
    await page.addStyleTag({ content: spacingCss });
    await page.waitForTimeout(500);
    
    // Audit for clipping/overflow
    const clippingIssues = await page.evaluate(() => {
      const issues = [];
      document.querySelectorAll('button, a, .nav-link, span').forEach(el => {
        if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
          const style = window.getComputedStyle(el);
          if (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') {
            issues.push({
              tag: el.tagName,
              id: el.id,
              text: el.innerText.substring(0, 20),
              html: el.outerHTML.substring(0, 100)
            });
          }
        }
      });
      return issues;
    });
    
    clippingIssues.slice(0, 5).forEach(issue => {
      allViolations.push({
        id: 'text-spacing-clipping',
        impact: 'serious',
        description: `Text spacing override caused potential clipping in element <${issue.tag}> #${issue.id}`,
        help: 'Ensure containers can expand or overflow to accommodate standard a11y text spacing.',
        step: 'Text Spacing (1.4.12)',
        nodes: [{ html: issue.html, failureSummary: `Overflow detected: "${issue.text}"` }]
      });
    });
    
    // Try to remove styling (best effort)
    await page.evaluate(() => {
      const styles = document.querySelectorAll('style');
      styles.forEach(s => { if (s.innerHTML.includes('line-height: 1.5')) s.remove(); });
    });
  }

  // 4. Target Size (WCAG 2.2 - 2.5.8)
  if (targetSize) {
    console.log('\n📌 STEP 13: Auditing Target Size (WCAG 2.2 - 2.5.8)...');
    const targetResults = await new AxeBuilder({ page })
      .withRules(['target-size']) // specifically enable target-size rule
      .analyze();
    
    targetResults.violations.forEach(v => {
      v.step = 'WCAG 2.2 Target Size';
      allViolations.push(v);
    });
    
    if (targetResults.violations.length === 0) {
      console.log('      ✅ All tested targets meet the 24px Minimum.');
    }
  }
}

module.exports = { emulateAdaptiveModes };
