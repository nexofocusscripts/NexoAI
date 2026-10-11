import {executorIdentity} from './test-executors.mjs';
const guides={
 node:'Usa node:test e node:assert/strict, com assert.equal (nunca t.equal). Comando obrigatório: node --test caminho.test.mjs. Os testes devem importar e executar a implementação real.',
 python:'Cria código Python e testes com unittest.TestCase e assertEqual/assertRaises. Usa apenas a biblioteca padrão, sem pip. Comando obrigatório: python -m unittest discover. Guarda testes test_*.py na raiz, ou usa -s tests para uma pasta de testes. Testa a implementação importada, não uma cópia da lógica.',
 lua:'Cria código Lua 5.4 e um ficheiro checks.lua. O executor fornece test("nome",function() ... end); dentro usa assert para verificar a implementação importada por require. Comando obrigatório: lua checks.lua. Não precisas de instalar frameworks. Para FiveM, valida lógica separável com mocks explícitos; nunca declares que o servidor FiveM foi executado.',
 csharp:'Cria código C# .NET 10 com classes públicas e testes numa pasta tests. O executor compila a implementação e os testes separadamente usando a biblioteca padrão, sem NuGet ou MSBuild. Nos testes usa [NexoTest] em métodos public static void ou public static Task sem argumentos; usa NexoAssert.Equal(esperado,recebido), NexoAssert.True ou NexoAssert.Throws<Exception>(()=>...). Comando obrigatório: csharp test tests. Não cries NexoTest/NexoAssert/NexoRunner: são fornecidos pelo executor. Não declares validada uma aplicação GUI, csproj com dependências ou serviço externo.'
};
export async function executionGuide({executor='auto',prompt='',files=[],dotnetRoot}){
 if(!['auto',...Object.keys(guides)].includes(executor))throw Error('Escolha de executor inválida.');
 let selected=executor;
 if(selected==='auto'){
  if(/\b(python|django|flask)\b|\.py\b/i.test(prompt))selected='python';
  else if(/\b(lua|fivem)\b|\.lua\b/i.test(prompt))selected='lua';
  else if(/c#|\bcsharp\b|\.net\b|\bdotnet\b/i.test(prompt))selected='csharp';
  else if(/\b(java|rust|golang)\b/i.test(prompt))throw Error('Este ambiente ainda não tem testes dessa linguagem. Não vou declarar a entrega validada através de um teste Node que não executa a implementação.');
  else{const names=files.map(f=>f.path||f);selected=names.some(n=>/\.py$/.test(n))&&!names.some(n=>/\.[cm]?js$/.test(n))?'python':names.some(n=>/\.lua$/.test(n))&&!names.some(n=>/\.[cm]?js$/.test(n))?'lua':names.some(n=>/\.(?:cs|csproj)$/.test(n))&&!names.some(n=>/\.[cm]?js$/.test(n))?'csharp':'node'}
 }
 await executorIdentity(selected,{dotnetRoot});return {executor:selected,instructions:guides[selected]};
}
