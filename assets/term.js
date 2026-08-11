/* ============================================================================
   integratedsw.tech — the terminal
   ----------------------------------------------------------------------------
   Extracted out of enhance.js, where it had grown to 60% of the file, and then
   given the things that make a shell feel real rather than themed:

     · a filesystem you can cd around, mirroring the actual site
     · cat / curl that fetch the REAL bytes over the network, so `cat index.html`
       shows the page you are standing on, syntax highlighted
     · pipes, so `curl assets/style.css | grep accent | head -5` works
     · tab completion on commands AND paths
     · man pages, history, aliases

   Everything reads from the same APPS catalog the site does, so the terminal can
   never drift out of step with the pages around it.
   ========================================================================== */
(function () {
  'use strict';

  const apps = (typeof APPS !== 'undefined') ? APPS : [];
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let term, termBody, termInput, termPrompt;
  let cmdHist = [], histIdx = 0, cwd = '/home/guest';
  let keyTrap = null;                    // games install a key handler here
  const alias = { ll: 'ls -la', la: 'ls -a', '..': 'cd ..', cls: 'clear' };

  /* ------------------------------------------------------------ filesystem --
     A real path maps to a real URL, so `cat` can go and fetch it. Directories
     are plain objects; files carry the URL they live at plus a rough size for
     `ls -l`. Sizes are filled in for real after the first fetch. */
  const F = (url, size) => ({ type: 'f', url, size: size || 0 });
  const D = (children) => ({ type: 'd', children });

  function buildFS() {
    const appDirs = {};
    apps.filter(a => a.slug).forEach(a => {
      appDirs[a.slug] = D({
        'index.html': F(`/apps/${a.slug}/index.html`),
        privacy: D({ 'index.html': F(`/apps/${a.slug}/privacy/index.html`) })
      });
    });

    const shotDirs = {};
    apps.filter(a => a.key).forEach(a => {
      const files = {};
      for (let i = 1; i <= (a.shots || 5); i++) {
        files[String(i).padStart(2, '0') + '.png'] = F(`/assets/shots/${a.key}/${String(i).padStart(2, '0')}.png`);
      }
      shotDirs[a.key] = D(files);
    });

    const iconFiles = {};
    apps.filter(a => a.icon).forEach(a => {
      iconFiles[a.icon + '.png'] = F(`/assets/icons/${a.icon}.png`);
    });

    return D({
      home: D({
        guest: D({
          'README.md': F('/README.md'),
          '.bashrc': F('/.bashrc')
        })
      }),
      var: D({ www: D({ 'integratedsw.tech': null }) }),   // symlink, resolved below
      etc: D({ 'motd': F('/etc/motd') }),
      srv: D({
        'index.html': F('/index.html'),
        'manifest.webmanifest': F('/manifest.webmanifest'),
        'sitemap.xml': F('/sitemap.xml'),
        'robots.txt': F('/robots.txt'),
        'sw.js': F('/sw.js'),
        apps: D(appDirs),
        assets: D({
          'style.css': F('/assets/style.css'),
          'cinema.css': F('/assets/cinema.css'),
          'wow.css': F('/assets/wow.css'),
          'dazzle.css': F('/assets/dazzle.css'),
          'fonts.css': F('/assets/fonts.css'),
          'apps.js': F('/assets/apps.js'),
          'app.js': F('/assets/app.js'),
          'enhance.js': F('/assets/enhance.js'),
          'term.js': F('/assets/term.js'),
          'cinema.js': F('/assets/cinema.js'),
          'wow.js': F('/assets/wow.js'),
          'dazzle.js': F('/assets/dazzle.js'),
          'notes.js': F('/assets/notes.js'),
          'ratings.js': F('/assets/ratings.js'),
          icons: D(iconFiles),
          shots: D(shotDirs)
        })
      })
    });
  }

  let FS = null;
  // /home/guest and /var/www/... both land in the served tree, which is what a
  // real box would look like if you dropped a static site on it.
  function fsRoot() {
    if (!FS) {
      FS = buildFS();
      FS.children.var.children.www.children['integratedsw.tech'] = FS.children.srv;
      Object.assign(FS.children.home.children.guest.children, FS.children.srv.children);
    }
    return FS;
  }

  function normalize(p) {
    const abs = p.startsWith('/') ? p : cwd + '/' + p;
    const out = [];
    abs.split('/').forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') out.pop();
      else out.push(part);
    });
    return '/' + out.join('/');
  }

  function resolve(p) {
    const path = normalize(p);
    if (path === '/') return { node: fsRoot(), path: '/' };
    let node = fsRoot();
    for (const part of path.slice(1).split('/')) {
      if (!node || node.type !== 'd' || !node.children[part]) return null;
      node = node.children[part];
    }
    return { node, path };
  }

  const baseName = p => p.split('/').filter(Boolean).pop() || '/';

  /* ----------------------------------------------------------------- output */
  function print(html, cls) {
    const l = document.createElement('div');
    l.className = 'terml ' + (cls || '');
    l.innerHTML = html;
    termBody.appendChild(l);
    termBody.scrollTop = termBody.scrollHeight;
    return l;
  }
  const pre = (text, cls) => print('<span style="white-space:pre">' + text + '</span>', cls);

  /* ---------------------------------------------------- syntax highlighting */
  /* Single pass, with a replacer.
     The first version chained .replace() calls over already-escaped text, so a
     later rule happily matched the markup an earlier rule had just inserted:
     the string rule found the "t" inside <i class="t"> and wrapped it again,
     which is why source came out with class="t"> leaking as visible text. The
     only safe shape is to walk the ORIGINAL source once, escaping the gaps and
     emitting a span per token, so no output is ever re-scanned. */
  const escText = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const RX = {
    js: /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|for|while|new|class|await|async|try|catch|typeof|instanceof|of|in|this|null|true|false)\b|\b(\d+(?:\.\d+)?)\b/g,
    css: /(\/\*[\s\S]*?\*\/)|(--[\w-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8})\b|(\b\d+(?:\.\d+)?(?:px|em|rem|vw|vh|%|s|ms)?\b)/g,
    html: /(&lt;!--[\s\S]*?--&gt;|<!--[\s\S]*?-->)|(<\/?[\w-]+)|([\w-]+)=("[^"]*"|'[^']*')/g,
    md: /^(#{1,6} .*)$|(\*\*[^*]+\*\*)|(`[^`]+`)/gm
  };
  // token group index -> css class
  const CLS = {
    js:   { 1: 'c', 2: 't', 3: 'k', 4: 'n' },
    css:  { 1: 'c', 2: 'v', 3: 'n', 4: 'n' },
    html: { 1: 'c', 2: 'k', 3: 'v', 4: 't' },
    md:   { 1: 'k', 2: 's', 3: 't' }
  };

  function highlight(src, lang) {
    const rx = RX[lang], cls = CLS[lang];
    if (!rx) return escText(src);
    rx.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = rx.exec(src)) !== null) {
      if (m.index < last) { rx.lastIndex++; continue; }
      out += escText(src.slice(last, m.index));
      // html attributes come back as name + value across two groups
      if (lang === 'html' && m[3] !== undefined) {
        out += '<i class="v">' + escText(m[3]) + '</i>=<i class="t">' + escText(m[4]) + '</i>';
      } else {
        let g = 0;
        for (let i = 1; i < m.length; i++) if (m[i] !== undefined) { g = i; break; }
        out += g ? '<i class="' + (cls[g] || 'n') + '">' + escText(m[g]) + '</i>' : escText(m[0]);
      }
      last = rx.lastIndex;
      if (rx.lastIndex === m.index) rx.lastIndex++;   // never spin on an empty match
    }
    return out + escText(src.slice(last));
  }

  const langOf = p => {
    const e = (p.split('.').pop() || '').toLowerCase();
    return { css: 'css', js: 'js', html: 'html', htm: 'html', xml: 'xml', webmanifest: 'js',
             json: 'js', md: 'md', txt: 'txt' }[e] || 'txt';
  };

  /* ------------------------------------------------------------- fetch file */
  const fileCache = {};
  async function readFile(node, path) {
    if (fileCache[node.url] != null) return fileCache[node.url];
    if (/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(node.url)) {
      throw new Error(baseName(path) + ': binary file (try `open` or view it on the page)');
    }
    const r = await fetch(node.url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(baseName(path) + ': HTTP ' + r.status);
    const t = await r.text();
    fileCache[node.url] = t;
    node.size = t.length;
    return t;
  }

  /* --------------------------------------------- virtual files with content */
  const VIRTUAL = {
    '/README.md': () => [
      '# integratedsw.tech',
      '',
      'A one-person iOS studio. Native, on-device, no tracking.',
      '',
      '## What is here',
      '',
      '- `srv/`      the served site (also mounted at /var/www/integratedsw.tech)',
      '- `assets/`   css, js, icons and screenshots',
      '- `apps/`     one directory per shipped app',
      '',
      'Everything you can `cat` here is fetched live from the server. This is not',
      'a mock: `cat index.html` returns the bytes that built the page you are',
      'looking at right now.',
      '',
      'Try: `curl assets/style.css | grep accent`',
      ''
    ].join('\n'),
    '/.bashrc': () => [
      '# ~/.bashrc — loaded for interactive shells',
      '',
      'alias ll="ls -la"',
      'alias la="ls -a"',
      'alias cls="clear"',
      '',
      'export PS1="guest@integratedsw \\w $ "',
      'export EDITOR=vim   # obviously',
      ''
    ].join('\n'),
    '/etc/motd': () => [
      '  Welcome to integratedsw.tech',
      '',
      '  ' + apps.filter(a => a.status !== 'soon').length + ' apps shipped · 0 trackers · 0 accounts',
      '  Everything on this box runs in your browser. Nothing is sent anywhere.',
      '',
      '  Type `help` to get started, or `man <command>` for detail.',
      ''
    ].join('\n')
  };

  async function contentOf(node, path) {
    if (VIRTUAL[node.url]) return VIRTUAL[node.url]();
    return readFile(node, path);
  }

  /* ------------------------------------------------------------- man pages  */
  const MAN = {
    ls: 'ls [-l] [-a] [path]\n    List directory contents. -l long form with sizes, -a include dotfiles.',
    cd: 'cd [path]\n    Change directory. `cd` alone or `cd ~` goes home, `cd -` goes back.',
    cat: 'cat <file>\n    Print a file. Fetches the real file from the server and highlights it.',
    curl: 'curl <path|url>\n    Fetch a file and print it raw, with headers. Same source as cat, less dressing.',
    grep: 'grep <pattern> [file]\n    Print matching lines. Works on a pipe: cat x | grep y',
    head: 'head [-n N] [file]\n    First N lines (default 10).',
    tail: 'tail [-n N] [file]\n    Last N lines (default 10).',
    wc: 'wc [file]\n    Count lines, words and characters.',
    tree: 'tree [path]\n    Print the directory tree.',
    find: 'find [path] [-name pattern]\n    Walk the tree and print matching paths.',
    du: 'du [path]\n    Estimate size, largest last.',
    stat: 'stat <path>\n    Size, type and URL of a node.',
    open: 'open <app>\n    Open an app detail panel on the page. Try `ls apps` first.',
    'view-source': 'view-source [page]\n    The current page HTML, highlighted. Same as cat index.html.',
    man: 'man <command>\n    You are here.',
    history: 'history\n    Commands from this session.',
    echo: 'echo <text>\n    Print text. Supports pipes.',
    '2048': '2048\n    The tile game. Arrow keys or WASD. Esc to quit.',
    snake: 'snake\n    Arrow keys or WASD. Esc to quit.',
    figlet: 'figlet <text>\n    Big ASCII letters.',
    sl: 'sl\n    You typed it instead of ls. Enjoy the train.',
    typing: 'typing\n    A words-per-minute test. Type the sentence and press enter.'
  };

  /* ============================================================ the commands */
  const CMD = {};

  CMD.help = () => {
    print('<b>Files</b>    ls · cd · pwd · cat · curl · view-source · head · tail · grep · wc · tree · find · du · stat');
    print('<b>Site</b>     apps · open &lt;app&gt; · about · contact · sitemap · whoami · uname');
    print('<b>Fun</b>      2048 · snake · matrix · typing · figlet &lt;text&gt; · sl · cowsay &lt;msg&gt; · fortune · neofetch · coffee');
    print('<b>Shell</b>    man &lt;cmd&gt; · history · alias · echo · date · clear · exit');
    print('Pipes work: <span class="tapp">curl assets/style.css | grep accent | head -5</span>', 'muted');
    print('Tab completes commands and paths. Up/Down walks history.', 'muted');
  };

  CMD.pwd = () => print(cwd);

  let prevDir = '/home/guest';
  CMD.cd = (args) => {
    let t = args[0];
    if (!t || t === '~') t = '/home/guest';
    else if (t === '-') t = prevDir;
    const r = resolve(t);
    if (!r) return print('cd: ' + esc(t) + ': no such file or directory', 'err');
    if (r.node.type !== 'd') return print('cd: ' + esc(t) + ': not a directory', 'err');
    prevDir = cwd; cwd = r.path;
    updatePrompt();
  };

  CMD.ls = (args) => {
    const flags = args.filter(a => a.startsWith('-')).join('');
    const target = args.find(a => !a.startsWith('-')) || '.';
    const r = resolve(target);
    if (!r) return print('ls: ' + esc(target) + ': no such file or directory', 'err');
    if (r.node.type === 'f') return print(esc(baseName(r.path)));

    let names = Object.keys(r.node.children).sort();
    if (!flags.includes('a')) names = names.filter(n => !n.startsWith('.'));
    if (!names.length) return;

    if (flags.includes('l')) {
      const rows = names.map(n => {
        const c = r.node.children[n];
        const dir = c.type === 'd';
        const size = dir ? Object.keys(c.children).length + ' items' : (c.size ? human(c.size) : '-');
        const mode = dir ? 'drwxr-xr-x' : '-rw-r--r--';
        return `<span class="muted">${mode}</span>  ${String(size).padStart(9)}  ` +
               (dir ? `<b class="tdir">${esc(n)}/</b>` : `<span class="tfile">${esc(n)}</span>`);
      });
      return pre(rows.join('\n'));
    }
    const cols = names.map(n => r.node.children[n].type === 'd'
      ? `<b class="tdir">${esc(n)}/</b>` : `<span class="tfile">${esc(n)}</span>`);
    print(cols.join('   '));
  };

  const human = b => b > 1048576 ? (b / 1048576).toFixed(1) + 'M'
                  : b > 1024 ? (b / 1024).toFixed(1) + 'K' : b + 'B';

  CMD.tree = (args) => {
    const r = resolve(args[0] || '.');
    if (!r) return print('tree: no such directory', 'err');
    const lines = [baseName(r.path) + '/'];
    let dirs = 0, files = 0;
    (function walk(node, prefix, depth) {
      if (depth > 3) return;
      const names = Object.keys(node.children).filter(n => !n.startsWith('.')).sort();
      names.forEach((n, i) => {
        const last = i === names.length - 1;
        const c = node.children[n];
        lines.push(prefix + (last ? '└── ' : '├── ') +
          (c.type === 'd' ? `<b class="tdir">${esc(n)}/</b>` : esc(n)));
        if (c.type === 'd') { dirs++; walk(c, prefix + (last ? '    ' : '│   '), depth + 1); }
        else files++;
      });
    })(r.node, '', 0);
    pre(lines.join('\n'));
    print(`\n${dirs} directories, ${files} files`, 'muted');
  };

  CMD.find = (args) => {
    const start = args.find(a => !a.startsWith('-')) || '.';
    const ni = args.indexOf('-name');
    const pat = ni >= 0 ? args[ni + 1] : null;
    const rx = pat ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i') : null;
    const r = resolve(start);
    if (!r) return print('find: ' + esc(start) + ': no such path', 'err');
    const out = [];
    (function walk(node, path) {
      if (!rx || rx.test(baseName(path))) out.push(path);
      if (node.type === 'd') Object.keys(node.children).sort()
        .forEach(n => walk(node.children[n], path === '/' ? '/' + n : path + '/' + n));
    })(r.node, r.path);
    print(out.length ? out.map(esc).join('\n') : 'find: nothing matched', out.length ? '' : 'muted');
  };

  CMD.du = (args) => {
    const r = resolve(args[0] || '.');
    if (!r) return print('du: no such path', 'err');
    const rows = [];
    Object.keys(r.node.children || {}).forEach(n => {
      const c = r.node.children[n];
      let total = 0, count = 0;
      (function walk(x) {
        if (x.type === 'f') { total += x.size || 2048; count++; }
        else Object.values(x.children).forEach(walk);
      })(c);
      rows.push([total, `${human(total).padStart(7)}  ${n}${c.type === 'd' ? '/ (' + count + ' files)' : ''}`]);
    });
    rows.sort((a, b) => a[0] - b[0]);
    pre(rows.map(x => esc(x[1])).join('\n'));
  };

  CMD.stat = async (args) => {
    if (!args[0]) return print('usage: stat <path>', 'muted');
    const r = resolve(args[0]);
    if (!r) return print('stat: ' + esc(args[0]) + ': no such file or directory', 'err');
    const n = r.node;
    if (n.type === 'd') {
      pre([`  File: ${esc(r.path)}`, `  Type: directory`,
           `Entries: ${Object.keys(n.children).length}`].join('\n'));
    } else {
      let size = n.size;
      if (!size) { try { size = (await contentOf(n, r.path)).length; } catch (e) {} }
      pre([`  File: ${esc(r.path)}`, `  Type: regular file`,
           `  Size: ${size ? human(size) + ' (' + size + ' bytes)' : 'unknown'}`,
           `   URL: ${esc(n.url)}`].join('\n'));
    }
  };

  /* ------------------------------------------------------------ reading files */
  async function fileText(target) {
    const r = resolve(target);
    if (!r) throw new Error(target + ': no such file or directory');
    if (r.node.type === 'd') throw new Error(target + ': is a directory');
    return { text: await contentOf(r.node, r.path), path: r.path };
  }

  CMD.cat = async (args, _raw, stdin, piping) => {
    if (stdin != null && !args.length) {
      if (piping) return stdin;
      return pre(esc(stdin));
    }
    if (!args.length) return print('usage: cat <file>', 'muted');
    try {
      const { text, path } = await fileText(args[0]);
      // Mid-pipeline, cat is a source: hand the bytes on rather than painting
      // the whole file into the scrollback before grep has even seen it.
      if (piping) return text;
      printSource(text, langOf(path));
    } catch (e) { print('cat: ' + esc(e.message), 'err'); }
  };

  function printSource(text, lang) {
    const lines = text.replace(/\s+$/, '').split('\n');
    const width = String(lines.length).length;
    const body = lines.map((l, i) =>
      `<span class="tln">${String(i + 1).padStart(width)}</span>  ${highlight(l, lang)}`).join('\n');
    const wrap = document.createElement('div');
    wrap.className = 'terml tsrc';
    wrap.innerHTML = `<span style="white-space:pre">${body}</span>`;
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
  }

  CMD.curl = async (args, _raw, _stdin, piping) => {
    const t = args.find(a => !a.startsWith('-'));
    if (!t) return print('usage: curl <path>', 'muted');
    try {
      const { text, path } = await fileText(t);
      if (piping) return text;          // same reasoning as cat
      print(`<span class="ok">HTTP/2 200</span>  <span class="muted">${esc(path)} · ${human(text.length)}</span>`);
      printSource(text, langOf(path));
    } catch (e) { print('curl: ' + esc(e.message), 'err'); }
  };

  CMD['view-source'] = async () => {
    try {
      const r = await fetch(location.pathname, { cache: 'no-cache' });
      const t = await r.text();
      print(`<span class="ok">${esc(location.pathname)}</span> <span class="muted">· ${human(t.length)} · this is the page you are on</span>`);
      printSource(t, 'html');
    } catch (e) { print('view-source: ' + esc(e.message), 'err'); }
  };

  /* --------------------------------------------------------------- text tools */
  async function stdinOr(args, stdin) {
    if (stdin != null) return stdin;
    const f = args.find(a => !a.startsWith('-'));
    if (!f) throw new Error('no input — give a file or pipe something in');
    return (await fileText(f)).text;
  }

  CMD.grep = async (args, _raw, stdin, piping) => {
    const pat = args.find(a => !a.startsWith('-'));
    if (!pat) return print('usage: grep <pattern> [file]', 'muted');
    try {
      const rest = args.filter(a => a !== pat);
      const text = await stdinOr(rest, stdin);
      const ci = args.includes('-i');
      let rx; try { rx = new RegExp(pat, ci ? 'i' : ''); }
      catch (e) { rx = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'i' : ''); }
      const hits = text.split('\n').map((l, i) => [i + 1, l]).filter(x => rx.test(x[1]));
      if (!hits.length) { if (!piping) print('grep: no match', 'muted'); return ''; }
      if (piping) return hits.map(x => x[1]).join('\n');
      pre(hits.slice(0, 200).map(([n, l]) =>
        `<span class="tln">${String(n).padStart(4)}</span>  ` +
        esc(l.trim()).replace(new RegExp(rx.source, rx.flags + 'g'), m => `<b class="thit">${m}</b>`)
      ).join('\n'));
      if (hits.length > 200) print(`… ${hits.length - 200} more`, 'muted');
      return hits.map(x => x[1]).join('\n');
    } catch (e) { print('grep: ' + esc(e.message), 'err'); }
  };

  const nArg = (args, d) => {
    const i = args.indexOf('-n');
    return i >= 0 ? parseInt(args[i + 1], 10) || d : d;
  };

  CMD.head = async (args, _raw, stdin, piping) => {
    try {
      const n = nArg(args, 10);
      const text = await stdinOr(args.filter((a, i) => a !== '-n' && args[i - 1] !== '-n'), stdin);
      const out = text.split('\n').slice(0, n).join('\n');
      if (!piping) pre(esc(out));
      return out;
    } catch (e) { print('head: ' + esc(e.message), 'err'); }
  };

  CMD.tail = async (args, _raw, stdin, piping) => {
    try {
      const n = nArg(args, 10);
      const text = await stdinOr(args.filter((a, i) => a !== '-n' && args[i - 1] !== '-n'), stdin);
      const out = text.split('\n').slice(-n).join('\n');
      if (!piping) pre(esc(out));
      return out;
    } catch (e) { print('tail: ' + esc(e.message), 'err'); }
  };

  CMD.wc = async (args, _raw, stdin) => {
    try {
      const text = await stdinOr(args, stdin);
      const lines = text.split('\n').length;
      const words = (text.match(/\S+/g) || []).length;
      pre(`${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(text.length).padStart(8)}`);
    } catch (e) { print('wc: ' + esc(e.message), 'err'); }
  };

  CMD.echo = (args, raw, stdin) => {
    const out = stdin != null && !raw ? stdin : raw;
    print(esc(out) || '&nbsp;');
    return out;
  };

  /* ------------------------------------------------------------------- site */
  const findApp = q => {
    q = (q || '').replace(/\s/g, '').toLowerCase();
    return apps.find(a => a.name.toLowerCase().replace(/\s/g, '') === q ||
                          (a.key || '').toLowerCase() === q ||
                          (a.slug || '').toLowerCase() === q);
  };

  CMD.apps = () => {
    const rows = apps.map(a => {
      const state = a.store ? '<span class="ok">shipped</span>'
        : a.status === 'soon' ? '<span class="muted">in development</span>'
        : '<span class="tapp">in review</span>';
      return `  <b class="tapp">${esc(a.name.replace(/\s/g, ''))}</b>`.padEnd(34) +
             `${esc(a.cat).padEnd(20)} ${state}`;
    });
    pre(rows.join('\n'));
    print(`\n${apps.length} apps. Try <b>cat</b> apps/rotor/index.html or <b>open</b> rotor`, 'muted');
  };

  CMD.open = (args) => {
    const a = findApp(args[0]);
    if (!a) return print('open: no such app: ' + esc(args[0] || '(none)') + ' — try <b>apps</b>', 'err');
    const i = apps.indexOf(a);
    print('opening ' + esc(a.name) + '…', 'ok');
    setTimeout(() => { closeTerm(); (window.openApp || function () {})(i); }, 320);
  };

  CMD.sitemap = () => {
    const rows = apps.filter(a => a.slug).map(a => `  /apps/${a.slug}/`);
    pre(['  /', '  /privacy/', '  /press/'].concat(rows).join('\n'));
  };

  CMD.about = () => print('Integrated Software Technologies Inc. — a one-person iOS studio. Native, on-device, no tracking. Built by Matthew Mesropian in Glendale, CA.');
  CMD.contact = () => print('matt@integratedsw.tech · (818) 671-9866');
  CMD.whoami = () => print('guest — but you clearly know your way around a keyboard.');
  CMD.uname = (args) => print(args.includes('-a')
    ? 'integratedsw.tech 5.0-browser JS engine · static site · 0 trackers · x86_64 GNU/Coffee'
    : 'integratedsw.tech');
  CMD.date = () => print(new Date().toString());
  CMD.history = () => print(cmdHist.length
    ? cmdHist.map((c, i) => `  ${String(i + 1).padStart(3)}  ${esc(c)}`).join('\n')
    : 'no history yet.', 'muted');
  CMD.alias = () => pre(Object.keys(alias).map(k => `alias ${k}='${alias[k]}'`).join('\n'));

  CMD.man = (args) => {
    const c = args[0];
    if (!c) return print('What manual page do you want? Try <b>man ls</b>.', 'muted');
    if (!MAN[c]) return print('No manual entry for ' + esc(c), 'err');
    pre(`<b class="tapp">${esc(c.toUpperCase())}(1)</b>\n\n` + esc(MAN[c]));
  };

  CMD.sudo = (args, raw) => {
    if (/\brm\b.*-.*r/.test(raw)) return print('rm: permission denied — and honestly, you will thank me later. 😌', 'err');
    print('Nice try. You already have root — this is your browser. 😎', 'ok');
  };

  CMD.clear = () => { termBody.innerHTML = ''; };
  CMD.exit = () => closeTerm();
  CMD[''] = () => {};

  /* ------------------------------------------------------------------- toys */
  const FORTUNES = [
    'A deadline is just a hypothesis with a date attached.',
    'The bug is in the last place you look, because you stop looking.',
    'On-device is not a feature. It is the absence of a liability.',
    'Ship it. The perfect version is a rumour.',
    'Every framework is someone else’s opinion, compiled.',
    'If the demo needs an internet connection, it is not a demo of your app.'
  ];
  CMD.fortune = () => print('🥠 ' + esc(FORTUNES[(Math.random() * FORTUNES.length) | 0]));

  CMD.cowsay = (args, raw) => {
    const text = (raw || 'moo').replace(/\s+/g, ' ').trim().slice(0, 120);
    const bar = ' ' + '_'.repeat(text.length + 2);
    const bot = ' ' + '-'.repeat(text.length + 2);
    pre([bar, `&lt; ${esc(text)} &gt;`, bot,
      '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\',
      '                ||----w |', '                ||     ||'].join('\n'));
  };

  CMD.coffee = () => pre(['      ) )', '     ( (', '    ........', '    |      |]', '    \\      /',
    "     `----'", '', 'brewing… ☕ on-device, of course.'].join('\n'), 'ok');

  CMD.neofetch = () => {
    const live = apps.filter(a => a.status !== 'soon').length;
    const logo = ['╔════════╗', '║   ▄▄   ║', '║        ║', '║   ██   ║', '║   ██   ║', '║   ██   ║', '╚════════╝'].join('\n');
    const info = [
      ['host', 'integratedsw.tech'], ['studio', 'Integrated Software Technologies'],
      ['founder', 'Matthew Mesropian'], ['location', 'Glendale, CA'],
      ['apps', live + ' shipped, ' + apps.length + ' total'],
      ['stack', 'Swift · SwiftUI · C++ · Python'],
      ['shell', 'term.js — try `man ls`'],
      ['privacy', 'on-device · 0 trackers'], ['uptime', 'since 2024']
    ].map(([k, v]) => `<b class="tapp">${k}</b>  ${esc(v)}`).join('\n');
    print('<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">'
      + `<div style="color:#33e6d1;white-space:pre;line-height:1.15">${logo}</div>`
      + `<div style="white-space:pre;line-height:1.5">${info}</div></div>`);
  };

  /* ---------------------------------------------------------------- figlet */
  // A compact 5-row block font. Enough for a banner without shipping a font file.
  const FIG = {
    A: [' ██ ', '█  █', '████', '█  █', '█  █'], B: ['███ ', '█  █', '███ ', '█  █', '███ '],
    C: [' ███', '█   ', '█   ', '█   ', ' ███'], D: ['███ ', '█  █', '█  █', '█  █', '███ '],
    E: ['████', '█   ', '███ ', '█   ', '████'], F: ['████', '█   ', '███ ', '█   ', '█   '],
    G: [' ███', '█   ', '█ ██', '█  █', ' ███'], H: ['█  █', '█  █', '████', '█  █', '█  █'],
    I: ['███', ' █ ', ' █ ', ' █ ', '███'],      J: ['  ██', '   █', '   █', '█  █', ' ██ '],
    K: ['█  █', '█ █ ', '██  ', '█ █ ', '█  █'], L: ['█   ', '█   ', '█   ', '█   ', '████'],
    M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'], N: ['█  █', '██ █', '█ ██', '█  █', '█  █'],
    O: [' ██ ', '█  █', '█  █', '█  █', ' ██ '], P: ['███ ', '█  █', '███ ', '█   ', '█   '],
    Q: [' ██ ', '█  █', '█  █', '█ ██', ' ███'], R: ['███ ', '█  █', '███ ', '█ █ ', '█  █'],
    S: [' ███', '█   ', ' ██ ', '   █', '███ '], T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
    U: ['█  █', '█  █', '█  █', '█  █', ' ██ '], V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
    W: ['█   █', '█   █', '█ █ █', '██ ██', '█   █'], X: ['█  █', ' ██ ', ' ██ ', ' ██ ', '█  █'],
    Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '], Z: ['████', '   █', ' ██ ', '█   ', '████'],
    '0': [' ██ ', '█  █', '█  █', '█  █', ' ██ '], '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
    '2': ['███ ', '   █', ' ██ ', '█   ', '████'], '3': ['███ ', '   █', ' ██ ', '   █', '███ '],
    '4': ['█  █', '█  █', '████', '   █', '   █'], '5': ['████', '█   ', '███ ', '   █', '███ '],
    '6': [' ██ ', '█   ', '███ ', '█  █', ' ██ '], '7': ['████', '   █', '  █ ', ' █  ', ' █  '],
    '8': [' ██ ', '█  █', ' ██ ', '█  █', ' ██ '], '9': [' ██ ', '█  █', ' ███', '   █', ' ██ '],
    ' ': ['  ', '  ', '  ', '  ', '  '], '!': ['█', '█', '█', ' ', '█'], '.': [' ', ' ', ' ', ' ', '█'],
    '-': ['    ', '    ', '████', '    ', '    ']
  };
  CMD.figlet = (args, raw) => {
    const text = (raw || 'hello').toUpperCase().slice(0, 14);
    const rows = ['', '', '', '', ''];
    for (const ch of text) {
      const g = FIG[ch] || FIG[' '];
      for (let i = 0; i < 5; i++) rows[i] += g[i] + ' ';
    }
    pre(rows.map(esc).join('\n'), 'ok');
  };

  /* ------------------------------------------------------------------- sl */
  CMD.sl = () => {
    const train = [
      '      ====        ________                ___________',
      '  _D _|  |_______/        \\__I_I_____===__|_________|',
      '   |(_)---  |   H\\________/ |   |        =|___ ___|  ',
      '   /     |  |   H  |  |     |   |         ||_| |_||  ',
      '  |      |  |   H  |__--------------------| [___] |  ',
      '  | ________|___H__/__|_____/[][]~\\_______|       |  ',
      '  |/ |   |-----------I_____I [][] []  D   |=======|__'
    ];
    const wrap = document.createElement('div');
    wrap.className = 'terml';
    wrap.innerHTML = '<span style="white-space:pre;color:#33e6d1"></span>';
    const span = wrap.firstChild;
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
    let pos = 46;
    const t = setInterval(() => {
      span.textContent = train.map(l => ' '.repeat(Math.max(0, pos)) + l).join('\n');
      if (--pos < -56) { clearInterval(t); span.textContent = train.join('\n'); print('you meant `ls`. 🚂', 'muted'); }
    }, 42);
  };

  /* ---------------------------------------------------------- typing test */
  CMD.typing = () => {
    const SENTENCES = [
      'the quick brown fox jumps over the lazy dog',
      'native apps run on device and ask no permission from a server',
      'a spectrum is a picture but the diagnosis is the product',
      'ship it because the perfect version is a rumour'
    ];
    const s = SENTENCES[(Math.random() * SENTENCES.length) | 0];
    print('Type this, then press <b>enter</b>:', 'muted');
    print('<span class="ttarget">' + esc(s) + '</span>');
    const started = Date.now();
    keyTrap = {
      submit(line) {
        keyTrap = null;
        const secs = (Date.now() - started) / 1000;
        const words = s.split(' ').length;
        const wpm = Math.round(words / (secs / 60));
        let right = 0;
        for (let i = 0; i < Math.min(line.length, s.length); i++) if (line[i] === s[i]) right++;
        const acc = Math.round(right / s.length * 100);
        print(`<b>${wpm} wpm</b> · ${acc}% accurate · ${secs.toFixed(1)}s`,
          acc > 92 ? 'ok' : acc > 75 ? '' : 'err');
        if (acc === 100 && wpm > 70) print('That is genuinely quick. 🏁', 'ok');
      }
    };
  };

  /* --------------------------------------------------------------- 2048 -- */
  CMD['2048'] = () => {
    let g = Array.from({ length: 4 }, () => [0, 0, 0, 0]), score = 0;
    const add = () => {
      const free = [];
      g.forEach((r, y) => r.forEach((v, x) => { if (!v) free.push([x, y]); }));
      if (!free.length) return;
      const [x, y] = free[(Math.random() * free.length) | 0];
      g[y][x] = Math.random() < 0.9 ? 2 : 4;
    };
    add(); add();

    const wrap = document.createElement('div');
    wrap.className = 'terml gwrap';
    wrap.innerHTML = '<div class="g2048"></div><div class="snakehud">arrows or WASD · <b>esc</b> to quit · score <span class="snakescore">0</span></div>';
    termBody.appendChild(wrap);
    const board = wrap.querySelector('.g2048'), hud = wrap.querySelector('.snakescore');
    const draw = () => {
      board.innerHTML = g.map(r => r.map(v =>
        `<i class="t2 v${v}">${v || ''}</i>`).join('')).join('');
      hud.textContent = score;
    };
    draw();
    termBody.scrollTop = termBody.scrollHeight;

    const slide = row => {
      const a = row.filter(Boolean);
      for (let i = 0; i < a.length - 1; i++) {
        if (a[i] === a[i + 1]) { a[i] *= 2; score += a[i]; a.splice(i + 1, 1); }
      }
      while (a.length < 4) a.push(0);
      return a;
    };
    const rot = m => m[0].map((_, i) => m.map(r => r[i]).reverse());

    keyTrap = {
      key(e) {
        const k = e.key.toLowerCase();
        let n = 0;
        if (k === 'escape') { keyTrap = null; print('2048: final score ' + score, 'muted'); return true; }
        if (k === 'arrowleft' || k === 'a') n = 0;
        else if (k === 'arrowup' || k === 'w') n = 1;
        else if (k === 'arrowright' || k === 'd') n = 2;
        else if (k === 'arrowdown' || k === 's') n = 3;
        else return false;
        const before = JSON.stringify(g);
        for (let i = 0; i < n; i++) g = rot(g);
        g = g.map(slide);
        for (let i = n; i < 4; i++) g = rot(g);
        if (JSON.stringify(g) !== before) { add(); draw(); }
        if (g.some(r => r.some(v => v === 2048))) { keyTrap = null; print('2048 reached. 🎉 score ' + score, 'ok'); }
        return true;
      }
    };
  };

  /* -------------------------------------------------------------- matrix -- */
  CMD.matrix = () => {
    const wrap = document.createElement('div');
    wrap.className = 'terml mtxwrap';
    wrap.innerHTML = '<canvas class="mtxcv" width="560" height="200"></canvas><div class="snakehud">decoding the mainframe… (esc)</div>';
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
    const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
    const cols = Math.floor(cv.width / 11), drops = Array(cols).fill(0);
    const glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEF';
    let frames = 0;
    const t = setInterval(() => {
      ctx.fillStyle = 'rgba(6,7,13,.16)'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < 0.06 ? '#c9fff2' : '#33e6d1';
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * 11, y * 14);
        drops[i] = (y * 14 > cv.height && Math.random() > 0.975) ? 0 : y + 1;
      });
      if (++frames > 260) { clearInterval(t); }
    }, 45);
    keyTrap = { key(e) { if (e.key === 'Escape') { clearInterval(t); keyTrap = null; return true; } return false; } };
  };

  /* --------------------------------------------------------------- snake -- */
  CMD.snake = () => {
    const W = 26, H = 14, CELL = 14;
    let snake = [[6, 7], [5, 7], [4, 7]], dir = [1, 0], food = [16, 7], score = 0, dead = false;
    const wrap = document.createElement('div');
    wrap.className = 'terml snakewrap';
    wrap.innerHTML = `<canvas class="snakecv" width="${W * CELL}" height="${H * CELL}"></canvas>` +
      '<div class="snakehud">arrows or WASD · <b>esc</b> to quit · score <span class="snakescore">0</span></div>';
    termBody.appendChild(wrap);
    termBody.scrollTop = termBody.scrollHeight;
    const ctx = wrap.querySelector('canvas').getContext('2d');
    const hud = wrap.querySelector('.snakescore');

    const t = setInterval(step, 110);
    function step() {
      const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (head[0] < 0 || head[1] < 0 || head[0] >= W || head[1] >= H ||
          snake.some(s => s[0] === head[0] && s[1] === head[1])) return end();
      snake.unshift(head);
      if (head[0] === food[0] && head[1] === food[1]) {
        score += 10; hud.textContent = score;
        do { food = [(Math.random() * W) | 0, (Math.random() * H) | 0]; }
        while (snake.some(s => s[0] === food[0] && s[1] === food[1]));
      } else snake.pop();
      draw();
    }
    function draw() {
      ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W * CELL, H * CELL);
      ctx.fillStyle = '#fab84d';
      ctx.fillRect(food[0] * CELL + 3, food[1] * CELL + 3, CELL - 6, CELL - 6);
      snake.forEach((s, i) => {
        ctx.fillStyle = i ? '#1f9e8c' : '#33e6d1';
        ctx.fillRect(s[0] * CELL + 1, s[1] * CELL + 1, CELL - 2, CELL - 2);
      });
    }
    function end() {
      if (dead) return; dead = true; clearInterval(t); keyTrap = null;
      print('game over · score ' + score, 'err');
    }
    draw();
    keyTrap = {
      key(e) {
        const k = e.key.toLowerCase();
        const map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
                      arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
        if (k === 'escape') { clearInterval(t); keyTrap = null; print('snake: score ' + score, 'muted'); return true; }
        const nd = map[k];
        if (!nd) return false;
        if (nd[0] !== -dir[0] || nd[1] !== -dir[1]) dir = nd;
        return true;
      }
    };
  };

  /* ======================================================== the shell itself */
  async function runPipeline(line) {
    const stages = line.split('|').map(s => s.trim()).filter(Boolean);
    let stdin = null;
    for (let i = 0; i < stages.length; i++) {
      const isLast = i === stages.length - 1;
      let stage = stages[i];
      // aliases only expand at the head of a stage, like a real shell
      const head = stage.split(/\s+/)[0];
      if (alias[head]) stage = alias[head] + stage.slice(head.length);
      const parts = stage.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      const raw = args.join(' ');
      if (!(cmd in CMD)) { print('command not found: ' + esc(cmd) + ' — try <b>help</b>', 'err'); return; }
      // Non-final stages capture instead of printing where the command supports it.
      const out = await CMD[cmd](args, raw, stdin, !isLast);
      stdin = (typeof out === 'string') ? out : null;
    }
  }

  async function runTerm(raw) {
    const line = raw.trim();
    print(`<span class="termps">${esc(promptText())}</span> ${esc(line)}`, 'echo');
    if (line && cmdHist[cmdHist.length - 1] !== line) cmdHist.push(line);
    histIdx = cmdHist.length;
    if (!line) return;
    if (keyTrap && keyTrap.submit) { keyTrap.submit(line); return; }
    try { await runPipeline(line); }
    catch (e) { print('error: ' + esc(e.message), 'err'); }
  }

  /* ------------------------------------------------------- tab completion */
  function complete(value) {
    const stage = value.split('|').pop().replace(/^\s+/, '');
    const parts = stage.split(/\s+/);
    const isCmd = parts.length === 1;
    const frag = parts[parts.length - 1] || '';

    let pool;
    if (isCmd) {
      pool = Object.keys(CMD).concat(Object.keys(alias)).filter(Boolean);
    } else {
      const slash = frag.lastIndexOf('/');
      const dir = slash >= 0 ? frag.slice(0, slash + 1) : '';
      const stem = slash >= 0 ? frag.slice(slash + 1) : frag;
      const r = resolve(dir || '.');
      if (!r || r.node.type !== 'd') return null;
      pool = Object.keys(r.node.children)
        .filter(n => n.startsWith(stem))
        .map(n => dir + n + (r.node.children[n].type === 'd' ? '/' : ''));
      if (pool.length === 1) return value.slice(0, value.length - frag.length) + pool[0];
      if (pool.length > 1) { print(pool.map(esc).join('   '), 'muted'); return null; }
      return null;
    }
    const hits = pool.filter(c => c.startsWith(frag));
    if (hits.length === 1) return value.slice(0, value.length - frag.length) + hits[0] + ' ';
    if (hits.length > 1) print(hits.map(esc).join('   '), 'muted');
    return null;
  }

  /* ------------------------------------------------------------------- UI  */
  const promptText = () => {
    const short = cwd === '/home/guest' ? '~' : cwd.replace('/home/guest', '~');
    return `guest@integratedsw ${short} $`;
  };
  function updatePrompt() { if (termPrompt) termPrompt.textContent = promptText(); }

  function buildTerm() {
    term = document.createElement('div');
    term.id = 'term';
    term.innerHTML =
      '<div class="termwin" role="dialog" aria-modal="true" aria-label="Terminal">' +
        '<div class="termbar"><span class="tdot r"></span><span class="tdot y"></span><span class="tdot g"></span>' +
          '<span class="termtitle">guest@integratedsw.tech — bash</span>' +
          '<button class="termx" aria-label="Close terminal">✕</button></div>' +
        '<div class="termbody"></div>' +
        '<div class="termline"><span class="termps"></span><input autocomplete="off" autocapitalize="off" ' +
          'autocorrect="off" spellcheck="false" aria-label="Terminal input"></div>' +
      '</div>';
    document.body.appendChild(term);
    termBody = term.querySelector('.termbody');
    termInput = term.querySelector('input');
    termPrompt = term.querySelector('.termline .termps');
    updatePrompt();

    term.querySelector('.termx').onclick = closeTerm;
    term.addEventListener('mousedown', e => { if (e.target === term) closeTerm(); });
    termBody.addEventListener('click', () => termInput.focus());

    termInput.addEventListener('keydown', e => {
      if (keyTrap && keyTrap.key && keyTrap.key(e)) { e.preventDefault(); return; }
      if (e.key === 'Enter') {
        const v = termInput.value; termInput.value = ''; runTerm(v);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const done = complete(termInput.value);
        if (done != null) termInput.value = done;
      } else if (e.key === 'ArrowUp' && !keyTrap) {
        e.preventDefault();
        if (histIdx > 0) termInput.value = cmdHist[--histIdx] || '';
      } else if (e.key === 'ArrowDown' && !keyTrap) {
        e.preventDefault();
        histIdx = Math.min(histIdx + 1, cmdHist.length);
        termInput.value = cmdHist[histIdx] || '';
      } else if (e.key === 'Escape' && !keyTrap) {
        closeTerm();
      } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); CMD.clear();
      }
    });

    // motd
    print('<span class="tapp">integratedsw.tech</span> — type <b>help</b>, or <b>ls</b> to look around.', 'muted');
    print('This shell reads the real site. <span class="tapp">cat index.html</span> fetches the page you are on.', 'muted');
  }

  function openTerm() {
    if (!term) buildTerm();
    term.classList.add('open');
    document.documentElement.classList.add('term-open');
    setTimeout(() => termInput.focus(), 60);
  }
  function closeTerm() {
    keyTrap = null;
    if (term) term.classList.remove('open');
    document.documentElement.classList.remove('term-open');
  }

  /* --------------------------------------------------------------- the dock */
  function buildDock() {
    const dock = document.createElement('button');
    dock.className = 'termdock';
    dock.type = 'button';
    dock.setAttribute('aria-label', 'Open the terminal');
    dock.innerHTML = '<span class="tdps">$</span><span class="tdlabel">terminal</span><span class="tdcur"></span>';
    dock.addEventListener('click', openTerm);
    document.body.appendChild(dock);

    // Out of the way while reading, back the moment you scroll up to navigate.
    let lastY = window.scrollY;
    addEventListener('scroll', () => {
      const y = window.scrollY;
      dock.classList.toggle('down', y > lastY && y > 260);
      lastY = y;
    }, { passive: true });
  }

  /* --------------------------------------------------------------- wiring  */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kk = 0;
  addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA)$/.test((e.target.tagName || '')) ||
                   (term && term.classList.contains('open'));
    if ((e.key === '`' || e.key === '~') && !typing) { e.preventDefault(); openTerm(); return; }
    kk = (e.key === KONAMI[kk]) ? kk + 1 : (e.key === KONAMI[0] ? 1 : 0);
    if (kk === KONAMI.length) { kk = 0; openTerm(); }
  });

  window.__term = { open: openTerm, close: closeTerm };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', buildDock);
  else buildDock();
})();
