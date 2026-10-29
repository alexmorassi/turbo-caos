// O LACO DO JOGO (fase 1, fundacao). Monta o renderer, a cena, os sistemas e roda o jogo num PASSO FIXO DE 1/60 s com acumulador —
// o mesmo desenho do js/main.js do dinotrails-web. O contrato esta em docs/CONTRATOS.md secao 1.
//
// POR QUE PASSO FIXO (pedido: "fisica de arcade feita a mao, com passo fixo de 1/60 s para os testes serem deterministicos"):
//   1. o salto da rampa, o loop e o turbo sao medidos em metros e segundos: integrar com o dt do quadro mudaria o salto com a
//      velocidade do celular — a crianca do celular lento pularia menos;
//   2. com `?teste=` o requestAnimationFrame NAO chama `passo`: o harness chama `G.passo(1/60)` quantas vezes quiser, e uma corrida
//      inteira de 3 voltas roda em segundos, igual em qualquer maquina.
// Teto de 4 passos por quadro de tela: numa engasgada de 1 s, simular 60 passos de uma vez congelaria mais (espiral da morte). O jogo
// perde tempo de simulacao em vez de travar.
//
// A ORDEM DO PASSO e: entrada -> corrida (controles, poderes, turbo, fisica, colisoes, capsulas, regras, camera) -> telas -> hud ->
// audio. O audio por ultimo porque o ouvinte e a camera, e a camera so sabe onde ficar depois da fisica.
import * as THREE from 'three';
import { iniciaGLB, carregaGLB } from './glb.js';
import { Sorteio } from './sorteio.js';
import { Jogo } from './jogo.js';
import { Entrada } from './entrada.js';
import { Telas } from './telas.js';
import { HUD } from './hud.js';
import { Audio } from './audio.js';
import { Vibracao } from './vibracao.js';
import { Qualidade } from './qualidade.js';
import * as save from './save.js';

/** Passo fixo da simulacao. */
export const PASSO = 1 / 60;
/** Teto de passos por quadro de tela (ver o cabecalho). */
const MAX_PASSOS = 4;

// ---------------------------------------------------------------- flags de URL (docs/CONTRATOS.md secao 11)
const busca = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k) => (busca.get(k) !== null && busca.get(k) !== '' ? Number(busca.get(k)) : null);
export const FLAGS = {
  teste: busca.get('teste'),
  pista: busca.get('pista'),
  carro: busca.get('carro'),
  auto: busca.get('auto') === '1',
  corredores: num('corredores'),
  voltas: num('voltas'),
  qualidade: busca.get('qualidade'),
  semente: num('semente'),
  mudo: busca.get('mudo') === '1',
  foto: busca.get('foto') === '1',
};

// ---------------------------------------------------------------- sorteio reprodutivel em teste/foto
// O mesmo do dinotrails-web: com ?teste=/?foto=/?semente= o Math.random vira um mulberry32 de semente fixa (o three.js e a
// decoracao do cenario tambem sorteiam; a jogabilidade usa G.sorteio, que e semeado igual).
const SEMENTE = FLAGS.semente ?? ((FLAGS.teste || FLAGS.foto) ? 20261029 : ((Date.now() ^ 0x5bd1e995) >>> 0));
if (FLAGS.teste || FLAGS.foto || FLAGS.semente !== null) {
  const s = new Sorteio(SEMENTE ^ 0x9e3779b9);
  Math.random = () => s.num();
}

// ---------------------------------------------------------------- tela de carga (o DOM vem do index.html / TurboCaos.html)
function progresso(fracao, texto) {
  const b = document.getElementById('carga-barra'), t = document.getElementById('carga-texto');
  // no HTML unico os primeiros 85% da barra foram o download (tools/monta.js); o boot anda o resto
  const base = window.__embutido ? 0.85 : 0;
  if (b) b.style.width = Math.round((base + (1 - base) * Math.max(0, Math.min(1, fracao))) * 100) + '%';
  if (t && texto) t.textContent = texto;
}
function erroFatal(msg) {
  window.__erro = msg;
  const t = document.getElementById('carga-texto');
  if (t) t.textContent = msg;
  const c = document.getElementById('carregando');
  if (c) c.classList.add('erro');
}

// ---------------------------------------------------------------- renderer
function criaRenderer() {
  const canvas = document.getElementById('tela3d');
  // three r170 so tem WebGL2 (o WebGL1 saiu no r163). Todo Chrome de Android e Safari de iOS 15+ tem WebGL2; sem ele, a mensagem
  // explica em vez de tela preta (decisao registrada em docs/PENDENCIAS.md).
  const teste = document.createElement('canvas').getContext('webgl2');
  if (!teste) throw new Error('Seu navegador não tem WebGL2. Atualize o Chrome ou o Safari para jogar.');
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.setClearColor(0x0b1630, 1);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    erroFatal('A tela 3D parou. Toque aqui para recarregar o jogo.');
    const c = document.getElementById('carregando');
    if (c) { c.style.display = 'flex'; c.onclick = () => location.reload(); }
  });
  return r;
}

