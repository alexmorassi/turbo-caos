// FOTOS DA FASE 4: turbo, capsulas e os 10 poderes EM ACAO. Abre a corrida direta (index.html?pista=<id>&carro=vulcao), PARA o laco do
// jogo (window.__pronto = false: o requestAnimationFrame de js/main.js deixa de chamar G.passo), troca a IA pelo piloto do roteiro e
// encena cada momento na RETA MAIS LONGA da pista (achada sozinha): o poder sai do jogador (o poder dele e trocado por foto) ou de um
// rival A FRENTE quando o efeito fica atras de quem usa (oleo e fumaca: a camera de corrida olha para a frente). Entre uma cena e outra
// os carros vao para longe e o tempo anda 12 s (os efeitos da cena anterior acabam).
//
//   node tools/foto_poderes.js                       # orla, 1280x720, porta 8134
//   node tools/foto_poderes.js --pista neon --porta 8134 --mobile pixel
// Saida: docs/fotos/poderes/<cena>.png (o tools/fotos_jpg.py do maestro converte para JPEG). SwiftShader: foto de conferencia.
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
const PORTA = Number(pega('--porta', 8134));
const PISTA = pega('--pista', 'orla');
const MOBILE = pega('--mobile', null);
const SO = pega('--so', null);
const SAIDA = path.join(RAIZ, 'docs', 'fotos', 'poderes');

