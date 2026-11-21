# Componentes de interface

O frontend usa React, Vite, TypeScript e CSS próprio. Os componentes compartilhados existentes ficam em `apps/web/src/shared/ui`, os estilos em `apps/web/src/styles`, e o cartão inspirado no exemplo fica em `apps/web/src/components/ui/frosted-card.tsx`. Ele foi adaptado ao CSS e à identidade visual existentes, sem instalar Tailwind ou shadcn.

Para adotar shadcn e Tailwind no futuro, execute em `apps/web`:

```sh
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

Adicione `tailwindcss()` aos plugins em `vite.config.ts` e `@import "tailwindcss";` na folha de estilos global. Configure o alias `@` para `src` no Vite e nos arquivos de configuração do TypeScript antes de executar o assistente shadcn; escolha `src/components/ui` para os componentes e `src/lib/utils.ts` para a função `cn`. O diretório de UI concentra os componentes reutilizáveis e mantém consistentes os caminhos dos componentes gerados pelo CLI. A instalação de shadcn deve ser revisada com cuidado, pois altera configurações e estilos existentes.
