// A BATERIA (fase 1, fundacao). A mesma do dinotrails-web: roda cada suite dentro do JOGO DE VERDADE (cena, fisica, entrada) num
// Chromium do Playwright e devolve codigo 1 se qualquer uma falhar.
//
//   node testes/rodar.js                       # todas as suites
//   node testes/rodar.js --so fisica pistas    # so as que casarem com esses nomes
//   node testes/rodar.js --mobile pixel        # emula o aparelho (pixel = Pixel 7, iphone = iPhone 14): tela, toque, userAgent, DPR
//   node testes/rodar.js --html                # tambem abre o TurboCaos.html em file:// e corre uma corrida (testes/html_unico.js)
//   node testes/rodar.js --artefato            # tambem serve dist/artefato (a pasta publicada no claude.ai) e corre uma corrida
//   node testes/rodar.js --gpu                 # com janela e placa de video (medir fps de verdade)
//   node testes/rodar.js --porta 8131          # outra porta (cada agente pode usar a sua)
//   node testes/rodar.js --lista
//
// SEM GPU DE PROPOSITO (por padrao): SwiftShader. A bateria mede COMPORTAMENTO (o carro pousa, a IA chega, o poder congela) — pixel
// e fps de verdade sao assunto do --gpu e do celular.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.dirname(AQUI);
const require = createRequire(import.meta.url);

const argv = process.argv.slice(2);
const pega = (nome, padrao) => { const i = argv.indexOf(nome); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : padrao; };
const pegaVarios = (nome) => { const i = argv.indexOf(nome); if (i < 0) return []; const r = []; for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) r.push(argv[k]); return r; };
const PORTA = Number(pega('--porta', process.env.PORTA || 8125));
const COM_GPU = argv.includes('--gpu');
const COM_HTML = argv.includes('--html');
const COM_ARTEFATO = argv.includes('--artefato');
const MOBILE = pega('--mobile', null);
const SO_LISTA = argv.includes('--lista');
const FILTROS = pegaVarios('--so');
const LIMITE = Number(pega('--limite', 300000)); // ms por suite: corrida completa em SwiftShader e lenta, mas nao e eterna

const APARELHOS = { pixel: 'Pixel 7', iphone: 'iPhone 14' };

const existentes = fs.readdirSync(AQUI).filter((f) => /^teste_.+\.js$/.test(f)).map((f) => f.replace(/^teste_|\.js$/g, '')).sort();
let suites = existentes;
if (FILTROS.length) suites = suites.filter((s) => FILTROS.some((f) => s.includes(f)));
if (SO_LISTA) { console.log(suites.join('\n')); process.exit(0); }

