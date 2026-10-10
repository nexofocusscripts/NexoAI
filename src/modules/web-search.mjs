export function webSearchService(settings){
 const cfg=settings.search||{};
 return {async search(query,{limit=8}={}){
  if(!settings.onlineMode||!settings.webSearch) throw Error('Pesquisa web desativada.');
  if(cfg.provider==='searxng'&&cfg.baseUrl){const u=new URL('/search',cfg.baseUrl);u.searchParams.set('q',query);u.searchParams.set('format','json');let r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok)throw Error(`Pesquisa HTTP ${r.status}`);let d=await r.json();return (d.results||[]).slice(0,limit).map(x=>({title:x.title,url:x.url,snippet:x.content||''}))}
  if(cfg.provider==='brave'&&cfg.apiKey){let u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',query);u.searchParams.set('count',String(limit));let r=await fetch(u,{headers:{accept:'application/json','x-subscription-token':cfg.apiKey}});if(!r.ok)throw Error(`Pesquisa HTTP ${r.status}`);let d=await r.json();return (d.web?.results||[]).map(x=>({title:x.title,url:x.url,snippet:x.description||''}))}
  throw Error('Configura SearXNG ou Brave Search nas Definições.');
 }}
}
