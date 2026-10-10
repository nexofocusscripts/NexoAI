# Estado de validação

Versão 1.0.5: desktop Tauri/React, instalador NSIS, onboarding, inventário Windows, Ollama e arquitetura de runtimes, gestão e comparação de modelos, projetos/chats, agente autorizado, isolamento AppContainer, memória persistente/semântica, documentos, visão e imagens locais, serviços externos opcionais com consentimento, auditoria, diagnóstico e atualização local assinada. Design NexoX original adaptado em laranja/amarelo/roxo, temas persistentes.

Novo fluxo de entrega: deteção automática de pedidos ou escolha manual, plano completo antes de autorizar, criação de ficheiros, revisão pelo modelo, testes protegidos, correção iterativa e ZIP com relatório e inventário. Sem provas válidas não há entrega validada. Ver AGENT-DELIVERY.md.

61 testes unitários/integração passaram. Interface testada num navegador invisível com modelo simulado e execução real Windows AppContainer, incluindo falha/correção/repetição e ZIP. O Qwen2.5-Coder 14B real planeou, reviu e criou um módulo de soma, passou testes Node reais no AppContainer e produziu o ZIP. A revisão do plano ocorre antes da autorização; correções posteriores voltam a ser revistas sem alterar testes aprovados. Testes históricos com outros modelos reais, visão, memória, instalador e atualização constam de versões anteriores; não equivalem a repetir todos esses fluxos na versão atual.

Limites: sem certificado Authenticode, canal público de atualização, instalação atual em Windows limpo ou cobertura de todas as GPUs/providers pagos. Executor autónomo limitado a Node. Modelos podem devolver planos ou testes inválidos e exigir nova revisão; não há equivalência garantida a serviços comerciais. O repositório foi publicado pelo utilizador em https://github.com/nexofocusscripts/NexoAI; o código da versão 1.0.4 já está publicado e a publicação de binários depende de autorização explícita.

Consulta opcional de versões assinadas adicionada com consentimento de utilização única, sem dados de projetos. Pipeline Windows de instalação/primeiro arranque em execução no GitHub; não declarar aprovado até obter o resultado. Processo de assinatura Authenticode preparado, ainda sem certificado.
