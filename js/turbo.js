// O TURBO (fase 4): uma barra por carro, LIMITADA, que so recarrega com capsulas (js/capsulas.js). Contrato: docs/CONTRATOS.md secao 8
// — `carro.turbo = { carga 0..1, capacidade (s de turbo cheio), ativo }`; ligado, `mod.velMax *=` e `mod.empurrao +=` (config/turbo.js).
//
// COMO (e por que):
//   * a carga e FRACAO da barra e a capacidade e em SEGUNDOS pelo atributo `turbo` do carro (config/carros.js): a capsula soma a mesma
//     fracao para todos, entao quem tem turbo 5 ganha mais segundos por capsula — e e assim que o atributo conta;
//   * liga quando o controle pede E ha carga E nada impede: `mod.semTurbo` (Pulso EMP), congelado ou rodando (sem controle). O
//     empurrao do turbo NAO passa pelo "sem controle" da fisica (js/carro.js soma mod.empurrao sempre): sem esta trava o turbo
//     empurrava o carro congelado pelo gelo afora e o Raio Congelante nao valia nada;
//   * no ar tambem gasta (a crianca segurando o botao no salto ve a barra descer e o fogo acesso — o mesmo de segurar no chao);
//   * eventos: turbo:liga ao acender, turbo:desliga ao apagar, turbo:vazio quando a barra acaba ligada e quando aperta com a barra
//     vazia (so na borda do botao: a IA segurando o botao vazio nao vira metralhadora de aviso);
//   * a chama do escapamento e o desenho barato do pedido: 2 cones aditivos por carro (UM InstancedMesh para a corrida, js/efeitos.js),
//     um brilho e faiscas de fogo. A camera ja abre o FOV com `turbo.ativo` (js/camera.js); `camera.fov(extra)` e chamado tambem
//     (contrato) e nao dobra.
import * as THREE from 'three';
import { TURBO } from '../config/turbo.js';
import { indiceDoAtributo } from '../config/fisica.js';
import { emite } from './eventos.js';
import { efeitosDaCorrida, largaEfeitos, matrizDaBase, aleatorio } from './efeitos.js';

/** Segundos de turbo com a barra cheia para um carro (config/carros.js atributos.turbo 1..5). */
export function capacidadeDoTurbo(cfg) { return TURBO.CAPACIDADE[indiceDoAtributo(cfg && cfg.atributos && cfg.atributos.turbo)]; }

// --- aparencia da chama (nao e jogabilidade)
const CHAMA_RAIO = 0.32;        // m na boca
const CHAMA_COMPRIMENTO = 2.1;  // m (+- tremida)
const CHAMA_TREME = 0.35;       // fracao de tremida do comprimento
const FAISCAS_POR_S = 36;       // faiscas de fogo por carro (x qualidade)
const COR_CHAMA = new THREE.Color('#ff5a0a');
const COR_FOGO = [new THREE.Color('#ffe45c'), new THREE.Color('#ff9a2a'), new THREE.Color('#ff5a1a')];

