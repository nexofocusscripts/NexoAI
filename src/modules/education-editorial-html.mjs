// Bounded token filtering only; no scripts, embedded documents or remote resources execute.
// Removes community comments so they are not attributed to the institutional publisher.
export function editorialHTML(input){
 const html=String(input);if(html.length>900000)return '';
 const stripped=html.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 const tokens=stripped.match(/<!--[\s\S]*?(?:-->|$)|<[^>]*>|[^<]+/g)||[],stack=[],out=[];
 const empty=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 for(const token of tokens){if(token.startsWith('<!--'))continue;if(!token.startsWith('<')){if(!stack.some(s=>s.hidden))out.push(token);continue;}
  const close=token.match(/^<\/\s*([a-z][\w:-]*)/i);if(close){const name=close[1].toLowerCase(),at=stack.map(s=>s.name).lastIndexOf(name);const hidden=stack.some(s=>s.hidden);if(at>=0)stack.length=at;if(!hidden)out.push(token);continue;}
  const open=token.match(/^<\s*([a-z][\w:-]*)/i);if(!open)continue;const name=open[1].toLowerCase(),attributes=[...token.matchAll(/\b(?:id|class|role)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(m=>m[1]||m[2]||m[3]||'').join(' ');
  const hidden=stack.some(s=>s.hidden)||['script','style','noscript','svg','head','header','nav','footer','iframe','form'].includes(name)||(!['body','html'].includes(name)&&/(?:^|[\s_-])(?:comments?|commentary|forum|cookie|newsletter|related|advertisement)(?:$|[\s_-])/i.test(attributes));
  if(!hidden)out.push(token);if(!empty.has(name)&&!token.endsWith('/>')){if(stack.length>=100)return '';stack.push({name,hidden});}
 }
 return out.join('');
}
