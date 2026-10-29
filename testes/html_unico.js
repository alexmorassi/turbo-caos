// TESTE DO HTML UNICO (fase 1, fundacao): abre o TurboCaos.html DO JEITO QUE O MORASSI ABRE — direto do disco (file://), sem
// servidor — e corre uma corrida curta no piloto automatico. E o que prova que o arquivo funciona sozinho: em file:// o navegador
// bloqueia ES modules e fetch, entao qualquer arquivo que nao foi embutido aparece aqui como erro no console.
// Chamado por `node testes/rodar.js --html`. As suites normais (teste_*.js) nao rodam aqui porque sao ES modules.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function testaHtmlUnico(ctx, raiz, op = {}) {
  const arq = path.join(raiz, 'TurboCaos.html');
  if (!fs.existsSync(arq)) { console.log('[ERRO] html_unico: TurboCaos.html nao existe (rode node tools/monta.js)'); return 1; }
  const mb = fs.statSync(arq).size / 1e6;
  console.log(`[MEDE] html_unico: tamanho = ${mb.toFixed(2)} MB`);
  let f = 0;
  if (!(mb < 25)) { console.log(`[ERRO] html_unico: passou de 25 MB (${mb.toFixed(2)} MB)`); f++; } else console.log(`[OK]   html_unico: tamanho abaixo de 25 MB (${mb.toFixed(2)} MB)`);
  return f + await testaPagina(ctx, pathToFileURL(arq).href, 'html_unico', op);
}

/** A mesma corrida curta numa URL qualquer: o HTML unico em file:// ou a pasta do artefato (dist/artefato) servida por HTTP. */
export async function testaPagina(ctx, base, nome, { pista = 'teste', voltas = 1 } = {}) {
  let falhas = 0;
  const linha = (okk, msg) => { console.log((okk ? '[OK]   ' : '[ERRO] ') + nome + ': ' + msg); if (!okk) falhas++; };
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pagina.on('pageerror', (e) => erros.push('PAGEERROR ' + (e && (e.stack || e.message))));
  const url = base + `?mudo=1&semente=7`;
  const t0 = Date.now();
  await pagina.goto(url, { timeout: 120000 });
  try {
    await pagina.waitForFunction('window.__pronto === true || window.__erro', null, { timeout: 120000 });
  } catch (e) { linha(false, 'o jogo nao ficou pronto: ' + e.message); }
  const erroBoot = await pagina.evaluate(() => window.__erro || null);
  linha(!erroBoot, 'abriu sem erro de boot' + (erroBoot ? ': ' + erroBoot : ''));
  console.log(`[MEDE] ${nome}: abertura = ${((Date.now() - t0) / 1000).toFixed(2)} s`);
  if (!erroBoot) {
    const r = await pagina.evaluate(async ({ pista, voltas }) => {
      const G = window.G;
      G.flags.auto = true;
      const c = await G.jogo.iniciaCorrida({ pista, corredores: 6, voltas, modo: 'livre' });
      let fim = null;
      const desliga = [];
      const max = 60 * 60 * 6; // 6 min de simulacao: teto
      for (let k = 0; k < max && c.estado !== 'terminou'; k++) { G.passo(G.PASSO); if (k % 120 === 0) G.quadro(G.PASSO); }
      fim = c.resultado;
      const carros = c.carros.length, malhas = [];
      c.cena.traverse((o) => { if (o.isMesh) malhas.push(o.name); });
      return { estado: c.estado, tempo: fim && fim.tempoTotal, posicao: fim && fim.jogador.posicao, carros, malhas: malhas.length };
    }, { pista, voltas });
    linha(r.estado === 'terminou', `corrida de ${voltas} volta(s) na pista "${pista}" terminou (${r.tempo && r.tempo.toFixed(1)} s, jogador em ${r.posicao}º, ${r.carros} carros, ${r.malhas} malhas)`);
  }
  linha(erros.length === 0, `console limpo (${erros.length} erro(s))` + (erros.length ? ': ' + erros.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await pagina.close();
  return falhas;
}
