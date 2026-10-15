// Mede a busca do site (a lupa) contra o gabarito: para cada busca, onde a pagina certa aparece.
//
// Uso, da raiz do repositorio, com o site servido localmente:
//   npx serve -l 4173 .                        (num terminal)
//   node privado/testar-busca.mjs http://localhost:4173
//
// Precisa do Playwright com o Chromium (npm i -g playwright && npx playwright install chromium;
// se o Node nao achar o pacote global, rode com NODE_PATH apontando para a pasta global do npm).
// O gabarito fica em privado/busca-gabarito.json: [busca, [urls aceitas]]. Para atalho externo
// (simulador, WhatsApp), basta o comeco do link.
//
// Comece o gabarito com as perguntas que os clientes mais fazem no WhatsApp e com o nome de cada
// servico e projeto. Mudou regra ou motor: rode de novo e compare com a rodada anterior.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const gabarito = JSON.parse(fs.readFileSync(new URL('./busca-gabarito.json', import.meta.url)));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base + '/blog', { waitUntil: 'networkidle' });
await page.click('[data-busca]');
await page.waitForFunction(() => { const a = document.querySelector('.bx-aviso'); return a && a.textContent && !/Carregando/.test(a.textContent); });

const res = [];
for (const [q, aceitas] of gabarito) {
  await page.fill('#bx-q', q);
  await page.waitForTimeout(30);
  const links = await page.$$eval('.bx-lista li a', as => as.map(a => a.getAttribute('href')));
  const ok = u => aceitas.some(e => u === e || (e.startsWith('http') && u && u.startsWith(e)));
  const pos = links.findIndex(ok);
  res.push({ q, pos: pos < 0 ? null : pos + 1, n: links.length, top: links.slice(0, 3) });
}
await browser.close();

const primeiro = res.filter(r => r.pos === 1).length, tres = res.filter(r => r.pos && r.pos <= 3).length;
const errou = res.filter(r => !r.pos), vazio = res.filter(r => !r.n);
console.log(`${res.length} buscas | certo em 1o: ${primeiro} | nos 3 primeiros: ${tres} | nao achou o certo: ${errou.length} | sem resultado: ${vazio.length}`);
for (const r of res.filter(r => r.pos !== 1)) {
  console.log(`  ${(r.pos ? 'em ' + r.pos + 'o' : 'nao achou').padEnd(10)} ${r.q.padEnd(40)} ${r.top.join(', ')}`);
}
process.exitCode = errou.length ? 1 : 0;
