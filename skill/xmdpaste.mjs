#!/usr/bin/env node
// Hand a local Markdown file to the X Article Markdown Paste extension.
//
//   node tools/xmdpaste.mjs ~/notes/post.md
//
// Serves the file (and the images it references) on 127.0.0.1 for as long as
// the import needs, then opens
// https://x.com/compose/articles?xmdSrc=<that url> in the browser. The
// extension does the rest: new draft, render, upload images to X.
//
// Flags:
//   --root DIR     directory served as the root (default: nearest ancestor
//                  containing .obsidian, else the file's own directory).
//                  Obsidian wikilinks are vault-root relative, so for a vault
//                  this must be the vault root.
//   --port N       fixed port (default: an OS-assigned free one)
//   --print-url    print the x.com URL instead of opening it — for editor
//                  plugins that open URLs themselves
//   --idle SEC     shut down this many seconds after the last request (30)

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, relative, resolve, sep, dirname } from 'node:path';

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
  const out = { file: '', root: '', port: 0, printUrl: false, idle: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--port') out.port = Number(argv[++i]);
    else if (a === '--idle') out.idle = Number(argv[++i]);
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
function resolveRequest(root, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  } catch {
    return null;
  }
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) return null;
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return null;
  if (!MIME[extname(target).toLowerCase()]) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return target;
}

export function serve(root, { port = 0, onRequest } = {}) {
  const server = createServer((req, res) => {
    const file = resolveRequest(root, req.url || '/');
    onRequest?.(req.url, file);
    if (!file) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      return res.end('forbidden');
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()],
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

function openUrl(url) {
  const [cmd, args] = process.platform === 'darwin'
    ? ['open', [url]]
    : process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error('usage: xmdpaste <file.md> [--root DIR] [--port N] [--print-url] [--idle SEC]');
    process.exit(2);
  }
  const file = resolve(opts.file);
  if (!existsSync(file)) {
    console.error(`no such file: ${file}`);
    process.exit(2);
  }
  const root = resolve(opts.root || findVaultRoot(dirname(file)));
  const rel = relative(root, file);
  if (rel.startsWith('..')) {
    console.error(`${file} is outside --root ${root}`);
    process.exit(2);
  }

  let lastHit = Date.now();
  const server = await serve(root, {
    port: opts.port,
    onRequest: () => { lastHit = Date.now(); },
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const docUrl = `${base}/${rel.split(sep).map(encodeURIComponent).join('/')}`;
  const target = `https://x.com/compose/articles?xmdSrc=${encodeURIComponent(docUrl)}`;

  if (opts.printUrl) {
    console.log(target);
  } else {
    console.log(`serving ${root} on ${base}`);
    console.log(`opening ${target}`);
    openUrl(target);
  }

  // The extension fetches the document first, then one image at a time while
  // it uploads. Stay up until it goes quiet.
  const tick = setInterval(() => {
    if (Date.now() - lastHit > opts.idle * 1000) {
      clearInterval(tick);
      server.close();
      console.log('done');
    }
  }, 1000);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
