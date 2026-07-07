/* ============================================================================
   Integrated Software Technologies — site logic
   TO EDIT LINKS: fill each app's `store` (App Store URL) and `github` (repo URL)
   below. Leave `store:""` to show a neutral link; set status:"soon" for WIP apps.
   ============================================================================ */

const APPS = [
  { name:"Tunnel", cat:"Developer Tools", accent:"#22d3ee", icon:"Tunnel",
    desc:"A full SSH terminal, SFTP, and port forwarding in your pocket. Secured with Face ID.",
    store:"", github:"" },
  { name:"NetScan Pro", cat:"Utilities", accent:"#34d399", icon:"NetScanPro",
    desc:"See every device on your network in seconds. Ports, vendors, and latency at a glance.",
    store:"", github:"" },
  { name:"DepthTag", cat:"Utilities", accent:"#38bdf8", icon:"DepthTag",
    desc:"Point, tap, measure. LiDAR-precise distances tagged onto the real world in AR.",
    store:"", github:"" },
  { name:"SnapSweep", cat:"Photo & Video", accent:"#0ea5e9", icon:"SnapSweep",
    desc:"Reclaim your storage. Find duplicates, screenshots, and blurry shots, all on-device.",
    store:"", github:"" },
  { name:"DoughRatio", cat:"Food & Drink", accent:"#f59e0b", icon:"DoughRatioApp",
    desc:"Baker's percentages, hydration, and batch scaling, worked out the instant you type.",
    store:"https://apps.apple.com/us/app/doughratio/id6761349279", github:"" },
  { name:"Score Split", cat:"Sports", accent:"#ef4444", icon:"ScoreSplit",
    desc:"Tap your side to score. Two players, one screen, zero arguments.",
    store:"https://apps.apple.com/us/app/scoresplit-app/id6761349352", github:"" },
  { name:"WaveVision", cat:"Music", accent:"#a855f7", icon:"WaveVision",
    desc:"Turn images into sound and sound back into images, using an on-device FFT.",
    store:"https://apps.apple.com/us/app/wavevision/id6761349326" },
  { name:"ToneScape", cat:"Health & Fitness", accent:"#2dd4bf", icon:"ToneScape",
    desc:"Ambient soundscapes for focus and sleep, with a home-screen widget.",
    store:"https://apps.apple.com/us/app/tonescape/id6761738557" },
  { name:"TuneForge", cat:"Music", accent:"#fbbf24", icon:null, glyph:"🎸",
    desc:"A mic-based guitar tuner with fast, accurate real-time pitch detection.",
    store:"", github:"" },
  { name:"MentalPerformanceOS", cat:"Health & Fitness", accent:"#ec4899", icon:"MentalPerformanceOS",
    desc:"EEG-guided focus and recovery training over the Versus headset.",
    store:"", github:"" },
  { name:"BinaryHexCalc", cat:"Developer Tools", accent:"#22d3ee", icon:"BinaryHexCalc",
    desc:"Binary, hexadecimal, and decimal side by side, with live bit toggling.",
    store:"https://apps.apple.com/us/app/binaryhexcalc/id6755499704" },
  { name:"RFScope", cat:"Utilities", accent:"#34d399", icon:null, glyph:"📡",
    desc:"Visualize the RF spectrum in real time.",
    store:"", github:"" },
  { name:"captureLiDAR", cat:"Photo & Video", accent:"#38bdf8", icon:null, glyph:"🌐",
    desc:"Capture and visualize LiDAR depth data as a live point cloud.",
    store:"", github:"" },
  { name:"Perimeter", cat:"Privacy · in development", accent:"#8b5cf6", icon:null, glyph:"🛡️",
    desc:"An on-device privacy firewall that shows what your apps send and blocks the trackers.",
    status:"soon", store:"", github:"" },
  { name:"Deck", cat:"Developer Tools · in development", accent:"#22ff8c", icon:null, glyph:"⌨️",
    desc:"A graphical SSH client: browse a host like a file manager with a live terminal docked below.",
    status:"soon", store:"", github:"" },
];

