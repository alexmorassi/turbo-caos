// POPS AND BANGS (30/10/2026, pedido do Morassi: "coloque os carros com pops and bangs do Cidade Aberta"). O escapamento ESTOURA — som
// e labareda em cada cano — do jeito do Cidade Aberta (cidadeaberta/js/vehicles.js estaloStep, reducaoStep e psPopStep; js/fx.js popFx;
// js/audio.js estouro), nos carros com `pops` em config/carros.js (tools/carros/tabela.mjs):
//   * 'turbo' (Fusca Teto Solar, Voyage, Gol GTI, HB20, Monza, speed up!, Celta, Furgao): uma RAJADA de 2 a 4 estouros a cada REDUCAO —
//     pe fora do acelerador e a marcha caiu. As marchas sao as pseudo-marchas do som do motor (js/audio.js MARCHAS): o estouro sai junto
//     com o giro que sobe, como no carro de verdade;
//   * 'esportivo' (a Lagartixa, que e o Porsche 911 GT3 RS do Cidade Aberta): tambem quando TIRA O PE embalado depois de segurar o
//     acelerador (o escapamento estala por 0,5 a 1,7 s, mais tempo quanto mais rapido);
//   * 'prostock' (os sete de arrancada): as duas coisas, rajada de 5 a 8 na reducao (a primeira um BANG), um estouro em cada marcha que
//     SOBE com o pe no fundo e labareda maior — miolo azulado colado no cano, lingua laranja que abre e sobe, fagulhas no BANG.
// A mais, daqui: LIGAR O TURBO solta um BANG (o Cidade Aberta nao tem botao de turbo; aqui e o momento que a crianca escolhe).
// O que o Cidade Aberta faz no CORTE (W + S / L2 + R2: o motor batendo no limitador) nao existe: nao ha freio na tela (30/10/2026).
//
// Rival estoura tambem (labareda sempre; som posicional mais baixo): no Cidade Aberta so o Pro Stock rival estoura, porque la os outros
// carros sao transito — aqui sao a corrida. Tudo e enfeite: sorteio pelo gerador do visual (js/efeitos.js aleatorio), nunca o
// G.sorteio da jogabilidade, e nada muda na fisica.
import * as THREE from 'three';
import { on } from './eventos.js';
import { efeitosDaCorrida, largaEfeitos, matrizDaBase, aleatorio } from './efeitos.js';
import { MARCHAS, VEL_REF } from './audio.js';

// ---------------------------------------------------------------- quando estoura (numeros do cidadeaberta/js/vehicles.js)
const ACEL_PISADO = 0.6;       // "pe no fundo" (estaloStep e reducaoStep: throttle > 0,6 segura / cancela a rajada)
const ACEL_SOLTO = 0.2;        // tirou o pe (estaloStep: throttle < 0,2)
const ACEL_REDUZINDO = 0.3;    // a reducao so estoura com o pe fora (reducaoStep: throttle < 0,3)
const ACEL_SUBINDO = 0.5;      // Pro Stock: a marcha que sobe so estoura com o pe embaixo (psPopStep: throttle > 0,5)
const VEL_ESTALO = 8;          // m/s: estalo so embalado (estaloStep: sp > 8)
const SEGURA_MIN = 0.4;        // s de pe no fundo para o estalo valer (estH > 0,4)
const SEGURA_MAX = 1.5;        // teto do tempo segurado (estH ate 1,5)
const VEL_REDUZ = 3;           // m/s: reducao so andando (vf > 3)
const VEL_SOBE = 5;            // m/s: Pro Stock, marcha que sobe (vf > 5)
// fronteira da marcha com folga, em fracao de VEL_REF: o Cidade Aberta muda a marcha passando 4 % dela (na fronteira nao fica pipocando
// sem parar); aqui cada marcha tem ~0,2 de VEL_REF e 4 % disso e 0,008
const HISTERESE = 0.01;
// s entre dois estouros do mesmo carro: o js/audio.js nao repete o mesmo som em menos de 60 ms (REPETICAO_MINIMA) e a labareda sem o
// som parece defeito; o Cidade Aberta espaca a rajada em 0,05 a 0,12 s
const INTERVALO_MIN = 0.065;
const BANG_DO_TURBO = { turbo: 1.25, esportivo: 1.25, prostock: 1.45 };   // forca do estouro ao ligar o turbo (o BANG do Cidade Aberta: k > 1)

