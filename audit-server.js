const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const runAuditLogic = require('./check-full-a11y-module');

/**
 * AESTHETIC AUDIT SERVER (Dashboard Mode)
 * This server allows running audits directly from the browser UI.
 */
const PORT = 3000;
let logStreams = [];

// Helper to broadcast logs to the browser dashboard
function broadcastLog(msg) {
  const data = JSON.stringify({ message: msg });
  logStreams.forEach(res => res.write(`data: ${data}\n\n`));
  console.log(msg); // Also log to terminal
}

const server = http.createServer((req, res) => {
  const url = req.url;

  // 1. SSE Stream for logs
  if (url === '/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    logStreams.push(res);
    req.on('close', () => {
      logStreams = logStreams.filter(s => s !== res);
    });
    return;
  }

  // 2. API to Start Audit
  if (url.startsWith('/api/start-audit')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const tests = params.get('tests')?.split(',') || [];
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started' }));

    // Run the audit asynchronously
    (async () => {
      broadcastLog('🚀 CONDUCER: Initializing Audit Session...');
      try {
        await runAuditLogic({ 
          selectedTests: tests, 
          logger: broadcastLog 
        });
      } catch (err) {
        broadcastLog(`❌ CRITICAL ERROR: ${err.message}`);
      }
    })();
    return;
  }

  // 3. Serve Dashboard (test-selector.html)
  if (url === '/' || url === '/index.html') {
    const filePath = path.join(__dirname, 'test-selector.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading dashboard');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // 4. Fallback: Static file server (for local assets if needed)
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('\n🌟 CONDUCER: Eurostat A11y Suite Dashboard is LIVE!');
  console.log(`🔗 Access Dashboard: http://localhost:${PORT}`);
  console.log('---');
});
