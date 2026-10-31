// AUDIO (fase 6): som 100% sintetizado no WebAudio — nenhum arquivo (o TurboCaos.html abre em file://, onde nem fetch existe). O
// estilo e o do Breno (referencias/breno/js/audio.js): primitivas `nota`/`ruido` com envelope, um sintetizador por evento que se
// desconecta sozinho, tabela de efeitos cartunescos, tabela de REFORCO para os curtos/agudos aparecerem sobre a musica, teto de vozes
// com roubo da mais antiga, compressor no fim e a musica procedural (js/musica.js) com crossfade.
//
// O QUE A CORRIDA PEDIU A MAIS QUE O BRENO:
//   * MOTOR continuo do jogador: osciladores com o tom pela velocidade, pseudo-marchas (o "vrum-vrum" que sobe e cai e o que faz a
//     crianca sentir que acelerou), timbre por carro (o Faisca e eletrico e zune; Voador e Jatinho sao turbina; os pesados roncam
//     grave) e um motor leve para os 2 rivais mais perto, com volume pela distancia e lado pelo panorama;
//   * SOPRO do turbo e CHIADO da derrapagem: lacos de ruido sempre montados, com o ganho em zero quando desligados (criar e destruir
//     no a cada aperto estala no celular);
//   * POSICIONAL barato: ganho pela distancia ate a camera e lado pelo produto com a direita dela (StereoPanner). PannerNode HRTF por
//     som custa caro no celular e a crianca nao distingue;
//   * barramentos geral / musica / efeitos com os volumes da tela de opcoes (0..100 no save, 0..1 aqui).
//
// REGRAS DO NAVEGADOR (herdadas do Breno, do dinotrails-web e do Cidade Aberta):
//   * o AudioContext so nasce no PRIMEIRO GESTO (`desbloqueia()`, chamado pelas telas no primeiro toque) — no iPhone, um buffer mudo
//     tocado dentro do gesto e o que destrava; o que for pedido antes (a musica do menu) fica guardado e comeca quando ele nascer;
//   * aba escondida NAO para o som sozinha: o laco chama `suspende()`/`retoma()` (js/main.js);
//   * contexto suspenso de proposito nao empilha efeito: senao tudo toca junto quando a aba volta;
//   * DUAS TROCAS DE MUSICA SEGUIDAS NAO PODEM CALAR A SEGUNDA (armadilha do dinotrails-web: o callback do primeiro crossfade parava o
//     tocador que a segunda troca acabava de ligar). Aqui cada troca cria um tocador NOVO com o seu ganho e o seu `ate`; quem esta
//     saindo nunca e reaproveitado, entao nada do fade antigo alcanca o tocador novo. O teste_audio troca tres vezes seguidas e mede;
//   * sorteio de enfeite (offset do ruido, estilhacos do gelo) tem GERADOR PROPRIO: o Math.random e semeado em ?teste= e e de todo
//     mundo (three.js, cenario) — consumir ele num timer de audio embaralharia a sequencia (armadilha do dinotrails-web);
//   * `?mudo=1` (a bateria abre assim) = nenhum AudioContext; navegador sem WebAudio = tudo vira no-op sem erro.
//
// NOMES PARA `toca(nome)`: os de EFEITOS abaixo, inclusive o id de cada um dos 10 poderes (config/poderes.js). O som do poder toca no
// evento `poder:usa` (ouvido aqui); a fase 4 pode chamar `toca(id)` tambem — o anti-repeticao de 60 ms nao deixa dobrar.
import * as THREE from 'three';
import { on } from './eventos.js';
import * as save from './save.js';
import { TEMAS, temaDaPista, novoTocador, agenda } from './musica.js';

/** Nivel base dos barramentos (o Breno: MUSIC_VOL 0,18 e SFX_VOL 0,5 — a musica bem abaixo dos efeitos para o aviso nao sumir). */
const MUSICA_VOL = 0.2;
const EFEITOS_VOL = 0.55;
/** Motores somados num barramento proprio, abaixo dos efeitos: o ronco e chao, o "plim" da capsula e o que tem de aparecer. */
const MOTORES_VOL = 0.75;
/** Teto de efeitos ao mesmo tempo (o Breno usa 12; corrida tem batida + poder + capsula juntos). */
const MAX_VOZES = 14;
/** Crossfade entre musicas, s (o Breno usa 0,6; 0,8 deixa a troca menu -> corrida menos seca). */
export const FADE_DA_MUSICA = 0.8;
/** Agendamento da musica: quanto adiante (s) e de quanto em quanto tempo (ms) — os numeros do Breno. */
const ANTECEDENCIA = 0.3;
const TIQUE_MS = 100;
/** O mesmo som nao toca duas vezes em menos de 60 ms (metralhadora de batidas no mesmo passo; poder pedido por evento e pela fase 4). */
const REPETICAO_MINIMA = 0.06;
/** Alcance dos sons posicionais (m): a 80 m o rival ja e um ponto no minimapa. */
const ALCANCE = 80;
/** Alcance do motor dos rivais (m): mais curto que o dos efeitos — motor longe vira zumbido de fundo. */
const ALCANCE_DO_MOTOR = 45;
/** Velocidade (m/s) que leva o motor ao topo do giro. ~ a maxima dos carros (config/fisica.js e da fase 2; 38 m/s = 137 km/h). */
export const VEL_REF = 38;   // (js/pipoco.js usa as mesmas marchas: o estouro da reducao sai junto com o giro que sobe)
/** Pseudo-marchas, em fracao de VEL_REF: o giro sobe dentro da marcha e cai na troca. */
export const MARCHAS = [0, 0.16, 0.34, 0.55, 0.78];
/** Musica mais baixa no menu de pausa (a crianca esta escolhendo, nao correndo). */
const PAUSA_ABAIXA = 0.45;

// ---------------------------------------------------------------- sorteio proprio (ver o cabecalho)
let _sementeDoAudio = 0x2545f491 >>> 0;
function sorteia() {
  _sementeDoAudio = (_sementeDoAudio + 0x6d2b79f5) >>> 0;
  let t = _sementeDoAudio;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const escolhe = (lista) => lista[Math.floor(sorteia() * lista.length)];
const limita = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- primitivas (o synth do Breno, em portugues)
const ruidos = new WeakMap();
/** Um buffer de 1 s de ruido branco por AudioContext, criado uma vez e reaproveitado por todo efeito e laco. */
function bufferDeRuido(c) {
  let b = ruidos.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = sorteia() * 2 - 1;
    ruidos.set(c, b);
  }
  return b;
}

