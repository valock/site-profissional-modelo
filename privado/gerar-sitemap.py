# -*- coding: utf-8 -*-
"""Gera o sitemap.xml. Rodar da raiz: python3 privado/gerar-sitemap.py

A data de cada página vem do "dateModified" do JSON-LD dela; sem isso, da
data de hoje.
"""
import datetime, io, os, re
from comum import RAIZ, URL, paginas

hoje = datetime.date.today().isoformat()
linhas = []
for rel, s, u in paginas():
    m = re.search(r'"dateModified":\s*"(\d{4}-\d{2}-\d{2})', s)
    pri = "1.0" if u == "/" else ("0.8" if rel.startswith(("blog/", "projetos/")) else "0.6")
    linhas.append("  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>" % (URL, u, m.group(1) if m else hoje, pri))
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(linhas) + "\n</urlset>\n"
io.open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8").write(xml)
print("sitemap.xml: %d páginas" % len(linhas))
