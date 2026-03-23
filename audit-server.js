const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const runAuditLogic = require('./check-full-a11y-module');

/**
 * AESTHETIC AUDIT SERVER (Dashboard Mode)
 * This server allows running audits directly from the browser UI.
 */
const PORT = Number(process.env.PORT || 3000);
const REPORT_DIR = process.env.A11Y_REPORT_DIR || path.join(__dirname, 'a11y-reports');
let logStreams = [];
let isAuditRunning = false;
let currentProcessMessage = 'IDLE';
let sessionLogs = [];
let server;

// Helper to broadcast logs to the browser dashboard
function broadcastLog(msg) {
  if (msg.startsWith('📌')) currentProcessMessage = msg;
  sessionLogs.push(msg);
  const data = JSON.stringify({ 
    message: msg, 
    isRunning: isAuditRunning,
    currentStep: currentProcessMessage 
  });
  logStreams.forEach(res => res.write(`data: ${data}\n\n`));
  console.log(msg); // Also log to terminal
}

function createServer() {
  return http.createServer((req, res) => {
  const url = req.url;

  // 1. SSE Stream for logs
  if (url === '/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    logStreams.push(res);
    
    res.write(`data: ${JSON.stringify({ 
      message: `Connected to Conductor Engine Session. Status: ${isAuditRunning ? 'RUNNING' : 'IDLE'}`,
      isRunning: isAuditRunning,
      currentStep: currentProcessMessage
    })}\n\n`);

    // Playback session logs if currently running
    if (isAuditRunning) {
      sessionLogs.forEach(msg => {
        res.write(`data: ${JSON.stringify({ 
          message: msg, 
          isRunning: true, 
          currentStep: currentProcessMessage 
        })}\n\n`);
      });
    }

    req.on('close', () => {
      logStreams = logStreams.filter(s => s !== res);
    });
    return;
  }

  // 2. API to List Reports
  if (url === '/api/reports') {
    const reportDir = REPORT_DIR;
    if (!fs.existsSync(reportDir)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([]));
    }
    fs.readdir(reportDir, (err, files) => {
      if (err) return res.writeHead(500).end('Error listing reports');
      const reports = files.filter(f => f.endsWith('.html')).map(f => {
        const stats = fs.statSync(path.join(reportDir, f));
        return { name: f, date: stats.mtime, size: (stats.size / 1024).toFixed(1) + ' KB' };
      }).sort((a, b) => b.date - a.date);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reports));
    });
    return;
  }

  // 3. API to Start Audit
  if (url.startsWith('/api/start-audit')) {
    if (isAuditRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Audit already in progress' }));
    }

    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const tests = params.get('tests')?.split(',') || [];
    
    isAuditRunning = true;
    currentProcessMessage = 'INITIALIZING...';
    sessionLogs = []; // Clear for new session

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
      } finally {
        isAuditRunning = false;
        currentProcessMessage = 'IDLE';
        broadcastLog('🏁 SESSION FINISHED');
      }
    })();
    return;
  }

  // 3. Serve Audit Reports from a11y-reports/
  if (url.startsWith('/reports/')) {
    const reportName = url.replace('/reports/', '');
    const filePath = path.join(REPORT_DIR, reportName);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Report Not Found');
      }
      // Basic content type detection
      const ext = path.extname(filePath);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  // 4. Serve Dashboard (test-selector.html)
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

  // 5. Fallback: Static file server (for local assets if needed)
  res.writeHead(404);
  res.end('Not Found');
  });
}

function startServer(port = PORT) {
  if (server && server.listening) {
    return Promise.resolve(server);
  }

  server = createServer();

  return new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(port, () => {
      server.off('error', onError);
      console.log('\n🌟 CONDUCER: Eurostat A11y Suite Dashboard is LIVE!');
      console.log(`🔗 Access Dashboard: http://localhost:${port}`);
      console.log('---');
      resolve(server);
    });
  });
}

function stopServer() {
  if (!server || !server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    logStreams.forEach((res) => {
      try {
        res.end();
      } catch (err) {
        // Ignore stale stream close errors.
      }
    });
    logStreams = [];
    server.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(`❌ Failed to start dashboard server: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  startServer,
  stopServer,
  PORT
};
