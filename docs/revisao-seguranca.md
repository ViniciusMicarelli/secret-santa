# Revisão de segurança — 21 de novembro de 2026

Revisão local do código e testes automatizados. Este trabalho não é um teste de invasão independente e não garante ausência de vulnerabilidades.

## Escopo verificado

- Autenticação, cookies, revogação de sessão e códigos de recuperação.
- Permissões de grupos, edição de desejos, sorteio e isolamento das conversas e eventos WebSocket.
- Rejeição de origens externas e de URLs de presente com esquema não permitido.
- Limitação de tentativas de autenticação, concorrência de sorteios e cabeçalhos HTTP.
- Dependências JavaScript (`npm audit`) e código Go alcançável (`govulncheck`).
- Configuração Docker e log de acesso do Nginx para rotas de convite.

## Correções

- Go atualizado para 1.27.4 após o scanner apontar vulnerabilidades da biblioteca padrão na versão 1.27.1 usada localmente. A imagem de produção usa a mesma versão corrigida.
- Ao remover um participante, o convite anterior é revogado; quem organiza deve compartilhar o novo link com futuros convidados. Uma pessoa que receba o novo link ainda pode usá-lo: não há lista de bloqueio de usuários.
- Exclusão de desejos exige participação e propriedade; erros internos de edição e sorteio não são devolvidos ao cliente.
- A comparação de senha para usuários desconhecidos também executa bcrypt, reduzindo diferenças de tempo que facilitam identificar contas.
- API usa `Cache-Control: no-store`; Nginx envia proteção contra enquadramento, MIME sniffing e vazamento de referrer, e não grava rotas de convite no seu log de acesso. O servidor Go limita o tempo de leitura de cabeçalhos.
- Variantes de `.env` foram excluídas do Git e dos contextos de build Docker.

## Limitações e implantação

- Configurar `ENV=production` e HTTPS na Railway é necessário para o cookie ter o atributo `Secure`. Em desenvolvimento local HTTP, ele permanece `HttpOnly` e `SameSite=Lax`.
- O limite de autenticação depende do IP visto pela API. Antes do lançamento, validar a cadeia de proxies e `TRUST_PROXY`; um IP compartilhado pode limitar usuários legítimos e um cabeçalho não confiável pode ser falsificado.
- A supressão se aplica ao **log de acesso do Nginx**. Logs de erro, gateways, Railway ou outros proxies externos podem registrar URLs; revisar e configurar sua retenção antes de produção. Convites continuam sendo credenciais de posse.
- Não foram executados testes de carga, auditoria independente, varredura autenticada de infraestrutura da Railway ou testes de segurança em navegadores antigos. Também faltam operação de moderação, exclusão de dados e políticas de retenção/privacidade.
- Os testes de integração exigem um PostgreSQL **isolado**; nunca usar o banco de produção como `TEST_DATABASE_URL`.
