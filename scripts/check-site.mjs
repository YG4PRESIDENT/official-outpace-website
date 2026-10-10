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
 check(text.includes('id="main"')&&text.includes('Skip to content'),'skip link missing');
 check(!/<script\b|<form\b|<iframe\b/i.test(text),'unexpected script, form or iframe');
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
if(assets.some(x=>x.endsWith('.js')))failures.push('Unexpected JavaScript bundle');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`PASS: ${pages.length} pages; ${refs} local references; metadata, headings, skip links, image alt, no runtime JS/forms, no stale support/stack.`);
