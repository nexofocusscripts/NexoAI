export function deliveryIntent(prompt,mode='auto'){
 if(mode==='deliver')return true;
 if(mode==='chat')return false;
 const text=String(prompt||'').trim();
 return /^(?:cria(?:r)?|faz(?:er)?|constr[oóu]|implementa|desenvolve|corrige|recria|quero\s+(?:que\s+)?(?:cries|criar|fazer|um projeto))/i.test(text)&&/\b(?:projeto|script|app|site|ficheiros?|zip|programa)\b|c[oó]digo/i.test(text);
}
