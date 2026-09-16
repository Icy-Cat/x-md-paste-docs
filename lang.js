// Each language is its own route (/ = English, /zh/ = Chinese; see build.mjs).
// This script only (1) remembers which one the visitor picked, (2) sends a
// first-time Chinese-locale visitor to /zh/ once, and (3) expands a <details>
// that the URL hash points at.
(function () {
  const KEY = 'xmdpaste_lang';
  const here = location.pathname.startsWith('/zh/') ? 'zh' : 'en';
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch {}

  if (!stored && here === 'en' && /^zh/i.test(navigator.language || '')) {
    try { localStorage.setItem(KEY, 'zh'); } catch {}
    location.replace('/zh' + location.pathname + location.search + location.hash);
    return;
  }

  function expandHashTarget() {
    const id = (location.hash || '').replace(/^#/, '');
    const el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') {
      el.open = true;
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const link = document.getElementById('lang-toggle');
    if (link) link.addEventListener('click', () => {
      try { localStorage.setItem(KEY, link.dataset.langTo); } catch {}
    });
    expandHashTarget();
    window.addEventListener('hashchange', expandHashTarget);
  });
})();
