#!/usr/bin/env node
// Hand a local Markdown file to the X Article Markdown Paste extension.
//
//   node skills/x-md-paste/xmdpaste.mjs ~/notes/post.md   (or tools/xmdpaste.mjs)
//
// Serves the file (and the images it references) on 127.0.0.1 for as long as
// the import needs, then opens
// https://x.com/compose/articles?xmdSrc=<that url> in a browser that has the
// extension. The extension does the rest: new draft, render, upload images.
//
// Which browser. `open <url>` goes to whatever the OS picks — the default
// browser, and with several instances of it running, the first one — which is
// often not the one that has the extension (or has a version new enough to
// know ?xmdSrc=). So before opening, this scans the Chromium browsers' profile
// folders for the extension, and opens the URL in one that has a usable copy:
// the default browser if it qualifies, else the one that does. Several usable
// copies → the default browser, then that browser's last-used profile.
//
// Did anything pick it up. The document is served ONCE: the first request
// claims it (and says who it is — the extension appends its id, version and
// browser brand), any later request gets 409. That both confirms delivery and
// stops two copies of the extension (two browsers, or a dev build next to the
// store build) from each creating a draft. If nobody claims it within --wait
// seconds, the command exits 3 with what it found, instead of leaving the user
// staring at a browser where nothing happened.
//
// Flags:
//   --root DIR          directory served as the root (default: nearest
//                       ancestor containing .obsidian, else the file's own
//                       directory). Obsidian wikilinks are vault-root relative.
//   --browser NAME      chrome | edge | brave | arc | chromium | vivaldi
//   --profile DIR       profile folder, e.g. "Default", "Profile 2"
//   --user-data-dir DIR a non-standard browser data dir (implies scanning it)
//   --print-url         print the x.com URL instead of opening it (the host
//                       opens it); still waits for the claim
//   --wait SEC          how long to wait for the extension to claim (25)
//   --idle SEC          after the claim, exit this long after the last request (30)
//   --port N            fixed port (default: an OS-assigned free one)
//
// Exit codes: 0 delivered, 2 bad arguments, 3 nobody picked it up.

import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path, { extname, join, relative, resolve, sep, dirname } from 'node:path';

// The ?xmdSrc= entry first shipped in this version; older copies ignore it.
export const MIN_VERSION = '1.4.0';
const STORE_IDS = {
  jpgelgkhcegcoblmekgacjmagkanpenn: 'Chrome Web Store',
  olmcdmippmodgejpdicafcbcoegopken: 'Edge Add-ons',
};
const HOMEPAGE = 'xmdpaste.icy-cat.com';