// ---------------------------------------------------------------- aparencia (js/fx.js popFx do Cidade Aberta)
const COR_LINGUA = new THREE.Color('#ff8a24');
const COR_CLARAO = new THREE.Color('#ffb347');
const COR_FUMACA = new THREE.Color(0.3, 0.3, 0.3);
const TREME = { comum: 0.22, prostock: 0.3, seg: 0.12 };   // tranco da camera no BANG do jogador (o G.shake 0,06 / 0,08 do Cidade Aberta)
// AS PARTICULAS DO popFx SOZINHAS SOMEM NA TELA DO CELULAR: com os tamanhos do Cidade Aberta a labareda virava um pontinho na camera
// de corrida daqui (mais longe do carro; foto de 30/10/2026). Por isso: particulas maiores e, por cima, uma LINGUA DE FOGO em cone (o
// mesmo cone do turbo, js/efeitos.js chamas) em cada cano, que nasce comprida e encolhe em ~0,1 s
const PARTICULA = { rua: 1.6, prostock: 1.3 };            // x o tamanho do popFx
const LINGUA = { rua: 1.1, prostock: 1.6, raio: 0.26, raioPro: 0.32, vida: 0.09, vidaPro: 0.12, porForca: 0.03 };   // m e s
const COR_DA_LINGUA = new THREE.Color('#ff9a2a');

