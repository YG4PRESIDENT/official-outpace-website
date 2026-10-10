import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const pages=['index','404','how-it-works','privacy','terms','rules','support','delete-account'];
const failures=[];let refs=0;
for(const name of pages){
 const file=path.join(root,name+'.html');if(!fs.existsSync(file)){failures.push(`${name}: missing`);continue;}
 const text=fs.readFileSync(file,'utf8');
 const check=(ok,msg)=>{if(!ok)failures.push(`${name}: ${msg}`)};
 check((text.match(/<h1(?:\s|>)/g)||[]).length===1,'expected one H1');
 check(text.includes('name="viewport"'),'viewport missing');
 check(text.includes('rel="canonical"'),'canonical missing');
 check(text.includes('name="description"'),'description missing');
 check(name==='404'?text.includes('<base href="/">'):!/<base\b/i.test(text),'only the 404 page should resolve nested URLs from the site root');
 check(text.includes('id="main"')&&text.includes('Skip to content'),'skip link missing');
 check(!/<form\b|<iframe\b/i.test(text),'unexpected form or iframe');
 const scripts=[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 check(scripts.length===1,'expected one footer module');
 check(scripts.every(([,attrs,body])=>/\btype="module"/.test(attrs)&&/\bsrc="(?:\.\/|\/)assets\/footer-physics-[\w-]+\.js"/.test(attrs)&&!body.trim()),'unexpected inline or external script');
 check(!/support@virtualpiratesllc\.com|Supabase|script\.google\.com|YOUR_|TODO|Lorem ipsum/.test(text),'stale content');
 check(!/App Store|Google Play/.test(text)||!/(apps\.apple\.com|play\.google\.com)/.test(text),'unverified store destination');
 for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){
  const value=match[1]; if(/^(https?:|mailto:|data:)/.test(value))continue;
  if(value.startsWith('#')){check(text.includes(`id="${value.slice(1)}"`),`missing anchor ${value}`);continue;}
  const [pathname,anchor]=value.split('#');let dest=pathname.startsWith('/')?path.join(root,pathname):path.resolve(path.dirname(file),pathname);if(value==='./'||value==='/')dest=path.join(root,'index.html');
  check(fs.existsSync(dest),`missing ${value}`);refs++;
  if(anchor&&fs.existsSync(dest))check(fs.readFileSync(dest,'utf8').includes(`id="${anchor}"`),`missing destination anchor ${value}`);
 }
 for(const img of text.matchAll(/<img\b([^>]+)>/g))check(/\balt="[^"]*"/.test(img[1]),'image missing alt');
}
const assets=fs.readdirSync(path.join(root,'assets'));
const js=assets.filter(x=>x.endsWith('.js'));
if(js.length!==1||!/^footer-physics-[\w-]+\.js$/.test(js[0]))failures.push('Expected only the same-origin footer JavaScript bundle');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`PASS: ${pages.length} pages; ${refs} local references; metadata, headings, skip links, image alt, one same-origin footer module, no forms/iframes, no stale support/stack.`);
