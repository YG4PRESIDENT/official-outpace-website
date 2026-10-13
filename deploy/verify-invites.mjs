// Narrow, offline request checks for the new invite route and association files.
// Run after npm run build. This does not verify live hosting or device routing.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from './outpace-host.mjs';
const root = new URL('../dist/', import.meta.url);
const env = { ASSETS: { fetch: async request => {
  const pathname = new URL(request.url).pathname;
  try {
    const contents = await fs.readFile(new URL(pathname.slice(1), root));
    return new Response(contents, { headers: { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'self'; frame-ancestors 'none'" } });
  } catch { return new Response('missing', { status: 404 }); }
} } };
const token = 'ABCDEF0123456789ABCDEF0123456789';
const request = (path, method = 'GET') => worker.fetch(new Request('https://outpaceapp.com' + path, { method }), env);
const response = await request('/i/' + token.toLowerCase());
assert.equal(response.status, 200);
assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform');
assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
const html = await response.text();
assert.ok(html.includes('outpace://invite?code=' + token));
assert.ok(!html.includes('__OUTPACE_INVITE_CODE__'));
assert.ok(html.includes('https://outpaceapp.com/outpace-social.png'));
assert.ok(!/<script|<form|http-equiv="refresh"/i.test(html));
assert.ok(!/property="og:[^"]+"[^>]*ABCDEF/i.test(html));
const head = await request('/i/' + token, 'HEAD');
assert.equal(head.status, 200); assert.equal(await head.text(), '');
for (const path of ['/i/bad', '/i/' + token + '?tracking=1', '/i/' + token + '/', '/_invite.html']) assert.equal((await request(path)).status, 404);
assert.equal((await request('/i/' + token, 'POST')).status, 405);
const aasa = await request('/.well-known/apple-app-site-association');
assert.equal(aasa.status, 200); assert.equal(aasa.headers.get('Content-Type'), 'application/json');
const association = await aasa.json();
assert.deepEqual(association.applinks.details[0].appIDs, ['FBBT7DGB33.com.virtualpiratesllc.imessagewalkingapp']);
assert.deepEqual(association.applinks.details[0].components.map(value => value['/']), ['/i/*']);
const android = await request('/.well-known/assetlinks.json');
assert.equal(android.status, 200); assert.equal(android.headers.get('Content-Type'), 'application/json');
const relation = await android.json();
assert.equal(relation[0].target.package_name, 'com.virtualpiratesllc.outpace');
assert.deepEqual(relation[0].target.sha256_cert_fingerprints, ['FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C']);
for (const path of ['/how-it-works', '/privacy', '/terms', '/rules', '/support', '/delete-account']) {
  const result = await request(path);
  assert.equal(result.status, 308); assert.equal(result.headers.get('Location'), 'https://outpaceapp.com' + path + '.html');
}
assert.equal((await request('/privacy.html')).status, 200);
assert.equal((await request('/')).status, 200);
console.log('PASS: prepared invite requests, token-safe generic preview, explicit app opening, restricted associations and preserved public routes. No live/device verification.');
