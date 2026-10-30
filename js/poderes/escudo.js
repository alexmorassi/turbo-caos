// PODER 9 — ESCUDO REFLETOR (Dourado B7). Uma bolha dourada em volta do dono por `duracao` s OU ate ser atingida: bloqueia o PROXIMO
// poder (inclusive poca de oleo e nuvem de fumaca) e o DEVOLVE para quem mandou — quem faz isso e o gerente (js/poderes.js acerta):
// bloqueado -> `poder:bloqueado`, a bolha estoura, e o efeito vai para quem mandou (`aplicaEm(de, alvo, true)`). Nos poderes de area o
// dono do escudo fica imune e quem mandou leva. ESQUIVA (para quem ataca; verdade aqui): "Contra o escudo, espere ele acabar antes de
// atacar" — a bolha dura `duracao` s e some sozinha (poder:fim), e a IA dos outros nao gasta poder nela (iaDeveUsar do Troca-Troca).
// A IA liga o escudo quando ha AMEACA: projetil/raio/mira/pulso vindo nela ou rival perto com poder pronto que a alcanca.
// Visual: elipsoide dourada com borda acesa (fresnel, js/efeitos.js Bolhas), pisca no ultimo segundo e meio, estilhaca ao bloquear.
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase } from '../efeitos.js';

const FOLGA = 0.75;                // m da bolha alem do carro (visual)
const PISCA_ANTES = 1.5;           // s: pisca avisando que vai acabar
const COR = { r: 1.0, g: 0.8, b: 0.3 }, COR_CACO = { r: 1.0, g: 0.9, b: 0.5 };
const _p = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Escudo extends PoderBase {
  inicia() {
    const n = this.corrida.carros.length;
    this.resta = this.porCarro();
    this.slot = new Int16Array(n).fill(-1);
    this.bloqueios = 0;   // quantos poderes o escudo ja bloqueou (relatorio/suite)
  }

  usa(c) {
    this.resta[c.indice] = this.cfg.duracao;
    this.P.centro(c, _p);
    this.ef.clarao(_p, 8, COR, 0.35, 0.9);
    return true;
  }

  ativo(c) { return !!c && this.resta[c.indice] > 0; }

  /** Bloqueou um poder: a bolha estoura (o gerente emite poder:bloqueado e devolve). */
  quebra(c) {
    if (!this.ativo(c)) return;
    this.resta[c.indice] = 0;
    this.bloqueios++;
    this.P.centro(c, _p);
    this.ef.explosao(_p, 40, COR_CACO, { vel: 9, sobe: 2, tam: 0.55, vida: 0.7, grav: 6 });
    this.ef.clarao(_p, 9, COR, 0.3, 1);
    this.P.fim('escudo', c);
  }

  passo(dt) {
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.resta[k] > 0) { this.resta[k] -= dt; if (this.resta[k] <= 0) { this.resta[k] = 0; this.P.fim('escudo', c); } }
    }
  }

  /** O escudo nao "acerta" ninguem: nunca e devolvido. */
  aplicaEm() { return null; }
  iaDeveUsar(c) { return this.P.ameacado(c); }
  ativoEm(c) { return this.resta[c.indice]; }

  quadro() {
    const B = this.ef.bolhas, t = this.ef.tempo;
    for (const c of this.corrida.carros) {
      const k = c.indice, r = this.resta[k];
      if (r > 0) {
        if (this.slot[k] < 0) this.slot[k] = B.pega();
        const e = (c.visual && c.visual.escala) || 1, p = c.p;
        _X.copy(c.direita).negate();
        _p.copy(c.pos).addScaledVector(c.cima, p.altura * 0.5 * e);
        matrizDaBase(_M, _p, _X, c.cima, c.frente, p.largura * 0.5 * e + FOLGA, p.altura * 0.5 * e + FOLGA, p.comprimento * 0.5 * e + FOLGA);
        const nasce = Math.min(1, (this.cfg.duracao - r) / 0.2);
        const pisca = r < PISCA_ANTES ? 0.45 + 0.55 * (Math.sin(t * 22) > 0 ? 1 : 0.2) : 0.85 + 0.15 * Math.sin(t * 4);
        B.poe(this.slot[k], _M, COR.r, COR.g, COR.b, 0.9 * pisca * nasce);
      } else if (this.slot[k] >= 0) { B.solta(this.slot[k]); this.slot[k] = -1; }
    }
  }

  destroi() { for (let k = 0; k < (this.slot || []).length; k++) if (this.slot[k] >= 0) this.ef.bolhas.solta(this.slot[k]); }
}
