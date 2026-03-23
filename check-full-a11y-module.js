const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// --- Import Modules ---
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

/**
 * Functional audit runner that can be called by a server.
 * @param {Object} options { selectedTests: array, logger: function }
 */
module.exports = async function runAudit({ selectedTests, logger }) {
  // Helper for logging
  const log = (msg) => {
    console.log(msg);
    if (logger) logger(msg);
  };

  let browser;
  try {
    log('🚀 INITIALIZING AUDIT RUNNER...');
    browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext();
    const page = await context.newPage();
    const allViolations = [];
    let totalStepsTested = 1;

    const run = (id) => selectedTests.includes(id);

    // --- Load the target page ---
    log(`🎯 LOADING: ${BASE_URL}`);
    await setupHandler(page, BASE_URL);

    // 1. Tutorial
    if (run('tutorial')) {
      log('📌 STEP 1: Tutorial Scan...');
      totalStepsTested += (await testTutorial(page, allViolations) || 1);
    } else {
      await dismissTutorial(page);
    }

    // 2. Navbar & Language Modal
    if (run('navbar')) {
      log('📌 STEP 2: Navbar & Language Toggle...');
      await testNavbar(page, allViolations, run('languageModal'));
      totalStepsTested++;
    }

    // 3. Timeline Component
    if (run('timeline')) {
      log('📌 STEP 3: Timeline Component...');
      await testTimeline(page, allViolations);
      totalStepsTested++;
    }

    // 4. Floating Controls (Zoom & Legend)
    if (run('floatingControls')) {
      log('📌 STEP 4: Floating Controls (Zoom & Legend)...');
      await testFloatingControls(page, allViolations, run('legend'));
      totalStepsTested++;
    }

    // 5. Country Select
    if (run('select')) {
      log('📌 STEP 5: Country Select...');
      await testSelect(page, allViolations, run('selectDropdown'));
      totalStepsTested++;
    }

    // 6. Main Toolbar
    if (run('toolbar')) {
      log('📌 STEP 6: Main Toolbar & Toolbox...');
      await testToolbar(page, allViolations);
      totalStepsTested++;
    }

    // 7. Sankey Nodes & Modals
    if (run('nodeModal')) {
      log('📌 STEP 7: Sankey Nodes & Modals...');
      await testNodeModal(page, allViolations, run('chart'));
      totalStepsTested++;
    }

    // 8. DOM Translation Scan
    if (run('undefinedText')) {
      log('📌 STEP 8: Scanning for missing translations...');
      await testUndefinedText(page, allViolations);
      totalStepsTested++;
    }

    // 9. Global Tab Sweep
    if (run('globalTabbing')) {
      log('📌 STEP 9: Global Tab Sweep...');
      await testGlobalTabbing(page, allViolations);
      totalStepsTested++;
    }

    // 10-13. Adaptive Modes & WCAG 2.2
    if (run('forcedColors') || run('reducedMotion') || run('textSpacing') || run('targetSize')) {
      log('📌 STEP 10-13: Advanced Emulation & WCAG 2.2...');
      await emulateAdaptiveModes(page, allViolations, {
        forcedColors: run('forcedColors'),
        reducedMotion: run('reducedMotion'),
        textSpacing: run('textSpacing'),
        targetSize: run('targetSize')
      });
      totalStepsTested++;
    }

    // 14. Global structure
    log('📌 STEP 14: Final Global Page Structure...');
    await testGlobalStructure(page, allViolations);
    totalStepsTested++;

    // --- FINAL REPORT CONSOLIDATION ---
    log('\n🛠️ CONSOLIDATING REPORT DATA...');
    const htmlReport = generateModernReport(allViolations, totalStepsTested);
    const reportDir = path.resolve('a11y-reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    
    const reportPath = path.join(reportDir, 'relatorio-tutorial-global.html');
    fs.writeFileSync(reportPath, htmlReport, 'utf8');

    log(`✅ SUCCESS! Report created: relatorio-tutorial-global.html`);
    log(`🌐 Opening report...`);

    // In Server mode, we open the final report in the same browser session or a new tab
    const finalUrl = `file://${reportPath.replace(/\\/g, '/')}`;
    await page.goto(finalUrl, { waitUntil: 'load' });
    
    // In Dash Mode, we don't block the Node session. Dashboard should trigger it.
    await page.waitForTimeout(10000); 

  } catch (error) {
    log(`❌ FATAL ERROR: ${error.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};
