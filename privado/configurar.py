# -*- coding: utf-8 -*-
"""Preenche o modelo com os dados do site.json.

Rodar uma vez, da raiz do repositório, depois de editar o site.json:

    python3 privado/configurar.py

O que ele faz em todos os arquivos de texto do site:
- troca {{CHAVE}} pelo valor do site.json (lista completa em CHAVES, abaixo);
- troca [[wa: mensagem]] por um link wa.me pronto, com a mensagem codificada;
- monta a lista de serviços na home e no JSON-LD;
- gera o sitemap.xml, o busca.json e o llms.txt.

Pode rodar de novo depois de mudar o site.json: ele guarda uma cópia limpa do
modelo em privado/.modelo na primeira vez e sempre parte dela. Páginas novas
que você criar depois (posts, projetos) não são tocadas, porque não estão na
cópia do modelo.
"""
import html, io, json, os, re, shutil, subprocess, sys, urllib.parse, datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELO = os.path.join(RAIZ, "privado", ".modelo")
TEXTO = (".html", ".css", ".js", ".txt", ".xml", ".md", ".webmanifest", ".svg", ".toml")
PULAR = {"privado", ".git", "fonts", "img", "node_modules"}

cfg = json.load(io.open(os.path.join(RAIZ, "site.json"), encoding="utf-8"))
obrig = ["nome", "nome_curto", "profissao", "area", "cidade", "uf", "registro", "dominio", "whatsapp"]
falta = [k for k in obrig if not str(cfg.get(k, "")).strip()]
if falta:
    sys.exit("Preencha no site.json: " + ", ".join(falta))
if not re.fullmatch(r"55\d{10,11}", cfg["whatsapp"]):
    sys.exit("whatsapp no site.json: só números, com 55 e DDD, ex.: 5534999999999")


def wa(msg):
    return "https://wa.me/%s?text=%s" % (cfg["whatsapp"], urllib.parse.quote(msg, safe="!"))


servicos = cfg.get("servicos") or []
serv_html = "\n".join(
    '      <article class="serv"><h3>%s</h3><p>%s</p><a class="serv-cta" href="%s" target="_blank" rel="noopener">Quero saber sobre %s →</a></article>'
    % (html.escape(s["nome"]), html.escape(s["descricao"]),
       html.escape(wa("Olá %s! Vi no site o serviço de %s e quero saber como funciona." % (cfg["nome_curto"], s["nome"].lower()))),
       html.escape(s["nome"].lower()))
    for s in servicos)
serv_ld = json.dumps([{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["nome"], "description": s["descricao"]}} for s in servicos], ensure_ascii=False)

CHAVES = {
    "NOME": cfg["nome"],
    "NOME_CURTO": cfg["nome_curto"],
    "PROFISSAO": cfg["profissao"],
    "PROFISSAO_MIN": cfg["profissao"].lower(),
    "AREA": cfg["area"],
    "FRASE": cfg.get("frase", ""),
    "CIDADE": cfg["cidade"],
    "UF": cfg["uf"],
    "CONSELHO": cfg.get("conselho", ""),
    "REGISTRO": cfg["registro"],
    "CNPJ": (" · CNPJ " + cfg["cnpj"]) if cfg.get("cnpj") else "",
    "DOMINIO": cfg["dominio"],
    "URL": "https://" + cfg["dominio"],
    "WHATSAPP": cfg["whatsapp"],
    "WHATSAPP_FMT": cfg.get("whatsapp_formatado", cfg["whatsapp"]),
    "EMAIL": cfg.get("email", ""),
    "INSTAGRAM": cfg.get("instagram", ""),
    "GA4_ID": cfg.get("ga4_id", ""),
    "COR": cfg.get("cor", "#1A56DB"),
    "COR_ESCURA": cfg.get("cor_escura", "#11399E"),
    "COR_CLARA": cfg.get("cor_clara", "#EAF1FE"),
    "SCHEMA_TIPO": cfg.get("schema_tipo", "ProfessionalService"),
    "BIO": cfg.get("bio", ""),
    "INICIAL": cfg["nome_curto"][:1].upper(),
    "ANO": str(datetime.date.today().year),
    "HOJE": datetime.date.today().isoformat(),
    "DATA": datetime.date.today().strftime("%d/%m/%Y"),
    "WA_LINK": wa((cfg.get("mensagem_whatsapp") or "Olá {{NOME_CURTO}}! Vi o seu site e quero conversar.").replace("{{NOME_CURTO}}", cfg["nome_curto"])),
    "SERVICOS_HTML": serv_html,
    "SERVICOS_LD": serv_ld,
}


def preencher(texto, caminho):
    for k, v in CHAVES.items():
        texto = texto.replace("{{%s}}" % k, v)
    # [[wa: mensagem]] vira link wa.me; dentro de href, já sai escapado para HTML
    texto = re.sub(r"\[\[wa:\s*(.*?)\]\]", lambda m: html.escape(wa(html.unescape(m.group(1).strip()))), texto, flags=re.S)
    sobra = re.findall(r"\{\{[A-Z_]+\}\}", texto)
    if sobra:
        sys.exit("Chave sem valor em %s: %s" % (caminho, ", ".join(sorted(set(sobra)))))
    return texto


# 1. guarda a cópia limpa do modelo na primeira vez
if not os.path.isdir(MODELO):
    os.makedirs(MODELO)
    for pasta, dirs, arqs in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in PULAR and not pasta.startswith(MODELO)]
        for a in arqs:
            if a.endswith(TEXTO) and a not in ("site.json", "README.md", "LICENSE"):
                orig = os.path.join(pasta, a)
                dest = os.path.join(MODELO, os.path.relpath(orig, RAIZ))
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(orig, dest)

# 2. preenche a partir da cópia limpa
n = 0
for pasta, dirs, arqs in os.walk(MODELO):
    for a in arqs:
        orig = os.path.join(pasta, a)
        rel = os.path.relpath(orig, MODELO)
        dest = os.path.join(RAIZ, rel)
        s = io.open(orig, encoding="utf-8").read()
        io.open(dest, "w", encoding="utf-8").write(preencher(s, rel))
        n += 1
print("%d arquivos preenchidos com o site.json" % n)

# 3. imagem de compartilhamento (WhatsApp, Facebook, LinkedIn), se não existir
og = os.path.join(RAIZ, "img", "og-image.jpg")
if not os.path.exists(og):
    try:
        from PIL import Image, ImageDraw, ImageFont
        cor = tuple(int(CHAVES["COR"][i:i + 2], 16) for i in (1, 3, 5))
        im = Image.new("RGB", (1200, 630), cor)
        d = ImageDraw.Draw(im)
        fonte = os.path.join(RAIZ, "fonts", "og.ttf")
        def f(t):
            return ImageFont.truetype(fonte, t) if os.path.exists(fonte) else ImageFont.load_default()
        d.text((80, 220), cfg["nome"], font=f(64), fill="white")
        d.text((80, 320), "%s em %s" % (cfg["profissao"], cfg["cidade"]), font=f(40), fill="white")
        d.text((80, 520), cfg["registro"] + "  ·  " + cfg["dominio"], font=f(28), fill="white")
        im.save(og, quality=88)
        print("img/og-image.jpg criada. Troque por uma foto sua quando puder (1200 x 630).")
    except Exception as e:
        print("Crie img/og-image.jpg (1200 x 630) à mão: %s" % e)

# 4. índices
for script in ("gerar-sitemap.py", "gerar-busca.py", "gerar-llms.py"):
    subprocess.run([sys.executable, os.path.join(RAIZ, "privado", script)], check=True)
