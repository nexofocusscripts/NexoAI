# Trabalho em curso após a v1.0.5

Este ramo contém desenvolvimento ainda não entregue num instalador. A versão pública e o canal estável continuam na v1.0.5.

Ordem autorizada: executores; qualidade do agente em projetos maiores; providers/runtimes; download integrado de atualizações; imagens/documentos; validação Windows/hardware; usabilidade. Authenticode permanece em standby.

## Execução

- Node mantém o executor existente.
- Python 3.13.16 embeddable é preparado com SHA-256 oficial e incluído no instalador. Comando: `python -m unittest discover`, opcionalmente `-s tests -p test_*.py`. Biblioteca padrão, sem pip durante os testes.
- Lua 5.4.9 é compilado a partir da fonte oficial verificada. `lua checks.lua` disponibiliza `test(nome, função)` e exige testes reais. FiveM é um caso de Lua; o executor não inicia um servidor FiveM.
- C# tem um runtime opcional preparado pela aplicação após confirmação de um download oficial de 300 608 304 bytes. Compila código e testes separadamente com Roslyn e a biblioteca padrão .NET 10. `csharp test tests` executa métodos `[NexoTest] public static void/Task` e disponibiliza `NexoAssert`. Não compila projetos MSBuild com NuGet, interfaces gráficas ou serviços externos.
- Os novos executores mantêm AppContainer sem rede, limites de processos/memória/tempo, autorização única, proteção dos testes e prova da versão atual do projeto antes do ZIP.

Validação local: 65/65 testes passaram com C# ativado; provas reais de Python, Lua e C# incluem comportamento, falhas, ausência de testes, ficheiros privados e rede (Python/C#). Interface anterior passou após a primeira integração de Python/Lua; as alterações seguintes exigem nova revisão. Não declarar validado o instalador deste ramo até construir e testar o pacote final.

Fontes oficiais: https://www.python.org/downloads/release/python-31316/ ; https://www.lua.org/ftp/ ; https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json . Licenças de Python acompanham o runtime; a fonte e licença Lua estão em native/vendor/lua-5.4.9; os avisos Microsoft são preservados no runtime opcional.
