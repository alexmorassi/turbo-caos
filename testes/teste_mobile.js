// SUITE DO CELULAR (fase 7). Feita para rodar com `--mobile pixel` e `--mobile iphone` (no desktop roda igual e so mede): a corrida
// aberta pelas telas em paisagem tem os controles de toque GRANDES, dentro da tela e sem se encostar; o HUD nao cobre os botoes;
// tocar nos botoes (Pointer Events, como o dedo) liga turbo/poder; e o FPS e medido com o laco de verdade (requestAnimationFrame
// simulando e desenhando como no celular), em cada nivel de qualidade.
// FPS AQUI E SWIFTSHADER (renderizacao por software, sem placa): o numero serve para comparar niveis e pegar regressao grande; os
// 60 fps de verdade sao do celular (docs/PENDENCIAS.md). Por isso a assercao e so de piso.
import { suite, ok, mede, simulaAte, apagaProgresso, quadros } from './harness.js';

/** Piso de fps no SwiftShader (800x450 ou tela emulada): abaixo disso algo explodiu (ex.: cenario inteiro sem culling). */
const PISO_FPS_SOFTWARE = 3;
/** Lado minimo (px CSS) dos botoes TURBO e PODER: a Apple pede 44 px para alvo de toque; crianca precisa de bem mais. */
const LADO_MINIMO = 64;

function caixa(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const vis = getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && r.width > 0; return vis ? r : null; }
function encosta(a, b) { return a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); }
/** Folga entre dois botoes REDONDOS (px): distancia entre os centros menos os dois raios. Os botoes da fase 2 ficam em diagonal, entao
 *  as caixas se cruzam no canto sem os circulos se tocarem. */
function folgaRedonda(a, b) { const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2; return Math.hypot(ax - bx, ay - by) - a.width / 2 - b.width / 2; }
/** Folga minima entre botoes (px): dedo de crianca escorrega; menos que isso o TURBO vira PODER sem querer. */
const FOLGA_MINIMA = 10;
function toque(el, tipo, id = 7) {
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
}

/** Mede fps reais por `ms` com o laco do main.js simulando e desenhando (desliga o modo de teste so durante a medida). */
async function medeFps(G, ms) {
  let n = 0; const orig = G.quadro;
  G.quadro = (dt) => { n++; orig(dt); };
  const teste = G.flags.teste; G.flags.teste = null;
  await new Promise((r) => setTimeout(r, ms));
  G.flags.teste = teste; G.quadro = orig;
  return (n * 1000) / ms;
}

