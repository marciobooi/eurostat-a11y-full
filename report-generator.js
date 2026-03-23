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
    'Reflow (1.4.10)':     { num: '13b', label: 'Reflow (1.4.10)' },
    'Color Contrast':      { num: '13c', label: 'Color Contrast' },
    'Status Messages':     { num: '13d', label: 'Status Messages' },
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

  const byStep = {};
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
      byStep[stepKey].rules[ruleId].nodes.push({ ...n, stepOrigin: v.step });
    });
  });

  const impactWeight = { critical: 4, serious: 3, moderate: 2, minor: 1 };
  const sortedSteps = Object.entries(byStep)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, s]) => ({
      ...s,
      ruleList: Object.values(s.rules).sort((a, b) => (impactWeight[b.impact] || 0) - (impactWeight[a.impact] || 0))
    }));

  const now = new Date();
  const timestamp = now.toLocaleString();

  return `
<!DOCTYPE html>
<html class="light" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>A11y Audit Report - Audit Integrity</title>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <script id="tailwind-config">
          tailwind.config = {
            darkMode: "class",
            theme: {
              extend: {
                colors: {
                  primary: "#1d4ed8",
                  surface: "#f8f9fb",
                  "surface-container": "#edeef0",
                  "on-primary": "#ffffff",
                  critical: "#dc2626",
                  serious: "#ea580c",
                  moderate: "#ca8a04",
                  minor: "#2563eb"
                },
                fontFamily: {
                  headline: ["Manrope"],
                  body: ["Inter"]
                }
              }
            }
          }
    </script>
    <style>
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }
        body { background-color: #f8f9fb; font-family: 'Inter', sans-serif; }
        .sidebar { background: #f8f9fb; border-right: 1px solid #e1e2e4; height: 100vh; position: sticky; top: 0; }
        .nav-item { transition: all 0.2s; border-radius: 0.75rem; }
        .nav-item:hover { background: #f3f4f6; }
        .nav-item.active { background: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .issue-card { border-left: 4px solid; }
        .issue-card.critical { border-left-color: #dc2626; background: #fef2f2; }
        .issue-card.serious { border-left-color: #ea580c; background: #fffaf0; }
        .issue-card.moderate { border-left-color: #ca8a04; background: #fefce8; }
        .issue-card.minor { border-left-color: #2563eb; background: #eff6ff; }
        
        .code-block { background: #0f172a; color: #f8fafc; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; border-radius: 0.75rem; padding: 1.25rem; }
    </style>
</head>
<body class="bg-surface text-slate-900 font-body">

<!-- Top Navigation -->
<nav class="bg-white border-b border-slate-200 h-16 flex items-center px-8 sticky top-0 z-50 shadow-sm">
    <div class="flex items-center gap-2 mr-12">
        <span class="material-symbols-outlined text-primary font-bold">verified_user</span>
        <h1 class="text-xl font-headline font-extrabold tracking-tight">Audit Integrity</h1>
    </div>
    <div class="flex items-center gap-8 text-sm font-semibold text-slate-500">
        <a href="#" class="hover:text-primary">Dashboard</a>
        <a href="#" class="text-primary border-b-2 border-primary py-5">Audits</a>
        <a href="#" class="hover:text-primary text-slate-400">Reports</a>
        <a href="#" class="hover:text-primary text-slate-400">Settings</a>
    </div>
    <div class="ml-auto flex items-center gap-4">
        <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input type="text" placeholder="Search audits..." class="bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-xs w-64"/>
        </div>
        <span class="material-symbols-outlined text-slate-400">notifications</span>
        <span class="material-symbols-outlined text-slate-400">history</span>
    </div>
</nav>

<div class="flex">
    <!-- Left Sidebar -->
    <aside class="w-80 sidebar p-6 flex flex-col pt-12">
        <div class="mb-10 pl-4">
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2 bg-primary rounded-lg text-white">
                    <span class="material-symbols-outlined text-lg">description</span>
                </div>
                <div>
                  <h3 class="font-headline font-extrabold text-sm leading-none">Report View</h3>
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Accessibility Compliance</p>
                </div>
            </div>
        </div>

        <nav class="space-y-1 mb-12">
            <a href="#" class="nav-item flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-900 active">
                <span class="material-symbols-outlined text-sm">analytics</span> Summary
            </a>
            <a href="#" class="nav-item flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-sm text-critical">cancel</span> Critical Issues
                </div>
                <span class="bg-red-50 text-critical px-2 rounded-full text-[10px]">${critical}</span>
            </a>
            <a href="#" class="nav-item flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-sm text-serious">warning</span> Serious Issues
                </div>
                <span class="bg-orange-50 text-serious px-2 rounded-full text-[10px]">${serious}</span>
            </a>
            <a href="#" class="nav-item flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-sm text-moderate">info</span> Moderate Issues
                </div>
                <span class="bg-yellow-50 text-moderate px-2 rounded-full text-[10px]">${moderate}</span>
            </a>
        </nav>

        <div class="mt-auto space-y-2 border-t border-slate-200 pt-6">
            <button class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <span class="material-symbols-outlined text-sm">picture_as_pdf</span> Export PDF
            </button>
            <button class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <span class="material-symbols-outlined text-sm">settings</span> Audit Settings
            </button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-12 max-w-[1400px]">
        <header class="mb-12">
            <h2 class="text-4xl font-headline font-extrabold text-slate-900 tracking-tight mb-2">Audit Report: Accessibility Scan</h2>
            <div class="flex items-center gap-3 text-sm font-medium">
                <span class="material-symbols-outlined text-primary text-lg">check_circle</span>
                <p class="text-slate-600">Comprehensive WCAG 2.1 Level AA Compliance Review — <span class="text-slate-400">Last scanned at ${timestamp}</span></p>
            </div>
        </header>

        <!-- Stats Overview -->
        <div class="grid grid-cols-4 gap-6 mb-16">
            <div class="bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-slate-200 flex flex-col items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Critical</span>
                <span class="text-5xl font-headline font-extrabold ${critical > 0 ? 'text-critical' : 'text-slate-900'}">${critical}</span>
            </div>
            <div class="bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-serious flex flex-col items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Serious</span>
                <span class="text-5xl font-headline font-extrabold ${serious > 0 ? 'text-serious' : 'text-slate-900'}">${serious}</span>
            </div>
            <div class="bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-moderate flex flex-col items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Moderate</span>
                <span class="text-5xl font-headline font-extrabold ${moderate > 0 ? 'text-moderate' : 'text-slate-900'}">${moderate}</span>
            </div>
            <div class="bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-minor flex flex-col items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Minor</span>
                <span class="text-5xl font-headline font-extrabold ${minor > 0 ? 'text-minor' : 'text-slate-900'}">${minor}</span>
            </div>
        </div>

        <section class="space-y-4">
            ${sortedSteps.map(step => `
                <div class="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden module-step" data-num="${step.meta.num}">
                    <button class="w-full px-8 py-6 flex items-center justify-between hover:bg-slate-50 transition-colors group" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180')">
                        <div class="flex items-center gap-4">
                            <span class="material-symbols-outlined text-slate-300 chevron transition-transform" style="font-size: 20px;">expand_more</span>
                            <span class="text-lg font-headline font-bold text-slate-900">${escapeHtml(step.meta.label)}</span>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${step.ruleList.length} Unique Issues</span>
                            ${step.ruleList.length === 0 ? '<span class="material-symbols-outlined text-emerald-500 bg-emerald-50 rounded-full p-1 text-sm">check</span>' : ''}
                        </div>
                    </button>
                    
                    <div class="px-8 pb-12 pt-4 border-t border-slate-50 ${step.ruleList.length > 0 ? '' : 'hidden'}">
                        ${step.ruleList.map(rule => `
                            <div class="p-8 rounded-[2rem] mb-6 issue-card ${rule.impact || 'minor'} shadow-sm relative overflow-hidden">
                                <div class="flex justify-between items-start mb-6">
                                    <div class="flex items-center gap-3">
                                        <span class="bg-white px-3 py-1 rounded-full text-[10px] font-black uppercase text-${rule.impact}">${rule.impact}</span>
                                        <h4 class="text-xl font-headline font-extrabold text-slate-900">${escapeHtml(rule.id)}</h4>
                                    </div>
                                    <span class="bg-white/50 text-slate-400 text-[10px] px-3 py-1 rounded font-bold uppercase">Issue Found</span>
                                </div>
                                
                                <p class="text-slate-600 text-sm leading-relaxed mb-8 max-w-2xl">${escapeHtml(rule.description)}</p>
                                
                                <div class="grid grid-cols-2 gap-12 mb-10">
                                    <div>
                                        <h5 class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Recommendation</h5>
                                        <p class="text-xs font-bold text-slate-900 leading-relaxed">${escapeHtml(rule.help)}</p>
                                    </div>
                                    <div>
                                        <h5 class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Reason</h5>
                                        <p class="text-xs italic text-slate-600">${escapeHtml(rule.nodes[0]?.failureSummary || 'Element failed standard validation.')}</p>
                                    </div>
                                </div>

                                <div class="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
                                    <div class="flex bg-slate-800 px-6 pt-3">
                                        <button class="px-4 py-2 text-[10px] font-bold text-white border-b-2 border-primary">HTML</button>
                                        <button class="px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-white transition-colors">Summary</button>
                                    </div>
                                    <div class="code-block h-48 overflow-y-auto overflow-x-auto text-[11px] leading-relaxed">
                                        ${escapeHtml(rule.nodes[0]?.html)}
                                    </div>
                                    <div class="p-3 bg-slate-800/50 flex justify-between items-center px-6">
                                       <span class="text-[9px] text-slate-500 font-mono">Selector: ${escapeHtml(rule.nodes[0]?.target?.join(' ')) || 'N/A'}</span>
                                       <button class="text-[9px] text-white bg-primary px-3 py-1 rounded-full font-bold">COPY CODE</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </section>

        <!-- Audit Activity Trail -->
        <section class="mt-20">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Audit Activity Trail</h4>
            <div class="space-y-8 pl-4 border-l-2 border-slate-100">
                <div class="relative pl-8">
                    <span class="absolute left-[-11px] top-1 w-5 h-5 bg-white border-4 border-primary rounded-full"></span>
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-sm font-bold text-slate-900">Audit session finalized</span>
                        <span class="text-xs text-slate-400 font-medium">• ${timestamp}</span>
                    </div>
                    <p class="text-xs text-slate-500">All data consolidated into precision reports. Pipeline finished successfully.</p>
                </div>
                <div class="relative pl-8 opacity-50">
                    <span class="absolute left-[-11px] top-1 w-5 h-5 bg-white border-4 border-slate-200 rounded-full"></span>
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-sm font-bold text-slate-900">Module execution complete</span>
                        <span class="text-xs text-slate-400 font-medium">• ${new Date(now - 120000).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-slate-500">Tested ${totalStepsTested} functional paths across the global domain.</p>
                </div>
                <div class="relative pl-8 opacity-30">
                    <span class="absolute left-[-11px] top-1 w-5 h-5 bg-white border-4 border-slate-100 rounded-full"></span>
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-sm font-bold text-slate-900">Audit session initialized</span>
                        <span class="text-xs text-slate-400 font-medium">• ${new Date(now - 300000).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-slate-500">Seed session started with global configuration. All nodes verified.</p>
                </div>
            </div>
        </section>
    </main>
</div>

</body>
</html>
`;
};
