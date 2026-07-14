#!/usr/bin/env node
/* ============================================================================
   Integrated Software Technologies — static site generator
   Reads assets/apps.js + assets/notes.js and emits:
     apps/<slug>/index.html   per-app landing pages (+ live rating via iTunes)
     notes/<slug>/index.html  journal / build-note pages
     press/index.html         press kit
     assets/og/<slug>.png     per-app share cards (via qlmanage + sips)
     sitemap.xml, robots.txt, 404.html
   Run:  node build.js
   Homepage (index.html) is hand-maintained and NOT touched here.
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = 'https://integratedsw.tech';
const dir = __dirname;
const { APPS } = require('./assets/apps.js');
const { NOTES } = require('./assets/notes.js');
const today = new Date().toISOString().slice(0, 10);

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idOf = url => (String(url || '').match(/id(\d+)/) || [])[1];
const mkdir = p => fs.mkdirSync(p, { recursive: true });
const write = (rel, html) => { const f = path.join(dir, rel); mkdir(path.dirname(f)); fs.writeFileSync(f, html); };

/* -------------------------------------------------------------- shared head */
function head({ title, desc, canonical, og }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#06070d">
<meta property="og:type" content="website"><meta property="og:site_name" content="Integrated Software Technologies">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}"><meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:image" content="${og}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%238b5cf6'/><text x='50' y='68' font-size='54' font-family='sans-serif' font-weight='700' fill='%230b0b12' text-anchor='middle'>i</text></svg>">
<link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/assets/style.css">
</head><body>
<div id="bg"><div class="blob a"></div><div class="blob b"></div><div class="blob c"></div></div>
<nav id="nav">
  <a class="brand" href="/"><span class="mark">i</span><span>Integrated Software<br><small>integratedsw.tech</small></span></a>
  <div class="navlinks"><a href="/#apps">Apps</a><a href="/#journal">Journal</a><a href="/press/">Press</a><a class="cta" href="/#contact">Get in touch</a></div>
</nav>`;
}
const foot = `<footer><a class="brand" href="/"><span class="mark">i</span> Integrated Software Technologies Inc.</a>
<span>© 2026 · Built on-device, in Glendale, CA · integratedsw.tech</span></footer>
<script>addEventListener('scroll',function(){document.getElementById('nav').classList.toggle('scrolled',scrollY>30)})</script>
</body></html>`;

const svgApple = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M16 1c.1 1.2-.4 2.4-1.1 3.2-.8.9-2 1.6-3.2 1.5-.1-1.2.5-2.4 1.2-3.1C13.7 1.6 15 1 16 1zm3.6 16.4c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.6 3.8-4.5 3.8-1.7 0-2.1-1.1-4.4-1.1s-2.8 1.1-4.4 1.1c-1.9 0-3.3-1.9-4.4-3.6C-1 16.4-.4 9.9 3 8c1.3-.7 2.6-.6 3.7-.6 1.2 0 2 .7 3.4.7 1.3 0 2.1-.7 3.6-.7 1.1 0 2.3.1 3.4.9-3 1.6-2.5 5.9.5 7.1z"/></svg>';

/* --------------------------------------------------------------- app pages */
function appPage(a) {
  const id = idOf(a.store);
  const canonical = `${ROOT}/apps/${a.slug}/`;
  const og = `${ROOT}/assets/og/${a.slug}.png`;
  const icon = a.icon
    ? `<img class="micon" src="/assets/icons/${a.icon}.png" alt="${esc(a.name)} icon">`
    : `<div class="micon ph">📱</div>`;
  const store = a.store
    ? `<a class="chip app" href="${a.store}" target="_blank" rel="noopener">${svgApple} View on the App Store</a>`
    : `<span class="chip soon">${a.status === 'soon' ? 'In development' : 'In review'}</span>`;
  const shots = a.key
    ? `<div class="mshots">` + [1, 2, 3, 4, 5].map(k =>
        `<div class="device"><img class="shot" src="/assets/shots/${a.key}/${String(k).padStart(2, '0')}.png" alt="${esc(a.name)} screenshot ${k}" loading="lazy"></div>`).join('') + `</div>`
    : '';
  const meta = id
    ? `<div class="mmeta" id="meta"></div>
