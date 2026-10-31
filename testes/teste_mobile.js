// SUITE DO CELULAR (fase 7). Feita para rodar com `--mobile pixel` e `--mobile iphone` (no desktop roda igual e so mede): a corrida
// aberta pelas telas em paisagem tem os controles de toque GRANDES, dentro da tela e sem se encostar; o HUD nao cobre os botoes;
// tocar nos botoes (Pointer Events, como o dedo) liga turbo/poder; e o FPS e medido com o laco de verdade (requestAnimationFrame
// simulando e desenhando como no celular), em cada nivel de qualidade.
// FPS AQUI E SWIFTSHADER (renderizacao por software, sem placa): o numero serve para comparar niveis e pegar regressao grande; os
// 60 fps de verdade sao do celular (docs/PENDENCIAS.md). Por isso a assercao e so de piso.
import { suite, ok, mede, simulaAte, apagaProgresso, quadros } from './harness.js';
import { on } from '../js/eventos.js';

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
/** O que o DEDO acerta no centro do elemento: o navegador entrega o toque ao elemento de cima naquele ponto (elementFromPoint), nao
 *  ao botao que a gente quer. Disparar o evento direto no botao (como esta suite fazia ate 30/10/2026) passava com a camada
 *  transparente da tela de corrida engolindo todos os toques — os botoes "funcionavam" no teste e nao no celular. */
