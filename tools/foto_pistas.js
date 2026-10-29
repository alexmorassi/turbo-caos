// FOTOS DAS PISTAS (fase 3). Abre o JOGO DE VERDADE (index.html?pista=<id>&carro=<id>&auto=1&semente=1&foto=1), espera a corrida
// carregar, CONGELA o laco (nada anda entre uma foto e outra) e fotografa so o canvas, sem HUD, de pontos fixos da pista:
//   <id>_planta.png   de cima, a pista inteira (sem neblina)
//   <id>_largada.png  camera de corrida atras da grade, com os carros e o portico
//   <id>_figura.png   a figura principal (o loop, ou a primeira rampa) vista de lado, com o carro do jogador em cima
//   <id>_atalho.png   a boca do primeiro atalho, vista de quem chega
//   <id>_giro.png     saca-rolha ou paredao (so nas pistas que tem)
// e uma FOLHA de contato por pista (<id>_folha.png, as fotos em grade, metade do tamanho) para olhar tudo de uma vez.
//
//   node tools/foto_pistas.js                 # as 10 pistas, porta 8133
//   node tools/foto_pistas.js orla neon       # so essas
//   node tools/foto_pistas.js --porta 8140 --gpu
// Pasta: docs/fotos/pistas/. A semente e fixa: a foto de hoje compara com a de ontem (o cenario e semeado pelo id da pista).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.dirname(AQUI);
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const pega = (nome, padrao) => { const i = argv.indexOf(nome); return i >= 0 && argv[i + 1] ? argv[i + 1] : padrao; };
const PORTA = Number(pega('--porta', 8133));
const GPU = argv.includes('--gpu');
const PASTA = path.join(RAIZ, 'docs', 'fotos', 'pistas');
const TODAS = ['orla', 'favela', 'deserto', 'gelo', 'vulcao', 'selva', 'neon', 'porto', 'canyon', 'maluca'];
const ids = argv.filter((a, k) => !a.startsWith('--') && argv[k - 1] !== '--porta');
const PISTAS = ids.length ? ids : TODAS;
/** um carro diferente em cada pista (a foto tambem mostra que todos os carros andam em todas) */
const CARROS = ['faisca', 'buguinho', 'dourado', 'picole', 'vulcao', 'lagartixa', 'tubarao', 'kombosa', 'jatinho', 'voador'];
const W = 1280, H = 720;

