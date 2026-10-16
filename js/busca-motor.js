/* Busca do site (a lupa do menu): o motor e a tela.
   Quem carrega este arquivo e o js/busca.js, que fica em toda pagina e so liga a lupa.
   Indice estatico em /busca-indice.json, gerado por privado/gerar-busca.py com as regras
   de privado/busca-regras.json (sinonimos, atalhos, qualificadores, sugestoes e o WhatsApp
   do "nao achei"). Nada e baixado no carregamento da pagina. Sem dependencia e sem servico
   de terceiro: a conta toda acontece no navegador. Se a pagina tiver o Google Analytics, o termo buscado vai como
   evento (search, busca_sem_resultado e busca_clique), com numero comprido apagado.

   Como o motor decide:
   1. Ignora acento, maiuscula e pontuacao. "2.500" vira 2500 e "3 mil" vira 3000.
   2. Joga fora palavra vazia (de, para, como, quero...), menos quando a busca so tem ela.
   3. Entende plural e palavra pela metade: casas acha casa, imoveis acha imovel,
      "apart" acha apartamento.
   4. Sigla e jeito popular de falar entram pelos grupos de sinonimos do busca-indice.json
      (orcamento, preco, quanto custa...). Expressao de varias palavras de um grupo
      ("quanto custa") conta como um termo so, entao as palavras de dentro dela quase nao
      pesam sozinhas.
   5. Erro de digitacao: palavra que nao existe no site vira a mais parecida que existe
      (orcamneto vira orcamento), e a tela avisa.
   6. Palavra rara vale mais que palavra comum: o nome da cidade esta em quase toda pagina
      e quase nao pesa; o nome de um servico esta em poucas e decide.
   7. Onde a palavra aparece pesa: titulo, etiqueta, palavra-chave, pergunta do FAQ,
      subtitulo, descricao e abertura do texto, nessa ordem. Aparecer em varios desses
      lugares soma, e titulo que comeca pela busca ganha um pouco mais.
   8. A pagina precisa ter todas as palavras que importam. Se nenhuma tiver, a busca
      mostra as que chegam mais perto e avisa.
   9. Atalho (simulador, WhatsApp...) aparece no topo quando a busca pede por ele. */
