# Trabalho em curso após a v1.0.5

Este ramo contém desenvolvimento ainda não entregue num instalador. A versão pública e o canal estável continuam na v1.0.5.

Candidato em validação: 1.0.6. Não distribuir antes da verificação do pacote desktop final.

## Melhorias em validação

- Contexto do projeto: prioridade aos caminhos mencionados no pedido; ficheiros integrais em vez de cortes silenciosos; omissões identificadas; credenciais e binários excluídos; alteração/remoção de ficheiros omitidos bloqueada nas fases de planeamento, revisão e correção. Orçamento de conteúdo de 18 mil caracteres; ficheiros maiores exigem divisão ou um pedido mais específico. Não é leitura ilimitada de repositórios.
- Projeto Python com vários ficheiros: teste de integração real AppContainer força falha inicial, corrige a implementação, preserva quatro testes autorizados, cria ZIP e recupera o projeto original. As respostas deste teste são controladas; não é uma avaliação da qualidade de um modelo real.
- LM Studio (porta local 1234) e llama.cpp (8080): deteção de servidor existente, modelos e chat pela API compatível. Ligações estritamente loopback sem redirecionamentos. Instalação e remoção continuam no gestor próprio; não declarar estes motores instalados automaticamente. Compatibilidade validada com servidor simulado, ainda sem as duas aplicações reais.
- Configuração Anthropic na interface, com chave no cofre Windows e consentimento exato existente. Sem chave paga, não foi feita uma chamada comercial real.
- Download de atualização integrado: consulta assinada, segunda autorização para download com origem/tamanho, progresso/cancelamento, checksum do pacote, assinatura e checksum do instalador, confirmação separada para instalar. Só aceita os assets oficiais. Teste real com o pacote público 1.0.5 passou sem instalar nada.
- Corrigido o canal público 1.0.5: o checksum do pacote antigo não correspondia ao asset publicado; novo manifesto assinado aponta ao checksum real. Os binários públicos não mudaram.
- Mensagens com blocos de código e cópia, títulos e listas; HTML recebido permanece texto. Corrigida uma variável que impedia anexar PNG/JPEG ao ocultar o objeto document do navegador. PDF/DOCX continuam a ser lidos localmente.

Validação: 74/74 testes locais passaram com C# ativo; CI do executor C# e contribuições passaram no commit 3bb8cd3. Fluxo de navegador com backend e AppContainer reais passou antes da última correção de anexos; repetir esse fluxo e a compilação final após essa correção.

Limites ainda a validar: teste exigente com modelo de programação real (o Qwen14B anterior já não está disponível no caminho conhecido); instalador deste candidato em runner Windows; instalação de WebView2 quando ausente; outras GPUs e providers comerciais. O ambiente permite AppContainer e testes desktop em CI, mas não comprova todos os computadores Windows. Authenticode permanece em standby.

Ordem autorizada: executores; qualidade do agente em projetos maiores; providers/runtimes; download integrado de atualizações; imagens/documentos; validação Windows/hardware; usabilidade. Authenticode permanece em standby.

## Execução

- Node mantém o executor existente.
- Python 3.13.16 embeddable é preparado com SHA-256 oficial e incluído no instalador. Comando: `python -m unittest discover`, opcionalmente `-s tests -p test_*.py`. Biblioteca padrão, sem pip durante os testes.
- Lua 5.4.9 é compilado a partir da fonte oficial verificada. `lua checks.lua` disponibiliza `test(nome, função)` e exige testes reais. FiveM é um caso de Lua; o executor não inicia um servidor FiveM.
- C# tem um runtime opcional preparado pela aplicação após confirmação de um download oficial de 300 608 304 bytes. Compila código e testes separadamente com Roslyn e a biblioteca padrão .NET 10. `csharp test tests` executa métodos `[NexoTest] public static void/Task` e disponibiliza `NexoAssert`. Não compila projetos MSBuild com NuGet, interfaces gráficas ou serviços externos.
- Os novos executores mantêm AppContainer sem rede, limites de processos/memória/tempo, autorização única, proteção dos testes e prova da versão atual do projeto antes do ZIP.

Validação local: 65/65 testes passaram com C# ativado; provas reais de Python, Lua e C# incluem comportamento, falhas, ausência de testes, ficheiros privados e rede (Python/C#). Interface anterior passou após a primeira integração de Python/Lua; as alterações seguintes exigem nova revisão. Não declarar validado o instalador deste ramo até construir e testar o pacote final.

Fontes oficiais: https://www.python.org/downloads/release/python-31316/ ; https://www.lua.org/ftp/ ; https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json . Licenças de Python acompanham o runtime; a fonte e licença Lua estão em native/vendor/lua-5.4.9; os avisos Microsoft são preservados no runtime opcional.
