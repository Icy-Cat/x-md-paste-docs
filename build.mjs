#!/usr/bin/env node
// Two routes from one bilingual source.
//
//   src/*.html  →  /*.html      (English, canonical)
//               →  /zh/*.html   (Chinese)
//
// Source pages carry both languages inline: <span lang-zh>…</span><span lang-en>…</span>
// (or <div lang-zh>…</div> for whole sections). The build drops the other
// language and unwraps the kept one, so the output has no lang-* markup and
// no runtime switching — each route is a plain page a crawler can index.
//
//   node build.mjs        # writes the output files (commit them)
//   node build.mjs --check  # exit 1 if the committed output is stale
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://xmdpaste.icy-cat.com';
const LANGS = { en: { dir: '', html: 'en', og: 'en_US', other: 'zh', label: '中' },
                zh: { dir: 'zh/', html: 'zh-CN', og: 'zh_CN', other: 'en', label: 'EN' } };
const TODAY = new Date().toISOString().slice(0, 10);

// Remove every <tag lang-X …>…</tag> block (tag-aware so nested same-tags
// inside the block don't cut it short), and unwrap the lang-Y ones.
function pickLang(html, keep, drop) {
  for (const tag of ['div', 'span']) {
    html = stripBlocks(html, tag, drop);
    html = html.replace(new RegExp(`<${tag} lang-${keep}>`, 'g'), `<!--${tag}-open-->`);
    html = unwrap(html, tag);
  }
  return html;
}
function stripBlocks(html, tag, lang) {
  const open = new RegExp(`<${tag} lang-${lang}(?:\\s[^>]*)?>`, 'g');
  let m;
  while ((m = open.exec(html))) {
    const end = matchClose(html, tag, m.index + m[0].length);
    html = html.slice(0, m.index) + html.slice(end);
    open.lastIndex = m.index;
  }
  return html;
}
function matchClose(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  throw new Error(`unclosed <${tag}> at ${from}`);
}
// The opener was replaced by a marker; find its matching close and delete both.
function unwrap(html, tag) {
  const marker = `<!--${tag}-open-->`;
  let i;
  while ((i = html.indexOf(marker)) !== -1) {
    const bodyStart = i + marker.length;
    // depth counting from bodyStart: the marker itself is depth 1
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    re.lastIndex = bodyStart;
    let depth = 1, m, closeAt = -1, closeLen = 0;
    while ((m = re.exec(html))) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) { closeAt = m.index; closeLen = m[0].length; break; }
    }
    if (closeAt < 0) throw new Error(`unwrap: no close for ${tag} at ${i}`);
    html = html.slice(0, i) + html.slice(bodyStart, closeAt) + html.slice(closeAt + closeLen);
  }
  return html;
}

// Files served as-is from the site root: never language-prefixed.
const ASSET = /\.(css|js|mjs|png|jpg|svg|ico|xml|txt|webp|sh|ps1|md)(\?|$)/;
function rewriteLinks(html, lang) {
  const prefix = '/' + LANGS[lang].dir;
  return html.replace(/(href|src)="\.\/([^"]*)"/g, (m, attr, rest) => {
    if (rest === '' || rest.startsWith('#')) return `${attr}="${prefix}${rest}"`;
    if (ASSET.test(rest)) return `${attr}="/${rest}"`;
    return `${attr}="${prefix}${rest}"`;
  });
}

function faqLd(html) {
  const items = [];
  const re = /<details[^>]*>\s*<summary>(.*?)<\/summary>\s*<div class="ic-collapse__body">([\s\S]*?)<\/div>\s*<\/details>/g;
  let m;
  while ((m = re.exec(html))) {
    const q = text(m[1]), a = text(m[2]);
    if (q && a) items.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  return items.length ? { '@type': 'FAQPage', mainEntity: items } : null;
}
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function render(name, src, lang) {
  const L = LANGS[lang];
  const path = name === 'index.html' ? '' : name;
  const url = `${SITE}/${L.dir}${path}`;
  let html = pickLang(src, lang, L.other);
  html = rewriteLinks(html, lang);
  html = html.replace(/<!--[\s\S]*?-->/g, '');   // source comments are for editors, not visitors

  // <html lang>, <title data-*>, <meta description data-zh>
  html = html.replace(/<html[^>]*>/, `<html lang="${L.html}" data-lang="${lang}">`);
  html = html.replace(/<title data-zh="([^"]*)" data-en="([^"]*)">[^<]*<\/title>/,
    (m, zh, en) => `<title>${lang === 'zh' ? zh : en}</title>`);
  html = html.replace(/<meta name="description" content="([^"]*)"(?: data-zh="([^"]*)")? \/>/,
    (m, en, zh) => `<meta name="description" content="${lang === 'zh' && zh ? zh : en}" />`);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
             .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
             .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`)
             .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`)
             .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
             .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${L.og}" />`)
             .replace(/<meta property="og:locale:alternate" content="[^"]*" \/>/, `<meta property="og:locale:alternate" content="${LANGS[L.other].og}" />`);
  const alternates = `<link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${SITE}/${path}" />
  <link rel="alternate" hreflang="zh-CN" href="${SITE}/zh/${path}" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/${path}" />`;
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, alternates);

  // language switch: a real link to the other route (remembered by lang.js)
  html = html.replace(/<button id="lang-toggle"[^>]*>[^<]*<\/button>/,
    `<a id="lang-toggle" class="ic-btn ic-btn--sm" href="/${LANGS[L.other].dir}${path}" hreflang="${LANGS[L.other].html}" data-lang-to="${L.other}">${L.label}</a>`);

  // FAQ structured data, regenerated from this language's text
  const faq = faqLd(html);
  if (faq && /"@graph": \[/.test(html)) {
    html = html.replace(/"@graph": \[/, `"@graph": [\n      ${JSON.stringify({ ...faq, '@id': `${url}#faq` })},`);
  }
  if (/lang-(zh|en)/.test(html)) throw new Error(`${name}/${lang}: leftover lang-* markup`);
  return html;
}

const pages = readdirSync(resolve(ROOT, 'src')).filter((f) => f.endsWith('.html'));
const out = new Map();
for (const name of pages) {
  const src = readFileSync(resolve(ROOT, 'src', name), 'utf8');
  for (const lang of Object.keys(LANGS)) out.set(`${LANGS[lang].dir}${name}`, render(name, src, lang));
}
// sitemap: every page in both languages
const urls = [...out.keys()].map((p) => `${SITE}/${p.replace(/index\.html$/, '')}`);
out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);

const check = process.argv.includes('--check');
let stale = 0;
for (const [p, html] of out) {
  const abs = resolve(ROOT, p);
  let cur = null; try { cur = readFileSync(abs, 'utf8'); } catch {}
  if (p === 'sitemap.xml' && cur && cur.replace(/<lastmod>[^<]*<\/lastmod>/g, '') === html.replace(/<lastmod>[^<]*<\/lastmod>/g, '')) continue;
  if (cur === html) continue;
  stale++;
  if (!check) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, html); console.log('wrote', p); }
  else console.log('stale', p);
}
if (check && stale) process.exit(1);
if (!stale) console.log('up to date');