<script>(function(){window.__m=function(d){var r=(d.results||[])[0];if(!r)return;var b=[];
if(r.formattedPrice)b.push(r.formattedPrice);
if(r.userRatingCount>0)b.push('★ '+(r.averageUserRating||0).toFixed(1)+' ('+r.userRatingCount.toLocaleString()+')');
if(r.version)b.push('Version '+r.version);
if(r.currentVersionReleaseDate)b.push('Updated '+new Date(r.currentVersionReleaseDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}));
if(r.fileSizeBytes)b.push(Math.round(r.fileSizeBytes/1048576)+' MB');
if(r.minimumOsVersion)b.push('iOS '+r.minimumOsVersion+'+');
document.getElementById('meta').innerHTML=b.map(function(x){return '<span>'+x+'</span>'}).join('<i>·</i>');};
var s=document.createElement('script');s.src='https://itunes.apple.com/lookup?id=${id}&country=us&callback=__m';s.onerror=function(){};document.head.appendChild(s);})();</script>`
    : '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: a.name,
    applicationCategory: 'MobileApplication', operatingSystem: 'iOS', description: a.desc,
    url: a.store || canonical, image: `${ROOT}/assets/icons/${a.icon}.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.', url: ROOT }
  };
  return head({ title: `${a.name} — ${a.cat} for iOS`, desc: a.desc, canonical, og }) +
    `<main class="subpage" style="--a:${a.accent}">
<a class="backlink" href="/#apps">← All apps</a>
<div class="subhead"><span class="micwrap" style="--a:${a.accent}">${icon}</span>
  <div><h1>${esc(a.name)}</h1><div class="cat" style="color:${a.accent}">${esc(a.cat)}</div></div></div>
<p class="mlong">${esc(a.long || a.desc)}</p>
<div class="mlinks">${store}</div>
${meta}
${shots}
</main>
<script type="application/ld+json">${JSON.stringify(ld)}</script>` + foot;
}

/* -------------------------------------------------------------- note pages */
function notePage(n) {
  const canonical = `${ROOT}/notes/${n.slug}/`;
  const dt = new Date(n.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: n.title,
    datePublished: n.date, description: n.dek, url: canonical, keywords: (n.tags || []).join(', '),
    author: { '@type': 'Person', name: 'Matthew Mesropian' },
    publisher: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.' }
  };
  return head({ title: `${n.title} — Integrated Software Technologies`, desc: n.dek, canonical, og: `${ROOT}/assets/og.png` }) +
    `<main class="subpage">
<a class="backlink" href="/#journal">← Journal</a>
<article class="prose"><h1>${esc(n.title)}</h1>
<div class="meta">${dt} · ${(n.tags || []).join(' · ')}</div>
${n.body}</article>
</main>
<script type="application/ld+json">${JSON.stringify(ld)}</script>` + foot;
}

/* -------------------------------------------------------------- press page */
function pressPage() {
  const canonical = `${ROOT}/press/`;
  const assets = [
    { n: 'App mark (512px)', img: '/assets/icon-512.png', dl: '/assets/icon-512.png' },
    { n: 'App mark (192px)', img: '/assets/icon-192.png', dl: '/assets/icon-192.png' },
    { n: 'Share card', img: '/assets/og.png', dl: '/assets/og.png' }
  ];
  const swatches = [['Violet', '#8b5cf6'], ['Cyan', '#22d3ee'], ['Pink', '#ec4899'], ['Emerald', '#34d399'], ['Ink', '#06070d']];
  return head({ title: 'Press kit — Integrated Software Technologies', desc: 'Brand assets, logos, colors, and boilerplate for Integrated Software Technologies.', canonical, og: `${ROOT}/assets/og.png` }) +
    `<main class="subpage">
<a class="backlink" href="/">← Home</a>
<article class="prose"><h1>Press kit</h1>
<div class="meta">Logos, colors, and boilerplate — free to use when writing about the studio or its apps.</div>
<p><b>Integrated Software Technologies Inc.</b> is a one-person iOS studio run by Matthew Mesropian in Glendale, CA. It designs and ships native, on-device apps — developer tools, network utilities, LiDAR measuring, and audio — with no accounts and no tracking.</p>
<p>Contact: <a href="mailto:matt@integratedsw.tech" style="color:var(--c2);font-weight:600">matt@integratedsw.tech</a> · (818) 671-9866</p>
</article>
<div class="pressgrid">
${assets.map(x => `<div class="asset"><img src="${x.img}" alt="${x.n}"><div class="an">${x.n}</div><a class="chip gh" href="${x.dl}" download>Download</a></div>`).join('')}
</div>
<div class="swatches">
${swatches.map(([n, c]) => `<span class="swatch"><i style="background:${c}"></i>${n} · ${c}</span>`).join('')}
</div>
</main>` + foot;
}