/** Envelope: ataque linear, sustenta `segura` (0..1 da duracao), decai exponencial ate o fim. */
function envelope(p, t, dur, vol, ataque, segura) {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(vol, t + ataque);
  p.setValueAtTime(vol, t + ataque + Math.max(0, dur - ataque) * segura);
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Sintetizador de UM evento: `nota()`/`ruido()` relativos a t0, frequencias vezes `tom`. Cada no se desconecta ao terminar. */
export function sintetizador(c, saida, t0, tom = 1) {
  const S = { fim: t0, fontes: [] };
  S.nota = (dt, f, dur, o = {}) => {
    const t = t0 + dt, osc = c.createOscillator(), g = c.createGain(), nos = [osc, g];
    osc.type = o.tipo || 'sine';
    const fp = f * tom;
    osc.frequency.setValueAtTime(fp, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2 * tom), t + (o.desliza ?? dur));
    if (o.vib) { // vibrato: [taxa Hz, profundidade relativa]
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = fp * o.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.02);
      nos.push(l, lg);
    }
    envelope(g.gain, t, dur, o.vol ?? 0.3, o.ataque ?? 0.005, o.segura ?? 0);
    let ultimo = osc;
    if (o.passaBaixa) { const fl = c.createBiquadFilter(); fl.frequency.value = o.passaBaixa; nos.push(fl); ultimo.connect(fl); ultimo = fl; }
    ultimo.connect(g); g.connect(saida);
    osc.start(t); osc.stop(t + dur + 0.02);
    S.fontes.push(osc); S.fim = Math.max(S.fim, t + dur + 0.02);
    osc.onended = () => { for (const n of nos) n.disconnect(); };
  };
  S.ruido = (dt, dur, o = {}) => {
    const t = t0 + dt, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), nos = [src, fl, g];
    src.buffer = bufferDeRuido(c); src.loop = true;
    fl.type = o.tipo || 'bandpass'; fl.Q.value = o.q ?? 1;
    fl.frequency.setValueAtTime((o.f ?? 1000) * tom, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2 * tom), t + dur);
    envelope(g.gain, t, dur, o.vol ?? 0.3, o.ataque ?? 0.005, o.segura ?? 0);
    src.connect(fl); fl.connect(g); g.connect(saida);
    src.start(t, sorteia() * 0.9); src.stop(t + dur + 0.02);
    S.fontes.push(src); S.fim = Math.max(S.fim, t + dur + 0.02);
    src.onended = () => { for (const n of nos) n.disconnect(); };
  };
  return S;
}

// ---------------------------------------------------------------- notas usadas nos efeitos
const N = { C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, B5: 987.8, C6: 1046.5, D6: 1174.7, E6: 1318.5, F6: 1396.9, G6: 1568, A6: 1760, B6: 1975.5, C7: 2093, E7: 2637 };
const PENTA = [N.C6, N.D6, N.E6, N.G6, N.A6, N.C7];
const arpejo = (S, dt, fs, gap, o) => fs.forEach((f, i) => S.nota(dt + i * gap, f, o.dur ?? 0.22, o));
const moeda = (S, dt, k = 1, v = 1) => { S.nota(dt, N.B5 * k, 0.08, { tipo: 'square', vol: 0.11 * v, segura: 1 }); S.nota(dt + 0.075, N.E6 * k, 0.3, { tipo: 'square', vol: 0.11 * v }); };

