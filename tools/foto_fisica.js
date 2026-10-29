// FOTOS DA FISICA (fase 2): abre a corrida direta na pista de teste, PARA o laco do jogo (window.__pronto = false: o requestAnimationFrame
// de js/main.js deixa de chamar G.passo) e anda passo a passo com o piloto da suite de fisica, fotografando nos momentos que importam —
// largada (camera de apresentacao), reta, salto sobre o vao (sombra no chao), topo do loop (camera de cabeca para baixo), derrapagem,
// terra do atalho, e closes de lado para conferir roda no asfalto (sem afundar nem flutuar) e o Voador pairando.
//
//   node tools/foto_fisica.js                      # desktop 960x540, carro vulcao
//   node tools/foto_fisica.js --carro voador --mobile pixel --porta 8132
// Saida: docs/fotos/fase2_<momento>[_<carro>].png. SwiftShader (sem GPU): e foto de conferencia, nao de beleza.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { argsDoNavegador, novoContexto } from '../testes/rodar.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const pega = (n, p) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : p; };
const PORTA = Number(pega('--porta', 8132));
const CARRO = pega('--carro', 'vulcao');
const MOBILE = pega('--mobile', null);
const SAIDA = path.join(RAIZ, 'docs', 'fotos');

async function servidor() {
  try { const r = await fetch(`http://localhost:${PORTA}/index.html`); if (r.ok) return null; } catch (e) { /* livre */ }
  const p = spawn(process.platform === 'win32' ? 'python' : 'python3', [path.join(RAIZ, 'server.py'), String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  return p;
}

// o roteiro roda DENTRO da pagina: dirige com o piloto e devolve quando o momento pedido chegou
const ROTEIRO = `
window.__foto = {
  piloto(alvoD = 0) {
    const G = window.G, j = G.corrida.jogador, F = window.__FISICA;
    const sup = G.corrida.pista.sup(j.sup), v = Math.max(2, Math.abs(j.vf));
    const kh = sup.khEm(j.s + v * 0.3);
    const q = v / F.VEL_REFERENCIA, raio = F.RAIO_MINIMO + (j.p.raioRef - F.RAIO_MINIMO) * q * q;
    const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (j.d - alvoD)));
    return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - j.psi)) / (v / raio)));
  },
  // anda ate cond() ou max passos; desenha os ultimos quadros (molas da carroceria e particulas assentam)
  anda(cond, max, op = {}) {
    const G = window.G, e = G.entrada, j = G.corrida.jogador;
    e.simulada = true;
    for (let k = 0; k < max; k++) {
      e.estado.acel = op.acel ?? 1; e.estado.drift = op.drift ? 1 : 0; e.estado.freio = op.drift ? 1 : 0;
      e.estado.direcao = op.direcao !== undefined ? op.direcao : this.piloto(typeof op.alvoD === 'function' ? op.alvoD() : (op.alvoD || 0));
      G.passo(1 / 60);
      if (k % 4 === 0 || max - k < 12) G.quadro(1 / 60);
      if (cond && cond()) { for (let i = 0; i < 2; i++) G.quadro(1 / 60); return k; }
    }
    G.quadro(1 / 60);
    return -1;
  },
  // camera de conferencia: de lado, baixa, olhando as rodas (nao mexe na fisica)
  closeDeLado(dist = 5.5, altura = 0.7) {
    const G = window.G, j = G.corrida.jogador, cam = G.camera;
    cam.position.copy(j.pos).addScaledVector(j.direita, dist).addScaledVector(j.cima, altura).addScaledVector(j.frente, 0.4);
    cam.up.copy(j.cima);
    cam.lookAt(j.pos.x + j.cima.x * 0.5, j.pos.y + j.cima.y * 0.5, j.pos.z + j.cima.z * 0.5);
    cam.fov = 50; cam.updateProjectionMatrix();
    G.renderer.render(G.desenho.cena, cam);
  },
};
`;

async function main() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const srv = await servidor();
  const pw = require('playwright');
  const nav = await pw.chromium.launch({ args: argsDoNavegador(false) });
  const ctx = MOBILE ? await novoContexto(nav, pw, MOBILE, false) : await nav.newContext({ viewport: { width: 960, height: 540 } });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pg.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  await pg.goto(`http://localhost:${PORTA}/index.html?pista=teste&carro=${CARRO}&semente=1&mudo=1&qualidade=${MOBILE ? 'media' : 'alta'}`);
  await pg.waitForFunction(() => window.G && window.G.corrida && window.G.corrida.estado === 'contagem', null, { timeout: 90000 });
  await pg.evaluate(async (roteiro) => {
    window.__pronto = false; // o laco para: daqui em diante so anda quando o roteiro manda
    window.__FISICA = (await import('/config/fisica.js')).FISICA;
    (0, eval)(roteiro);
    for (const x of window.G.corrida.carros) if (x !== window.G.corrida.jogador) x.fantasma = 1e9; // rivais nao atrapalham a foto
    window.G.entrada.mostraControles(true);
  }, ROTEIRO);
  const sufixo = CARRO === 'vulcao' ? '' : '_' + CARRO;
  const foto = async (nome, js) => {
    const info = await pg.evaluate(js);
    const arq = path.join(SAIDA, `fase2_${nome}${sufixo}.png`);
    await pg.screenshot({ path: arq, timeout: 180000 });
    console.log(`${nome}: ${info || ''} -> ${path.relative(RAIZ, arq)}`);
  };
  const estado = `((x) => 's=' + x.s.toFixed(1) + ' d=' + x.d.toFixed(2) + ' h=' + x.h.toFixed(2) + ' v=' + x.vf.toFixed(1) + ' noChao=' + x.noChao + ' cima.y=' + x.cima.y.toFixed(2))(window.G.corrida.jogador)`;
  await foto('1_contagem', `(() => { const G = window.G; for (let k = 0; k < 50; k++) G.passo(1/60); G.quadro(1/60); G.quadro(1/60); return ${estado}; })()`);
  await foto('2_largada', `(() => { const G = window.G; __foto.anda(() => G.corrida.estado === 'correndo', 400, { acel: 0, direcao: 0 }); return ${estado}; })()`);
  await foto('3_reta', `(() => { const G = window.G, j = G.corrida.jogador; __foto.anda(() => j.s > 60 && j.s < 400, 900); return ${estado}; })()`);
  await foto('4_salto', `(() => { const G = window.G, j = G.corrida.jogador; __foto.anda(() => !j.noChao && j.s > 127, 900); return ${estado}; })()`);
  await foto('5_loop_topo', `(() => { const G = window.G, j = G.corrida.jogador; __foto.anda(() => j.cima.y < -0.97, 1500); return ${estado} + ' cam.up.y=' + G.camera.up.y.toFixed(2); })()`);
  await foto('6_derrapagem', `(() => { const G = window.G, j = G.corrida.jogador; __foto.anda(() => j.s > 395 && j.s < 460, 1500); __foto.anda(() => j.derrapando && Math.abs(Math.atan2(j.vr, j.vf)) > 0.35, 240, { drift: true, direcao: 1 }); return ${estado} + ' derrapa=' + (Math.atan2(j.vr, j.vf) * 57.3).toFixed(0) + 'gr'; })()`);
  await foto('7_close_rodas', `(() => { const G = window.G, j = G.corrida.jogador; j.colocaNaPista(0, 30, 0, 0, 12); __foto.anda(null, 40, { direcao: 0 }); __foto.closeDeLado(); return ${estado}; })()`);
  await foto('8_terra', `(() => { const G = window.G, j = G.corrida.jogador, at = G.corrida.pista.atalhos[0]; j.colocaNaPista(at.sup.id, 50, 0, 0, 25); __foto.anda(null, 50); return ${estado}; })()`);
  await foto('9_close_salto', `(() => { const G = window.G, j = G.corrida.jogador; j.colocaNaPista(0, 60, 0, 0, 32); __foto.anda(() => !j.noChao && j.h > 1.2, 600); __foto.closeDeLado(9, 0.5); return ${estado}; })()`);
  // sombra vista de cima: no chao (embaixo do carro) e num pulinho sobre asfalto (some com a altura)
  await foto('10_sombra', `(() => { const G = window.G, j = G.corrida.jogador; j.colocaNaPista(0, 40, 0, 0, 6); __foto.anda(null, 20, { direcao: 0 }); const cam = G.camera; cam.position.copy(j.pos).addScaledVector(j.direita, 3.5).addScaledVector(j.cima, 6).addScaledVector(j.frente, -3); cam.up.set(0, 1, 0); cam.lookAt(j.pos); cam.fov = 55; cam.updateProjectionMatrix(); G.renderer.render(G.desenho.cena, cam); return ${estado}; })()`);
  await foto('11_sombra_no_ar', `(() => { const G = window.G, j = G.corrida.jogador; j.colocaNaPista(0, 40, 0, 0, 6); j.levanta(1.3); __foto.anda(() => j.h > 2.8, 120, { direcao: 0 }); const cam = G.camera; cam.position.copy(j.pos).addScaledVector(j.direita, 4).addScaledVector(j.cima, 4).addScaledVector(j.frente, -6); cam.up.set(0, 1, 0); cam.lookAt(j.pos.x, j.pos.y - 1.5, j.pos.z); cam.fov = 55; cam.updateProjectionMatrix(); G.renderer.render(G.desenho.cena, cam); return ${estado}; })()`);
  // os outros jeitos de controlar (so com tela de toque: --mobile pixel|iphone)
  if (MOBILE) {
    for (const [nome, cfg] of [['12_controles_joystick', { modo: 'joystick', acelAuto: true }], ['13_controles_inclinacao', { modo: 'inclinacao', acelAuto: true }], ['14_controles_manual', { modo: 'botoes', acelAuto: false }]]) {
      await foto(nome, `(() => { const G = window.G; G.entrada.configura(${JSON.stringify(cfg)}); G.entrada.mostraControles(true); const j = G.corrida.jogador; j.colocaNaPista(0, 30, 0, 0, 20); __foto.anda(null, 30, { direcao: 0 }); return '${cfg.modo} acelAuto=${cfg.acelAuto}'; })()`);
    }
    // inclinacao sem sensor (headless nao tem): depois de 1,5 s as setas aparecem de reserva e o aviso sobe
    await foto('13b_inclinacao_sem_sensor', `(() => { const G = window.G; G.entrada.configura({ modo: 'inclinacao', acelAuto: true }); G.entrada.mostraControles(true); __foto.anda(null, 120, { direcao: 0 }); G.entrada._atualizaDom(); G.quadro(1 / 60); return 'sem sensor'; })()`);
    await pg.evaluate(() => window.G.entrada.configura({ modo: 'botoes', acelAuto: true }));
  }
  console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.slice(0, 10).join('\n') : 'console limpo');
  await nav.close();
  if (srv) srv.kill();
}

main().catch((e) => { console.error(e); process.exit(1); });
