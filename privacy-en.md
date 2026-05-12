# Privacy Policy — X Article Markdown Paste

**Last updated:** May 2026

## Data Collection

X Article Markdown Paste does **not** collect, store, or transmit any personal data, browsing data, or article content to external servers.

## What the extension accesses

- **Clipboard data on `x.com/compose/articles/edit/*`**: When you press Ctrl+V inside the X article editor, the extension reads the pasted Markdown text from the clipboard. The text is parsed and rendered into the editor entirely in your browser.
- **Image URLs you paste**: If your Markdown contains `http(s)` image links, the extension's background script fetches each image so it can be uploaded into your X article via X's own media pipeline. Only URLs that you wrote into your Markdown are fetched.
- **`chrome.storage.local`**: Used solely to store your license key and activation timestamp (after you purchase Pro). Stored locally on your device only.

## What the extension does NOT do

- Does not collect any personal information
- Does not read your X account credentials or cookies
- Does not track browsing history
- Does not access pages outside `x.com/compose/articles/*` and `twitter.com/compose/articles/*`
- Does not inject ads or analytics
- Does not transmit your article content to any third party
- Does not share data between users

## Third-party services

- **X (Twitter)**: All article writing happens through X's own editor and your active X session. The extension does not impersonate or bypass X.
- **Image hosts**: When you paste a Markdown link to an external image (e.g. imgur, cloudinary), that host's server will see one HTTP request for the image you referenced — same as if you visited the image URL directly.
- **License validation (v1.x)**: Fully client-side. No server calls.

## Open Source

The full source code is publicly available at:
<https://github.com/Icy-Cat/x-article-md-paste>

## Contact

For questions about this privacy policy, please open an issue on the GitHub repository.
