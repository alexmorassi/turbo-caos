// O VISUAL DE UM CARRO NA CORRIDA (fase 2): poe o modelo (js/modelo_carro.js) onde a fisica deixou o carro e da vida a ele — rodas
// girando e estercando, carroceria que inclina na curva e na derrapagem, arfa no acelerar/frear e balanca no pouso, o Voador flutuando,
// sombra embaixo, pisca no fantasma, fumaca de derrapagem, faisca de batida e poeira de pouso. Nada aqui mexe na fisica: e so leitura
// do Carro (js/carro.js) a cada quadro de tela (`quadro(dt)` com o dt REAL), e por isso pode usar o tempo de verdade.
//
// POR QUE A CARROCERIA E NAO O CARRO INTEIRO INCLINA: as rodas sao irmas do no `body` no GLB (fase 1); inclinar so o `body` deixa as
// quatro rodas no asfalto enquanto o carro "senta" na curva — e o que vende a suspensao sem fisica de suspensao.
// POR QUE A SOMBRA E UMA MANCHA (e nao sombra de verdade): sombra em tempo real e o item mais caro do quadro (armadilha do
// dinotrails-web); uma mancha radial colada no asfalto custa um quad e diz a crianca onde o carro vai pousar no salto.
// POR QUE UM POOL SO DE PARTICULAS POR CORRIDA: 8 carros x 1 desenho cada seria 8 chamadas de desenho por quadro no celular; um
// THREE.Points compartilhado e 1. O pool e pequeno (PARTICULAS) e a mais velha e reaproveitada quando enche.
// NAO DE dispose NA GEOMETRIA/MATERIAL DO GLB: o clone compartilha com o cache do carregaGLB (a vitrine e a proxima corrida usam).
import * as THREE from 'three';
import { on } from './eventos.js';
import { MARCA } from './pista.js';

// --- numeros do visual (nao sao jogabilidade: so aparencia)
const ROLA_POR_ACEL = 0.0016;    // rad de rolamento por m/s2 de aceleracao lateral (curva fechada a 36 m/s ~ 54 m/s2 -> ~5 graus)
const ROLA_MAX = 0.1;            // rad (~6 graus)
const ARFA_POR_ACEL = 0.0045;    // rad por m/s2 longitudinal (arrancada de 14 m/s2 -> ~3,6 graus de bico para cima)
const ARFA_MAX = 0.07;
const MOLA = 140;                // 1/s2: rigidez da "suspensao" visual
const AMORTECE = 13;             // 1/s: um pouco abaixo do critico — balanca uma vez e assenta
const POUSO_BALANCO = 0.035;     // m/s de afundada por m/s de impacto no pouso
const RODA_ESTERCO = 0.5;        // rad de roda na direcao toda (devagar); embalado cai pela metade
const RODA_GIRO_MAX = 32;        // rad/s desenhados no maximo (acima disso a roda "volta para tras" na tela: efeito carroca)
const FLUTUA_AMPLITUDE = 0.06;   // m: o Voador sobe e desce
const FLUTUA_FREQ = 3.1;         // rad/s
const SOMBRA_ALTURA_SOME = 9;    // m de altura em que a sombra some
const SOMBRA_OPACIDADE = 0.7;
const SOMBRA_LARGURA = 1.55;     // x largura do carro: a borda macia sai pelos lados (o nucleo fica embaixo da carroceria)
const SOMBRA_COMPRIMENTO = 1.3;  // x comprimento do carro
const PARTICULAS = 192;
const FUMACA_POR_S = 34;         // por roda de tras derrapando (x qualidade.p.particulas)
const POEIRA_TERRA_POR_S = 14;

const EIXO_X = new THREE.Vector3(1, 0, 0), EIXO_Y = new THREE.Vector3(0, 1, 0);
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3(), _F = new THREE.Vector3(), _E = new THREE.Vector3();
const _P = new THREE.Vector3(), _V = new THREE.Vector3(), _tela = new THREE.Vector2();
const _M = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

