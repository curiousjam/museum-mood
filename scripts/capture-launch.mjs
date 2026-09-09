import { mkdir, writeFile } from 'node:fs/promises';

const endpoint = 'http://127.0.0.1:9223';
const output = '/private/tmp/museum-mood-capture';
await mkdir(output, { recursive: true });

async function command(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener('message', listener);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    ws.addEventListener('message', listener);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(name, width, height, mobile) {
  const target = await fetch(`${endpoint}/json/new?http://localhost:3000/`, {
    method: 'PUT',
  }).then((response) => response.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));
  let id = 0;
  const send = (method, params) => command(ws, ++id, method, params);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
  await send('Page.reload', { ignoreCache: true });
  await delay(1400);
  await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-motion-tile]')?.click()`,
  });
  await delay(1000);
  for (let frame = 0; frame < 6; frame += 1) {
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      `${output}/${name}-${String(frame).padStart(2, '0')}.png`,
      Buffer.from(screenshot.data, 'base64'),
    );
    if (frame < 5) {
      await send('Runtime.evaluate', {
        expression: `document.querySelector('[aria-label="next painting"]')?.click()`,
      });
      await delay(900);
    }
  }
  ws.close();
  await fetch(`${endpoint}/json/close/${target.id}`);
}

await capture('desktop', 1280, 900, false);
await capture('mobile', 390, 844, true);
