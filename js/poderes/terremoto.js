// PODER 10 — TERREMOTO (Vulcao). CARGA de `carga` s com aviso (o chao ja treme de leve, poeira em volta do dono; o jogador perto ve
// "Terremoto! Pule!"), depois o TREMOR: todo rival a menos de `raio` m (3D) que estiver NO CHAO escorrega por `duracao` s
// (mod.aderencia *= aderencia: o pneu segura menos e o carro desliza na curva). ESQUIVA (verdade aqui): "Quem estiver no ar na hora do
// tremor nao sente nada — pule numa rampa!" — `aplicaEm` confere `alvo.noChao` NA HORA do tremor: no ar (rampa, vao, tornado) escapa
// (poder:esquivou) e continua escapado depois de pousar. Quem usou nunca escorrega.
// camera.treme no jogador: leve na carga, forte no tremor e tremidinhas enquanto escorrega.
// Visual: ondas de choque laranja saindo do dono (js/efeitos.js Aneis), poeira e pedrinhas nas rodas de quem escorrega.
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_TREMORES = 3;
const ONDA = 0.7;                   // s da onda de choque (visual): 90 m em 0,7 s
const TREME_A_CADA = 0.6;           // s entre as tremidinhas da camera do jogador escorregando
const COR = { r: 1.0, g: 0.5, b: 0.12 }, COR_POEIRA = { r: 0.62, g: 0.5, b: 0.38 }, COR_PEDRA = { r: 1.0, g: 0.62, b: 0.3 };
const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Terremoto extends PoderBase {
  inicia() {
    this.tremores = [];
    for (let k = 0; k < MAX_TREMORES; k++) this.tremores.push({ ativo: false, dono: null, t: 0, onda: 0, anel: -1, anel2: -1, circ: -1, pos: new THREE.Vector3(), cima: new THREE.Vector3(0, 1, 0), frente: new THREE.Vector3(0, 0, 1) });
    this.escorrega = this.porCarro();
    this._treme = this.porCarro();
    this._poeira = this.porCarro();
  }

  usa(c) {
    const tr = this.tremores.find((x) => !x.ativo && x.onda <= 0) || this.tremores.find((x) => !x.ativo);
    if (!tr) return true;
    tr.ativo = true; tr.dono = c; tr.t = 0; tr.onda = 0;
    tr.pos.copy(c.pos); tr.cima.copy(c.cima); tr.frente.copy(c.frente);
    if (tr.anel < 0) tr.anel = this.ef.aneis.pega();
    if (tr.anel2 < 0) tr.anel2 = this.ef.aneis.pega();
    if (tr.circ < 0) tr.circ = this.ef.circulos.pega();
    const r2 = this.cfg.raio * this.cfg.raio, j = this.corrida.jogador;
    if (j && j !== c && !j.chegou && j.pos.distanceToSquared(c.pos) <= r2) this.P.treme(j, 0.22, this.cfg.carga);
    return true;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg;
    for (const tr of this.tremores) {
      if (tr.onda > 0) { tr.onda -= dt; if (tr.onda <= 0 && !tr.ativo) { this.ef.aneis.solta(tr.anel); this.ef.aneis.solta(tr.anel2); tr.anel = tr.anel2 = -1; this.ef.circulos.solta(tr.circ); tr.circ = -1; } }
      if (!tr.ativo) continue;
      tr.t += dt;
      tr.pos.copy(tr.dono.pos); tr.cima.copy(tr.dono.cima); tr.frente.copy(tr.dono.frente);
      if (tr.t < cfg.carga) continue;
      // O TREMOR: conta quem esta no chao AGORA (o aplicaEm confere)
      tr.ativo = false; tr.onda = ONDA;
      const r2 = cfg.raio * cfg.raio;
      for (const x of this.corrida.carros) {
        if (x === tr.dono || x.chegou) continue;
        if (x.pos.distanceToSquared(tr.pos) <= r2) P.acerta('terremoto', tr.dono, x);
      }
      P.som('terremoto', tr.pos);
      _p.copy(tr.pos).addScaledVector(tr.cima, 0.5);
      this.ef.clarao(_p, 10, COR, 0.4, 0.7);
    }
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (!(this.escorrega[k] > 0)) continue;
      c.mod.aderencia *= cfg.aderencia;
      this.escorrega[k] -= dt;
      this._treme[k] -= dt;
      if (this._treme[k] <= 0) { this._treme[k] = TREME_A_CADA; P.treme(c, 0.3, 0.3); }
      if (this.escorrega[k] <= 0) { this.escorrega[k] = 0; P.fim('terremoto', c); }
    }
  }

  aplicaEm(alvo) {
    // no ar na hora do tremor: nao sente (a esquiva do texto)
    if (!alvo.noChao) return false;
    const k = alvo.indice;
    this.escorrega[k] = this.cfg.duracao;
    this._treme[k] = TREME_A_CADA;
    this.P.treme(alvo, 0.85, 0.9);
    return true;
  }

  iaDeveUsar(c) {
    const P = this.P;
    return P.rivaisPerto(c, this.cfg.raio * 0.6, true) >= 2 || P.rivaisPerto(c, 35, true) >= 1;
  }
  ativoEm(c) { return this.escorrega[c.indice]; }
  ameacaPara(c) { const r2 = this.cfg.raio ** 2; for (const tr of this.tremores) if (tr.ativo && tr.dono !== c && c.pos.distanceToSquared(tr.pos) <= r2) return true; return false; }

  quadro(dt) {
    const cfg = this.cfg, A = this.ef.aneis, q = this.ef.q(1);
    for (const tr of this.tremores) {
      if (tr.anel < 0) continue;
      _X.crossVectors(tr.cima, tr.frente).normalize();
      if (tr.ativo) {
        // carga: dois aneis curtos pulsando em volta do dono e poeira subindo
        const u = tr.t / cfg.carga, b = (u * 3) % 1;
        matrizDaBase(_M, tr.pos, _X, tr.cima, tr.frente, 4 + 10 * b, 0.9, 4 + 10 * b);
        A.poe(tr.anel, _M, COR.r, COR.g, COR.b, 0.9 * (1 - b));
        matrizDaBase(_M, tr.pos, _X, tr.cima, tr.frente, 3, 1.6 + 0.6 * Math.sin(tr.t * 30), 3);
        A.poe(tr.anel2, _M, COR.r, COR.g * 0.8, COR.b, 0.7);
        this.ef.circulos.poe(tr.circ, this.corrida.pista.sup(tr.dono.sup), tr.dono.s, tr.dono.d, 4 + 10 * b, COR.r, COR.g, COR.b, 0.9 * (1 - b));
        if (aleatorio() < q) {
          const a = aleatorio() * 6.283, r = 2 + aleatorio() * 8;
          _p.copy(tr.pos).addScaledVector(_X, Math.cos(a) * r).addScaledVector(tr.frente, Math.sin(a) * r);
          _v.copy(tr.cima).multiplyScalar(2 + aleatorio() * 2);
          this.ef.bolota(_p, _v, 1.2, 3.5, COR_POEIRA, 0.5, 0.8);
        }
      } else if (tr.onda > 0) {
        // o tremor: duas ondas de choque correndo ate o raio
        const u = 1 - tr.onda / ONDA;
        matrizDaBase(_M, tr.pos, _X, tr.cima, tr.frente, cfg.raio * u, 1.6, cfg.raio * u);
        A.poe(tr.anel, _M, COR.r, COR.g, COR.b, 1.1 * (1 - u));
        const u2 = Math.max(0, u - 0.18) / 0.82;
        matrizDaBase(_M, tr.pos, _X, tr.cima, tr.frente, cfg.raio * u2 * 0.92 + 0.1, 1.0, cfg.raio * u2 * 0.92 + 0.1);
        A.poe(tr.anel2, _M, COR_PEDRA.r, COR_PEDRA.g, COR_PEDRA.b, 0.9 * (1 - u2));
        // a onda de choque correndo pelo asfalto (na frente e atras de quem usou)
        this.ef.circulos.poe(tr.circ, this.corrida.pista.sup(tr.dono.sup), tr.dono.s, tr.dono.d, Math.max(2, cfg.raio * u), COR.r, COR.g, COR.b, 1.0 * (1 - u));
      }
    }
    // quem escorrega: poeira e pedrinhas nas rodas
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (!(this.escorrega[k] > 0)) { this._poeira[k] = 0; continue; }
      this._poeira[k] += 22 * q * Math.min(dt || 0, 0.1);
      while (this._poeira[k] >= 1) {
        this._poeira[k] -= 1;
        const lado = aleatorio() < 0.5 ? 1 : -1, tras = aleatorio() < 0.5 ? 1 : -1;
        _p.copy(c.pos).addScaledVector(c.direita, lado * c.p.largura * 0.45).addScaledVector(c.frente, tras * c.p.comprimento * 0.35).addScaledVector(c.cima, 0.2);
        _v.copy(c.vel).multiplyScalar(0.4).addScaledVector(c.cima, 1.5 + aleatorio() * 2).addScaledVector(c.direita, lado * (1 + aleatorio() * 2));
        if (aleatorio() < 0.5) this.ef.bolota(_p, _v, 0.6, 2.2, COR_POEIRA, 0.5, 0.6);
        else this.ef.pingos.solta(_p.x, _p.y, _p.z, _v.x, _v.y + 2, _v.z, COR_PEDRA.r, COR_PEDRA.g, COR_PEDRA.b, 0.3, 0.1, 1, 0.5, 14, 0.5);
      }
    }
  }

  destroi() { for (const tr of this.tremores || []) { this.ef.aneis.solta(tr.anel); this.ef.aneis.solta(tr.anel2); this.ef.circulos.solta(tr.circ); } }
}
