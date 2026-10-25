#!/usr/bin/env node
/* ============================================================================
   Integrated Software Technologies — static site generator
   Reads assets/apps.js and emits:
     apps/<slug>/index.html   per-app landing pages (+ live rating via iTunes)
     press/index.html         press kit
     assets/og/<slug>.png     per-app share cards (via qlmanage + sips)
     sitemap.xml, robots.txt, 404.html
   Run:  node build.js
   Homepage (index.html) is hand-maintained EXCEPT the app grid between the APPS markers (homeCards below).
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = 'https://integratedsw.tech';
const dir = __dirname;
const { APPS } = require('./assets/apps.js');
const today = new Date().toISOString().slice(0, 10);

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idOf = url => (String(url || '').match(/id(\d+)/) || [])[1];
const mkdir = p => fs.mkdirSync(p, { recursive: true });
/* Versioned asset URLs (2026-10-18). Every page links its CSS/JS as file?v=<content hash>,
   so a deploy that changes a file also changes its URL. The service worker answers static
   files from its cache first (stale-while-revalidate), and pages network-first; without
   versioned URLs the first load after a deploy paired the NEW page with the OLD stylesheet
   (the homepage icon wall rendered as raw full-size icons). Applied to every generated page,
   the homepage and the hand-maintained policy pages. */
const ASSETS = ['assets/studio.css', 'assets/page.css', 'assets/term.css', 'assets/studio.js', 'assets/term.js', 'assets/apps.js'];
const assetHash = {};
for (const a of ASSETS) assetHash[a] = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(dir, a))).digest('hex').slice(0, 10);
function stamp(html) {
  for (const a of ASSETS) {
    const re = new RegExp('(["\'(])(/?)' + a.replace(/\./g, '\\.') + '(\\?v=[0-9a-f]+)?(?=["\')])', 'g');
    html = html.replace(re, `$1$2${a}?v=${assetHash[a]}`);
  }
  return html;
}
const write = (rel, html) => { const f = path.join(dir, rel); mkdir(path.dirname(f)); fs.writeFileSync(f, /\.html$/.test(rel) ? stamp(html) : html); };

/* -------------------------------------------------------------- shared shell */
/* Every generated page wears the studio homepage's system (redesign 2026-10-17): studio.css +
   page.css, the same nav, hairline frame, section bars and footer, the ruler scrollbar
   (studio.js) and the terminal (term.js + term.css). Asset paths are absolute because
   404.html is served at any depth. */
/* The company logo (traced from the user's PNG on 2026-10-18 into straight-edged vector paths with its own
   gradients). It always sits on a white ground: its bar fades to black. */
const LOGO = '<svg viewBox="0 0 358.6 314.4" aria-hidden="true"><path fill="url(#isl0)" d="M0.0 0.0 L220.8 1.0 L182.9 49.4 L71.8 49.4 L111.6 134.4 L81.8 170.5 Z"/><path fill="url(#isl1)" d="M279.7 0.4 L334.0 0.4 L78.2 311.4 L26.2 311.4 Z"/><path fill="url(#isl2)" d="M275.9 142.4 L358.6 314.4 L134.3 314.4 L173.7 264.4 L284.9 264.4 L244.5 178.0 Z"/></svg>';
const LOGO_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="isl0" gradientUnits="userSpaceOnUse" x1="64.0" y1="128.0" x2="199.8" y2="10.3"><stop offset="0" stop-color="#d50303"/><stop offset="1" stop-color="#bb0000"/></linearGradient><linearGradient id="isl1" gradientUnits="userSpaceOnUse" x1="308.6" y1="8.3" x2="49.2" y2="302.7"><stop offset="0" stop-color="#7e0000"/><stop offset="1" stop-color="#070000"/></linearGradient><linearGradient id="isl2" gradientUnits="userSpaceOnUse" x1="293.2" y1="184.8" x2="155.0" y2="304.1"><stop offset="0" stop-color="#e40505"/><stop offset="1" stop-color="#fe0808"/></linearGradient></defs></svg>';
const pad2 = n => String(n).padStart(2, '0');
function head({ title, desc, canonical, og }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0b0b0c">
<meta property="og:type" content="website"><meta property="og:site_name" content="Integrated Software Technologies">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}"><meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:image" content="${og}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<link rel="preload" href="/assets/studio/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/studio.css"><link rel="stylesheet" href="/assets/page.css"><link rel="stylesheet" href="/assets/term.css">
</head><body>
${LOGO_DEFS}
<header class="nav"><a class="logo" href="/" aria-label="Integrated Software, home">${LOGO}</a>
  <nav class="links" aria-label="Site"><a href="/">Home</a><a href="/apps/">Apps</a><a href="/#tools">Open source</a><a href="/press/">Press</a></nav>
  <span class="sp"></span><a class="cta" href="/#contact">Get in touch</a></header>
