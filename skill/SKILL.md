---
name: x-md-paste
description: Upload a local Markdown file to X (Twitter) as an article draft, through the X Article Markdown Paste Chrome extension. Use whenever the user wants to publish, upload, post or sync a .md file to an X article / X long-form post / x.com/compose/articles. Triggers on "上传到X文章", "发布这篇到X", "把这个 md 发到推特长文", "upload md to X article", "post this markdown to X".
---

# X Article Markdown Paste — upload a local .md

One command. The extension does the rendering and the image uploads.

```bash
node "<SKILL_DIR>/xmdpaste.mjs" "<absolute path to file.md>"
```

That serves the file on `127.0.0.1` and opens
`https://x.com/compose/articles?xmdSrc=…` in the default browser. The extension
picks the parameter up, creates a fresh draft, renders the Markdown and uploads
every image to X's CDN. Nothing is written to the user's account until they hit
Publish — the result is a draft.

Then tell the user to look at the browser. Do not try to drive the page.

## Requirements

- The **X Article Markdown Paste** extension installed in the default browser,
  and the user logged in to x.com in it.
- Node 20+.

## Options

- `--root DIR` — the directory served as the web root. Default: the nearest
  ancestor containing `.obsidian`, else the file's own folder. **Obsidian
  wikilinks (`![[附件/图/a.png]]`) resolve from the vault root**, so for a vault
  note the root must be the vault root — the default already does this.
- `--print-url` — print the URL instead of opening it. For hosts that open URLs
  themselves.
- `--idle SEC` — shut the server down this long after the last request
  (default 30). Images are fetched one at a time during the upload, so don't go
  below ~15.

## What the user sees

A banner across the top of x.com: 检测到 Markdown → 上传图片 n/N → ✅ 粘贴完成.
If the document has more than one image, a cover-image dialog appears first —
the user picks a cover or clicks 不设置封面; the upload continues either way.

## When it fails

- **Nothing happens after the browser opens** — the extension isn't installed in
  *that* browser, or the user isn't on x.com. The URL parameter is consumed on
  load, so re-run the command rather than reloading the tab.
- **`Local import failed: not_loopback`** — the served URL wasn't
  localhost/127.0.0.1. Only loopback is allowed.
- **Images stay as text URLs** — the free tier caps images per paste. That's a
  license tier, not an error.
- **`http_404` for images** — wrong `--root`. Point it at the vault root.
