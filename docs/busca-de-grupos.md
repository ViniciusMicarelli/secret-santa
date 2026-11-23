# Busca de grupos

A página de grupos permite buscar pelo nome ou descrição, filtrar pelo nome de um participante, estado do sorteio e intervalo de datas da confraternização, e ordenar por criação ou data da confraternização. A busca usa o dicionário de português do PostgreSQL e também aceita trechos literais. Os resultados são paginados em 12 itens e restritos aos grupos dos quais a conta autenticada participa.

A API expõe `GET /api/groups/search`, com parâmetros opcionais `q`, `participant`, `status`, `from`, `to`, `sort` e `page`. As datas usam `YYYY-MM-DD` e os limites são inclusivos. O endpoint existente `GET /api/groups` continua disponível. Uma conexão autenticada em `/api/events` atualiza a busca e os avisos de mensagens mesmo quando o grupo não está na página atual; eventos são enviados apenas a membros autorizados.

A migração `004_group_search.sql` cria os índices necessários no PostgreSQL configurado para a API; não é necessária extensão adicional ou Redis.