<main id="main" class="sub"><div class="frame">
`;
}
const ODO = '<span class="odo"><span>' + Array.from({ length: 10 }, (_, d) => `<i>${d}</i>`).join('') + '</span></span>';
function foot() {
  return `
<footer><div class="foot">
  <div class="brand"><span class="plate">${LOGO}</span><p>Native iOS apps that run entirely on your device, made by a one-person studio.</p><span class="mono" style="font-size:11px;color:var(--faint)">matt@integratedsw.tech</span></div>
  <div><h4>Apps</h4><span style="display:grid;gap:10px"><a href="/apps/">All apps</a>${APPS.map(a => `<a href="/apps/${a.slug}/">${esc(a.name)}</a>`).join('')}</span></div>
  <div><h4>Open source</h4><a href="https://github.com/mathieeo/rateCheck" target="_blank" rel="noopener">rateCheck</a><a href="https://github.com/mathieeo/SoftCOM" target="_blank" rel="noopener">SoftCOM</a><a href="https://github.com/mathieeo/SerialFileCopy" target="_blank" rel="noopener">SerialFileCopy</a></div>
  <div><h4>Studio</h4><a href="/#contact">Contact</a><a href="/press/">Press kit</a><a href="/privacy/">Privacy</a></div>
</div>
<div class="legal"><span>© 2026 Integrated Software Technologies Inc.</span><span>Designed, coded and shipped solo</span></div></footer>
</div></main>
<div class="sbar" id="sbar" role="scrollbar" aria-controls="main" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Page position" tabindex="0">
  <div class="sb-frost"></div><div class="sb-tape" id="tape"></div><div class="sb-win" id="win"></div>
  <div class="sb-hov" id="hov"><span id="hovv">000%</span></div>
  <div class="sb-ind" id="ind"><span class="line"></span><span class="read" aria-hidden="true">${ODO}${ODO}${ODO}%</span></div>
</div>
<!-- The terminal rides along on every page: someone reading an app page is exactly the
     person who wants to poke at it. apps.js is the catalog term.js reads. -->
