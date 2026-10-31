// EFEITOS VISUAIS DA FASE 4 (turbo, capsulas e os 10 poderes): POOLS FIXOS criados uma vez por corrida, UMA MALHA POR TIPO, nada criado
// depois da largada. E so desenho: nenhum numero de jogabilidade mora aqui e nada aqui mexe na simulacao — os sistemas (js/turbo.js,
// js/capsulas.js, js/poderes.js) dizem ONDE cada efeito esta e o `quadro(dt)` (tempo real de tela) anima.
//
// POR QUE ASSIM (o padrao do Breno, js/core.js Particles, e da fase 2, js/visual_carro.js):
//   * celular: cada malha e uma chamada de desenho. Com uma malha por TIPO (todas as pocas de oleo numa geometria, todos os aneis num
//     InstancedMesh, todas as faiscas num Points) a corrida cheia de poderes custa ~12 chamadas a mais, e a corrida calma ~4;
//   * pool fixo: soltar faisca no passo so escreve em Float32Array; sem `new` no passo, sem lixo para o coletor engasgar o celular;
//   * malha sem ninguem ativo fica invisivel (nao desenha);
//   * texturas de canvas (o HTML unico nao tem arquivo de imagem);
//   * os efeitos ADITIVOS somem na neblina pelo alfa (a neblina normal "misturaria a cor da neblina" e um brilho longe viraria uma mancha
//     da cor do ceu somada na tela);
//   * gerador aleatorio PROPRIO (nunca G.sorteio nem Math.random: desenhar mais ou menos quadros nao pode mudar a corrida, e o
//     Math.random e semeado nas suites e compartilhado com o three.js);
//   * `G.qualidade.p.particulas` (0,4 / 0,7 / 1) escala quantas particulas cada efeito solta;
//   * COR: os numeros de cor dos sistemas sao sRGB (o que se escolhe olhando) e o vertice converte para linear (pow 2,2); os efeitos NAO
//     passam pelo tonemap ACES (toneMapped: false). Sem isso (primeira versao) o azul do EMP saia branco-azulado desbotado e a cortina
//     sumia no fundo claro: o ACES dessatura cor forte e a saida sRGB clareava um valor que ja era sRGB;
//   * o que e COR (anel, bolha, tornado, feixe, pingo, fumaca) e mistura normal (vidro colorido); so o que e LUZ (faisca, halo, chama) e
//     aditivo — aditivo em pista de dia (ceu e asfalto claros) estoura para branco e cor escura (oleo) nem aparece.
// Um Efeitos por corrida (efeitosDaCorrida, com contagem de donos): o turbo, as capsulas e os poderes usam o mesmo.
import * as THREE from 'three';

// ---------------------------------------------------------------- tamanhos dos pools (aparencia: nao e jogabilidade)
const N_FAISCAS = 480;        // Points ADITIVOS (o que e luz: faisca, fogo do turbo, eletricidade, brilho da dourada)
const N_PINGOS = 480;         // Points de mistura NORMAL (o que e coisa colorida: gota de oleo, caco de gelo, folha, pedra, confete
                              // roxo/rosa/dourado). Aditivo de dia estoura para branco e cor escura (oleo) nem aparece
const N_BRILHOS = 384;        // billboards aditivos (halo das capsulas, clarao, nuvem de brilho)
const N_NUVENS = 224;         // billboards normais (fumaca colorida, poeira do terremoto)
const N_ANEIS = 20;           // cortinas em anel (EMP e Encolhedor usam 2: a borda e a onda; Terremoto 2, Ima 2, mira do Troca-Troca 1)
const N_BOLHAS = 10;          // escudo
const N_GELOS = 8;            // bloco de gelo
const N_FUNIS = 6;            // tornado
const N_CHAMAS = 48;          // 2 por carro do turbo (8 carros) + a lingua de fogo de cada cano dos que estouram (js/pipoco.js: ate 4 canos)
const N_FEIXES = 6;           // raio congelante, feixe do Troca-Troca
const SEG_FEIXE = 24;         // segmentos de cada feixe (segue a curva da pista)
const N_MANCHAS = 10;         // pocas de oleo
const N_CIRCULOS = 10;        // circulos pintados no asfalto (EMP, Encolhedor, Terremoto, Ima): a borda do raio que a crianca ve
const SEG_S_CIRCULO = 24, SEG_D_CIRCULO = 6; // grade do circulo: 24 ao longo da pista, 6 atravessada (segue curva e subida)
const GRADE_MANCHA = 7;       // 7 x 7 vertices por poca (colada na pista, ate em curva inclinada)

// ---------------------------------------------------------------- gerador do visual
let _semente = 0x1b873593;
/** [0, 1) do visual (LCG). */
export function aleatorio() { _semente = (Math.imul(_semente, 1664525) + 1013904223) >>> 0; return _semente / 4294967296; }
const entre = (a, b) => a + (b - a) * aleatorio();