/* ---------------------------------------------------------------- 404 page */
function notFound() {
  return head({ title: 'Not found — Integrated Software Technologies', desc: 'That page does not exist.', canonical: `${ROOT}/404`, og: `${ROOT}/assets/og.png` }) +
    `<main class="subpage" style="text-align:center;padding-top:24vh">
<div class="prose" style="margin:0 auto"><h1>404</h1>
<div class="meta">That page wandered off-device.</div>
<p><a class="chip app" href="/" style="margin-top:6px">← Back home</a></p></div>
</main>` + foot;
}

/* ---------------------------------------------------- per-app OG images ---- */
function ogFor(a) {
  const iconPath = a.icon && path.join(dir, 'assets', 'icons', a.icon + '.png');
  let iconTag = '';
  if (iconPath && fs.existsSync(iconPath)) {
    const b64 = fs.readFileSync(iconPath).toString('base64');
    iconTag = `<image x="96" y="86" width="150" height="150" href="data:image/png;base64,${b64}"/>`;
  }
  const full = (a.desc || '');
  const desc = (full.length > 64 ? full.slice(0, 62).trimEnd() + '…' : full).replace(/&/g, '&amp;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.accent}"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
<radialGradient id="glow" cx="0.9" cy="0.05" r="0.8"><stop offset="0" stop-color="${a.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#06070d"/><rect width="1200" height="630" fill="url(#glow)"/>
${iconTag}
<text x="270" y="150" font-family="Helvetica Neue, Arial, sans-serif" font-size="30" font-weight="600" fill="#98a0b8" letter-spacing="2">${(a.cat || '').toUpperCase()}</text>
<text x="270" y="215" font-family="Helvetica Neue, Arial, sans-serif" font-size="66" font-weight="700" fill="#eaeefb">${esc(a.name)}</text>
<text x="96" y="360" font-family="Helvetica Neue, Arial, sans-serif" font-size="32" font-weight="500" fill="#cdd3e6">${esc(desc)}</text>
<rect x="96" y="470" width="${Math.min(560, 40 + a.name.length * 4)}" height="4" rx="2" fill="url(#g)"/>
<text x="96" y="545" font-family="Helvetica Neue, Arial, sans-serif" font-size="28" font-weight="700" fill="url(#g)">integratedsw.tech</text>
</svg>`;
  const tmp = path.join('/tmp', 'ist_og_' + a.slug + '.svg');
  fs.writeFileSync(tmp, svg);
  const outDir = path.join(dir, 'assets', 'og'); mkdir(outDir);
  const out = path.join(outDir, a.slug + '.png');
  try {
    execSync(`qlmanage -t -s 1200 -o /tmp "${tmp}" >/dev/null 2>&1`);
    fs.copyFileSync(path.join('/tmp', path.basename(tmp) + '.png'), out);
    execSync(`sips -c 630 1200 "${out}" >/dev/null 2>&1`);
    return true;
  } catch (e) { console.warn('  OG failed for', a.slug, e.message); return false; }
}

/* --------------------------------------------------------------- sitemap -- */
function sitemap() {
  const urls = [`${ROOT}/`, `${ROOT}/press/`,
    ...APPS.map(a => `${ROOT}/apps/${a.slug}/`),
    ...NOTES.map(n => `${ROOT}/notes/${n.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/* ------------------------------------------------------------------- main -- */
console.log('Generating…');
let n = 0;
APPS.forEach(a => { write(`apps/${a.slug}/index.html`, appPage(a)); ogFor(a); n++; });
console.log(`  ${n} app pages + OG images`);
NOTES.forEach(x => write(`notes/${x.slug}/index.html`, notePage(x)));
console.log(`  ${NOTES.length} note pages`);
write('press/index.html', pressPage());
write('404.html', notFound());
write('sitemap.xml', sitemap());
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ROOT}/sitemap.xml\n`);
console.log('  press, 404, sitemap.xml, robots.txt');
console.log('Done.');
