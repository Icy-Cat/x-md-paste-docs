# X Article Markdown Paste — Public site

Marketing page + legal docs for the [X Article Markdown Paste](https://xmdpaste.icy-cat.com)
Chrome extension. Served from `xmdpaste.icy-cat.com` by a Cloudflare Worker with static assets
(`wrangler.toml`, `worker.js`); every push to `main` deploys via `.github/workflows/deploy.yml`.

The extension's source is private; this repo holds only the public-facing site.

- Live site: https://xmdpaste.icy-cat.com
- Privacy: https://xmdpaste.icy-cat.com/privacy.html
- Terms: https://xmdpaste.icy-cat.com/terms.html
- Contact: lengkuxiaomao@gmail.com

## Editing pages

Sources live in `src/*.html` and carry both languages inline (`<span lang-zh>` /
`<span lang-en>`, or `<div lang-zh>` for whole sections). Never edit the root
`*.html` or `zh/*.html` by hand — run the build and commit its output:

```bash
node build.mjs          # writes /*.html (English) and /zh/*.html (Chinese) + sitemap.xml
node build.mjs --check  # non-zero exit if committed output is stale
```