// ---------------------------------------------------------------- os efeitos. Clima: desenho animado — batida e "PAM!", nunca susto.
export const EFEITOS = {
  // --- interface
  clique: (S) => S.nota(0, 660, 0.07, { tipo: 'triangle', f2: 990, vol: 0.3 }),
  voltar: (S) => S.nota(0, 700, 0.08, { tipo: 'triangle', f2: 440, vol: 0.28 }),
  trocar: (S) => { S.ruido(0, 0.22, { f: 500, f2: 2200, q: 1.4, vol: 0.22 }); S.nota(0.02, 420, 0.12, { tipo: 'triangle', f2: 760, vol: 0.18 }); },
  confirmar: (S) => { S.nota(0, N.C6, 0.1, { tipo: 'triangle', vol: 0.26, segura: 0.5 }); S.nota(0.09, N.G6, 0.28, { tipo: 'triangle', vol: 0.26, segura: 0.3 }); },
  bloqueado: (S) => S.nota(0, 126, 0.4, { f2: 252, desliza: 0.1, vib: [14, 0.2], vol: 0.45 }),
  desbloqueio: (S) => { // "ta-daa" (o unlock do Breno)
    [N.G5, N.B5, N.D6].forEach((f) => S.nota(0, f, 0.14, { tipo: 'triangle', vol: 0.15, segura: 0.6 }));
    [N.C6, N.E6, N.G6].forEach((f) => S.nota(0.16, f, 0.9, { tipo: 'triangle', vol: 0.16, segura: 0.4 }));
    S.ruido(0.16, 0.6, { tipo: 'highpass', f: 7000, vol: 0.05 });
  },
  recorde: (S) => { arpejo(S, 0, [N.C6, N.E6, N.G6, N.C7, N.E7], 0.06, { tipo: 'triangle', vol: 0.22, dur: 0.26 }); S.ruido(0.25, 0.4, { tipo: 'highpass', f: 8000, vol: 0.05 }); },
  estrela: (S) => { S.nota(0, N.E6, 0.12, { tipo: 'triangle', vol: 0.25 }); S.nota(0.06, N.B6, 0.3, { vol: 0.12 }); },

  // --- largada e voltas
  bipe: (S) => S.nota(0, 880, 0.17, { tipo: 'square', vol: 0.13, segura: 0.75 }),
  largada: (S) => { // "VAI!": bipe agudo comprido + soco grave
    S.nota(0, 1760, 0.5, { tipo: 'square', vol: 0.12, segura: 0.7 });
    S.nota(0, 880, 0.5, { tipo: 'triangle', vol: 0.2, segura: 0.7 });
    S.nota(0, 140, 0.35, { f2: 50, vol: 0.55 });
    S.ruido(0.02, 0.4, { f: 600, f2: 3000, q: 1, vol: 0.15 });
  },
  volta: (S) => [0, 0.17].forEach((d) => { S.nota(d, N.E6, 0.12, { tipo: 'triangle', vol: 0.28 }); S.nota(d + 0.05, N.A6, 0.15, { tipo: 'triangle', vol: 0.22 }); }),
  ultima_volta: (S) => { // sino de ultima volta: tres plins subindo + bumbo
    [0, 0.14, 0.28].forEach((d, i) => { S.nota(d, N.E6 * (1 + i * 0.125), 0.16, { tipo: 'square', vol: 0.1 }); S.nota(d, N.A6 * (1 + i * 0.125), 0.2, { tipo: 'triangle', vol: 0.2 }); });
    S.nota(0.42, N.C7, 0.5, { tipo: 'triangle', vol: 0.22, segura: 0.4 });
    S.nota(0, 120, 0.3, { f2: 60, vol: 0.4 });
  },
  ultrapassou: (S) => { S.nota(0, N.G6, 0.08, { tipo: 'triangle', vol: 0.2 }); S.nota(0.06, N.C7, 0.16, { tipo: 'triangle', vol: 0.2 }); },
  chegada: (S) => { // fanfarra (a victory do Breno, ~2 s)
    const lead = [[0, N.C5], [0.13, N.E5], [0.26, N.G5], [0.39, N.C6], [0.65, N.G5], [0.78, N.C6]];
    lead.forEach(([d, f], i) => {
      const ultima = i === lead.length - 1, dur = ultima ? 1.1 : 0.12;
      S.nota(d, f, dur, { tipo: 'triangle', vol: 0.26, segura: ultima ? 0.5 : 0.6 });
      S.nota(d, f, dur, { tipo: 'square', vol: 0.06, segura: ultima ? 0.5 : 0.6 });
    });
    [N.E6, N.G6].forEach((f) => S.nota(0.78, f, 1.1, { tipo: 'triangle', vol: 0.12, segura: 0.5 }));
    [[0, 130.8], [0.39, 196], [0.78, 261.6]].forEach(([d, f]) => S.nota(d, f, 0.35, { tipo: 'triangle', vol: 0.35 }));
    S.ruido(0.78, 1.0, { tipo: 'highpass', f: 6000, vol: 0.06 });
    arpejo(S, 1.3, [N.C7, N.E7, N.C7 * 1.5], 0.08, { vol: 0.07, dur: 0.3 });
  },
  vitoria: (S) => { // podio em 1o: fanfarra + fogos
    EFEITOS.chegada(S);
    for (let i = 0; i < 3; i++) {
      const d = 1.2 + i * 0.35;
      S.nota(d, 900, 0.5, { f2: 2400, vib: [12, 0.01], vol: 0.05, segura: 0.8 });
      S.ruido(d + 0.5, 0.3, { tipo: 'lowpass', f: 1500, f2: 300, vol: 0.3 });
    }
  },
  derrota: (S) => { // "uo-uo-uooo" bobinho (o bossTired do Breno): engracado, nao triste
    [494, 466, 415].forEach((f, i) => S.nota(i * 0.22, f, i === 2 ? 0.5 : 0.2, { tipo: 'triangle', f2: f * 0.94, vib: [6, 0.02], vol: 0.3, segura: 0.5 }));
  },

  // --- pista
  capsula: (S) => { moeda(S, 0, 1.12); S.ruido(0, 0.12, { tipo: 'highpass', f: 5000, vol: 0.04 }); },
  capsula_dourada: (S) => {
    arpejo(S, 0, [N.C6, N.E6, N.G6, N.C7], 0.055, { tipo: 'triangle', vol: 0.26 });
    S.nota(0.22, N.E7, 0.4, { vol: 0.1 });
    S.ruido(0.15, 0.3, { tipo: 'highpass', f: 8000, vol: 0.06 });
  },
  turbo: (S) => { // FWOOSH: ar entrando + ronco subindo
    S.ruido(0, 0.6, { f: 300, f2: 2600, q: 1.2, vol: 0.36, segura: 0.3 });
    S.nota(0, 90, 0.5, { tipo: 'sawtooth', f2: 220, vol: 0.2, passaBaixa: 900 });
  },
  turbo_vazio: (S) => { S.ruido(0, 0.35, { f: 1200, f2: 250, q: 1.5, vol: 0.25 }); S.nota(0, 320, 0.3, { tipo: 'triangle', f2: 150, vol: 0.2 }); },
  estouro: (S) => { // PIPOCO no escapamento (js/pipoco.js): o estouro do Cidade Aberta (js/audio.js estouro: estalo agudo + soco grave +
    // "tum" quadrado curtinho). A forca vem no vol (0,3 a 1,6) e o tom varia um pouco a cada um
    S.ruido(0, 0.04, { tipo: 'highpass', f: 2600, q: 1.3, vol: 0.28 });
    S.ruido(0, 0.11, { tipo: 'lowpass', f: 230, q: 0.9, vol: 0.5 });
    S.nota(0, 95, 0.07, { tipo: 'square', f2: 55, vol: 0.32 });
  },
  turbo_cheio: (S) => { arpejo(S, 0, [N.G5, N.C6, N.E6, N.G6], 0.05, { tipo: 'square', vol: 0.08, dur: 0.12 }); S.nota(0.2, N.C7, 0.3, { tipo: 'triangle', vol: 0.18 }); },
  batida: (S) => { // "PAM!" com um boing de desenho
    S.ruido(0, 0.25, { tipo: 'lowpass', f: 1400, f2: 200, vol: 0.5 });
    S.nota(0, 160, 0.2, { f2: 60, vol: 0.5 });
    S.nota(0.04, 420, 0.25, { tipo: 'triangle', f2: 210, vib: [18, 0.15], vol: 0.22 });
  },
  batida_forte: (S) => { // CRASH: chapa amassando + vidro + clang
    S.ruido(0, 0.5, { f: 900, q: 0.5, vol: 0.55 });
    S.ruido(0, 0.3, { tipo: 'highpass', f: 3000, vol: 0.22 });
    S.nota(0, 95, 0.4, { f2: 45, vol: 0.6 });
    S.nota(0.02, N.C5, 0.12, { tipo: 'square', vol: 0.08 }); S.nota(0.05, N.G5, 0.14, { tipo: 'square', vol: 0.06 });
    S.nota(0.1, 520, 0.3, { tipo: 'triangle', f2: 180, vib: [20, 0.2], vol: 0.2 });
  },
  raspao: (S) => { S.ruido(0, 0.22, { f: 2200, q: 3, vol: 0.28 }); S.ruido(0, 0.12, { tipo: 'lowpass', f: 600, vol: 0.12 }); },
  pouso: (S) => { S.nota(0, 170, 0.12, { f2: 70, vol: 0.5 }); S.ruido(0, 0.07, { tipo: 'lowpass', f: 500, vol: 0.25 }); },
  decolou: (S) => S.nota(0, 300, 0.22, { tipo: 'triangle', f2: 760, vol: 0.22 }),
  queda: (S) => { // apito de desenho descendo + plof (o fall do Breno)
    S.nota(0, 1000, 0.8, { f2: 220, vib: [7, 0.04], vol: 0.28, segura: 0.7 });
    S.ruido(0.78, 0.15, { tipo: 'lowpass', f: 600, f2: 150, vol: 0.35 });
  },
  reaparece: (S) => { S.nota(0, 400, 0.45, { tipo: 'triangle', f2: 1600, vol: 0.22, segura: 0.5 }); arpejo(S, 0.3, [N.G6, N.C7, N.E7], 0.06, { vol: 0.1 }); },
  acerto_bom: (S) => { // voce acertou alguem: "bonk + boing" (o bossHit do Breno)
    S.nota(0, 700, 0.12, { tipo: 'square', f2: 350, vol: 0.12 });
    S.nota(0.06, 220, 0.4, { f2: 330, desliza: 0.1, vib: [14, 0.2], vol: 0.4 });
  },
  acerto_ruim: (S) => { // voce levou: "boing-plof" (o hit do Breno)
    S.nota(0, 520, 0.3, { tipo: 'triangle', f2: 180, vib: [18, 0.15], vol: 0.4 });
    S.ruido(0.05, 0.12, { tipo: 'lowpass', f: 700, f2: 200, vol: 0.35 });
    S.nota(0.05, 140, 0.12, { f2: 70, vol: 0.3 });
  },
  esquiva: (S) => { S.ruido(0, 0.25, { f: 2400, f2: 600, q: 1.6, vol: 0.25 }); S.nota(0.05, 600, 0.18, { tipo: 'triangle', f2: 1300, vol: 0.2 }); },
  escudo_bloqueia: (S) => { S.nota(0, N.G6, 0.45, { tipo: 'triangle', vol: 0.22 }); S.nota(0, 2349, 0.35, { vol: 0.1 }); S.ruido(0, 0.08, { tipo: 'highpass', f: 6000, vol: 0.15 }); },
  gelo_quebra: (S) => { // vidro de gelo estilhacando
    S.ruido(0, 0.35, { tipo: 'highpass', f: 4200, vol: 0.32 });
    for (let k = 0; k < 6; k++) S.nota(0.03 + k * 0.045, 1700 + sorteia() * 2800, 0.12, { tipo: 'triangle', vol: 0.06 });
  },

  // --- os 10 poderes (ids de config/poderes.js)
  oleo: (S) => { // "splorch" + bolhas
    S.ruido(0, 0.3, { tipo: 'lowpass', f: 900, f2: 200, q: 4, vol: 0.4 });
    S.nota(0, 350, 0.22, { f2: 110, vol: 0.32 });
    [0.18, 0.28, 0.36].forEach((d) => S.nota(d, 260 + sorteia() * 80, 0.09, { f2: 900, vol: 0.18 }));
  },
  emp: (S) => { // ZZZAP eletrico
    S.nota(0, 80, 0.3, { tipo: 'sawtooth', f2: 1400, vol: 0.18, passaBaixa: 4000 });
    S.nota(0.05, 3000, 0.25, { tipo: 'square', vib: [40, 0.05], vol: 0.05 });
    for (let k = 0; k < 4; k++) S.ruido(0.05 + k * 0.07, 0.04, { tipo: 'highpass', f: 6000, vol: 0.18 });
    S.nota(0.3, 220, 0.4, { tipo: 'sawtooth', f2: 60, vol: 0.12, passaBaixa: 1200 });
  },
  congelante: (S) => { // raio de gelo "piu-zing" + cristais
    S.nota(0, 2400, 0.35, { f2: 600, vib: [30, 0.02], vol: 0.2 });
    S.ruido(0, 0.4, { tipo: 'highpass', f: 6000, vol: 0.08, segura: 0.4 });
    arpejo(S, 0.25, [N.E7, N.B6, N.E7], 0.05, { vol: 0.07, dur: 0.15 });
  },
  ima: (S) => { // "uom-uom" magnetico
    S.nota(0, 110, 0.9, { tipo: 'sawtooth', vib: [6, 0.08], vol: 0.18, passaBaixa: 700, segura: 0.6 });
    S.nota(0, 200, 0.9, { f2: 420, vol: 0.12, segura: 0.5 });
  },
  trocatroca: (S) => { // duas notas trocando de lugar + pop
    S.nota(0, 300, 0.3, { tipo: 'triangle', f2: 900, vol: 0.24 });
    S.nota(0, 900, 0.3, { tipo: 'triangle', f2: 300, vol: 0.2 });
    S.nota(0.3, 600, 0.08, { tipo: 'square', f2: 1200, vol: 0.12 });
  },
  encolhedor: (S) => { // "uiiiu" descendo + estalinhos
    S.nota(0, 1200, 0.5, { tipo: 'square', f2: 150, vib: [9, 0.03], vol: 0.1, passaBaixa: 2200 });
    [0.12, 0.25, 0.38].forEach((d, i) => S.nota(d, 1500 - i * 300, 0.05, { tipo: 'triangle', vol: 0.15 }));
  },
  fumaca: (S) => { S.ruido(0, 0.9, { f: 1200, q: 0.6, vol: 0.32, segura: 0.4 }); S.ruido(0, 0.3, { tipo: 'lowpass', f: 400, vol: 0.3 }); },
  tornado: (S) => { // redemoinho de vento + assobio
    S.ruido(0, 0.5, { f: 300, f2: 1600, q: 2, vol: 0.32 });
    S.ruido(0.45, 0.5, { f: 1600, f2: 500, q: 2, vol: 0.28 });
    S.nota(0, 600, 0.9, { f2: 1200, vib: [7, 0.06], vol: 0.06, segura: 0.5 });
  },
  escudo: (S) => { S.nota(0, 200, 0.3, { tipo: 'triangle', f2: 800, vol: 0.25 }); S.nota(0.22, N.G6, 0.5, { vol: 0.12 }); S.nota(0.22, N.C7, 0.6, { tipo: 'triangle', vol: 0.1 }); },
  terremoto: (S) => { // ronco do chao + pancadas (o rumble do Breno)
    S.ruido(0, 1.2, { tipo: 'lowpass', f: 160, vol: 0.55, ataque: 0.15, segura: 0.5 });
    S.nota(0, 55, 1.2, { vib: [8, 0.1], vol: 0.32, ataque: 0.1, segura: 0.5 });
    [0.1, 0.45, 0.8].forEach((d) => S.nota(d, 110, 0.25, { f2: 40, vol: 0.45 }));
  },
};
export const NOMES_DOS_EFEITOS = Object.keys(EFEITOS);

