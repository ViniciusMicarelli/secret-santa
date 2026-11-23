# Implantação na Railway

Este guia prepara um ambiente para testes de produção. Revise [a segurança](revisao-seguranca.md) antes de abrir o serviço ao público. A aplicação usa três serviços no mesmo projeto e ambiente: `Postgres`, `api` e `web`. A aplicação não precisa de Redis ou serviço de e-mail.

## 1. Criar projeto e PostgreSQL

1. Crie um projeto vazio na Railway e adicione o serviço PostgreSQL. Chame-o `Postgres` ou ajuste as referências abaixo para o nome usado.
2. Confirme que o serviço possui um volume persistente e que o banco iniciou. Não use o banco do Docker local nem exponha o PostgreSQL publicamente apenas para conectar a API.
3. Configure backups do volume conforme o plano disponível e teste a restauração em um ambiente separado. Backups geram custos e suas condições dependem do plano.

## 2. Criar o serviço `api`

1. Adicione um serviço chamado `api`, conecte-o ao repositório e escolha a branch `master`.
2. Em **Settings → Source → Root Directory**, configure `/apps/api`. A Railway deve detectar o `Dockerfile` desse diretório; não configure comandos personalizados de build ou inicialização.
3. Nas variáveis do serviço, configure:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENV=production
PORT=8080
```

A referência usa a variável privada do serviço PostgreSQL; confira o nome real do serviço e o valor referenciado na Railway. Não copie a senha para o repositório. `ENV=production` ativa `Secure` no cookie; a aplicação pública deve ser acessada por HTTPS.

4. Configure o healthcheck `/api/health`. As migrations são aplicadas pela API ao iniciar, com bloqueio no PostgreSQL. Não execute migrations no build, pois a rede privada só está disponível em runtime.
5. Mantenha a API sem domínio público: o frontend no servidor acessará a API pela rede privada. Use uma instância inicialmente e confira no log se a inicialização e as migrations foram concluídas.
6. Não habilite App Sleep/Serverless para a API se quiser que sorteios agendados sejam processados mesmo sem visitantes. O agendador funciona dentro do processo da API, verifica horários aproximadamente a cada minuto e pode atrasar durante indisponibilidade. Os limites do plano e créditos também podem interromper serviços.

## 3. Criar o serviço `web`

1. Adicione outro serviço a partir do mesmo repositório e branch, chamado `web`.
2. Configure **Root Directory** como `/apps/web`. A Railway deve detectar seu `Dockerfile`.
3. Defina as variáveis:

```text
PORT=8080
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080
```

`api` deve ser o nome exato do serviço criado na etapa anterior. A referência deve ser resolvida pela Railway. O `API_URL` é usado pelo Nginx em runtime, dentro da rede privada, não pelo navegador.

4. Em **Settings → Networking**, gere um domínio público para o `web` e confirme que a porta de destino é `8080`. A Railway fornece HTTPS para o domínio gerado. Você pode configurar um domínio próprio conforme os recursos do seu plano.
5. Abra `https://SEU-DOMINIO.up.railway.app/api/health`: a resposta esperada é `{"status":"ok"}`. Verifique também a landing e a rota `/login`.

## 4. Validar antes de usar

- Crie contas próprias de teste no ambiente de produção: as quatro contas do banco local não são copiadas automaticamente.
- Crie um grupo, entre com três contas, confirme as regras de família e faça um sorteio de teste. Use janelas privadas ou perfis separados.
- Verifique edição de desejos, revelação pelo pote e mensagens entre contas. Com duas janelas abertas, confirme se a notificação e o WebSocket atualizam a tela.
- Faça um teste separado de sorteio agendado e confirme o processamento sem manter o navegador aberto. Não há garantia de execução no segundo exato.
- Confirme HTTPS e, nas ferramentas do navegador, confira que o cookie `session` tem `HttpOnly`, `Secure` e `SameSite=Lax`. Faça logout e verifique que a sessão anterior deixa de funcionar.
- Gere códigos de recuperação, guarde-os com segurança e teste a recuperação em conta de teste. Não há recuperação por e-mail.
- Configure monitoramento externo e alertas, custos/limites e backups; teste restauração e registre um procedimento operacional.
- Avalie a cadeia de proxies e o limite por IP. A configuração atual do Nginx encaminha o endereço de seu proxy imediato; na Railway ele pode ser compartilhado. Não ative `TRUST_PROXY=true` sem validar um mecanismo confiável para identificar o IP do cliente. Sem isso, o limite atual pode afetar vários usuários ao mesmo tempo.
- Revise logs da Railway e de outros proxies: a supressão no Nginx não garante que URLs de convite fiquem fora de todos os logs. Configure retenção adequada.

## Notas operacionais

A Railway cobra conforme plano e recursos consumidos; serviços que excedem créditos ou limites podem parar. Não há implantação ou banco de produção criados por este guia. A infraestrutura de produção deve ser configurada pelo responsável pelo projeto.

Referências oficiais: [monorepos](https://docs.railway.com/deployments/monorepo), [PostgreSQL](https://docs.railway.com/databases/postgresql), [rede privada](https://docs.railway.com/networking/private-networking/how-it-works), [healthchecks](https://docs.railway.com/deployments/healthchecks), [backups](https://docs.railway.com/volumes/backups) e [limites de custo](https://docs.railway.com/pricing/cost-control).
