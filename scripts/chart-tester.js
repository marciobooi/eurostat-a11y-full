const { AxeBuilder } = require('@axe-core/playwright');
const { performScan } = require('./undefined-text-tester');

/**
 * Audit the Highcharts visualization and its controls.
 * This can be called from other test modules when a chart is active.
 */
module.exports = async function auditChart(page, allViolations) {
  console.log('   🔎 Auditing Active Chart & Controls...');

  // 1. Audit Chart Toolbar/Controls
  const controls = page.locator('#chartControls');
  if (await controls.isVisible()) {
    console.log('      - Checking Chart Controls (#chartControls)...');
    
    // Select Flow dropdown
    const select = controls.locator('#lineChartCombo');
    if (await select.isVisible()) {
       const label = await select.getAttribute('aria-label');
       console.log(`         - Select Flow: label="${label || 'MISSING'}"`);
       if (!label) {
          allViolations.push({ id: 'chart-select-no-label', impact: 'serious', description: 'Flow selection dropdown in chart is missing an aria-label.', step: 'Chart Audit', nodes: [{ html: await select.evaluate(el => el.outerHTML) }] });
       }
    }

    // Close button
    const closeBtn = controls.locator('#btnCloseModalChart');
    if (await closeBtn.isVisible()) {
       const cLabel = await closeBtn.getAttribute('aria-label');
       console.log(`         - Close Button: aria-label="${cLabel || 'MISSING'}"`);
       if (!cLabel) {
          allViolations.push({ id: 'chart-close-no-label', impact: 'serious', description: 'Chart close button missing aria-label.', step: 'Chart Audit' });
       }
    }
  }

  // 2. Audit Highcharts Container
  const chartContainer = page.locator('.highcharts-container').first();
  if (await chartContainer.isVisible()) {
    console.log('      - Checking Highcharts Accessibility Tree...');
    
    const svgRoot = chartContainer.locator('svg.highcharts-root').first();
    const svgLabel = await svgRoot.getAttribute('aria-label');
    const svgHidden = await svgRoot.getAttribute('aria-hidden');
    
    console.log(`         - SVG Root: aria-label="${svgLabel}", aria-hidden="${svgHidden}"`);

    // Verify if Highcharts A11y module is active (look for proxy containers)
    const proxy = page.locator('.highcharts-a11y-proxy-container-after');
    const proxyVisible = await proxy.isVisible();
    console.log(`         - A11y Proxy Module: ${proxyVisible ? 'DETECTED ✅' : 'NOT FOUND ⚠️'}`);
    
    if (!proxyVisible) {
       allViolations.push({
         id: 'highcharts-a11y-module-missing',
         impact: 'serious',
         description: 'Highcharts accessibility module (proxy container) not detected.',
         help: 'Ensure Highcharts accessibility module is loaded and enabled.',
         step: 'Chart Audit'
       });
    }

    // NEW: Check for Chart Description/Summary (EAA Requirement)
    const chartSummary = page.locator('.highcharts-description, .highcharts-summary').first();
    if (await chartSummary.count() > 0 && await chartSummary.isVisible().catch(() => false)) {
      const summaryText = (await chartSummary.textContent() || '').trim();
      console.log(`         - Chart Summary: "${summaryText.substring(0, 50)}..."`);
      if (summaryText.length < 10) {
        allViolations.push({ id: 'chart-summary-too-short', impact: 'moderate', description: 'Chart accessibility summary is too short or empty.', help: 'Provide a text summary of the trends in the chart.', step: 'Chart Audit' });
      }
    } else {
      allViolations.push({ id: 'chart-missing-summary', impact: 'serious', description: 'No text summary or description found for the visualization.', help: 'Add highcharts-description for WCAG/EAA compliance.', step: 'Chart Audit' });
    }

    // 3. Keyboard Navigation Test on Chart
    console.log('      - Testing Chart Keyboard Focus...');
    await chartContainer.focus();
    const isFocused = await page.evaluate(() => document.activeElement.classList.contains('highcharts-container'));
    console.log(`         - Container focusable: ${isFocused}`);

    if (proxyVisible) {
       // Tab into legend
       await page.keyboard.press('Tab');
       const activeLabel = await page.evaluate(() => document.activeElement.getAttribute('aria-label') || 'no-label');
       console.log(`         - Tab 1 -> [${activeLabel}]`);
    }

    // Axe scan specifically on the chart area
    const axeResults = await new AxeBuilder({ page }).include('.highcharts-container').analyze();
    axeResults.violations.forEach(v => { v.step = 'Highcharts'; allViolations.push(v); });

    // NEW: Scan for undefined/null/NaN in chart SVG labels/tooltips
    console.log('      🔎 Scanning Highcharts view for missing translations...');
    await performScan(page, allViolations, 'Highcharts Chart');

  } else {
    console.log('      ⚠️ No highcharts-container found in this view.');
  }
};