/** Equalizacao: curtos e agudos sobem para aparecerem sobre a musica (o LOUD do Breno). */
const REFORCO = { clique: 2.5, voltar: 2.2, trocar: 2.2, bipe: 1.6, pouso: 1.6, decolou: 2, capsula: 1.5, ultrapassou: 1.8, estrela: 2,
  raspao: 2.5, esquiva: 2, trocatroca: 1.5, encolhedor: 1.6, emp: 1.4, bloqueado: 1.8, estouro: 1.3 };

// ---------------------------------------------------------------- motores (ver o cabecalho)
/** Timbre do motor por carro (ids de config/carros.js, fase 1). Quem nao esta aqui e 'motor'. */
const TIMBRE_DO_CARRO = { faisca: 'eletrico', voador: 'jato', jatinho: 'jato', tubarao: 'grave', picole: 'grave', kombosa: 'grave', vulcao: 'grave' };
/** Camadas de oscilador por timbre: [tipo, multiplo da fundamental, volume]. */
const CAMADAS = {
  motor: [['sawtooth', 1, 0.5], ['square', 0.5, 0.35], ['sawtooth', 1.51, 0.16]],
  grave: [['sawtooth', 1, 0.55], ['square', 0.5, 0.45], ['triangle', 2.02, 0.12]],
  eletrico: [['sawtooth', 1, 0.35], ['triangle', 2, 0.4], ['sine', 3.03, 0.22]],
  jato: [['sine', 1, 0.4], ['triangle', 1.5, 0.25]],
};
// os carros do Cidade Aberta de 30/10/2026 trazem o timbre na config (cfg.timbre: o Prius zune como o Faisca, Pro Stock e Furgao roncam grave)
export function timbreDoCarro(cfg) { return (cfg && (cfg.timbre || TIMBRE_DO_CARRO[cfg.id])) || 'motor'; }