async function servidor() {
  try { const r = await fetch(`http://localhost:${PORTA}/index.html`, { signal: AbortSignal.timeout(1500) }); if (r.ok && /Turbo Caos/.test(await r.text())) return null; } catch (e) { /* livre */ }
  const p = spawn(process.platform === 'win32' ? 'python' : 'python3', [path.join(RAIZ, 'server.py'), String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
  for (let k = 0; k < 60; k++) { await new Promise((r) => setTimeout(r, 100)); try { const r = await fetch(`http://localhost:${PORTA}/index.html`); if (r.ok) break; } catch (e) { /* subindo */ } }
  return p;
}

// o roteiro roda DENTRO da pagina
const ROTEIRO = `
window.__F = {
  init(FISICA) {
    const G = window.G, c = G.corrida;
    this.FISICA = FISICA; this.c = c; this.j = c.jogador; this.rivais = c.carros.filter((x) => x !== this.j);
    this.planos = new Map();
    for (const x of c.carros) this.planos.set(x, { v: 0, d: 0, turbo: false, poder: false, dir: null });
    const F = this;
    c.ia.passo = () => {
      for (const x of c.carros) {
        const p = F.planos.get(x), k = x.controle;
        if (x.chegou) { k.acel = 0; k.freio = 1; k.direcao = 0; k.turbo = false; k.poder = false; continue; }
        k.acel = x.vf < p.v - 0.2 ? 1 : 0; k.freio = x.vf > p.v + 1.5 ? 0.6 : 0; k.drift = false;
        k.direcao = p.dir !== null ? p.dir : F.lateral(x, p.d); k.turbo = !!p.turbo; k.poder = !!p.poder; p.poder = false;
      }
    };
    c.dificuldade.passo = () => {};
    // a reta mais longa da principal (sem vao, rampa, loop nem curva)
    const P = c.pista.principal, M = window.__MARCA, ruim = M.VAO | M.LANCA | M.MAGNETICO | M.ABRE_DIR | M.ABRE_ESQ;
    let melhor = [0, 0], i0 = -1;
    for (let i = 0; i <= P.n * 2; i++) {
      const k = i % P.n, boa = i < P.n * 2 && Math.abs(P.kh[k]) < 0.004 && !(P.marcas[k] & ruim);
      if (boa && i0 < 0) i0 = i;
      if (!boa && i0 >= 0) { if (i - i0 > melhor[1] - melhor[0]) melhor = [i0, i]; i0 = -1; }
    }
    this.s0 = melhor[0] * P.ds; this.retaComp = (melhor[1] - melhor[0]) * P.ds;
    return 'reta de ' + this.retaComp.toFixed(0) + ' m em s=' + this.s0.toFixed(0);
  },
  lateral(x, alvoD) {
    const F = this.FISICA, sup = x.corrida.pista.sup(x.sup), v = Math.max(2, Math.abs(x.vf));
    const kh = sup.khEm(x.s + v * 0.3), q = v / F.VEL_REFERENCIA, raio = F.RAIO_MINIMO + (x.p.raioRef - F.RAIO_MINIMO) * q * q;
    const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (x.d - alvoD)));
    return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - x.psi)) / (v / raio)));
  },
  poe(x, s, d, v) { x.chegou = false; x.fantasma = 0; x.colocaNaPista(0, this.s0 + s, d, 0, v); x.efeitos.rodopio = x.efeitos.gelo = x.efeitos.levantado = 0; const p = this.planos.get(x); p.v = v; p.d = d; p.turbo = false; p.poder = false; p.dir = null; return x; },
  fora(x, k) { x.chegou = true; x.fantasma = 1e9; x.colocaNaPista(0, this.s0 + this.retaComp + 300 + k * 25, 0, 0, 0); this.planos.get(x).v = 0; },
  /** limpa a cena: todo mundo longe, 12 s de tempo (os efeitos acabam), recargas cheias */
  limpa() {
    const G = window.G;
    this.rivais.forEach((x, k) => this.fora(x, k)); this.fora(this.j, 9);
    for (let k = 0; k < 12 * 60; k++) G.passo(1 / 60);
    for (const x of this.c.carros) { x.poder.restante = 0; x.turbo.carga = 0.6; }
    this.rivais.forEach((x, k) => this.fora(x, k));
  },
  dispara(x, id) { if (id) x.poder.id = id; x.poder.restante = 0; this.planos.get(x).poder = true; },
  // desenha com o tempo que passou desde o ultimo desenho (faisca e clarao envelhecem junto com a simulacao)
  anda(n) { const G = window.G; let p = 0; for (let k = 0; k < n; k++) { G.passo(1 / 60); p++; if (k % 3 === 0 || n - k < 8) { G.quadro(p / 60); p = 0; } } },
  /** camera de conferencia: posicao em (s, d, h) da pista, olhando para (s, d, h) */
  olha(s1, d1, h1, s2, d2, h2, fov = 55) {
    const G = window.G, P = this.c.pista.principal, cam = G.camera, a = new window.__THREE.Vector3(), b = new window.__THREE.Vector3();
    P.ponto(P.normaliza(this.s0 + s1), d1, h1, a); P.ponto(P.normaliza(this.s0 + s2), d2, h2, b);
    cam.position.copy(a); cam.up.set(0, 1, 0); cam.lookAt(b); cam.fov = fov; cam.updateProjectionMatrix();
    G.quadro(1 / 60);
  },
  sDe(x) { return this.c.pista.principal.normaliza(x.s - this.s0); },
};
`;

const CENAS = [
  ['turbo', 'o turbo ligado: chamas e brilho no escapamento, faisca de fogo no rastro', `
    F.limpa(); const j = F.poe(F.j, 20, 0, 30); j.turbo.carga = 1; F.planos.get(j).turbo = true; F.anda(70); return 'v=' + j.vf.toFixed(1);`],
  ['turbo_lado', 'o turbo de lado (as chamas para tras)', `
    const j = F.j; j.turbo.carga = 1;
    // anda ate nao ter capsula perto (senao ela tapa a camera de lado)
    for (let k = 0; k < 300 && F.c.capsulas.lista.some((x) => x.ativa && x.sup === 0 && Math.abs(F.c.pista.principal.normaliza(x.s - j.s + 20) - 20) < 14); k++) { j.turbo.carga = 1; F.anda(1); }
    F.anda(4); const s = F.sDe(j); F.olha(s - 5.5, 5.2, 1.3, s - 1.5, 0, 0.6, 52); return '';`],
  ['capsulas', 'fileira de capsulas azuis na pista (a 30 m)', `
    F.limpa(); const cap = F.c.capsulas.lista.filter((x) => x.sup === 0 && !x.dourada && x.ativa && x.s > F.s0 + 45 && x.s < F.s0 + F.retaComp)[0];
    const j = F.poe(F.j, cap.s - F.s0 - 40, 0, 18); F.anda(30); return 'capsula em ' + (cap.s - j.s).toFixed(0) + ' m';`],
  ['capsula_dourada', 'a dourada de perto (maior, brilhando)', `
    const d = F.c.capsulas.lista.find((x) => x.dourada && x.ativa); const S = F.c.pista.sup(d.sup); const G = window.G, cam = G.camera;
    const a = new window.__THREE.Vector3(), b = new window.__THREE.Vector3(); S.ponto(d.s - 7, d.d + 3, 2.2, a); S.ponto(d.s, d.d, 1.2, b);
    for (let k = 0; k < 20; k++) G.quadro(1 / 60);
    cam.position.copy(a); cam.up.set(0, 1, 0); cam.lookAt(b); cam.fov = 50; cam.updateProjectionMatrix(); G.quadro(1 / 60); return 'sup ' + d.sup + ' s ' + d.s.toFixed(0);`],
  ['capsula_pega', 'pegando: faisca azul e a barra subindo', `
    F.limpa(); const cap = F.c.capsulas.lista.filter((x) => x.sup === 0 && !x.dourada && x.ativa && Math.abs(x.d) < 0.5 && x.s > F.s0 + 45)[0];
    const j = F.poe(F.j, cap.s - F.s0 - 30, 0, 22); j.turbo.carga = 0.2;
    for (let k = 0; k < 200 && cap.ativa; k++) F.anda(1); F.anda(4); return 'turbo ' + Math.round(j.turbo.carga * 100) + '%';`],
  ['oleo_poca', 'Mancha de Oleo: o rival da frente soltou a poca (sobra faixa dos lados)', `
    F.limpa(); const R = F.poe(F.rivais[0], 70, 1, 18), j = F.poe(F.j, 35, -4, 18); F.dispara(R, 'oleo'); F.anda(40); return '';`],
  ['oleo_rodando', 'quem passa na poca roda', `
    const R = F.rivais[1]; const p = F.c.poderes.perigos().find((h) => h.tipo === 'oleo'); F.poe(R, p.s - F.s0 - 14, p.d, 18);
    const j = F.poe(F.j, p.s - F.s0 - 24, -4.5, 18); for (let k = 0; k < 120 && !(R.efeitos.rodopio > 0.6); k++) F.anda(1); F.anda(18); return 'rodopio ' + R.efeitos.rodopio.toFixed(2);`],
  ['emp_carga', 'Pulso EMP carregando: o circulo azul crescendo em volta de quem usou', `
    F.limpa(); const j = F.poe(F.j, 40, 0, 16); F.poe(F.rivais[0], 52, 3.5, 16); F.poe(F.rivais[1], 60, -3, 16); F.poe(F.rivais[2], 75, 0, 16);
    F.dispara(j, 'emp'); F.anda(24); return '';`],
  ['emp_estouro', 'o estouro: o choque (perde velocidade, sem turbo) e as faiscas eletricas em quem ficou dentro', `F.anda(26); return 'vf ' + F.rivais[0].vf.toFixed(1);`],
  ['congelante_raio', 'Raio Congelante correndo pela faixa ate o carro da frente', `
    F.limpa(); const j = F.poe(F.j, 30, 0, 20), R = F.poe(F.rivais[0], 78, 0.4, 16); F.dispara(j, 'congelante'); F.anda(22); return '';`],
  ['congelante_gelo', 'o congelado dentro do bloco de gelo', `
    const R = F.rivais[0]; for (let k = 0; k < 60 && !(R.efeitos.gelo > 0); k++) F.anda(1); F.anda(10); const s = F.sDe(R);
    F.olha(s - 6, 5, 2.2, s, 0.4, 0.8, 50); return 'gelo ' + R.efeitos.gelo.toFixed(2);`],
  ['congelante_mira', 'o raio vai para a faixa do carro da frente (31/10/2026): sai do bico e curva ate o alvo 4,5 m para o lado', `
    F.limpa(); const j = F.poe(F.j, 30, -2, 20), R = F.poe(F.rivais[0], 80, 2.5, 16); F.dispara(j, 'congelante'); F.anda(20); return 'faixa do alvo ' + R.d.toFixed(1);`],
  ['ima', 'Ima: o campo vermelho segura o rival perto e puxa as capsulas', `
    F.limpa(); const cap = F.c.capsulas.lista.filter((x) => x.sup === 0 && x.ativa && !x.dourada && x.s > F.s0 + 60)[0];
    const s = cap.s - F.s0 - 26; const j = F.poe(F.j, s, 0, 14); F.poe(F.rivais[0], s + 9, 3.5, 14); F.poe(F.rivais[1], s + 30, -3, 14);
    F.dispara(j, 'ima'); F.anda(20); return 'voando ' + F.c.capsulas.lista.filter((x) => x.voando).length;`],
  ['trocatroca_mira', 'Troca-Troca mirando: feixe rosa e anel no carro da frente', `
    F.limpa(); const j = F.poe(F.j, 30, 0, 20), R = F.poe(F.rivais[0], 56, 3, 18); F.dispara(j, 'trocatroca'); F.anda(44); return '';`],
  ['trocatroca_troca', 'trocou: o jogador foi para a frente (clarao rosa nos dois lugares)', `F.anda(20); return '';`],
  ['encolhedor_carga', 'Encolhedor: o anel roxo crescendo', `
    F.limpa(); const j = F.poe(F.j, 40, 0, 15); F.poe(F.rivais[0], 52, 3.5, 15); F.poe(F.rivais[1], 58, -3.5, 15); F.dispara(j, 'encolhedor'); F.anda(20); return '';`],
  ['encolhedor_encolhidos', 'os rivais encolhidos (pequenos e lentos) ao lado de quem usou', `F.anda(50); const s = F.sDe(F.rivais[0]); F.olha(s - 9, -1, 2.6, s + 1, 1.5, 0.5, 55); return 'escala ' + F.rivais[0].mod.escala;`],
  ['fumaca_nuvem', 'Cortina de Fumaca: a nuvem colorida do rival da frente (sobra o lado)', `
    F.limpa(); const R = F.poe(F.rivais[0], 62, 1, 18), j = F.poe(F.j, 36, 1, 16); F.dispara(R, 'fumaca'); F.anda(40); return '';`],
  ['fumaca_dentro', 'dentro da nuvem: a tela embaca (HUD da fase 6)', `
    const j = F.j; for (let k = 0; k < 180 && !(j.mod.visao > 0.6); k++) F.anda(1); F.anda(3); return 'visao ' + j.mod.visao.toFixed(2);`],
  ['tornado', 'Mini Tornado correndo pela pista ate o carro da frente', `
    F.limpa(); const j = F.poe(F.j, 25, 0, 18), R = F.poe(F.rivais[0], 85, 0.5, 18); F.dispara(j, 'tornado'); F.anda(28); return '';`],
  ['tornado_levanta', 'quem nao desviou sobe girando', `
    const R = F.rivais[0]; for (let k = 0; k < 90 && !(R.efeitos.levantado > 0); k++) F.anda(1); F.anda(26); const s = F.sDe(R); F.olha(s - 11, 6, 2.0, s, R.d, 2.2, 55); return 'h ' + R.h.toFixed(1);`],
  ['escudo', 'Escudo Refletor: a bolha dourada', `
    F.limpa(); const j = F.poe(F.j, 30, 0, 18); F.dispara(j, 'escudo'); F.anda(30); const s = F.sDe(j); F.olha(s - 8, 4.5, 2.4, s, 0, 0.9, 50); return '';`],
  ['escudo_bloqueia', 'o escudo bloqueia o raio de gelo e devolve: quem mandou congela', `
    const j = F.j; F.planos.get(j).v = 18; const R = F.poe(F.rivais[0], F.sDe(j) - 22, 0, 18); F.anda(4); F.dispara(R, 'congelante');
    for (let k = 0; k < 60 && !(R.efeitos.gelo > 0); k++) F.anda(1); F.anda(5); const s = F.sDe(R); F.olha(s - 9, -6, 3, s + 10, 0, 0.8, 58); return 'rival gelo ' + R.efeitos.gelo.toFixed(2);`],
  ['terremoto_carga', 'Terremoto carregando: o chao treme (aviso) e levanta poeira', `
    F.limpa(); const j = F.poe(F.j, 40, 0, 15); F.poe(F.rivais[0], 55, 3.5, 15); F.poe(F.rivais[1], 66, -3, 15); F.dispara(j, 'terremoto'); F.anda(36); return '';`],
  ['terremoto_onda', 'o tremor: a onda de choque e o tranco — quem esta no chao rodopia (31/10/2026) e escorrega', `F.anda(20); return 'rodopio ' + F.rivais[0].efeitos.rodopio.toFixed(2) + ', aderencia ' + F.rivais[0].mod.aderencia;`],
];

async function main() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const srv = await servidor();
  const pw = require('playwright');
  const nav = await pw.chromium.launch({ args: argsDoNavegador(false) });
  const ctx = MOBILE ? await novoContexto(nav, pw, MOBILE, false) : await nav.newContext({ viewport: { width: 1280, height: 720 } });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pg.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  await pg.goto(`http://localhost:${PORTA}/index.html?pista=${PISTA}&carro=vulcao&semente=1&mudo=1&qualidade=${MOBILE ? 'media' : 'alta'}`);
  await pg.waitForFunction(() => window.G && window.G.corrida && window.G.corrida.estado === 'contagem', null, { timeout: 120000 });
  const info = await pg.evaluate(async (roteiro) => {
    window.__pronto = false;
    const FISICA = (await import('/config/fisica.js')).FISICA;
    window.__MARCA = (await import('/js/pista.js')).MARCA;
    window.__THREE = await import('/lib/three.module.js');
    (0, eval)(roteiro);
    const G = window.G;
    while (G.corrida.estado !== 'correndo') G.passo(1 / 60);
    for (let k = 0; k < 90; k++) G.passo(1 / 60);   // o "VAI!" sai da tela
    G.entrada.mostraControles(true);
    return window.__F.init(FISICA);
  }, ROTEIRO);
  console.log(PISTA + ': ' + info);
  for (const [nome, legenda, js] of CENAS) {
    if (SO && !nome.includes(SO)) continue;
    const r = await pg.evaluate(`(() => { const F = window.__F; ${js} })()`);
    const arq = path.join(SAIDA, `${nome}${MOBILE ? '_' + MOBILE : ''}.png`);
    await pg.screenshot({ path: arq, timeout: 180000 });
    console.log(`${nome}: ${legenda}${r ? ' [' + r + ']' : ''} -> ${path.relative(RAIZ, arq)}`);
  }
  console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.slice(0, 10).join('\n') : 'console limpo');
  await nav.close();
  if (srv) srv.kill();
}

main().catch((e) => { console.error(e); process.exit(1); });
