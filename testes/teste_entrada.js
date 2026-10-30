// SUITE DA ENTRADA (fase 2): os controles de toque de js/entrada.js no DOM de verdade, com PointerEvents sinteticos (um pointerId por
// dedo), mais a inclinacao (DeviceOrientationEvent), o teclado, o modo `simulada` do harness, `aplicaNoCarro` e a largada turbo.
// Rode tambem com `--mobile pixel` / `--mobile iphone` (tela de toque de verdade na emulacao: os controles aparecem sozinhos). No desktop a
// suite liga `entrada.toque` na mao — sem tela de toque os botoes nao aparecem, de proposito.
//
// O que prova: botao vira estado e afunda; MULTITOQUE (direcao + turbo juntos, soltar um nao solta o outro); `apertou` e borda; FREIO e
// freio + derrapagem (a fisica decide); as TRAVAS ANTI-DEDO-PRESO do Breno (blur, touchend sem dedos, pointercancel, vigia do elemento que
// sumiu); joystick de base fixa so no X com zona morta; inclinacao com a conta da gravidade em qualquer angulo de tela; aceleracao
// automatica liga/desliga o botao ACELERA; configura grava em G.save('opcoes') sem apagar o resto; teclado; esqueceTudo; simulada.
import { suite, ok, perto, mede, quadros, segura, solta, apagaProgresso, corridaDeTeste, largada, entradaDeVolta } from './harness.js';
import { Entrada } from '../js/entrada.js';
import { FISICA } from '../config/fisica.js';
import { on } from '../js/eventos.js';

const $ = (id) => document.getElementById(id);
const visivel = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
const centro = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
/** Um evento de dedo. `pointerup` chega no proprio elemento e sobe ate a janela (onde a entrada tambem ouve, em captura). */
function dedo(el, tipo, id, x, y) {
  const c = centro(el);
  el.dispatchEvent(new PointerEvent(tipo, {
    pointerId: id, bubbles: true, cancelable: true, composed: true, pointerType: 'touch', isPrimary: id === 1,
    clientX: x === undefined ? c.x : x, clientY: y === undefined ? c.y : y, buttons: tipo === 'pointerup' || tipo === 'pointercancel' ? 0 : 1,
    width: 20, height: 20, pressure: tipo === 'pointerup' ? 0 : 0.5,
  }));
}
const tecla = (tipo, code) => window.dispatchEvent(new KeyboardEvent(tipo, { code, key: code, bubbles: true, cancelable: true }));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
/** O vigia da entrada roda a cada 250 ms (VIGIA_MS de js/entrada.js): espera um pouco mais que dois giros. */
const VIGIA_MS_SUITE = 600;
/** Dois botoes REDONDOS se tocam? (no arco da direita os quadrados se cruzam no canto, os circulos nao) */
function cruza(a, b) {
  const ra = Math.min(a.width, a.height) / 2, rb = Math.min(b.width, b.height) / 2;
  return Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2) < ra + rb;
}

/** beta/gama (W3C) de um aparelho com a tela no angulo `a` (0/90/180/270), inclinada para tras `tau` graus (0 = de pe na frente do rosto)
 *  e girada `teta` graus como um volante (+ = para a direita). E a conta ao contrario da de js/entrada.js (giroDaInclinacao). */
function orientacao(a, tau, teta) {
  const R = Math.PI / 180, A = a * R, T = tau * R, Q = teta * R;
  // gravidade no referencial da TELA (x direita, y cima, z para fora) e depois no do aparelho
  const sx = Math.cos(T) * Math.sin(Q), sy = -Math.cos(T) * Math.cos(Q), sz = -Math.sin(T);
  const gx = sx * Math.cos(A) + sy * Math.sin(A), gy = -sx * Math.sin(A) + sy * Math.cos(A), gz = sz;
  // g = (sen gama cos beta, -sen beta, -cos gama cos beta)
  const beta = Math.asin(Math.max(-1, Math.min(1, -gy))) / R, gama = Math.atan2(gx, -gz) / R;
  return { beta, gama };
}

