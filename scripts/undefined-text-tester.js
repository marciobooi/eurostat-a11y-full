/**
 * DOM Translation Checker Service.
 * Deeply scans the DOM for "undefined", "null", "NaN" or "[object Object]".
 */

async function performScan(page, allViolations, stepLabel) {
  const results = await page.evaluate(() => {
    const PATTERNS = [/undefined/i, /null/i, /NaN/g, /\[object Object\]/i];
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

    function scanDocument(doc, docName = 'top') {
      if (!doc || VISITED_DOCS.has(doc)) return;
      VISITED_DOCS.add(doc);

      // --- 1. Scan Text Nodes ---
      const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          // Skip technical junk
          if (['script', 'style', 'noscript', 'head', 'template'].includes(tag)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (!text) continue;
        
        for (const pattern of PATTERNS) {
          if (pattern.test(text)) {
            const el = node.parentElement;
            const displayPath = `[${docName}] ${getPath(el)}`;
            // Key for deduplication
            const key = `text|${displayPath}|${text.substring(0, 30)}`;
            if (!seen.has(key)) {
              seen.add(key);
              issues.push({ 
                type: 'text content', 
                text: text.substring(0, 150), 
                html: el.outerHTML.substring(0, 400), 
                path: displayPath 
              });
            }
            break;
          }
        }
      }

      // --- 2. Scan All Attributes for every element ---
      doc.querySelectorAll('*').forEach(el => {
        // Handle iframes
        if (el.tagName === 'IFRAME') {
          try { scanDocument(el.contentDocument, 'iframe'); } catch(e) {}
        }
        
        // Check attributes
        const attributes = el.attributes;
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i];
          const name = attr.name;
          const val = attr.value;
          
          if (!val) continue;

          for (const pattern of PATTERNS) {
            if (pattern.test(val)) {
              const displayPath = `[${docName}] ${getPath(el)}`;
              const key = `attr|${name}|${displayPath}|${val.substring(0, 30)}`;
              if (!seen.has(key)) {
                seen.add(key);
                issues.push({ 
                  type: `attribute [${name}]`, 
                  text: val.substring(0, 150), 
                  html: el.outerHTML.substring(0, 400), 
                  path: displayPath 
                });
              }
              break;
            }
          }
        }
      });
    }

    scanDocument(document);
    return issues;
  });

  results.forEach(r => {
    // Only push if not already identified as a duplicate in this step
    const duplicate = allViolations.find(v => 
      v.id === 'undefined-text-in-dom' && 
      v.nodes[0] && 
      v.nodes[0].html === r.html &&
      v.nodes[0].failureSummary.includes(r.type)
    );

    if (!duplicate) {
      allViolations.push({
        id: 'undefined-text-in-dom',
        impact: 'serious',
        description: `Potential unformatted data or missing translation key found in the DOM.`,
        help: `The value "${r.text}" was detected. Ensure all variables are correctly bound and i18n keys are resolved.`,
        step: stepLabel,
        nodes: [{ 
          html: r.html, 
          failureSummary: `[${r.type}] Found suspicious value: "${r.text}" at ${r.path}` 
        }]
      });
    }
  });

  return results.length;
}

/**
 * Audit Step Interface
 */
async function testUndefinedText(page, allViolations) {
  console.log('\n📌 STEP 8: Deep Scanning DOM for Data Binding & Translation Errors...');
  const count = await performScan(page, allViolations, 'DOM Translation Scan');
  if (count === 0) {
    console.log('   ✅ No "undefined", "null", "NaN" or "[object Object]" found.');
  } else {
    console.log(`   ⚠️ CRITICAL: Found ${count} instance(s) of broken data/translations!`);
  }
}

module.exports = testUndefinedText;
module.exports.performScan = performScan;
