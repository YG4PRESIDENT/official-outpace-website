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
 const bases=[...text.matchAll(/<base\b[^>]*>/gi)];
 check(name==='404'?bases.length===1&&bases[0][0]==='<base href="/">':bases.length===0,'only the 404 page should have one root base');
 check(text.includes('id="main"')&&text.includes('Skip to content'),'skip link missing');
 check(!/<form\b|<iframe\b/i.test(text),'unexpected form or iframe');
 const scripts=[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 const dataScripts=scripts.filter(([,attrs])=>/^\s+type="application\/ld\+json"\s*$/.test(attrs));
 const runtimeScripts=scripts.filter(script=>!dataScripts.includes(script));
 check(runtimeScripts.length===1,'expected one footer module');
 check(runtimeScripts.every(([,attrs,body])=>/\btype="module"/.test(attrs)&&/\bsrc="(?:\.\/|\/)assets\/footer-physics-[\w-]+\.js"/.test(attrs)&&!body.trim()),'unexpected inline or external executable script');
 check(dataScripts.length===(name==='index'?1:0),'expected one homepage-only JSON-LD data block');
 if(dataScripts.length){
  try{const data=JSON.parse(dataScripts[0][2]);check(JSON.stringify(data)===JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'Outpace',url:'https://outpaceapp.com/',inLanguage:'en'}),'unexpected WebSite structured data');}
  catch{check(false,'invalid structured-data JSON');}
 }
 check(text.includes('property="og:image" content="https://outpaceapp.com/outpace-social.png"'),'social preview missing');
 check(text.includes('property="og:image:width" content="1200"')&&text.includes('property="og:image:height" content="630"'),'social preview dimensions missing');
 check(text.includes('name="twitter:card" content="summary_large_image"')&&text.includes('name="twitter:image:alt"'),'Twitter preview metadata missing');
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
for(const file of ['outpace-social.png','favicon.ico','favicon-32.png','apple-touch-icon.png'])if(!fs.existsSync(path.join(root,file)))failures.push(`Missing metadata asset ${file}`);
const assets=fs.readdirSync(path.join(root,'assets'));
const js=assets.filter(x=>x.endsWith('.js'));
if(js.length!==1||!/^footer-physics-[\w-]+\.js$/.test(js[0]))failures.push('Expected only the same-origin footer JavaScript bundle');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`PASS: ${pages.length} pages; ${refs} local references; metadata, headings, skip links, image alt, one same-origin footer module, no forms/iframes, no stale support/stack.`);