/** Uma voz de motor continua (jogador). Nada e criado por quadro: `atualiza` so mexe em AudioParam. */
class VozDeMotor {
  constructor(ctx, destino, timbre) {
    this.ctx = ctx; this.timbre = timbre;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 1.4;
    g.gain.value = 0;
    f.connect(g); g.connect(destino);
    this.f = f; this.g = g; this.osc = [];
    for (const [tipo, mult, vol] of CAMADAS[timbre] || CAMADAS.motor) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = tipo; o.frequency.value = 60; og.gain.value = vol;
      o.connect(og); og.connect(f); o.start();
      this.osc.push({ o, og, mult });
    }
    if (timbre === 'jato') { // turbina: ar passando por baixo do assobio
      const s = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
      s.buffer = bufferDeRuido(ctx); s.loop = true; nf.type = 'bandpass'; nf.Q.value = 0.8; nf.frequency.value = 500; ng.gain.value = 0.6;
      s.connect(nf); nf.connect(ng); ng.connect(f); s.start();
      this.ar = { s, nf, ng };
    }
    this.freq = 0;
  }

  /** Recalcula o giro pela velocidade do carro. */
  atualiza(carro, t) {
    const v = carro.velocidade || 0, acel = carro.controle ? carro.controle.acel || 0 : 0;
    const turbo = !!(carro.turbo && carro.turbo.ativo), noAr = carro.noChao === false;
    const r = limita(v / VEL_REF, 0, 1.25);
    let base, corte, ganho;
    if (this.timbre === 'eletrico') { // sem marcha: o zumbido do inversor sobe reto com a velocidade (o Cobra Jet EV do Cidade Aberta)
      base = 70 + r * 900 + (turbo ? 120 : 0);
      corte = 600 + base * 2.2;
      ganho = 0.03 + acel * 0.05 + r * 0.04;
    } else if (this.timbre === 'jato') {
      base = 260 + r * 1100 + (turbo ? 260 : 0);
      corte = 1200 + r * 3000;
      ganho = 0.035 + acel * 0.04 + r * 0.03;
      if (this.ar) this.ar.nf.frequency.setTargetAtTime(400 + r * 1600, t, 0.1);
    } else {
      let m = 0;
      while (m < MARCHAS.length - 1 && r > MARCHAS[m + 1]) m++;
      const lo = MARCHAS[m], hi = m + 1 < MARCHAS.length ? MARCHAS[m + 1] : 1.25;
      let rpm = 0.25 + 0.75 * limita((r - lo) / Math.max(0.05, hi - lo), 0, 1);
      if (noAr) rpm = Math.min(1.1, rpm + 0.25); // roda solta no ar: o motor sobe (desenho animado)
      if (turbo) rpm = Math.min(1.15, rpm * 1.08 + 0.05);
      const grave = this.timbre === 'grave';
      base = (grave ? 34 : 46) + rpm * (grave ? 70 : 105) + m * 5;
      corte = 420 + rpm * 1600 + acel * 700 + (turbo ? 900 : 0);
      ganho = 0.05 + acel * 0.06 + rpm * 0.035 + (turbo ? 0.03 : 0);
    }
    this.freq = base;
    for (const c of this.osc) c.o.frequency.setTargetAtTime(base * c.mult, t, 0.05);
    this.f.frequency.setTargetAtTime(corte, t, 0.08);
    this.g.gain.setTargetAtTime(ganho, t, 0.1);
  }

  silencia(t) { this.g.gain.setTargetAtTime(0, t, 0.08); }

  para() {
    const t = this.ctx.currentTime;
    this.g.gain.setTargetAtTime(0, t, 0.04);
    const fontes = this.osc.map((c) => c.o).concat(this.ar ? [this.ar.s] : []);
    for (const s of fontes) { try { s.stop(t + 0.3); } catch (e) { /* ja parou */ } }
    setTimeout(() => { try { this.g.disconnect(); } catch (e) { /* ja desligado */ } }, 400);
  }
}

