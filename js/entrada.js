// A ENTRADA DO JOGADOR (fase 2): controles de TOQUE (botoes grandes, joystick ou inclinacao do celular), teclado para desenvolvimento,
// e o estado que a corrida copia para o carro do jogador. Contrato: docs/CONTRATOS.md secao 6.
//
// O PADRAO DOS CONTROLES DE TOQUE E O DO "BRENO E O TESOURO DO PIRATA MORASSI" (js/core.js initInput e os botoes .big do index.html),
// adaptado: direcao so no eixo X, botoes TURBO / PODER e o ACELERADOR (quando a aceleracao automatica esta desligada). O FREIO saiu da
// tela em 30/10/2026 (pedido do Morassi): SOLTAR O ACELERADOR FREIA (`freioAoSoltar`, FREIO_AO_SOLTAR em config/fisica.js) — o teclado
// ainda tem freio (S/seta para baixo) e derrapagem (Ctrl) para o desenvolvimento.
//   * Pointer Events com pointerId: cada dedo segura UM controle — direcao + TURBO ao mesmo tempo (multitoque) sem um soltar o outro.
//     setPointerCapture: o dedo que escorrega para fora do botao continua apertando (crianca nao mira com precisao).
//   * ARRASTAR (o modo 'joystick'; PADRAO desde 30/10/2026 — a crianca pediu "um botao de arrastar progressivo para virar, que volta
//     para o centro ao soltar" no lugar das setas, que viram tudo ou nada): um trilho com um botao amarelo que o polegar arrasta para
//     os lados. Base FIXA numa area grande a esquerda (Breno): o dedo pode cair em qualquer ponto da area e vale a distancia horizontal
//     ate o centro do trilho; o curso inteiro do botao (ponta do trilho) e a direcao toda, com zona morta e curva (arrastar pouco vira
//     pouco). Soltou: direcao zero no mesmo passo e o botao volta ao meio com mola. As setas continuam nas opcoes ("Setas").
//   * TRAVAS ANTI-DEDO-PRESO (o "TRAVA DO COMANDO" do Breno): o fim do toque e ouvido na JANELA toda (pointerup/pointercancel em
//     captura), `touchend` sem dedos na tela solta tudo, `touchcancel`/`blur`/`visibilitychange` soltam tudo, e um vigia de 250 ms solta o
//     controle cujo elemento sumiu da tela com o dedo em cima (tela de pausa abriu por cima, HUD escondido).
//   * Contadores por acao em vez de varrer um Map no passo: `passo()` le numeros, nao aloca nada.
// INCLINACAO: DeviceOrientation (beta/gamma) -> vetor da gravidade no aparelho -> giro "de volante" no plano da TELA, levando em conta o
// angulo da tela (paisagem de um lado ou do outro). No iPhone o sensor so liga com DeviceOrientationEvent.requestPermission() DENTRO
// de um toque: pedimos no `configura` (botao da tela de opcoes) e de novo no primeiro toque nos controles.
// TECLADO (desenvolvimento): setas/WASD, espaco = turbo, E/Shift = poder, S/seta para baixo = freio, Ctrl = derrapagem, Esc/P = pausa.
//
// TURBO E PODER DE UM TOQUE (pedido do Morassi, 30/10/2026: "o jogador aperta e o turbo/poder gastam ate o fim enquanto o usuario
// continua acelerando o carro"). Com os pedais na tela o polegar direito nao segura o ACELERADOR e o TURBO ao mesmo tempo (o FREIO
// fica entre os dois), entao:
//   * TURBO: o toque ACENDE e `aplicaNoCarro` mantem `controle.turbo` ligado sozinho ate a barra acabar — o dedo volta para o
//     acelerador. Tocar de novo com ele aceso nao muda nada; capsula pega no meio soma e ele continua ate o fim. Se algo o APAGA no
//     meio (EMP, gelo, rodopio) o toque acabou: ele nunca reacende sozinho (o resto da barra fica para o proximo toque). Barra vazia:
//     o toque so chega ao turbo para o aviso "Turbo vazio!". Vale para o teclado tambem (espaco). A IA continua segurando: liga na reta
//     e desliga antes da curva (js/ia.js; docs/PENDENCIAS.md);
//   * PODER: ja era de um toque (borda) e o efeito dura o tempo do poder, sem depender do dedo;
//   * TOQUE RAPIDO NUNCA SE PERDE: num celular fraco o quadro engasga e o pointerdown e o pointerup do toque chegam juntos ANTES do
//     proximo passo — o contador volta a zero e o passo nunca ve o botao descer. Turbo, poder e pausa guardam "foi tocado desde o
//     ultimo passo" (`_toqueRapido`): o passo seguinte ve a acao apertada por um passo, e `apertou()` dispara.
//
// `apertou(acao)` = borda NESTE passo. O retrato `_ultimo` do fim do passo anterior existe por causa do modo `simulada` (o harness
// escreve `estado` entre dois passos; copiar `estado` no comeco do passo perderia o valor antigo — armadilha do dinotrails-web).
import { emite } from './eventos.js';
import { FISICA } from '../config/fisica.js';
import { direcaoAssistida, pedaisAssistidos } from './assistencia.js';

const ACOES = ['acel', 'freio', 'direcao', 'drift', 'turbo', 'poder', 'pausa'];
/** Acoes de UM TOQUE: o toque rapido entre dois passos vale um passo apertado (ver o cabecalho). */
const UM_TOQUE = ['turbo', 'poder', 'pausa'];
const MODOS = ['botoes', 'joystick', 'inclinacao'];
/** Acima disto uma acao conta como "apertada" (direcao: em modulo). */
const LIMIAR = 0.5;
/** Arrastar: px do centro ate a direcao toda quando o trilho ainda nao tem tamanho (o R0 = 60-62 do Breno). Com o trilho na tela o
 *  curso e medido nele — (largura do trilho - largura do botao) / 2 — para a ponta do trilho ser sempre a direcao toda. */