function alvoDoDedo(el) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  return { x, y, alvo: document.elementFromPoint(x, y) };
}
function alcancavel(el) { const { alvo } = alvoDoDedo(el); return !!alvo && el.contains(alvo); }
function quemCobre(el) { const { alvo } = alvoDoDedo(el); return alvo ? (alvo.id || String(alvo.className && alvo.className.baseVal !== undefined ? alvo.className.baseVal : alvo.className) || alvo.tagName) : 'nada'; }
/** Toque no ponto do dedo (vai para quem estiver POR CIMA, como no aparelho). */
function toque(el, tipo, id = 7) {
  const { x, y, alvo } = alvoDoDedo(el);
  (alvo || el).dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
}
/** O dedo num ponto qualquer da tela (o arrasto do botao de virar). */
function dedoEm(x, y, tipo, id) {
  const alvo = document.elementFromPoint(x, y);
  if (alvo) alvo.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
  return alvo;
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
  // a entrada leu as opcoes no boot, ANTES do apagaProgresso (e as suites dividem o localStorage): volta ao padrao do jogo — ARRASTAR para
  // virar (o modo 'joystick', padrao desde 30/10/2026) e os pedais
  G.entrada.configura({ modo: 'joystick', acelAuto: false });
  G.flags.auto = true;
  const c = await G.telas.mostra('corrida_direta', { pista: 'orla', carro: 'vulcao' });
  ok(!!c, 'corrida aberta pelas telas');
  quadros(30); G.quadro(G.PASSO);

  // --- controles grandes, dentro da tela, sem encostar (so em aparelho de toque: no desktop os botoes ficam escondidos de proposito)
  const deToque = (() => { try { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; } catch (e) { return false; } })();
  mede('aparelho de toque', deToque ? 'sim' : 'nao (desktop: so mede o fps)');
  const t = deToque ? caixa('#btn-turbo') : null, p = deToque ? caixa('#btn-poder') : null;
  const a = deToque ? caixa('#btn-acel') : null;
  if (deToque) ok(t && p && a && !document.getElementById('btn-freio'), 'ACELERADOR, TURBO e PODER visíveis na corrida, e nenhum FREIO (soltar o acelerador freia)');
  /** ALCANCE (30/10/2026: "o jogador de 5 anos, de mao pequena, nao alcanca"): distancia do centro do ACELERADOR — onde o polegar
   *  descansa — ao centro do botao. Antes o TURBO ficava depois do freio, a ~190 px no Pixel; o PODER, a ~230. */
  const ALCANCE_TURBO = 150, ALCANCE_PODER = 185;
  const centroDe = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const distancia = (r1, r2) => { const c1 = centroDe(r1), c2 = centroDe(r2); return Math.hypot(c1.x - c2.x, c1.y - c2.y); };
  /** Confere o grupo inteiro: tamanho, dentro da tela, sem encostar (pedal = retangulo, TURBO/PODER = circulo). `sufixo` = cenario. */
  const confere = (sufixo) => {
    const t = caixa('#btn-turbo'), p = caixa('#btn-poder'), a = caixa('#btn-acel');
    const esq = caixa('#btn-esq') || caixa('#stick-base') || caixa('#stick'), dir = caixa('#btn-dir');
    if (!(t && p && a && esq)) { ok(false, `${sufixo}: todos os controles visíveis`); return; }
    ok(Math.min(t.width, p.width) >= LADO_MINIMO, `${sufixo}: TURBO ${t.width.toFixed(0)} px e PODER ${p.width.toFixed(0)} px (mínimo ${LADO_MINIMO})`);
    ok(a.width >= 84 && a.height >= 100, `${sufixo}: ACELERADOR largo (${a.width.toFixed(0)} x ${a.height.toFixed(0)} px; era 60-74 de largura)`);
    const aT = distancia(a, t), aP = distancia(a, p);
    mede(`${sufixo}: alcance do polegar no ACELERADOR até o TURBO / o PODER (px)`, `${aT.toFixed(0)} / ${aP.toFixed(0)}`);
    ok(aT <= ALCANCE_TURBO && aP <= ALCANCE_PODER, `${sufixo}: TURBO (${aT.toFixed(0)} px) e PODER (${aP.toFixed(0)} px) perto do polegar que está no ACELERADOR (até ${ALCANCE_TURBO} e ${ALCANCE_PODER})`);
    const dentro = (r) => r.left >= 0 && r.top >= 0 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
    ok([t, p, a, esq].every(dentro), `${sufixo}: controles inteiros dentro da tela`);
    const folgaRet = (x, y) => Math.max(y.left - x.right, x.left - y.right, y.top - x.bottom, x.top - y.bottom);
    const folga = Math.min(folgaRedonda(t, p), folgaRet(t, a), folgaRet(p, a));
    mede(`${sufixo}: menor folga entre botões (px)`, folga);
    ok(folga >= FOLGA_MINIMA, `${sufixo}: botões da direita não se encostam (folga ${folga.toFixed(0)} px >= ${FOLGA_MINIMA})`);
    const vao = Math.min(t.left, p.left) - Math.max(esq.right, dir ? dir.right : esq.right);
    mede(`${sufixo}: vão entre a direção e os botões (px)`, vao);
    ok(vao >= 24, `${sufixo}: direção à esquerda e botões à direita com vão para ver o carro (${vao.toFixed(0)} px)`);
    const mapa = caixa('#hud canvas');
    if (mapa) ok(![t, p, a].some((r) => encosta(mapa, r)), `${sufixo}: minimapa não cobre os botões`);
  };
  if (deToque) {
    const trilho = caixa('#stick-base'), botao = caixa('#stick-knob');
    ok(!!trilho && !!botao && !caixa('#btn-esq') && !caixa('#btn-dir'), 'padrão: o botão de ARRASTAR para virar no lugar das setas');
    if (trilho && botao) {
      mede('trilho do arrastar (px)', `${trilho.width.toFixed(0)} x ${trilho.height.toFixed(0)}, botão ${botao.width.toFixed(0)} px, curso ${G.entrada.raioDoArrasto().toFixed(0)} px`);
      ok(botao.width >= LADO_MINIMO && G.entrada.raioDoArrasto() >= 50, `botão de arrastar grande (${botao.width.toFixed(0)} px) e com curso para o polegar (${G.entrada.raioDoArrasto().toFixed(0)} px até a direção toda)`);
    }
    confere('pedais');
    // iPhone de verdade deitado: o entalhe come ~47 px de cada lado (a emulacao do Playwright nao tem safe-area); simula pelas variaveis
    const ctl = document.querySelector('#controles .tc-ctl');
    ctl.style.setProperty('--sal', '47px'); ctl.style.setProperty('--sar', '47px'); ctl.style.setProperty('--sab', '21px');
    confere('com entalhe');
    ctl.style.removeProperty('--sal'); ctl.style.removeProperty('--sar'); ctl.style.removeProperty('--sab');
    // aceleracao automatica (opcao): o acelerador some e o resto continua inteiro
    G.entrada.configura({ acelAuto: true });
    const t2 = caixa('#btn-turbo'), p2 = caixa('#btn-poder');
    const canto = t2 && W - t2.right < 70 && H - t2.bottom < 60;
    ok(!caixa('#btn-acel') && t2 && p2 && canto && !encosta(t2, p2), 'acelerar sozinho: some o ACELERADOR e o TURBO vai para o canto (o PODER em cima)');
    G.entrada.configura({ acelAuto: false });
    // as SETAS continuam nas opcoes: o mesmo layout tem de caber com elas
    G.entrada.configura({ modo: 'botoes' }); quadros(1);
    confere('setas (opção)');
    G.entrada.configura({ modo: 'joystick' }); quadros(1);
  }

  // --- nenhuma camada por cima dos controles: o dedo no centro de cada botao cai NELE (a tela de corrida e transparente e fica por
  // cima de tudo; com pointer-events errado ela engolia os toques e o carro nao andava, bug de 30/10/2026)
  if (deToque) {
    const telaCorrida = document.querySelector('#tela-corrida');
    ok(!!telaCorrida && !telaCorrida.hidden, 'a tela de corrida (camada do botão de pausa) está aberta por cima dos controles');
    const confere = (sufixo) => {
      for (const id of ['btn-esq', 'btn-dir', 'btn-acel', 'btn-turbo', 'btn-poder']) {
        const el = document.getElementById(id);
        if (!el || !caixa('#' + id)) continue;
        ok(alcancavel(el), `${sufixo}: o dedo no centro de ${id} acerta o botão (por cima: ${quemCobre(el)})`);
      }
      const pausa = document.querySelector('#tela-corrida .hud-pausa');
      if (pausa) ok(alcancavel(pausa), `${sufixo}: o dedo acerta o botão de PAUSA (por cima: ${quemCobre(pausa)})`);
    };
    const arrastar = () => {
      const stick = document.querySelector('#controles .tc-stick'), knob = document.getElementById('stick-knob');
      if (stick && caixa('#controles .tc-stick')) ok(alcancavel(stick) && alcancavel(knob), `arrastar: o dedo acerta o botão de arrastar e a área dele (por cima: ${quemCobre(knob)})`);
    };
    confere('pedais'); arrastar();
    G.entrada.configura({ acelAuto: true }); quadros(1);
    confere('acelerar sozinho'); arrastar();
    G.entrada.configura({ modo: 'botoes', acelAuto: false }); quadros(1);
    confere('setas (opção)');
    G.entrada.configura({ modo: 'joystick', acelAuto: false }); quadros(1);
  }

  // --- toque de verdade (Pointer Events no ponto do dedo) liga as acoes
  G.flags.auto = false;
  const bt = deToque ? document.querySelector('#btn-turbo') : null;
  if (bt) {
    toque(bt, 'pointerdown'); quadros(2);
    ok(G.entrada.estado.turbo > 0, 'tocar no TURBO liga o turbo');
    toque(bt, 'pointerup'); quadros(2);
    ok(!G.entrada.estado.turbo, 'soltar o TURBO desliga');
    const pa = document.querySelector('#btn-acel');
    toque(pa, 'pointerdown', 8); quadros(2);
    ok(G.entrada.estado.acel === 1, 'pisar no ACELERADOR acelera');
    toque(pa, 'pointerup', 8); quadros(2);
    ok(!G.entrada.estado.acel, 'soltar o ACELERADOR solta');
    // ARRASTAR com o dedo no botao: pouco vira pouco, a ponta do trilho vira tudo, soltou = zero e o botao volta ao meio
    const knob = document.getElementById('stick-knob'), kc = alvoDoDedo(knob), raio = G.entrada.raioDoArrasto();
    const pegou = dedoEm(kc.x, kc.y, 'pointerdown', 11); quadros(2);
    const parado = G.entrada.estado.direcao;
    dedoEm(kc.x + raio * 0.4, kc.y, 'pointermove', 11); quadros(2);
    const pouco = G.entrada.estado.direcao;
    dedoEm(kc.x + raio + 15, kc.y, 'pointermove', 11); quadros(2);
    const tudo = G.entrada.estado.direcao;
    dedoEm(kc.x - raio - 15, kc.y, 'pointermove', 11); quadros(2);
    const esquerda = G.entrada.estado.direcao;
    dedoEm(kc.x - raio - 15, kc.y, 'pointerup', 11); quadros(2);
    ok(!!pegou && knob.contains(pegou) && parado === 0 && pouco > 0.05 && pouco < 0.6 && tudo > 0.98 && esquerda < -0.98 && G.entrada.estado.direcao === 0,
      `arrastar o botão com o dedo: parado ${parado}, um pouco ${pouco.toFixed(2)}, a ponta ${tudo.toFixed(2)}, o outro lado ${esquerda.toFixed(2)}, soltou ${G.entrada.estado.direcao}`);
    ok(/translate\(-50%, -50%\)/.test(knob.style.transform), 'soltou: o botão de arrastar volta para o meio');
    toque(document.getElementById('btn-poder'), 'pointerdown', 10); quadros(2);
    ok(G.entrada.estado.poder === 1, `tocar em btn-poder liga poder (deu ${G.entrada.estado.poder})`);
    toque(document.getElementById('btn-poder'), 'pointerup', 10); quadros(2);
    // as setas (opcao) continuam funcionando no toque
    G.entrada.configura({ modo: 'botoes' }); quadros(1);
    for (const [id, valor] of [['btn-dir', 1], ['btn-esq', -1]]) {
      const el = document.getElementById(id);
      toque(el, 'pointerdown', 10); quadros(2);
      ok(G.entrada.estado.direcao === valor, `setas (opção): tocar em ${id} liga direcao = ${valor} (deu ${G.entrada.estado.direcao})`);
      toque(el, 'pointerup', 10); quadros(2);
    }
    G.entrada.configura({ modo: 'joystick' }); quadros(1);
  }
  G.flags.auto = true;

  // --- TURBO E PODER DE UM TOQUE com o dedo (pedido de 30/10/2026: "o jogador aperta e o turbo/poder gastam ate o fim enquanto continua
  // acelerando"). Toque RAPIDO (desce e sobe sem nenhum passo no meio, como no celular engasgado) e o dedo volta para o ACELERADOR
  simulaAte(() => c.estado === 'correndo', 10);
  if (bt) {
    G.flags.auto = false;
    const j = c.jogador, pa = document.querySelector('#btn-acel'), bp = document.querySelector('#btn-poder');
    j.turbo.carga = 0.5;
    toque(bt, 'pointerdown', 20); toque(bt, 'pointerup', 20);
    toque(pa, 'pointerdown', 21);
    let aceso = 0;
    for (let k = 0; k < 60 * 8 && (k < 3 || j.turbo.ativo); k++) { quadros(1); if (j.turbo.ativo) aceso++; }
    const acelerou = G.entrada.estado.acel === 1;
    toque(pa, 'pointerup', 21); quadros(2);
    ok(acelerou && j.turbo.carga === 0 && aceso / 60 > 0.5 * j.turbo.capacidade - 0.1,
      `um toque rápido no TURBO, com o dedo de volta no ACELERADOR, gasta a barra inteira sozinho (${(aceso / 60).toFixed(1)} s aceso)`);
    if (bp && j.poder) {
      let usou = 0;
      const desliga = on('poder:usa', (e) => { if (e.carro === j) usou++; });
      j.poder.restante = 0;
      toque(bp, 'pointerdown', 22); toque(bp, 'pointerup', 22); quadros(2);
      desliga();
      ok(usou === 1, 'um toque rápido no PODER (pronto) dispara o poder uma vez');
    }
    G.flags.auto = true;
  }

  // --- fps com o laco de verdade, por nivel
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
