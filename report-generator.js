module.exports = function generateModernReport(allViolations, totalStepsTested) {
  const critical = allViolations.filter(v => v.impact === 'critical').length;
  const serious  = allViolations.filter(v => v.impact === 'serious').length;
  const moderate = allViolations.filter(v => v.impact === 'moderate').length;
  const minor    = allViolations.filter(v => v.impact === 'minor').length;

  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Step meta — maps the step string pushed by each tester to a display label
  const STEP_META = {
    'Tutorial Step':       { num: 1, label: 'Tutorial Scan' },
    'Navbar':              { num: 2, label: 'Navbar' },
    'Navbar Tabbing':      { num: 2, label: 'Navbar — Tab Sequence' },
    'Language Modal':      { num: '2b', label: 'Language Modal' },
    'Language Overlay':    { num: '2b', label: 'Language Overlay' },
    'Timeline':            { num: 3, label: 'Timeline Component' },
    'Zoom Controls':       { num: 4, label: 'Zoom Controls' },
    'Legend Box':          { num: '4b', label: 'Legend Box' },
    'Select':              { num: 5, label: 'Country Select' },
    'Main Toolbar':        { num: 6, label: 'Main Toolbar' },
    'Toolbox':             { num: 6, label: 'Main Toolbar' },
    'Node Modal':          { num: 7, label: 'Sankey Nodes & Modals' },
    'Chart':               { num: '7b', label: 'Highcharts Chart' },
    'DOM Translation Scan':{ num: 8, label: 'Translation Scan' },
    'Global Tab':          { num: 9, label: 'Global Tab Sweep' },
    'High Contrast':       { num: 10, label: 'High Contrast Emulation' },
    'Reduced Motion':      { num: 11, label: 'Reduced Motion Emulation' },
    'Text Spacing':        { num: 12, label: 'Text Spacing (1.4.12)' },
    'WCAG 2.2 Target Size':{ num: 13, label: 'Target Size (2.5.8)' },
    'Global Structure':    { num: 14, label: 'Global Page Structure' },
  };

  function getStepMeta(stepStr) {
    if (!stepStr) return { num: '?', label: stepStr || 'Unknown' };
    for (const [key, meta] of Object.entries(STEP_META)) {
      if (stepStr.startsWith(key)) return meta;
    }
    return { num: '?', label: stepStr };
  }

  // Group by step first, then by rule ID within that step
  const byStep = {};
  
  // PRE-POPULATE: Ensure every known step is initialized so users see "Passed" steps
  Object.values(STEP_META).forEach(meta => {
    const stepKey = `${String(meta.num).padStart(3, '0')}_${meta.label}`;
    if (!byStep[stepKey]) byStep[stepKey] = { meta, rules: {} };
  });

  allViolations.forEach(v => {
    const meta = getStepMeta(v.step);
    const stepKey = `${String(meta.num).padStart(3, '0')}_${meta.label}`;
    if (!byStep[stepKey]) byStep[stepKey] = { meta, rules: {} };

    const ruleId = v.id;
    if (!byStep[stepKey].rules[ruleId]) {
      byStep[stepKey].rules[ruleId] = {
        id: ruleId,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        tags: v.tags || [],
        nodes: []
      };
    }
    (v.nodes || []).forEach(n => {
      byStep[stepKey].rules[ruleId].nodes.push({
        ...n,
        stepOrigin: v.step
      });
    });
  });

  const impactWeight = { critical: 4, serious: 3, moderate: 2, minor: 1 };
  const sortedSteps = Object.entries(byStep)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, s]) => ({
      ...s,
      ruleList: Object.values(s.rules).sort((a, b) =>
        (impactWeight[b.impact] || 0) - (impactWeight[a.impact] || 0)
      )
    }));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A11y Global Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --critical: #ef4444;
      --serious: #f97316;
      --moderate: #eab308;
      --minor: #3b82f6;
      --font: 'Inter', system-ui, -apple-system, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--font);
      background-color: var(--bg);
      color: var(--text-main);
      padding: 2rem;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    header { margin-bottom: 3rem; border-bottom: 1px solid var(--border); padding-bottom: 2rem; }
    h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-muted); font-size: 1rem; }

    .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .stat-card { background: var(--card-bg); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid var(--border); }
    .stat-card.critical { border-top: 4px solid var(--critical); }
    .stat-card.serious { border-top: 4px solid var(--serious); }
    .stat-card.moderate { border-top: 4px solid var(--moderate); }
    .stat-card.minor { border-top: 4px solid var(--minor); }
    .stat-value { font-size: 2.5rem; font-weight: 800; }
    .stat-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; }

    .step-section { 
      background: var(--card-bg); 
      border-radius: 12px; 
      border: 1px solid var(--border); 
      margin-bottom: 2rem;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.2rem 1.5rem;
      background: linear-gradient(135deg, #fdfdfd, #f8fafc);
      cursor: pointer;
      transition: background 0.15s;
    }
    .step-header:hover { background: #f1f5f9; }

    .step-num-badge {
      background: #0f172a;
      color: #f8fafc;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .step-title { font-size: 1.1rem; font-weight: 800; flex: 1; }
    
    .badge { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .badge.critical { background: #fee2e2; color: #991b1b; }
    .badge.serious { background: #ffedd5; color: #c2410c; }
    .badge.moderate { background: #fef9c3; color: #854d0e; }
    .badge.minor { background: #dbeafe; color: #1e40af; }

    .step-content { display: none; padding: 1.5rem; border-top: 1px solid var(--border); }
    .step-content.expanded { display: block; }

    .rule-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }

    .rule-header {
      padding: 1rem;
      background: #fafafa;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }

    .rule-title { font-weight: 700; font-size: 0.95rem; }

    .rule-body { padding: 1rem; }
    .rule-desc { font-size: 0.95rem; margin-bottom: 0.5rem; line-height: 1.5; color: #334155; }
    .rule-help { font-size: 0.85rem; color: #64748b; }
    .rule-help a { color: #3b82f6; text-decoration: none; font-weight: 600; }

    .occ-grid { margin-top: 1rem; }
    .node-item { background: #f8fafc; border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .node-reason { font-weight: 700; color: #b91c1c; font-size: 0.85rem; }
    .node-target { font-family: 'JetBrains Mono', monospace; background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.75rem; color: #475569; }

    .code-block { background: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; overflow-x: auto; margin: 1rem 0; }
    .actions { display: flex; gap: 0.5rem; }
    .btn { background: white; border: 1px solid var(--border); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; }
    .btn:hover { background: #f1f5f9; }
    .btn.success { background: #10b981; color: white; border-color: #10b981; }

    .chevron { transition: transform 0.2s; }
    .expanded .chevron { transform: rotate(180deg); }
  </style>
  <script>
    function toggleStep(el) {
      const content = el.nextElementSibling;
      el.classList.toggle('expanded');
      content.classList.toggle('expanded');
    }

    function copyHiddenText(ev, btn) {
      ev.stopPropagation();
      const textarea = btn.nextElementSibling;
      const text = textarea.value;
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      
      const originalText = btn.innerHTML;
      btn.classList.add('success');
      btn.innerHTML = '✓ Copied!';
      setTimeout(() => {
        btn.classList.remove('success');
        btn.innerHTML = originalText;
      }, 2000);
    }
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>A11y Audit Dashboard 🚀</h1>
      <p class="subtitle">Detailed report grouped by test scenario. Total steps tested: ${totalStepsTested}</p>
      
      <div class="summary-stats">
        <div class="stat-card critical"><span class="stat-value" style="color: var(--critical)">${critical}</span><div class="stat-label">Critical</div></div>
        <div class="stat-card serious"><span class="stat-value" style="color: var(--serious)">${serious}</span><div class="stat-label">Serious</div></div>
        <div class="stat-card moderate"><span class="stat-value" style="color: var(--moderate)">${moderate}</span><div class="stat-label">Moderate</div></div>
        <div class="stat-card minor"><span class="stat-value" style="color: var(--minor)">${minor}</span><div class="stat-label">Minor</div></div>
      </div>
    </header>

    <div class="steps-container">
      ${sortedSteps.map(step => `
        <div class="step-section">
          <div class="step-header" onclick="toggleStep(this)">
            <span class="step-num-badge">Step ${step.meta.num}</span>
            <span class="step-title">${escapeHtml(step.meta.label)}</span>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span class="badge ${step.ruleList.length > 0 ? 'serious' : ''}" style="background: ${step.ruleList.length > 0 ? '' : '#dcfce7'}; color: ${step.ruleList.length > 0 ? '' : '#166534'}">
                ${step.ruleList.length} unique issues
              </span>
              <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          
          <div class="step-content">
            ${step.ruleList.map(rule => `
              <div class="rule-card">
                <div class="rule-header">
                  <span class="rule-title">${escapeHtml(rule.id)}</span>
                  <div style="display: flex; gap: 0.3rem;">
                    ${rule.tags.filter(t => t.startsWith('wcag')).map(t => `<span class="badge" style="background: #e2e8f0; color: #475569; padding: 1px 6px;">${t.replace('wcag', 'SC ')}</span>`).join('')}
                    <span class="badge ${rule.impact}">${rule.impact}</span>
                  </div>
                </div>
                <div class="rule-body">
                  <div class="rule-desc">${escapeHtml(rule.description)}</div>
                  <div class="rule-help">👉 <a href="${escapeHtml(rule.helpUrl || '#')}" target="_blank">${escapeHtml(rule.help)}</a></div>
                  
                  <div class="occ-grid">
                    ${rule.nodes.map(n => `
                      <div class="node-item">
                        <div style="margin-bottom: 0.5rem;">
                          <span class="node-reason">Reason:</span> ${escapeHtml(n.failureSummary)}
                        </div>
                        ${n.stepOrigin && n.stepOrigin !== step.meta.label ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Location: ${escapeHtml(n.stepOrigin)}</div>` : ''}
                        <div style="margin-bottom: 0.8rem;">
                          <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Selector:</span>
                          <span class="node-target">${escapeHtml(n.target ? n.target.join(', ') : 'unknown')}</span>
                        </div>
                        <div class="code-block">${escapeHtml(n.html)}</div>
                        <div class="actions">
                          <button class="btn" onclick="copyHiddenText(event, this)">HTML</button>
                          <textarea style="display:none;">${escapeHtml(n.html)}</textarea>
                          <button class="btn" onclick="copyHiddenText(event, this)">Summary</button>
                          <textarea style="display:none;">${escapeHtml(n.failureSummary)}</textarea>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
            ${step.ruleList.length === 0 ? '<div style="color: #166534; font-weight: 600; text-align: center; padding: 1rem;">No issues found in this scenario.</div>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
`;
};