// ---------------------------------------------------------------- servidor (sonda a porta antes: outro jogo na mesma porta respondia no lugar)
async function sondaPorta() {
  try {
    const r = await fetch(`http://localhost:${PORTA}/index.html`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return 'estranho';
    return /Turbo Caos/.test(await r.text()) ? 'nosso' : 'estranho';
  } catch (e) { return 'livre'; }
}
function sobeServidor(porta = PORTA, pasta = null) {
  return new Promise((res, rej) => {
    const py = process.platform === 'win32' ? 'python' : 'python3';
    const p = spawn(py, [path.join(RAIZ, 'server.py'), String(porta), ...(pasta ? ['--pasta', pasta] : [])], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'] });
    let saiu = false;
    p.stdout.on('data', (b) => { if (String(b).includes('Jogo rodando')) res(p); });
    p.stderr.on('data', (b) => { const s = String(b); if (/Address already in use|normalmente e permitida|only one usage/i.test(s)) { saiu = true; rej(new Error(`a porta ${porta} ja esta em uso — passe --porta`)); } });
    p.on('error', rej);
    p.on('exit', (c) => { if (!saiu) rej(new Error('o server.py saiu com codigo ' + c)); });
    setTimeout(() => res(p), 2500);
  });
}

export function argsDoNavegador(gpu) {
  if (gpu) return ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--force_high_performance_gpu'];
  return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
}

/** Contexto do navegador: desktop 800x450 (SwiftShader barato) ou o aparelho emulado. */
export async function novoContexto(navegador, pw, mobile, gpu) {
  if (mobile) {
    const nome = APARELHOS[mobile] || mobile;
    const d = pw.devices[nome];
    if (!d) throw new Error('aparelho desconhecido: ' + mobile);
    const { defaultBrowserType, ...resto } = d; // emulado no Chromium (o WebKit nao vem instalado)
    // deitado: o jogo e em paisagem
    return navegador.newContext({ ...resto, viewport: { width: resto.viewport.height, height: resto.viewport.width } });
  }
  return navegador.newContext({ viewport: { width: gpu ? 1280 : 800, height: gpu ? 720 : 450 } });
}

async function main() {
  let pw;
  try { pw = require('playwright'); } catch (e) { console.error('Playwright nao instalado (npm i -D playwright; npx playwright install chromium)'); process.exit(2); }
  const quem = await sondaPorta();
  if (quem === 'estranho') { console.error(`A porta ${PORTA} esta ocupada por OUTRO servidor. Pare-o ou passe --porta.`); process.exit(2); }
  const servidor = quem === 'livre' ? await sobeServidor() : null;
  const navegador = await pw.chromium.launch({ headless: !COM_GPU, args: argsDoNavegador(COM_GPU) });
  const ctx = await novoContexto(navegador, pw, MOBILE, COM_GPU);
  if (MOBILE) console.log(`(emulando ${APARELHOS[MOBILE] || MOBILE}, deitado)`);

  let totalFalhas = 0;
  const quebradas = [];
  const t0 = Date.now();
  for (const nome of suites) {
    console.log(`=== ${nome} ===`);
    const pagina = await ctx.newPage();
    const console_ = [];
    pagina.on('console', (m) => console_.push({ tipo: m.type(), texto: m.text() }));
    pagina.on('pageerror', (e) => console_.push({ tipo: 'error', texto: 'PAGEERROR ' + (e && (e.stack || e.message)) }));
    let resultado = null;
    try {
      await pagina.goto(`http://localhost:${PORTA}/index.html?teste=${encodeURIComponent(nome)}&mudo=1`, { timeout: 60000 });
      await pagina.waitForFunction('window.__resultado !== undefined', null, { timeout: LIMITE, polling: 200 });
      resultado = await pagina.evaluate(() => window.__resultado);
    } catch (e) {
      console.log(`[ERRO] ${nome}: a suite nao terminou — ${e && e.message}`);
      for (const l of console_.filter((c) => c.tipo === 'error').slice(-6)) console.log('       ' + l.texto.slice(0, 400));
      totalFalhas++; quebradas.push(nome + ' (sem saida)');
      await pagina.close();
      continue;
    }
    for (const l of resultado.linhas) console.log(l);
    // erro de pagina que a suite nao viu (modulo que nao importou, shader que nao compilou) tambem conta
    const erros = console_.filter((c) => c.tipo === 'error' && !/^\[ERRO\]/.test(c.texto));
    if (erros.length) { console.log(`[ERRO] ${nome}: ${erros.length} erro(s) no console que a suite nao viu`); for (const e of erros.slice(0, 5)) console.log('       ' + e.texto.slice(0, 400)); resultado.falhas += erros.length; }
    console.log('FALHAS: ' + resultado.falhas);
    totalFalhas += resultado.falhas;
    if (resultado.falhas > 0) quebradas.push(nome);
    await pagina.close();
  }

  if (COM_HTML) {
    const { testaHtmlUnico } = await import('./html_unico.js');
    console.log('=== html_unico ===');
    const f = await testaHtmlUnico(ctx, RAIZ);
    console.log('FALHAS: ' + f);
    totalFalhas += f;
    if (f) quebradas.push('html_unico');
  }

  if (COM_ARTEFATO) {
    const { testaPagina } = await import('./html_unico.js');
    console.log('=== artefato ===');
    const pasta = path.join(RAIZ, 'dist', 'artefato');
    let f = 0;
    if (!fs.existsSync(path.join(pasta, 'index.html'))) { console.log('[ERRO] artefato: dist/artefato nao existe (rode node tools/monta.js)'); f = 1; }
    else {
      const srv = await sobeServidor(PORTA + 50, pasta); // +50: as portas vizinhas sao de outros agentes
      f = await testaPagina(ctx, `http://localhost:${PORTA + 50}/index.html`, "artefato");
      srv.kill();
    }
    console.log('FALHAS: ' + f);
    totalFalhas += f;
    if (f) quebradas.push('artefato');
  }

  await ctx.close();
  await navegador.close();
  if (servidor) servidor.kill();
  console.log('');
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  if (totalFalhas === 0) { console.log(`TUDO VERDE — ${suites.length + (COM_HTML ? 1 : 0) + (COM_ARTEFATO ? 1 : 0)} suite(s) em ${seg} s`); console.log('FALHAS: 0'); process.exit(0); }
  console.log(`${totalFalhas} falha(s) em: ${quebradas.join(', ')}  (${seg} s)`);
  console.log('FALHAS: ' + totalFalhas);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