(function () {
  'use strict';
  if (window.BuscaSite || !window.fetch) return;

  var CAMPOS = ['t', 'a', 'k', 'f', 'h', 'd', 'x'];
  var PESO = [10, 6, 5, 4, 3, 3, 2];
  var DENTRO = 0.3;   /* palavra que so aparece dentro de expressao de outro grupo */
  var SINONIMO = 0.95, CORRIGIDO = 0.85;
  var VAZIAS = {};
  ('a o as os de da do das dos d em no na nos nas num numa um uma uns umas e ou para pra pro pros pras ' +
   'por pelo pela pelos pelas com sem que qual quais quanto quanta quantos quantas como onde quando se ' +
   'ao aos meu minha meus minhas seu sua seus suas eu me mim voce vc te mais menos muito muita bem ja la ' +
   'aqui isso isto esse essa este esta ate entre sobre tipo quero queria preciso gostaria procuro ' +
   'procurando busco buscar ver saber site pagina').split(' ').forEach(function (w) { VAZIAS[w] = 1; });
  Object.keys(VAZIAS).forEach(function (w) { VAZIAS[raiz(w)] = 1; });

  var IDX = null, baixando = null, caixa = null, campo = null, lista = null, nota = null,
      vazio = null, aviso = null, sel = -1, itens = [], ultimoFoco = null, timerEvento = 0,
      ultimoEnviado = '', pendente = null;

  /* ---------- texto ---------- */

  /* Normaliza preservando o tamanho: cada caractere vira exatamente um caractere,
     para a posicao no texto normalizado servir no original na hora de destacar. */
  function normal(s) {
    var saida = '', i, c;
    s = String(s || '');
    for (i = 0; i < s.length; i++) {
      c = s[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      saida += c.length === 1 ? c : (c[0] || ' ');
    }
    return saida;
  }
  function escapar(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Palavras de um texto ja normalizado, com a posicao de cada uma. */
  var RE_PALAVRA = /\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:,\d+)?|[a-z]+/g;
  function palavras(n) {
    var saida = [], m, w, j;
    RE_PALAVRA.lastIndex = 0;
    while ((m = RE_PALAVRA.exec(n))) {
      w = m[0];
      if (w.charAt(0) <= '9') w = w.replace(/\./g, '').replace(/,\d+$/, '');
      saida.push({ w: w, i: m.index, f: m.index + m[0].length });
    }
    for (j = 0; j + 1 < saida.length; j++) {
      if (/^\d+$/.test(saida[j].w) && saida[j + 1].w === 'mil') {
        saida[j].w += '000';
        saida[j].f = saida[j + 1].f;
        saida.splice(j + 1, 1);
      }
    }
    return saida;
  }

  /* Raiz da palavra: tira o plural e a vogal de genero. Pouca regra, mas a mesma dos
     dois lados (indice e busca), entao casas acha casa e pronta acha pronto. */
  function raiz(w) {
    if (w.length < 4 || w.charAt(0) <= '9') return w;
    if (/[oa]es$/.test(w)) return w.slice(0, -3) + 'ao';
    if (w.length > 5 && /ais$/.test(w)) return w.slice(0, -2) + 'l';
    if (w.length > 5 && /eis$/.test(w)) return w.slice(0, -3) + 'el';
    if (/ns$/.test(w)) return w.slice(0, -2) + 'm';
    if (/[^s]s$/.test(w)) w = w.slice(0, -1);
    /* pronta e pronto, parcelada e parcelado */
    if (w.length >= 5 && /[ao]$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  /* Na busca, "valores" tambem tenta "valor" (no indice a raiz de valores e "valore"). */
  function raizes(w) {
    var r = raiz(w), saida = [r];
    if (w.length > 5 && /[^aeiou]es$/.test(w)) saida.push(w.slice(0, -2));
    return saida;
  }
  function stems(s) {
    return palavras(normal(s)).map(function (p) { return raiz(p.w); });
  }

  /* ---------- indice ---------- */

  /* Expressao de sinonimo mais comprida que comeca na posicao i (so as de varias palavras,
     ou todas, se soUmaPalavra for verdadeiro). */
  function expressaoEm(toks, i, todas) {
    var cands = IDX.sin[toks[i]] || [], melhor = null, c, k, ok, ws;
    for (c = 0; c < cands.length; c++) {
      ws = cands[c].ws;
      if ((!todas && ws.length < 2) || i + ws.length > toks.length) continue;
      ok = true;
      for (k = 0; k < ws.length && ok; k++) ok = toks[i + k] === ws[k];
      if (ok && (!melhor || ws.length > melhor.ws.length)) melhor = cands[c];
    }
    return melhor;
  }

  /* Troca cada expressao de varias palavras pelo codigo do grupo (#3) e marca as
     palavras que estavam dentro dela. */
  function canonizar(toks) {
    var canon = [], dentro = [], i = 0, g, k;
    while (i < toks.length) {
      g = expressaoEm(toks, i, false);
      if (g) {
        canon.push('#' + g.g);
        for (k = 0; k < g.ws.length; k++) dentro[i + k] = true;
        i += g.ws.length;
      } else {
        canon.push(toks[i]);
        i++;
      }
    }
    return { canon: canon, dentro: dentro };
  }

  /* Sequencia para comparar frase com titulo: cada termo de grupo vira o codigo do grupo
     e as palavras vazias saem. */
  function sequencia(toks) {
    var saida = [], i = 0, g;
    while (i < toks.length) {
      g = expressaoEm(toks, i, true);
      if (g) { saida.push('#' + g.g); i += g.ws.length; continue; }
      if (!VAZIAS[toks[i]]) saida.push(toks[i]);
      i++;
    }
    return ' ' + saida.join(' ') + ' ';
  }

  function montarIndice(j) {
    var paginas = Array.isArray(j) ? j : j.p, grupos = (!Array.isArray(j) && j.s) || [], i, k, ix, r;
    IDX = { pags: [], post: {}, voc: [], sin: {}, grupos: [], atalhos: [], sug: [], wa: null, qual: {}, textos: {} };
    grupos.forEach(function (grupo, g) {
      var exprs = grupo.map(stems).filter(function (e) { return e.length; });
      IDX.grupos.push(exprs);
      exprs.forEach(function (e) { (IDX.sin[e[0]] = IDX.sin[e[0]] || []).push({ ws: e, g: g }); });
    });
    var post = IDX.post;
    function posta(tok, pag, bit) {
      var lista = post[tok] || (post[tok] = {});
      lista[pag] = (lista[pag] || 0) | bit;
    }
    for (i = 0; i < paginas.length; i++) {
      var p = paginas[i], campos = [], textos = [];
      for (k = 0; k < CAMPOS.length; k++) {
        var txt = p[CAMPOS[k]], partes = Array.isArray(txt) ? txt.slice() : (txt ? [txt] : []);
        if (k === 1) partes.push(p.u.replace(/[\/\-]+/g, ' '));
        textos.push(partes);
        campos.push([]);
        for (ix = 0; ix < partes.length; ix++) {
          var toks = stems(partes[ix]), c = canonizar(toks);
          for (r = 0; r < toks.length; r++) posta(toks[r], i, 1 << (c.dentro[r] ? k + 7 : k));
          for (r = 0; r < c.canon.length; r++) if (c.canon[r].charAt(0) === '#') posta(c.canon[r], i, 1 << k);
          campos[k].push(c.canon);
        }
      }
      var tt = stems(p.t);
      IDX.pags.push({ u: p.u, t: p.t, d: p.d || '', c: p.c || '', m: p.m || '', campos: campos, textos: textos,
                      seq: sequencia(tt), primeiro: canonizar(tt).canon[0] || '' });
    }
    IDX.voc = Object.keys(post).sort();
    IDX.atalhos = ((!Array.isArray(j) && j.atalhos) || []).map(function (a) {
      return { u: a.u, t: a.t, d: a.d || '', c: a.c || 'Atalho',
               q: a.q.map(function (e) { return sequencia(stems(e)).replace(/^\s+|\s+$/g, ''); }),
               cru: a.q.map(function (e) { return stems(e).filter(function (w) { return !VAZIAS[w]; }).join(' '); }) };
    });
    ((!Array.isArray(j) && j.qual) || []).forEach(function (e) { IDX.qual[stems(e).join(' ')] = 1; });
    IDX.sug = (!Array.isArray(j) && j.sug) || [];
    IDX.wa = (!Array.isArray(j) && j.wa) || null;
    var tx = (!Array.isArray(j) && j.textos) || {};
    IDX.textos = {
      exemplo: tx.exemplo || 'Buscar no site...',
      dica: tx.dica || 'Busque por assunto, serviço ou dúvida.',
      nada: tx.nada || 'Tente outra palavra ou me pergunte direto.'
    };
    return IDX;
  }

  function comPrefixo(s) {
    var voc = IDX.voc, lo = 0, hi = voc.length, mid, saida = [];
    while (lo < hi) { mid = (lo + hi) >> 1; if (voc[mid] < s) lo = mid + 1; else hi = mid; }
    while (lo < voc.length && voc[lo].lastIndexOf(s, 0) === 0) saida.push(voc[lo++]);
    return saida;
  }

  /* Qualidade do encontro entre uma palavra do indice e uma raiz da busca. */
  function bate(tok, s, aberta) {
    if (tok === s) return 1;
    if (s.charAt(0) === '#') return 0;
    if (/^\d+$/.test(s)) {
      /* "250" acha "250 mil" e "R$ 250.900" */
      return s.length <= 3 && tok.length === s.length + 3 && tok.lastIndexOf(s, 0) === 0 ? 0.9 : 0;
    }
    if (tok.lastIndexOf(s, 0) !== 0) return 0;
    /* palavra ainda sendo digitada: vale o comeco ("apart" acha apartamento) */
    if (aberta) return s.length >= 4 ? 0.8 : s.length >= 2 ? 0.6 : 0;
    /* palavra completa: so sobra de plural ("valor" acha "valores"), nunca outra palavra
       ("preco" vira "prec" e nao pode achar "precisava") */
    return s.length >= 4 && tok.length - s.length <= 1 ? 0.8 : 0;
  }

  /* Paginas onde a raiz s aparece: para cada uma, a qualidade em cada um dos 7 campos. */
  function casaUma(s, aberta) {
    var mapa = {}, cands, i, v, q, pag, k, bits, arr, qq;
    if (s.charAt(0) === '#' || (s.length < 4 && !aberta && !/^\d{1,3}$/.test(s))) cands = IDX.post[s] ? [s] : [];
    else cands = comPrefixo(s);
    for (i = 0; i < cands.length; i++) {
      v = cands[i];
      q = bate(v, s, aberta);
      if (!q) continue;
      for (pag in IDX.post[v]) {
        bits = IDX.post[v][pag];
        arr = mapa[pag] || (mapa[pag] = [0, 0, 0, 0, 0, 0, 0]);
        for (k = 0; k < 7; k++) {
          qq = bits & (1 << k) ? q : bits & (1 << (k + 7)) ? q * DENTRO : 0;
          if (qq > arr[k]) arr[k] = qq;
        }
      }
    }
    return mapa;
  }

  /* Distancia de edicao com troca de vizinhas (pacaenbu, apartamneto). */
  function distancia(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var d = [], i, j, custo, menor;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      menor = max + 1;
      for (j = 1; j <= b.length; j++) {
        custo = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        if (d[i][j] < menor) menor = d[i][j];
      }
      if (menor > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  function corrigir(s) {
    var max = s.length >= 7 ? 2 : 1, melhor = null, mDist = max + 1, mDf = 0, voc = IDX.voc, i, v, dist, df;
    for (i = 0; i < voc.length; i++) {
      v = voc[i];
      if (v.length < 4 || v.charAt(0) <= '9' || Math.abs(v.length - s.length) > max) continue;
      if (v.charAt(0) !== s.charAt(0) && v.charAt(1) !== s.charAt(1)) continue;
      dist = distancia(s, v, max);
      if (dist > max) continue;
      df = Object.keys(IDX.post[v]).length;
      if (dist < mDist || (dist === mDist && df > mDf)) { melhor = v; mDist = dist; mDf = df; }
    }
    return melhor;
  }

  /* ---------- consulta ---------- */

  /* Um grupo de sinonimos vira um termo: as palavras soltas do grupo e o codigo das
     expressoes de varias palavras. */
  function conceitoDoGrupo(g, ws, lit) {
    var exprs = IDX.grupos[g], alts = [], multi = false, marcas = [], frases = [], usado = ws.join(' ');
    exprs.forEach(function (e) {
      if (e.length > 1) { multi = true; frases.push(e); return; }
      if (!VAZIAS[e[0]]) marcas.push(e[0]);
      alts.push({ ws: e, fator: e[0] === usado ? 1 : SINONIMO });
    });
    if (multi) alts.push({ ws: ['#' + g], fator: ws.length > 1 ? 1 : SINONIMO });
    var qual = exprs.some(function (e) { return IDX.qual[e.join(' ')]; });
    return { lit: lit, alts: alts, marcas: marcas, frases: frases, g: g, qual: qual };
  }

  function interpretar(consulta) {
    var lista = palavras(normal(consulta)), aberta = !/\s$/.test(consulta), conceitos = [], puladas = [],
        toks = lista.map(function (p) { return raiz(p.w); }), i = 0, g, t, ult;
    while (i < toks.length) {
      g = expressaoEm(toks, i, true);
      if (g) {
        conceitos.push(conceitoDoGrupo(g.g, g.ws, lista.slice(i, i + g.ws.length).map(function (x) { return x.w; }).join(' ')));
        i += g.ws.length;
        continue;
      }
      t = lista[i].w;
      ult = i === toks.length - 1 && aberta;
      if (VAZIAS[t]) { puladas.push(i); i++; continue; }
      conceitos.push({ lit: t, aberta: ult, alts: raizes(t).map(function (r) { return { ws: [r], fator: 1 }; }),
                       marcas: raizes(t), qual: !!IDX.qual[toks[i]] });
      i++;
    }
    if (!conceitos.length) {
      puladas.forEach(function (x) { conceitos.push({ lit: lista[x].w, alts: [{ ws: [toks[x]], fator: 1 }], marcas: [toks[x]] }); });
    }
    return {
      conceitos: conceitos,
      seq: sequencia(toks),
      livre: toks.filter(function (w) { return !VAZIAS[w]; })
    };
  }

  function avaliar(c) {
    var pags = {}, a, m, pag, k, alt, ef = 0, arr, melhor;
    for (a = 0; a < c.alts.length; a++) {
      alt = c.alts[a];
      m = casaUma(alt.ws[0], c.aberta && alt.fator === 1);
      for (pag in m) {
        arr = pags[pag] || (pags[pag] = [0, 0, 0, 0, 0, 0, 0]);
        for (k = 0; k < 7; k++) if (m[pag][k] * alt.fator > arr[k]) arr[k] = m[pag][k] * alt.fator;
      }
    }
    for (pag in pags) {
      melhor = 0;
      for (k = 0; k < 7; k++) if (pags[pag][k] > melhor) melhor = pags[pag][k];
      ef += melhor;
    }
    c.pags = pags;
    c.df = Object.keys(pags).length;
    c.ef = ef;   /* paginas que contam: a que so tem a palavra dentro de outra expressao conta pouco */
  }

  function buscar(consulta) {
    var q = interpretar(consulta), cs = q.conceitos, N = IDX.pags.length, i, c, corr = [], pag, k;
    for (i = 0; i < cs.length; i++) {
      c = cs[i];
      avaliar(c);
      /* erro de digitacao: so palavra solta, com letra, que nao aparece em lugar nenhum */
      if (!c.df && c.g === undefined && c.lit.length >= 4 && !/\d/.test(c.lit)) {
        var certa = corrigir(raiz(c.lit));
        if (certa) {
          var g = expressaoEm([certa], 0, true);
          var novo = g ? conceitoDoGrupo(g.g, g.ws, certa) :
                     { lit: certa, alts: [{ ws: [certa], fator: 1 }], marcas: [certa] };
          novo.alts.forEach(function (a) { a.fator *= CORRIGIDO; });
          avaliar(novo);
          corr.push([c.lit, certa]);
          cs[i] = c = novo;
        }
      }
      c.idf = Math.log(1 + N / Math.max(c.ef, 1));
      /* palavra comum demais ou caracteristica (2 quartos, suite...) soma, mas nao tira da lista */
      c.opcional = c.ef > N * 0.5 || !!c.qual;
    }
    var obrig = cs.filter(function (x) { return !x.opcional && x.df; }).length, todos = {}, res = [];
    for (i = 0; i < cs.length; i++) for (pag in cs[i].pags) todos[pag] = 1;
    for (pag in todos) {
      var tem = 0, temObrig = 0, pts = 0, noTitulo = 0, p = IDX.pags[pag], arr, melhor, soma;
      for (i = 0; i < cs.length; i++) {
        arr = cs[i].pags[pag];
        if (!arr) continue;
        tem++;
        if (!cs[i].opcional) temObrig++;
        melhor = 0; soma = 0;
        for (k = 0; k < 7; k++) { soma += PESO[k] * arr[k]; if (PESO[k] * arr[k] > melhor) melhor = PESO[k] * arr[k]; }
        /* o melhor lugar decide; aparecer em outros lugares da pagina soma um pouco */
        pts += cs[i].idf * (melhor + 0.3 * (soma - melhor));
        if (arr[0] >= 0.5) noTitulo++;
      }
      if (noTitulo === cs.length) pts *= 1.3;
      if (cs.length > 1 && p.seq.indexOf(q.seq) >= 0) pts *= 1.25;
      for (i = 0; i < cs[0].alts.length; i++) {
        if (bate(p.primeiro, cs[0].alts[i].ws[0], false)) { pts *= 1.15; break; }
      }
      res.push({ p: p, tem: tem, temObrig: temObrig, pts: pts * (0.7 + 0.3 * tem / cs.length) });
    }
    var estritos = res.filter(function (r) { return r.temObrig === obrig && r.tem > 0; }), parcial = false;
    /* sobrou pouco: entra tambem quem so nao tem um dos termos, valendo menos */
    if (estritos.length < 5 && obrig >= 2) {
      res.forEach(function (r) {
        if (r.temObrig === obrig - 1) { r.pts *= 0.6; estritos.push(r); }
      });
    }
    if (!estritos.length && cs.length > 1) {
      parcial = true;
      estritos = res.filter(function (r) { return r.temObrig >= Math.max(1, Math.ceil(obrig / 2)); });
    }
    estritos.sort(function (a, b) {
      return b.pts - a.pts || (b.p.m > a.p.m ? 1 : b.p.m < a.p.m ? -1 : 0) || a.p.t.length - b.p.t.length;
    });
    if (estritos.length) {
      var corte = estritos[0].pts * 0.2;
      estritos = estritos.filter(function (r) { return r.pts >= corte; }).slice(0, 10);
    }
    return { res: estritos, conceitos: cs, corr: corr, parcial: parcial, atalhos: atalhosPara(q),
             ignoradas: cs.filter(function (x) { return !x.df; }).map(function (x) { return x.lit; }) };
  }

  /* Atalho entra quando a busca e ele, com no maximo uma palavra a mais ("falar no zap",
     "simular financiamento"), tambem por sinonimo, ou quando a pessoa ainda esta digitando
     o comeco dele. */
  function atalhosPara(q) {
    var seq = q.seq.replace(/^\s+|\s+$/g, ''), termos = seq ? seq.split(' ') : [], frase = q.livre.join(' '), saida = [];
    if (frase.length < 3) return saida;
    IDX.atalhos.forEach(function (a) {
      for (var i = 0; i < a.q.length; i++) {
        var t = a.q[i], n = t.split(' ').length;
        if ((termos.length - n <= 1 && (' ' + seq + ' ').indexOf(' ' + t + ' ') >= 0) ||
            (frase.length >= 4 && a.cru[i].lastIndexOf(frase, 0) === 0)) {
          saida.push(a);
          return;
        }
      }
    });
    return saida.slice(0, 2);
  }

  /* ---------- destaque e trecho ---------- */

  function marcaPalavra(r, cs) {
    var i, j;
    for (i = 0; i < cs.length; i++) {
      for (j = 0; j < cs[i].marcas.length; j++) if (bate(r, cs[i].marcas[j], cs[i].aberta)) return true;
    }
    return false;
  }

  function destacar(orig, cs) {
    var n = normal(orig), lista = palavras(n), r = lista.map(function (x) { return raiz(x.w); }),
        marca = [], saida = '', pos = 0, i, j, c, f, ok, ini = -1, fim = -1;
    function fecha() {
      if (ini < 0) return;
      saida += escapar(orig.slice(pos, ini)) + '<mark>' + escapar(orig.slice(ini, fim)) + '</mark>';
      pos = fim; ini = -1;
    }
    /* expressao de varias palavras ("Minha Casa Minha Vida") so acende inteira */
    for (c = 0; c < cs.length; c++) {
      for (f = 0; f < (cs[c].frases || []).length; f++) {
        var fr = cs[c].frases[f];
        for (i = 0; i + fr.length <= r.length; i++) {
          ok = true;
          for (j = 0; j < fr.length && ok; j++) ok = !!bate(r[i + j], fr[j], false);
          if (ok) for (j = 0; j < fr.length; j++) marca[i + j] = true;
        }
      }
    }
    for (i = 0; i < r.length; i++) {
      if (!marca[i] && !VAZIAS[lista[i].w] && marcaPalavra(r[i], cs)) marca[i] = true;
    }
    for (i = 0; i < lista.length; i++) {
      if (!marca[i]) continue;
      if (ini >= 0 && /^[\s\-]*$/.test(n.slice(fim, lista[i].i))) fim = lista[i].f;
      else { fecha(); ini = lista[i].i; fim = lista[i].f; }
    }
    fecha();
    return saida + escapar(orig.slice(pos));
  }

  /* O trecho mostrado embaixo do titulo: a pergunta do FAQ, o subtitulo ou a descricao
     onde mais termos da busca aparecem. Etiqueta e palavra-chave nao sao texto de ler. */
  function trecho(r, cs) {
    var p = r.p, melhor = null, mPts = 0, ordem = [3, 4, 5, 6], o, k, ix, toks, conta, i, a, j, achou;
    for (o = 0; o < ordem.length; o++) {
      k = ordem[o];
      for (ix = 0; ix < p.campos[k].length; ix++) {
        toks = p.campos[k][ix];
        conta = 0;
        for (i = 0; i < cs.length; i++) {
          achou = false;
          for (a = 0; a < cs[i].alts.length && !achou; a++) {
            for (j = 0; j < toks.length && !achou; j++) achou = !!bate(toks[j], cs[i].alts[a].ws[0], cs[i].aberta);
          }
          if (achou) conta++;
        }
        if (conta > mPts) { mPts = conta; melhor = p.textos[k][ix]; }
      }
    }
    return melhor || p.d;
  }

  /* ---------- tela ---------- */

  function evento(nome, params) {
    if (typeof window.gtag === 'function') window.gtag('event', nome, params);
  }
  function termoLimpo(s) {
    return String(s).replace(/\s+/g, ' ').trim().toLowerCase().replace(/\d[\d\s.\-\/]{4,}\d/g, '#').slice(0, 80);
  }
  function enviarBusca() {
    clearTimeout(timerEvento);
    if (!pendente) return;
    var t = termoLimpo(pendente.q);
    if (t.length >= 2 && t !== ultimoEnviado) {
      ultimoEnviado = t;
      evento('search', { search_term: t, resultados: pendente.n });
      if (!pendente.n) evento('busca_sem_resultado', { search_term: t });
    }
    pendente = null;
  }

  function recentes(novo) {
    var guardadas = [];
    try { guardadas = JSON.parse(localStorage.getItem('busca-recentes') || '[]'); } catch (e) { guardadas = []; }
    if (!Array.isArray(guardadas)) guardadas = [];
    if (novo) {
      novo = String(novo).replace(/\s+/g, ' ').trim().slice(0, 60);
      if (novo.length < 2) return guardadas;
      guardadas = [novo].concat(guardadas.filter(function (x) { return normal(x) !== normal(novo); })).slice(0, 5);
      try { localStorage.setItem('busca-recentes', JSON.stringify(guardadas)); } catch (e) { /* sem armazenamento */ }
    }
    return guardadas;
  }

  function chips(titulo, termos) {
    if (!termos.length) return '';
    return '<div class="bx-grupo"><p class="bx-rot">' + titulo + '</p><div class="bx-chips">' +
      termos.map(function (t) { return '<button type="button" class="bx-chip">' + escapar(t) + '</button>'; }).join('') +
      '</div></div>';
  }

  function linkWa(q) {
    var wa = IDX && IDX.wa;
    if (!wa || !wa.numero) return '';
    var msg = (wa.mensagem || 'Olá! Procurei "{q}" no site e não achei.').replace('{q}', q.replace(/\s+/g, ' ').trim().slice(0, 80));
    return '<a class="bx-wa" href="https://wa.me/' + escapar(wa.numero) + '?text=' + encodeURIComponent(msg) +
      '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.3.5-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>' +
      'Perguntar no WhatsApp</a>';
  }

  /* O link e a propria opcao da lista (role=option), assim nao fica controle dentro de
     controle; quem usa teclado anda pelas setas, com o foco parado no campo. */
  function item(i, u, c, tituloHtml, descHtml, externo, atalho) {
    return '<li role="presentation"' + (atalho ? ' class="bx-atalho"' : '') + '>' +
      '<a role="option" id="bx-i' + i + '" aria-selected="false" tabindex="-1" href="' + escapar(u) + '"' +
      (externo ? ' target="_blank" rel="noopener"' : '') + ' data-pos="' + (i + 1) + '">' +
      (c ? '<span class="bx-c">' + escapar(c) + '</span>' : '') +
      '<span class="bx-t">' + tituloHtml + (externo ? ' <span aria-hidden="true">↗</span>' : '') + '</span>' +
      (descHtml ? '<span class="bx-d">' + descHtml + '</span>' : '') + '</a></li>';
  }

  function desenhar() {
    if (!IDX) return;
    var consulta = campo.value, html = '', i, r, n = 0, extra = '';
    if (campo.placeholder !== IDX.textos.exemplo) campo.placeholder = IDX.textos.exemplo;
    nota.hidden = true;
    vazio.innerHTML = '';
    if (normal(consulta).trim().length < 2) {
      lista.innerHTML = '';
      itens = []; sel = -1;
      vazio.innerHTML = chips('Suas buscas recentes', recentes()) + chips('Buscas comuns', IDX.sug);
      aviso.textContent = 'São ' + IDX.pags.length + ' páginas. ' + IDX.textos.dica;
      campo.setAttribute('aria-expanded', 'false');
      campo.setAttribute('aria-activedescendant', '');
      return;
    }
    r = buscar(consulta);
    for (i = 0; i < r.atalhos.length; i++, n++) {
      html += item(n, r.atalhos[i].u, r.atalhos[i].c, escapar(r.atalhos[i].t), escapar(r.atalhos[i].d),
                   /^https?:/.test(r.atalhos[i].u), true);
    }
    for (i = 0; i < r.res.length; i++, n++) {
      html += item(n, r.res[i].p.u, r.res[i].p.c, destacar(r.res[i].p.t, r.conceitos),
                   destacar(trecho(r.res[i], r.conceitos), r.conceitos), false, false);
    }
    lista.innerHTML = html;
    itens = [].slice.call(lista.querySelectorAll('a[role="option"]'));
    sel = itens.length ? 0 : -1;
    if (sel === 0) { itens[0].classList.add('bx-on'); itens[0].setAttribute('aria-selected', 'true'); }
    campo.setAttribute('aria-expanded', itens.length ? 'true' : 'false');
    campo.setAttribute('aria-activedescendant', sel >= 0 ? 'bx-i' + sel : '');

    if (r.corr.length && r.res.length) {
      extra = 'Mostrando resultados para <strong>' + escapar(r.corr.map(function (x) { return x[1]; }).join(' ')) + '</strong>.';
    } else if (r.ignoradas.length && r.res.length) {
      extra = 'Não achei <strong>' + escapar(r.ignoradas.join(', ')) + '</strong> no site. Mostrando o resto da busca.';
    } else if (r.parcial && r.res.length) {
      extra = 'Não achei uma página com tudo junto. Estas chegam mais perto.';
    }
    if (extra) { nota.innerHTML = extra; nota.hidden = false; }

    if (!r.res.length && !r.atalhos.length) {
      aviso.textContent = 'Nada encontrado.';
      vazio.innerHTML = '<div class="bx-grupo bx-nada"><p>Não achei nada para <strong>' + escapar(consulta.trim()) +
        '</strong> no site. ' + escapar(IDX.textos.nada) + '</p>' +
        linkWa(consulta) + '</div>' + chips('Buscas comuns', IDX.sug);
    } else {
      aviso.textContent = r.res.length === 1 ? '1 página encontrada' : r.res.length + ' páginas encontradas';
      if (r.res.length < 3 && IDX.wa) {
        vazio.innerHTML = '<div class="bx-grupo bx-pouco"><p>Não era isso?</p>' + linkWa(consulta) + '</div>';
      }
    }
    pendente = { q: consulta, n: r.res.length + r.atalhos.length };
    clearTimeout(timerEvento);
    timerEvento = setTimeout(enviarBusca, 1500);
  }

  function mover(passo) {
    if (!itens.length) return;
    if (sel >= 0) { itens[sel].classList.remove('bx-on'); itens[sel].setAttribute('aria-selected', 'false'); }
    sel = (sel + passo + itens.length) % itens.length;
    itens[sel].classList.add('bx-on');
    itens[sel].setAttribute('aria-selected', 'true');
    campo.setAttribute('aria-activedescendant', 'bx-i' + sel);
    if (itens[sel].scrollIntoView) itens[sel].scrollIntoView({ block: 'nearest' });
  }

  function estilo() {
    var css = document.createElement('style');
    css.textContent =
      '.bx-fundo{position:fixed;inset:0;z-index:9999;background:rgba(15,27,45,.55);' +
        'backdrop-filter:blur(3px);display:flex;justify-content:center;padding:10vh 16px 16px;overflow-y:auto}' +
      '.bx-fundo[hidden]{display:none}' +
      '.bx-caixa{display:flex;flex-direction:column;width:100%;max-width:640px;height:max-content;' +
        'background:var(--superficie,#fff);' +
        'border-radius:var(--r-lg,24px);box-shadow:0 24px 60px rgba(15,27,45,.32);overflow:hidden}' +
      '.bx-topo{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--nevoa,#D9E1EE)}' +
      '.bx-topo svg{width:20px;height:20px;flex:none;color:var(--tinta-suave,#41506A)}' +
      '.bx-topo input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;' +
        'font-size:1.05rem;color:var(--tinta,#0F1B2D);padding:6px 0}' +
      '.bx-topo input::-webkit-search-cancel-button{display:none}' +
      '.bx-x{border:1px solid var(--nevoa,#D9E1EE);background:none;border-radius:8px;cursor:pointer;' +
        'font:inherit;font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
        'color:var(--tinta-suave,#41506A);padding:6px 9px;min-height:32px}' +
      '.bx-x:hover{border-color:var(--azul,#1A56DB);color:var(--azul,#1A56DB)}' +
      '.bx-nota{margin:0;padding:9px 18px;font-size:.86rem;color:#5C4300;background:#FFF6DA;border-bottom:1px solid #F3E1A6}' +
      '.bx-nota[hidden]{display:none}' +
      '.bx-lista{list-style:none;margin:0;padding:6px;max-height:56vh;overflow-y:auto}' +
      '.bx-lista:empty{display:none}' +
      '.bx-lista li a{display:block;padding:10px 12px;border-radius:12px;text-decoration:none;color:inherit}' +
      '.bx-lista li a.bx-on,.bx-lista li a:hover{background:var(--azul-claro,#EAF1FE)}' +
      '.bx-lista li.bx-atalho a{border:1px dashed var(--azul,#1A56DB);margin-bottom:4px}' +
      '.bx-c{display:block;font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;' +
        'color:var(--tinta-suave,#41506A);margin-bottom:2px}' +
      '.bx-t{display:block;font-weight:700;font-size:1rem;line-height:1.3;color:var(--tinta,#0F1B2D)}' +
      '.bx-t mark,.bx-d mark{background:#FFE7A3;color:inherit;padding:0 1px;border-radius:3px}' +
      '.bx-d{display:block;font-size:.87rem;line-height:1.4;color:var(--tinta-suave,#41506A);margin-top:3px;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.bx-vazio:empty{display:none}' +
      '.bx-vazio{padding:4px 16px 12px}' +
      '.bx-grupo{margin:10px 0 4px}' +
      '.bx-rot{margin:0 0 8px;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;' +
        'color:var(--tinta-suave,#41506A)}' +
      '.bx-chips{display:flex;flex-wrap:wrap;gap:8px}' +
      '.bx-chip{font:inherit;font-size:.88rem;font-weight:600;color:var(--tinta,#0F1B2D);background:var(--fundo,#F7F9FC);' +
        'border:1px solid var(--nevoa,#D9E1EE);border-radius:999px;padding:7px 13px;min-height:36px;cursor:pointer}' +
      '.bx-chip:hover,.bx-chip:focus-visible{border-color:var(--azul,#1A56DB);color:var(--azul,#1A56DB)}' +
      '.bx-nada p,.bx-pouco p{margin:0 0 10px;font-size:.92rem;line-height:1.5;color:var(--tinta,#0F1B2D)}' +
      '.bx-pouco{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.bx-pouco p{margin:0}' +
      '.bx-wa{display:inline-flex;align-items:center;gap:8px;background:#0E7A3E;color:#fff;font-weight:700;' +
        'font-size:.92rem;text-decoration:none;border-radius:999px;padding:9px 16px;min-height:40px}' +
      '.bx-wa:hover{background:#0B6633}' +
      '.bx-wa svg{width:18px;height:18px;flex:none}' +
      '.bx-aviso{margin:0;padding:11px 18px;font-size:.85rem;color:var(--tinta-suave,#41506A);' +
        'border-top:1px solid var(--nevoa,#D9E1EE);background:var(--fundo,#F7F9FC)}' +
      '.bx-aviso a{color:var(--azul,#1A56DB);font-weight:600}' +
      '@media(max-width:600px){.bx-fundo{padding:0}.bx-caixa{max-width:none;border-radius:0;height:100%}' +
        '.bx-lista{max-height:none;flex:1 1 auto}.bx-vazio{flex:none}}' +
      '@media(prefers-reduced-motion:reduce){.bx-fundo{backdrop-filter:none}}';
    document.head.appendChild(css);
  }

  function montar() {
    estilo();
    caixa = document.createElement('div');
    caixa.className = 'bx-fundo';
    caixa.hidden = true;
    caixa.innerHTML =
      '<div class="bx-caixa" role="dialog" aria-modal="true" aria-label="Buscar no site">' +
        '<div class="bx-topo">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
          '<input type="search" id="bx-q" role="combobox" aria-expanded="false" aria-controls="bx-lista" ' +
            'aria-autocomplete="list" autocomplete="off" spellcheck="false" enterkeyhint="search" ' +
            'aria-label="Buscar no site" placeholder="' + escapar(IDX ? IDX.textos.exemplo : 'Buscar no site...') + '">' +
          '<button type="button" class="bx-x" aria-label="Fechar a busca">esc</button>' +
        '</div>' +
        '<p class="bx-nota" hidden></p>' +
        '<ul class="bx-lista" id="bx-lista" role="listbox" aria-label="Resultados da busca"></ul>' +
        '<div class="bx-vazio"></div>' +
        '<p class="bx-aviso" role="status" aria-live="polite"></p>' +
      '</div>';
    document.body.appendChild(caixa);
    campo = caixa.querySelector('#bx-q');
    lista = caixa.querySelector('#bx-lista');
    nota = caixa.querySelector('.bx-nota');
    vazio = caixa.querySelector('.bx-vazio');
    aviso = caixa.querySelector('.bx-aviso');

    caixa.addEventListener('click', function (e) {
      if (e.target === caixa) { fechar(); return; }
      var chip = e.target.closest ? e.target.closest('.bx-chip') : null;
      if (chip) { campo.value = chip.textContent; campo.focus(); desenhar(); return; }
      var a = e.target.closest ? e.target.closest('.bx-lista a') : null;
      if (a) {
        enviarBusca();
        evento('busca_clique', { search_term: termoLimpo(campo.value), destino: a.getAttribute('href'),
                                 posicao: +a.getAttribute('data-pos') });
        recentes(campo.value);
      }
    });
    caixa.querySelector('.bx-x').addEventListener('click', fechar);
    campo.addEventListener('input', desenhar);
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
      else if (e.key === 'Enter' && sel >= 0 && itens[sel]) { e.preventDefault(); itens[sel].click(); }
      else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    });
  }

  function baixar() {
    if (IDX) return Promise.resolve(IDX);
    if (baixando) return baixando;
    baixando = fetch('/busca-indice.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (j) {
      try { return montarIndice(j); } catch (e) { IDX = null; throw e; }
    });
    baixando['catch'](function () { baixando = null; });
    return baixando;
  }

  function abrir(inicial) {
    if (!caixa) montar();
    ultimoFoco = document.activeElement;
    caixa.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    campo.value = inicial || '';
    campo.focus();
    if (IDX) { desenhar(); return; }
    aviso.textContent = 'Carregando o índice...';
    baixar().then(desenhar, function () {
      aviso.innerHTML = 'Não consegui carregar a busca agora. ' +
        '<a href="/blog">Veja o blog inteiro</a> ou recarregue a página.';
    });
  }

  function fechar() {
    if (!caixa || caixa.hidden) return;
    enviarBusca();
    caixa.hidden = true;
    document.documentElement.style.overflow = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  /* Pagina 404: as palavras do endereco quebrado viram busca, e as paginas mais parecidas
     aparecem no bloco [data-busca-404]. */
  function sugerir404(alvo) {
    var termos = '';
    try { termos = decodeURIComponent(location.pathname); } catch (e) { termos = location.pathname; }
    termos = termos.replace(/\.html?$/, '').replace(/[\/\-_+.]+/g, ' ').replace(/^\s*blog\s/, ' ').trim();
    if (termos.length < 3) return;
    baixar().then(function () {
      var r = buscar(termos);
      if (!r.res.length) return;
      alvo.innerHTML = '<p><strong>Pelo endereço que você abriu, talvez seja uma destas:</strong></p><p>' +
        r.res.slice(0, 5).map(function (x) {
          return '<a href="' + escapar(x.p.u) + '">' + escapar(x.p.t) + '</a>';
        }).join('<br>') + '</p>';
      alvo.hidden = false;
    })['catch'](function () {});
  }

  window.BuscaSite = { abrir: abrir, baixar: baixar, sugerir404: sugerir404 };
})();