suite('mobile', async (G) => {
  apagaProgresso();
  const W = window.innerWidth, H = window.innerHeight;
  mede('tela (px CSS)', `${W}x${H} @${window.devicePixelRatio}`);
  ok(W > H, 'paisagem (o jogo é jogado deitado)');
  // a entrada leu as opcoes no boot, ANTES do apagaProgresso (e as suites dividem o localStorage): volta ao padrao do jogo
  G.entrada.configura({ modo: 'botoes', acelAuto: false });
  G.flags.auto = true;
  const c = await G.telas.mostra('corrida_direta', { pista: 'orla', carro: 'vulcao' });
  ok(!!c, 'corrida aberta pelas telas');
  quadros(30); G.quadro(G.PASSO);

  // --- controles grandes, dentro da tela, sem encostar (so em aparelho de toque: no desktop os botoes ficam escondidos de proposito)
  const deToque = (() => { try { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; } catch (e) { return false; } })();
  mede('aparelho de toque', deToque ? 'sim' : 'nao (desktop: so mede o fps)');
  const t = deToque ? caixa('#btn-turbo') : null, p = deToque ? caixa('#btn-poder') : null, f = deToque ? caixa('#btn-freio') : null;
  const a = deToque ? caixa('#btn-acel') : null;
  if (deToque) ok(t && p && f && a, 'ACELERADOR, FREIO, TURBO e PODER visíveis na corrida (padrão: pedais na tela)');
  /** Confere o grupo inteiro: tamanho, dentro da tela, sem encostar (pedal = retangulo, TURBO/PODER = circulo). `sufixo` = cenario. */
  const confere = (sufixo) => {
    const t = caixa('#btn-turbo'), p = caixa('#btn-poder'), f = caixa('#btn-freio'), a = caixa('#btn-acel');
    const esq = caixa('#btn-esq') || caixa('#stick-base') || caixa('#stick'), dir = caixa('#btn-dir');
    if (!(t && p && f && a && esq)) { ok(false, `${sufixo}: todos os controles visíveis`); return; }
    ok(Math.min(t.width, p.width) >= LADO_MINIMO, `${sufixo}: TURBO ${t.width.toFixed(0)} px e PODER ${p.width.toFixed(0)} px (mínimo ${LADO_MINIMO})`);
    ok(a.width >= 56 && a.height >= 100 && f.height >= 80, `${sufixo}: pedais grandes (acelerador ${a.width.toFixed(0)}x${a.height.toFixed(0)}, freio ${f.width.toFixed(0)}x${f.height.toFixed(0)})`);
    const dentro = (r) => r.left >= 0 && r.top >= 0 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
    ok([t, p, f, a, esq].every(dentro), `${sufixo}: controles inteiros dentro da tela`);
    const folgaRet = (x, y) => Math.max(y.left - x.right, x.left - y.right, y.top - x.bottom, x.top - y.bottom);
    const folga = Math.min(folgaRedonda(t, p), folgaRet(t, f), folgaRet(p, f), folgaRet(f, a), folgaRet(t, a), folgaRet(p, a));
    mede(`${sufixo}: menor folga entre botões (px)`, folga);
    ok(folga >= FOLGA_MINIMA, `${sufixo}: botões da direita não se encostam (folga ${folga.toFixed(0)} px >= ${FOLGA_MINIMA})`);
    const vao = Math.min(t.left, p.left) - Math.max(esq.right, dir ? dir.right : esq.right);
    mede(`${sufixo}: vão entre as setas e os botões (px)`, vao);
    ok(vao >= 24, `${sufixo}: setas à esquerda e botões à direita com vão para ver o carro (${vao.toFixed(0)} px)`);
    const mapa = caixa('#hud canvas');
    if (mapa) ok(![t, p, f, a].some((r) => encosta(mapa, r)), `${sufixo}: minimapa não cobre os botões`);
  };
  if (deToque) {
    confere('pedais');
    // iPhone de verdade deitado: o entalhe come ~47 px de cada lado (a emulacao do Playwright nao tem safe-area); simula pelas variaveis
    const ctl = document.querySelector('#controles .tc-ctl');
    ctl.style.setProperty('--sal', '47px'); ctl.style.setProperty('--sar', '47px'); ctl.style.setProperty('--sab', '21px');
    confere('com entalhe');
    ctl.style.removeProperty('--sal'); ctl.style.removeProperty('--sar'); ctl.style.removeProperty('--sab');
    // aceleracao automatica (opcao): o acelerador some e o resto continua inteiro
    G.entrada.configura({ acelAuto: true });
    const t2 = caixa('#btn-turbo'), p2 = caixa('#btn-poder'), f2 = caixa('#btn-freio');
    ok(!caixa('#btn-acel') && t2 && p2 && f2, 'acelerar sozinho: some o ACELERADOR, ficam FREIO, TURBO e PODER');
    G.entrada.configura({ acelAuto: false });
  }

  // --- toque de verdade (Pointer Events) liga as acoes
  G.flags.auto = false;
  const bt = deToque ? document.querySelector('#btn-turbo') : null;
  if (bt) {
    toque(bt, 'pointerdown'); quadros(2);
    ok(G.entrada.estado.turbo > 0, 'tocar no TURBO liga o turbo');
    toque(bt, 'pointerup'); quadros(2);
    ok(!G.entrada.estado.turbo, 'soltar o TURBO desliga');
    const pa = document.querySelector('#btn-acel'), pf = document.querySelector('#btn-freio');
    toque(pa, 'pointerdown', 8); quadros(2);
    ok(G.entrada.estado.acel === 1, 'pisar no ACELERADOR acelera');
    toque(pf, 'pointerdown', 9); quadros(2);
    ok(G.entrada.estado.freio > 0, 'pisar no FREIO junto (dois dedos) freia');
    toque(pf, 'pointerup', 9); toque(pa, 'pointerup', 8); quadros(2);
    ok(!G.entrada.estado.acel && !G.entrada.estado.freio, 'soltar os pedais solta acelerador e freio');
  }
  G.flags.auto = true;

  // --- fps com o laco de verdade, por nivel
  simulaAte(() => c.estado === 'correndo', 10);
  const fps = {};
  for (const nivel of ['baixa', 'media', 'alta']) {
    G.qualidade.define(nivel, false);
    await medeFps(G, 400); // descarta: o primeiro desenho do nivel compila programas
    fps[nivel] = await medeFps(G, 2500);
    mede(`fps ${nivel} (SwiftShader)`, fps[nivel]);
  }
  // o piso vale para a BAIXA, que e para onde o AUTO leva o celular fraco; MEDIA e ALTA no software dependem so da resolucao
  ok(fps.baixa >= PISO_FPS_SOFTWARE, `fps na baixa acima do piso de software (${fps.baixa.toFixed(1)})`);
  ok(fps.baixa >= fps.alta * 0.95, `a BAIXA custa menos que a ALTA (${fps.baixa.toFixed(1)} contra ${fps.alta.toFixed(1)} fps)`);
  const info = G.renderer.info.render;
  mede('chamadas de desenho por quadro (alta)', info.calls);
  mede('triângulos por quadro (alta)', info.triangles);
  G.qualidade.define('auto', false);
  G.telas.mostra('menu');
  G.flags.auto = false;
});