<script src="/assets/apps.js"></script>
<script src="/assets/term.js"></script>
<script src="/assets/studio.js"></script>
</body></html>`;
}

const svgApple = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M16 1c.1 1.2-.4 2.4-1.1 3.2-.8.9-2 1.6-3.2 1.5-.1-1.2.5-2.4 1.2-3.1C13.7 1.6 15 1 16 1zm3.6 16.4c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.6 3.8-4.5 3.8-1.7 0-2.1-1.1-4.4-1.1s-2.8 1.1-4.4 1.1c-1.9 0-3.3-1.9-4.4-3.6C-1 16.4-.4 9.9 3 8c1.3-.7 2.6-.6 3.7-.6 1.2 0 2 .7 3.4.7 1.3 0 2.1-.7 3.6-.7 1.1 0 2.3.1 3.4.9-3 1.6-2.5 5.9.5 7.1z"/></svg>';

/* --------------------------------------------------------------- app pages */
function appPage(a) {
  const i = APPS.indexOf(a), next = APPS[(i + 1) % APPS.length];
  const id = idOf(a.store);
  const canonical = `${ROOT}/apps/${a.slug}/`;
  const og = `${ROOT}/assets/og/${a.slug}.png`;
  // App Store facts are baked in at build time from the lookup above (no request to Apple
  // from the visitor's browser); every build refreshes them.
  const info = storeInfo[id], facts = [];
  if (info) {
    if (info.formattedPrice) facts.push(info.price === 0 ? 'Free' : info.formattedPrice);
    if (info.userRatingCount > 0) facts.push(`★ ${(info.averageUserRating || 0).toFixed(1)} (${info.userRatingCount})`);
    if (info.version) facts.push('Version ' + info.version);
    if (info.currentVersionReleaseDate) facts.push('Updated ' + new Date(info.currentVersionReleaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    if (info.fileSizeBytes) facts.push(Math.round(info.fileSizeBytes / 1048576) + ' MB');
    if (info.minimumOsVersion) facts.push('iOS ' + info.minimumOsVersion + '+');
  }
  const store = a.store
    ? `<a class="btn" href="${a.store}" target="_blank" rel="noopener">${svgApple.replace('<svg ', '<svg class="apple" ')}Download on the App Store</a>`
    : `<span class="btn ghost" aria-disabled="true">${a.status === 'soon' ? 'In development' : 'In review'}</span>`;
  const studioShot = n => fs.existsSync(path.join(dir, 'assets', 'studio', 'shots', `${a.key}-${n}.jpg`));
  const stage = a.key && studioShot(1)
    ? `<div class="stage">`
      + (studioShot(2) ? `<div class="shot s2"><img src="/assets/studio/shots/${a.key}-2.jpg" alt="" loading="lazy"></div>` : '')
      + `<div class="shot s1"><img src="/assets/studio/shots/${a.key}-1.jpg" alt="${esc(a.name)} screen"></div></div>`
    : `<div class="stage bare">${a.icon ? `<img class="big" src="/assets/icons/${a.icon}.png" alt="">` : ''}</div>`;
  const shots = a.key ? Array.from({ length: a.shots || 5 }, (_, k) => `${pad2(k + 1)}.png`)
    .filter(f => fs.existsSync(path.join(dir, 'assets', 'shots', a.key, f))) : [];
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: a.name,
    applicationCategory: 'MobileApplication', operatingSystem: 'iOS', description: a.desc,
    url: a.store || canonical, image: `${ROOT}/assets/icons/${a.icon}.png`,
    author: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.', url: ROOT }
  };
  // Price comes from the App Store, never from a hardcoded zero. When the price is not
  // known the offer is OMITTED: saying nothing is correct, saying "free" about a paid app is not.
  if (info && typeof info.price === 'number') {
    ld.offers = { '@type': 'Offer', price: String(info.price), priceCurrency: info.currency || 'USD' };
  }
  return head({ title: `${a.name} — ${a.cat} for iOS`, desc: a.desc, canonical, og }) + `
<section class="block" data-name="${esc(a.name)}" style="--c:${a.accent}">
  <div class="bar"><span><a href="/apps/">← All apps</a></span><span>${esc(a.cat)} · ${pad2(i + 1)} / ${pad2(APPS.length)}</span></div>
  <div class="ah">
    <div class="copy">
      ${a.icon ? `<img class="aicon" src="/assets/icons/${a.icon}.png" alt="${esc(a.name)} icon" width="84" height="84">` : ''}
      <h1>${esc(a.name)}</h1>
      <p class="tag">${esc(a.desc)}</p>
      ${facts.length ? `<p class="facts">${facts.map(f => `<span>${esc(f)}</span>`).join('<i>·</i>')}</p>` : ''}
      <div class="ctas">${store}<a class="btn ghost" href="/apps/${a.slug}/privacy/">Privacy policy</a></div>
    </div>
    ${stage}
  </div>
</section>
<section class="block" data-name="About">
  <div class="bar"><span>01 / <b>About</b></span><span>${esc(a.cat)}</span></div>
  <div class="intro"><h2>What <em class="s">${esc(a.name)}</em> does.</h2><p>${esc(a.long || a.desc)}</p></div>