// ---------------------------------------------------------------- texturas de canvas
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function textura(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/** Brilho redondo macio (halo). */
function texturaBrilho() {
  const c = canvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return textura(c);
}
/** Bolinha macia e cheia (os pingos coloridos). */
function texturaBolinha() {
  const c = canvas(32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return textura(c);
}
/** Faisca: brilho + estrela de 4 pontas (o sparkTex do Breno). */
function texturaFaisca() {
  const c = canvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath();
  g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36); g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28);
  g.closePath(); g.fill();
  return textura(c);
}
/** Bolota de fumaca: varios circulos macios sobrepostos (a borda irregular e o que faz parecer nuvem e nao bola). */
function texturaFumaca() {
  const c = canvas(128), g = c.getContext('2d');
  for (let k = 0; k < 14; k++) {
    const a = aleatorio() * Math.PI * 2, r = k === 0 ? 0 : 14 + aleatorio() * 22, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, R = k === 0 ? 46 : 22 + aleatorio() * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  // aperta tudo dentro do circulo (sem quina de quadrado na tela)
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(64, 64, 30, 64, 64, 64); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 128, 128);
  return textura(c);
}
/** O circulo do asfalto: anel cheio na borda, um anel fino mais para dentro e um veu leve no meio (branco: a cor vem do vertice). */
function texturaCirculo() {
  const c = canvas(256), g = c.getContext('2d'), m = 128;
  const anel = (r, l, a) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = l; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); };
  const gr = g.createRadialGradient(m, m, 0, m, m, 124);
  gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0.55)');
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, 124, 0, Math.PI * 2); g.fill();
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  // a borda GROSSA (de longe, no asfalto, a camera ve o chao de raspao: linha fina some)
  anel(112, 24, 1); anel(90, 6, 0.75);
  return textura(c);
}
/** A mancha de oleo: preta-arroxeada brilhante, borda irregular e o "arco-iris" do oleo no asfalto. */
function texturaOleo() {
  const c = canvas(256), g = c.getContext('2d');
  g.translate(128, 128);
  // corpo: circulos escuros com borda macia (shadowBlur: o ctx.filter nao existe no Safari)
  g.shadowColor = 'rgba(10,4,20,0.9)'; g.shadowBlur = 18;
  g.fillStyle = '#120a1e';
  g.beginPath(); g.arc(0, 0, 78, 0, Math.PI * 2); g.fill();
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + aleatorio() * 0.5, r = 62 + aleatorio() * 22; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 22 + aleatorio() * 16, 0, Math.PI * 2); g.fill(); }
  g.shadowBlur = 0;
  // brilho de oleo: arcos coloridos finos (roxo, azul, rosa, verde) e manchas de luz
  const cores = ['rgba(150,80,255,0.55)', 'rgba(60,190,255,0.5)', 'rgba(255,80,200,0.45)', 'rgba(110,255,170,0.35)'];
  g.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    g.strokeStyle = cores[k % cores.length]; g.lineWidth = 4 + aleatorio() * 6;
    const r = 18 + aleatorio() * 60, a0 = aleatorio() * Math.PI * 2;
    g.beginPath(); g.arc(entre(-12, 12), entre(-12, 12), r, a0, a0 + 0.8 + aleatorio() * 1.6); g.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const x = entre(-50, 50), y = entre(-50, 50), R = 6 + aleatorio() * 12, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  return textura(c);
}

// ---------------------------------------------------------------- shaders
/** Neblina dos efeitos ADITIVOS: some pelo alfa (ver o cabecalho). */
const NEBLINA_PELO_ALFA = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.a *= 1.0 - fogF;
#endif`;
const FIM_DE_COR = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

/** Vertice comum dos InstancedMesh de efeito: aCor (rgba) por instancia; normal e direcao do olho para o fresnel. */
const VERT_INSTANCIADO = `
attribute vec4 aCor;
varying vec4 vCor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
#include <fog_pars_vertex>
void main() {
  vCor = vec4(pow(aCor.rgb, vec3(2.2)), aCor.a); vUv = uv;
  vec4 p = vec4(position, 1.0); vec3 nn = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p; nn = mat3(instanceMatrix) * normal;
  #endif
  vec4 mvPosition = modelViewMatrix * p;
  vN = normalize(normalMatrix * nn); vV = normalize(-mvPosition.xyz);
  gl_Position = aCor.a <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/** Fragmentos por tipo. uTempo = relogio do visual (s). ATENCAO: smoothstep(a, b, x) com a >= b e INDEFINIDO em GLSL (no SwiftShader
 *  da NaN e a malha some sem erro nenhum — custou o anel do EMP invisivel): para "cai de 1 a 0" use 1.0 - smoothstep(a, b, x). */
const FRAG = {
  // cortina em anel (vidro colorido, mistura normal): faixa forte embaixo (o "circulo no chao"), some para cima, listras correndo
  aro: `float base = 1.0 - smoothstep(0.0, 0.2, vUv.y);
    float sobe = pow(1.0 - vUv.y, 0.9);
    float listra = 0.7 + 0.3 * sin(vUv.x * 120.0 - uTempo * 6.0);
    // de DENTRO do anel (o caso de quem usou e de quem esta no raio) so uma camada da cortina aparece: o alfa tem de valer sozinho
    float a = vCor.a * clamp(0.85 * sobe * listra + 0.5 * base, 0.0, 0.95);
    gl_FragColor = vec4(mix(vCor.rgb, vec3(1.0), base * base * 0.35), a);`,
  // bolha (vidro colorido): quase transparente no meio, borda forte (fresnel) e faixas lentas
  bolha: `float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float faixa = 0.05 * sin(vUv.y * 40.0 + uTempo * 2.5);
    float a = vCor.a * clamp(0.12 + 0.8 * f + faixa, 0.0, 0.92);
    gl_FragColor = vec4(mix(vCor.rgb, vec3(1.0), f * 0.25), a);`,
  // funil do tornado (mistura normal): listras em diagonal girando, cor forte na listra e branco entre elas
  funil: `float s = fract(vUv.x * 3.0 + vUv.y * 1.4 - uTempo * 2.2);
    float faixa = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.55, 1.0, s));
    float borda = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
    float a = vCor.a * borda * (0.3 + 0.6 * faixa) * (0.55 + 0.45 * vUv.y);
    gl_FragColor = vec4(mix(vec3(0.95, 1.0, 0.95), vCor.rgb, 0.25 + 0.75 * faixa), a);`,
  // chama do escapamento: forte e amarela na BOCA (uv.y = 0), laranja e sumindo na ponta (uv.y = 1). Sem fresnel forte: a camera de
  // corrida ve o cone DE PONTA (por tras) e o fresnel o deixava transparente
  chama: `float f = abs(dot(normalize(vN), normalize(vV)));
    float ao_longo = vUv.y;
    float a = vCor.a * (1.0 - smoothstep(0.3, 1.0, ao_longo)) * (0.6 + 0.4 * f);
    vec3 miolo = vec3(1.0, 0.85, 0.4);
    gl_FragColor = vec4(mix(miolo, vCor.rgb, smoothstep(0.0, 0.6, ao_longo)), a);`,
  // bloco de gelo: azul-claro translucido, aresta branca (fresnel) — nao e aditivo, e "solido"
  gelo: `float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
    vec2 q = abs(vUv - 0.5) * 2.0; float aresta = smoothstep(0.82, 0.98, max(q.x, q.y));
    float a = vCor.a * clamp(0.42 + 0.45 * f + 0.5 * aresta, 0.0, 0.95);
    gl_FragColor = vec4(mix(vCor.rgb, vec3(1.0), clamp(f * 0.6 + aresta, 0.0, 1.0)), a);`,
};

function materialInstanciado(tipo, aditivo, extra = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTempo: { value: 0 } }]);
  const frag = `uniform float uTempo; varying vec4 vCor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