/** Motor leve de um rival: duas camadas, panorama e ganho pela distancia. */
class VozDeRival {
  constructor(ctx, destino) {
    this.ctx = ctx;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 800; g.gain.value = 0;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    f.connect(g);
    if (this.pan) { g.connect(this.pan); this.pan.connect(destino); } else g.connect(destino);
    this.f = f; this.g = g; this.osc = [];
    for (const [tipo, mult, vol] of [['sawtooth', 1, 0.5], ['square', 0.5, 0.3]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = tipo; o.frequency.value = 60; og.gain.value = vol;
      o.connect(og); og.connect(f); o.start();
      this.osc.push({ o, mult });
    }
  }
  atualiza(carro, ganho, pan, t) {
    if (!carro || ganho < 0.002) { this.g.gain.setTargetAtTime(0, t, 0.15); return; }
    const r = limita((carro.velocidade || 0) / VEL_REF, 0, 1.25);
    const base = 48 + r * 115 + (carro.indice || 0) * 3; // indice: dois rivais iguais nao entram em fase
    for (const c of this.osc) c.o.frequency.setTargetAtTime(base * c.mult, t, 0.08);
    this.f.frequency.setTargetAtTime(500 + r * 1400, t, 0.1);
    this.g.gain.setTargetAtTime(ganho, t, 0.12);
    if (this.pan) this.pan.pan.setTargetAtTime(pan, t, 0.1);
  }
  silencia(t) { this.g.gain.setTargetAtTime(0, t, 0.1); }
}

// temporarios do posicional (nada alocado dentro do passo)
const _v = new THREE.Vector3(), _dir = new THREE.Vector3();
const _pos = { ganho: 0, pan: 0 };

export class Audio {
  /** `opcoes`: { mudo } sobrepoe o ?mudo=1; { ouve: false } nao liga os eventos (instancias de teste). */
  constructor(G, opcoes = {}) {
    this.G = G;
    this.mudo = opcoes.mudo !== undefined ? !!opcoes.mudo : !!(G.flags && G.flags.mudo);
    this.ctx = null;
    /** os nos do grafo, depois do desbloqueio: { geral, compressor, corte, musica, efeitos, motores } */
    this.no = null;
    const o = save.opcoes();
    this.volumes = { geral: 1, musica: limita(o.musica / 100, 0, 1), efeitos: limita(o.efeitos / 100, 0, 1) };
    /** contadores para as suites */
    this.tocados = 0;
    this.ultimo = null;
    this.desconhecidos = new Set();
    this._vozes = [];
    this._tocadores = [];
    this._querido = null;
    this._timer = 0;
    this._ultimaVez = new Map();
    this._motorCarro = null;
    this._motor = null;
    this._rivais = [];
    this._lacos = null;
    this._passos = 0;
    this._pausaDaCorrida = false;
    this._suspensoDeProposito = false;
    this._acordando = false;
    this._desligar = [];
    this._criaS = (c, saida, t) => sintetizador(c, saida, t);
    if (opcoes.ouve !== false) this._ouve();
  }

  /** Primeiro gesto: cria/retoma o AudioContext. Pode ser chamado a cada toque (barato). */
  desbloqueia() {
    if (this.mudo) return false;
    if (!this.ctx) {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return false;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { this.ctx = null; return false; }
      this._montaGrafo();
      // desbloqueio do iPhone: um buffer mudo tocado DENTRO do gesto
      try { const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0); } catch (e) { /* sem iOS */ }
      if (this._querido) this._trocaMusica(this._querido);
      if (this._motorCarro) this.motor(this._motorCarro);
    }
    this._acorda();
    return true;
  }