const JOY_RAIO = 62;
/** Curso minimo (px): trilho espremido numa tela minuscula nao vira um interruptor de tudo-ou-nada. */
const JOY_RAIO_MIN = 44;
const JOY_ZONA_MORTA = 0.12;
/** Curva do arrastar: direcao = m^1,5 (m = curso depois da zona morta). Era 1,15 (quase reta) e o carro "virava demais" ate com o
 *  polegar perto do meio (30/10/2026): com 1,5 metade do curso pede 0,28 em vez de 0,38 e a ponta continua sendo tudo. Com a ajuda na
 *  direcao (js/assistencia.js) o dedo pede um ANGULO, entao a curva aqui so da precisao perto do meio (1,8 deixava o meio morto). */
const JOY_CURVA = 1.5;
/** Inclinacao: graus de giro "de volante" para a direcao toda, zona morta e suavizacao do sensor (o sensor treme ~1 grau). */
const INCLINA_MAX = 22;
const INCLINA_ZONA_MORTA = 2.5;
const INCLINA_SUAVE = 14;            // 1/s
const SEM_SENSOR_EM = 1.5;           // s sem evento de orientacao no modo inclinacao: mostra os botoes tambem (a crianca nao fica sem direcao)
const VIGIA_MS = 250;
const GRAUS = Math.PI / 180;

