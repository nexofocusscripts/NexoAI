# Contribuir

Descreve o problema, o comportamento esperado e como verificar a alteração. Mantém propostas pequenas e não incluas modelos, dados de utilizadores, tokens, certificados ou chaves privadas.

## Preparação Windows x64

Instala PowerShell 7, Node 24.21.0, Rust estável com destino MSVC, Visual Studio Build Tools com C++ x64 e Windows SDK. Na pasta do projeto:

```text
npm ci
npm test
npm run ui:build
pwsh -File scripts/build-desktop.ps1
```

O último comando compila os quatro auxiliares nativos e obtém o runtime Node do domínio oficial, verificando o checksum. O instalador fica em `src-tauri/target/release/bundle/nsis`. Estes comandos destinam-se a quem desenvolve; utilizadores instalam pelo assistente gráfico.

`npm run ui:dev` inicia a interface de desenvolvimento. O desktop integra o serviço local por IPC; abrir apenas a interface no browser não reproduz todas as funcionalidades do desktop. Os testes Node usam dados isolados. `tests/browser-flow.mjs` usa Edge, um runtime simulado e a fixture PDF em `tests/fixtures/documento-local.pdf`; executa-o com `node tests/browser-flow.mjs`. Não equivale a um teste de instalação. Não uses os teus projetos reais para testes destrutivos.

Alterações nas permissões, no sandbox, no cofre ou no consentimento externo precisam de testes do comportamento de segurança. Não enfraqueças as confirmações para fazer uma demonstração passar. Declara o que testaste e as limitações. Não prometas capacidade equivalente a um modelo comercial com base em sondas simples.

Ao distribuir versões derivadas, disponibiliza o código correspondente segundo GPLv3 e preserva licenças de terceiros. Os forks precisam das suas próprias chaves de atualização: `config/update-public.pem` identifica este projeto, mas a chave privada não é distribuída. Builds sem assinatura de editor podem gerar avisos Windows.