  /** Toca um efeito. o = { vol (multiplica), tom (multiplica a frequencia), pos (Vector3: posicional) }. Devolve true se tocou. */
  toca(nome, o = {}) {
    const def = EFEITOS[nome];
    if (!def) {
      if (!this.desconhecidos.has(nome)) { this.desconhecidos.add(nome); if (this.ctx) console.warn('[audio] som desconhecido: ' + nome); }
      return false;
    }
    const c = this.ctx;
    if (!c || c.state === 'closed') return false;
    // suspenso de proposito (aba escondida) nao empilha; suspenso porque ainda esta acordando (primeiro toque) deixa passar
    if (c.state !== 'running' && (this._suspensoDeProposito || !this._acordando)) return false;
    const agora = c.currentTime;
    const ult = this._ultimaVez.get(nome);
    if (ult !== undefined && agora - ult < REPETICAO_MINIMA) return false;
    let vol = (o.vol ?? 1) * (REFORCO[nome] || 1), pan = 0;
    if (o.pos) {
      const k = this._posicional(o.pos);
      if (k.ganho < 0.02) return false;
      vol *= k.ganho; pan = k.pan;
    }
    this._ultimaVez.set(nome, agora);
    this._vozes = this._vozes.filter((v) => v.fim > agora);
    while (this._vozes.length >= MAX_VOZES) { // rouba a voz mais antiga com um fade rapido
      const velha = this._vozes.shift();
      velha.g.gain.setTargetAtTime(0, agora, 0.01);
      for (const s of velha.fontes) { try { s.stop(agora + 0.05); } catch (e) { /* ja parou */ } }
    }
    const g = c.createGain();
    g.gain.value = vol;
    let p = null;
    if (pan && c.createStereoPanner) { p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.no.efeitos); }
    else g.connect(this.no.efeitos);
    const S = sintetizador(c, g, agora + 0.005, o.tom ?? 1);
    def(S, o);
    this._vozes.push({ g, fontes: S.fontes, fim: S.fim });
    setTimeout(() => { try { g.disconnect(); if (p) p.disconnect(); } catch (e) { /* ja desligado */ } }, (S.fim - agora) * 1000 + 250);
    this.tocados++;
    this.ultimo = nome;
    return true;
  }

  /** O carro cujo motor e o principal (o jogador); null cala. Chamado sozinho no `corrida:carregada`. */
  motor(carro) {
    this._motorCarro = carro || null;
    if (!this.ctx) return;
    const timbre = carro ? timbreDoCarro(carro.cfg) : null;
    if (this._motor && this._motor.timbre !== timbre) { this._motor.para(); this._motor = null; }
    if (carro && !this._motor) this._motor = new VozDeMotor(this.ctx, this.no.motores, timbre);
    if (!carro && this._motor) this._motor.silencia(this.ctx.currentTime);
  }

  /** Musica: nome de TEMAS ('menu', 'podio', 'praia'...), uma Pista/definicao (o tema sai de musica.temaDaPista) ou null (silencio).
   *  Devolve o nome do tema escolhido. */
  musica(tema) {
    let nome = null;
    if (tema) nome = typeof tema === 'string' && TEMAS[tema] ? tema : temaDaPista(tema);
    this._querido = nome;
    if (this.ctx) this._trocaMusica(nome);
    return nome;
  }

  /** Nome do tema que esta (ou vai ficar) tocando. */
  get temaAtual() { return this._querido; }

  /** Aba escondida (js/main.js). */
  suspende() {
    this._suspensoDeProposito = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  retoma() {
    this._suspensoDeProposito = false;
    this._acorda();
  }

  /** Volumes 0..1 (null/undefined mantem). A tela de opcoes grava 0..100 no save; aqui so aplica. */
  volume(geral, musica, efeitos) {
    if (geral != null) this.volumes.geral = limita(+geral, 0, 1);
    if (musica != null) this.volumes.musica = limita(+musica, 0, 1);
    if (efeitos != null) this.volumes.efeitos = limita(+efeitos, 0, 1);
    this._aplicaVolumes();
  }

  /** Um passo de simulacao: motores, sopro do turbo e chiado do drift. So mexe em AudioParam (nada alocado). */
  passo() {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !this.no) return;
    this._passos++;
    if (this._passos & 1) return; // 30 Hz bastam para alvo de AudioParam com constante de 50-100 ms
    const t = c.currentTime;
    const cr = this.G.corrida;
    const ativa = !!(cr && cr.estado !== 'carregando' && cr.estado !== 'terminou' && !cr.pausada);
    const j = ativa ? (this._motorCarro && cr.carros.includes(this._motorCarro) ? this._motorCarro : cr.jogador) : null;
    if (!j) {
      if (this._motor) this._motor.silencia(t);
      for (const r of this._rivais) r.silencia(t);
      this._lacos.turbo.g.gain.setTargetAtTime(0, t, 0.1);
      this._lacos.drift.g.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    if (!this._motor || this._motor.timbre !== timbreDoCarro(j.cfg)) this.motor(j);
    this._motor.atualiza(j, t);
    // turbo: o ar passando (fiuuu grave, regra do Cidade Aberta: o fino irrita)
    const r = limita((j.velocidade || 0) / VEL_REF, 0, 1.25);
    const turbo = !!(j.turbo && j.turbo.ativo);
    this._lacos.turbo.g.gain.setTargetAtTime(turbo ? 0.2 : 0, t, turbo ? 0.06 : 0.18);
    this._lacos.turbo.f.frequency.setTargetAtTime(600 + 1200 * r, t, 0.12);
    // drift: chiado de pneu (o evento liga; a velocidade dosa)
    const drift = this._driftLigado && j.noChao !== false && (j.velocidade || 0) > 5;
    this._lacos.drift.g.gain.setTargetAtTime(drift ? 0.05 + 0.06 * Math.min(1, r) : 0, t, 0.05);
    // rivais: a cada 4 passos, os 2 mais perto
    if ((this._passos & 3) === 0) this._atualizaRivais(cr, j, t);
  }

  /** Para tudo e fecha o contexto (as suites de audio usam; o jogo nunca fecha). */
  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    if (this._timer) clearTimeout(this._timer);
    this._timer = 0;
    const c = this.ctx;
    this.ctx = null;
    if (c) c.close().catch(() => {});
  }

  // ------------------------------------------------------------ interno
  _acorda() {
    const c = this.ctx;
    if (!c || c.state === 'running' || c.state === 'closed' || this._suspensoDeProposito) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this._acordando = true;
    c.resume().then(() => { this._acordando = false; }).catch(() => { this._acordando = false; });
  }

  _montaGrafo() {
    const c = this.ctx;
    // musica/efeitos -> geral -> compressor (o limitador do Breno) -> corte -> saida
    const geral = c.createGain(), compressor = c.createDynamicsCompressor(), corte = c.createGain();
    compressor.threshold.value = -10; compressor.knee.value = 6; compressor.ratio.value = 12; compressor.attack.value = 0.003; compressor.release.value = 0.2;
    corte.gain.value = 0.8;
    geral.connect(compressor); compressor.connect(corte); corte.connect(c.destination);
    const musica = c.createGain(), efeitos = c.createGain(), motores = c.createGain();
    musica.connect(geral); efeitos.connect(geral); motores.connect(efeitos);
    motores.gain.value = MOTORES_VOL;
    this.no = { geral, compressor, corte, musica, efeitos, motores };
    this._aplicaVolumes(true);
    // lacos continuos: turbo e drift (ver o cabecalho)
    const laco = (tipo, freq, q) => {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = bufferDeRuido(c); s.loop = true; f.type = tipo; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(motores); s.start();
      return { s, f, g };
    };
    this._lacos = { turbo: laco('bandpass', 900, 1.2), drift: laco('bandpass', 1700, 3) };
    this._rivais = [new VozDeRival(c, motores), new VozDeRival(c, motores)];
  }

  _aplicaVolumes(ja = false) {
    if (!this.no) return;
    const t = this.ctx.currentTime, v = this.volumes;
    const alvo = (p, x) => { if (ja) p.value = x; else p.setTargetAtTime(x, t, 0.05); };
    alvo(this.no.geral.gain, v.geral);
    alvo(this.no.musica.gain, MUSICA_VOL * v.musica * (this._pausaDaCorrida ? PAUSA_ABAIXA : 1));
    alvo(this.no.efeitos.gain, EFEITOS_VOL * v.efeitos);
  }

  _posicional(pos) {
    const cam = this.G.camera;
    if (!cam || !this.G.corrida) { _pos.ganho = 1; _pos.pan = 0; return _pos; }
    _v.subVectors(pos, cam.position);
    const d = _v.length();
    const k = Math.max(0, 1 - d / ALCANCE);
    _pos.ganho = k * k;
    _dir.setFromMatrixColumn(cam.matrixWorld, 0);
    _pos.pan = d > 0.5 ? limita(_v.dot(_dir) / d, -0.8, 0.8) : 0;
    return _pos;
  }

  _atualizaRivais(cr, j, t) {
    let a = null, b = null, da = Infinity, db = Infinity;
    for (const r of cr.carros) {
      if (r === j || !r.pos) continue;
      const d = r.pos.distanceToSquared(j.pos);
      if (d < da) { b = a; db = da; a = r; da = d; } else if (d < db) { b = r; db = d; }
    }
    this._vozDeRival(this._rivais[0], a, da, t);
    this._vozDeRival(this._rivais[1], b, db, t);
  }

  _vozDeRival(v, carro, d2, t) {
    if (!carro) { v.silencia(t); return; }
    const k = Math.max(0, 1 - Math.sqrt(d2) / ALCANCE_DO_MOTOR);
    const p = this._posicional(carro.pos);
    v.atualiza(carro, k * k * 0.05, p.pan, t);
  }

  _trocaMusica(nome) {
    const c = this.ctx, agora = c.currentTime;
    const atual = this._tocadores.find((t) => t.ate === Infinity);
    if (atual && atual.nome === nome) return;
    if (atual) { // crossfade: o atual desce a partir de onde esta (mesmo no meio da subida) enquanto o novo sobe
      const g = atual.g.gain;
      g.cancelScheduledValues(agora);
      g.setValueAtTime(Math.max(g.value, 0.0001), agora);
      g.linearRampToValueAtTime(0.0001, agora + FADE_DA_MUSICA);
      atual.ate = agora + FADE_DA_MUSICA;
    }
    if (nome) this._tocadores.push(novoTocador(c, this.no.musica, nome, agora, FADE_DA_MUSICA));
    if (!this._timer) this._tique();
  }

  _tique() {
    this._timer = 0;
    const c = this.ctx;
    if (!c) return;
    const agora = c.currentTime;
    if (c.state === 'running') for (const t of this._tocadores) agenda(c, t, Math.min(agora + ANTECEDENCIA, t.ate), this._criaS);
    this._tocadores = this._tocadores.filter((t) => {
      if (t.ate > agora - 0.1) return true;
      try { t.g.disconnect(); t.f.disconnect(); } catch (e) { /* ja desligado */ }
      return false;
    });
    if (this._tocadores.length) this._timer = setTimeout(() => this._tique(), TIQUE_MS);
  }

  // ------------------------------------------------------------ eventos da secao 3 (docs/CONTRATOS.md)
  _ouve() {
    const d = this._desligar;
    const jog = (c) => !!(c && c.ehJogador);
    const ouve = (nome, fn) => d.push(on(nome, fn));
    ouve('corrida:carregada', (e) => { this._driftLigado = false; this._pausaDaCorrida = false; this._aplicaVolumes(); if (e.corrida) this.motor(e.corrida.jogador); });
    ouve('corrida:contagem', (e) => this.toca(e.n > 0 ? 'bipe' : 'largada'));
    ouve('corrida:volta', (e) => { if (jog(e.carro) && e.volta >= 2) this.toca('volta'); });
    ouve('corrida:ultima_volta', (e) => { if (jog(e.carro)) this.toca('ultima_volta'); });
    ouve('corrida:chegada', (e) => { if (jog(e.carro)) this.toca(e.posicao === 1 ? 'vitoria' : 'chegada'); });
    ouve('corrida:pausa', (e) => { this._pausaDaCorrida = !!e.pausada; this._aplicaVolumes(); });
    ouve('corrida:fim', () => { this._pausaDaCorrida = false; this._driftLigado = false; this._aplicaVolumes(); });
    ouve('carro:batida', (e) => {
      const f = e.forca || 0;
      const nome = f >= 12 ? 'batida_forte' : e.tipo === 'muro' && f < 5 ? 'raspao' : 'batida';
      const vol = limita(0.45 + f / 14, 0.45, 1.2);
      if (jog(e.carro) || jog(e.outro)) this.toca(nome, { vol });
      else if (e.carro && e.carro.pos) this.toca(nome, { vol: vol * 0.7, pos: e.carro.pos });
    });
    ouve('carro:pouso', (e) => { if (jog(e.carro) && (e.forca || 0) > 2) this.toca('pouso', { vol: limita(0.4 + (e.forca || 0) / 10, 0.4, 1.2) }); });
    ouve('carro:decolou', (e) => { if (jog(e.carro) && (e.forca || 0) > 3) this.toca('decolou'); });
    ouve('carro:queda', (e) => { if (jog(e.carro)) this.toca('queda'); });
    ouve('carro:volta_pista', (e) => { if (jog(e.carro)) this.toca('reaparece'); });
    ouve('carro:drift', (e) => { if (jog(e.carro)) this._driftLigado = !!e.ligado; });
    ouve('turbo:liga', (e) => { if (jog(e.carro)) this.toca('turbo'); });
    ouve('turbo:vazio', (e) => { if (jog(e.carro)) this.toca('turbo_vazio'); });
    ouve('capsula:pega', (e) => { if (jog(e.carro)) this.toca(e.dourada ? 'capsula_dourada' : 'capsula'); });
    ouve('poder:usa', (e) => {
      if (!e.poder || !EFEITOS[e.poder]) return;
      if (jog(e.carro)) this.toca(e.poder);
      else if (e.carro && e.carro.pos) this.toca(e.poder, { pos: e.carro.pos });
    });
    ouve('poder:acerta', (e) => {
      if (jog(e.alvo)) this.toca(e.poder === 'congelante' ? 'congelante' : 'acerto_ruim');
      else if (jog(e.de)) this.toca('acerto_bom');
    });
    ouve('poder:bloqueado', (e) => { if (jog(e.alvo) || jog(e.de)) this.toca('escudo_bloqueia'); });
    ouve('poder:esquivou', (e) => { if (jog(e.alvo) || jog(e.de)) this.toca('esquiva'); });
    ouve('poder:fim', (e) => { if (jog(e.alvo) && e.poder === 'congelante') this.toca('gelo_quebra'); });
  }
}

