const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// --- Import Modules ---
const showTestSelector = require('./scripts/test-selector');
const setupHandler = require('./scripts/setup-handler');
const { testTutorial, dismissTutorial } = require('./scripts/tutorial-tester');
const testNavbar = require('./scripts/navbar-tester');
const testTimeline = require('./scripts/timeline-tester');
const testFloatingControls = require('./scripts/floating-controls-tester');
const testGlobalTabbing = require('./scripts/global-tab-tester');
const testSelect = require('./scripts/select-tester');
const testToolbar = require('./scripts/toolbar-tester');
const testNodeModal = require('./scripts/node-modal-tester');
const testUndefinedText = require('./scripts/undefined-text-tester');
const { emulateAdaptiveModes } = require('./scripts/emulation-tester');
const testGlobalStructure = require('./scripts/global-structure-tester');
const generateModernReport = require('./report-generator');

// --- Configuration ---
const BASE_URL = 'http://localhost:5503/sankey.html';

(async () => {
  console.log('🚀 INITIALIZING AUDIT RUNNER...');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();
  const allViolations = [];
  let totalStepsTested = 1;

  try {
    // 0. Show the Visual Test Selector
    const selectedTests = await showTestSelector(page);
    const run = (id) => selectedTests.includes(id);

    // --- Load the target page ---
    await setupHandler(page, BASE_URL);

    // 1. Tutorial
    if (run('tutorial')) {
      totalStepsTested += await testTutorial(page, allViolations) || 1;
    } else {
      await dismissTutorial(page);
    }

    // 2. Navbar & Language Modal
    if (run('navbar')) {
      await testNavbar(page, allViolations, run('languageModal'));
      totalStepsTested++;
    }

    // 3. Timeline Component
    if (run('timeline')) {
      await testTimeline(page, allViolations);
      totalStepsTested++;
    }

    // 4. Floating Controls (Zoom & Legend)
    if (run('floatingControls')) {
      await testFloatingControls(page, allViolations, run('legend'));
      totalStepsTested++;
    }

    // 5. Country Select
    if (run('select')) {
      await testSelect(page, allViolations, run('selectDropdown'));
      totalStepsTested++;
    }

    // 6. Main Toolbar
    if (run('toolbar')) {
      await testToolbar(page, allViolations);
      totalStepsTested++;
    }

    // 7. Sankey Nodes & Modals
    if (run('nodeModal')) {
      await testNodeModal(page, allViolations, run('chart'));
      totalStepsTested++;
    }

    // 8. DOM Translation Scan
    if (run('undefinedText')) {
      await testUndefinedText(page, allViolations);
      totalStepsTested++;
    }

    // 9. Global Tab Sweep (final)
    if (run('globalTabbing')) {
      await testGlobalTabbing(page, allViolations);
      totalStepsTested++;
    }

    // 10-13. Advanced Adaptive Modes & WCAG 2.2
    if (run('forcedColors') || run('reducedMotion') || run('textSpacing') || run('targetSize')) {
      await emulateAdaptiveModes(page, allViolations, {
        forcedColors: run('forcedColors'),
        reducedMotion: run('reducedMotion'),
        textSpacing: run('textSpacing'),
        targetSize: run('targetSize')
      });
      totalStepsTested++;
    }

    // 14. Global structure (H1, Landmarks)
    await testGlobalStructure(page, allViolations);
    totalStepsTested++;

    // --- FINAL REPORT CONSOLIDATION ---
    console.log('\n🛠️  CONSOLIDATING REPORT DATA...');
    const htmlReport = generateModernReport(allViolations, totalStepsTested);
    const reportDir = path.resolve('a11y-reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    
    const reportPath = path.join(reportDir, 'relatorio-tutorial-global.html');
    fs.writeFileSync(reportPath, htmlReport, 'utf8');

    console.log(`✅ SUCCESS! Report created: ${reportPath}`);
    console.log(`\n🌐 OPENING RESULTS... Press CTRL+C to close.`);
    await page.goto(`file://${reportPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await new Promise(() => {}); // Keep-alive

  } catch (error) {
    console.error('❌ FATAL ERROR IN AUDIT FLOW:', error);
  } finally {
    await browser.close().catch(() => {});
  }
})();