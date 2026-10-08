# -*- coding: utf-8 -*-
"""Funções usadas pelos scripts de privado/. A pasta inteira responde 404 no Netlify."""
import glob, html, io, json, os, re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(io.open(os.path.join(RAIZ, "site.json"), encoding="utf-8"))
URL = "https://" + CFG["dominio"]
FORA = {"404.html"}


def texto(x):
    x = re.sub(r"<[^>]+>", " ", x)
    return re.sub(r"\s+", " ", html.unescape(x)).strip()


def paginas():
    """Páginas públicas e indexáveis: (caminho, html, url canônica relativa)."""
    saida = []
    for c in sorted(glob.glob(os.path.join(RAIZ, "*.html")) + glob.glob(os.path.join(RAIZ, "blog", "*.html")) + glob.glob(os.path.join(RAIZ, "projetos", "*.html"))):
        rel = os.path.relpath(c, RAIZ)
        if os.path.basename(c) in FORA:
            continue
        s = io.open(c, encoding="utf-8").read()
        rob = re.search(r'<meta name="robots" content="([^"]*)"', s)
        if rob and "noindex" in rob.group(1).lower():
            continue
        can = re.search(r'<link rel="canonical" href="%s([^"]*)"' % re.escape(URL), s)
        if not can:
            continue
        saida.append((rel, s, can.group(1) or "/"))
    return saida
