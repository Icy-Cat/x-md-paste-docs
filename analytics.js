// GA4：媒体资源「xmdpaste」（账号 IcyCat Products）。站内所有页面只引用这一个文件，改统计只改这里。
// 事件：install_click（点 Chrome / Edge 商店）、checkout_click（点收银台），GA 后台把这两个标为关键事件。
// 商店链接运行时补 utm_source，Chrome 开发者后台的流量来源和 GA 里能看出安装来自官网。
(() => {
  const ID = 'G-NJD0L7PX5M';
  const SOURCE = location.hostname;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', ID);

  const STORE = /chromewebstore\.google\.com|microsoftedge\.microsoft\.com/;
  const CHECKOUT = /pay\.icy-cat\.com|creem\.io/;
  const tagStoreLinks = () => document.querySelectorAll('a[href]').forEach((a) => {
    if (!STORE.test(a.href) || a.href.includes('utm_source=')) return;
    const u = new URL(a.href);
    u.searchParams.set('utm_source', SOURCE);
    u.searchParams.set('utm_medium', 'website');
    a.href = u.toString();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagStoreLinks);
  else tagStoreLinks();

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (STORE.test(a.href)) gtag('event', 'install_click', { store: a.href.includes('microsoftedge') ? 'edge' : 'chrome', link_url: a.href });
    else if (CHECKOUT.test(a.href)) gtag('event', 'checkout_click', { plan: new URL(a.href).searchParams.get('plan') || '', link_url: a.href });
  }, true);
})();
