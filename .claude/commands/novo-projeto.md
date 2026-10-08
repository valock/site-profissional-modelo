---
description: Publica um projeto do portfólio a partir de fotos e informações
argument-hint: o projeto, ex. "reforma da cozinha da família X no bairro Y, fotos na pasta Z"
---

Quero publicar o projeto: $ARGUMENTS

1. Confirme comigo que o cliente autorizou fotos e texto, e se o nome dele pode aparecer.
2. Copie `projetos/projeto-modelo.html`. Preencha a ficha (área, prazo, bairro, ano) só
   com dado que eu passei. Sem dado, pergunte.
3. Converta as fotos para `.webp` de 1600 x 900 em `blog/images/` com `-v1` no nome.
4. Ponha o card no `projetos.html` e no topo da home, se for o mais recente.
5. Rode os três geradores de `privado/` e o `privado/conferir.py`.
6. Escreva os posts de divulgação em `privado/POSTS-<data de hoje>.md`.