const svgApple = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1c.1 1.2-.4 2.4-1.1 3.2-.8.9-2 1.6-3.2 1.5-.1-1.2.5-2.4 1.2-3.1C13.7 1.6 15 1 16 1zm3.6 16.4c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.6 3.8-4.5 3.8-1.7 0-2.1-1.1-4.4-1.1s-2.8 1.1-4.4 1.1c-1.9 0-3.3-1.9-4.4-3.6C-1 16.4-.4 9.9 3 8c1.3-.7 2.6-.6 3.7-.6 1.2 0 2 .7 3.4.7 1.3 0 2.1-.7 3.6-.7 1.1 0 2.3.1 3.4.9-3 1.6-2.5 5.9.5 7.1z"/></svg>';
const svgGit = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 8.8 21.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>';

// render app cards
const grid = document.getElementById('appgrid');
grid.innerHTML = APPS.map((a, i) => {
  const iconHTML = a.icon
    ? `<img class="icon" src="assets/icons/${a.icon}.png" alt="${a.name} icon" loading="lazy">`
    : `<div class="icon ph">${a.glyph||'📱'}</div>`;
  let links;
  if (a.status === 'soon') {
    links = `<span class="chip soon">In development</span>`;
  } else if (a.store) {
    links = `<a class="chip app" href="${a.store}" target="_blank" rel="noopener">${svgApple} View on the App Store</a>`;
  } else {
    links = `<span class="chip soon">In review</span>`;
  }
  return `<div class="card reveal ${['','d1','d2'][i%3]}" style="--a:${a.accent}">
    <div class="glow" style="background:${a.accent}"></div>
    <div class="top">${iconHTML}<div><h3>${a.name}</h3><div class="cat">${a.cat}</div></div></div>
    <div class="desc">${a.desc}</div>
    <div class="links">${links}</div>
  </div>`;
}).join('');

// hero floating icons (real ones)
const floaters = ["Tunnel","NetScanPro","DepthTag","DoughRatioApp","SnapSweep","ScoreSplit","ToneScape","WaveVision"];
document.getElementById('floaticons').innerHTML =
  floaters.map(f => `<img src="assets/icons/${f}.png" alt="">`).join('');

// stats
const liveCount = APPS.filter(a => a.status !== 'soon').length;
const STATS = [[liveCount,"","iOS apps"],[100,"%","On-device"],[0,"","Trackers"],[0,"","Accounts"]];
document.getElementById('statgrid').innerHTML = STATS.map(s =>
  `<div class="stat reveal"><div class="n" data-to="${s[0]}" data-suf="${s[1]}">0${s[1]}</div><div class="l">${s[2]}</div></div>`
).join('');

// ---- open-source cross-platform tools ----
const OSS = [
  { name:"rateCheck", lang:"C++17", glyph:"💽", accent:"#22d3ee",
    desc:"A cross-platform disk and partition benchmarking utility with direct-disk read and write modes.",
    platforms:"Windows · macOS · Linux", github:"https://github.com/mathieeo/rateCheck" },
  { name:"SoftCOM", lang:"Python", glyph:"🔌", accent:"#34d399",
    desc:"A serial I/O utility for opening and interacting with serial-port devices.",
    platforms:"Windows · macOS · Linux", github:"https://github.com/mathieeo/SoftCOM" },
  { name:"SerialFileCopy", lang:"Python", glyph:"🔁", accent:"#a855f7",
    desc:"Transfer files reliably over a serial connection, straight from the command line.",
    platforms:"Windows · macOS · Linux", pip:"pip install serialfilecopy",
    github:"https://github.com/mathieeo/SerialFileCopy" },
];
document.getElementById('osgrid').innerHTML = OSS.map((o, i) => {
  const cmd = o.pip
    ? `<div class="cmd"><code><span class="pfx">$</span> ${o.pip}</code><button class="copy" data-cmd="${o.pip}">Copy</button></div>` : '';
  return `<div class="card reveal ${['','d1','d2'][i%3]}" style="--a:${o.accent}">
    <div class="glow" style="background:${o.accent}"></div>
    <div class="top">
      <div class="icon ph" style="color:${o.accent}">${o.glyph}</div>
      <div><h3>${o.name} <span class="lang" style="color:${o.accent};background:${o.accent}22">${o.lang}</span></h3>
      <div class="cat">${o.platforms}</div></div>
    </div>
    <div class="desc">${o.desc}</div>${cmd}
    <div class="links"><a class="chip gh" href="${o.github}" target="_blank" rel="noopener">${svgGit} GitHub</a></div>
  </div>`;
}).join('');