</section>
${shots.length ? `<section class="block" data-name="Screens">
  <div class="bar"><span>02 / <b>Screens</b></span><span>${shots.length} from the App Store</span></div>
  <div class="strip">${shots.map((f, k) => `<figure><img src="/assets/shots/${a.key}/${f}" alt="${esc(a.name)} screenshot ${k + 1}" loading="lazy"><figcaption>${pad2(k + 1)}</figcaption></figure>`).join('')}</div>
</section>` : ''}
<section class="block" data-name="Next app">
  <a class="nextapp" href="/apps/${next.slug}/" style="--c:${next.accent}"><span class="k">Next app</span><span class="nn">${next.icon ? `<img src="/assets/icons/${next.icon}.png" alt="">` : ''}${esc(next.name)} →</span></a>
</section>
<script type="application/ld+json">${JSON.stringify(ld)}</script>` + foot();
}

const NUM_WORDS = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
function iconWall(root) {
  return APPS.map(a => `<a href="${root}apps/${a.slug}/" style="--c:${a.accent}">`
    + (a.icon ? `<img src="${root}assets/icons/${a.icon}.png" alt="" loading="lazy">` : '')
    + `<span>${esc(a.name)}</span></a>`).join('');
}

/* ------------------------------------------------------------ the apps page */
/* /apps/ (2026-10-18), on the model of the user's reference site: an icon-wall hero, the
   lineup (a ruled grid, one card per app linking to its page), principles, a contact prompt,
   and the ItemList rich result with the real prices from the App Store lookup. */
function appsIndex() {
  const canonical = `${ROOT}/apps/`, n = APPS.length, word = NUM_WORDS[n] || String(n);
  const dev = (storeResults || []).map(r => r.artistViewUrl).find(Boolean);
  const devUrl = dev ? dev.split('?')[0] : '';
  const cards = APPS.map((a, i) => {
    const info = storeInfo[String(idOf(a.store))], tags = [];
    if (info && info.formattedPrice) tags.push(`<span class="hot">${info.price === 0 ? 'Free' : esc(info.formattedPrice)}</span>`);
    else if (a.status === 'soon') tags.push('<span class="hot">In development</span>');
    tags.push('<span>iPhone</span>');
    if (info && info.minimumOsVersion) tags.push(`<span>iOS ${esc(String(info.minimumOsVersion).replace(/\.0$/, ''))}+</span>`);
    if (info && info.userRatingCount > 0) tags.push(`<span>★ ${(info.averageUserRating || 0).toFixed(1)}</span>`);
    const shot = a.key && fs.existsSync(path.join(dir, 'assets', 'studio', 'shots', `${a.key}-1.jpg`));
    return `<a class="lu" href="/apps/${a.slug}/" style="--c:${a.accent}">`
      + `<div class="hd"><span class="num">${pad2(i + 1)}</span><span>${esc(a.cat)}</span></div>`
      + `<div class="pic">${shot ? `<img src="/assets/studio/shots/${a.key}-1.jpg" alt="" loading="lazy">` : ''}</div>`
      + `<div class="tx">${a.icon ? `<img class="ic" src="/assets/icons/${a.icon}.png" alt="" loading="lazy">` : ''}`
      + `<h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p><div class="tags">${tags.join('')}</div>`
      + `<span class="go">Explore ${esc(a.name)} ↗</span></div></a>`;
  }).join('');
  const principles = [
    ['100% on-device', 'Your data never leaves your phone. The work happens on the iPhone in your hand.'],
    ['Native SwiftUI', 'Fast, fluid, and built for the latest iOS.'],
    ['Tools you own', "No subscriptions where they don't belong. Buy it once and it is yours."],
    ['No accounts, no trackers', 'Nothing to sign up for and nothing tracking you.'],
    ['Free tools on the side', 'The command-line tools from the workbench are open source on GitHub and pip.'],
    ['Made solo', 'Designed, coded and shipped by Matthew Mesropian.'],
  ];
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: APPS.filter(a => a.store).map((a, k) => {
    const info = storeInfo[String(idOf(a.store))];
    const item = { '@type': 'SoftwareApplication', name: a.name, applicationCategory: 'MobileApplication', operatingSystem: 'iOS',
      url: `${ROOT}/apps/${a.slug}/`, description: a.desc, author: { '@type': 'Organization', name: 'Integrated Software Technologies Inc.' } };
    if (info && typeof info.price === 'number') item.offers = { '@type': 'Offer', price: String(info.price), priceCurrency: info.currency || 'USD' };
    return { '@type': 'ListItem', position: k + 1, item };
  }) };
  return head({ title: `All apps — Integrated Software Technologies`,
                desc: `${word} native iOS apps that run entirely on your device: vibration analysis, network audits, SSH, LiDAR measuring, audio and everyday tools.`,
                canonical, og: `${ROOT}/assets/og.png` }) + `
