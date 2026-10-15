# Site profissional modelo

Modelo de site para profissional liberal (arquiteto, engenheiro, advogado, psicólogo,
designer, corretor...) no mesmo padrão do marcotulio.pro: HTML estático no Netlify,
uma página por pergunta que o cliente faz, FAQ que o Google e as IAs leem, botão de
WhatsApp com mensagem pronta em cada página e as regras de texto num `CLAUDE.md`
para o Claude publicar pelo terminal.

## O que vem pronto

- Home com serviços, como funciona, FAQ e WhatsApp.
- Páginas Sobre, Projetos (com um projeto modelo), Blog (com um post modelo),
  Privacidade (LGPD) e 404.
- JSON-LD em todas as páginas: profissional e serviços, pessoa com registro no
  conselho, artigo e FAQ.
- Busca interna na lupa do menu: entende sinônimo, plural, erro de digitação e palavra pela metade,
  mostra atalho para o WhatsApp e sugere páginas na 404 (regras em `privado/busca-regras.json`).
- `llms.txt` para IAs, `sitemap.xml` e `robots.txt`.
- GA4 opcional, com o clique no WhatsApp medido por posição do botão.
- `_redirects` que esconde os arquivos internos e a pasta `privado/`.
- Scripts em `privado/`: configurar, gerar os índices e conferir antes de subir.
- Comandos do Claude: `/novo-post` e `/novo-projeto`.

## Como começar (uns 30 minutos)

1. No GitHub, abra este repositório e clique em **Use this template** para criar o
   repositório do novo profissional.
2. Edite o `site.json`: nome, profissão, área, cidade, registro no conselho, domínio,
   WhatsApp (só números, com 55 e DDD), cor e serviços. O exemplo é uma arquiteta
   fictícia: troque tudo.
3. Rode, da raiz:
   ```
   python3 privado/configurar.py
   python3 privado/conferir.py
   ```
   O primeiro preenche todas as páginas e gera os índices; o segundo confere tudo.
   Se mudar o `site.json` depois, é só rodar o configurar de novo.
4. No Netlify, **Add new site**, **Import from Git**, escolha o repositório. Não tem
   build: o diretório publicado é a raiz. Depois, conecte o domínio.
5. No Google Search Console, adicione o domínio e envie o `sitemap.xml`.
6. Troque as imagens provisórias: `img/foto.svg` (sua foto), `img/capa-modelo.svg`
   (capas), `img/og-image.jpg` (imagem do WhatsApp, 1200 x 630).
7. Escreva no `CLAUDE.md` as regras de publicidade do seu conselho e preencha a fila
   do `ROADMAP.md`.

## Como publicar depois

Abra o Claude Code na pasta do repositório e use `/novo-post` ou `/novo-projeto`. O
`CLAUDE.md` diz ao Claude as regras de texto e o checklist; o `privado/conferir.py`
pega o que escapar.

## Licença

O código é MIT (veja `LICENSE`). O texto, as fotos e os projetos publicados em cada
site pertencem ao profissional dono do site.
