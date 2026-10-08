# -*- coding: utf-8 -*-
"""Gera o /llms.txt, o resumo do site para ChatGPT, Gemini e outras IAs.

Rodar da raiz, depois do gerar-busca.py:

    python3 privado/gerar-busca.py
    python3 privado/gerar-llms.py

O cabeçalho sai do site.json. As páginas entram por seção: Projetos, Blog e
Páginas do site.
"""
import io, json, os
from comum import CFG, RAIZ, URL

busca = json.load(io.open(os.path.join(RAIZ, "busca.json"), encoding="utf-8"))
sec = {"Projetos": [], "Blog": [], "Páginas do site": []}
for p in busca:
    s = "Projetos" if p["u"].startswith("/projetos/") else ("Blog" if p["u"].startswith("/blog/") else "Páginas do site")
    sec[s].append("- [%s](%s%s): %s" % (p["t"], URL, p["u"], p["d"]))
cab = ["# %s, %s em %s" % (CFG["nome"], CFG["profissao"].lower(), CFG["cidade"]), "",
       "> %s %s, %s, %s/%s. Contato pelo WhatsApp: https://wa.me/%s" % (CFG["profissao"], "de " + CFG["area"], CFG["registro"], CFG["cidade"], CFG["uf"], CFG["whatsapp"]), "",
       "Todo o conteúdo é escrito por %s, em primeira pessoa. Valores, prazos e dados citados trazem a data e a fonte." % CFG["nome"], ""]
corpo = []
for nome, linhas in sec.items():
    if linhas:
        corpo += ["## " + nome] + linhas + [""]
io.open(os.path.join(RAIZ, "llms.txt"), "w", encoding="utf-8").write("\n".join(cab + corpo))
print("llms.txt: %d páginas" % len(busca))