const MIME = {
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

function parseArgs(argv) {
  const out = { file: '', root: '', port: 0, printUrl: false, idle: 30, wait: 25, browser: '', profile: '', userDataDir: '' };
  const num = { '--port': 'port', '--idle': 'idle', '--wait': 'wait' };
  const str = { '--root': 'root', '--browser': 'browser', '--profile': 'profile', '--user-data-dir': 'userDataDir' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (num[a]) out[num[a]] = Number(argv[++i]);
    else if (str[a]) out[str[a]] = argv[++i];
    else if (a === '--print-url') out.printUrl = true;
    else if (!out.file) out.file = a;
  }
  return out;
}

// Obsidian wikilinks (`![[附件/x.png]]`) resolve from the vault root, so serving
// the note's own folder would 404 every one of them.
function findVaultRoot(fileDir) {
  let dir = fileDir;
  for (;;) {
    if (existsSync(join(dir, '.obsidian'))) return dir;
    const up = dirname(dir);
    if (up === dir) return fileDir;
    dir = up;
  }
}

// Only files under root, only the extensions the extension can use. The vault
// is on a listening socket for the duration, so nothing else is reachable —
// no .env, no .git, no traversal out of root.
//
// A request path is tried as root-relative first, then as an ABSOLUTE file
// path (the extension turns `![](/Users/me/vault/a.png)`, `C:\vault\a.png` and
// `file:///…` into `<server>/<that path>`) — still only if it lies under root.
// Cross-platform details, each of which broke a real path:
//   - Windows separators: hidden-segment check splits on both / and \
//   - Windows is case-insensitive: the under-root test compares lowercased
//   - Unicode: the Markdown may say NFC where the disk has NFD (macOS-made
//     files on Linux, or the reverse); both forms are tried
// `p` / `isFile` are injectable so Windows behaviour is testable on any OS.
export function resolveRequest(root, urlPath, { p = path, isFile = defaultIsFile } = {}) {
  let rel;
  try {
    rel = decodeURIComponent(String(urlPath).split('?')[0]);
  } catch {
    return null;
  }
  if (rel.includes('\0')) return null;
  const bare = rel.replace(/^\/+/, '');
  const winAbs = /^[A-Za-z]:[\\/]/.test(bare);
  const bases = [];
  if (!winAbs) bases.push(p.resolve(root, bare));
  if (winAbs && p.sep === '\\') bases.push(p.resolve(bare));
  if (!winAbs && p.sep === '/' && rel.startsWith('/')) bases.push(p.resolve(rel));

  const rootAbs = p.resolve(root);
  const fold = (x) => (p.sep === '\\' ? x.toLowerCase() : x);
  for (const base of bases) {
    for (const cand of [...new Set([base, base.normalize('NFC'), base.normalize('NFD')])]) {
      const inside = fold(cand) === fold(rootAbs) || fold(cand).startsWith(fold(rootAbs.endsWith(p.sep) ? rootAbs : rootAbs + p.sep));
      if (!inside) continue;
      const within = p.relative(rootAbs, cand);
      if (within.split(/[\\/]/).some((seg) => seg.startsWith('.'))) continue;
      if (!MIME[p.extname(cand).toLowerCase()]) continue;
      if (isFile(cand)) return cand;
    }
  }
  return null;
}

function defaultIsFile(f) {
  try { return statSync(f).isFile(); } catch { return false; }
}

// `docPath` turns on the one-shot claim: that path answers once, then 409; and
// nothing else is served until it has been claimed.
export function serve(root, { port = 0, onRequest, docPath, onClaim } = {}) {
  let claim = null;
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const file = resolveRequest(root, url.pathname);
    onRequest?.(req.url, file);
    const deny = (code, text) => { res.writeHead(code, { 'content-type': 'text/plain' }); res.end(text); };
    if (!file) return deny(403, 'forbidden');
    if (docPath) {
      const who = { client: url.searchParams.get('xmd_client') || '', version: url.searchParams.get('xmd_ver') || '', browser: url.searchParams.get('xmd_browser') || '', req: url.searchParams.get('xmd_req') || '' };
      let path = url.pathname;
      try { path = decodeURIComponent(path); } catch {}
      if (path === docPath) {
        // A retry of the very same fetch (same attempt id, after a dropped
        // response) may read it again. Anything else — another copy, or the same
        // copy opening the link a second time — is refused.
        if (claim && !(who.req && who.req === claim.req)) {
          onClaim?.(who, claim);
          return deny(409, `already picked up by ${describeClient(claim)}`);
        }
        if (claim) {
          res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()], 'cache-control': 'no-store' });
          return createReadStream(file).pipe(res);
        }
        claim = { ...who, at: Date.now() };
        onClaim?.(who, null);
      } else if (!claim) {
        return deny(403, 'document not picked up yet');
      }
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()],
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

export function describeClient({ client, version, browser }) {
  if (!client) return `an unidentified client (extension older than ${MIN_VERSION}, or not the extension)`;
  const src = STORE_IDS[client] ? `${STORE_IDS[client]} build` : `unpacked build ${client}`;
  return `${browser || 'a Chromium browser'} · ${src} · v${version || '?'}`;
}

export function versionAtLeast(v, min) {
  const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0;
  }
  return true;
}

