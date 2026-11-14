const clean = s => String(s||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const wc = s => clean(s).split(/\s+/).filter(Boolean).length;
const getMeta = (html,name) => {
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
 const t=tags.find(x=>x.toLowerCase().includes('name="'+name.toLowerCase()+'"')||x.toLowerCase().includes("name='"+name.toLowerCase()+"'"))||"";
 return (t.match(/content=["']([^"']*)/i)||[])[1]||"";
};
const privateHost = h => {
 const x=String(h||"").toLowerCase();
 if(x==="localhost"||x.endsWith(".localhost")||x.endsWith(".local")||x==="::1"||x==="0.0.0.0")return true;
 if(/^(127|10)\./.test(x)||/^192\.168\./.test(x)||/^169\.254\./.test(x))return true;
 const m=x.match(/^172\.(\d+)\./);return !!(m&&+m[1]>=16&&+m[1]<=31);
};
const fetchPage=async(url,ms=5000)=>{
 const start=Date.now();
 try{const r=await fetch(url,{redirect:"follow",headers:{"User-Agent":"ToolMitraBot/2.0","Accept":"text/html,application/xml,text/plain,*/*"},signal:AbortSignal.timeout(ms)});return {ok:r.ok,status:r.status,body:(await r.text()).slice(0,200000),headers:r.headers,ms:Date.now()-start};}
 catch(e){return {ok:false,status:0,body:"",headers:new Headers(),ms:Date.now()-start};}
};
const getLinks=(html,origin,host)=>{
 const out=[];
 for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1],origin);if(u.hostname===host&&/^https?:$/.test(u.protocol)&&!/\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js)(?:$|\?)/i.test(u.pathname))out.push(u.href.split("#")[0]);}catch{}}
 return [...new Set(out)];
};
async function handler(req,res){
 try{
 const raw=req.body?.url;if(!raw||typeof raw!=="string")return res.status(400).json({error:"Enter a valid website URL."});
 let target;try{target=new URL(/^https?:\/\//i.test(raw.trim())?raw.trim():"https://"+raw.trim());}catch{return res.status(400).json({error:"That URL does not look valid."});}
 if(!["http:","https:"].includes(target.protocol)||privateHost(target.hostname))return res.status(400).json({error:"Only public HTTP or HTTPS website addresses can be checked."});
 const origin=target.origin,host=target.hostname,home=await fetchPage(origin);
 if(!home.ok)return res.status(502).json({error:"Could not fetch this website (HTTP "+home.status+"). It may block automated requests or be temporarily unavailable."});
 const h=home.body,title=clean((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||""),desc=getMeta(h,"description");
 const h1=(h.match(/<h1\b/gi)||[]).length,viewport=/<meta\b(?=[^>]*\bname=["']viewport["'])/i.test(h);
 const lang=(h.match(/<html\b[^>]*\blang=["']([^"']+)/i)||[])[1]||"";
 const canonical=/<link\b(?=[^>]*\brel=["'][^"']*canonical[^"']*["'])[^>]*\bhref=["']/i.test(h);
 const hasProp=k=>[...h.matchAll(/<meta\b[^>]*>/gi)].some(m=>m[0].toLowerCase().includes("property='"+k+"'")||m[0].toLowerCase().includes('property="'+k+'"'));
 const og=[hasProp("og:title"),hasProp("og:description"),hasProp("og:image")];
 const favicon=/<link\b(?=[^>]*\brel=["'][^"']*icon)/i.test(h)||/<link\b[^>]*href=["']\/favicon\.ico/i.test(h);
 const indexable=!getMeta(h,"robots").toLowerCase().includes("noindex")&&!(home.headers.get("x-robots-tag")||"").toLowerCase().includes("noindex");
 const homepageWords=wc(h),links=getLinks(h,origin,host),nav=/<nav\b/i.test(h);
 const imgs=[...h.matchAll(/<img\b([^>]*)>/gi)],altCount=imgs.filter(m=>/\balt=["'][^"']*["']/i.test(m[1])).length;
 const heads=[...h.matchAll(/<h([1-6])\b/gi)].map(m=>+m[1]);let headingOrder=true;for(let i=1;i<heads.length;i++)if(heads[i]>heads[i-1]+1)headingOrder=false;
 const placeholder=/lorem ipsum|coming soon|under construction|replace this text|sample page|your content here/i.test(clean(h));
 const external=[...h.matchAll(/<a\b[^>]*href=["']https?:\/\/([^"']+)/gi)].filter(m=>!m[1].includes(host)).length;
 const unsafeBlank=[...h.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].some(m=>!/rel=["'][^"']*noopener/i.test(m[0]));
 const secHeaders=["content-security-policy","x-content-type-options","referrer-policy","strict-transport-security"].filter(k=>home.headers.get(k)).length;
 const paths=["/robots.txt","/sitemap.xml","/privacy-policy","/about","/contact","/terms-and-conditions","/disclaimer"];
 const fetched=await Promise.all(paths.map(p=>fetchPage(origin+p,4500)));
 const [robots,sitemap,privacy,about,contact,terms,disclaimer]=fetched;
 const sitemapValid=sitemap.ok&&/<(urlset|sitemapindex)\b/i.test(sitemap.body),sitemapCount=[...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].length;
 const robotsText=robots.body.toLowerCase(),blocksAll=/disallow:\s*\//i.test(robotsText)&&!/allow:\s*\//i.test(robotsText);
 const exists=p=>p.ok&&p.body.length>80&&!/404|page not found/i.test(clean(p.body).slice(0,500));
 const privacyOk=exists(privacy),aboutOk=exists(about),contactOk=exists(contact),termsOk=exists(terms)||exists(disclaimer);
 const policy=clean(privacy.body).toLowerCase(),cookieDisclosure=privacyOk&&/cookies?/.test(policy)&&/(advertis|third.party|google|tracking|personal data)/.test(policy);
 const sampled=await Promise.all(links.slice(0,8).map(u=>fetchPage(u,4500))),good=sampled.filter(p=>p.ok&&p.status<400),broken=sampled.length-good.length;
 const pageWords=good.map(p=>wc(p.body)),avgWords=pageWords.length?Math.round(pageWords.reduce((a,b)=>a+b,0)/pageWords.length):0;
 const totalPages=Math.max(1,sitemapCount||links.length+1),duplicate=!!title&&good.some(p=>clean((p.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"").toLowerCase()===title.toLowerCase());
 const checks=[],add=(category,label,status,detail,fix="",priority="normal")=>checks.push({category,label,status,detail,fix,priority});
 const ck=(cat,label,ok,detail,fix,priority="normal",warning=false)=>add(cat,label,ok?"pass":warning?"warning":"fail",detail,fix,priority);
 const T="Technical & Security",S="SEO & Crawlability",P="Required Pages & Policies",C="Content Quality",N="Navigation & User Experience";
 ck(T,"Website is reachable",home.ok,"Homepage returned HTTP "+home.status+".","Check hosting, DNS and server availability.","critical");
 ck(T,"HTTPS / valid TLS",target.protocol==="https:","Submitted URL uses "+target.protocol.replace(":","").toUpperCase()+".","Enable HTTPS and redirect HTTP to HTTPS.","high");
 ck(T,"Homepage response time",home.ms<2500,"Server response took "+home.ms+" ms; not a full Core Web Vitals test.","Review hosting, caching and server response time.","normal",true);
 ck(T,"Basic security headers",secHeaders>=2,secHeaders+" of 4 common security headers detected.","Review CSP, X-Content-Type-Options, Referrer-Policy and HSTS.","normal",true);
 ck(T,"Favicon",favicon,favicon?"Favicon link detected.":"No favicon link detected.","Add a favicon and link it from the page head.","low",true);
 ck(T,"HTML language attribute",!!lang,lang?"HTML language is "+lang+".":"No html lang attribute detected.","Set an accurate lang attribute, e.g. lang=en.","normal",true);
 ck(T,"Mobile viewport",viewport,viewport?"Viewport meta tag found.":"No viewport meta tag detected.","Add a responsive viewport meta tag.","high",true);
 ck(S,"Page title",!!title,title?"Title: "+title.slice(0,100):"No HTML title tag detected.","Add a unique, descriptive homepage title.","high");
 ck(S,"Title length",title.length>=25&&title.length<=65,"Title contains "+title.length+" characters; guideline only.","Use a concise descriptive title.","normal",true);
 ck(S,"Meta description",!!desc,desc?"Meta description found ("+desc.length+" characters).":"No meta description detected.","Add a useful, unique meta description.","normal",true);
 ck(S,"Meta description length",desc.length>=70&&desc.length<=170,"Description contains "+desc.length+" characters.","Write a natural page summary.","low",true);
 ck(S,"H1 heading",h1===1,"Found "+h1+" H1 heading(s).","Use one clear main heading and logical subheadings.","normal",true);
 ck(S,"Canonical URL",canonical,canonical?"Canonical link detected.":"No canonical link detected.","Add a correct rel=canonical URL if needed.","normal",true);
 ck(S,"Open Graph social tags",og.every(Boolean),og.every(Boolean)?"All three Open Graph tags were detected.":["og:title","og:description","og:image"].filter((x,i)=>!og[i]).join(", ")+" missing.","Add og:title, og:description and og:image tags.","low",true);
 ck(S,"Homepage indexability",indexable,indexable?"No noindex directive detected.":"A noindex directive was detected.","Remove unintended noindex directives from public pages.","critical");
 ck(S,"robots.txt exists",robots.ok,robots.ok?"robots.txt responded.":"Could not find /robots.txt.","Publish robots.txt at the domain root.","normal",true);
 ck(S,"Robots allows crawling",robots.ok&&!blocksAll,robots.ok?(blocksAll?"A broad Disallow: / rule may block crawlers.":"No broad site-wide Disallow rule detected."):"Could not inspect robots.txt.","Review robots.txt and allow crawling of intended public pages.","high",true);
 ck(S,"XML sitemap",sitemapValid,sitemapValid?"XML sitemap structure detected; "+sitemapCount+" URL entries.":"No XML sitemap structure detected at /sitemap.xml.","Publish an XML sitemap and submit it in Search Console.","normal",true);
 ck(S,"Sitemap coverage",sitemapValid&&sitemapCount>=Math.min(5,totalPages),sitemapValid?sitemapCount+" sitemap entries detected.":"Cannot estimate sitemap coverage.","Include canonical indexable pages in the sitemap.","low",true);
 ck(S,"Duplicate homepage title",!duplicate,duplicate?"A sampled page uses the same title as homepage.":"No duplicate homepage title found in sampled pages.","Give important pages unique titles.","low",true);
 ck(P,"Privacy Policy page",privacyOk,privacyOk?"A substantive /privacy-policy response was found; review contents manually.":"Could not confirm a substantive /privacy-policy page.","Publish a clear Privacy Policy page.","critical");
 ck(P,"Privacy policy cookie / ad disclosure",cookieDisclosure,cookieDisclosure?"Cookie and advertising wording detected; verify completeness.":"Could not detect cookie and advertising / third-party wording together.","Explain relevant cookies, advertising partners, data use and user choices.","critical",true);
 add(P,"Cookie consent requirements","info","Automated scanning cannot determine which consent solution your audience and regions require.","Review consent requirements for your visitors and configure an appropriate solution where required.","normal");
 ck(P,"About page",aboutOk,aboutOk?"A substantive /about response was found.":"Could not confirm a substantive /about page.","Explain who operates the site and its purpose.","normal",true);
 ck(P,"Contact page",contactOk,contactOk?"A substantive /contact response was found.":"Could not confirm a substantive /contact page.","Provide a working contact method.","normal",true);
 ck(P,"Terms or disclaimer page",termsOk,termsOk?"A terms or disclaimer page responded.":"Could not confirm terms or disclaimer page.","Add terms or a disclaimer where relevant.","low",true);
 ck(P,"Policy page linked from homepage",/privacy|policy/i.test(h),/privacy|policy/i.test(h)?"A policy-related link appears on homepage.":"No obvious policy link found on homepage.","Make important policy pages easy to find, commonly in the footer.","normal",true);
 ck(C,"Homepage content depth",homepageWords>=300,"About "+homepageWords+" visible homepage words; rough heuristic only.","Add useful original homepage copy explaining your site's purpose and value.","critical",true);
 ck(C,"Content depth on sampled pages",avgWords>=250,"Average "+avgWords+" visible words across "+good.length+" sampled pages.","Review key pages for helpful original information; avoid thin content.","high",true);
 ck(C,"Published page discovery",totalPages>=10,"Estimated "+totalPages+" URLs; there is no fixed Google page-count rule.","Publish genuinely useful pages, not pages made only to reach a number.","high",true);
 ck(C,"Heading structure",headingOrder&&heads.length>=2,heads.length+" headings detected; hierarchy "+(headingOrder?"looks consistent.":"has skipped levels."),"Use descriptive H2/H3 headings in logical order.","normal",true);
 ck(C,"Placeholder / under-construction text",!placeholder,placeholder?"Possible placeholder wording detected.":"No common placeholder phrases detected.","Replace demo copy and unfinished sections with useful content.","high");
 add(C,"Restricted-content policy review","info","Automated text matching cannot reliably determine whether every page complies with AdSense content policies.","Manually review important pages against current AdSense programme policies.","high");
 ck(C,"Image alternative text",imgs.length===0||altCount===imgs.length,altCount+" of "+imgs.length+" homepage images have alt attributes.","Add meaningful alt text to informative images; empty alt for decorative images.","normal",true);
 ck(N,"Internal navigation links",links.length>=5,links.length+" unique internal links detected on homepage.","Add clear navigation to important sections and useful pages.","normal",true);
 ck(N,"Navigation landmark",nav,nav?"A nav landmark was detected.":"No semantic nav element detected.","Use a clear accessible navigation landmark.","low",true);
 ck(N,"Sampled internal page availability",sampled.length===0||broken===0,broken+" of "+sampled.length+" sampled internal pages failed or returned errors.","Fix broken links and remove links to unavailable pages.","high",true);
 ck(N,"Safe new-tab links",!unsafeBlank,unsafeBlank?"Some target=_blank links may lack rel=noopener.":"No unsafe target=_blank pattern detected.","Add rel=noopener noreferrer to links opened in a new tab.","low",true);
 ck(N,"Internal / external link balance",links.length>0&&external<=links.length*3,links.length+" internal and "+external+" external homepage links detected; review in context.","Keep navigation useful and outbound links relevant.","low",true);
 const cats=[T,S,P,C,N],categoryStats=cats.map(category=>{const a=checks.filter(x=>x.category===category),s=a.filter(x=>x.status!=="info"),p=s.filter(x=>x.status==="pass"),w=s.filter(x=>x.status==="warning");return {category,total:a.length,passed:p.length,warnings:w.length,failed:s.filter(x=>x.status==="fail").length,info:a.filter(x=>x.status==="info").length,percent:s.length?Math.round((p.length+w.length*.5)/s.length*100):100};});
 const scored=checks.filter(x=>x.status!=="info"),passed=scored.filter(x=>x.status==="pass").length,warnings=checks.filter(x=>x.status==="warning").length,failed=checks.filter(x=>x.status==="fail").length,info=checks.filter(x=>x.status==="info").length;
 const score=Math.round(scored.reduce((n,x)=>n+(x.status==="pass"?1:x.status==="warning"?.5:0),0)/scored.length*100),critical=checks.some(x=>x.status==="fail"&&x.priority==="critical");
 const readiness=critical?"Not Ready":score>=85?"Good preliminary signals":score>=70?"Review before applying":"Needs improvement",order={critical:0,high:1,normal:2,low:3};
 const fixesFirst=checks.filter(x=>x.status==="fail"||x.status==="warning").sort((a,b)=>order[a.priority]-order[b.priority]).slice(0,8);
 return res.json({score,readiness,summary:"Preliminary scan of "+host+". "+passed+" checks passed, "+warnings+" warnings, "+failed+" failed and "+info+" manual-review items. This is not an AdSense approval prediction.",counts:{total:checks.length,passed,warnings,failed,info},categoryStats,fixesFirst,checks,scannedAt:new Date().toISOString(),loadTimeMs:home.ms,homepageWords,totalPages,sampledPages:sampled.length,disclaimer:"ToolMitra is independent and is not affiliated with Google. This automated review uses public website signals and heuristics; it cannot confirm policy compliance, content originality, account eligibility or guarantee AdSense approval."});
 }catch(e){return res.status(500).json({error:"The scan could not be completed. Please try again later."});}
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a valid website URL." }, { status: 400 });
  }

  let statusCode = 200;
  let payload = { error: "The scan could not be completed." };
  const responseAdapter = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    }
  };

  await handler({ body }, responseAdapter);
  return Response.json(payload, {
    status: statusCode,
    headers: { "Cache-Control": "no-store" }
  });
}