// ---------------------------------------------------------------- tamanho da tela
// O devicePixelRatio muda sem o innerWidth mudar (girar o celular, zoom do navegador): olha os dois (armadilha do dinotrails-web).
let ultimo = '';
function ajusta(G) {
  const w = window.innerWidth, h = window.innerHeight;
  const teto = (G.qualidade && G.qualidade.p && G.qualidade.p.pixelRatio) || 1.5;
  const pr = Math.min(window.devicePixelRatio || 1, teto);
  const chave = w + 'x' + h + '@' + pr;
  if (chave === ultimo) return;
  ultimo = chave;
  G.renderer.setPixelRatio(pr);
  G.renderer.setSize(w, h, false);
  for (const cam of [G.camera, G.desenho && G.desenho.camera]) {
    if (cam && cam.isPerspectiveCamera) { cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
  }
}

// ---------------------------------------------------------------- boot
async function boot() {
  progresso(0.05, 'Ligando os motores…');
  const G = {
    PASSO, flags: FLAGS, relogio: { t: 0, quadros: 0 },
    sorteio: new Sorteio(SEMENTE),
    corrida: null, desenho: null,
    carregaGLB,
  };
  window.G = G;
  G.renderer = criaRenderer();
  G.cena = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(65, window.innerWidth / Math.max(1, window.innerHeight), 0.3, 2500);
  iniciaGLB(G.renderer);

  G.save = save;
  G.qualidade = new Qualidade(G);
  if (FLAGS.qualidade) G.qualidade.define(FLAGS.qualidade, false);
  G.vibracao = new Vibracao(G);
  G.audio = new Audio(G);
  G.entrada = new Entrada(G);
  G.hud = new HUD(G);
  G.jogo = new Jogo(G);
  G.telas = new Telas(G);
  ajusta(G);
  window.addEventListener('resize', () => ajusta(G));

  G.passo = (dt) => {
    G.entrada.passo(dt);
    if (G.corrida) G.corrida.passo(dt);
    G.telas.passo(dt);
    G.hud.passo(dt);
    G.audio.passo(dt);
    G.relogio.t += dt;
    G.relogio.quadros++;
  };
  G.quadro = (dtReal) => {
    ajusta(G);
    if (G.corrida) G.corrida.quadro(dtReal);
    G.telas.quadro(dtReal);
    const d = G.desenho;
    if (d && d.cena && d.camera) G.renderer.render(d.cena, d.camera);
    else G.renderer.clear();
  };

  // aba escondida: o rAF congela a simulacao de graca, mas o AudioContext continua tocando (armadilha do dinotrails-web)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      G.audio.suspende();
      G.entrada.esqueceTudo();
      if (G.corrida && G.corrida.estado === 'correndo' && !FLAGS.teste) G.corrida.pausa(true);
    } else { G.audio.retoma(); acumulador = 0; antes = performance.now(); }
  });
  window.addEventListener('blur', () => G.entrada.esqueceTudo());

  progresso(0.3, 'Preparando a garagem…');
  await G.telas.inicia(progresso);
  progresso(1, 'Pronto!');
  window.__pronto = true;

  if (FLAGS.teste) {
    // a suite manda no tempo: importa e deixa ela rodar (o laco so desenha)
    // caminho numa VARIAVEL: com texto + concatenacao o esbuild (tools/monta.js) tenta empacotar todo arquivo que casa com o padrao
    const caminho = ['..', 'testes', 'teste_' + FLAGS.teste.replace(/[^a-z0-9_]/gi, '') + '.js'].join('/');
    import(caminho).catch((e) => {
      console.error('[ERRO] ' + FLAGS.teste + ': nao importou — ' + e);
      window.__resultado = { suite: FLAGS.teste, falhas: 1, linhas: ['[ERRO] ' + FLAGS.teste + ': nao importou — ' + e] };
    });
  } else if (FLAGS.pista) {
    G.telas.mostra('corrida_direta', { pista: FLAGS.pista, carro: FLAGS.carro });
  } else {
    G.telas.mostra('menu');
  }
  return G;
}

// ---------------------------------------------------------------- o laco
let acumulador = 0, antes = 0, passosDesdeDesenho = 0;
function laco(agora) {
  requestAnimationFrame(laco);
  const G = window.G;
  if (!G || !window.__pronto) return;
  let dt = (agora - antes) / 1000;
  antes = agora;
  if (!(dt > 0)) return;
  if (dt > 0.25) dt = 0.25;
  G.qualidade.mede(dt);
  if (!FLAGS.teste) {
    acumulador += dt;
    let n = 0;
    while (acumulador >= PASSO && n < MAX_PASSOS) { G.passo(PASSO); acumulador -= PASSO; n++; passosDesdeDesenho++; }
    if (n === MAX_PASSOS) acumulador = 0;
    // sem passo novo nao ha imagem nova (tela de 120 Hz): nao desenha o mesmo quadro duas vezes
    if (passosDesdeDesenho === 0) return;
    // modo 30 fps (celular fraco, qualidade.js): um desenho a cada 2 passos
    if (G.qualidade.limiteFps === 30 && passosDesdeDesenho < 2) return;
  }
  passosDesdeDesenho = 0;
  G.quadro(dt);
}

boot().then(() => { antes = performance.now(); requestAnimationFrame(laco); })
  .catch((e) => { console.error(e); erroFatal(String((e && e.message) || e)); });