// ── browser discovery ────────────────────────────────────────────────────────
const H = homedir();
const APPDATA = process.env.LOCALAPPDATA || join(H, 'AppData', 'Local');
export const BROWSERS = [
  { key: 'chrome', name: 'Google Chrome', bundle: 'com.google.chrome',
    dir: { darwin: 'Library/Application Support/Google/Chrome', win32: 'Google/Chrome/User Data', linux: '.config/google-chrome' },
    bin: { win32: 'chrome', linux: 'google-chrome' } },
  { key: 'edge', name: 'Microsoft Edge', bundle: 'com.microsoft.edgemac',
    dir: { darwin: 'Library/Application Support/Microsoft Edge', win32: 'Microsoft/Edge/User Data', linux: '.config/microsoft-edge' },
    bin: { win32: 'msedge', linux: 'microsoft-edge' } },
  { key: 'brave', name: 'Brave Browser', bundle: 'com.brave.browser',
    dir: { darwin: 'Library/Application Support/BraveSoftware/Brave-Browser', win32: 'BraveSoftware/Brave-Browser/User Data', linux: '.config/BraveSoftware/Brave-Browser' },
    bin: { win32: 'brave', linux: 'brave-browser' } },
  { key: 'arc', name: 'Arc', bundle: 'company.thebrowser.browser',
    dir: { darwin: 'Library/Application Support/Arc/User Data', win32: 'Packages/TheBrowserCompany.Arc_ttt1ap7aakyb4/LocalCache/Local/Arc/User Data' },
    bin: { win32: 'arc' } },
  { key: 'chromium', name: 'Chromium', bundle: 'org.chromium.chromium',
    dir: { darwin: 'Library/Application Support/Chromium', win32: 'Chromium/User Data', linux: '.config/chromium' },
    bin: { win32: 'chromium', linux: 'chromium' } },
  { key: 'vivaldi', name: 'Vivaldi', bundle: 'com.vivaldi.vivaldi',
    dir: { darwin: 'Library/Application Support/Vivaldi', win32: 'Vivaldi/User Data', linux: '.config/vivaldi' },
    bin: { win32: 'vivaldi', linux: 'vivaldi' } },
];

