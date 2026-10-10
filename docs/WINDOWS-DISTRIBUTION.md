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
