/* Busca do site
   Indice estatico em /busca.json, gerado por privado/gerar-busca.py.
   Baixa o indice so no primeiro uso, nunca no carregamento da pagina.
   Sem dependencia, sem servico de terceiro, nada sai do navegador. */
(function () {
  'use strict';
  var gatilhos = document.querySelectorAll('[data-busca]');
  if (!gatilhos.length || !window.fetch) return;

  var dados = null, carregando = false, caixa = null, campo = null, lista = null,
      aviso = null, sel = -1, itens = [], ultimoFoco = null, termosAtuais = [];

  /* Normaliza preservando o tamanho: cada caractere vira exatamente um
     caractere, para o indice do texto normalizado servir no texto original
     na hora de destacar o trecho encontrado. */
  function normal(s) {
    var saida = '', i, c;
    for (i = 0; i < s.length; i++) {
      c = s[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      saida += c.length === 1 ? c : (c[0] || ' ');
    }
    return saida;
  }
  function escapar(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function destacar(orig, nrm, termos) {
    var marcas = [], i, j;
    for (j = 0; j < termos.length; j++) {
      i = nrm.indexOf(termos[j]);
      while (i >= 0) { marcas.push([i, i + termos[j].length]); i = nrm.indexOf(termos[j], i + termos[j].length); }
    }
    if (!marcas.length) return escapar(orig);
    marcas.sort(function (a, b) { return a[0] - b[0]; });
    var saida = '', pos = 0;
    for (j = 0; j < marcas.length; j++) {
      if (marcas[j][0] < pos) continue;
      saida += escapar(orig.slice(pos, marcas[j][0])) + '<mark>' +
               escapar(orig.slice(marcas[j][0], marcas[j][1])) + '</mark>';
      pos = marcas[j][1];
    }
    return saida + escapar(orig.slice(pos));
  }

  function pontuar(consulta) {
    var nq = normal(consulta).trim();
    if (nq.length < 2) return [];
    var termos = nq.split(/\s+/).filter(Boolean), achados = [], i, j, p, t, pts, tem, todos;
    for (i = 0; i < dados.length; i++) {
      p = dados[i]; pts = 0; todos = true;
      for (j = 0; j < termos.length; j++) {
        t = termos[j]; tem = false;
        if (p.nt.indexOf(t) >= 0) { pts += 30; tem = true; if (new RegExp('\\b' + escRegex(t)).test(p.nt)) pts += 12; }
        if (p.nd.indexOf(t) >= 0) { pts += 10; tem = true; }
        if (p.nk.indexOf(t) >= 0) { pts += 6; tem = true; }
        if (p.nh.indexOf(t) >= 0) { pts += 4; tem = true; }
        if (!tem) { todos = false; break; }
      }
      if (!todos) continue;
      if (p.nt.indexOf(nq) >= 0) pts += 60;
      /* Frase exata fora do titulo (ex.: "tem tem", nome de shopping) vale mais
         que cada palavra solta, que casa com qualquer texto. */
      else if (termos.length > 1 && (p.nk.indexOf(nq) >= 0 || p.nd.indexOf(nq) >= 0 || p.nh.indexOf(nq) >= 0)) pts += 100;
      if (p.nt.indexOf(nq) === 0) pts += 30;
      achados.push({ p: p, pts: pts });
    }
    achados.sort(function (a, b) { return b.pts - a.pts || a.p.t.length - b.p.t.length; });
    /* Corta o rabo: pagina que so encostou na palavra-chave polui a lista
       quando existe acerto de titulo. O corte e relativo ao melhor resultado,
       entao uma busca em que ninguem acerta o titulo continua respondendo. */
    if (achados.length) {
      var corte = achados[0].pts * 0.15;
      achados = achados.filter(function (a) { return a.pts >= corte; });
    }
    termosAtuais = termos;
    return achados.slice(0, 8);
  }

  function desenhar(consulta) {
    if (!dados) return;
    var achados = pontuar(consulta), html = '', i, p;
    itens = [];
    sel = achados.length ? 0 : -1;
    for (i = 0; i < achados.length; i++) {
      p = achados[i].p;
      html += '<li role="option" id="bx-i' + i + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '"' +
              (i === 0 ? ' class="bx-on"' : '') + '><a href="' + escapar(p.u) + '">' +
              '<span class="bx-t">' + destacar(p.t, p.nt, termosAtuais) + '</span>' +
              (p.d ? '<span class="bx-d">' + escapar(p.d) + '</span>' : '') + '</a></li>';
    }
    lista.innerHTML = html;
    itens = [].slice.call(lista.children);
    if (normal(consulta).trim().length < 2) {
      aviso.textContent = 'Digite ao menos duas letras. São ' + dados.length + ' páginas.';
    } else if (!achados.length) {
      aviso.innerHTML = 'Nada encontrado para <strong>' + escapar(consulta) +
        '</strong>. Tente o nome do bairro, do empreendimento ou da construtora, ou ' +
        '<a href="/blog">veja o blog inteiro</a>.';
    } else {
      aviso.textContent = achados.length === 1 ? '1 resultado' : achados.length + ' resultados';
    }
    campo.setAttribute('aria-activedescendant', sel >= 0 ? 'bx-i' + sel : '');
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
        'backdrop-filter:blur(3px);display:flex;justify-content:center;padding:12vh 16px 16px;overflow-y:auto}' +
      '.bx-fundo[hidden]{display:none}' +
      '.bx-caixa{display:flex;flex-direction:column;width:100%;max-width:620px;height:max-content;' +
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
      '.bx-lista{list-style:none;margin:0;padding:6px;max-height:52vh;overflow-y:auto}' +
      '.bx-lista li a{display:block;padding:11px 12px;border-radius:12px;text-decoration:none;color:inherit}' +
      '.bx-lista li.bx-on a,.bx-lista li a:hover{background:var(--azul-claro,#EAF1FE)}' +
      '.bx-t{display:block;font-weight:700;font-size:1rem;line-height:1.3;color:var(--tinta,#0F1B2D)}' +
      '.bx-t mark{background:#FFE7A3;color:inherit;padding:0 1px;border-radius:3px}' +
      '.bx-d{display:block;font-size:.87rem;line-height:1.4;color:var(--tinta-suave,#41506A);margin-top:3px;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.bx-aviso{margin:0;padding:11px 18px;font-size:.85rem;color:var(--tinta-suave,#41506A);' +
        'border-top:1px solid var(--nevoa,#D9E1EE);background:var(--fundo,#F7F9FC)}' +
      '.bx-aviso a{color:var(--azul,#1A56DB);font-weight:600}' +
      '@media(max-width:600px){.bx-fundo{padding:0}.bx-caixa{max-width:none;border-radius:0;height:100%}' +
        '.bx-lista{max-height:none;flex:1}}' +
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
          '<input type="search" id="bx-q" role="combobox" aria-expanded="true" aria-controls="bx-lista" ' +
            'aria-autocomplete="list" autocomplete="off" spellcheck="false" ' +
            'aria-label="Buscar no site" placeholder="Bairro, empreendimento, FGTS, faixa, subsídio...">' +
          '<button type="button" class="bx-x" aria-label="Fechar a busca">esc</button>' +
        '</div>' +
        '<ul class="bx-lista" id="bx-lista" role="listbox" aria-label="Resultados da busca"></ul>' +
        '<p class="bx-aviso" role="status" aria-live="polite"></p>' +
      '</div>';
    document.body.appendChild(caixa);
    campo = caixa.querySelector('#bx-q');
    lista = caixa.querySelector('#bx-lista');
    aviso = caixa.querySelector('.bx-aviso');

    caixa.addEventListener('click', function (e) { if (e.target === caixa) fechar(); });
    caixa.querySelector('.bx-x').addEventListener('click', fechar);
    campo.addEventListener('input', function () { desenhar(campo.value); });
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
      else if (e.key === 'Enter' && sel >= 0 && itens[sel]) { e.preventDefault(); itens[sel].querySelector('a').click(); }
      else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    });
  }

  function carregar() {
    if (dados || carregando) return;
    carregando = true;
    aviso.textContent = 'Carregando o índice...';
    fetch('/busca.json').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (j) {
      dados = j.map(function (p) {
        return { u: p.u, t: p.t, d: p.d, nt: normal(p.t), nd: normal(p.d || ''),
                 nk: normal(p.k || ''), nh: normal((p.h || []).join(' ')) };
      });
      carregando = false;
      desenhar(campo.value);
    })['catch'](function () {
      carregando = false;
      aviso.innerHTML = 'Não consegui carregar a busca agora. ' +
        '<a href="/blog">Veja o blog inteiro</a> ou recarregue a página.';
    });
  }

  function abrir(inicial) {
    if (!caixa) montar();
    ultimoFoco = document.activeElement;
    caixa.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    campo.value = inicial || '';
    campo.focus();
    if (dados) desenhar(campo.value); else carregar();
  }

  function fechar() {
    if (!caixa || caixa.hidden) return;
    caixa.hidden = true;
    document.documentElement.style.overflow = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  [].forEach.call(gatilhos, function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); abrir(''); });
  });

  document.addEventListener('keydown', function (e) {
    var alvo = e.target, digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' ||
               alvo.tagName === 'SELECT' || alvo.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrir(''); return; }
    if (e.key === '/' && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); abrir(''); }
  });
})();
