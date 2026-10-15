/* Busca do site: o carregador. Fica em toda pagina e pesa pouco, porque so liga a lupa.
   O motor (js/busca-motor.js) e o indice (/busca-indice.json) so descem quando a pessoa
   chega perto da lupa, clica nela, aperta / ou Ctrl+K, abre um link com ?busca=termo ou
   cai na pagina 404 (que mostra as paginas parecidas com o endereco quebrado). */
(function () {
  'use strict';
  var gatilhos = document.querySelectorAll('[data-busca]'), alvo404 = document.querySelector('[data-busca-404]');
  if ((!gatilhos.length && !alvo404) || !window.fetch || !window.Promise) return;

  var pedido = null;
  function motor() {
    if (window.BuscaSite) return Promise.resolve(window.BuscaSite);
    if (pedido) return pedido;
    pedido = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = '/js/busca-motor.js';
      s.async = true;
      s.onload = function () { if (window.BuscaSite) ok(window.BuscaSite); else falha(new Error('motor')); };
      s.onerror = function () { pedido = null; falha(new Error('motor')); };
      document.head.appendChild(s);
    });
    return pedido;
  }
  function abrir(termo) {
    motor().then(function (b) { b.abrir(termo || ''); }, function () { location.href = '/blog'; });
  }
  function aquecer() {
    motor().then(function (b) { return b.baixar(); })['catch'](function () {});
  }

  [].forEach.call(gatilhos, function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); abrir(''); });
    ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) {
      b.addEventListener(ev, aquecer, { passive: true, once: true });
    });
  });

  document.addEventListener('keydown', function (e) {
    if (!gatilhos.length) return;
    var alvo = e.target, digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' ||
               alvo.tagName === 'SELECT' || alvo.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); abrir(''); return; }
    if (e.key === '/' && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); abrir(''); }
  });

  /* seusite.com.br/?busca=orcamento abre a busca ja com o termo */
  var pedidoUrl = /[?&]busca=([^&#]*)/.exec(location.search);
  if (pedidoUrl && gatilhos.length) {
    var termo = '';
    try { termo = decodeURIComponent(pedidoUrl[1].replace(/\+/g, ' ')); } catch (e) { termo = ''; }
    abrir(termo);
  }

  if (alvo404) motor().then(function (b) { b.sugerir404(alvo404); })['catch'](function () {});
})();