#include <fog_pars_fragment>
void main() { ${FRAG[tipo]}
  if (gl_FragColor.a < 0.004) discard;
  ${aditivo ? NEBLINA_PELO_ALFA : '\n#include <fog_fragment>\n'}
  ${FIM_DE_COR}
}`;
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT_INSTANCIADO, fragmentShader: frag, fog: true, toneMapped: false,
    transparent: true, depthWrite: false, side: extra.lado ?? THREE.DoubleSide,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// ---------------------------------------------------------------- matriz de uma base (sem quaternion: escreve os 16 numeros)
/** Matriz com colunas X*sx, Y*sy, Z*sz e a posicao `p`. */
export function matrizDaBase(m, p, X, Y, Z, sx, sy, sz) {
  const e = m.elements;
  e[0] = X.x * sx; e[1] = X.y * sx; e[2] = X.z * sx; e[3] = 0;
  e[4] = Y.x * sy; e[5] = Y.y * sy; e[6] = Y.z * sy; e[7] = 0;
  e[8] = Z.x * sz; e[9] = Z.y * sz; e[10] = Z.z * sz; e[11] = 0;
  e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1;
  return m;
}
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _l = new THREE.Vector3(), _c = new THREE.Vector3(), _tela = new THREE.Vector2();

// ---------------------------------------------------------------- pool de InstancedMesh com slots
class PoolInstanciado {
  constructor(nome, geo, mat, n) {
    this.n = n;
    this.cor = new Float32Array(n * 4);
    this.attCor = new THREE.InstancedBufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCor', this.attCor);
    this.malha = new THREE.InstancedMesh(geo, mat, n);
    this.malha.name = 'efeito:' + nome;
    this.malha.frustumCulled = false;
    this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.malha.setMatrixAt(i, _zero);
    this.malha.visible = false;
    this.malha.renderOrder = 6;
    this.usado = new Uint8Array(n);
    this.ativos = 0;
    this.mudou = true;
  }
  /** Um slot livre (ou -1 se cheio: o efeito acontece sem desenho, nunca quebra o jogo). */
  pega() { for (let i = 0; i < this.n; i++) if (!this.usado[i]) { this.usado[i] = 1; this.ativos++; this.mudou = true; return i; } return -1; }
  solta(i) {
    if (!(i >= 0) || !this.usado[i]) return;
    this.usado[i] = 0; this.ativos--; this.malha.setMatrixAt(i, _zero); this.cor[i * 4 + 3] = 0; this.mudou = true;
  }
  poe(i, m, r, g, b, a) {
    if (!(i >= 0)) return;
    this.malha.setMatrixAt(i, m);
    const o = i * 4; this.cor[o] = r; this.cor[o + 1] = g; this.cor[o + 2] = b; this.cor[o + 3] = a;
    this.mudou = true;
  }
  atualiza() {
    if (!this.mudou) return;
    this.mudou = false;
    // desenha so se algum slot esta ACESO (alfa > 0): slot pego e apagado (a chama do turbo desligado) nao paga chamada de desenho
    let aceso = false;
    for (let i = 0; i < this.n; i++) if (this.cor[i * 4 + 3] > 0) { aceso = true; break; }
    this.malha.visible = aceso;
    this.malha.instanceMatrix.needsUpdate = true;
    this.attCor.needsUpdate = true;
  }
  destroi() { this.malha.geometry.dispose(); this.malha.material.dispose(); this.malha.dispose(); }
}

// ---------------------------------------------------------------- particulas (Points)
const ATRIB_PONTOS = ['position', 'cor', 'tam', 'alfa'];
class Pontos {
  constructor(n, textura, aditivo = true, nome = 'faiscas') {
    this.n = n; this.prox = 0; this.vivas = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.corA = new Float32Array(n * 3);
    this.tamA = new Float32Array(n); this.alfaA = new Float32Array(n); this.vida = new Float32Array(n); this.max = new Float32Array(n);
    this.t0 = new Float32Array(n); this.t1 = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.arr = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(this.corA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tam', new THREE.BufferAttribute(this.tamA, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alfa', new THREE.BufferAttribute(this.alfaA, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapa: { value: textura }, escala: { value: 400 } }]),
      vertexShader: `attribute float tam; attribute float alfa; attribute vec3 cor; varying vec3 vCor; varying float vAlfa; uniform float escala;
