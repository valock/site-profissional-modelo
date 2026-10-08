---
description: Cria um post do blog seguindo o checklist do CLAUDE.md
argument-hint: o assunto do post, ex. "quanto custa reformar uma cozinha em Uberlândia"
---

Quero publicar no blog: $ARGUMENTS

Siga as regras e o checklist de publicação do CLAUDE.md, nesta ordem:

1. Antes de escrever, me diga o que já existe no site sobre o assunto e quais dados
   faltam. Se faltar número ou fonte, pare e me pergunte.
2. Copie `blog/post-modelo.html`, escreva na minha voz, com a resposta curta no topo,
   FAQ (JSON-LD igual ao texto visível) e botões de WhatsApp com mensagem pronta.
3. Ponha o card no `blog.html` e um link a partir de uma página que já existe.
4. Rode os três geradores de `privado/` e o `privado/conferir.py`.
5. Escreva os posts de divulgação em `privado/POSTS-<data de hoje>.md`.
6. Me mostre o resumo do que mudou e o link antes de subir.