async function servidor() {
  try { const r = await fetch(`http://localhost:${PORTA}/index.html`, { signal: AbortSignal.timeout(1500) }); if (r.ok && /Turbo Caos/.test(await r.text())) return null; } catch (e) { /* livre */ }
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const p = spawn(py, [path.join(RAIZ, 'server.py'), String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  for (let k = 0; k < 60; k++) { await new Promise((r) => setTimeout(r, 100)); try { const r = await fetch(`http://localhost:${PORTA}/index.html`); if (r.ok) break; } catch (e) { /* subindo */ } }
  return p;
}

/** Roda DENTRO da pagina: as vistas. Recebe o nome da vista e devolve false se ela nao existe nesta pista. */
function vistaNaPagina(nome) {
  const G = window.G, c = G.corrida, pista = c.pista, cam = G.camera, THREE = window.__THREE;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const S0 = pista.principal;
  const quadroEm = (S, s) => { const T = v(), N = v(), R = v(); S.quadro(S.normaliza(s), T, N, R); return { T, N, R, P: S.ponto(S.normaliza(s), 0, 0, v()) }; };
  const olha = (pos, alvo, up = v(0, 1, 0), fov = 60) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.copy(pos); cam.up.copy(up); cam.lookAt(alvo); cam.updateMatrixWorld(); };
  const corrida = (S, s, d = 0, atras = 11, alto = 4.2) => {
    const a = S.ponto(S.normaliza(s - atras), d, alto, v()), b = S.ponto(S.normaliza(s + 10), d, 1.2, v()), q = quadroEm(S, s);
    olha(a, b, q.N, 62);
  };
  const sDoPonto = (sup, k) => (sup === 0 ? pista.sDoPonto(k) : null);
  // a visada de lado esta livre? (um raio da camera ao alvo; so conta o cenario instanciado — predio, arvore, casa —, nunca a pista)
  // tres raios em leque (o centro e 18 graus para cada lado): predio grudado na camera tapa meio quadro sem cruzar a linha do alvo
  const livreAte = (de, ate) => {
    const base = ate.clone().sub(de), dist = base.length(); base.normalize();
    const objs = []; c.cena.traverse((o) => { if (o.isInstancedMesh && o.visible) objs.push(o); });
    for (const ang of [0, 0.32, -0.32]) {
      const dir = base.clone().applyAxisAngle(v(0, 1, 0), ang);
      if (new THREE.Raycaster(de, dir, 0, dist * 0.9).intersectObjects(objs, false).length) return false;
    }
    return true;
  };
  const figs = (pista.def.figuras || []).map((f) => ({ ...f, s0: sDoPonto(0, f.de), s1: sDoPonto(0, f.ate) }));
  const poeCarro = (sup, s, d = 0) => { const j = c.jogador; j.colocaNaPista(sup, s, d, 0, 0); if (j.visual && j.visual.quadro) j.visual.quadro(0); };
  let semNeblina = false;
  if (nome === 'planta') {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const S of pista.superficies) for (let i = 0; i < S.n; i++) { const x = S.P[i * 3], z = S.P[i * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = Math.max(x1 - x0, (z1 - z0) * cam.aspect) * 0.6 + 40;
    const h = Math.min(cam.far * 0.8, L / Math.tan(THREE.MathUtils.degToRad(30)));
    // olhando de cima com a reta da largada apontando para cima da foto (a direita do piloto fica a direita: o mapa da crianca)
    const q = quadroEm(S0, 0);
    olha(v(cx, h, cz), v(cx, 0, cz), v(q.T.x, 0, q.T.z).normalize(), 60);
    semNeblina = true;
  } else if (nome === 'largada') {
    corrida(S0, -36, 0, 14, 5.5);
  } else if (nome === 'figura') {
    const f = figs.find((g) => g.tipo === 'loop') || figs.find((g) => g.tipo === 'rampa');
    if (!f) return false;
    const q = quadroEm(S0, f.s0), meio = (f.s0 + f.s1) / 2;
    if (f.tipo === 'loop') {
      const topo = S0.ponto(S0.normaliza(meio), 0, 0, v()), base = q.P;
      const centro = topo.clone().add(base).multiplyScalar(0.5);
      poeCarro(0, f.s0 - 14, 0);
      const lado = v(q.R.x, 0, q.R.z).normalize();
      // de lado e um pouco de cima; se o cenario tapa (os predios da cidade), a vista de quem chega pela pista
      const de = centro.clone().addScaledVector(lado, 56).addScaledVector(v(q.T.x, 0, q.T.z).normalize(), -34).add(v(0, 16, 0));
      if (livreAte(de, centro)) olha(de, centro, v(0, 1, 0), 58);
      else olha(S0.ponto(S0.normaliza(f.s0 - 46), 0, 9, v()), centro, v(0, 1, 0), 62);
    } else {
      const sC = pista.sDoPonto(f.crista), sP = pista.sDoPonto(f.pouso), qc = quadroEm(S0, sC), meioVao = S0.ponto(S0.normaliza((sC + sP) / 2), 0, 0, v());
      poeCarro(0, sC - 9, 0);
      const lado = v(qc.R.x, 0, qc.R.z).normalize();
      // de lado e de cima (o fosso embaixo do vao aparece); o lado e o que tem MENOS coisa entre a camera e o salto
      const livre = (sinal) => { let n = 0; const p = meioVao.clone().addScaledVector(lado, 34 * sinal); c.cena.traverse((o) => { if (o.isInstancedMesh && o.boundingSphere && o.boundingSphere.center.distanceTo(p) < o.boundingSphere.radius) n++; }); return n; };
      const sinal = livre(1) <= livre(-1) ? 1 : -1;
      olha(meioVao.clone().addScaledVector(lado, 34 * sinal).addScaledVector(v(qc.T.x, 0, qc.T.z).normalize(), -26).add(v(0, 13, 0)), meioVao.clone().add(v(0, -1, 0)), v(0, 1, 0), 62);
    }
  } else if (nome === 'atalho') {
    const a = pista.atalhos[0];
    if (!a) return false;
    corrida(S0, a.sEntrada - 8, a.lado * 3.5, 22, 6);
  } else if (nome === 'giro') {
    const f = figs.find((g) => g.tipo === 'saca_rolha') || figs.find((g) => g.tipo === 'paredao');
    if (!f) return false;
    const meio = (f.s0 + f.s1) / 2, q = quadroEm(S0, f.s0), alvo = S0.ponto(S0.normaliza(meio), 0, 0, v());
    poeCarro(0, f.s0 - 12, 0);
    const lado = v(q.R.x, 0, q.R.z).normalize();
    const de = alvo.clone().addScaledVector(lado, f.tipo === 'paredao' ? -42 : 44).addScaledVector(v(q.T.x, 0, q.T.z).normalize(), -50).add(v(0, 26, 0));
    if (livreAte(de, alvo)) olha(de, alvo, v(0, 1, 0), 60);
    else olha(S0.ponto(S0.normaliza(f.s0 - 40), 0, 8, v()), alvo, v(0, 1, 0), 62);
  }
  // desenha: o ceu segue a camera, os carros sincronizam a malha
  for (const k of c.carros) if (k.visual && k.visual.quadro) k.visual.quadro(0);
  c.visual.quadro(0);
  const f = c.cena.fog, longe = f ? f.far : 0, perto = f ? f.near : 0;
  if (f && semNeblina) { f.near = 1e5 - 1; f.far = 1e5; }
  G.renderer.render(c.cena, cam);
  if (f && semNeblina) { f.near = perto; f.far = longe; }
  return true;
}

async function main() {
  let pw; try { pw = require('playwright'); } catch (e) { console.error('Playwright nao instalado'); process.exit(2); }
  fs.mkdirSync(PASTA, { recursive: true });
  const srv = await servidor();
  const args = GPU ? ['--use-gl=angle', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
  const nav = await pw.chromium.launch({ headless: true, args });
  const ctx = await nav.newContext({ viewport: { width: W, height: H } });
  let sharp = null; try { sharp = require('sharp'); } catch (e) { /* sem folha de contato */ }
  let erros = 0;
  for (const [k, id] of PISTAS.entries()) {
    const pg = await ctx.newPage();
    const avisos = [];
    pg.on('console', (m) => { if (m.type() === 'error') avisos.push(m.text()); });
    pg.on('pageerror', (e) => avisos.push('PAGEERROR ' + e.message));
    const carro = CARROS[TODAS.indexOf(id) % CARROS.length] || 'vulcao';
    await pg.goto(`http://localhost:${PORTA}/index.html?pista=${id}&carro=${carro}&auto=1&semente=1&foto=1&mudo=1`, { timeout: 60000 });
    await pg.waitForFunction('window.G && G.corrida && G.corrida.estado !== "carregando" && G.corrida.visual', null, { timeout: 120000, polling: 200 });
    // o THREE da pagina (o mesmo do jogo) para as contas das vistas; congela o laco e some com o HUD
    await pg.addScriptTag({ type: 'module', content: "import * as THREE from 'three'; window.__THREE = THREE;" });
    await pg.waitForFunction('window.__THREE', null, { timeout: 10000 });
    await pg.evaluate(() => {
      window.__pronto = false; // js/main.js: o laco para de simular e de desenhar
      for (const id of ['hud', 'controles', 'ui', 'carregando', 'gire']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
      for (const e of document.querySelectorAll('body > div')) if (e.id !== 'jogo') e.style.display = 'none';
    });
    const fotos = [];
    for (const nome of ['planta', 'largada', 'figura', 'atalho', 'giro']) {
      const tem = await pg.evaluate(vistaNaPagina, nome);
      if (!tem) continue;
      const arq = path.join(PASTA, `${id}_${nome}.png`);
      await pg.locator('canvas#tela3d').screenshot({ path: arq });
      fotos.push(arq);
    }
    const info = await pg.evaluate(() => ({ montagem: G.corrida.visual.tMontagem, conta: G.corrida.visual.conta() }));
    console.log(`${id}: ${fotos.length} fotos (carro ${carro}, visual montado em ${Math.round(info.montagem)} ms, ${info.conta.chamadas} malhas, ${Math.round(info.conta.triangulos / 1000)} mil triangulos na cena)`);
    if (avisos.length) { erros += avisos.length; for (const a of avisos.slice(0, 5)) console.log('   ERRO ' + a.slice(0, 300)); }
    if (sharp && fotos.length) {
      const c = 2, w = W / 2, h = H / 2, linhas = Math.ceil(fotos.length / c);
      const peças = await Promise.all(fotos.map(async (f, i) => ({ input: await sharp(f).resize(w, h).toBuffer(), left: (i % c) * w, top: Math.floor(i / c) * h })));
      await sharp({ create: { width: c * w, height: linhas * h, channels: 3, background: '#000000' } }).composite(peças).png().toFile(path.join(PASTA, `${id}_folha.png`));
    }
    await pg.close();
    void k;
  }
  await nav.close();
  if (srv) srv.kill();
  console.log(erros ? `ERROS NO CONSOLE: ${erros}` : 'sem erros no console');
  process.exit(erros ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
