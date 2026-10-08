# -*- coding: utf-8 -*-
"""Gera o /busca.json, o índice da busca do site. Rodar da raiz:

    python3 privado/gerar-busca.py

Rodar sempre que uma página for criada, renomeada ou tiver o title, a
description ou os subtítulos alterados.
"""
import io, json, os, re, sys
from comum import RAIZ, paginas, texto

itens, urls = [], set()
for rel, s, u in paginas():
    if u in urls:
        sys.exit("ABORTADO: duas páginas com a mesma URL canônica: " + u)
    urls.add(u)
    tit = re.search(r"<title>(.*?)</title>", s, re.S)
    des = re.search(r'<meta name="description" content="([^"]*)"', s)
    cha = re.search(r'<meta name="keywords" content="([^"]*)"', s)
    limpo = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    subs = [texto(x) for x in re.findall(r"<h2[^>]*>(.*?)</h2>", limpo, re.S)]
    itens.append({"u": u, "t": texto(tit.group(1)) if tit else u, "d": texto(des.group(1)) if des else "",
                  "k": (cha.group(1) if cha else "")[:240], "h": [x for x in subs if x][:8]})
bruto = json.dumps(itens, ensure_ascii=False, separators=(",", ":"))
io.open(os.path.join(RAIZ, "busca.json"), "w", encoding="utf-8").write(bruto + "\n")
print("busca.json: %d páginas, %.1f KB" % (len(itens), len(bruto.encode()) / 1024))
