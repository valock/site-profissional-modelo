/* Google Analytics 4 e medição de clique no WhatsApp.
   O ID vem do site.json (ga4_id). Vazio, o script não faz nada. */
(function () {
  var ID = '{{GA4_ID}}';
  if (!ID || ID.indexOf('G-') !== 0) return;
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);
  /* O gtag.js só baixa depois do load ou da primeira interação, para não
     disputar banda com o texto. A fila guarda o que for disparado antes. */
  var pedido = false, SINAIS = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
  function carregar() {
    if (pedido) return; pedido = true;
    SINAIS.forEach(function (ev) { window.removeEventListener(ev, carregar, { passive: true }); });
    var g = document.createElement('script'); g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID; document.head.appendChild(g);
  }
  SINAIS.forEach(function (ev) { window.addEventListener(ev, carregar, { passive: true }); });
  if (document.readyState === 'complete') carregar(); else window.addEventListener('load', carregar);
  setTimeout(carregar, 3500);
  // Clique no WhatsApp = conversão, com a posição do botão e o serviço, se o link tiver data-servico
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
    if (!a) return;
    var pos = 'outro';
    if (a.closest('.art-cta')) pos = 'cta_final';
    else if (a.closest('.wa-float')) pos = 'botao_flutuante';
    else if (a.closest('.serv')) pos = 'servico';
    else if (a.classList.contains('wa-inline')) pos = 'cta_meio';
    else if (a.closest('.hero')) pos = 'topo';
    else if (a.closest('.nav')) pos = 'menu';
    else if (a.closest('footer')) pos = 'rodape';
    else if (a.closest('.prose')) pos = 'texto';
    var p = { posicao: pos, pagina: location.pathname };
    if (a.getAttribute('data-servico')) p.servico = a.getAttribute('data-servico');
    gtag('event', 'contato_whatsapp', p);
  }, true);
})();
