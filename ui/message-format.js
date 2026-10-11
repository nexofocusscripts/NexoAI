export function messageBlocks(text){
 const lines=String(text||'').split(/\r?\n/),blocks=[];let paragraph=[],code=null;
 const flush=()=>{if(paragraph.length){blocks.push({type:'text',text:paragraph.join('\n')});paragraph=[]}};
 for(const line of lines){
  if(code){if(/^\s*```\s*$/.test(line)){blocks.push({...code,text:code.lines.join('\n')});code=null}else code.lines.push(line);continue}
  const fence=line.match(/^\s*```([a-zA-Z0-9_+#.-]*)\s*$/);
  if(fence){flush();code={type:'code',language:fence[1],lines:[]};continue}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);if(heading){flush();blocks.push({type:'heading',level:heading[1].length,text:heading[2]});continue}
  const item=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);if(item){flush();blocks.push({type:'item',text:item[1]});continue}
  if(!line.trim())flush();else paragraph.push(line);
 }
 flush();if(code)blocks.push({...code,text:code.lines.join('\n')});return blocks;
}
