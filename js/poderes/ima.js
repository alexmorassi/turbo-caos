// PODER 4 — IMA (Tubarao). Por `duracao` s o dono vira um ima: toda capsula ativa a menos de `raioCapsulas` m voa para ele
// (corrida.capsulas.atrai) e todo rival a menos de `raioCarros` m e SEGURADO (mod.velMax *= freio) enquanto estiver no campo (e
// `segura` s depois de sair: sem pisca-pisca na borda). ESQUIVA (verdade aqui): "Fique longe do campo magnetico (mais de 14 m)" — a conta
// e a distancia 3D ao dono a cada passo, e o anel desenhado tem exatamente esse raio.
// Escudo: o rival com escudo que entra no campo fica imune a ESTE campo e quem mandou fica segurado o campo inteiro (devolvido).
// Visual: anel vermelho pulsando no raio dos carros, linhas de faisca puxando os rivais segurados.
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_CAMPOS = 4;
const PERTO = 1.6;                 // x raioCarros: quem chegou ate aqui e nao foi pego "desviou" (aviso de Escapou!)
const ALTURA_DO_ANEL = 3.4;        // m (visual)
const COR = { r: 1.0, g: 0.25, b: 0.4 }, COR2 = { r: 0.45, g: 0.6, b: 1.0 };
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Ima extends PoderBase {
  inicia() {
    this.campos = [];
    for (let k = 0; k < MAX_CAMPOS; k++) this.campos.push({ ativo: false, dono: null, t: 0, presos: 0, imunes: 0, perto: 0, anel: -1, anel2: -1, circ: -1 });
    this.preso = this.porCarro();
  }

  usa(c) {
    const f = this.campos.find((x) => !x.ativo) || this.campos[0];
    f.ativo = true; f.dono = c; f.t = this.cfg.duracao; f.presos = 0; f.imunes = 0; f.perto = 0;
    if (f.anel < 0) f.anel = this.ef.aneis.pega();
    if (f.anel2 < 0) f.anel2 = this.ef.aneis.pega();
    if (f.circ < 0) f.circ = this.ef.circulos.pega();
    return true;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg, caps = this.corrida.capsulas;
    const r2 = cfg.raioCarros * cfg.raioCarros, rp2 = r2 * PERTO * PERTO;
    for (const f of this.campos) {
      if (!f.ativo) continue;
      f.t -= dt;
      if (caps && caps.atrai) caps.atrai(f.dono.pos, cfg.raioCapsulas, f.dono);
      for (const x of this.corrida.carros) {
        if (x === f.dono || x.chegou) continue;
        const bit = 1 << x.indice, d2 = x.pos.distanceToSquared(f.dono.pos);
        if (d2 <= rp2) f.perto |= bit;
        if (d2 > r2) continue;
        if (!((f.presos | f.imunes) & bit)) { if (P.acerta('ima', f.dono, x)) f.presos |= bit; else f.imunes |= bit; }
        if (f.presos & bit) this.preso[x.indice] = Math.max(this.preso[x.indice], cfg.segura);
      }
      if (f.t <= 0) {
        f.ativo = false;
        this.ef.aneis.solta(f.anel); this.ef.aneis.solta(f.anel2); f.anel = f.anel2 = -1; this.ef.circulos.solta(f.circ); f.circ = -1;
        for (const x of this.corrida.carros) { const bit = 1 << x.indice; if ((f.perto & bit) && !((f.presos | f.imunes) & bit)) P.esquivou('ima', f.dono, x); }
      }
    }
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.preso[k] > 0) {
        c.mod.velMax *= cfg.freio;
        this.preso[k] -= dt;
        if (this.preso[k] <= 0) { this.preso[k] = 0; P.fim('ima', c); }
      }
    }
  }

  aplicaEm(alvo, de, refletido) {
    // direto: segurado enquanto estiver no campo (o passo renova); devolvido pelo Escudo: o dono do ima fica segurado o campo inteiro
    this.preso[alvo.indice] = Math.max(this.preso[alvo.indice], refletido ? this.cfg.duracao : this.cfg.segura);
    return true;
  }

  iaDeveUsar(c) {
    const cfg = this.cfg, caps = this.corrida.capsulas;
    if (this.P.rivaisPerto(c, cfg.raioCarros * 0.9) >= 1) return true;
    return !!(caps && caps.contaPerto && caps.contaPerto(c.pos, cfg.raioCapsulas * 0.8) >= 2);
  }

  ativoEm(c) {
    let r = this.preso[c.indice];
    for (const f of this.campos) if (f.ativo && f.dono === c) r = Math.max(r, f.t);
    return r;
  }

  ameacaPara(c) {
    const r2 = (this.cfg.raioCarros * 1.4) ** 2;
    for (const f of this.campos) if (f.ativo && f.dono !== c && c.pos.distanceToSquared(f.dono.pos) <= r2) return true;
    return false;
  }

  quadro(dt) {
    const cfg = this.cfg, A = this.ef.aneis, t = this.ef.tempo;
    for (const f of this.campos) {
      if (!f.ativo || f.anel < 0) continue;
      const c = f.dono, nasce = Math.min(1, (cfg.duracao - f.t) / 0.25), some = Math.min(1, f.t / 0.3);
      _X.crossVectors(c.cima, c.frente).normalize();
      const pulso = 0.8 + 0.2 * Math.sin(t * 12);
      matrizDaBase(_M, c.pos, _X, c.cima, c.frente, cfg.raioCarros * nasce, ALTURA_DO_ANEL, cfg.raioCarros * nasce);
      A.poe(f.anel, _M, COR.r, COR.g, COR.b, 0.85 * pulso * some);
      // anel de dentro "puxando" (encolhe em laco: o campo suga)
      const u = (t * 1.6) % 1;
      matrizDaBase(_M, c.pos, _X, c.cima, c.frente, cfg.raioCarros * (1 - u) * nasce + 1.5, ALTURA_DO_ANEL * 0.5, cfg.raioCarros * (1 - u) * nasce + 1.5);
      A.poe(f.anel2, _M, COR2.r, COR2.g, COR2.b, 0.7 * u * some);
      this.ef.circulos.poe(f.circ, this.corrida.pista.sup(c.sup), c.s, c.d, cfg.raioCarros * nasce, COR.r, COR.g, COR.b, 0.9 * pulso * some);
      // faiscas dos segurados indo para o ima
      for (const x of this.corrida.carros) {
        if (!(f.presos & (1 << x.indice)) || !(this.preso[x.indice] > 0) || aleatorio() > this.ef.q(0.8)) continue;
        this.P.centro(x, _p); this.P.centro(c, _q);
        _q.sub(_p);
        const d = _q.length() || 1;
        _q.multiplyScalar(Math.min(30, d * 3) / d);
        this.ef.pingos.solta(_p.x, _p.y, _p.z, _q.x + x.vel.x, _q.y + x.vel.y, _q.z + x.vel.z, COR.r, COR.g * 1.5, COR.b * 1.4, 0.45, 0.15, 1, 0.3, 0, 0);
      }
    }
  }

  destroi() { for (const f of this.campos || []) { this.ef.aneis.solta(f.anel); this.ef.aneis.solta(f.anel2); this.ef.circulos.solta(f.circ); } }
}