const TECLAS = {
  esq: ['ArrowLeft', 'KeyA'], dir: ['ArrowRight', 'KeyD'], acel: ['ArrowUp', 'KeyW'], freio: ['ArrowDown', 'KeyS'],
  turbo: ['Space'], poder: ['KeyE', 'ShiftLeft', 'ShiftRight'], drift: ['ControlLeft', 'ControlRight'], pausa: ['Escape', 'KeyP'],
};
/** Teclas que o navegador NAO pode usar enquanto o jogo roda (espaco e setas rolam a pagina). */
const SEGURA_DO_NAVEGADOR = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const ESTILO = `
#controles .tc-ctl { position: absolute; inset: 0; pointer-events: none; touch-action: none; -webkit-user-select: none; user-select: none;
  -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --sal: env(safe-area-inset-left, 0px); --sar: env(safe-area-inset-right, 0px); --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); }
#controles .tc-ctl.tc-oculto, #controles .tc-ctl .tc-oculto { display: none !important; }
#controles .tc-big { position: relative; display: grid; place-items: center; box-sizing: border-box; border-radius: 50%; border: 5px solid #fffaf0;
  box-shadow: 0 7px 0 rgba(0,0,0,.25), inset 0 -8px 0 rgba(0,0,0,.12); transition: transform .08s, box-shadow .08s; pointer-events: auto;
  touch-action: none; margin: 0; padding: 0; color: #fff; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; }
#controles .tc-big.down { transform: translateY(4px) scale(.95); box-shadow: 0 3px 0 rgba(0,0,0,.25), inset 0 -4px 0 rgba(0,0,0,.12); }
#controles .tc-big svg { width: 54%; height: 54%; pointer-events: none; }
#controles .tc-icone { font-size: clamp(30px, 9vh, 50px); line-height: 1; pointer-events: none; filter: drop-shadow(0 2px 0 rgba(0,0,0,.25));
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
#controles .tc-rotulo { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%); font-weight: 900; letter-spacing: .5px;
  font-size: clamp(10px, 2.6vh, 14px); color: #fffaf0; text-shadow: 0 2px 0 rgba(0,0,0,.35); pointer-events: none; white-space: nowrap; }
.tc-ctl .deco { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
.tc-ctl .deco:not(:empty) ~ .tc-icone { display: none; }
#controles .tc-esq { position: absolute; left: calc(max(14px, var(--sal)) + 4px); bottom: calc(var(--sab) + 16px); display: flex; gap: clamp(12px, 3.5vh, 24px); }
#controles .tc-seta { width: clamp(86px, 25vh, 128px); height: clamp(86px, 25vh, 128px); background: radial-gradient(circle at 40% 30%, #9fd8ff, #3d9be8 60%, #2270c0); }
#controles .tc-stick { position: absolute; left: 0; bottom: 0; width: 46%; height: 72%; pointer-events: auto; touch-action: none; }
/* o TRILHO do arrastar: largo o bastante para o polegar ter curso (a ponta = direcao toda), com as setas nas pontas e a marca do meio */
#controles .tc-base { position: absolute; left: calc(max(16px, var(--sal)) + 14px); bottom: calc(var(--sab) + 22px); width: clamp(200px, 60vh, 280px);
  height: clamp(88px, 26vh, 116px); border-radius: 999px; background: rgba(16,32,74,.38); border: 5px solid rgba(255,250,240,.85); box-sizing: border-box;
  box-shadow: 0 5px 0 rgba(0,0,0,.22), inset 0 4px 10px rgba(0,0,0,.25); }
#controles .tc-base.on { background: rgba(16,32,74,.5); }
#controles .tc-base::before, #controles .tc-base::after { position: absolute; top: 50%; transform: translateY(-50%); font-size: clamp(20px, 6.5vh, 30px); color: rgba(255,250,240,.8);
  font-weight: 900; transition: color .1s, transform .1s; line-height: 1; }
#controles .tc-base::before { content: '◀'; left: 6%; } #controles .tc-base::after { content: '▶'; right: 6%; }
/* o lado para onde o polegar esta virando acende */
#controles .tc-base[data-lado=esq]::before, #controles .tc-base[data-lado=dir]::after { color: #ffd23a; transform: translateY(-50%) scale(1.35); }
#controles .tc-meio { position: absolute; left: 50%; top: 18%; bottom: 18%; width: 4px; margin-left: -2px; border-radius: 2px; background: rgba(255,250,240,.35); }
/* o BOTAO de arrastar: grande como os outros botoes redondos, com a seta dupla de "arraste"; solto, volta ao meio com mola */
#controles .tc-knob { position: absolute; left: 50%; top: 50%; width: clamp(70px, 21vh, 96px); height: clamp(70px, 21vh, 96px); border-radius: 50%;
  transform: translate(-50%, -50%); background: radial-gradient(circle at 35% 30%, #fff, #ffe08a 55%, #f0b830); border: 5px solid #fffaf0;
  box-shadow: 0 6px 0 rgba(0,0,0,.25); box-sizing: border-box; display: grid; place-items: center; transition: transform .2s cubic-bezier(.3, 1.6, .5, 1); }
#controles .tc-base.on .tc-knob { transition: none; }
#controles .tc-knob svg { width: 62%; height: 62%; pointer-events: none; }
#controles .tc-incl { position: absolute; left: calc(max(16px, var(--sal)) + 14px); bottom: calc(var(--sab) + 22px); display: flex; flex-direction: column;
  align-items: center; gap: 6px; color: #fffaf0; font-weight: 800; font-size: clamp(12px, 3vh, 16px); text-shadow: 0 2px 0 rgba(0,0,0,.35); pointer-events: auto; }
#controles .tc-incl.sem { bottom: calc(var(--sab) + 30px + clamp(88px, 26vh, 116px)); }
#controles .tc-incl.sem .tc-incl-barra { display: none; }
#controles .tc-incl-barra { position: relative; width: clamp(150px, 40vh, 200px); height: 26px; border-radius: 14px; background: rgba(255,255,255,.25); border: 4px solid rgba(255,255,255,.75); }
#controles .tc-incl-ponto { position: absolute; top: 50%; left: 50%; width: 30px; height: 30px; border-radius: 50%; transform: translate(-50%, -50%);
  background: radial-gradient(circle at 35% 30%, #fff, #ffe08a 60%, #f0b830); border: 3px solid #fffaf0; }
/* DIREITA (pedidos do Morassi de 29 e 30/10/2026): o ACELERADOR em pe no canto, LARGO — o polegar da crianca de 5 anos cai nele sem
   mirar — e a coluna dos botoes redondos COLADA nele: TURBO embaixo, logo a esquerda do acelerador (o polegar so desliza para o
   lado), e PODER em cima do TURBO. O FREIO saiu ("remover o freio"): soltar o acelerador ja freia (FREIO_AO_SOLTAR em
   config/fisica.js) e a ajuda tira o pe sozinha na curva que nao da (js/assistencia.js). Antes o TURBO ficava depois do freio, a
   ~190 px do centro do acelerador; agora a ~125 px e o PODER a ~150 (teste_mobile mede o alcance). Tudo em min(vh, vw): no iPhone
   deitado, com o entalhe comendo ~47 px de cada lado, o grupo encolhe em vez de encostar na direcao. A coluna redonda fica fora da
   faixa do minimapa da fase 6 (canto de cima a direita). Na aceleracao automatica (opcao) o ACELERADOR some e a coluna vai para o
   canto. TURBO nunca abaixo de 84 px (a "area de toque generosa" da fase 2; o Safari do iPhone deitado, com a barra, tem 664 px). */
#controles .tc-dir-grupo { position: absolute; right: calc(max(14px, var(--sar)) + 4px); bottom: calc(var(--sab) + 14px); width: 1px; height: 1px;
  --aw: clamp(84px, min(28vh, 14vw), 136px); --ph: clamp(108px, min(37vh, 18.5vw), 170px);
  --t: clamp(84px, min(25vh, 12.5vw), 116px); --p: clamp(72px, min(21vh, 10.5vw), 104px); --g: clamp(12px, 3.4vh, 20px); }
#controles .tc-dir-grupo > .tc-big, #controles .tc-dir-grupo > .tc-pedal { position: absolute; }
#controles .tc-pedal { display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-sizing: border-box; margin: 0;
  padding: 9px 0 10px; border-radius: 18px; border: 4px solid #fffaf0; pointer-events: auto; touch-action: none; color: #fff; cursor: pointer;
  outline: none; -webkit-tap-highlight-color: transparent; transform-origin: 50% 100%;
  background: repeating-linear-gradient(180deg, rgba(255,255,255,.13) 0 5px, rgba(0,0,0,.20) 5px 11px), linear-gradient(180deg, #6b7684, #2f3742);
  box-shadow: 0 7px 0 rgba(0,0,0,.3), inset 0 -8px 0 rgba(0,0,0,.2); transition: transform .06s, box-shadow .06s; }
#controles .tc-pedal.down { transform: translateY(4px) scaleY(.95); box-shadow: 0 2px 0 rgba(0,0,0,.3), inset 0 -3px 0 rgba(0,0,0,.2); filter: brightness(1.15); }
#controles .tc-pedal .tc-faixa { width: 68%; height: 9px; border-radius: 5px; background: var(--cor); box-shadow: 0 0 10px var(--cor); flex: none; }
#controles .tc-pedal svg { width: 62%; height: auto; flex: 1 1 auto; max-height: 46%; pointer-events: none; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
#controles .tc-pedal .tc-rotulo { position: static; transform: none; flex: none; font-size: clamp(9px, 2.4vh, 13px); letter-spacing: 0; }
#controles #btn-acel { --cor: #5dff8a; right: 0; bottom: 0; width: var(--aw); height: var(--ph); }
#controles #btn-turbo { right: calc(var(--aw) + var(--g)); bottom: 0; width: var(--t); height: var(--t);
  background: radial-gradient(circle at 40% 30%, #ffd07a, #ff7a1a 60%, #e0400f); }
#controles #btn-poder { right: calc(var(--aw) + var(--g) + (var(--t) - var(--p)) / 2); bottom: calc(var(--t) + var(--g)); width: var(--p); height: var(--p);
  background: radial-gradient(circle at 40% 30%, #e2b8ff, #9b5cf6 60%, #6a3fd0); }
/* aceleracao automatica: sem o ACELERADOR, a coluna redonda vai para o canto (onde o polegar descansa) */
#controles .tc-ctl:not(.tc-manual) #btn-turbo { right: 0; }
#controles .tc-ctl:not(.tc-manual) #btn-poder { right: calc((var(--t) - var(--p)) / 2); }
#controles .tc-redondo { position: absolute; top: calc(var(--sat) + 10px); right: calc(max(12px, var(--sar)) + 4px); width: 54px; height: 54px; border-radius: 50%;
  background: rgba(255,250,240,.92); border: 4px solid #23324a; box-shadow: 0 5px 0 rgba(0,0,0,.25); pointer-events: auto; touch-action: none; display: grid;
  place-items: center; padding: 0; color: #23324a; font: 900 22px/1 system-ui, sans-serif; cursor: pointer; box-sizing: border-box; }
#controles .tc-redondo.down { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,.25); }
`;

