// PODER 7 — CORTINA DE FUMACA (Kombosa). Uma nuvem colorida (a Kombi paz e amor) fica na pista ATRAS do carro por `duracao` s: elipse de
// `raio` m de meio comprimento ao longo da pista e `meiaLargura` m de meia largura atravessada. Quem esta DENTRO tem mod.visao (o HUD da
// fase 6 embaca a tela do jogador; a IA da fase 5 perde precisao), mais forte no meio. ESQUIVA (verdade aqui): "A nuvem nao cobre a
// pista toda: passe pelo lado" — como o oleo, a nuvem e posta deixando `livre` m de faixa para o centro do carro passar (dComFaixaLivre;
// em atalho estreito ela afina). Fumaca vale no ar tambem (ate ALTURA_DA_NUVEM).
// Escudo: o carro com escudo que entra fica imune a ESTA nuvem e quem mandou fica com a visao embacada `cegoDevolvido` s.
// Visual: bolotas de fumaca em tons pastel (billboards normais reservados em js/efeitos.js: tamanho sem limite de ponto do celular),
// crescendo ao nascer, girando devagar e afinando no ultimo segundo.
import * as THREE from 'three';
import { PoderBase, difS, dComFaixaLivre, chaoPara, MEIA_CARRO } from './comum.js';
import { MARCA } from '../pista.js';
import { aleatorio } from '../efeitos.js';

const MAX_NUVENS = 4;
const BOLOTAS = 16;                 // por nuvem (x qualidade na hora de desenhar)
const ALTURA_DA_NUVEM = 5;          // m: acima disto (voando alto) passa por cima
const PASSOU_PERTO = 3;             // m alem da meia largura: passou ao lado = desviou
const PROIBIDO = MARCA.MAGNETICO;   // nuvem no loop ficaria de lado; no vao pode (fumaca flutua)
// tons da Kombi paz e amor: rosa, lilas, azul, menta, amarelo e branco (pastel forte: pastel fraco vira cinza no celular)
const CORES = [[1.0, 0.62, 0.82], [0.76, 0.62, 1.0], [0.55, 0.8, 1.0], [0.55, 0.98, 0.76], [1.0, 0.92, 0.5], [0.97, 0.97, 1.0]];
const _p = new THREE.Vector3();

export class Fumaca extends PoderBase {
  inicia() {
    this.nuvens = [];
    const base = this.ef.nuvens.reserva(MAX_NUVENS * BOLOTAS);
    for (let k = 0; k < MAX_NUVENS; k++) {
      this.nuvens.push({ ativa: false, dono: null, sup: 0, s: 0, d: 0, mL: 0, t: 0, idade: 0, dentro: 0, imunes: 0, viu: 0,
        slot0: base >= 0 ? base + k * BOLOTAS : -1, u: new Float32Array(BOLOTAS), v: new Float32Array(BOLOTAS), h: new Float32Array(BOLOTAS),
        tam: new Float32Array(BOLOTAS), cor: new Uint8Array(BOLOTAS), fase: new Float32Array(BOLOTAS) });
    }
    this.cego = this.porCarro();
  }

