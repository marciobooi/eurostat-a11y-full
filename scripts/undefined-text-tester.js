/**
 * DOM Translation Checker Service.
 */

// Internal scanner function that can be called multiple times
async function performScan(page, allViolations, stepLabel) {
  const results = await page.evaluate(() => {
    const PATTERNS = [/undefined/i, /null/i, /NaN/];
    const issues = [];
    const seen = new Set();
    const VISITED_DOCS = new Set();

    function getPath(el) {
      if (!el) return 'unknown';
      const parts = [];
      let curr = el;
      while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        let selector = curr.tagName.toLowerCase();
        if (curr.id) {
          selector += `#${curr.id}`;
          parts.unshift(selector);
          break;
        } else if (curr.className && typeof curr.className === 'string') {
          const cls = curr.className.trim().split(/\s+/).filter(c => !c.includes(':')).slice(0, 2).join('.');
          if (cls) selector += `.${cls}`;
        }
        parts.unshift(selector);
        curr = curr.parentElement || (curr.parentNode instanceof ShadowRoot ? curr.parentNode.host : null);
      }
      return parts.join(' > ');
    }

    const ATTRS = [
      'aria-label', 'aria-placeholder', 'aria-valuetext', 'aria-roledescription',
      'title', 'alt', 'placeholder', 'data-ecl-label', 'data-bs-original-title',
      'data-original-title', 'data-content', 'data-toggle-label', 'value'
    ];

    function scanDocument(doc, docName = 'top') {
      if (!doc || VISITED_DOCS.has(doc)) return;
      VISITED_DOCS.add(doc);

      const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          return (['script', 'style', 'noscript', 'head'].includes(tag)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent;
        if (!text || text.length < 3) continue;
        for (const pattern of PATTERNS) {
          if (pattern.test(text)) {
            const el = node.parentElement;
            const displayPath = `[${docName}] ${getPath(el)}`;
            const fullText = text.trim();
            const key = `text|${displayPath}|${fullText.substring(0, 50)}`;
            if (!seen.has(key)) {
              seen.add(key);
              issues.push({ type: 'text node', text: fullText.substring(0, 150), html: el.outerHTML.substring(0, 300), path: displayPath });
            }
            break;
          }
        }
      }

      doc.querySelectorAll('*').forEach(el => {
        if (el.tagName === 'IFRAME') { try { scanDocument(el.contentDocument, 'iframe'); } catch(e) {} }
        for (const attr of ATTRS) {
          const val = el.getAttribute(attr);
          if (val && (val.toLowerCase().includes('undefined') || val.toLowerCase().includes('null') || val.includes('NaN'))) {
            const displayPath = `[${docName}] ${getPath(el)}`;
            const key = `attr|${attr}|${displayPath}`;
            if (!seen.has(key)) {
              seen.add(key);
              issues.push({ type: `attribute [${attr}]`, text: val.substring(0, 150), html: el.outerHTML.substring(0, 300), path: displayPath });
            }
          }
        }
      });
    }
    scanDocument(document);
    return issues;
  });

  results.forEach(r => {
    // Deduplicate against already found violations in the same step
    const duplicate = allViolations.find(v => v.id === 'undefined-text-in-dom' && v.nodes[0] && v.nodes[0].html === r.html);
    if (!duplicate) {
      allViolations.push({
        id: 'undefined-text-in-dom',
        impact: 'serious',
        description: `Text or attribute contains "undefined", "null" or "NaN". Missing translation or data binding!`,
        help: 'Check i18n keys and data-bound values.',
        step: stepLabel,
        nodes: [{ html: r.html, failureSummary: `[${r.type}] Found "${r.text}"` }]
      });
    }
  });

  return results.length;
}

/**
 * Main Step Function
 */
async function testUndefinedText(page, allViolations) {
  console.log('\n📌 STEP 8: Scanning DOM for Missing Translations (Global Sweep)...');
  const count = await performScan(page, allViolations, 'DOM Translation Scan');
  if (count === 0) {
    console.log('   ✅ No "undefined" / "null" / "NaN" values found.');
  } else {
    console.log(`   ⚠️ Found ${count} instance(s) of undefined/null/NaN.`);
  }
  console.log('   ✅ Step 8 complete.');
}

module.exports = testUndefinedText;
module.exports.performScan = performScan;