const SETA_ESQ = '<svg viewBox="0 0 24 24"><path d="M16 4 6 12l10 8z" fill="#fff" stroke="#23324a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const SETA_DIR = '<svg viewBox="0 0 24 24"><path d="M8 4l10 8-10 8z" fill="#fff" stroke="#23324a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
/** A seta dupla do botao de arrastar ("arraste para os lados"). */
const SETA_DUPLA = '<svg viewBox="0 0 24 24"><path d="M9 6 3 12l6 6M15 6l6 6-6 6" fill="none" stroke="#23324a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** Pedais: setas duplas para cima (acelera, verde) e para baixo (freia, vermelho) — leem sem texto para quem ainda nao le. */
const PEDAL_ACEL = '<svg viewBox="0 0 24 24"><path d="M5 13l7-7 7 7M5 20l7-7 7 7" fill="none" stroke="#5dff8a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const HTML = `
<div class="tc-esq" data-so="botoes">
  <button class="tc-big tc-seta" id="btn-esq" data-acao="esq" aria-label="Esquerda">${SETA_ESQ}</button>
  <button class="tc-big tc-seta" id="btn-dir" data-acao="dir" aria-label="Direita">${SETA_DIR}</button>
</div>
<div class="tc-stick" id="stick" data-so="joystick"><div class="tc-base" id="stick-base"><i class="tc-meio"></i><div class="tc-knob" id="stick-knob">${SETA_DUPLA}</div></div></div>
<div class="tc-incl" id="incl" data-so="inclinacao"><div class="tc-incl-barra"><div class="tc-incl-ponto" id="incl-ponto"></div></div><span id="incl-texto">Incline o celular</span></div>
<div class="tc-dir-grupo">
  <button class="tc-big" id="btn-poder" data-acao="poder" aria-label="Poder"><span class="deco"></span><span class="tc-icone">⚡</span><span class="tc-rotulo">PODER</span></button>
  <button class="tc-big" id="btn-turbo" data-acao="turbo" aria-label="Turbo"><span class="deco"></span><span class="tc-icone">🔥</span><span class="tc-rotulo">TURBO</span></button>
  <button class="tc-pedal" id="btn-acel" data-acao="acel" aria-label="Acelerar"><span class="tc-faixa"></span>${PEDAL_ACEL}<span class="tc-rotulo">ACELERA</span></button>