  usa(c) {
    const cfg = this.cfg, pista = this.corrida.pista;
    let n = this.nuvens.find((x) => !x.ativa);
    if (!n) n = this.nuvens.reduce((a, b) => (a.t < b.t ? a : b));
    const sup = pista.sup(c.sup);
    const s = chaoPara(sup, c.s - this.P.meiaComp(c) - cfg.distanciaAtras, PROIBIDO, 2);
    const lim = sup.larguraEm(s) * 0.5 - MEIA_CARRO;
    n.mL = Math.max(1.2, Math.min(cfg.meiaLargura, lim - cfg.livre * 0.5));
    n.ativa = true; n.dono = c; n.sup = c.sup; n.s = s; n.d = dComFaixaLivre(c.d, n.mL, lim, cfg.livre);
    n.t = cfg.duracao; n.idade = 0; n.dentro = 0; n.imunes = 0; n.viu = 0;
    for (let k = 0; k < BOLOTAS; k++) {
      // espalhadas na elipse (mais no meio), cada uma de um tom
      const a = aleatorio() * Math.PI * 2, r = Math.sqrt(aleatorio()) * 0.85;
      n.u[k] = Math.cos(a) * r; n.v[k] = Math.sin(a) * r; n.h[k] = 0.8 + aleatorio() * 2.6;
      n.tam[k] = 4.2 + aleatorio() * 3.4; n.cor[k] = (aleatorio() * CORES.length) | 0; n.fase[k] = aleatorio() * 6.283;
    }
    return true;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg, pista = this.corrida.pista;
    for (const n of this.nuvens) {
      if (!n.ativa) continue;
      n.t -= dt; n.idade += dt;
      if (n.t <= 0) { n.ativa = false; continue; }
      const sup = pista.sup(n.sup), forca = Math.min(1, n.t / 1.0) * Math.min(1, n.idade / 0.3);
      for (const x of this.corrida.carros) {
        if (x === n.dono || x.chegou || x.sup !== n.sup || x.h > ALTURA_DA_NUVEM) continue;
        const bit = 1 << x.indice;
        const ds = difS(sup, n.s, x.s), dd = x.d - n.d;
        const q = (ds / cfg.raio) * (ds / cfg.raio) + (dd / n.mL) * (dd / n.mL);
        if (q < 1) {
          if (n.imunes & bit) continue;
          if (!(n.dentro & bit)) { n.dentro |= bit; if (!P.acerta('fumaca', n.dono, x)) { n.imunes |= bit; continue; } }
          x.mod.visao = Math.max(x.mod.visao || 0, cfg.visao * (1 - 0.45 * q) * forca);
        } else if (!(n.viu & bit) && !(n.dentro & bit) && ds >= 0 && ds < cfg.raio && Math.abs(dd) < n.mL + PASSOU_PERTO) {
          n.viu |= bit; P.esquivou('fumaca', n.dono, x);
        }
      }
    }
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.cego[k] > 0) {
        c.mod.visao = Math.max(c.mod.visao || 0, cfg.visao * 0.9);
        this.cego[k] -= dt;
        if (this.cego[k] <= 0) { this.cego[k] = 0; P.fim('fumaca', c); }
      }
    }
  }

  aplicaEm(alvo, de, refletido) {
    if (refletido) this.cego[alvo.indice] = this.cfg.cegoDevolvido;
    return true;
  }

  iaDeveUsar(c) {
    const atras = this.P.carroAtras(c, 35);
    return !!atras && -this.P.delta(c, atras) > 4;
  }

  ativoEm(c) {
    // dentro de alguma nuvem agora (a mod.visao deste passo) ou embacado pelo escudo
    let r = this.cego[c.indice];
    for (const n of this.nuvens) if (n.ativa && (n.dentro & (1 << c.indice)) && c.mod.visao > 0.05) r = Math.max(r, 0.1);
    return r;
  }

  perigos(P) { for (const n of this.nuvens) if (n.ativa) P.perigo('fumaca', n.sup, n.s, n.d, n.mL, this.cfg.raio, n.dono); }

  ameacaPara(c) {
    const sup = this.corrida.pista.sup(c.sup);
    for (const n of this.nuvens) {
      if (!n.ativa || n.sup !== c.sup || n.dono === c) continue;
      const ds = difS(sup, c.s, n.s);
      if (ds > -this.cfg.raio && ds < 40 && Math.abs(c.d - n.d) < n.mL + 1) return true;
    }
    return false;
  }

  quadro() {
    const pista = this.corrida.pista, B = this.ef.nuvens, cfg = this.cfg, t = this.ef.tempo, q = this.ef.q(1);
    const nVis = Math.max(4, Math.round(BOLOTAS * q));
    for (const n of this.nuvens) {
      if (n.slot0 < 0) continue;
      if (!n.ativa) { for (let k = 0; k < BOLOTAS; k++) B.poe(n.slot0 + k, 0, 0, 0, 0, 0, 0, 0, 0); continue; }
      const sup = pista.sup(n.sup), nasce = Math.min(1, n.idade / 0.45), some = Math.min(1, n.t / 1.2);
      for (let k = 0; k < BOLOTAS; k++) {
        if (k >= nVis) { B.poe(n.slot0 + k, 0, 0, 0, 0, 0, 0, 0, 0); continue; }
        const vai = Math.sin(t * 0.7 + n.fase[k]) * 0.6;
        sup.ponto(n.s + n.u[k] * cfg.raio + vai, n.d + n.v[k] * n.mL * 0.9, n.h[k] + 0.4 * Math.sin(t * 0.9 + n.fase[k]), _p);
        const cor = CORES[n.cor[k]], tam = n.tam[k] * (0.45 + 0.55 * nasce) * (1 + 0.12 * (1 - some));
        B.poe(n.slot0 + k, _p.x, _p.y, _p.z, tam, cor[0], cor[1], cor[2], 0.9 * some * Math.min(1, nasce * 1.5), n.fase[k] + t * 0.25 * (k % 2 ? 1 : -1));
      }
    }
  }
}
