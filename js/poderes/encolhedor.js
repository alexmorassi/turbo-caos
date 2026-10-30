// PODER 6 — ENCOLHEDOR (Buguinho). Pulso com CARGA curta (`carga` s, o anel roxo cresce em volta do dono): no estouro, todo rival a
// menos de `raio` m (3D) ENCOLHE por `duracao` s — mod.escala (o visual do carro e a caixa de colisao encolhem: js/visual_carro.js e
// js/colisoes.js leem), mod.velMax (mais lento) e mod.massa (mais leve: na batida vai longe). CONTRA-ATAQUE (verdade aqui): "Pegue uma
// capsula de turbo para voltar ao tamanho normal" — o gerente ouve `capsula:pega` e chama aoPegarCapsula. (Sair do anel durante a carga
// tambem escapa: o estouro conta quem esta dentro na hora.)
// O jogador encolhido ve "Pegue uma cápsula!" (o contra-ataque se aprende na hora em que precisa).
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_PULSOS = 4;
const ONDA = 0.35;
const ALTURA_DO_ANEL = 4.5;
const COR = { r: 0.62, g: 0.38, b: 1.0 }, COR_BRILHO = { r: 0.85, g: 0.65, b: 1.2 };
const _p = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Encolhedor extends PoderBase {
  inicia() {
    this.pulsos = [];
    for (let k = 0; k < MAX_PULSOS; k++) this.pulsos.push({ ativo: false, dono: null, t: 0, dentro: 0, anel: -1, borda: -1, circ: -1, circ2: -1, onda: 0, pos: new THREE.Vector3(), cima: new THREE.Vector3(0, 1, 0), frente: new THREE.Vector3(0, 0, 1) });
    this.encolhido = this.porCarro();
  }

  usa(c) {
    const p = this.pulsos.find((x) => !x.ativo && x.onda <= 0) || this.pulsos.find((x) => !x.ativo);
    if (!p) return true;
    p.ativo = true; p.dono = c; p.t = 0; p.onda = 0; p.dentro = 0;
    const r2 = this.cfg.raio * this.cfg.raio;
    for (const x of this.corrida.carros) if (x !== c && !x.chegou && x.pos.distanceToSquared(c.pos) <= r2) p.dentro |= 1 << x.indice;
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
      p.ativo = false; p.onda = ONDA;
      const r2 = cfg.raio * cfg.raio;
      for (const x of this.corrida.carros) {
        if (x === p.dono || x.chegou) continue;
        if (x.pos.distanceToSquared(p.pos) <= r2) P.acerta('encolhedor', p.dono, x);
        else if (p.dentro & (1 << x.indice)) P.esquivou('encolhedor', p.dono, x);
      }
      _p.copy(p.pos).addScaledVector(p.cima, 1.2);
      this.ef.clarao(_p, 12, COR, 0.35, 0.8);
    }
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.encolhido[k] > 0) {
        c.mod.escala *= cfg.escala; c.mod.velMax *= cfg.velMax; c.mod.massa *= cfg.massa;
        this.encolhido[k] -= dt;
        if (this.encolhido[k] <= 0) { this.encolhido[k] = 0; P.fim('encolhedor', c); this._pop(c); }
      }
    }
  }

  aplicaEm(alvo) {
    this.encolhido[alvo.indice] = this.cfg.duracao;
    this.P.centro(alvo, _p);
    this.ef.explosao(_p, 26, COR_BRILHO, { vel: 5, sobe: 2, tam: 0.45, vida: 0.6, grav: 1 });
    return true;
  }

  /** Contra-ataque: capsula desencolhe na hora. */
  aoPegarCapsula(c) {
    const k = c.indice;
    if (!(this.encolhido[k] > 0)) return;
    this.encolhido[k] = 0;
    this.P.fim('encolhedor', c);
    this._pop(c);
  }

  _pop(c) { this.P.centro(c, _p); this.ef.explosao(_p, 20, COR_BRILHO, { vel: 7, sobe: 3, tam: 0.5, vida: 0.5, grav: 4 }); this.ef.clarao(_p, 5, COR_BRILHO, 0.25, 0.9); }

  iaDeveUsar(c) { return this.P.rivaisPerto(c, this.cfg.raio * 0.8) >= 1; }
  /** (o HUD ja mostra o icone do encolhido pela mod.escala: nao repete aqui) */
  ativoEm() { return 0; }
  /** s que faltam para `c` voltar ao tamanho (suites e IA). */
  restaEncolhido(c) { return this.encolhido[c.indice]; }
  ameacaPara(c) { const r2 = this.cfg.raio ** 2; for (const p of this.pulsos) if (p.ativo && p.dono !== c && c.pos.distanceToSquared(p.pos) <= r2) return true; return false; }

  quadro() {
    const cfg = this.cfg, A = this.ef.aneis;
    for (const p of this.pulsos) {
      if (p.anel < 0) continue;
      _X.crossVectors(p.cima, p.frente).normalize();
      if (p.ativo) {
        // a borda do raio parada e a onda roxa crescendo ate ela (o estouro e quando chega)
        const u = Math.min(1, p.t / cfg.carga), pisca = 0.8 + 0.2 * Math.sin(p.t * 30);
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, cfg.raio, ALTURA_DO_ANEL * 0.55, cfg.raio);
        A.poe(p.borda, _M, COR.r, COR.g, COR.b, 0.75 * pisca);
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, Math.max(1.5, cfg.raio * u), ALTURA_DO_ANEL, Math.max(1.5, cfg.raio * u));
        A.poe(p.anel, _M, COR_BRILHO.r * 0.8, COR_BRILHO.g * 0.7, COR_BRILHO.b * 0.85, 0.95 * pisca);
        const S = this.corrida.pista.sup(p.dono.sup);
        this.ef.circulos.poe(p.circ2, S, p.dono.s, p.dono.d, cfg.raio, COR.r, COR.g, COR.b, 0.95);
        this.ef.circulos.poe(p.circ, S, p.dono.s, p.dono.d, Math.max(1.5, cfg.raio * u), 0.85, 0.6, 1, 0.8 * pisca);
      } else if (p.onda > 0) {
        // no estouro o anel ENCOLHE para o dono (o desenho do "encolher")
        const u = 1 - p.onda / ONDA;
        matrizDaBase(_M, p.pos, _X, p.cima, p.frente, cfg.raio * (1 - 0.8 * u), ALTURA_DO_ANEL * (1 + u), cfg.raio * (1 - 0.8 * u));
        A.poe(p.anel, _M, COR_BRILHO.r, COR_BRILHO.g, COR_BRILHO.b, 1.1 * (1 - u));
        this.ef.circulos.poe(p.circ, this.corrida.pista.sup(p.dono.sup), p.dono.s, p.dono.d, Math.max(1.5, cfg.raio * (1 - 0.8 * u)), 0.85, 0.6, 1, 0.9 * (1 - u));
      }
    }
    // brilhinhos roxos em quem esta encolhido
    for (const c of this.corrida.carros) {
      if (!(this.encolhido[c.indice] > 0) || aleatorio() > this.ef.q(0.35)) continue;
      this.P.centro(c, _p);
      this.ef.pingos.solta(_p.x + (aleatorio() - 0.5) * 1.5, _p.y + aleatorio(), _p.z + (aleatorio() - 0.5) * 1.5, c.vel.x * 0.9, c.vel.y * 0.9 + 1.2, c.vel.z * 0.9,
        COR_BRILHO.r, COR_BRILHO.g, COR_BRILHO.b, 0.35, 0.05, 1, 0.45, -0.5, 0.5);
    }
  }

  destroi() { for (const p of this.pulsos || []) { this.ef.aneis.solta(p.anel); this.ef.aneis.solta(p.borda); this.ef.circulos.solta(p.circ); this.ef.circulos.solta(p.circ2); } }
}
