# Identidade visual — Entre Nós

A marca representa um presente compartilhado: o laço forma um encontro e a pequena estrela sugere a surpresa. O símbolo foi desenhado em SVG, para manter nitidez em qualquer tamanho e permitir animação sem depender de imagens externas.

## Arquivos

- `apps/web/public/logo.svg`: símbolo vetorial estático, usado também como favicon.
- `apps/web/src/shared/ui/BrandMark.tsx`: a mesma geometria como componente React, com animação GSAP no laço e na estrela.
- `apps/web/src/shared/ui/Brand.tsx`: assinatura com símbolo, nome e link acessível para o início.
- `apps/web/src/styles/brand.css`: dimensões, alinhamento e adaptação da marca e navegação.

## Uso e movimento

O símbolo usa verde-pinho (`#24483e`), areia (`#dfc9a5`) e rosa queimado (`#a14e59`). O nome usa a tipografia do produto. A animação de entrada apresenta o laço e a estrela; ao passar o ponteiro ou focar no link, a estrela faz um breve movimento. A animação é dispensável para reconhecer a marca e não é executada quando o sistema solicita movimento reduzido. O SVG dentro do link é decorativo; o nome acessível está no link.

O arquivo SVG estático e o componente devem ser alterados juntos se a geometria ou a paleta da marca mudar. Esta documentação registra decisões de design no repositório; não representa registro de marca ou verificação de direitos comerciais.
