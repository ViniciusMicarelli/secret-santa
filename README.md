# Entre Nós

Aplicação de amigo secreto com Go, React/Vite e PostgreSQL. Veja o [plano do produto](docs/plano.md).

## Desenvolvimento

Requisitos: Go 1.27.4 ou superior, Node 22+ e Docker.

```sh
docker compose up -d
cd apps/api
DATABASE_URL='postgres://santa:santa@localhost:5432/santa?sslmode=disable' go run ./cmd/api
```

Em outro terminal:

```sh
cd apps/web
npm install
npm run dev
```

Acesse http://localhost:5173. O Vite encaminha `/api` para a API local. A API aplica migrations versionadas ao iniciar, usando um bloqueio no PostgreSQL. Não há Redis nem envio de e-mail. Em Segurança, gere e guarde os códigos de recuperação antes de precisar deles; eles são exibidos somente uma vez.

## Railway

Crie um serviço PostgreSQL separado e dois serviços a partir do repositório, com os Dockerfiles `apps/api/Dockerfile` e `apps/web/Dockerfile` e respectivos diretórios como contexto de build. Na API configure `DATABASE_URL` com a URL privada do PostgreSQL, `ENV=production` e use o `PORT` injetado pela Railway. No frontend configure `API_URL` como URL HTTP privada da API, incluindo porta (por exemplo `http://api.railway.internal:8080`), e ajuste a porta da API conforme a configuração. Exponha o frontend publicamente por HTTPS. O nginx usa `PORT` injetado pela Railway e encaminha `/api` ao backend.

O limitador de tentativas usa PostgreSQL e, por padrão, considera o endereço da conexão. Com proxy confiável que sobrescreva `X-Real-IP`, configure `TRUST_PROXY=true` na API; valide antes a cadeia de proxies para evitar endereços falsificados ou um limite compartilhado por todos os usuários.

O chat e a tela do grupo recebem atualizações por WebSocket. O PostgreSQL distribui notificações entre instâncias via LISTEN/NOTIFY, sem Redis; o navegador reconecta e consulta o estado novamente após desconexões. O proxy precisa permitir upgrade WebSocket e manter a conexão aberta. Os eventos contêm apenas o tipo da atualização; os dados privados continuam protegidos pela API. Cada instância da API usa uma conexão do pool para escutar eventos.

O processo da API verifica sorteios pendentes a cada minuto. O banco bloqueia a rodada durante a execução para impedir resultados duplicados entre instâncias; sorteios pendentes são retomados após reinício. O horário pode atrasar em caso de indisponibilidade. Antes de colocar em produção pública, conclua os itens de segurança, migração e operação em `docs/plano.md`.

## Testes

Com o banco local em execução:

```sh
docker compose exec postgres createdb -U santa santa_test
cd apps/api
TEST_DATABASE_URL='postgres://santa:santa@localhost:5432/santa_test?sslmode=disable' go test -race -count=1 -v ./...
```

Use exclusivamente um banco isolado para testes: a suíte executa o processador de sorteios agendados e pode alterar todos os sorteios pendentes no banco informado. O comando `createdb` é necessário apenas na primeira execução. Denúncias são registradas na tabela `chat_reports`; ainda é necessário definir uma operação de atendimento e moderação antes do lançamento.

## Organização do código

- `apps/api/cmd/api`: inicialização do servidor.
- `apps/api/internal/app`: transporte HTTP e funcionalidades separadas por domínio; `migrations` contém o esquema versionado.
- `apps/web/src/app`: rotas e regras de navegação.
- `apps/web/src/pages`: telas e componentes específicos de cada fluxo.
- `apps/web/src/features`: componentes funcionais reutilizáveis, como a revelação.
- `apps/web/src/shared`: cliente HTTP, tipos e componentes compartilhados.
- `apps/web/src/styles`: estilos base e identidade natalina.

O backend continua sendo um monólito modular com um único pacote interno e acesso compartilhado ao banco; essa organização não implementa ainda injeção de dependências nem separação em serviços independentes.
