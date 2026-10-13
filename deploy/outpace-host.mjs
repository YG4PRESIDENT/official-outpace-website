const pages = new Set(['how-it-works', 'privacy', 'terms', 'rules', 'support', 'delete-account']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.outpaceapp.com' || url.protocol === 'http:') {
      url.protocol = 'https:';
      if (url.hostname === 'www.outpaceapp.com') url.hostname = 'outpaceapp.com';
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === '/index.html') {
      url.pathname = '/';
      return Response.redirect(url.toString(), 308);
    }
    // Invitation previews are generic. The bearer capability is used only in
    // the explicit app-opening link; no identity lookup or auto-accept occurs.
    if (url.pathname.startsWith('/i/')) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
      const match = /^\/i\/([a-f0-9]{32})$/i.exec(url.pathname);
      if (!match || url.search || url.hash) return new Response('Invitation not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer' } });
      const asset = new URL('/_invite.html', url.origin);
      const template = await env.ASSETS.fetch(new Request(asset, { method: 'GET', headers: request.headers }));
      if (template.status !== 200) return new Response('Invitation page is unavailable. Please try again.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
      const html = (await template.text()).replaceAll('__OUTPACE_INVITE_CODE__', match[1].toUpperCase());
      const headers = new Headers(template.headers);
      headers.delete('Content-Length'); headers.delete('ETag');
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store, no-transform');
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
    }
    if (url.pathname === '/_invite.html') return new Response('Not found', { status: 404 });
    if (url.pathname === '/.well-known/apple-app-site-association' || url.pathname === '/.well-known/assetlinks.json') {
      const response = await env.ASSETS.fetch(request);
      const result = new Response(response.body, response);
      if (response.status === 200) {
        result.headers.set('Content-Type', 'application/json');
        result.headers.set('Cache-Control', 'public, max-age=3600, no-transform');
      }
      return result;
    }
    const alias = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (pages.has(alias)) {
      url.pathname = '/' + alias + '.html';
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === '/') url.pathname = '/index.html';
    const response = await env.ASSETS.fetch(new Request(url, request));
    if (response.headers.get('Content-Type')?.startsWith('text/html')) {
      const preserved = new Response(response.body, response);
      const cacheControl = preserved.headers.get('Cache-Control') || 'public, max-age=0, must-revalidate';
      preserved.headers.set('Cache-Control', cacheControl + ', no-transform');
      return preserved;
    }
    return response;
  }
};
