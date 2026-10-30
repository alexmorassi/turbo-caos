// PODER 1 — MANCHA DE OLEO (Lagartixa). Uma poca escura e brilhante fica na pista ATRAS do carro (config: distanciaAtras) por
// `duracao` s; quem passa por cima RODA (js/carro.js rodopia). ESQUIVA (texto do config, verdade aqui): "Desvie da poca — ela nao ocupa a
// pista inteira": a poca e posta de modo que sobra SEMPRE uma faixa de `livre` m para o centro do carro passar ao lado (dComFaixaLivre;
// em atalho estreito a poca encolhe). No ar se passa por cima sem rodar (a poca e no asfalto).
// Cada poca pega cada carro uma vez so (quem esta rodando nao roda de novo na mesma). O dono nao escorrega na propria poca.
// Visual: decalque colado na pista (js/efeitos.js Manchas: a grade acompanha a curva inclinada) + respingos ao cair e ao pegar.
import * as THREE from 'three';
import { PoderBase, difS, dComFaixaLivre, chaoPara, MEIA_CARRO } from './comum.js';
import { MARCA } from '../pista.js';
import { aleatorio } from '../efeitos.js';

const MAX_POCAS = 8;
/** Nao cai em loop (decalque plano num loop de 10 m cortaria o asfalto), vao ou crista. */
const PROIBIDO = MARCA.MAGNETICO | MARCA.VAO | MARCA.LANCA;
/** m de lado alem do contato em que passar perto conta como "desviou" (o aviso de "Escapou!"). */
const PASSOU_PERTO = 3;
const COR_RESPINGO = { r: 0.35, g: 0.22, b: 0.6 };
const _p = new THREE.Vector3();

export class Oleo extends PoderBase {
  inicia() {
    this.pocas = [];
    for (let k = 0; k < MAX_POCAS; k++) this.pocas.push({ ativa: false, sup: 0, s: 0, d: 0, r: 0, R: 0, t: 0, dono: null, pegou: 0, viu: 0, slot: -1, idade: 0 });
    this.rodando = new Uint8Array(this.corrida.carros.length);
  }

  usa(c) {
    const cfg = this.cfg, P = this.P, pista = this.corrida.pista;
    let p = this.pocas.find((x) => !x.ativa);
    if (!p) { p = this.pocas.reduce((a, b) => (a.t < b.t ? a : b)); this.ef.manchas.solta(p.slot); }
    const sup = pista.sup(c.sup);
    const s = chaoPara(sup, c.s - P.meiaComp(c) - cfg.distanciaAtras, PROIBIDO);
    const lim = sup.larguraEm(s) * 0.5 - MEIA_CARRO;
    const R = Math.max(1.0, Math.min(cfg.raio + cfg.contato, lim - cfg.livre * 0.5));
    p.ativa = true; p.sup = c.sup; p.s = s; p.R = R; p.r = Math.max(0.6, R - cfg.contato);
    p.d = dComFaixaLivre(c.d, R, lim, cfg.livre);
    p.t = cfg.duracao; p.idade = 0; p.dono = c; p.pegou = 0; p.viu = 0;
    p.slot = this.ef.manchas.pega();
    // a textura tem a mancha em ~80 % do quadrado: o decalque um pouco maior que o raio de verdade
    this.ef.manchas.coloca(p.slot, sup, p.s, p.d, p.r * 1.25, aleatorio() * Math.PI * 2);
    this.ef.manchas.alfa(p.slot, 0);
    sup.ponto(p.s, p.d, 0.3, _p);
    this.ef.explosao(_p, 14, COR_RESPINGO, { vel: 3, sobe: 2.5, tam: 0.4, vida: 0.5, grav: 12 });
    return true;
  }

  passo(dt) {
    const cs = this.corrida.carros, pista = this.corrida.pista, P = this.P;
    for (const p of this.pocas) {
      if (!p.ativa) continue;
      p.t -= dt; p.idade += dt;
      if (p.t <= 0) { p.ativa = false; this.ef.manchas.solta(p.slot); p.slot = -1; continue; }
      const sup = pista.sup(p.sup);
      for (const c of cs) {
        if (c === p.dono || c.chegou || c.sup !== p.sup || !c.noChao) continue;
        const bit = 1 << c.indice;
        if (p.pegou & bit) continue;
        const ds = difS(sup, p.s, c.s), dd = c.d - p.d;
        if (ds * ds + dd * dd < p.R * p.R) { p.pegou |= bit; P.acerta('oleo', p.dono, c); continue; }
        // passou ao lado (cruzou o meio da poca sem encostar e perto): desviou
        if (!(p.viu & bit) && ds >= 0 && ds < 2.5 && Math.abs(dd) < p.R + PASSOU_PERTO) { p.viu |= bit; P.esquivou('oleo', p.dono, c); }
      }
    }
    for (const c of cs) if (this.rodando[c.indice] && !(c.efeitos.rodopio > 0)) { this.rodando[c.indice] = 0; P.fim('oleo', c); }
  }

  aplicaEm(alvo) {
    alvo.rodopia(this.cfg.rodopio);
    this.rodando[alvo.indice] = 1;
    this.P.centro(alvo, _p);
    this.ef.explosao(_p, 18, COR_RESPINGO, { vel: 5, sobe: 3, tam: 0.45, vida: 0.6, grav: 12 });
    return true;
  }

  iaDeveUsar(c) {
    // alguem colado atras (4 a 30 m): a poca cai na frente dele
    const atras = this.P.carroAtras(c, 30);
    return !!atras && -this.P.delta(c, atras) > 4;
  }

  perigos(P) { for (const p of this.pocas) if (p.ativa) P.perigo('oleo', p.sup, p.s, p.d, p.R, 0, p.dono); }

  ameacaPara(c) {
    // poca na faixa dele logo a frente (mesma tira, ate 40 m)
    const sup = this.corrida.pista.sup(c.sup);
    for (const p of this.pocas) {
      if (!p.ativa || p.sup !== c.sup || p.dono === c) continue;
      const ds = difS(sup, c.s, p.s);
      if (ds > 0 && ds < 40 && Math.abs(p.d - c.d) < p.R + 1) return true;
    }
    return false;
  }

  quadro() {
    for (const p of this.pocas) {
      if (!p.ativa) continue;
      // aparece em 0,15 s e some no ultimo segundo
      this.ef.manchas.alfa(p.slot, Math.min(1, p.idade / 0.15) * Math.min(1, p.t / 1.0) * 0.95);
    }
  }

  destroi() { for (const p of this.pocas || []) if (p.ativa) this.ef.manchas.solta(p.slot); }
}