// ---- services (work with me) ----
const SERVICES = [
  { t:"IT Support", accent:"#22d3ee",
    d:"On-site and remote IT help: setup, troubleshooting, backups, and keeping your tech running.",
    svg:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6.5 7.5h.01M6.5 16.5h.01"/>' },
  { t:"Networking", accent:"#34d399",
    d:"Wi-Fi and LAN design, diagnostics, security audits, and getting every device talking.",
    svg:'<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v3.3m0 0-5 6.3m5-6.3 5 6.3"/>' },
  { t:"Websites", accent:"#a855f7",
    d:"Fast, modern, animated websites like this one, designed and deployed for you.",
    svg:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M6 6.5h.01M8.5 6.5h.01"/>' },
  { t:"iOS & Android apps", accent:"#ec4899",
    d:"Native mobile apps and games, from concept to the App Store and Google Play.",
    svg:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>' },
  { t:"PC & Mac apps", accent:"#f59e0b",
    d:"Cross-platform desktop software for Windows, macOS, and Linux, built fast and reliable.",
    svg:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
  { t:"Games", accent:"#8b5cf6",
    d:"Fun, polished games and interactive experiences that feel great to play.",
    svg:'<rect x="2" y="7.5" width="20" height="9" rx="4.5"/><path d="M6.5 11v2M5.5 12h2"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>' },
];
document.getElementById('svcgrid').innerHTML = SERVICES.map((s, i) =>
  `<div class="card reveal ${['','d1','d2'][i%3]}" style="--a:${s.accent}">
    <div class="glow" style="background:${s.accent}"></div>
    <div class="svc-ic" style="color:${s.accent};background:${s.accent}22">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${s.svg}</svg></div>
    <h3>${s.t}</h3>
    <div class="desc">${s.d}</div>
    <a class="chip app" href="#contact">Get a quote →</a>
  </div>`
).join('');

// copy-to-clipboard for command snippets
document.addEventListener('click', e => {
  const b = e.target.closest('.copy'); if (!b) return;
  navigator.clipboard && navigator.clipboard.writeText(b.dataset.cmd);
  const prev = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => b.textContent = prev, 1400);
});

// scroll reveal
const io = new IntersectionObserver((es) => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.classList.contains('stat')) countUp(e.target.querySelector('.n')); } });
}, { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

function countUp(el){
  const to = +el.dataset.to, suf = el.dataset.suf||''; let n = 0;
  const step = Math.max(1, Math.round(to/40));
  const t = setInterval(()=>{ n += step; if(n>=to){n=to;clearInterval(t)} el.textContent = n+suf; }, 24);
}

// nav blur on scroll
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30));

// card 3D tilt
grid.querySelectorAll('.card').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `translateY(-6px) perspective(800px) rotateX(${-y*6}deg) rotateY(${x*8}deg)`;
  });
  card.addEventListener('pointerleave', () => card.style.transform = '');
});

// gentle floating dots on canvas
const cv = document.getElementById('dots'), cx = cv.getContext('2d');
let dots = [];
function resize(){ cv.width = innerWidth; cv.height = innerHeight;
  dots = Array.from({length: Math.min(70, innerWidth/22|0)}, () => ({
    x: Math.random()*cv.width, y: Math.random()*cv.height,
    r: Math.random()*1.6+.4, vx:(Math.random()-.5)*.15, vy:(Math.random()-.5)*.15,
    a: Math.random()*.4+.1 })); }
resize(); addEventListener('resize', resize);
(function loop(){
  cx.clearRect(0,0,cv.width,cv.height);
  for(const d of dots){ d.x+=d.vx; d.y+=d.vy;
    if(d.x<0||d.x>cv.width)d.vx*=-1; if(d.y<0||d.y>cv.height)d.vy*=-1;
    cx.beginPath(); cx.arc(d.x,d.y,d.r,0,7); cx.fillStyle=`rgba(160,180,255,${d.a})`; cx.fill(); }
  requestAnimationFrame(loop);
})();
