// Tiny language switcher. Detects navigator.language on first load,
// remembers the user's choice in localStorage, and flips visibility of
// [lang-zh] / [lang-en] siblings via the html[data-lang] attribute.

(function () {
  const KEY = 'xmdpaste_lang';
  const detect = () => {
    const stored = localStorage.getItem(KEY);
    if (stored === 'zh' || stored === 'en') return stored;
    const nav = (navigator.language || '').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  };

  const apply = (lang) => {
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中';
    // Update <title> if it has both variants
    const titleEl = document.querySelector('title');
    if (titleEl?.dataset[lang]) titleEl.textContent = titleEl.dataset[lang];
  };

  apply(detect());

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-lang');
      const next = cur === 'zh' ? 'en' : 'zh';
      localStorage.setItem(KEY, next);
      apply(next);
    });
  });
})();
