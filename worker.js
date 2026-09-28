// 静态资源用 html_handling = "none"：站内 canonical / sitemap 都是 *.html，
// 默认处理会把 /compare.html 307 到 /compare。这里只补目录首页，
// 行为对齐原来的 GitHub Pages：/zh → 301 /zh/，/zh/ → zh/index.html。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/')) {
      return env.ASSETS.fetch(new Request(new URL(url.pathname + 'index.html', url), request));
    }
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && !url.pathname.split('/').pop().includes('.')) {
      const dir = await env.ASSETS.fetch(new Request(new URL(url.pathname + '/index.html', url), request));
      if (dir.ok) return Response.redirect(new URL(url.pathname + '/' + url.search, url), 301);
    }
    return res;
  },
};