<section class="block" data-name="Apps">
  <div class="bar"><span>01 / <b>The apps</b></span><span>${n} apps · iPhone · on-device</span></div>
  <div class="split">
    <div class="intro">
      <h1 class="h1sub">${word} apps. One <em class="s">studio.</em></h1>
      <p>Vibration analysis, network audits, SSH terminals, LiDAR measuring, audio and everyday tools. Native iOS apps that run entirely on your device, made by one person.</p>
      <div class="ctas"><a class="btn" href="#lineup">Browse the lineup</a>${devUrl ? `<a class="btn ghost" href="${devUrl}" target="_blank" rel="noopener">All on the App Store ↗</a>` : ''}</div>
      <p class="fine">iPhone · 100% on-device · no accounts · no trackers</p>
    </div>
    <div class="wallwrap"><div class="iconwall">${iconWall('/')}</div></div>
  </div>
</section>
<section class="block" id="lineup" data-name="Lineup">
  <div class="bar"><span>02 / <b>The lineup</b></span><span>Pick an app to explore</span></div>
  <div class="lineup">${cards}</div>
</section>
<section class="block" data-name="Principles">
  <div class="bar"><span>03 / <b>Principles</b></span><span>How every app is made</span></div>
  <div class="intro"><h2>Made the <em class="s">careful</em> way.</h2></div>
  <div class="tri tri6">${principles.map(([t, d], k) => `<div><span class="k">${'ABCDEF'[k]}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
</section>
<section class="block" data-name="Contact">
  <div class="close">
    <span class="k">No project too small</span>
    <h2>Need something <em class="s">built?</em></h2>
    <p>Beyond my own apps, I take on client work across IT, networking, web and software.</p>
    <div class="ctas"><a class="btn" href="/#contact">Hire the studio</a><a class="btn ghost" href="/">Back home</a></div>
  </div>
</section>
<script type="application/ld+json">${JSON.stringify(ld)}</script>` + foot();
}

/* ----------------------------------------------------------- privacy pages */
/* Every App Store listing needs a working privacy policy URL. One template, generated per
   app; apps with a third-party surface declare it via flags in apps.js (`ads:true` for
   AdMob, as in Spinnit). The two original hand-written pages (deck-privacy.html,
   spinnit-privacy.html) stay untouched so listings pointing at them keep working.
   POLICY_DATE is the date the policy TEXT last changed: bump it only when the wording
   does. (Builds used to stamp today's date, so every deploy claimed a policy update.) */
const POLICY_DATE = '2026-09-15';
function privacyPage(a) {
  const canonical = `${ROOT}/apps/${a.slug}/privacy/`;
  const ads = a.ads ? `
<h2>Advertising (Google AdMob)</h2>
<p>${esc(a.name)} is free and supported by ads served through <strong>Google AdMob</strong>.
To show ads, AdMob may collect information such as a device advertising identifier,
approximate location (derived from IP), and app-usage and interaction data, used to serve
and measure ads and to limit ad fraud.</p>
<ul>
  <li>The app does <strong>not</strong> track you and does not ask for permission to
      track. Ads are requested as non-personalized, so they are chosen without
      building a profile of you.</li>
  <li>Google's handling of this data is governed by the
      <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.</li>
  <li>The in-app <strong>Remove Ads</strong> purchase removes ads and stops ad-related
      data collection entirely.</li>
</ul>
<h2>Purchases</h2>
<p>Purchases are processed by Apple. We receive no payment details — Apple only tells the
app that the purchase succeeded.</p>` : '';
  const shortLine = a.ads
    ? `${esc(a.name)} has no accounts and we run no servers. Your data stays on your device.
       The only data collected comes from the Google AdMob ads that keep the app free —
       and you can remove ads to stop that entirely.`
    : `${esc(a.name)} collects nothing. It has no accounts, no analytics, and no
       third-party trackers. Everything happens on your device.`;
  return head({ title: `${a.name} — Privacy Policy`,
                desc: `Privacy policy for ${a.name} by Integrated Software Technologies.`,
                canonical, og: `${ROOT}/assets/og/${a.slug}.png` }) + `
<section class="block" data-name="Privacy" style="--c:${a.accent}">
  <div class="bar"><span><a href="/apps/${a.slug}/">← ${esc(a.name)}</a></span><span>Privacy policy · ${POLICY_DATE}</span></div>
  <div class="intro"><h1 class="h1sub">${esc(a.name)} <em class="s">privacy policy.</em></h1>
  <p><strong>Short version:</strong> ${shortLine}</p></div>
  <div class="prose">
<h2>What ${esc(a.name)} stores on your device</h2>
<p>Your content and settings are stored <strong>on your device</strong> (and, if you use
iCloud, in your own private iCloud account through Apple). We never receive this
information and operate no servers that could collect it.</p>
<h2>What we don't do</h2>
<ul>
  <li>We do <strong>not</strong> collect your name, email, contacts, or photos.</li>
  <li>We do <strong>not</strong> run analytics or third-party trackers${a.ads ? ' beyond the advertising described below' : ''}.</li>
  <li>We do <strong>not</strong> sell personal data.</li>
</ul>
<h2>Permissions</h2>
<p>If the app asks for a system permission (camera, local network, Face ID, photos…),
it is used only to power the feature in front of you, processed on-device, and never
transmitted to us.</p>
${ads}
<h2>Contact</h2>
<p>Questions? Email <a href="mailto:matt@integratedsw.tech">matt@integratedsw.tech</a>.</p>
<p class="dated">Last updated ${POLICY_DATE}.</p>
  </div>
</section>` + foot();
}

function privacyIndex() {
  const canonical = `${ROOT}/privacy/`;
  return head({ title: 'Privacy — Integrated Software Technologies',
                desc: 'Privacy policies for every Integrated Software Technologies app: no accounts, no analytics, on-device.',
                canonical, og: `${ROOT}/assets/og.png` }) + `
<section class="block" data-name="Privacy">
  <div class="bar"><span><a href="/">← Home</a></span><span>${APPS.length} apps · one policy each</span></div>
  <div class="intro"><h1 class="h1sub">Privacy, <em class="s">by design.</em></h1>
  <p>Every app we ship is built the same way: no accounts, no analytics, no
third-party trackers, everything on your device. Each app's policy:</p></div>
  <div class="plist">${APPS.map(a => `<a href="/apps/${a.slug}/privacy/" style="--c:${a.accent}">${a.icon ? `<img src="/assets/icons/${a.icon}.png" alt="">` : ''}<div><b>${esc(a.name)}</b><span>Privacy policy →</span></div></a>`).join('')}</div>
</section>` + foot();
}

/* -------------------------------------------------------------- press page */
function pressPage() {
  const canonical = `${ROOT}/press/`;
  const assets = [
    { n: 'App mark (512px)', img: '/assets/icon-512.png', dl: '/assets/icon-512.png' },
    { n: 'App mark (192px)', img: '/assets/icon-192.png', dl: '/assets/icon-192.png' },
    { n: 'Share card', img: '/assets/og.png', dl: '/assets/og.png' }
  ];
  const swatches = [['Black', '#0b0b0c'], ['White', '#f2f1ee'], ['Red', '#ff2b2b'], ['Logo red', '#e40505'], ['Logo deep', '#7e0000']];
  return head({ title: 'Press kit — Integrated Software Technologies', desc: 'Brand assets, logos, colors, and boilerplate for Integrated Software Technologies.', canonical, og: `${ROOT}/assets/og.png` }) + `
<section class="block" data-name="Press">
  <div class="bar"><span><a href="/">← Home</a></span><span>Press kit</span></div>
  <div class="intro"><h1 class="h1sub">Press <em class="s">kit.</em></h1><p>Logos, colors, and boilerplate, free to use when writing about the studio or its apps.</p></div>
  <div class="prose">
    <p><b>Integrated Software Technologies Inc.</b> is a one-person iOS studio run by Matthew Mesropian in Glendale, CA. It designs and ships native, on-device apps (developer tools, network utilities, LiDAR measuring, and audio) with no accounts and no tracking.</p>
    <p>Contact: <a href="mailto:matt@integratedsw.tech">matt@integratedsw.tech</a> · (818) 671-9866</p>
  </div>
  <div class="assets3">${assets.map(x => `<div><div class="pv"><img src="${x.img}" alt="${x.n}"></div><h3>${x.n}</h3><a class="btn ghost sm" href="${x.dl}" download>Download</a></div>`).join('')}</div>
  <div class="swatches">${swatches.map(([n, c]) => `<span><i style="background:${c}"></i>${n} · ${c}</span>`).join('')}</div>
</section>` + foot();
}

/* ---------------------------------------------------------------- 404 page */
function notFound() {
  return head({ title: 'Not found — Integrated Software Technologies', desc: 'That page does not exist.', canonical: `${ROOT}/404`, og: `${ROOT}/assets/og.png` }) + `
<section class="block" data-name="Not found">
  <div class="bar"><span>404</span><span>Page not found</span></div>
  <div class="lost"><span class="code" aria-hidden="true">404</span><h1 class="h1sub">That page <em class="s">wandered</em> off-device.</h1>
  <div class="ctas"><a class="btn" href="/">Back home</a><a class="btn ghost" href="/#apps">See the apps</a></div></div>
</section>` + foot();
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
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.accent}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<radialGradient id="glow" cx="0.9" cy="0.05" r="0.8"><stop offset="0" stop-color="${a.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#0b0b0c"/><rect width="1200" height="630" fill="url(#glow)"/>
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
  const urls = [`${ROOT}/`, `${ROOT}/apps/`, `${ROOT}/press/`, `${ROOT}/privacy/`,
    ...APPS.map(a => `${ROOT}/apps/${a.slug}/`),
    ...APPS.map(a => `${ROOT}/apps/${a.slug}/privacy/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/* -------------------------------------------------------- OG compression -- */
/* qlmanage emits ~370 KB truecolor PNGs of what is mostly flat gradient — and
   link-preview crawlers fetch these on every share. Palette-quantize with
   dithering via Pillow (~4-6x smaller, no visible banding on this art). Silent
   no-op if the Homebrew Python/Pillow pair isn't there. */
const PYTHON = '/opt/homebrew/opt/python@3.12/bin/python3.12';
function compressPNGs(files) {
  const existing = files.filter(f => fs.existsSync(f));
  if (!existing.length || !fs.existsSync(PYTHON)) return;
  const script = `
import sys
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p).convert("RGBA")
    q = im.quantize(colors=256, method=2, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(p, optimize=True)
`;
  const tmp = path.join('/tmp', 'ist_pngq.py');
  fs.writeFileSync(tmp, script);
  try {
    execSync(`"${PYTHON}" "${tmp}" ${existing.map(f => `"${f}"`).join(' ')}`,
             { stdio: 'ignore' });
    console.log(`  compressed ${existing.length} OG images`);
  } catch (e) { console.warn('  OG compression skipped:', e.message); }
}

/* ---------------------------------------------------------- store lookup -- */
/* One call to the App Store, made BEFORE the pages are generated, so the price
   in each page's structured data is the real one. The same results are reused
   for the ratings snapshot rather than asking Apple twice. Offline, this falls
   back to the snapshot written by the last successful build. */
let storeInfo = {};
let storeResults = null;

async function loadStoreInfo() {
  const ids = APPS.map(a => idOf(a.store)).filter(Boolean);
  if (!ids.length) return;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(',')}&country=us`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.results || !data.results.length) throw new Error('empty result');
    storeResults = data.results;
  } catch (e) {
    console.warn('  store lookup failed (' + e.message + ') - using the last snapshot');
    try {
      const previous = fs.readFileSync(path.join(dir, 'assets', 'ratings.js'), 'utf8');
      const json = previous.slice(previous.indexOf('{'), previous.lastIndexOf('}') + 1);
      storeResults = JSON.parse(json).results || null;
    } catch { storeResults = null; }
  }
  for (const r of storeResults || []) storeInfo[String(r.trackId)] = r;
}

