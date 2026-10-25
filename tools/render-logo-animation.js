// Renders the animated logo to video and GIF. Headless Chrome loads the master SVG inline, pauses its CSS
// animations and steps them with the Web Animations API (currentTime), capturing one PNG with alpha per frame;
// ffmpeg then assembles the deliverables. Two frame sets: "bare" (the mark alone, for light grounds) and
// "plate" (the mark on its white rounded plate, for any ground).
// usage: node tools/render-logo-animation.js assets/brand/integrated-logo-animated.svg "<outDir>"
// Needs Google Chrome and Homebrew ffmpeg (prores_ks, libvpx-vp9, libx264). Frames and the render pages go to a
// temp folder, not the repo. Change the timing in the SVG and in assets/studio.css together, then re-run.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const [svgPath, OUT] = process.argv.slice(2);
const FPS = 60, DUR = 3.2, N = Math.round(FPS * DUR), SIZE = 1080;
const here = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-render-'));
const FF = '/opt/homebrew/bin/ffmpeg';
fs.mkdirSync(OUT, { recursive: true });

// inline copy: drop the xml size attributes and use the tight viewBox (the page provides the margin)
const svgInline = fs.readFileSync(svgPath, 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/\swidth="\d+"\s+height="\d+"/, '').replace(/viewBox="[^"]*"/, 'viewBox="0 0 358.6 314.4"');

function page(variant) {
  const plate = variant === 'plate';
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:transparent}
.stage{width:${SIZE}px;height:${SIZE}px;display:grid;place-items:center}
.plate{width:720px;height:720px;border-radius:150px;background:#fff;display:grid;place-items:center;overflow:hidden;animation:plateIn .7s cubic-bezier(.2,1.3,.3,1) both}
.plate svg{width:74%;height:auto;overflow:visible;display:block}
.bare svg{width:640px;height:auto;overflow:visible;display:block}
@keyframes plateIn{from{transform:scale(.55) rotate(-6deg);opacity:0}}
</style><div class="stage${plate ? '' : ' bare'}">${plate ? '<div class="plate">' + svgInline + '</div>' : svgInline}</div>`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function capture(variant) {
  const html = path.join(here, `render-${variant}.html`); fs.writeFileSync(html, page(variant));
  const dir = path.join(here, 'frames', variant); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--window-size=${SIZE},${SIZE}`, '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--force-device-scale-factor=1', `--user-data-dir=/tmp/logo-profile-${port}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let ver;
    for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); } }
    if (!ver) throw new Error('chrome did not start');
    const ws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Page.enable'); await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false });
    await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await s('Page.navigate', { url: 'file://' + html }); await sleep(700);
    const n = (await s('Runtime.evaluate', { expression: 'document.getAnimations().forEach(a => a.pause()); document.getAnimations().length', returnByValue: true })).result.result.value;
    console.log(variant, 'animations:', n);
    for (let f = 0; f < N; f++) {
      const t = f / FPS * 1000;
      await s('Runtime.evaluate', { expression: `document.getAnimations().forEach(a => { a.currentTime = ${t}; }); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`, awaitPromise: true });
      const cap = await s('Page.captureScreenshot', { format: 'png' });
      if (!cap.result) throw new Error('captureScreenshot: ' + JSON.stringify(cap.error));
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.png`), Buffer.from(cap.result.data, 'base64'));
    }
    ws.close();
  } finally { chrome.kill(); try { fs.rmSync(`/tmp/logo-profile-${port}`, { recursive: true, force: true }); } catch {} }
  console.log(variant, 'frames:', N);
}

const ff = args => execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const seq = v => ['-framerate', String(FPS), '-i', path.join(here, 'frames', v, 'f%04d.png')];
const out = f => path.join(OUT, f);
const over = (v, color, file) => ff(['-f', 'lavfi', '-i', `color=c=${color}:s=${SIZE}x${SIZE}:r=${FPS}`, ...seq(v), '-filter_complex', '[0:v][1:v]overlay=shortest=1,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', out(file)]);

(async () => {
  await capture('bare'); await capture('plate');
  over('bare', 'white', 'integrated-logo-intro-white.mp4');
  over('plate', '0x0b0b0c', 'integrated-logo-intro-dark.mp4');
  ff([...seq('bare'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', out('integrated-logo-intro-alpha.mov')]);
  ff([...seq('plate'), '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', out('integrated-logo-plate-intro-alpha.mov')]);
  ff([...seq('bare'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-auto-alt-ref', '0', '-row-mt', '1', out('integrated-logo-intro-alpha.webm')]);
  ff(['-i', out('integrated-logo-intro-white.mp4'), '-vf', 'fps=25,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', out('integrated-logo-intro.gif')]);
  // still frames for a quick visual check of the choreography
  for (const f of [0, 20, 40, 60, 75, 90, 110, 191]) fs.copyFileSync(path.join(here, 'frames', 'plate', `f${String(f).padStart(4, '0')}.png`), path.join(here, `check-plate-${f}.png`));
  console.log('done:', fs.readdirSync(OUT).map(f => `${f} ${(fs.statSync(out(f)).size / 1e6).toFixed(2)} MB`).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
