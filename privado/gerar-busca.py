# -*- coding: utf-8 -*-
"""Gera os índices da busca do site (a lupa do menu). Rodar da raiz:

    python3 privado/gerar-busca.py

  /busca-indice.json  o índice completo que o js/busca-motor.js usa
  /busca.json         a lista simples de páginas (url, título, descrição), que o
                      privado/gerar-llms.py lê

Rodar sempre que uma página for criada, renomeada ou tiver title, description,
subtítulos, FAQ ou kicker alterados. As regras da busca (sinônimos, atalhos,
qualificadores, sugestões, textos da tela e a mensagem do "não achei") ficam em
privado/busca-regras.json. Mudou uma regra, roda este script de novo.

O que entra de cada página, do campo que mais pesa para o que menos pesa na busca:
  t  título
  a  etiquetas: kicker, "about" e endereço do JSON-LD, palavras do endereço da página
  k  palavras-chave (meta keywords)
  f  perguntas do FAQ
  h  subtítulos (h2)
  d  descrição (meta description)
  x  abertura do texto (subtítulo do topo ou primeiro parágrafo)
  c  categoria mostrada no resultado; m  data da última atualização
"""
import html, io, json, os, re, sys, urllib.parse
from comum import CFG, RAIZ, paginas

EMOJI = re.compile("[\U0001F000-\U0001FFFF←-⇿⌀-➿⬀-⯿️‍]")


def texto(x):
    x = re.sub(r"<[^>]+>", " ", x)
    x = EMOJI.sub(" ", html.unescape(x))
    x = re.sub(r"\s+", " ", x).strip()
    # "<em>Projeto</em>, em etapas" vira "Projeto , em etapas" sem isto
    return re.sub(r"\s+([,.;:!?)])", r"\1", x)


def corta(s, n):
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0].rstrip(",;:")


def nos_ld(o):
    if isinstance(o, list):
        for x in o:
            yield from nos_ld(x)
    elif isinstance(o, dict):
        yield o
        for v in o.values():
            if isinstance(v, (list, dict)):
                yield from nos_ld(v)


def unicos(lista, limite):
    vistos, saida = set(), []
    for x in lista:
        x = x.strip(" ·-|,")
        if x and x.lower() not in vistos:
            vistos.add(x.lower())
            saida.append(x)
    return saida[:limite]


def categoria(u):
    if u.startswith("/projetos/"):
        return "Projeto"
    if u.startswith("/blog/"):
        return "Artigo"
    return "Página"


def nome_curto(s):
    return s.replace("{{NOME_CURTO}}", CFG.get("nome_curto", ""))


def link_wa(msg):
    return "https://wa.me/%s?text=%s" % (CFG["whatsapp"], urllib.parse.quote(nome_curto(msg), safe="!"))


itens, urls = [], set()
for rel, s, u in paginas():
    if u in urls:
        sys.exit("ABORTADO: duas páginas com a mesma URL canônica: " + u)
    urls.add(u)
    tit = re.search(r"<title>(.*?)</title>", s, re.S)
    des = re.search(r'<meta name="description" content="([^"]*)"', s)
    cha = re.search(r'<meta name="keywords" content="([^"]*)"', s)
    corpo = re.sub(r"<(script|style).*?</\1>", "", s, flags=re.S)
    subs = unicos([texto(x) for x in re.findall(r"<h2[^>]*>(.*?)</h2>", corpo, re.S)], 12)

    ld = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            ld += list(nos_ld(json.loads(m.group(1))))
        except ValueError:
            pass
    perguntas = [texto(x) for x in re.findall(r"<summary[^>]*>(.*?)</summary>", corpo, re.S)]
    if not perguntas:
        perguntas = [texto(n.get("name", "")) for n in ld if n.get("@type") == "Question"]
    perguntas = unicos(perguntas, 12)

    etiquetas, data = [], ""
    for k in re.findall(r'<span class="kicker">(.*?)</span>', corpo, re.S)[:1]:
        etiquetas += texto(k).split("·")
    for n in ld:
        sobre = n.get("about")
        for x in sobre if isinstance(sobre, list) else [sobre] if sobre else []:
            etiquetas.append(texto(x if isinstance(x, str) else str(x.get("name", "")) if isinstance(x, dict) else ""))
        end = n.get("address")
        if isinstance(end, dict):
            etiquetas += [texto(str(end.get(c, ""))) for c in ("streetAddress", "addressNeighborhood")]
        for c in ("dateModified", "datePublished"):
            if n.get(c) and not data:
                data = str(n[c])[:10]
    cidade = CFG.get("cidade", "").lower()
    etiquetas = unicos([e for e in etiquetas if e and e.lower() not in (cidade, cidade + ", " + CFG.get("uf", "").lower())], 14)
    abertura = re.search(r'<p class="art-sub">(.*?)</p>', corpo, re.S) or re.search(r'<p class="lead">(.*?)</p>', corpo, re.S)

    p = {"u": u, "t": texto(tit.group(1)) if tit else u, "d": texto(des.group(1)) if des else "", "c": categoria(u)}
    if etiquetas: p["a"] = etiquetas
    if cha: p["k"] = corta(texto(cha.group(1)), 400)
    if perguntas: p["f"] = perguntas
    if subs: p["h"] = subs
    if abertura: p["x"] = corta(texto(abertura.group(1)), 260)
    if data: p["m"] = data
    itens.append(p)

regras = json.load(io.open(os.path.join(RAIZ, "privado", "busca-regras.json"), encoding="utf-8"))
for g in regras.get("sinonimos", []):
    if len(g) < 2:
        sys.exit("ABORTADO: grupo de sinônimos com menos de dois itens: %s" % g)
atalhos = []
for a in regras.get("atalhos", []):
    if not (a.get("q") and a.get("u") and a.get("t")):
        sys.exit("ABORTADO: atalho sem q, u ou t: %s" % a)
    a = dict(a, t=nome_curto(a["t"]), d=nome_curto(a.get("d", "")))
    if a["u"] == "whatsapp":
        a["u"] = link_wa(CFG.get("mensagem_whatsapp") or "Olá {{NOME_CURTO}}! Vim pelo site e quero conversar.")
    atalhos.append(a)
sugestoes = regras.get("sugestoes") or [s["nome"] for s in (CFG.get("servicos") or [])][:5] + ["Orçamento"]

indice = {
    "v": 2,
    "p": itens,
    "s": regras.get("sinonimos", []),
    "atalhos": atalhos,
    "qual": regras.get("qualificadores", []),
    "sug": sugestoes,
    "textos": regras.get("textos", {}),
    "wa": {"numero": CFG["whatsapp"], "mensagem": nome_curto(regras.get("nao_achei", "Olá! Procurei \"{q}\" no site e não achei."))},
}
bruto = json.dumps(indice, ensure_ascii=False, separators=(",", ":"))
io.open(os.path.join(RAIZ, "busca-indice.json"), "w", encoding="utf-8").write(bruto + "\n")
simples = [{"u": p["u"], "t": p["t"], "d": p["d"], "k": p.get("k", "")[:240], "h": p.get("h", [])[:8]} for p in itens]
bruto_simples = json.dumps(simples, ensure_ascii=False, separators=(",", ":"))
io.open(os.path.join(RAIZ, "busca.json"), "w", encoding="utf-8").write(bruto_simples + "\n")
print("busca-indice.json: %d páginas, %d grupos de sinônimos, %d atalhos, %.1f KB"
      % (len(itens), len(indice["s"]), len(atalhos), len(bruto.encode()) / 1024))