const _P = new THREE.Vector3(), _D = new THREE.Vector3(), _V = new THREE.Vector3(), _L = new THREE.Vector3(), _C = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Pipoco {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    this.efeitos = efeitosDaCorrida(G, corrida);
    this.e = [];            // estado por indice do carro
    this.estouros = 0;      // contagem (a suite le)
    this._desligar = [];
  }

  inicia() {
    for (const c of this.corrida.carros) {
      this.e[c.indice] = { marcha: 0, estH: 0, estT: 0, redN: 0, redT: 0, redF: false, desde: 1, n: 0, fogo: 0, fogoMax: 1, forca: 0,
        // um cone de fogo por cano (so de quem estoura; -1 = pool cheio: fica so a particula)
        linguas: c.cfg && c.cfg.pops && c.cfg.escapamento ? c.cfg.escapamento.canos.map(() => this.efeitos.chamas.pega()) : [] };
    }
    this._desligar.push(on('turbo:liga', (ev) => {
      const c = ev && ev.carro, tipo = c && c.cfg && c.cfg.pops;
      if (tipo && this.e[c.indice]) this.estoura(c, BANG_DO_TURBO[tipo] || 1.25);
    }));
  }

  /** Um passo da corrida (depois do turbo: o turbo que acabou de ligar ja estourou pelo evento). */
  passo(dt) {
    for (const c of this.corrida.carros) {
      const tipo = c.cfg && c.cfg.pops, s = this.e[c.indice];
      if (!tipo || !s) continue;
      s.desde += dt;
      const pro = tipo === 'prostock', a = c.controle ? c.controle.acel || 0 : 0, vf = Math.max(0, c.vf || 0), sp = Math.abs(c.vf || 0);

      // a marcha do som do motor, com a folga na fronteira (pode pular mais de uma no salto ou na batida)
      const r = vf / VEL_REF;
      let m = s.marcha, subiu = false, desceu = false;
      while (m + 1 < MARCHAS.length && r > MARCHAS[m + 1] + HISTERESE) { m++; subiu = true; }
      while (m > 0 && r < MARCHAS[m] - HISTERESE) { m--; desceu = true; }
      s.marcha = m;
      if (pro && subiu && a > ACEL_SUBINDO && vf > VEL_SOBE) this.estoura(c, 0.9 + aleatorio() * 0.45);   // o corte da troca estoura
      if (desceu && a < ACEL_REDUZINDO && vf > VEL_REDUZ) { s.redN = pro ? 5 + Math.floor(aleatorio() * 4) : 2 + Math.floor(aleatorio() * 3); s.redT = 0; s.redF = true; }

      // a rajada da reducao: a primeira forte, as outras mais fracas, cada vez mais espacadas; pisou, para
      if (s.redN > 0) {
        if (a > ACEL_PISADO) s.redN = 0;
        else if ((s.redT -= dt) <= 0 && s.desde >= INTERVALO_MIN) {
          const k = s.redF ? (pro ? 1.3 + aleatorio() * 0.25 : 0.9 + aleatorio() * 0.35)
            : (pro ? 0.45 + aleatorio() * 0.45 + (aleatorio() < 0.15 ? 0.6 : 0) : 0.35 + aleatorio() * 0.35);
          this.estoura(c, k);
          s.redF = false; s.redN--; s.redT = pro ? 0.06 + aleatorio() * 0.09 : 0.05 + aleatorio() * 0.07;
        }
      }

      // o estalo de tirar o pe embalado (o Porsche e o Pro Stock)
      if (tipo === 'esportivo' || pro) {
        if (a > ACEL_PISADO && sp > VEL_ESTALO) s.estH = Math.min(SEGURA_MAX, s.estH + dt);
        else if (a < ACEL_SOLTO) {
          if (s.estH > SEGURA_MIN && sp > VEL_ESTALO) s.estT = 0.5 + 0.9 * Math.min(1, sp / (c.p && c.p.vMax || VEL_REF)) + 0.3 * aleatorio();
          s.estH = 0;
        }
        if (s.estT > 0) {
          s.estT -= dt;
          if (a > ACEL_PISADO) s.estT = 0;
          // rajada que vai rareando; as vezes um BANG
          else if (s.desde >= INTERVALO_MIN && aleatorio() < dt * (8 + 10 * Math.min(1, s.estT))) this.estoura(c, aleatorio() < 0.12 ? 1.15 : 0.3 + aleatorio() * 0.4);
        }
      }
    }
  }

  /** Um estouro de forca k (k > 1 = BANG): som, labareda em cada cano e, no BANG do jogador, o tranco da camera. */
  estoura(c, k) {
    const s = this.e[c.indice];
    if (s) { s.desde = 0; s.n++; }
    this.estouros++;
    const pro = c.cfg.pops === 'prostock';
    const A = this.G.audio;
    if (A && A.toca) {
      const vol = Math.min(1.6, pro ? k * 1.15 : k), tom = 0.9 + aleatorio() * 0.2;   // o Pro Stock estoura mais alto (popFx: k x 1,15)
      if (c.ehJogador) A.toca('estouro', { vol, tom });
      else A.toca('estouro', { vol: vol * 0.6, tom, pos: c.pos });
    }
    const visivel = !(c.visual && c.visual.corpo && !c.visual.corpo.visible);
    if (visivel) this._labareda(c, k, pro);
    if (s) { s.fogoMax = s.fogo = (pro ? LINGUA.vidaPro : LINGUA.vida) + LINGUA.porForca * k; s.forca = k; }
    if (k > 1 && c.ehJogador && this.corrida.camera && this.corrida.camera.treme) this.corrida.camera.treme(pro ? TREME.prostock : TREME.comum, TREME.seg);
  }

  _labareda(c, k, pro) {
    const E = this.efeitos, esc = (c.visual && c.visual.escala) || 1, cfg = c.cfg.escapamento;
    if (!E || !cfg) return;
    _L.copy(c.direita).negate();   // a esquerda do carro = o +X do modelo (os canos vem nessa base)
    for (const cano of cfg.canos) {
      // boca do cano no mundo e a direcao da labareda (o x da direcao espelha pelo lado do cano: o Pro Stock sopra para fora dos dois lados)
      _P.set(cano[0] * esc, cano[1] * esc, cano[2] * esc).applyQuaternion(c.quat).add(c.pos);
      const sx = cano[0] < 0 ? -1 : 1, d = cfg.dir || [0, 0, -1];
      _D.set(d[0] * sx, d[1], d[2]).applyQuaternion(c.quat);
      if (!pro) {
        const n = E.q(Math.round(3 + k * 5));
        for (let i = 0; i < n; i++) {
          const u = 2 + aleatorio() * 3 * k;
          _V.copy(c.vel).addScaledVector(_D, u).addScaledVector(c.cima, 0.2 + aleatorio() * 0.6).addScaledVector(_L, (aleatorio() - 0.5) * 0.8);
          E.faiscas.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, 1, 0.5 + aleatorio() * 0.25, 0.1, (0.18 + 0.12 * k) * PARTICULA.rua * esc, 0.55 * PARTICULA.rua * esc, 0.9, 0.1 + aleatorio() * 0.1 * k, 0, 2);
        }
      } else {
        for (let i = 0; i < E.q(3); i++) { // miolo azulado, devagar: fica colado na boca do cano
          const u = 0.8 + aleatorio() * 2.5;
          _V.copy(c.vel).addScaledVector(_D, u);
          E.faiscas.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, 0.65, 0.78, 1, (0.13 + 0.05 * k) * esc, 0.26 * esc, 0.9, 0.04 + aleatorio() * 0.03, 0, 6);
        }
        const n = E.q(Math.round(8 + k * 8)), j = 0.4 + 0.3 * k;
        for (let i = 0; i < n; i++) { // a lingua de fogo: abre, desacelera e sobe
          const u = (5.5 + aleatorio() * 5.5) * (0.8 + 0.3 * k);
          _V.copy(c.vel).addScaledVector(_D, u).addScaledVector(c.cima, aleatorio() * 0.6).addScaledVector(_L, (aleatorio() - 0.5) * j);
          E.faiscas.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, 1, 0.42 + aleatorio() * 0.33, 0.06 + aleatorio() * 0.08, (0.13 + 0.06 * k) * PARTICULA.prostock * esc, (0.3 + 0.18 * k) * PARTICULA.prostock * esc, 0.95, 0.05 + aleatorio() * 0.08 * k, -2.5, 3.2);
        }
        if (k > 1) for (let i = 0; i < E.q(6); i++) { // fagulhas do BANG
          const u = 6 + aleatorio() * 6;
          _V.copy(c.vel).addScaledVector(_D, u).addScaledVector(c.cima, aleatorio() * 3).addScaledVector(_L, (aleatorio() - 0.5) * 3);
          E.faiscas.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, 1, 0.75, 0.3, 0.07 * esc, 0.03 * esc, 1, 0.25 + aleatorio() * 0.35, 12, 0.5);   // caem
        }
      }
      // o clarao na boca do cano (o fogo ilumina) ANDANDO com o carro (o E.clarao nasce parado: a 35 m/s ficava 3 m para tras e
      // escorregava na direcao da camera) e, no BANG, um tufo de fumaca
      // (o cano de tras aponta para a camera de corrida: o cone aparece de ponta e quem mostra o estouro e o clarao, que sempre olha
      // para a camera — por isso ele e grande: 2 m num estouro comum, 3 m no BANG)
      const tam = (1.2 + 1.0 * Math.min(k, 1.5)) * (pro ? 1.4 : 1.2) * esc, cor = pro ? COR_LINGUA : COR_CLARAO;
      E.brilhos.solta(_P.x, _P.y, _P.z, c.vel.x, c.vel.y, c.vel.z, cor.r, cor.g, cor.b, 0.9, tam * 0.4, tam, 0.12, 0, 0, 0, 0);
      if (k > 1) {
        _C.copy(_P).addScaledVector(_D, 0.4);
        _V.copy(c.vel).multiplyScalar(0.3).add(_D).addScaledVector(c.cima, 1.2 + aleatorio() * 1.2);
        E.bolota(_C, _V, 0.5 * esc, (pro ? 2.4 : 1.8) * esc, COR_FUMACA, 0.5, 1.8 + aleatorio() * 1.4, -0.4);
      }
    }
  }

  /** Quadro de tela: a lingua de fogo de cada cano acompanha o carro e encolhe ate sumir. */
  quadro(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const E = this.efeitos;
    if (!E) return;
    for (const c of this.corrida.carros) {
      const s = this.e[c.indice];
      if (!s || !s.linguas.length) continue;
      const vivo = s.fogo > 0 && !(c.visual && c.visual.corpo && !c.visual.corpo.visible);
      if (!vivo) {
        if (s.acesa) { for (const sl of s.linguas) E.chamas.poe(sl, _M.identity().makeScale(0, 0, 0), 0, 0, 0, 0); s.acesa = false; }
        s.fogo = 0;
        continue;
      }
      s.fogo -= dt;
      const pro = c.cfg.pops === 'prostock', u = Math.max(0, s.fogo / s.fogoMax), k = s.forca, esc = (c.visual && c.visual.escala) || 1;
      const L = (pro ? LINGUA.prostock : LINGUA.rua) * (0.6 + 0.5 * Math.min(k, 1.5)) * (0.35 + 0.65 * u) * esc;
      const r = (pro ? LINGUA.raioPro : LINGUA.raio) * (0.7 + 0.3 * Math.min(k, 1.5)) * esc, a = 0.95 * Math.min(1, u * 3);
      const cfg = c.cfg.escapamento, d = cfg.dir || [0, 0, -1];
      cfg.canos.forEach((cano, i) => {
        const sl = s.linguas[i];
        if (!(sl >= 0)) return;
        _P.set(cano[0] * esc, cano[1] * esc, cano[2] * esc).applyQuaternion(c.quat).add(c.pos);
        // base do cone: Z para TRAS da labareda (a ponta do cone fica em -Z), Y o "cima" do carro tirado o que e Z
        _Z.set(d[0] * (cano[0] < 0 ? -1 : 1), d[1], d[2]).applyQuaternion(c.quat).negate().normalize();
        _Y.copy(c.cima).addScaledVector(_Z, -c.cima.dot(_Z)).normalize();
        _X.crossVectors(_Y, _Z);
        matrizDaBase(_M, _P, _X, _Y, _Z, r, r, L * (0.85 + 0.3 * aleatorio()));
        E.chamas.poe(sl, _M, COR_DA_LINGUA.r, COR_DA_LINGUA.g, COR_DA_LINGUA.b, a);
      });
      s.acesa = true;
    }
  }

  destroi() {
    const E = this.efeitos;
    if (E) for (const s of this.e) if (s && s.linguas) for (const sl of s.linguas) E.chamas.solta(sl);
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    largaEfeitos(this.corrida);
  }
}