#include <fog_pars_vertex>
void main() { vCor = pow(cor, vec3(2.2)); vAlfa = alfa; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = alfa > 0.0 ? tam * escala / max(0.5, -mvPosition.z) : 0.0; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D mapa; varying vec3 vCor; varying float vAlfa;
#include <fog_pars_fragment>
void main() { vec4 t = texture2D(mapa, gl_PointCoord); float a = t.a * vAlfa; if (a < 0.01) discard; gl_FragColor = vec4(vCor * t.rgb, a);
  ${aditivo ? NEBLINA_PELO_ALFA : '\n#include <fog_fragment>\n'} ${FIM_DE_COR} }`,
      fog: true, toneMapped: false, transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malha = new THREE.Points(g, this.mat);
    this.malha.name = 'efeito:' + nome;
    this.malha.frustumCulled = false;
    this.malha.renderOrder = aditivo ? 7 : 5;
  }
  /** Uma particula: tamanho t0 -> t1 ao longo da vida, alfa a0 -> 0. Cor em 0..1 (pode passar de 1: aditivo). */
  solta(x, y, z, vx, vy, vz, r, g, b, t0, t1, a0, vida, grav, arrasto) {
    const i = this.prox; this.prox = (this.prox + 1) % this.n;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.corA[o] = r; this.corA[o + 1] = g; this.corA[o + 2] = b;
    this.t0[i] = t0; this.t1[i] = t1; this.a0[i] = a0; this.tamA[i] = t0; this.alfaA[i] = a0;
    this.vida[i] = this.max[i] = Math.max(0.05, vida); this.grav[i] = grav; this.arr[i] = arrasto;
    this.vivas = this.n;
  }
  atualiza(dt, G) {
    const cam = G.camera, r = G.renderer;
    if (cam && r) { r.getDrawingBufferSize(_tela); this.mat.uniforms.escala.value = _tela.y / (2 * Math.tan((cam.fov * Math.PI) / 360)); }
    if (this.vivas <= 0) { this.malha.visible = false; return; }
    this.malha.visible = true;
    let algum = false;
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) { if (this.alfaA[i] !== 0) { this.alfaA[i] = 0; algum = true; } continue; }
      algum = true;
      this.vida[i] -= dt;
      const u = Math.max(0, this.vida[i] / this.max[i]), o = i * 3, k = Math.exp(-this.arr[i] * dt);
      this.vel[o] *= k; this.vel[o + 2] *= k; this.vel[o + 1] = this.vel[o + 1] * k - this.grav[i] * dt;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      this.tamA[i] = this.t1[i] + (this.t0[i] - this.t1[i]) * u;
      this.alfaA[i] = this.vida[i] > 0 ? this.a0[i] * Math.min(1, u * 2.5) : 0;
    }
    if (!algum) { this.vivas = 0; this.malha.visible = false; return; }
    for (let k = 0; k < ATRIB_PONTOS.length; k++) this.geo.attributes[ATRIB_PONTOS[k]].needsUpdate = true;
  }
  destroi() { this.geo.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- billboards instanciados (quadrado virado para a camera)
// Points tem tamanho maximo de ponto (64-511 px conforme o celular): nuvem de fumaca de 9 m perto da camera passaria disso. Quadrado
// instanciado nao tem limite. Os slots do FIM sao reservados (halo das capsulas, bolotas das nuvens: o dono escreve a cada quadro); os
// do comeco sao um anel de particulas com vida (clarao, poeira).
const ATRIB_BB = ['aPos', 'aTam', 'aCor', 'aGiro'];
class Billboards {
  constructor(nome, n, textura, aditivo) {
    this.n = n; this.limite = n; this.prox = 0; this.vivas = 0; this.mudouReserva = false;
    this.pos = new Float32Array(n * 3); this.tam = new Float32Array(n); this.cor = new Float32Array(n * 4); this.giro = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.vida = new Float32Array(n); this.max = new Float32Array(n); this.t0 = new Float32Array(n);
    this.t1 = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.arr = new Float32Array(n); this.vg = new Float32Array(n);
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTam', new THREE.InstancedBufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCor', new THREE.InstancedBufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aGiro', new THREE.InstancedBufferAttribute(this.giro, 1).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = n;
    this.geo = g; this._base = base;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mapa: { value: textura } }]),
      vertexShader: `attribute vec3 aPos; attribute float aTam; attribute vec4 aCor; attribute float aGiro; varying vec2 vUv; varying vec4 vCor;
#include <fog_pars_vertex>
void main() { vUv = uv; vCor = vec4(pow(aCor.rgb, vec3(2.2)), aCor.a); vec4 mvPosition = modelViewMatrix * vec4(aPos, 1.0);
  float s = sin(aGiro), c = cos(aGiro); vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  mvPosition.xy += q * aTam;
  gl_Position = aCor.a <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D mapa; varying vec2 vUv; varying vec4 vCor;
#include <fog_pars_fragment>
void main() { vec4 t = texture2D(mapa, vUv); float a = t.a * vCor.a; if (a < 0.006) discard; gl_FragColor = vec4(vCor.rgb * t.rgb, a);
  ${aditivo ? NEBLINA_PELO_ALFA : '\n#include <fog_fragment>\n'} ${FIM_DE_COR} }`,
      fog: true, toneMapped: false, transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malha = new THREE.Mesh(g, this.mat);
    this.malha.name = 'efeito:' + nome;
    this.malha.frustumCulled = false;
    this.malha.renderOrder = aditivo ? 8 : 4;
    this.reservados = 0;
  }
  /** Reserva `k` slots fixos (do fim). Devolve o primeiro indice ou -1. Chame na montagem, nunca no passo. */
  reserva(k) {
    if (this.limite - k < 64) return -1;
    this.limite -= k; this.reservados += k;
    for (let i = this.limite; i < this.limite + k; i++) { this.vida[i] = 0; this.cor[i * 4 + 3] = 0; }
    if (this.prox >= this.limite) this.prox = 0;
    return this.limite;
  }
  /** Slot reservado: escreve onde e como esta neste quadro (a = 0 esconde). */
  poe(i, x, y, z, tam, r, g, b, a, giro = 0) {
    if (!(i >= 0)) return;
    const o = i * 3; this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.tam[i] = tam; this.giro[i] = giro;
    const c = i * 4; this.cor[c] = r; this.cor[c + 1] = g; this.cor[c + 2] = b; this.cor[c + 3] = a;
    this.mudouReserva = true;
  }
  /** Particula com vida (anel no comeco do pool). */
  solta(x, y, z, vx, vy, vz, r, g, b, a0, t0, t1, vida, grav, arrasto, giro, vgiro) {
    const i = this.prox; this.prox = (this.prox + 1) % this.limite;
    const o = i * 3; this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    const c = i * 4; this.cor[c] = r; this.cor[c + 1] = g; this.cor[c + 2] = b; this.cor[c + 3] = a0;
    this.a0[i] = a0; this.t0[i] = t0; this.t1[i] = t1; this.tam[i] = t0; this.vida[i] = this.max[i] = Math.max(0.05, vida);
    this.grav[i] = grav; this.arr[i] = arrasto; this.giro[i] = giro; this.vg[i] = vgiro;
    this.vivas = this.limite;
  }
  atualiza(dt) {
    let algum = this.mudouReserva;
    this.mudouReserva = false;
    if (this.vivas > 0) {
      let vivas = false;
      for (let i = 0; i < this.limite; i++) {
        if (this.vida[i] <= 0) { if (this.cor[i * 4 + 3] !== 0) { this.cor[i * 4 + 3] = 0; algum = true; } continue; }
        vivas = true; algum = true;
        this.vida[i] -= dt;
        const u = Math.max(0, this.vida[i] / this.max[i]), o = i * 3, k = Math.exp(-this.arr[i] * dt);
        this.vel[o] *= k; this.vel[o + 2] *= k; this.vel[o + 1] = this.vel[o + 1] * k - this.grav[i] * dt;
        this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
        this.tam[i] = this.t1[i] + (this.t0[i] - this.t1[i]) * u;
        this.giro[i] += this.vg[i] * dt;
        this.cor[i * 4 + 3] = this.vida[i] > 0 ? this.a0[i] * Math.min(1, u * 2.2) * Math.min(1, (1 - u) * 8 + 0.2) : 0;
      }
      if (!vivas) this.vivas = 0;
    }
    if (algum) for (let k = 0; k < ATRIB_BB.length; k++) this.geo.attributes[ATRIB_BB[k]].needsUpdate = true;
    this.malha.visible = this.vivas > 0 || this.reservados > 0;
  }
  destroi() { this.geo.dispose(); this._base.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- feixes (fita virada para a camera, seguindo a pista)
class Feixes {
  constructor(n, seg) {
    this.n = n; this.seg = seg; this.vpf = (seg + 1) * 2;
    const nv = n * this.vpf;
    this.posA = new Float32Array(nv * 3); this.corA = new Float32Array(nv * 4);
    const uv = new Float32Array(nv * 2), idx = [];
    for (let f = 0; f < n; f++) for (let k = 0; k <= seg; k++) {
      const v = f * this.vpf + k * 2;
      uv[v * 2] = k / seg; uv[v * 2 + 1] = 0; uv[(v + 1) * 2] = k / seg; uv[(v + 1) * 2 + 1] = 1;
      if (k < seg) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(this.corA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTempo: { value: 0 } }]),
      vertexShader: `attribute vec4 cor; varying vec4 vCor; varying vec2 vUv;
#include <fog_pars_vertex>
void main() { vCor = vec4(pow(cor.rgb, vec3(2.2)), cor.a); vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `uniform float uTempo; varying vec4 vCor; varying vec2 vUv;
#include <fog_pars_fragment>
void main() { float x = (vUv.y - 0.5) * 2.0; float miolo = exp(-x * x * 10.0); float halo = exp(-x * x * 2.4);
  float pulso = 0.82 + 0.18 * sin(vUv.x * 60.0 - uTempo * 30.0);
  float a = vCor.a * clamp(0.85 * halo + 0.5 * miolo, 0.0, 1.0) * pulso; if (a < 0.004) discard;
  gl_FragColor = vec4(mix(vCor.rgb, vec3(1.0), miolo * miolo * 0.4), a);
  #include <fog_fragment>
  ${FIM_DE_COR} }`,
      fog: true, toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
    });
    this.malha = new THREE.Mesh(g, this.mat);
    this.malha.name = 'efeito:feixes';
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 8;
    this.usado = new Uint8Array(n); this.ativos = 0;
    /** pontos de cada feixe (o dono escreve; seg + 1 por feixe) */
    this.pontos = [];
    for (let f = 0; f < n; f++) { const l = []; for (let k = 0; k <= seg; k++) l.push(new THREE.Vector3()); this.pontos.push(l); }
    this.largura = new Float32Array(n); this.cores = new Float32Array(n * 4); this.qtd = new Uint16Array(n);
  }
  pega() { for (let i = 0; i < this.n; i++) if (!this.usado[i]) { this.usado[i] = 1; this.ativos++; this.qtd[i] = 0; return i; } return -1; }
  solta(i) { if (!(i >= 0) || !this.usado[i]) return; this.usado[i] = 0; this.ativos--; this.cores[i * 4 + 3] = 0; }
  /** O dono escreveu `pontos[i][0..qtd-1]`; largura (m) e cor rgba. */
  define(i, qtd, largura, r, g, b, a) {
    if (!(i >= 0)) return;
    this.qtd[i] = Math.max(2, Math.min(this.seg + 1, qtd)); this.largura[i] = largura;
    const o = i * 4; this.cores[o] = r; this.cores[o + 1] = g; this.cores[o + 2] = b; this.cores[o + 3] = a;
  }
  atualiza(G, tempo) {
    this.mat.uniforms.uTempo.value = tempo;
    this.malha.visible = this.ativos > 0;
    if (!this.ativos) return;
    const olho = G.camera.position;
    for (let f = 0; f < this.n; f++) {
      const base = f * this.vpf, a = this.usado[f] ? this.cores[f * 4 + 3] : 0, q = this.qtd[f];
      if (!(a > 0) || q < 2) {
        // apagado (ou ainda sem pontos): colapsa a fita inteira num ponto, sem fragmento nenhum
        for (let v = base; v < base + this.vpf; v++) { this.posA[v * 3] = this.posA[v * 3 + 1] = this.posA[v * 3 + 2] = 0; this.corA[v * 4 + 3] = 0; }
        continue;
      }
      for (let k = 0; k <= this.seg; k++) {
        const v = base + k * 2;
        // feixe com menos pontos: o resto colapsa no ultimo (triangulos de area zero)
        const j = Math.min(k, Math.max(0, q - 1)), P = this.pontos[f][j];
        const A = this.pontos[f][Math.max(0, j - 1)], B = this.pontos[f][Math.min(q - 1, j + 1)];
        _t.subVectors(B, A); if (_t.lengthSq() < 1e-8) _t.set(0, 0, 1);
        _l.subVectors(olho, P); _c.crossVectors(_t, _l); if (_c.lengthSq() < 1e-8) _c.set(1, 0, 0);
        _c.normalize().multiplyScalar(this.largura[f] * 0.5);
        this.posA[v * 3] = P.x + _c.x; this.posA[v * 3 + 1] = P.y + _c.y; this.posA[v * 3 + 2] = P.z + _c.z;
        this.posA[(v + 1) * 3] = P.x - _c.x; this.posA[(v + 1) * 3 + 1] = P.y - _c.y; this.posA[(v + 1) * 3 + 2] = P.z - _c.z;
        // a ponta de tras um pouco mais fraca, a da frente cheia (com 0,35 atras o raio sumia justo onde a camera de tras o ve maior)
        const al = a * (0.7 + 0.3 * (k / this.seg));
        for (let vv = v; vv <= v + 1; vv++) { const o = vv * 4; this.corA[o] = this.cores[f * 4]; this.corA[o + 1] = this.cores[f * 4 + 1]; this.corA[o + 2] = this.cores[f * 4 + 2]; this.corA[o + 3] = al; }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.cor.needsUpdate = true;
  }
  destroi() { this.geo.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- manchas (decalque colado na pista)
class Manchas {
  constructor(n, grade, textura) {
    this.n = n; this.g = grade; this.vpm = grade * grade;
    const nv = n * this.vpm;
    this.posA = new Float32Array(nv * 3); this.corA = new Float32Array(nv * 4);
    const uv = new Float32Array(nv * 2), idx = [];
    for (let m = 0; m < n; m++) for (let a = 0; a < grade; a++) for (let b = 0; b < grade; b++) {
      const v = m * this.vpm + a * grade + b;
      uv[v * 2] = b / (grade - 1); uv[v * 2 + 1] = a / (grade - 1);
      if (a < grade - 1 && b < grade - 1) idx.push(v, v + grade, v + 1, v + 1, v + grade, v + grade + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.corA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.MeshBasicMaterial({ map: textura, vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.malha = new THREE.Mesh(g, this.mat);
    this.malha.name = 'efeito:manchas';
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 2;
    this.usado = new Uint8Array(n); this.ativos = 0;
  }
  pega() { for (let i = 0; i < this.n; i++) if (!this.usado[i]) { this.usado[i] = 1; this.ativos++; return i; } return -1; }
  solta(i) { if (!(i >= 0) || !this.usado[i]) return; this.usado[i] = 0; this.ativos--; this.alfa(i, 0); }
  /** Cola a mancha i na superficie `sup` em (s, d), raio r (m), girada `giro` rad (cada poca e diferente). */
  coloca(i, sup, s, d, r, giro) {
    if (!(i >= 0)) return;
    const G1 = this.g - 1, cg = Math.cos(giro), sg = Math.sin(giro);
    for (let a = 0; a < this.g; a++) for (let b = 0; b < this.g; b++) {
      const u = (b / G1) * 2 - 1, w = (a / G1) * 2 - 1;
      const du = (u * cg - w * sg) * r, dw = (u * sg + w * cg) * r;
      sup.ponto(s + du, d + dw, 0.05, _p);
      const v = (i * this.vpm + a * this.g + b) * 3;
      this.posA[v] = _p.x; this.posA[v + 1] = _p.y; this.posA[v + 2] = _p.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  alfa(i, a) {
    if (!(i >= 0)) return;
    const o = i * this.vpm * 4;
    for (let k = 0; k < this.vpm; k++) { this.corA[o + k * 4] = 1; this.corA[o + k * 4 + 1] = 1; this.corA[o + k * 4 + 2] = 1; this.corA[o + k * 4 + 3] = a; }
    this.geo.attributes.color.needsUpdate = true;
  }
  atualiza() { this.malha.visible = this.ativos > 0; }
  destroi() { this.geo.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- circulos (pintados no asfalto, seguindo a pista)
// O raio dos poderes de area (24 m do EMP, 90 m do Terremoto) visto DE DENTRO, pela camera de corrida, e so uma cortina fina e distante;
// pintado no chao ele vira "o circulo azul" do texto de esquiva. A grade e em (s, d) da pista em volta do dono: segue a curva, a
// subida e o loop, e fica so na largura da pista (alem dela o "chao" seria o plano da pista no ar).
class Circulos {
  constructor(n, segS, segD, textura) {
    this.n = n; this.gs = segS; this.gd = segD; this.vpc = (segS + 1) * (segD + 1);
    const nv = n * this.vpc;
    this.posA = new Float32Array(nv * 3); this.corA = new Float32Array(nv * 4); this.uvA = new Float32Array(nv * 2);
    const idx = [];
    for (let c = 0; c < n; c++) for (let a = 0; a < segS; a++) for (let b = 0; b < segD; b++) {
      const v = c * this.vpc + a * (segD + 1) + b;
      // a = ao longo da pista (T), b = atravessado (R): (T, R) e mao esquerda com o N para cima, entao o triangulo vai v -> v+1 -> v+linha
      // (na ordem contraria a normal aponta para BAIXO e o FrontSide descarta o circulo inteiro sem erro nenhum)
      idx.push(v, v + 1, v + segD + 1, v + 1, v + segD + 2, v + segD + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.corA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uvA, 2).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.MeshBasicMaterial({ map: textura, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.malha = new THREE.Mesh(g, this.mat);
    this.malha.name = 'efeito:circulos';
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 3;
    this.usado = new Uint8Array(n); this.ativos = 0; this.mudou = false;
  }
  pega() { for (let i = 0; i < this.n; i++) if (!this.usado[i]) { this.usado[i] = 1; this.ativos++; return i; } return -1; }
  solta(i) {
    if (!(i >= 0) || !this.usado[i]) return;
    this.usado[i] = 0; this.ativos--;
    for (let k = i * this.vpc; k < (i + 1) * this.vpc; k++) this.corA[k * 4 + 3] = 0;
    this.mudou = true;
  }
  /** Circulo de raio `r` (m) centrado em (s, d) da tira `sup`, cor sRGB e alfa. Chame a cada quadro (o dono anda). */
  poe(i, sup, s, d, r, cr, cg, cb, a) {
    if (!(i >= 0) || !(r > 0.2)) return;
    // a cor do vertice e linear para o MeshBasicMaterial: converte a sRGB escolhida
    const lr = Math.pow(cr, 2.2), lg = Math.pow(cg, 2.2), lb = Math.pow(cb, 2.2);
    for (let ia = 0; ia <= this.gs; ia++) {
      const ds = -r + (2 * r * ia) / this.gs;
      const ss = sup.fechada ? sup.normaliza(s + ds) : Math.max(0, Math.min(sup.comprimento, s + ds));
      const w = sup.larguraEm(ss) * 0.5 + 0.4;
      for (let ib = 0; ib <= this.gd; ib++) {
        const dd = -w + (2 * w * ib) / this.gd;
        sup.ponto(ss, dd, 0.06, _p);
        const v = i * this.vpc + ia * (this.gd + 1) + ib;
        this.posA[v * 3] = _p.x; this.posA[v * 3 + 1] = _p.y; this.posA[v * 3 + 2] = _p.z;
        this.uvA[v * 2] = 0.5 + ds / (2 * r); this.uvA[v * 2 + 1] = 0.5 + (dd - d) / (2 * r);
        this.corA[v * 4] = lr; this.corA[v * 4 + 1] = lg; this.corA[v * 4 + 2] = lb; this.corA[v * 4 + 3] = a;
      }
    }
    this.mudou = true;
  }
  atualiza() {
    this.malha.visible = this.ativos > 0;
    if (!this.mudou) return;
    this.mudou = false;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
  }
  destroi() { this.geo.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- o conjunto
export class Efeitos {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    this.tempo = 0;
    this.grupo = new THREE.Group();
    this.grupo.name = 'efeitos-fase4';
    this.texturas = { brilho: texturaBrilho(), faisca: texturaFaisca(), fumaca: texturaFumaca(), oleo: texturaOleo(), bolinha: texturaBolinha(), circulo: texturaCirculo() };
    this.faiscas = new Pontos(N_FAISCAS, this.texturas.faisca, true, 'faiscas');
    this.pingos = new Pontos(N_PINGOS, this.texturas.bolinha, false, 'pingos');
    this.brilhos = new Billboards('brilhos', N_BRILHOS, this.texturas.brilho, true);
    this.nuvens = new Billboards('nuvens', N_NUVENS, this.texturas.fumaca, false);
    // aneis: cilindro aberto de raio 1 e altura 1, com a base em y = 0 (o "circulo no chao" e a borda de baixo)
    this.aneis = new PoolInstanciado('aneis', new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0), materialInstanciado('aro', false), N_ANEIS);
    this.bolhas = new PoolInstanciado('bolhas', new THREE.SphereGeometry(1, 28, 18), materialInstanciado('bolha', false), N_BOLHAS);
    this.gelos = new PoolInstanciado('gelos', new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), materialInstanciado('gelo', false, { lado: THREE.FrontSide }), N_GELOS);
    // funil do tornado (perfil de baixo para cima: fino no chao, largo em cima)
    const perfil = [[0.18, 0], [0.35, 0.5], [0.55, 1.2], [0.85, 2.0], [1.25, 2.8], [1.75, 3.6], [2.3, 4.3]].map(([r, y]) => new THREE.Vector2(r, y));
    this.funis = new PoolInstanciado('funis', new THREE.LatheGeometry(perfil, 24), materialInstanciado('funil', false), N_FUNIS);
    // chama: cone com a BOCA em z = 0 e a ponta em z = -1 (para tras do carro)
    this.chamas = new PoolInstanciado('chamas', new THREE.ConeGeometry(1, 1, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.5), materialInstanciado('chama', true), N_CHAMAS);
    this.feixes = new Feixes(N_FEIXES, SEG_FEIXE);
    this.manchas = new Manchas(N_MANCHAS, GRADE_MANCHA, this.texturas.oleo);
    this.circulos = new Circulos(N_CIRCULOS, SEG_S_CIRCULO, SEG_D_CIRCULO, this.texturas.circulo);
    for (const x of [this.manchas, this.circulos, this.gelos, this.nuvens, this.pingos, this.aneis, this.bolhas, this.funis, this.chamas, this.feixes, this.brilhos, this.faiscas]) this.grupo.add(x.malha);
    if (corrida && corrida.cena) corrida.cena.add(this.grupo);
    this._instanciados = [this.aneis, this.bolhas, this.gelos, this.funis, this.chamas];
    this._ultimoQuadro = -1;
  }

  /** Quantidade de particulas pela qualidade (0,4 / 0,7 / 1). */
  q(n) { const p = this.G.qualidade && this.G.qualidade.p; const f = p && Number.isFinite(p.particulas) ? p.particulas : 1; return Math.max(0, Math.round(n * f)); }

  // ------------------------------------------------------------ atalhos para os efeitos de uma vez
  /** Explosao em volta de p. cor = THREE.Color ou {r,g,b}. `aditivo`: faisca de luz (true) ou pingo colorido (false, o padrao: a cor
   *  aparece de dia). */
  explosao(p, n, cor, { vel = 6, sobe = 2, tam = 0.45, vida = 0.7, grav = 6, espalha = 1, aditivo = false } = {}) {
    const k = this.q(n), pool = aditivo ? this.faiscas : this.pingos;
    for (let i = 0; i < k; i++) {
      const a = aleatorio() * Math.PI * 2, e = (aleatorio() * 2 - 1) * espalha, v = vel * (0.4 + 0.6 * aleatorio());
      const ce = Math.sqrt(Math.max(0, 1 - e * e));
      pool.solta(p.x, p.y, p.z, Math.cos(a) * ce * v, e * v * 0.5 + sobe * (0.5 + aleatorio()), Math.sin(a) * ce * v,
        cor.r, cor.g, cor.b, tam * (0.7 + 0.6 * aleatorio()), tam * 0.2, 1, vida * (0.7 + 0.6 * aleatorio()), grav, 1.2);
    }
  }
  /** Clarao (billboard aditivo que cresce e some). */
  clarao(p, tam, cor, vida = 0.35, a = 0.9) { this.brilhos.solta(p.x, p.y, p.z, 0, 0, 0, cor.r, cor.g, cor.b, a, tam * 0.4, tam, vida, 0, 0, 0, 0); }
  /** Bolota de fumaca/poeira com vida (billboard normal). */
  bolota(p, v, tam0, tam1, cor, a, vida, grav = -0.3) {
    this.nuvens.solta(p.x, p.y, p.z, v.x, v.y, v.z, cor.r, cor.g, cor.b, a, tam0, tam1, vida, grav, 1.4, aleatorio() * 6.283, (aleatorio() - 0.5) * 1.2);
  }

  /** Um quadro de tela: anima tudo. So o primeiro a chamar no quadro anima (o turbo, as capsulas e os poderes chamam). */
  quadro(dt, quadroId) {
    if (quadroId !== undefined) { if (quadroId === this._ultimoQuadro) return; this._ultimoQuadro = quadroId; }
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.tempo += dt;
    const G = this.G;
    for (const m of [this.aneis.malha.material, this.bolhas.malha.material, this.funis.malha.material, this.chamas.malha.material, this.gelos.malha.material]) m.uniforms.uTempo.value = this.tempo;
    this.faiscas.atualiza(dt, G);
    this.pingos.atualiza(dt, G);
    this.brilhos.atualiza(dt);
    this.nuvens.atualiza(dt);
    for (const p of this._instanciados) p.atualiza();
    this.feixes.atualiza(G, this.tempo);
    this.manchas.atualiza();
    this.circulos.atualiza();
  }

  destroi() {
    if (this.grupo.parent) this.grupo.parent.remove(this.grupo);
    for (const x of [this.faiscas, this.pingos, this.brilhos, this.nuvens, this.aneis, this.bolhas, this.gelos, this.funis, this.chamas, this.feixes, this.manchas, this.circulos]) x.destroi();
    for (const k of Object.keys(this.texturas)) this.texturas[k].dispose();
  }
}

// ---------------------------------------------------------------- um por corrida (contagem de donos, como o pool da fase 2)
const _porCorrida = new WeakMap();
/** O Efeitos da corrida (cria no primeiro pedido). Cada dono chama `largaEfeitos(corrida)` no destroi. */
export function efeitosDaCorrida(G, corrida) {
  let e = _porCorrida.get(corrida);
  if (!e) { e = { efeitos: new Efeitos(G, corrida), donos: 0 }; _porCorrida.set(corrida, e); }
  e.donos++;
  return e.efeitos;
}
export function largaEfeitos(corrida) {
  const e = _porCorrida.get(corrida);
  if (!e) return;
  e.donos--;
  if (e.donos <= 0) { e.efeitos.destroi(); _porCorrida.delete(corrida); }
}
