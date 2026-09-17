---
name: x-md-paste
description: Upload a local Markdown file to X (Twitter) as an article draft, through the X Article Markdown Paste Chrome extension. Use whenever the user wants to publish, upload, post or sync a .md file to an X article / X long-form post / x.com/compose/articles. Triggers on "上传到X文章", "发布这篇到X", "把这个 md 发到推特长文", "upload md to X article", "post this markdown to X".
---

# X Article Markdown Paste — upload a local .md

One command. The extension does the rendering and the image uploads.

```bash
node "<SKILL_DIR>/xmdpaste.mjs" "<absolute path to file.md>"
```

That serves the file on `127.0.0.1`, finds a browser that has the extension, and
opens `https://x.com/compose/articles?xmdSrc=…` there. The extension picks the
document up, creates a fresh draft, renders the Markdown and uploads every image
to X's CDN. Nothing is published — the result is a draft.

Read the command's output before saying anything to the user:

- `opening in <browser> · <profile> · …` then `picked up by …` → it arrived. Tell
  the user to look at that browser (it may be asking them to pick a cover).
- exit code **3** with `nobody picked the document up` → nothing arrived. Relay
  the list it prints (which browsers/profiles have the extension, which are too
  old) and the fix it suggests. Do not retry blindly.

Do not try to drive the page.

## Requirements

- The **X Article Markdown Paste** extension, **1.4.0 or newer**, in any Chromium
  browser (Chrome, Edge, Brave, Arc, Chromium, Vivaldi), logged in to x.com.
- Node 20+.

## Which browser it uses

The command scans each browser's profile folders for the extension and picks:
the default browser if its copy is usable, otherwise a browser whose copy is;
within a browser, the last-used profile. Store copies older than 1.4.0 are not
usable. Unpacked dev builds are always considered usable, but only run new code
after being reloaded in chrome://extensions.

If the extension is installed in several places the output says so; to choose,
pass `--browser chrome|edge|brave|arc|chromium|vivaldi` and/or
`--profile "Profile 2"`. A browser started with a custom data dir needs
`--user-data-dir DIR`.

The document is served **once**. If two copies of the extension could take it
(two browsers, or a store build next to a dev build), the first wins and the
other is refused, so there is never a second draft. Inside one browser, copies
elect a single owner per page.

## Options

- `--root DIR` — the directory served as the web root. Default: the nearest
  ancestor containing `.obsidian`, else the file's own folder. **Obsidian
  wikilinks (`![[附件/图/a.png]]`) resolve from the vault root**, so for a vault
  note the root must be the vault root — the default already does this.
- `--browser NAME`, `--profile DIR`, `--user-data-dir DIR` — see above.
- `--print-url` — print the URL instead of opening it, for hosts that open URLs
  themselves. The command still waits for the pick-up and exits 3 without one.
- `--wait SEC` — how long to wait for the pick-up (default 25).
- `--idle SEC` — after the pick-up, exit this long after the last request
  (default 30). Images are fetched during the upload, so don't go below ~6.

## Image paths it understands

Relative (`img/a.png`, `img\a.png`, `../附件/图 片.png` — bare spaces are fine),
Obsidian wikilinks, and absolute paths in any OS style (`/Users/me/v/a.png`,
`C:\v\a.png`, `file:///C:/v/a.png`). Every file must be **under `--root`**;
anything outside it is refused and shows up as a failed image, never as a
folder-access prompt. Remote `https://` images are fetched as usual.

## What the user sees

A banner on x.com: 下载图片 → 上传图片 n/N → ✅ 粘贴完成. If the document has
images, a cover dialog may appear — the user picks a cover or 不设置封面.

## When it fails

- **Exit 3, nobody picked it up** — see the printed list. Usual causes: the
  extension is older than 1.4.0, disabled, in a different profile, or the
  browser that opened isn't logged in to x.com.
- **Banner: `already picked up`** — the same link was opened twice, or by a
  second copy. Run the command again for a new link.
- **Banner: `the local tool is not running any more`** — the command exited
  (idle) before the tab loaded, e.g. a reused old link. Run it again.
- **Banner: `only localhost / 127.0.0.1`** — a hand-made `xmdSrc` pointed
  elsewhere. Only loopback is accepted.
- **`… 张图片上传失败` (some images failed)** — a path outside `--root`, a
  missing file, or the free tier's per-paste image cap.
- **Banner: `larger than 16 MB`** — split the document.
