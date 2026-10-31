// FOTOS DAS TELAS (fase 6): abre o jogo num aparelho emulado DEITADO, passeia por todas as telas pelos botoes de verdade e salva uma
// foto de cada em docs/fotos/telas/<aparelho>_<nn>_<tela>.png — para OLHAR antes de declarar pronto (regra herdada do dinotrails-web:
// "mudanca visual: foto e OLHE"). Fotos em pixel CSS (scale 'css'): e o tamanho que a crianca ve, e o que decide se o texto e grande.
//
//   node tools/foto_telas.js                         # Pixel 7 deitado (padrao)
//   node tools/foto_telas.js --aparelho todos        # pixel, iphone, pequeno (360 px de altura), tablet, desktop
//   node tools/foto_telas.js --aparelho pequeno --so menu,resultado
//   node tools/foto_telas.js --carro voador          # escolhe o carro antes (o nome mais comprido: "Toyota GR Yaris Voador")
//   node tools/foto_telas.js --porta 8136
//
// ?foto=1 fixa as sementes (o mesmo podio a cada rodada) e o qualidade.js nao mede fps. ?mudo=1: sem som.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { argsDoNavegador } from '../testes/rodar.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.dirname(AQUI);
const SAIDA = path.join(RAIZ, 'docs', 'fotos', 'telas');
const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const pega = (n, p) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : p; };
const PORTA = Number(pega('--porta', 8136));
const SO = (pega('--so', '') || '').split(',').filter(Boolean);
const CARRO = pega('--carro', null);
/** nome -> dispositivo do Playwright (deitado) ou viewport de desktop */
const APARELHOS = { pixel: 'Pixel 7', iphone: 'iPhone 14', pequeno: 'Galaxy S8', tablet: 'iPad (gen 7)', desktop: null };
const escolha = pega('--aparelho', 'pixel');
const lista = escolha === 'todos' ? Object.keys(APARELHOS) : escolha.split(',');

async function servidor() {
  try { const r = await fetch(`http://localhost:${PORTA}/index.html`, { signal: AbortSignal.timeout(1500) }); if (r.ok) return null; } catch (e) { /* livre */ }
  const p = spawn(process.platform === 'win32' ? 'python' : 'python3', [path.join(RAIZ, 'server.py'), String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  return p;
}

async function contexto(nav, pw, nome) {
  const d = APARELHOS[nome];
  if (!d) return nav.newContext({ viewport: { width: 1280, height: 720 } });
  const { defaultBrowserType, ...resto } = pw.devices[d];
  return nav.newContext({ ...resto, viewport: { width: resto.viewport.height, height: resto.viewport.width } });
}

async function fotografa(nav, pw, aparelho) {
  const ctx = await contexto(nav, pw, aparelho);
  const p = await ctx.newPage();
  const erros = [];
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + (e.stack || e.message).slice(0, 400)));
  await p.goto(`http://localhost:${PORTA}/index.html?mudo=1&foto=1&voltas=1&corredores=8&auto=1`);
  await p.waitForFunction('window.__pronto === true || window.__erro', null, { timeout: 120000 });
  const vp = p.viewportSize();
  let n = 0;
  const foto = async (nome) => {
    n++;
    if (SO.length && !SO.includes(nome)) return;
    const arq = path.join(SAIDA, `${aparelho}_${String(n).padStart(2, '0')}_${nome}.png`);
    // animations 'disabled': animacao finita vai direto ao fim (no SwiftShader do tablet um quadro leva segundos e a foto pegava o
    // painel no meio do "pop" de entrada); timeout longo pelo mesmo motivo
    await p.screenshot({ path: arq, scale: 'css', timeout: 180000, animations: 'disabled' });
    console.log('  foto: ' + path.relative(RAIZ, arq));
  };
  const esperaVitrine = () => p.waitForFunction(() => !window.G.telas.vitrine.carregando, null, { timeout: 60000 }).then(() => p.waitForTimeout(900));
  const clica = (sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('sem botao ' + s); b.click(); }, sel);
  // um toque de dedo de verdade (a entrada da fase 2 so mostra os controles de toque depois do primeiro toque)
  if (APARELHOS[aparelho]) { try { await p.touchscreen.tap(vp.width * 0.5, vp.height * 0.04); } catch (e) { /* sem toque */ } }

  if (CARRO) await p.evaluate((id) => { window.G.jogo.escolheCarro(id); window.G.telas.mostra('menu'); }, CARRO);
  await esperaVitrine(); await foto('menu');
  await clica('[data-acao=livre]'); await esperaVitrine(); await foto('selecao_carro');
  for (let k = 0; k < 6; k++) await clica('[data-acao=carro_proximo]');
  await esperaVitrine(); await foto('selecao_carro_2');
  for (let k = 0; k < 6; k++) await clica('[data-acao=carro_anterior]');
  await clica('[data-acao=escolhe_carro]'); await p.waitForTimeout(700); await foto('selecao_pista');
  await p.evaluate(() => { const G = window.G; G.telas.mostra('carregando_corrida', { pista: G.jogo.pistas()[0].def.id, carro: G.jogo.carroEscolhido }); });
  await p.waitForTimeout(400); await foto('carregando_corrida');
  await p.evaluate(() => window.G.telas.mostra('selecao_pista'));
  await clica('.sp-cartao:not(.bloqueada)');
  await p.waitForFunction(() => window.G.corrida && window.G.corrida.estado === 'contagem' && window.G.telas.atual === 'corrida', null, { timeout: 120000 });
  await p.waitForTimeout(350); await foto('corrida_contagem');
  // corrida: avanca a simulacao na mao (o laco tambem anda; tanto faz para a foto)
  // (sem aviso no meio da tela desde 30/10/2026: o hud.aviso saiu)
  await p.evaluate(() => { const G = window.G; for (let k = 0; k < 60 * 9; k++) G.passo(G.PASSO); });
  await p.waitForTimeout(500); await foto('corrida');
  await clica('[data-acao=pausar]'); await p.waitForTimeout(500); await foto('pausa');
  await clica('[data-acao=continuar]');
  await p.evaluate(() => { const G = window.G; for (let k = 0; k < 60 * 400 && G.telas.atual !== 'resultado'; k++) G.passo(G.PASSO); });
  await esperaVitrine(); await p.waitForTimeout(1200); await foto('resultado');
  await p.evaluate(() => { const G = window.G; G.jogo.campeonato(true); G.telas.mostra('campeonato'); });
  await p.waitForTimeout(600); await foto('campeonato');
  await p.evaluate(() => window.G.telas.mostra('menu'));
  await esperaVitrine();
  await clica('[data-acao=opcoes]'); await p.waitForTimeout(500); await foto('opcoes');
  await clica('[data-acao=apagar_progresso]'); await p.waitForTimeout(500); await foto('confirma');
  await clica('[data-acao=confirma_nao]');
  if (erros.length) { console.log(`  ERROS no console (${erros.length}):`); for (const e of erros.slice(0, 8)) console.log('    ' + e); }
  await ctx.close();
  return erros.length;
}

async function main() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const pw = require('playwright');
  const srv = await servidor();
  const nav = await pw.chromium.launch({ args: argsDoNavegador(false) });
  let erros = 0;
  for (const a of lista) { console.log(`=== ${a} ===`); erros += await fotografa(nav, pw, a); }
  await nav.close();
  if (srv) srv.kill();
  console.log(erros ? `ERROS: ${erros}` : 'fotos prontas, console limpo');
  process.exit(erros ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