</div>
<button class="tc-redondo" id="btn-pausa" data-acao="pausa" aria-label="Pausa">II</button>
`;

/** O primeiro toque/tecla: o AudioContext so toca depois de um gesto (armadilha do dinotrails-web). */
function avisaGesto(G) {
  try { if (G.audio && G.audio.desbloqueia) G.audio.desbloqueia(); } catch (e) { /* audio ainda nao existe */ }
}

export class Entrada {
  constructor(G) {
    this.G = G;
    /** acao -> 0..1 (direcao -1..1) NESTE passo */
    this.estado = {};
    /** acao no passo anterior (o `apertou` compara os dois) */
    this.anterior = {};
    this._ultimo = {};
    for (let k = 0; k < ACOES.length; k++) { const a = ACOES[k]; this.estado[a] = 0; this.anterior[a] = 0; this._ultimo[a] = 0; }
    /** o harness escreve `estado` direto e ninguem le dispositivo */
    this.simulada = false;
    /** aparelho de toque (os botoes aparecem); vira true tambem no primeiro toque de dedo num notebook com tela de toque */
    this.toque = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 ||
      (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
    // configuracao (G.save 'opcoes': { controle, acelAuto } — a tela de opcoes da fase 6 chama configura())
    const o = (G.save && G.save.le && G.save.le('opcoes', null)) || {};
    // ARRASTAR e o padrao (cabecalho). 'botoes' salvo ANTES dele virar padrao era so o padrao antigo gravado de carona (a tela de opcoes
    // grava o modo junto com o "acelerar sozinho"): passa para o arrastar. Setas escolhidas depois disso (marca `arrastarPadrao`) valem
    const salvo = o.controle === 'botoes' && !o.arrastarPadrao ? 'joystick' : o.controle;
    this.modo = MODOS.includes(salvo) ? salvo : 'joystick';
    // padrao DESLIGADA desde 29/10/2026: o Morassi pediu acelerador e freio na tela, no estilo dos jogos de corrida de celular; quem
    // preferir liga "acelerar sozinho" nas opcoes
    this.acelAuto = typeof o.acelAuto === 'boolean' ? o.acelAuto : false;
    // AJUDA NA DIRECAO (js/assistencia.js): ligada salvo `opcoes.ajudaDirecao === false`. As suites que dirigem o jogador com um
    // piloto proprio (que ja e um controlador) desligam, para medir a fisica crua
    this.ajuda = o.ajudaDirecao !== false;
    // SOLTOU O ACELERADOR = PERDE VELOCIDADE (sem o FREIO na tela, e o jeito de diminuir). As suites de fisica desligam (fisica crua)
    this.freioAoSoltar = true;
    // toque: contadores por acao (cada pointerId segura uma)
    this._apertos = { esq: 0, dir: 0, acel: 0, freio: 0, turbo: 0, poder: 0, pausa: 0 };
    // tocado desde o ultimo passo (turbo, poder, pausa): o toque rapido que o quadro engasgado engoliria
    this._toqueRapido = { turbo: false, poder: false, pausa: false };
    // o turbo aceso por um toque: fica ligado ate a barra acabar (ou algo apagar)
    this._turboPreso = false;
    this._dedos = new Map();               // pointerId -> { acao, el }
    this._joyId = null; this._joyX = 0; this._raioArrasto = JOY_RAIO;
    // le uma lista de teclas (metodo preso aqui uma vez: criar a funcao dentro do passo alocaria a cada passo)
    this._tem = (lista) => { for (let i = 0; i < lista.length; i++) if (this._teclas.has(lista[i])) return 1; return 0; };
    // inclinacao
    this._beta = null; this._gamma = null; this._inclinacao = 0; this._inclDesenhada = 0; this._tUltimoSensor = -1; this._permissao = '?';
    this._tMostrou = 0;
    // teclado
    this._teclas = new Set();
    // largada turbo
    this._corrida = null; this._largadaBoa = false; this._largadaDada = false;
    this._mostrar = false;
    this.el = null;
    this._montaDom();
    this._liga();
  }

  // ---------------------------------------------------------------------------------------------------------------- DOM
  _montaDom() {
    if (typeof document === 'undefined') return;
    const raiz = document.getElementById('controles');
    if (!raiz) return;
    if (!document.getElementById('tc-estilo-controles')) {
      const st = document.createElement('style'); st.id = 'tc-estilo-controles'; st.textContent = ESTILO; document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.className = 'tc-ctl tc-oculto';
    el.id = 'tc-controles';
    el.innerHTML = HTML;
    raiz.appendChild(el);
    this.el = el;
    this.raiz = raiz;
    this.btn = {};
    for (const b of el.querySelectorAll('[data-acao]')) this.btn[b.dataset.acao] = b;
    this.stick = el.querySelector('#stick'); this.base = el.querySelector('#stick-base'); this.knob = el.querySelector('#stick-knob');
    this.incl = el.querySelector('#incl'); this.inclPonto = el.querySelector('#incl-ponto'); this.inclTexto = el.querySelector('#incl-texto');
    // nada de menu de contexto, lupa ou selecao no toque longo
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const b of Object.values(this.btn)) this._botao(b, b.dataset.acao);
    this._joystick();
    // "Toque aqui para ligar a inclinacao": no iPhone a permissao do sensor so sai de dentro de um toque
    this.incl.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this._permissao !== 'ok') this._permissao = '?'; this._gesto(); });
    this._atualizaDom();
  }

  _atualizaDom() {
    if (!this.el) return;
    const ver = this._mostrar && this.toque;
    this.el.classList.toggle('tc-oculto', !ver);
    this.el.classList.toggle('tc-manual', !this.acelAuto);
    this.el.dataset.modo = this.modo;
    const semSensor = this.modo === 'inclinacao' && this._semSensor();
    for (const p of this.el.querySelectorAll('[data-so]')) {
      const so = p.dataset.so;
      p.classList.toggle('tc-oculto', !(so === this.modo || (so === 'joystick' && semSensor)));
    }
    if (this.btn.acel) this.btn.acel.classList.toggle('tc-oculto', this.acelAuto);
    // sem sensor (permissao negada, ou nenhum evento ainda): o ARRASTAR aparece de reserva e o texto sobe para cima dele, sem a barra
    if (this.incl) this.incl.classList.toggle('sem', semSensor);
    if (this.inclTexto) this.inclTexto.textContent = this._permissao === 'negada' ? 'Sem inclinação: arraste para virar' : (semSensor ? 'Toque aqui para ligar a inclinação' : 'Incline o celular');
  }

  _semSensor() {
    const t = this.G.relogio ? this.G.relogio.t : 0;
    return this._permissao === 'negada' || (this._tUltimoSensor < 0 && t - this._tMostrou > SEM_SENSOR_EM);
  }

  /** Botao de segurar (Breno `hold`, com pointerId e captura). */
  _botao(el, acao) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'touch' && !this.toque) { this.toque = true; this._atualizaDom(); }
      this._soltaDedo(e.pointerId);
      this._dedos.set(e.pointerId, { acao, el });
      this._apertos[acao]++;
      if (acao in this._toqueRapido) this._toqueRapido[acao] = true;
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* dedo sintetico ou navegador sem captura */ }
      this._gesto();
    });
    el.addEventListener('lostpointercapture', (e) => this._soltaDedo(e.pointerId));
    // sem captura (navegador antigo), sair de cima do botao solta — com captura o navegador nem manda isto
    el.addEventListener('pointerleave', (e) => { if (!el.hasPointerCapture || !el.hasPointerCapture(e.pointerId)) this._soltaDedo(e.pointerId); });
  }

  _soltaDedo(id) {
    const d = this._dedos.get(id);
    if (!d) return;
    this._dedos.delete(id);
    this._apertos[d.acao] = Math.max(0, this._apertos[d.acao] - 1);
    let ainda = false;
    for (const x of this._dedos.values()) if (x.el === d.el) { ainda = true; break; }
    if (!ainda) d.el.classList.remove('down');
  }

  /** Joystick de base FIXA (Breno): o dedo cai em qualquer lugar da area da esquerda; so o X conta. */
  _joystick() {
    const area = this.stick;
    if (!area) return;
    const move = (e) => {
      const r = this.base.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const raio = this._raioArrasto;
      const m = Math.min(1, Math.abs(dx) / raio);
      this._joyX = Math.sign(dx) * Entrada.curvaDoArrasto(m);
      const kx = Math.max(-raio, Math.min(raio, dx));
      this.knob.style.transform = `translate(calc(-50% + ${kx.toFixed(1)}px), -50%)`;
      const lado = this._joyX > 0 ? 'dir' : this._joyX < 0 ? 'esq' : '';
      if (this.base.dataset.lado !== lado) this.base.dataset.lado = lado;
    };
    area.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'touch' && !this.toque) { this.toque = true; this._atualizaDom(); }
      this._joyId = e.pointerId;                                    // novo toque sempre assume (Breno)
      this._raioArrasto = this.raioDoArrasto();                     // mede uma vez por toque (o trilho nao muda no meio do arrasto)
      this.base.classList.add('on');
      try { area.setPointerCapture(e.pointerId); } catch (er) { /* sem captura */ }
      move(e);
      this._gesto();
    });
    area.addEventListener('pointermove', (e) => { if (e.pointerId === this._joyId) move(e); });
    area.addEventListener('lostpointercapture', (e) => { if (e.pointerId === this._joyId) this._soltaJoystick(); });
  }

  /** Curso do botao de arrastar (px do meio ate a direcao toda): medido no trilho da tela (ver JOY_RAIO). */
  raioDoArrasto() {
    const b = this.base, k = this.knob;
    if (!b || !k || !b.offsetWidth || !k.offsetWidth) return JOY_RAIO;
    return Math.max(JOY_RAIO_MIN, (b.offsetWidth - k.offsetWidth) / 2);
  }

  _soltaJoystick() {
    this._joyId = null; this._joyX = 0;
    if (this.base) { this.base.classList.remove('on'); if (this.base.dataset.lado) this.base.dataset.lado = ''; }
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
  }

  /** Solta TODOS os dedos (as travas anti-dedo-preso). */
  _soltaTodosOsDedos() {
    for (const id of Array.from(this._dedos.keys())) this._soltaDedo(id);
    for (const k of Object.keys(this._apertos)) this._apertos[k] = 0;
    if (this.el) for (const b of this.el.querySelectorAll('.down')) b.classList.remove('down');
    this._soltaJoystick();
  }

  _gesto() {
    avisaGesto(this.G);
    // iPhone: o sensor de inclinacao so liga com permissao pedida dentro de um toque
    if (this.modo === 'inclinacao' && this._permissao === '?') this._pedePermissao();
  }

  _pedePermissao() {
    try {
      const DOE = typeof window !== 'undefined' && window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        this._permissao = 'pedindo';
        // 'prompt' (o Chromium responde assim fora de um toque) = ainda nao decidido: pergunta de novo no proximo toque
        DOE.requestPermission().then((r) => { this._permissao = r === 'granted' ? 'ok' : r === 'denied' ? 'negada' : '?'; this._atualizaDom(); })
          .catch(() => { this._permissao = '?'; }); // fora de um toque o iOS recusa: tenta de novo no proximo toque
      } else this._permissao = 'ok';                // Android/desktop: nao precisa pedir
    } catch (e) { this._permissao = '?'; }
  }

  _liga() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (SEGURA_DO_NAVEGADOR.has(e.code) && this.G.corrida) e.preventDefault();
      if (e.repeat) return;
      this._teclas.add(e.code);
      for (let i = 0; i < UM_TOQUE.length; i++) if (TECLAS[UM_TOQUE[i]].includes(e.code)) this._toqueRapido[UM_TOQUE[i]] = true;
      avisaGesto(this.G);
    });
    window.addEventListener('keyup', (e) => this._teclas.delete(e.code));
    // o fim do toque e ouvido na janela toda (Breno: o dedo saiu da tela em cima de outra coisa)
    const fim = (e) => { if (e.pointerId === this._joyId) this._soltaJoystick(); this._soltaDedo(e.pointerId); };
    window.addEventListener('pointerup', fim, true);
    window.addEventListener('pointercancel', fim, true);
    window.addEventListener('touchend', (e) => { if (e.touches && e.touches.length === 0) this._soltaTodosOsDedos(); }, true);
    window.addEventListener('touchcancel', () => this._soltaTodosOsDedos(), true);
    window.addEventListener('blur', () => this.esqueceTudo());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.esqueceTudo(); });
      // gesto de pinca do Safari (zoom) nunca, nem com o user-scalable=no ignorado
      document.addEventListener('gesturestart', (e) => e.preventDefault());
    }
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null || e.beta === undefined) return;
      this._beta = e.beta; this._gamma = e.gamma;
      if (this._tUltimoSensor < 0) { this._tUltimoSensor = this.G.relogio ? this.G.relogio.t : 0; this._atualizaDom(); }
      this._tUltimoSensor = this.G.relogio ? this.G.relogio.t : 0;
    });
    // vigia: o elemento sumiu da tela com o dedo em cima (tela de pausa por cima, controles escondidos) -> solta
    this._vigia = setInterval(() => {
      if (this._joyId !== null && this.stick && !this.stick.offsetParent) this._soltaJoystick();
      if (this._dedos.size) for (const [id, d] of Array.from(this._dedos.entries())) if (!d.el.offsetParent) this._soltaDedo(id);
      if (this._mostrar && this.modo === 'inclinacao') this._atualizaDom();
    }, VIGIA_MS);
  }

  /** Direcao (0..1) de um arrasto que andou a fracao `m` (0..1) do curso: zona morta e curva (JOY_CURVA). Exportado para as suites
   *  simularem o polegar do jeito que ele chega no carro. */
  static curvaDoArrasto(m) { const a = Math.min(1, Math.abs(m)); return a < JOY_ZONA_MORTA ? 0 : Math.pow((a - JOY_ZONA_MORTA) / (1 - JOY_ZONA_MORTA), JOY_CURVA); }

  /** Giro de volante (graus, + = direita) a partir de beta/gamma e do angulo da tela. Exportado para a suite medir a conta. */
  static giroDaInclinacao(beta, gamma, anguloTela) {
    const b = beta * GRAUS, g = gamma * GRAUS, a = (anguloTela || 0) * GRAUS;
    // gravidade ("para baixo") no referencial do aparelho (W3C: R = Rz(alfa) Rx(beta) Ry(gama)); o z nao interessa
    const gx = Math.sin(g) * Math.cos(b), gy = -Math.sin(b);
    // direita e cima da TELA no referencial do aparelho (a tela gira ao contrario do aparelho)
    let gR = gx * Math.cos(a) - gy * Math.sin(a);
    let gB = -(gx * Math.sin(a) + gy * Math.cos(a));                // "para baixo da tela"
    // segurando de pe na frente do rosto, a gravidade aponta para BAIXO da tela; se der o contrario, o angulo da tela veio trocado de
    // 180 graus (navegadores divergem no sinal de window.orientation): conserta sozinho em vez de inverter a direcao da crianca
    if (gB < 0) { gR = -gR; gB = -gB; }
    return Math.atan2(gR, gB) / GRAUS;
  }

  _anguloDaTela() {
    try {
      if (typeof screen !== 'undefined' && screen.orientation && Number.isFinite(screen.orientation.angle)) return screen.orientation.angle;
      if (typeof window !== 'undefined' && Number.isFinite(window.orientation)) return (window.orientation + 360) % 360;
    } catch (e) { /* sem api */ }
    return 0;
  }

  // ---------------------------------------------------------------------------------------------------------------- passo
  /** Um passo de leitura (G.passo chama antes de todo mundo). */
  passo(dt) {
    const est = this.estado, ant = this.anterior, ult = this._ultimo;
    for (let k = 0; k < ACOES.length; k++) ant[ACOES[k]] = ult[ACOES[k]];
    if (!this.simulada) {
      const ap = this._apertos, tem = this._tem;
      // direcao: teclado + botoes + joystick + inclinacao (o maior em modulo ganha)
      let dir = (tem(TECLAS.dir) + (ap.dir > 0 ? 1 : 0)) - (tem(TECLAS.esq) + (ap.esq > 0 ? 1 : 0));
      dir = Math.max(-1, Math.min(1, dir));
      if (this._joyId !== null && Math.abs(this._joyX) > Math.abs(dir)) dir = this._joyX;
      if (this.modo === 'inclinacao' && this._beta !== null) {
        const giro = Entrada.giroDaInclinacao(this._beta, this._gamma, this._anguloDaTela());
        const m = Math.abs(giro) < INCLINA_ZONA_MORTA ? 0 : Math.sign(giro) * Math.min(1, (Math.abs(giro) - INCLINA_ZONA_MORTA) / (INCLINA_MAX - INCLINA_ZONA_MORTA));
        this._inclinacao += (m - this._inclinacao) * (1 - Math.exp(-INCLINA_SUAVE * (dt || 1 / 60)));
        if (Math.abs(this._inclinacao) > Math.abs(dir)) dir = this._inclinacao;
        if (this.inclPonto && Math.abs(this._inclinacao - this._inclDesenhada) > 0.01) {
          this._inclDesenhada = this._inclinacao;
          this.inclPonto.style.left = (50 + 42 * this._inclinacao).toFixed(1) + '%';
        }
      }
      est.direcao = dir;
      est.acel = this.acelAuto ? 1 : Math.max(tem(TECLAS.acel), ap.acel > 0 ? 1 : 0);
      // FREIO/DRIFT e UM botao no toque: andando e virando a fisica derrapa, senao freia (js/carro.js). No teclado sao dois
      est.freio = Math.max(tem(TECLAS.freio), ap.freio > 0 ? 1 : 0);
      est.drift = Math.max(tem(TECLAS.drift), ap.freio > 0 ? 1 : 0);
      const tq = this._toqueRapido;
      est.turbo = Math.max(tem(TECLAS.turbo), ap.turbo > 0 || tq.turbo ? 1 : 0);
      est.poder = Math.max(tem(TECLAS.poder), ap.poder > 0 || tq.poder ? 1 : 0);
      est.pausa = Math.max(tem(TECLAS.pausa), ap.pausa > 0 || tq.pausa ? 1 : 0);
    }
    // sempre zera (tambem no modo `simulada`: um toque de verdade durante a suite nao pode valer um passo quando ela devolve a entrada)
    this._toqueRapido.turbo = this._toqueRapido.poder = this._toqueRapido.pausa = false;
    for (let k = 0; k < ACOES.length; k++) ult[ACOES[k]] = est[ACOES[k]];
    this._largada();
  }

  /** LARGADA TURBO: apertar TURBO (ou ACELERA, com a aceleracao manual) bem no VAI da um empurrao (config/fisica.js LARGADA_*). */
  _largada() {
    const c = this.G.corrida;
    if (c !== this._corrida) { this._corrida = c; this._largadaBoa = false; this._largadaDada = false; this._turboPreso = false; }
    if (!c || this._largadaDada || this._largadaBoa) return;
    const apertouAgora = this.apertou('turbo') || (!this.acelAuto && this.apertou('acel'));
    if (!apertouAgora) return;
    if (c.estado === 'contagem') {
      const faltam = c.contagem - (c.tContagem || 0);
      if (faltam <= FISICA.LARGADA_JANELA_ANTES) this._largadaBoa = true;
    } else if (c.estado === 'correndo' && c.t <= FISICA.LARGADA_JANELA_DEPOIS) this._largadaBoa = true;
  }

  /** Verdadeiro SO no passo em que a acao desceu. */
  apertou(a) { return Math.abs(this.estado[a] || 0) > LIMIAR && Math.abs(this.anterior[a] || 0) <= LIMIAR; }

  /** Copia o estado para o controle do carro do jogador (a corrida chama, docs/CONTRATOS.md secao 7). */
  aplicaNoCarro(carro) {
    const e = this.estado, c = carro.controle;
    c.acel = Math.max(0, Math.min(1, e.acel || 0));
    c.freio = Math.max(0, Math.min(1, e.freio || 0));
    // a direcao do jogador e RELATIVA A ESTRADA: solto, o carro segue a pista e fica paralelo (js/assistencia.js, pedido de 30/10/2026)
    c.direcao = this.ajuda ? direcaoAssistida(carro, e.direcao || 0) : Math.max(-1, Math.min(1, e.direcao || 0));
    // soltou o acelerador (o dedo, nao a ajuda): freio leve. So andando para a frente: parado, o freio da fisica vira re (js/carro.js)
    if (this.freioAoSoltar && !this.acelAuto && (e.acel || 0) <= LIMIAR && carro.vf > FISICA.FREIO_AO_SOLTAR_ACIMA) c.freio = Math.max(c.freio, FISICA.FREIO_AO_SOLTAR);
    // e TIRA O PE sozinho na curva que o carro nao faz naquela velocidade (a crianca segura o acelerador o tempo todo)
    if (this.ajuda) pedaisAssistidos(carro, c);
    c.drift = (e.drift || 0) > LIMIAR;
    // TURBO DE UM TOQUE (cabecalho): o toque acende; aceso, segue ligado sem o dedo ate a barra acabar. O js/turbo.js apagou depois de
    // acender (barra vazia, EMP, gelo, rodopio) -> o toque acabou. Le `ativo` do passo anterior: este passo ainda nao rodou o turbo
    const tb = carro.turbo;
    if (this._turboPreso && !(tb && tb.ativo)) this._turboPreso = false;
    if (this.apertou('turbo')) this._turboPreso = true;
    c.turbo = this._turboPreso;
    c.poder = this.apertou('poder');
    if (this._largadaBoa && !this._largadaDada && this._corrida && this._corrida.estado === 'correndo') {
      this._largadaDada = true;
      carro.empurra(FISICA.LARGADA_TURBO, 0);
      emite('carro:largada_turbo', { carro });
    }
  }

  /** Mostra/esconde os controles de toque (a fase 6 chama na largada e ao sair da corrida). Sem tela de toque, nao aparecem. */
  mostraControles(sim) {
    this._mostrar = !!sim;
    if (this._mostrar) this._tMostrou = this.G.relogio ? this.G.relogio.t : 0;
    else this._soltaTodosOsDedos();
    this._atualizaDom();
  }

  /** { modo: 'botoes'|'joystick'|'inclinacao', acelAuto: bool } — grava em G.save('opcoes') sem apagar o resto das opcoes. */
  configura(op = {}) {
    if (op.modo && MODOS.includes(op.modo)) this.modo = op.modo;
    if (typeof op.acelAuto === 'boolean') this.acelAuto = op.acelAuto;
    if (this.modo === 'inclinacao' && this._permissao !== 'ok') this._pedePermissao(); // dentro do toque do botao da tela de opcoes
    this._soltaTodosOsDedos();
    try {
      const S = this.G.save;
      if (S && S.le && S.grava) { const o = S.le('opcoes', null) || {}; o.controle = this.modo; o.acelAuto = this.acelAuto; o.arrastarPadrao = true; S.grava('opcoes', o); }
    } catch (e) { /* salvamento quebrado: vale ate fechar a aba */ }
    this._atualizaDom();
    return { modo: this.modo, acelAuto: this.acelAuto };
  }

  /** SOLTA TUDO (blur, aba escondida): o keyup da tecla baixa no Alt+Tab nunca chega (armadilha do dinotrails-web). Em `simulada` o
   *  estado e do harness: nao se apaga o que ele acabou de escrever. */
  esqueceTudo() {
    this._teclas.clear();
    this._soltaTodosOsDedos();
    // o turbo aceso por um toque NAO se apaga aqui: ele nao e um dedo que pode ficar preso — acaba sozinho com a barra
    this._toqueRapido.turbo = this._toqueRapido.poder = this._toqueRapido.pausa = false;
    if (this.simulada) return;
    for (let k = 0; k < ACOES.length; k++) { const a = ACOES[k]; this.estado[a] = 0; this.anterior[a] = 0; this._ultimo[a] = 0; }
    this._inclinacao = 0;
  }
}
