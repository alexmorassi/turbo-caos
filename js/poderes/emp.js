// PODER 2 — PULSO EMP (Faisca). O pulso CARREGA `carga` s (o circulo azul cresce em volta do dono, ate o raio) e estoura: quem estiver a
// menos de `raio` m (3D) do dono NESSA HORA fica sem turbo por `duracao` s (mod.semTurbo: js/turbo.js nao liga e desliga o que estava
// ligado). ESQUIVA (verdade aqui): "O pulso carrega por meio segundo: saia do circulo azul!" — conta a posicao no ESTOURO, nao no disparo:
// quem estava dentro e saiu durante a carga escapa (poder:esquivou).
// Visual: cortina de luz azul em anel (js/efeitos.js Aneis) crescendo com o dono, onda de choque no estouro e faiscas eletricas em
// volta de quem ficou sem turbo.
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_PULSOS = 4;
const ONDA = 0.4;                       // s da onda de choque depois do estouro (so visual)
const ALTURA_DO_ANEL = 5;               // m (visual): alto o bastante para o arco de 24 m aparecer na tela de quem esta dentro
const COR = { r: 0.25, g: 0.8, b: 1.0 }, COR_RAIO = { r: 0.7, g: 0.95, b: 1.2 };
const FAISCAS_POR_S = 18;               // em volta de quem esta sem turbo (x qualidade)
const _p = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Emp extends PoderBase {
  inicia() {
    this.pulsos = [];
    for (let k = 0; k < MAX_PULSOS; k++) this.pulsos.push({ ativo: false, dono: null, t: 0, dentro: 0, anel: -1, borda: -1, circ: -1, circ2: -1, onda: 0, pos: new THREE.Vector3(), cima: new THREE.Vector3(0, 1, 0), frente: new THREE.Vector3(0, 0, 1) });
    this.semTurbo = this.porCarro();
    this._faisca = this.porCarro();
  }

  usa(c) {
    const p = this.pulsos.find((x) => !x.ativo && x.onda <= 0) || this.pulsos.find((x) => !x.ativo);
    if (!p) return true;
    p.ativo = true; p.dono = c; p.t = 0; p.onda = 0;
    p.dentro = 0;
    const r2 = this.cfg.raio * this.cfg.raio;
    for (const x of this.corrida.carros) if (x !== c && !x.chegou && x.pos.distanceToSquared(c.pos) <= r2) {
      p.dentro |= 1 << x.indice;
    }
    if (p.anel < 0) p.anel = this.ef.aneis.pega();
    if (p.borda < 0) p.borda = this.ef.aneis.pega();
    if (p.circ < 0) p.circ = this.ef.circulos.pega();
    if (p.circ2 < 0) p.circ2 = this.ef.circulos.pega();
    return true;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg;
    for (const p of this.pulsos) {
      if (p.onda > 0) { p.onda -= dt; if (p.onda <= 0 && !p.ativo) { this.ef.aneis.solta(p.anel); p.anel = -1; this.ef.circulos.solta(p.circ); p.circ = -1; } }
      if (!p.ativo && p.borda >= 0) { this.ef.aneis.solta(p.borda); p.borda = -1; this.ef.circulos.solta(p.circ2); p.circ2 = -1; }
      if (!p.ativo) continue;
      p.t += dt;
      p.pos.copy(p.dono.pos); p.cima.copy(p.dono.cima); p.frente.copy(p.dono.frente);
      if (p.t < cfg.carga) continue;
      // ESTOURO: conta quem esta dentro AGORA
      p.ativo = false; p.onda = ONDA;
      const r2 = cfg.raio * cfg.raio;
      for (const x of this.corrida.carros) {
        if (x === p.dono || x.chegou) continue;
        if (x.pos.distanceToSquared(p.pos) <= r2) P.acerta('emp', p.dono, x);
        else if (p.dentro & (1 << x.indice)) P.esquivou('emp', p.dono, x);
      }
      _p.copy(p.pos).addScaledVector(p.cima, 1.2);
      this.ef.clarao(_p, 14, COR, 0.35, 0.8);
      this.ef.explosao(_p, 26, COR_RAIO, { vel: 16, sobe: 1, tam: 0.5, vida: 0.45, grav: 0, espalha: 0.25, aditivo: true });
    }
    // sem turbo: o mod de cada passo (o turbo, depois, nao liga)
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.semTurbo[k] > 0) {
        c.mod.semTurbo = true;
        this.semTurbo[k] -= dt;
        if (this.semTurbo[k] <= 0) { this.semTurbo[k] = 0; P.fim('emp', c); }
      }
    }
  }

  aplicaEm(alvo) {
    this.semTurbo[alvo.indice] = this.cfg.duracao;
    this.P.centro(alvo, _p);
    this.ef.explosao(_p, 16, COR_RAIO, { vel: 7, sobe: 1.5, tam: 0.45, vida: 0.4, grav: 0, aditivo: true });
    return true;
  }

  iaDeveUsar(c) { return this.P.rivaisPerto(c, this.cfg.raio * 0.8) >= 1; }
  ativoEm(c) { return this.semTurbo[c.indice]; }
  ameacaPara(c) {
    const r2 = this.cfg.raio * this.cfg.raio;
    for (const p of this.pulsos) if (p.ativo && p.dono !== c && c.pos.distanceToSquared(p.pos) <= r2) return true;
    return false;
  }

  quadro(dt) {
    const cfg = this.cfg, A = this.ef.aneis;
    for (const p of this.pulsos) {
      if (p.anel < 0) continue;
      _X.crossVectors(p.cima, p.frente).normalize();
      if (p.ativo) {
        // a BORDA do raio desde o comeco (de onde e preciso sair) e a onda crescendo em ritmo constante ate ela; o estouro e quando
        // a onda chega na borda
        const u = Math.min(1, p.t / cfg.carga), pisca = 0.8 + 0.2 * Math.sin(p.t * 40);
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, cfg.raio, ALTURA_DO_ANEL * 0.55, cfg.raio);
        A.poe(p.borda, _M, COR.r, COR.g, COR.b, 0.75 * pisca);
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, Math.max(1.5, cfg.raio * u), ALTURA_DO_ANEL, Math.max(1.5, cfg.raio * u));
        A.poe(p.anel, _M, COR_RAIO.r * 0.7, COR_RAIO.g, COR_RAIO.b, 0.95 * pisca);
        // e o circulo PINTADO no asfalto: a borda (de onde sair) e a onda chegando nela
        const S = this.corrida.pista.sup(p.dono.sup);
        this.ef.circulos.poe(p.circ2, S, p.dono.s, p.dono.d, cfg.raio, COR.r, COR.g, COR.b, 0.95);
        this.ef.circulos.poe(p.circ, S, p.dono.s, p.dono.d, Math.max(1.5, cfg.raio * u), COR_RAIO.r * 0.6, COR_RAIO.g * 0.9, 1, 0.8 * pisca);
      } else if (p.onda > 0) {
        const u = 1 - p.onda / ONDA;
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, cfg.raio * (1 + 0.35 * u), ALTURA_DO_ANEL * (1 - 0.6 * u), cfg.raio * (1 + 0.35 * u));
        A.poe(p.anel, _M, COR_RAIO.r, COR_RAIO.g, COR_RAIO.b, 1.2 * (1 - u));
        this.ef.circulos.poe(p.circ, this.corrida.pista.sup(p.dono.sup), p.dono.s, p.dono.d, cfg.raio * (1 + 0.35 * u), COR_RAIO.r * 0.6, COR_RAIO.g * 0.9, 1, 0.9 * (1 - u));
      }
    }
    // eletricidade em quem esta sem turbo
    const q = this.ef.q(1);
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (!(this.semTurbo[k] > 0)) { this._faisca[k] = 0; continue; }
      this._faisca[k] += FAISCAS_POR_S * q * Math.min(dt, 0.1);
      while (this._faisca[k] >= 1) {
        this._faisca[k] -= 1;
        this.P.centro(c, _p);
        const a = aleatorio() * 6.283;
        _p.addScaledVector(c.direita, Math.cos(a) * c.p.largura * 0.6).addScaledVector(c.frente, Math.sin(a) * c.p.comprimento * 0.45).addScaledVector(c.cima, (aleatorio() - 0.3) * c.p.altura * 0.6);
        this.ef.faiscas.solta(_p.x, _p.y, _p.z, c.vel.x * 0.9 + (aleatorio() - 0.5) * 3, c.vel.y * 0.9 + aleatorio() * 2, c.vel.z * 0.9 + (aleatorio() - 0.5) * 3,
          COR_RAIO.r, COR_RAIO.g, COR_RAIO.b, 0.35, 0.05, 1, 0.18 + aleatorio() * 0.12, 0, 0);
      }
    }
  }

  destroi() { for (const p of this.pulsos || []) { this.ef.aneis.solta(p.anel); this.ef.aneis.solta(p.borda); this.ef.circulos.solta(p.circ); this.ef.circulos.solta(p.circ2); } }
}
