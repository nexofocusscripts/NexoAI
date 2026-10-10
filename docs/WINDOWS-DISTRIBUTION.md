# Distribuição Windows e avisos de segurança

O pacote usa um instalador NSIS normal, sem launcher batch para o utilizador. Os auxiliares nativos são compilados a partir do código incluído, com proteções de memória e fluxo de controlo. O runtime Node vem do domínio oficial e tem checksum verificado. Isto melhora rastreabilidade e endurece a compilação; não é uma prova de ausência de malware.

## Assinatura de editor

Ainda não existe um certificado Authenticode disponível para este projeto. Para distribuição pública com identidade verificável, o mantenedor deve obter um certificado ou serviço de assinatura adequado, proteger a chave e assinar os auxiliares, a aplicação e o instalador com SHA-256 e carimbo de tempo. O runtime Node tem a assinatura do seu próprio editor; não deve ser alterado. O Tauri permite configurar a assinatura Windows no processo de empacotamento.

A assinatura Ed25519 de `.nexoupdate` serve para verificar atualizações aceites pelo Nexo. Não substitui Authenticode nem cria reputação SmartScreen. Não uses um certificado autoassinado para prometer confiança pública.

Segundo a Microsoft, certificados reconhecidos ajudam a construir reputação, mas um novo binário assinado ainda pode gerar avisos. Certificados EV já não garantem dispensa imediata de SmartScreen. Uma via alternativa é MSIX na Microsoft Store, que exige trabalho adicional de empacotamento e certificação; esta versão continua NSIS.

## Deteções de antivírus

Um aviso de editor desconhecido não é a mesma coisa que uma deteção de malware. Regista o produto, a designação exata da deteção, a versão e o hash do ficheiro. Investiga primeiro o binário e as dependências; se houver evidência de falso positivo, submete a amostra ao fornecedor para análise. Não desatives proteções, não adicionas exclusões e não ofusques o programa para contornar deteções.

Nenhuma amostra foi enviada automaticamente para serviços externos. Nenhuma definição de antivírus foi alterada. Não foi medida a reputação desta versão numa máquina limpa com ficheiro descarregado da Internet.

Referências:

- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://v2.tauri.app/distribute/sign/windows/
- https://www.microsoft.com/en-us/wdsi/filesubmission

## Processo de assinatura preparado

O mantenedor pode usar scripts/build-signed-windows.ps1 com a impressão digital de um certificado de código instalado no Windows e o servidor HTTPS de carimbo de tempo indicado pelo emissor. O script recusa certificados ausentes, expirados ou sem cadeia reconhecida, assina os auxiliares, deixa o Node oficial com a assinatura do respetivo editor e exige assinaturas válidas da aplicação e instalador. Não exporta a chave nem guarda palavras-passe. O percurso real de assinatura exige um certificado adequado; nesta máquina só foi verificada a recusa segura quando não existe certificado.

## Canal de versões

Em Definições, ativa Modo online e escolhe Consultar versões online. O pedido exato é apresentado antes da consulta; cancelamento, alterações da configuração e autorizações expiradas impedem o envio. O manifesto tem assinatura Ed25519 e tamanho limitado. A página oficial de downloads abre apenas por ação do utilizador. Depois seleciona o pacote .nexoupdate para rever e instalar, mantendo a recuperação da versão anterior.

O mantenedor prepara o manifesto com scripts/prepare-channel.mjs, mantendo a chave privada fora do repositório. O manifesto só deve ser publicado em updates/stable.json depois de os respetivos ficheiros públicos estarem disponíveis. A publicação do instalador depende de autorização; código publicado não significa que já exista uma versão para descarregar.