suite('entrada', async (G) => {
  apagaProgresso();
  const e = G.entrada;
  entradaDeVolta();
  mede('aparelho de toque detectado', e.toque ? 'sim' : 'nao');
  const tinhaToque = e.toque;
  e.toque = true; // desktop: liga na mao (com --mobile ja vem ligado)

  // ------------------------------------------------------------------ DOM
  const ids = ['tc-controles', 'btn-esq', 'btn-dir', 'btn-turbo', 'btn-poder', 'btn-freio', 'btn-acel', 'btn-pausa', 'stick', 'stick-base', 'stick-knob', 'incl'];
  ok(ids.every((id) => !!$(id)), 'controles de toque montados em #controles (ids estaveis para a fase 6)');
  ok($('tc-controles').parentElement === $('controles'), 'dentro do #controles do index.html');
  ok(!!$('btn-turbo').querySelector(':scope > .deco') && !!$('btn-poder').querySelector(':scope > .deco'), '#btn-turbo e #btn-poder tem o filho .deco (decoracao da fase 6)');
  ok(!!document.getElementById('tc-estilo-controles'), 'CSS dos controles injetado num <style> proprio');
  ok(getComputedStyle($('btn-turbo')).touchAction === 'none' && getComputedStyle($('stick')).touchAction === 'none', 'touch-action: none (sem zoom nem rolagem no toque)');
  const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  $('btn-turbo').dispatchEvent(menu);
  ok(menu.defaultPrevented, 'sem menu de contexto no toque longo');
  ok(/safe-area-inset/.test(document.getElementById('tc-estilo-controles').textContent), 'posicoes respeitam a safe-area (entalhe do iPhone)');

  // ------------------------------------------------------------------ modo botoes, aceleracao automatica
  e.configura({ modo: 'botoes', acelAuto: true });
  e.mostraControles(false);
  ok(!visivel($('btn-dir')), 'mostraControles(false) esconde');
  e.mostraControles(true);
  ok(visivel($('btn-esq')) && visivel($('btn-dir')) && visivel($('btn-turbo')) && visivel($('btn-poder')) && visivel($('btn-freio')), 'modo botoes: setas, TURBO, PODER e FREIO na tela');
  ok(!visivel($('stick')) && !visivel($('btn-acel')), 'sem joystick e sem ACELERA (aceleracao automatica)');
  quadros(1);
  ok(e.estado.acel === 1, 'aceleracao automatica: acel = 1 sem tocar em nada');
  const bt = $('btn-turbo').getBoundingClientRect(), bp = $('btn-poder').getBoundingClientRect(), bf = $('btn-freio').getBoundingClientRect();
  ok(!cruza(bt, bp) && !cruza(bt, bf) && !cruza(bp, bf), 'botoes da direita nao se sobrepoem');
  mede('tamanho do TURBO (px)', bt.width);
  ok(bt.width >= 80 && $('btn-dir').getBoundingClientRect().width >= 80, 'areas de toque generosas (>= 80 px)');

  // ------------------------------------------------------------------ toque, multitoque, borda
  const dir = $('btn-dir'), esq = $('btn-esq'), turbo = $('btn-turbo'), poder = $('btn-poder'), freio = $('btn-freio');
  dedo(dir, 'pointerdown', 1); quadros(1);
  ok(e.estado.direcao === 1, 'tocar em ▶ = direcao +1');
  ok(dir.classList.contains('down'), 'o botao afunda (classe down, como o .big do Breno)');
  dedo(turbo, 'pointerdown', 2); quadros(1);
  ok(e.estado.direcao === 1 && e.estado.turbo === 1, 'MULTITOQUE: segurando ▶ e apertando TURBO, os dois valem');
  dedo(dir, 'pointerup', 1); quadros(1);
  ok(e.estado.direcao === 0 && e.estado.turbo === 1 && !dir.classList.contains('down'), 'soltar um dedo nao solta o outro');
  dedo(turbo, 'pointerup', 2); quadros(1);
  ok(e.estado.turbo === 0, 'soltou o TURBO');
  dedo(esq, 'pointerdown', 3); quadros(1);
  ok(e.estado.direcao === -1, 'tocar em ◀ = direcao -1');
  dedo(dir, 'pointerdown', 4); quadros(1);
  ok(e.estado.direcao === 0, '◀ e ▶ juntos se anulam');
  dedo(esq, 'pointerup', 3); dedo(dir, 'pointerup', 4); quadros(1);
  dedo(poder, 'pointerdown', 5); quadros(1);
  const a1 = e.apertou('poder'); quadros(1); const a2 = e.apertou('poder');
  dedo(poder, 'pointerup', 5); quadros(1);
  ok(a1 && !a2 && !e.apertou('poder'), 'apertou(poder) e verdadeiro SO no passo em que o dedo desceu');
  // TOQUE RAPIDO entre dois passos (celular engasgado: pointerdown e pointerup chegam juntos antes do proximo passo) — vale um passo
  for (const [el, acao, id] of [[turbo, 'turbo', 12], [poder, 'poder', 13]]) {
    dedo(el, 'pointerdown', id); dedo(el, 'pointerup', id);   // nenhum passo no meio
    quadros(1); const viu = e.estado[acao] === 1 && e.apertou(acao);
    quadros(1); const depois = e.estado[acao];
    ok(viu && depois === 0, `toque rápido no ${acao.toUpperCase()} (desce e sobe antes do passo) vale UM passo apertado`);
  }
  tecla('keydown', 'Space'); tecla('keyup', 'Space'); quadros(1);
  const tecRapida = e.apertou('turbo'); quadros(1);
  ok(tecRapida && e.estado.turbo === 0, 'espaço rápido (desce e sobe antes do passo) também vale');
  dedo(freio, 'pointerdown', 6); quadros(1);
  ok(e.estado.freio === 1 && e.estado.drift === 1, 'FREIO e um botao so para freio e derrapagem (andando e virando a fisica derrapa)');
  dedo(freio, 'pointerup', 6); quadros(1);
  ok(e.estado.freio === 0 && e.estado.drift === 0, 'soltou o FREIO');

  // ------------------------------------------------------------------ travas anti-dedo-preso (Breno)
  dedo(dir, 'pointerdown', 7); quadros(1);
  window.dispatchEvent(new Event('blur')); quadros(1);
  ok(e.estado.direcao === 0 && !dir.classList.contains('down'), 'trava: a janela perdeu o foco -> solta tudo');
  dedo(dir, 'pointerdown', 8); dedo(turbo, 'pointerdown', 9); quadros(1);
  if (typeof TouchEvent === 'function') {
    window.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [] })); quadros(1);
    ok(e.estado.direcao === 0 && e.estado.turbo === 0, 'trava: touchend sem dedos na tela -> solta tudo');
  } else { e.esqueceTudo(); ok(true, 'trava: (sem TouchEvent neste navegador)'); }
  dedo(dir, 'pointerdown', 10); quadros(1);
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 10, bubbles: true })); quadros(1);
  ok(e.estado.direcao === 0, 'trava: pointercancel ouvido na janela toda solta aquele dedo');
  dedo(dir, 'pointerdown', 11); quadros(1);
  $('tc-controles').classList.add('tc-oculto');
  await espera(VIGIA_MS_SUITE);
  quadros(1);
  ok(e.estado.direcao === 0, 'trava: o vigia solta o dedo de um botao que sumiu da tela');
  e.mostraControles(true);

  // ------------------------------------------------------------------ ARRASTAR (o modo 'joystick', padrao): trilho de base fixa, so o X
  e.configura({ modo: 'joystick' });
  ok(visivel($('stick')) && !visivel($('btn-dir')), 'modo arrastar: o trilho com o botão no lugar das setas');
  const base = centro($('stick-base')), raio = e.raioDoArrasto();
  const rTrilho = $('stick-base').getBoundingClientRect(), rBotao = $('stick-knob').getBoundingClientRect();
  perto(raio, (rTrilho.width - rBotao.width) / 2, 1, `curso do botão = (trilho - botão) / 2 = ${raio.toFixed(0)} px: a ponta do trilho é a direção toda`);
  dedo($('stick'), 'pointerdown', 20, base.x + raio + 10, base.y); quadros(1);
  ok(e.estado.direcao > 0.98 && $('stick-base').dataset.lado === 'dir', `arrastar até a ponta do trilho = direção toda, e o ▶ acende (${e.estado.direcao.toFixed(2)})`);
  dedo($('stick'), 'pointermove', 20, base.x + raio * 0.5, base.y + 40); quadros(1);
  const meio = e.estado.direcao;
  dedo($('stick'), 'pointermove', 20, base.x + raio * 0.25, base.y); quadros(1);
  const quarto = e.estado.direcao;
  ok(quarto > 0 && meio > quarto && meio < 0.7, `PROGRESSIVO: ¼ do curso vira ${quarto.toFixed(2)}, ½ vira ${meio.toFixed(2)} (e só o X conta)`);
  dedo($('stick'), 'pointermove', 20, base.x + 4, base.y); quadros(1);
  ok(e.estado.direcao === 0 && !$('stick-base').dataset.lado, 'arrastar: zona morta no meio');
  dedo(turbo, 'pointerdown', 21); dedo($('stick'), 'pointermove', 20, base.x - raio - 20, base.y); quadros(1);
  ok(e.estado.direcao < -0.98 && e.estado.turbo === 1 && $('stick-base').dataset.lado === 'esq', 'arrastar para a esquerda + TURBO ao mesmo tempo');
  dedo($('stick'), 'pointerup', 20); dedo(turbo, 'pointerup', 21); quadros(1);
  ok(e.estado.direcao === 0 && /translate\(-50%, -50%\)/.test($('stick-knob').style.transform) && !$('stick-base').dataset.lado, 'soltou: direção zero no mesmo passo e o botão volta ao meio');
  ok(parseFloat(getComputedStyle($('stick-knob')).transitionDuration) > 0, 'a volta ao meio é com mola (transição), não um pulo');
  // a base nao segue o dedo: tocar longe dela (canto da area) ainda mede a partir do centro da base
  const area = $('stick').getBoundingClientRect();
  dedo($('stick'), 'pointerdown', 22, area.left + 5, area.bottom - 5); quadros(1);
  ok(e.estado.direcao < -0.5, 'base FIXA: o dedo em qualquer ponto da area vale pela distancia ao centro da base');
  dedo($('stick'), 'pointerup', 22); quadros(1);

  // ------------------------------------------------------------------ inclinacao
  let pior = 0;
  for (const a of [0, 90, 180, 270]) for (const tau of [15, 45, 70]) for (const teta of [-18, -6, 0, 9, 18]) {
    const o = orientacao(a, tau, teta);
    pior = Math.max(pior, Math.abs(Entrada.giroDaInclinacao(o.beta, o.gama, a) - teta));
  }
  ok(pior < 0.01, `conta da inclinacao: giro de volante certo em todos os angulos de tela e inclinacoes (erro ${pior.toFixed(4)} graus)`);
  const o180 = orientacao(90, 40, 12);
  perto(Entrada.giroDaInclinacao(o180.beta, o180.gama, 270), 12, 0.01, 'angulo de tela trocado de 180 graus (navegador divergente) se conserta sozinho');
  e.configura({ modo: 'inclinacao' });
  ok(visivel($('incl')), 'modo inclinacao: indicador da inclinacao na tela');
  const ang = e._anguloDaTela();
  mede('angulo da tela', ang);
  const inclina = (teta) => { const o = orientacao(ang, 40, teta); window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: o.beta, gamma: o.gama, absolute: false })); };
  inclina(14); quadros(40);
  perto(e.estado.direcao, (14 - 2.5) / (22 - 2.5), 0.03, 'inclinar 14 graus para a direita = direcao ~0,59');
  inclina(-30); quadros(40);
  perto(e.estado.direcao, -1, 0.01, 'inclinar muito para a esquerda = direcao toda');
  inclina(1.5); quadros(40);
  ok(Math.abs(e.estado.direcao) < 0.02, 'inclinacao: zona morta perto do zero');
  inclina(10); dedo(turbo, 'pointerdown', 30); quadros(30);
  ok(e.estado.direcao > 0.3 && e.estado.turbo === 1, 'inclinacao + TURBO ao mesmo tempo');
  dedo(turbo, 'pointerup', 30); inclina(0); quadros(30);
  // sem sensor (permissao negada; no artefato do Claude o iframe bloqueia): a reserva e o ARRASTAR, nao as setas
  const permissaoAntes = e._permissao;
  e._permissao = 'negada'; e._atualizaDom();
  ok(visivel($('stick')) && !visivel($('btn-dir')) && /arraste/.test($('incl-texto').textContent), 'inclinação sem sensor: o botão de ARRASTAR aparece de reserva (e o texto diz para arrastar)');
  e._permissao = permissaoAntes; e._atualizaDom();

  // ------------------------------------------------------------------ aceleracao manual e opcoes gravadas
  G.save.grava('opcoes', { volumeGeral: 0.7 });
  e.configura({ modo: 'botoes', acelAuto: false });
  ok(visivel($('btn-acel')), 'aceleracao automatica desligada: aparece o botao ACELERA');
  const ba = $('btn-acel').getBoundingClientRect(), bt2 = $('btn-turbo').getBoundingClientRect(), bp2 = $('btn-poder').getBoundingClientRect(), bf2 = $('btn-freio').getBoundingClientRect();
  ok(![[ba, bt2], [ba, bp2], [ba, bf2], [bt2, bp2], [bt2, bf2], [bp2, bf2]].some(([x, y]) => cruza(x, y)), 'com o ACELERA, os quatro botoes da direita nao se sobrepoem');
  quadros(1);
  ok(e.estado.acel === 0, 'sem tocar no ACELERA, acel = 0');
  dedo($('btn-acel'), 'pointerdown', 31); quadros(1);
  ok(e.estado.acel === 1, 'tocando no ACELERA, acel = 1');
  dedo($('btn-acel'), 'pointerup', 31); quadros(1);
  const op = G.save.le('opcoes', {});
  ok(op.controle === 'botoes' && op.acelAuto === false && op.volumeGeral === 0.7, 'configura grava { controle, acelAuto } em G.save(opcoes) sem apagar o resto');
  const outra = new Entrada({ ...G, save: G.save, relogio: G.relogio });
  ok(outra.modo === 'botoes' && outra.acelAuto === false, 'uma entrada nova le a configuracao gravada');
  outra.el && outra.el.remove(); clearInterval(outra._vigia);
  // ARRASTAR e o padrao (30/10/2026); 'botoes' gravado ANTES disso (de carona com o "acelerar sozinho") passa para ele uma vez
  const modoDe = (op) => { G.save.grava('opcoes', op); const x = new Entrada({ ...G, save: G.save, relogio: G.relogio }); const m = x.modo; x.el && x.el.remove(); clearInterval(x._vigia); return m; };
  ok(modoDe({}) === 'joystick', 'padrão: o botão de ARRASTAR no lugar das setas');
  ok(modoDe({ controle: 'botoes', acelAuto: true }) === 'joystick', "'botoes' gravado antes do arrastar virar padrão passa para o arrastar");
  ok(modoDe({ controle: 'botoes', acelAuto: false, arrastarPadrao: true }) === 'botoes', 'Setas escolhidas nas opções depois disso continuam');
  ok(modoDe({ controle: 'inclinacao' }) === 'inclinacao', 'inclinação gravada continua');
  G.save.grava('opcoes', { controle: 'botoes', acelAuto: false, arrastarPadrao: true, volumeGeral: 0.7 });
  e.configura({ acelAuto: true });

  // ------------------------------------------------------------------ teclado, esqueceTudo, simulada
  tecla('keydown', 'ArrowLeft'); tecla('keydown', 'Space'); quadros(1);
  ok(e.estado.direcao === -1 && e.estado.turbo === 1, 'teclado: seta esquerda + espaco (turbo)');
  tecla('keyup', 'ArrowLeft'); tecla('keyup', 'Space'); tecla('keydown', 'KeyD'); tecla('keydown', 'KeyE'); tecla('keydown', 'ControlLeft'); tecla('keydown', 'KeyS'); quadros(1);
  ok(e.estado.direcao === 1 && e.estado.poder === 1 && e.estado.drift === 1 && e.estado.freio === 1, 'teclado: D, E (poder), Ctrl (derrapagem), S (freio)');
  e.esqueceTudo(); quadros(1);
  ok(e.estado.direcao === 0 && e.estado.poder === 0 && e.estado.freio === 0 && e.estado.drift === 0, 'esqueceTudo: nenhuma tecla presa (o keyup do Alt+Tab nunca chega)');
  tecla('keyup', 'KeyD'); tecla('keyup', 'KeyE'); tecla('keyup', 'ControlLeft'); tecla('keyup', 'KeyS');
  tecla('keydown', 'Escape'); quadros(1);
  ok(e.estado.pausa === 1 && e.apertou('pausa'), 'Esc = pausa (as telas da fase 6 leem apertou(pausa))');
  tecla('keyup', 'Escape'); quadros(1);
  segura('direcao', 0.5); quadros(3);
  ok(e.simulada && e.estado.direcao === 0.5, 'simulada: o harness escreve o estado e ninguem le dispositivo');
  entradaDeVolta();

  // ------------------------------------------------------------------ aplicaNoCarro e largada turbo
  let c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 3 });
  largada();
  const j = c.jogador;
  segura('direcao', -0.7); segura('freio', 1); segura('turbo', 1); segura('drift', 1);
  quadros(1);
  ok(j.controle.direcao === -0.7 && j.controle.freio === 1 && j.controle.turbo === true && j.controle.drift === true, 'aplicaNoCarro copia direcao, freio, turbo e derrapagem');
  segura('poder', 1); quadros(1); const p1 = j.controle.poder; quadros(1); const p2 = j.controle.poder;
  ok(p1 === true && p2 === false, 'aplicaNoCarro: controle.poder so no passo do toque');
  for (const a of ['direcao', 'freio', 'turbo', 'drift', 'poder']) solta(a);
  // TURBO DE UM TOQUE (pedido do Morassi, 30/10/2026): o toque acende e o controle segue ligado sem o dedo ate a barra acabar
  quadros(5);
  ok(j.controle.turbo === true && j.turbo.ativo, 'TURBO de um toque: soltou o botão e o turbo continua aceso');
  let passosAceso = 0;
  for (let k = 0; k < 60 * 8 && j.turbo.ativo; k++) { quadros(1); passosAceso++; }
  quadros(1);   // o aplicaNoCarro do passo seguinte e que ve o turbo apagado e solta o controle
  ok(!j.turbo.ativo && j.turbo.carga === 0 && j.controle.turbo === false, `... até a barra acabar (${(passosAceso / 60).toFixed(1)} s depois), e aí desliga (carga ${j.turbo.carga.toFixed(2)}, controle ${j.controle.turbo})`);
  j.turbo.carga = 1; quadros(3);
  ok(!j.turbo.ativo && j.controle.turbo === false, 'capsula depois de apagado: não reacende sozinho (precisa de outro toque)');
  entradaDeVolta();
  // largada turbo: TURBO bem no VAI empurra; cedo demais, nao
  const corre = async (antesDoVai) => {
    c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 3 });
    entradaDeVolta(); e.toque = true; e.mostraControles(true);
    let deu = 0;
    const desliga = on('carro:largada_turbo', (x) => { if (x.carro === c.jogador) deu++; });
    let tocou = false;
    for (let k = 0; k < 600 && c.estado !== 'correndo'; k++) {
      const faltam = c.contagem - c.tContagem;
      if (!tocou && faltam <= antesDoVai) { dedo(turbo, 'pointerdown', 40); tocou = true; }
      quadros(1);
      if (tocou && faltam < antesDoVai - 0.05) dedo(turbo, 'pointerup', 40);
    }
    dedo(turbo, 'pointerup', 40);
    quadros(2);
    desliga();
    return { deu, vf: c.jogador.vf };
  };
  const boa = await corre(0.2), cedo = await corre(1.5);
  ok(boa.deu === 1 && boa.vf > FISICA.LARGADA_TURBO * 0.8, `largada turbo: TURBO bem no VAI da um empurrao (${boa.vf.toFixed(1)} m/s no primeiro passo)`);
  ok(cedo.deu === 0, 'largada turbo: apertar cedo demais nao vale');
  e.toque = tinhaToque;
  e.mostraControles(false);
  G.jogo.encerraCorrida();
});