/* ------------------------------------------------------- ratings snapshot -- */
/* Bake the App Store ratings into assets/ratings.js at build time. The browser
   still asks the live lookup API (and overwrites this), but if Apple retires
   that endpoint the way it retired the reviews feed, the site keeps showing
   the last-built numbers instead of silently showing none. Offline builds
   keep the previous snapshot. */
async function ratingsSnapshot() {
  const ids = APPS.map(a => idOf(a.store)).filter(Boolean);
  if (!ids.length) return;
  try {
    const data = { results: storeResults };
    if (!data.results || !data.results.length) throw new Error('empty result');
    write('assets/ratings.js',
      `/* Build-time App Store snapshot (${today}) — regenerated by build.js.\n`
      + `   Seeds the rating badges; the live lookup call overwrites it. */\n`
      + `window.__RATINGS_SNAPSHOT = ${JSON.stringify({ results: data.results })};\n`);
    console.log(`  ratings snapshot: ${data.results.length} apps`);
  } catch (e) {
    console.warn('  ratings snapshot skipped (' + e.message + ') — keeping the previous one');
    if (!fs.existsSync(path.join(dir, 'assets', 'ratings.js'))) {
      write('assets/ratings.js', 'window.__RATINGS_SNAPSHOT = null;\n');
    }
  }
}

