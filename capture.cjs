const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\dededddddqq\\AppData\\Local\\Temp\\cdp_profile_' + Date.now();

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1600,1200',
    '--user-data-dir=' + userDataDir,
    'http://localhost:3000/#home'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9224/json', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      const pageTarget = res.find(t => t.type === 'page' && t.url.includes('3000'));
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('Failed to get page wsUrl');
    chromeProc.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  });

  await new Promise(resolve => ws.on('open', resolve));

  // Wait 2.5s for React to mount
  await new Promise(r => setTimeout(r, 2500));

  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const btns = Array.from(document.querySelectorAll('button'));
        const acceptBtn = btns.find(b => b.textContent && b.textContent.includes('Accept'));
        if (acceptBtn) acceptBtn.click();

        // Scroll carousel into view
        const targetCard = document.querySelector('[data-slot="0"]');
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      })()
    `
  });

  await new Promise(r => setTimeout(r, 1000));

  // Bring Module 10 (MediBot) to front by clicking Previous feature
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        const prevBtn = document.querySelector('button[aria-label="Previous feature"]');
        if (prevBtn) prevBtn.click();
      })()
    `
  });

  // Wait 1.2s for transition to settle
  await new Promise(r => setTimeout(r, 1200));

  const screenshotResult = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\dededddddqq\\MedVeda\\carousel_medibot_snap.png', Buffer.from(screenshotResult.data, 'base64'));
  console.log('SUCCESS: Saved carousel_medibot_snap.png');

  ws.close();
  chromeProc.kill();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