// ---------------------------------------------------------------- so para os testes: renderiza num OfflineAudioContext
/** Renderiza um efeito ('efeito', nome) ou um tema ('musica', nome) pela mesma cadeia de saida e devolve { pico, rms }. */
export async function renderizaOffline(tipo, nome, seg = 2) {
  const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
  if (!OAC) return null;
  const sr = 44100, oc = new OAC(1, Math.ceil(sr * seg), sr);
  const geral = oc.createGain(), compressor = oc.createDynamicsCompressor(), corte = oc.createGain();
  compressor.threshold.value = -10; compressor.knee.value = 6; compressor.ratio.value = 12; compressor.attack.value = 0.003; compressor.release.value = 0.2;
  corte.gain.value = 0.8;
  geral.connect(compressor); compressor.connect(corte); corte.connect(oc.destination);
  const musica = oc.createGain(), efeitos = oc.createGain();
  musica.gain.value = MUSICA_VOL; efeitos.gain.value = EFEITOS_VOL;
  musica.connect(geral); efeitos.connect(geral);
  if (tipo === 'efeito') {
    const g = oc.createGain(); g.gain.value = REFORCO[nome] || 1; g.connect(efeitos);
    EFEITOS[nome](sintetizador(oc, g, 0.005), {});
  } else {
    const t = novoTocador(oc, musica, nome, 0, 0.05);
    agenda(oc, t, seg, (c, saida, tt) => sintetizador(c, saida, tt));
  }
  const d = (await oc.startRendering()).getChannelData(0);
  let pico = 0, soma = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pico) pico = a; soma += d[i] * d[i]; }
  return { pico, rms: Math.sqrt(soma / d.length) };
}