/* ------------------------------------------------------------------- main -- */
(async () => {
console.log('Generating…');
await loadStoreInfo();
let n = 0;
APPS.forEach(a => { write(`apps/${a.slug}/index.html`, appPage(a)); ogFor(a); n++; });
console.log(`  ${n} app pages + OG images`);
APPS.forEach(a => write(`apps/${a.slug}/privacy/index.html`, privacyPage(a)));
write('privacy/index.html', privacyIndex());
write('apps/index.html', appsIndex());
console.log(`  ${n} privacy pages + /privacy/ hub`);
write('press/index.html', pressPage());
write('404.html', notFound());
write('sitemap.xml', sitemap());
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ROOT}/sitemap.xml\n`);
console.log('  press, 404, sitemap.xml, robots.txt');
// ---------------------------------------------------------------------------
// Server-render the homepage app grid.
//
// index.html is hand-maintained, so rather than generating the whole file we
// fill one marked region inside it. This matters more than it looks: the
// homepage used to ship with an EMPTY grid and let assets/app.js inject every
// card, which meant one throwing script or one hanging request left a visitor
// looking at a background and nothing else. Now the catalog is real HTML and
// JS only enhances it.
// ---------------------------------------------------------------------------
// The homepage's apps section is a teaser since 2026-10-18 (the full cards were "hard to
// read"): a wall of icons, each linking to its app page, beside a link to /apps/.
function homeCards() { return iconWall(''); }

{
  const idx = path.join(dir, 'index.html');
  const html = fs.readFileSync(idx, 'utf8');
  const re = /<!--APPS:START-->[\s\S]*?<!--APPS:END-->/;
  if (!re.test(html)) {
    console.log('  WARNING: index.html has no APPS markers, homepage grid NOT server-rendered');
  } else {
    fs.writeFileSync(idx, stamp(html.replace(re, '<!--APPS:START-->' + homeCards() + '<!--APPS:END-->')));
    // the hand-maintained policy pages are never generated, but their asset URLs are versioned too
    for (const rel of ['deck-privacy.html', 'spinnit-privacy.html', 'apps/kinetic-neuroscience/privacy/index.html']) {
      const f = path.join(dir, rel); if (!fs.existsSync(f)) continue;
      const before = fs.readFileSync(f, 'utf8'), after = stamp(before);
      if (after !== before) fs.writeFileSync(f, after);
    }
    console.log(`  homepage: ${APPS.length} app cards server-rendered into index.html`);
  }
}

compressPNGs([...APPS.map(a => path.join(dir, 'assets', 'og', a.slug + '.png')),
              path.join(dir, 'assets', 'og.png')]);
await ratingsSnapshot();
console.log('Done.');
})();
