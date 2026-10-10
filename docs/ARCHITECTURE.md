# Arquitetura Nexo AI 1.0

Desktop Tauri/React -> IPC autenticado -> serviço Node local -> adaptadores de runtime -> Ollama.

No modo Agente, o servidor fornece ao modelo contexto limitado ao projeto. O modelo produz um plano estruturado. A UI mostra esse plano; após aprovação, o executor aplica apenas ações conhecidas. Caminhos são canonicalizados e confinados à raiz do projeto. Terminal é separado das operações de ficheiro e exige confirmação.

A memória é isolada por projeto. Soluções candidatas só são promovidas com evidência de testes válidos, ligada ao conteúdo do projeto. Embeddings locais permitem recuperação semântica.

O serviço fica restrito ao loopback e exige token de sessão no desktop. Operações em ficheiros ficam confinadas à raiz do projeto; testes Node autorizados usam AppContainer e limites de recursos. O cofre usa proteção de credenciais Windows. Providers externos e pesquisa são opcionais; o envio exige consentimento de uso único ligado ao destino, credencial e conteúdo exato.

O frontend incorpora extração de documentos/PDF e anexos visuais locais. O motor de geração de imagens é separado dos modelos de visão. A atualização valida assinatura Ed25519 e integridade antes do instalador; a instalação anterior pode ser recuperada. Esta assinatura não é Authenticode.