const _X = new THREE.Vector3(), _P = new THREE.Vector3(), _V = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Turbo {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    this.efeitos = efeitosDaCorrida(G, corrida);
    this._segurava = [];   // controle.turbo no passo anterior, por indice do carro (a borda do "apertou com a barra vazia")
    this._chamas = [];     // por indice: [slot esquerdo, slot direito] no pool de chamas
    this._brilho = -1;     // primeiro slot reservado de brilho (2 por carro)
    this._acum = [];       // faiscas de fogo pendentes por carro
    this._t = 0;
  }

  inicia() {
    const cs = this.corrida.carros;
    this._brilho = this.efeitos.brilhos.reserva(cs.length * 2);
    for (const c of cs) {
      c.turbo = { carga: TURBO.CARGA_INICIAL, capacidade: capacidadeDoTurbo(c.cfg), ativo: false };
      this._segurava[c.indice] = false;
      this._chamas[c.indice] = [this.efeitos.chamas.pega(), this.efeitos.chamas.pega()];
      this._acum[c.indice] = 0;
    }
  }

  /** O que impede o turbo de ligar agora (EMP, congelado, rodando). */
  bloqueado(c) { return !!(c.mod && c.mod.semTurbo) || !!(c.efeitos && (c.efeitos.gelo > 0 || c.efeitos.rodopio > 0)); }

  passo(dt) {
    const cam = this.corrida.camera;
    for (const c of this.corrida.carros) {
      const t = c.turbo;
      if (!t) continue;
      const k = c.indice, quer = !!c.controle.turbo, bloq = this.bloqueado(c);
      if (quer && !bloq && t.carga > 0) {
        if (!t.ativo) { t.ativo = true; emite('turbo:liga', { carro: c }); }
        t.carga = Math.max(0, t.carga - dt / Math.max(0.1, t.capacidade || 1));
        c.mod.velMax *= TURBO.VEL_MAX;
        c.mod.empurrao += TURBO.EMPURRAO;
        if (c.ehJogador && cam && cam.fov) cam.fov(TURBO.FOV_EXTRA);
        if (t.carga <= 0) { t.ativo = false; emite('turbo:vazio', { carro: c }); emite('turbo:desliga', { carro: c }); }
      } else {
        if (t.ativo) { t.ativo = false; emite('turbo:desliga', { carro: c }); }
        if (quer && !this._segurava[k] && !(t.carga > 0) && !bloq) emite('turbo:vazio', { carro: c });
      }
      this._segurava[k] = quer;
    }
  }

  /** Soma `fracao` da barra (capsula: 0,3; dourada: 1). Devolve a carga nova. */
  soma(c, fracao) {
    const t = c && c.turbo;
    if (!t) return 0;
    t.carga = Math.min(1, Math.max(0, (t.carga || 0) + fracao));
    return t.carga;
  }

  /** Chamas do escapamento (quadro de tela). */
  quadro(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._t += dt;
    const E = this.efeitos, q = E.q(1);
    for (const c of this.corrida.carros) {
      const k = c.indice, sl = this._chamas[k];
      if (!sl) continue;
      const ligado = !!(c.turbo && c.turbo.ativo) && !(c.visual && c.visual.corpo && !c.visual.corpo.visible);
      if (!ligado) {
        E.chamas.poe(sl[0], _M.identity().makeScale(0, 0, 0), 0, 0, 0, 0); E.chamas.poe(sl[1], _M, 0, 0, 0, 0);
        E.brilhos.poe(this._brilho + k * 2, 0, 0, 0, 0, 0, 0, 0, 0); E.brilhos.poe(this._brilho + k * 2 + 1, 0, 0, 0, 0, 0, 0, 0, 0);
        this._acum[k] = 0;
        continue;
      }
      const e = (c.visual && c.visual.escala) || 1, p = c.p;
      // esquerda do carro (o +X do modelo): a base (esquerda, cima, frente) e a do GLB, mao direita
      _X.copy(c.direita).negate();
      for (let lado = 0; lado < 2; lado++) {
        const sx = lado === 0 ? 1 : -1;
        _P.copy(c.pos).addScaledVector(c.frente, -p.comprimento * 0.47 * e).addScaledVector(c.cima, p.altura * 0.32 * e).addScaledVector(_X, sx * p.largura * 0.22 * e);
        const treme = 1 + CHAMA_TREME * (Math.sin(this._t * 47 + k * 3 + lado * 1.7) * 0.6 + Math.sin(this._t * 29 + lado) * 0.4);
        const r = CHAMA_RAIO * e, L = CHAMA_COMPRIMENTO * e * treme;
        matrizDaBase(_M, _P, _X, c.cima, c.frente, r, r, L);
        E.chamas.poe(sl[lado], _M, COR_CHAMA.r, COR_CHAMA.g, COR_CHAMA.b, 0.95);
        E.brilhos.poe(this._brilho + k * 2 + lado, _P.x, _P.y, _P.z, 2.2 * e * (0.85 + 0.15 * treme), 1, 0.45, 0.1, 0.8);
      }
      // faiscas de fogo saindo para tras (mais devagar que o carro: ficam no rastro)
      this._acum[k] += FAISCAS_POR_S * q * dt;
      while (this._acum[k] >= 1) {
        this._acum[k] -= 1;
        const lado = aleatorio() < 0.5 ? 1 : -1, cor = COR_FOGO[(aleatorio() * 3) | 0];
        _P.copy(c.pos).addScaledVector(c.frente, -p.comprimento * 0.5 * e - 0.3).addScaledVector(c.cima, p.altura * 0.32 * e).addScaledVector(_X, lado * p.largura * 0.22 * e);
        _V.copy(c.vel).multiplyScalar(0.55).addScaledVector(c.frente, -5 - aleatorio() * 4).addScaledVector(c.cima, aleatorio() * 1.5).addScaledVector(_X, (aleatorio() - 0.5) * 2);
        E.faiscas.solta(_P.x, _P.y, _P.z, _V.x, _V.y, _V.z, cor.r * 1.2, cor.g * 1.1, cor.b, 0.55 * e, 0.1, 1, 0.22 + aleatorio() * 0.18, -1, 2);
      }
    }
  }

  destroi() {
    for (const sl of this._chamas) if (sl) { this.efeitos.chamas.solta(sl[0]); this.efeitos.chamas.solta(sl[1]); }
    this._chamas.length = 0;
    largaEfeitos(this.corrida);
  }
}
