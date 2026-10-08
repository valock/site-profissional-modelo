# -*- coding: utf-8 -*-
"""Confere o site antes de subir. Rodar da raiz:

    python3 privado/conferir.py            # todas as páginas
    python3 privado/conferir.py blog/x.html  # só as indicadas

Confere, em cada página:
- travessão (— ou –) no texto visível;
- palavras proibidas do site.json ("palavras_proibidas");
- JSON-LD válido;
- FAQ: o texto do JSON-LD FAQPage igual ao texto visível (<details><summary>);
- <title> até 70 caracteres e meta description até 160;
- canonical, og:image e pelo menos um botão de WhatsApp;
- links internos e imagens que não existem.

Sai com erro se achar problema, para dar para usar antes do git push.
"""
import html, io, json, os, re, sys
from comum import CFG, RAIZ, URL, paginas, texto

proib = [p for p in CFG.get("palavras_proibidas", []) if p]
alvo = set(os.path.normpath(a) for a in sys.argv[1:])
erros = 0


def avisa(rel, msg):
    global erros
    erros += 1
    print("  %s: %s" % (rel, msg))


def existe(href):
    q = href.split("#")[0].split("?")[0].lstrip("/")
    cands = [q, q + ".html", os.path.join(q, "index.html")] if q else ["index.html"]
    return any(os.path.isfile(os.path.join(RAIZ, c)) for c in cands)


for rel, s, u in paginas():
    if alvo and os.path.normpath(rel) not in alvo:
        continue
    corpo = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    vis = texto(corpo)
    for m in re.finditer("[—–]", vis):
        avisa(rel, "travessão: ..." + vis[max(0, m.start() - 40):m.end() + 30] + "...")
    for p in proib:
        for m in re.finditer(r"(?<!\w)%s(?!\w)" % re.escape(p), vis, re.I):
            avisa(rel, "palavra proibida '%s': ...%s..." % (p, vis[max(0, m.start() - 40):m.end() + 30]))
    lds = []
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            o = json.loads(b)
            lds += o if isinstance(o, list) else [o]
        except Exception as e:
            avisa(rel, "JSON-LD inválido: %s" % e)
    visiveis = {texto(q): texto(a) for q, a in re.findall(r"<summary[^>]*>(.*?)</summary>\s*(.*?)</details>", s, re.S)}
    for o in lds:
        if isinstance(o, dict) and o.get("@type") == "FAQPage":
            for q in o.get("mainEntity", []):
                v = visiveis.get(texto(q["name"]))
                if v is None:
                    avisa(rel, "FAQ sem pergunta visível: " + q["name"])
                elif v != texto(q["acceptedAnswer"]["text"]):
                    avisa(rel, "FAQ diferente do visível: " + q["name"])
    t = re.search(r"<title>(.*?)</title>", s, re.S)
    if not t or len(texto(t.group(1))) > 70:
        avisa(rel, "title ausente ou com mais de 70 caracteres (%d)" % (len(texto(t.group(1))) if t else 0))
    d = re.search(r'<meta name="description" content="([^"]*)"', s)
    if not d or len(html.unescape(d.group(1))) > 160:
        avisa(rel, "description ausente ou com mais de 160 caracteres")
    if 'property="og:image"' not in s:
        avisa(rel, "sem og:image")
    if "wa.me/" not in s:
        avisa(rel, "sem botão de WhatsApp")
    for h in set(re.findall(r'href="(/[^"]*)"', s)):
        if not existe(h):
            avisa(rel, "link interno quebrado: " + h)
    for src in set(re.findall(r'src="(/[^"]+)"', s)):
        if not os.path.isfile(os.path.join(RAIZ, src.lstrip("/"))):
            avisa(rel, "imagem ou script que não existe: " + src)

print("%d problema(s)" % erros if erros else "Tudo certo.")
sys.exit(1 if erros else 0)
