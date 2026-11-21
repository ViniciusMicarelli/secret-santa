# Plano do produto

Entre Nós reúne grupos para um amigo secreto: convite por link, regras por família, sorteio imediato ou agendado, revelação individual, lista de desejos e conversas anônimas. Não há envio de e-mail, integração com WhatsApp ou upload de arquivos. A identidade visual usa tons natalinos de vinho, creme e verde.

## Regras

Participantes entram com conta; somente o organizador configura o grupo. O sorteio exige três participantes e uma atribuição válida, não permite tirar a si mesmo ou alguém da mesma família. Uma vez liberado, os pares não mudam. A execução agendada é verificada periodicamente e pode atrasar alguns minutos. Se as regras não permitirem o sorteio, o grupo exige ajustes. O servidor só retorna o próprio resultado; o organizador não recebe privilégios para ver os demais pares. Chat é anônimo na interface, não em relação à infraestrutura.

## Evolução

Recuperação de conta usa códigos de uso único exibidos na área de segurança. Há revogação de convites, remoção de participantes antes do sorteio, favorito na lista, indicadores de mensagens não lidas, registro de denúncias e encerramento de sessões em todos os dispositivos com confirmação de senha. O limitador de tentativas usa PostgreSQL. As migrations são versionadas e serializadas por bloqueio no banco.

Dependentes, restrições individuais e e-mail são posteriores. Antes de lançamento público: revisão de segurança independente, política de privacidade, exclusão de dados, interface e processo de moderação de denúncias, backups e testes de restauração, monitoramento, verificação da cadeia de proxies para limites de tentativas e revisão de acessibilidade.