// ---------------------------------------------------------------- recursos compartilhados (criados uma vez, nunca destruidos: sao minusculos)
let _texMancha = null, _geoSombra = null;
function texturaRadial(nucleo = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,${nucleo})`); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A mancha da sombra: retangulo arredondado preto com borda macia (o carro visto de cima e um retangulo, nao um circulo — a mancha
 *  radial ficava toda escondida embaixo da carroceria, foto docs/fotos/fase2_10_sombra.png da primeira versao). A borda macia vem do
 *  shadowBlur: o `ctx.filter = 'blur()'` nao existe no Safari. */
function texturaDaSombra() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.shadowColor = '#000'; g.shadowBlur = 22;
  const x = 26, y = 22, w = 128 - 2 * x, h = 128 - 2 * y, r = 26;
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function recursosDaSombra() {
  if (!_texMancha) _texMancha = texturaDaSombra();
  if (!_geoSombra) _geoSombra = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); // deitado no XZ: normal +Y
  return { tex: _texMancha, geo: _geoSombra };
}

// gerador proprio do visual (fumaca espalhada): NAO usa G.sorteio (desenhar mais ou menos quadros mudaria a corrida) nem Math.random
// (compartilhado com o three.js nas suites de semente fixa)
let _semente = 0x2545f491;
function aleatorio() { _semente = (Math.imul(_semente, 1664525) + 1013904223) >>> 0; return _semente / 4294967296; }

// ---------------------------------------------------------------- pool de particulas (um por corrida)
/** Atributos que mudam a cada quadro (lista fixa: criar o array dentro de atualiza() alocaria a cada quadro). */
const ATRIBUTOS = ['position', 'cor', 'tamanho', 'alfa'];
class Particulas {
  constructor(n) {
    this.n = n; this.prox = 0; this.vivas = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.cor = new Float32Array(n * 3);
    this.tam = new Float32Array(n); this.alfa = new Float32Array(n); this.vida = new Float32Array(n); this.max = new Float32Array(n);
    this.t0 = new Float32Array(n); this.t1 = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.arrasto = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(this.cor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tamanho', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alfa', new THREE.BufferAttribute(this.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: texturaRadial(0.9) }, escala: { value: 400 } },
      vertexShader: 'attribute float tamanho; attribute float alfa; attribute vec3 cor; varying vec3 vCor; varying float vAlfa; uniform float escala;\n' +
        'void main(){ vCor = cor; vAlfa = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = tamanho * escala / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D mapa; varying vec3 vCor; varying float vAlfa;\n' +
        'void main(){ vec4 t = texture2D(mapa, gl_PointCoord); float a = t.a * vAlfa; if (a < 0.01) discard; gl_FragColor = vec4(vCor, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    this.malha = new THREE.Points(g, this.mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 5;
    this.malha.name = 'particulas-dos-carros';
    this.geo = g;
    this.donos = 0;
    this.quemAtualiza = null;
  }

  /** Uma particula. tam0 -> tam1 ao longo da vida; alfa0 -> 0. */
  solta(x, y, z, vx, vy, vz, cor, tam0, tam1, alfa0, vida, grav, arrasto) {
    const i = this.prox; this.prox = (this.prox + 1) % this.n;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.cor[o] = cor.r; this.cor[o + 1] = cor.g; this.cor[o + 2] = cor.b;
    this.t0[i] = tam0; this.t1[i] = tam1; this.a0[i] = alfa0; this.tam[i] = tam0; this.alfa[i] = alfa0;
    this.vida[i] = this.max[i] = vida; this.grav[i] = grav; this.arrasto[i] = arrasto;
    this.vivas = this.n;
  }

  atualiza(dt, G) {
    // tamanho em perspectiva: pixels por metro a 1 m da camera = altura da tela / (2 tan(fov/2))
    const cam = G.camera, r = G.renderer;
    if (cam && r) { r.getDrawingBufferSize(_tela); this.mat.uniforms.escala.value = _tela.y / (2 * Math.tan((cam.fov * Math.PI) / 360)); }
    if (this.vivas <= 0) return;
    let algum = false;
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) { if (this.alfa[i] !== 0) { this.alfa[i] = 0; algum = true; } continue; }
      algum = true;
      this.vida[i] -= dt;
      const u = Math.max(0, this.vida[i] / this.max[i]), o = i * 3, k = Math.exp(-this.arrasto[i] * dt);
      this.vel[o] *= k; this.vel[o + 2] *= k; this.vel[o + 1] = this.vel[o + 1] * k - this.grav[i] * dt;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      this.tam[i] = this.t1[i] + (this.t0[i] - this.t1[i]) * u;
      this.alfa[i] = this.a0[i] * Math.min(1, u * 2.2);
    }
    if (!algum) { this.vivas = 0; return; }
    for (let k = 0; k < ATRIBUTOS.length; k++) this.geo.attributes[ATRIBUTOS[k]].needsUpdate = true;
  }

  destroi() {
    if (this.malha.parent) this.malha.parent.remove(this.malha);
    this.geo.dispose(); this.mat.uniforms.mapa.value.dispose(); this.mat.dispose();
  }
}
const _pools = new WeakMap();
function poolDa(corrida) {
  let p = _pools.get(corrida);
  if (!p) { p = new Particulas(PARTICULAS); _pools.set(corrida, p); }
  p.donos++;
  return p;
}

const COR_FUMACA = new THREE.Color('#ececec'), COR_FAISCA = new THREE.Color('#ffd25a'), COR_FAISCA2 = new THREE.Color('#ff8a2a');
const COR_POEIRA = new THREE.Color('#cdb48f'), COR_TERRA = new THREE.Color('#a8865a');

/** Mola amortecida de um eixo (estado { x, v }). Subpassos: o dt do quadro de tela pode chegar a 0,1 s no celular engasgado. */
function mola(e, alvo, dt) {
  const n = Math.max(1, Math.ceil(dt / (1 / 60)));
  const h = dt / n;
  for (let k = 0; k < n; k++) { e.v += (-MOLA * (e.x - alvo) - AMORTECE * e.v) * h; e.x += e.v * h; }
}

export class VisualCarro {
  /** `modelo` = o objeto de criaModeloCarro: { grupo, carroceria, rodas: [{ no, raio, frente, lado }], cfg }. */
  constructor(G, carro, modelo) {
    this.G = G; this.carro = carro; this.modelo = modelo;
    /** o que a corrida poe na cena: um grupo PARADO na origem com o carro e a sombra dentro (os dois andam em coordenadas de mundo) */
    this.grupo = new THREE.Group();
    this.grupo.name = 'visual:' + ((carro.cfg && carro.cfg.id) || carro.indice);
    this.corpo = modelo.grupo;
    this.grupo.add(this.corpo);
    this.carroceria = modelo.carroceria && modelo.carroceria !== modelo.grupo ? modelo.carroceria : null;
    this.temRodas = modelo.rodas.length > 0 && !(carro.cfg && carro.cfg.rodas && carro.cfg.rodas.tem === false);
    // o Voador pairava `rodas.flutua` m acima do chao no Cidade Aberta (fase 1 mediu na escala nova); o GLB tem o fundo em y = 0
    this.flutua = this.temRodas ? 0 : Math.max(0, Number(carro.cfg && carro.cfg.rodas && carro.cfg.rodas.flutua) || 0);
    this.rodas = modelo.rodas.map((r) => ({ no: r.no, raio: r.raio || 0.35, frente: !!r.frente, q0: r.no.quaternion.clone(), ang: 0 }));
    this.rola = { x: 0, v: 0 }; this.arfa = { x: 0, v: 0 }; this.sobe = { x: 0, v: 0 };
    this.escala = 1;
    this.t = carro.indice * 1.7; // fase do flutuar diferente por carro
    this.vRoda = 0;
    this._acum = { fumaca: 0, terra: 0 };
    // sombra
    const { tex, geo } = recursosDaSombra();
    this.matSombra = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: SOMBRA_OPACIDADE, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.sombra = new THREE.Mesh(geo, this.matSombra);
    this.sombra.name = 'sombra';
    this.sombra.renderOrder = 1;
    this.sombra.frustumCulled = false;
    this.grupo.add(this.sombra);
    // particulas
    this.pool = poolDa(carro.corrida);
    if (!this.pool.quemAtualiza) this.pool.quemAtualiza = this;
    // eventos do proprio carro (a fisica emite dentro do passo; aqui so solta particula e balanca)
    this._desligar = [
      on('carro:pouso', (e) => { if (e.carro === this.carro) this._pousou(e.forca || 0); }),
      on('carro:batida', (e) => {
        if (e.carro === this.carro) this._faiscas(e.tipo === 'muro' ? (this.carro.d > 0 ? 1 : -1) : 0, e.forca || 0, e.outro);
      }),
    ];
    this.quadro(0);
  }

  _qualidade() { const q = this.G.qualidade && this.G.qualidade.p; return q && Number.isFinite(q.particulas) ? q.particulas : 1; }

  _pousou(forca) {
    this.sobe.v -= Math.min(0.9, forca * POUSO_BALANCO);
    this.arfa.v += Math.min(0.6, forca * 0.02);
    const n = Math.round(Math.min(14, 3 + forca * 0.8) * this._qualidade());
    const c = this.carro;
    for (let k = 0; k < n; k++) {
      const a = aleatorio() * Math.PI * 2, v = 2 + aleatorio() * 3;
      _V.copy(c.direita).multiplyScalar(Math.cos(a) * v).addScaledVector(c.frente, Math.sin(a) * v - c.vf * 0.15).addScaledVector(c.cima, 0.8 + aleatorio());
      this.pool.solta(c.pos.x, c.pos.y + 0.2, c.pos.z, _V.x, _V.y, _V.z, COR_POEIRA, 0.8, 2.6, 0.55, 0.7 + aleatorio() * 0.4, 1.5, 2.2);
    }
  }

  /** Faiscas no lado da batida (lado = +1 direita, -1 esquerda, 0 = carro x carro: entre os dois). */
  _faiscas(lado, forca, outro) {
    const c = this.carro, n = Math.round(Math.min(12, 2 + forca * 0.6) * this._qualidade());
    if (lado !== 0) _P.copy(c.pos).addScaledVector(c.direita, lado * this.carro.p.largura * 0.5).addScaledVector(c.cima, 0.5);
    else if (outro && outro.pos) _P.copy(c.pos).add(outro.pos).multiplyScalar(0.5).addScaledVector(c.cima, 0.6);
    else _P.copy(c.pos).addScaledVector(c.cima, 0.6);
    for (let k = 0; k < n; k++) {
      const v = 4 + aleatorio() * 6;
      _V.copy(c.frente).multiplyScalar(c.vf * 0.5 + (aleatorio() - 0.5) * v).addScaledVector(c.direita, (lado || (aleatorio() - 0.5) * 2) * aleatorio() * v * 0.6).addScaledVector(c.cima, 1.5 + aleatorio() * v * 0.5);
      this.pool.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, aleatorio() < 0.5 ? COR_FAISCA : COR_FAISCA2, 0.28, 0.08, 1, 0.25 + aleatorio() * 0.25, 14, 1);
    }
  }

  /** Sincroniza a malha com a fisica. `dt` = tempo REAL do quadro de tela. */
  quadro(dt) {
    const c = this.carro, G = this.G;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt;
    // a pool entra na cena quando o grupo entrou (a corrida adiciona depois de carregar)
    if (!this.pool.malha.parent && this.grupo.parent) this.grupo.parent.add(this.pool.malha);

    // --- carro onde a fisica deixou
    this.corpo.position.copy(c.pos);
    this.corpo.quaternion.copy(c.quat);
    this.escala += ((c.mod.escala || 1) - this.escala) * (1 - Math.exp(-8 * dt));
    this.corpo.scale.setScalar(this.escala);
    // fantasma: pisca 10 vezes por segundo (o contrato: "sem colisao, pisca")
    this.corpo.visible = !(c.fantasma > 0 && Math.floor(c.fantasma * 10) % 2 === 0);

    // --- rodas: giram com a velocidade, as da frente estercam (na derrapagem, contra-esterco: apontam para onde o carro vai)
    if (this.temRodas) {
      const alvo = c.noChao ? c.vf : this.vRoda * Math.exp(-0.6 * dt);
      this.vRoda = alvo;
      const esterco = c.derrapando ? Math.atan2(c.vr, Math.max(1, Math.abs(c.vf))) * 0.8 : c.volante * RODA_ESTERCO * (1 - 0.5 * Math.min(1, Math.abs(c.vf) / 40));
      for (const r of this.rodas) {
        let w = this.vRoda / r.raio;
        if (c.derrapando && !r.frente) w *= 1.6; // traseira patinando
        w = Math.max(-RODA_GIRO_MAX, Math.min(RODA_GIRO_MAX, w));
        r.ang = (r.ang + w * dt) % (Math.PI * 2);
        _qa.setFromAxisAngle(EIXO_X, r.ang);
        if (r.frente) { _qb.setFromAxisAngle(EIXO_Y, -esterco); r.no.quaternion.copy(_qb).multiply(_qa).multiply(r.q0); }
        else r.no.quaternion.copy(_qa).multiply(r.q0);
      }
    }

    // --- carroceria: rola para FORA da curva, arfa no acelerar/frear, balanca no pouso
    const latAcc = c.noChao ? c.vf * c.giro : 0;
    const fator = this.temRodas ? 1 : 1.6;                              // o Voador inclina mais (nao tem roda segurando)
    const rolaAlvo = Math.max(-ROLA_MAX, Math.min(ROLA_MAX, -latAcc * ROLA_POR_ACEL)) * fator + (c.derrapando ? -Math.sign(c.giro) * 0.03 : 0);
    const arfaAlvo = c.noChao ? Math.max(-ARFA_MAX, Math.min(ARFA_MAX, -c.aceleracao * ARFA_POR_ACEL)) : 0;
    mola(this.rola, rolaAlvo, dt); mola(this.arfa, arfaAlvo, dt); mola(this.sobe, 0, dt);
    this.sobe.x = Math.max(-0.14, Math.min(0.14, this.sobe.x));
    if (this.carroceria) {
      const flutua = this.temRodas ? 0 : this.flutua + FLUTUA_AMPLITUDE * Math.sin(this.t * FLUTUA_FREQ);
      this.carroceria.position.y = this.sobe.x + flutua;
      this.carroceria.rotation.set(this.arfa.x, 0, this.rola.x);
    }

    // --- sombra: mancha no asfalto embaixo do carro, some com a altura e no vao
    this._sombra();

    // --- particulas
    const q = this._qualidade();
    if (q > 0 && c.noChao && dt > 0) {
      const sup = c.corrida.pista && c.corrida.pista.sup(c.sup);
      const terra = sup ? (sup.marcasEm(c.s) & MARCA.TERRA) !== 0 : false;
      if (c.derrapando) this._acum.fumaca += FUMACA_POR_S * q * dt; else this._acum.fumaca = 0;
      if (terra && Math.abs(c.vf) > 8) this._acum.terra += POEIRA_TERRA_POR_S * q * dt; else this._acum.terra = 0;
      while (this._acum.fumaca >= 1) { this._acum.fumaca -= 1; this._soltaNaRoda(-1, COR_FUMACA, 0.7, 2.4, 0.5, 0.75); this._soltaNaRoda(1, COR_FUMACA, 0.7, 2.4, 0.5, 0.75); }
      while (this._acum.terra >= 1) { this._acum.terra -= 1; this._soltaNaRoda(aleatorio() < 0.5 ? -1 : 1, COR_TERRA, 0.6, 2.0, 0.45, 0.6); }
    }
    if (this.pool.quemAtualiza === this) this.pool.atualiza(dt, G);
  }

  _soltaNaRoda(lado, cor, t0, t1, a0, vida) {
    const c = this.carro, L = c.p.comprimento * 0.42 * this.escala, W = c.p.largura * 0.4 * this.escala;
    _P.copy(c.pos).addScaledVector(c.frente, -L).addScaledVector(c.direita, lado * W).addScaledVector(c.cima, 0.25);
    _V.copy(c.vel).multiplyScalar(0.25).addScaledVector(c.direita, (aleatorio() - 0.5) * 2).addScaledVector(c.cima, 0.6 + aleatorio() * 0.6);
    this.pool.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, cor, t0, t1, a0, vida * (0.8 + aleatorio() * 0.4), -0.4, 1.8);
  }

  _sombra() {
    const c = this.carro, pista = c.corrida.pista;
    const sup = pista && pista.sup(c.sup);
    if (!sup) { this.sombra.visible = false; return; }
    const h = c.noChao ? 0 : Math.max(0, c.h);
    const meia = sup.larguraEm(c.s) * 0.5;
    if ((sup.marcasEm(c.s) & MARCA.VAO) || c.h < -0.5 || Math.abs(c.d) > meia + 1 || h > SOMBRA_ALTURA_SOME || !this.corpo.visible) { this.sombra.visible = false; return; }
    this.sombra.visible = true;
    sup.quadro(c.s, _T, _N, _R);
    sup.ponto(c.s, c.d, 0.05, _P);
    // o comprido da mancha segue o rumo do carro projetado no asfalto
    _F.copy(c.frente).addScaledVector(_N, -c.frente.dot(_N));
    if (_F.lengthSq() < 1e-6) _F.copy(_T); else _F.normalize();
    _E.crossVectors(_N, _F);
    _M.makeBasis(_E, _N, _F);
    this.sombra.quaternion.setFromRotationMatrix(_M);
    this.sombra.position.copy(_P);
    const e = this.escala, alto = 1 + h * 0.12;
    this.sombra.scale.set(c.p.largura * SOMBRA_LARGURA * e * alto, 1, c.p.comprimento * SOMBRA_COMPRIMENTO * e * alto);
    this.matSombra.opacity = SOMBRA_OPACIDADE * (1 - h / SOMBRA_ALTURA_SOME) * (this.temRodas ? 1 : 0.75);
  }

  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    if (this.grupo.parent) this.grupo.parent.remove(this.grupo);
    this.matSombra.dispose();
    if (this.pool) {
      this.pool.donos--;
      if (this.pool.quemAtualiza === this) this.pool.quemAtualiza = null;
      if (this.pool.donos <= 0) { this.pool.destroi(); _pools.delete(this.carro.corrida); }
      else if (!this.pool.quemAtualiza) {
        // outro carro da mesma corrida assume a atualizacao do pool (a corrida ainda existe)
        const outro = this.carro.corrida.carros && this.carro.corrida.carros.find((x) => x !== this.carro && x.visual && x.visual.pool === this.pool);
        if (outro) this.pool.quemAtualiza = outro.visual;
      }
      this.pool = null;
    }
  }
}
