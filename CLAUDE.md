# Site de {{NOME}}: como trabalhar neste repositório

Site estático (HTML puro, publicado pelo Netlify a partir da raiz) de **{{NOME}}**,
{{PROFISSAO_MIN}} em {{CIDADE}}/{{UF}}, {{REGISTRO}}. O propósito do site: ser a referência
de quem procura {{AREA}} em {{CIDADE}}. Cada página existe para trazer uma conversa no
WhatsApp (+{{WHATSAPP}}).

Este arquivo é lido automaticamente pelo Claude no terminal. Ele não é público:
o `_redirects` devolve 404 para ele.

## Regras de texto (valem para tudo que vai ao ar)

- Escreva na voz de {{NOME_CURTO}}, em primeira pessoa, direto, sem jargão.
- **Zero travessão** (— ou –). Use vírgula, dois-pontos ou ponto. Faixa numérica se
  escreve "10 a 12 m²".
- Nada de "melhor", "maior", "líder", "nº 1" ou "garantido" para falar de si, do trabalho
  ou de concorrente. Prêmio só como fato datado.
- Nunca prometa resultado, prazo ou valor que dependa de terceiros (obra, órgão público,
  banco, juiz). Diga do que depende.
- Nunca invente número, prazo, preço, endereço ou depoimento. Sem fonte, escreva
  "consultar" e pergunte para {{NOME_CURTO}}.
- Nada sobre erro do site, ferramenta ou bastidor vira conteúdo.

## Regras da profissão ({{CONSELHO}})

Antes de publicar, confira o código de ética e as regras de publicidade do {{CONSELHO}}.
Escreva aqui as que valem para este site, por exemplo:

- (arquitetura, CAU) o projeto publicado precisa de autorização do cliente; a autoria
  de projeto de outro profissional sempre aparece;
- (advocacia, OAB) sem preço, sem captação de cliente e sem promessa de resultado;
- (saúde, CFM, CRO, CRP) sem antes e depois, sem promessa de resultado e sem preço
  de procedimento;
- (engenharia, CREA) número da ART quando a obra for citada.

## Regras de dado e de privacidade

- Foto de cliente, nome de cliente e endereço de obra só com autorização por escrito.
- Material interno fica em `/privado` (o Netlify responde 404 para a pasta inteira).
- Imagem publicada nunca é sobrescrita: versão nova ganha `-v2`, `-v3` no nome.

## Checklist de publicação (post, projeto ou atualização)

1. **Página**: copie `blog/post-modelo.html` (guia) ou `projetos/projeto-modelo.html`
   (projeto). Precisa ter `<title>` até 70 caracteres, meta description até 160,
   canonical, og:image, `dateModified`, resposta curta no topo, FAQ e pelo menos dois
   botões de WhatsApp com mensagem pronta.
2. **FAQ**: o texto do JSON-LD `FAQPage` tem que ser igual ao texto visível.
3. **Ligações**: card no `blog.html` ou no `projetos.html`, e link a partir de pelo
   menos uma página que já existe.
4. **Índices**: rode, da raiz:
   ```
   python3 privado/gerar-sitemap.py
   python3 privado/gerar-busca.py
   python3 privado/gerar-llms.py
   ```
   O `gerar-busca.py` grava o `busca-indice.json` (a lupa) e o `busca.json` (lista simples,
   usada pelo llms). Sinônimos, atalhos e sugestões da lupa ficam em
   `privado/busca-regras.json`: acrescente o jeito como o cliente fala da profissão. Mexeu
   nas regras, rode `node privado/testar-busca.mjs http://localhost:4173` com o site
   servido localmente e compare com a rodada anterior.
5. **Posts de divulgação**: escreva o texto do Google Meu Negócio, do Instagram e do
   WhatsApp em `privado/POSTS-AAAA-MM-DD.md` (modelo em `privado/POSTS-modelo.md`).
6. **Conferência**: rode `python3 privado/conferir.py`. Ele acusa travessão, palavra
   proibida, FAQ diferente, JSON-LD inválido, title ou description longos e link quebrado.
7. **Subir**: branch e pull request (o Netlify gera um preview). Depois do merge, confira
   a página em produção e mande o link para {{NOME_CURTO}}.

## Pendências e fila

O que falta fazer, e o que depende de informação de {{NOME_CURTO}}, está no `ROADMAP.md`.
