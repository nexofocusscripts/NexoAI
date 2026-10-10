# Nexo AI

Plataforma local-first de IA com projetos, modelos locais, agentes, memória, ferramentas, imagens e integrações online opcionais.

## Windows
Utiliza o instalador gráfico `Nexo AI_<versão>_x64-setup.exe` do pacote final. Abre a aplicação pelo menu Iniciar e segue o primeiro arranque para analisar o computador e configurar os modelos. A utilização normal não requer PowerShell, npm ou ficheiros de arranque.

Em Modelos podes comparar capacidades e requisitos, selecionar manualmente ou escolher uma prioridade automática. As medições locais são sondas voluntárias, não uma avaliação universal de inteligência.

## Limites atuais
O agente altera ficheiros mediante autorização e executa testes Node num sandbox Windows. Pedidos de criação podem usar o modo automático ou «Criar e entregar ZIP»: o utilizador revê o plano e os testes antes de autorizar; o agente cria ficheiros, pede uma revisão ao modelo local, corrige falhas e prepara o ZIP apenas com provas válidas dos testes. «Só conversar» permite desativar este fluxo. A revisão do modelo e os testes não garantem ausência de erros. A instalação numa máquina Windows limpa e todas as GPUs não foram validadas. Existem atualizações locais assinadas, mas ainda não há canal público de atualizações nem certificado Authenticode de editor.

## Verificação
- `npm test`
- `npm run check`

Para colaborar e compilar o desktop, consulta [CONTRIBUTING.md](CONTRIBUTING.md). Informações de segurança e distribuição estão em [SECURITY.md](SECURITY.md) e [docs/WINDOWS-DISTRIBUTION.md](docs/WINDOWS-DISTRIBUTION.md).

Modo online, pesquisa web e providers externos ficam desligados por defeito.

## Licença
GPL-3.0-only. Dependências e recursos preservam as suas licenças. As chaves privadas, os dados dos utilizadores e os modelos não devem ser publicados no repositório.