function userDataDirOf(b, platform = process.platform) {
  const rel = b.dir[platform];
  if (!rel) return null;
  return platform === 'win32' ? join(APPDATA, rel) : join(H, rel);
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

// Every copy of this extension in every profile of one browser data dir:
// store installs live under Extensions/<id>/<version>_0, unpacked ones are
// only recorded in (Secure) Preferences with their source path.
export function scanUserDataDir(dataDir, browser) {
  const found = [];
  if (!dataDir || !existsSync(dataDir)) return found;
  const lastUsed = readJson(join(dataDir, 'Local State'))?.profile?.last_used || 'Default';
  let profiles = [];
  try { profiles = readdirSync(dataDir).filter((d) => d === 'Default' || /^Profile \d+$/.test(d)); } catch {}
  for (const profile of profiles) {
    const pdir = join(dataDir, profile);
    for (const id of Object.keys(STORE_IDS)) {
      const extDir = join(pdir, 'Extensions', id);
      if (!existsSync(extDir)) continue;
      const versions = readdirSync(extDir).map((v) => v.replace(/_\d+$/, '')).sort((a, b) => (versionAtLeast(a, b) ? -1 : 1));
      if (versions[0]) found.push({ browser: browser.key, browserName: browser.name, dataDir, profile, lastUsed: profile === lastUsed, id, version: versions[0], kind: 'store' });
    }
    for (const prefs of ['Secure Preferences', 'Preferences']) {
      const settings = readJson(join(pdir, prefs))?.extensions?.settings || {};
      for (const [id, s] of Object.entries(settings)) {
        if (s?.location !== 4 || !s.path) continue;               // 4 = unpacked
        if (found.some((f) => f.id === id && f.profile === profile)) continue;
        const man = readJson(join(s.path, 'manifest.json'));
        if (!man || !String(man.homepage_url || '').includes(HOMEPAGE)) continue;
        // disabled: old Chrome writes state 0, current Chrome a non-empty
        // disable_reasons list (an enabled copy has `[]`, which is truthy)
        const reasons = s.disable_reasons;
        if (s.state === 0 || (Array.isArray(reasons) ? reasons.length : reasons)) continue;
        found.push({ browser: browser.key, browserName: browser.name, dataDir, profile, lastUsed: profile === lastUsed, id, version: man.version, kind: 'unpacked' });
      }
    }
  }
  return found;
}

export function discover({ browser = '', userDataDir = '' } = {}) {
  const list = BROWSERS.filter((b) => !browser || b.key === browser);
  const out = [];
  for (const b of list) {
    const dirs = userDataDir ? [resolve(userDataDir)] : [userDataDirOf(b)].filter(Boolean);
    for (const d of dirs) out.push(...scanUserDataDir(d, b));
  }
  return out;
}

function defaultBrowserKey() {
  try {
    if (process.platform === 'darwin') {
      const plist = join(H, 'Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist');
      const json = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', plist], { encoding: 'utf8' }));
      const bundle = json.LSHandlers?.find((h) => h.LSHandlerURLScheme === 'https')?.LSHandlerRoleAll;
      return BROWSERS.find((b) => b.bundle === String(bundle).toLowerCase())?.key || '';
    }
    if (process.platform === 'linux') {
      const desk = execFileSync('xdg-settings', ['get', 'default-web-browser'], { encoding: 'utf8' });
      return BROWSERS.find((b) => desk.toLowerCase().includes(b.key === 'chrome' ? 'google-chrome' : b.key))?.key || '';
    }
  } catch {}
  return '';
}

// A store copy must be new enough to know ?xmdSrc=. An unpacked copy is a dev
// build running whatever the source tree has — its manifest version lags the
// code (it is bumped at release), so it is not held to MIN_VERSION.
export const isUsable = (i) => i.kind === 'unpacked' || versionAtLeast(i.version, MIN_VERSION);

// Pick the copy to open in. Pure, so it can be tested with made-up installs.
export function choose(installs, { defaultKey = '', profile = '' } = {}) {
  const usable = installs.filter((i) => isUsable(i) && (!profile || i.profile === profile));
  if (!usable.length) return null;
  const score = (i) => (i.browser === defaultKey ? 4 : 0) + (i.lastUsed ? 2 : 0) + (i.kind === 'store' ? 1 : 0);
  return [...usable].sort((a, b) => score(b) - score(a))[0];
}

function openUrl(url, target, opts) {
  const args = [];
  if (target) {
    if (opts.userDataDir) args.push(`--user-data-dir=${resolve(opts.userDataDir)}`);
    args.push(`--profile-directory=${target.profile}`);
  }
  let cmd, cargs;
  const b = target && BROWSERS.find((x) => x.key === target.browser);
  if (process.platform === 'darwin') {
    // -n + --args reaches the RUNNING instance for that data dir: the new
    // process hands the URL to it through Chrome's singleton and exits.
    [cmd, cargs] = b ? ['open', ['-na', b.name, '--args', ...args, url]] : ['open', [url]];
  } else if (process.platform === 'win32') {
    [cmd, cargs] = ['cmd', ['/c', 'start', '', ...(b ? [b.bin.win32, ...args] : []), url]];
  } else {
    [cmd, cargs] = b?.bin.linux ? [b.bin.linux, [...args, url]] : ['xdg-open', [url]];
  }
  spawn(cmd, cargs, { stdio: 'ignore', detached: true }).unref();
}

function report(installs, defaultKey) {
  if (!installs.length) return '  no copy of the extension found in Chrome, Edge, Brave, Arc, Chromium or Vivaldi profiles';
  return installs.map((i) => `  ${i.browserName}${i.browser === defaultKey ? ' (default)' : ''} · ${i.profile} · ${i.kind} v${i.version}${i.kind === 'unpacked' ? '  (dev build)' : isUsable(i) ? '' : `  ← too old, needs ${MIN_VERSION}+`}`).join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error('usage: xmdpaste <file.md> [--root DIR] [--browser NAME] [--profile DIR] [--user-data-dir DIR] [--print-url] [--wait SEC] [--idle SEC] [--port N]');
    process.exit(2);
  }
  if (opts.browser && !BROWSERS.some((b) => b.key === opts.browser)) {
    console.error(`unknown --browser ${opts.browser}; one of ${BROWSERS.map((b) => b.key).join(', ')}`);
    process.exit(2);
  }
  const file = resolve(opts.file);
  if (!existsSync(file) || !statSync(file).isFile()) {
    console.error(`no such file: ${file}`);
    process.exit(2);
  }
  if (!MIME[extname(file).toLowerCase()]?.startsWith('text/')) {
    console.error(`not a Markdown file: ${file}`);
    process.exit(2);
  }
  const root = resolve(opts.root || findVaultRoot(dirname(file)));
  const rel = relative(root, file);
  if (rel.startsWith('..') || rel.split(sep).some((s) => s.startsWith('.'))) {
    console.error(`${file} is outside --root ${root}, or inside a hidden folder`);
    process.exit(2);
  }

  const docPath = '/' + rel.split(sep).join('/');
  const startedAt = Date.now();
  let lastHit = startedAt;
  let claimedAt = 0;
  const server = await serve(root, {
    port: opts.port,
    docPath,
    onRequest: () => { lastHit = Date.now(); },
    onClaim: (who, earlier) => {
      if (earlier) {
        console.log(`refused a second pick-up by ${describeClient(who)} — ${describeClient(earlier)} already has it`);
        return;
      }
      claimedAt = Date.now();
      console.log(`picked up by ${describeClient(who)}`);
    },
  }).catch((e) => {
    console.error(`can't listen on port ${opts.port}: ${e.message}`);
    process.exit(2);
  });
  server.on('error', (e) => { console.error(`server error: ${e.message}`); process.exit(2); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const docUrl = `${base}/${rel.split(sep).map(encodeURIComponent).join('/')}`;
  const target = `https://x.com/compose/articles?xmdSrc=${encodeURIComponent(docUrl)}`;

  const defaultKey = defaultBrowserKey();
  const installs = discover(opts);
  const pick = choose(installs, { defaultKey, profile: opts.profile });

  if (opts.printUrl) {
    console.log(target);
  } else {
    console.log(`serving ${root} on ${base}`);
    if (pick) {
      console.log(`opening in ${pick.browserName} · ${pick.profile} · ${pick.kind} v${pick.version}`);
      if (installs.filter(isUsable).length > 1) console.log('  (several usable copies found — pass --browser / --profile to choose another)');
    } else {
      console.log(`no copy of the extension at ${MIN_VERSION}+ found — opening in the default browser anyway`);
      console.log(report(installs, defaultKey));
    }
    openUrl(target, pick, opts);
  }

  const tick = setInterval(() => {
    const now = Date.now();
    if (!claimedAt && now - startedAt > opts.wait * 1000) {
      clearInterval(tick);
      server.close();
      console.error(`nobody picked the document up within ${opts.wait}s. Found:`);
      console.error(report(installs, defaultKey));
      console.error('Check that the browser that opened is logged in to x.com and has the extension enabled, or pass --browser / --profile.');
      if (pick?.kind === 'unpacked') console.error('That was a dev (unpacked) build: it only runs new code after you press reload on it in chrome://extensions.');
      process.exit(3);
    }
    if (claimedAt && now - lastHit > opts.idle * 1000) {
      clearInterval(tick);
      server.close();
      // The server's part is over; the browser may still be saving, or waiting
      // on the cover dialog — say that, not "done".
      console.log('delivered — finish in the browser (it may still be saving, or asking you to pick a cover)');
      process.exit(0);
    }
  }, 500);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('xmdpaste.mjs')) main();
