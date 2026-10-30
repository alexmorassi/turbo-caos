// PODER 3 — RAIO CONGELANTE (Picole). Um raio de gelo sai da frente do carro e CORRE PELA PISTA na faixa (d) em que foi disparado, a
// `velocidadeDoRaio` m/s, ate `alcance` m; o primeiro carro que estiver nessa faixa (meia largura do raio + meio carro) fica congelado
// `duracao` s (js/carro.js congela: sem controle, freia forte) dentro de um bloco de gelo. ESQUIVA (verdade aqui): "O raio vai reto: mude
// de faixa" — a faixa do raio e a do disparo, nao segue ninguem; "Congelado? Toque rapido no PODER para quebrar o gelo" — js/carro.js
// tira FISICA.GELO_POR_TOQUE a cada toque (e o gerente nao dispara poder de carro congelado).
// O raio corre pela pista (e nao em linha reta no mundo) porque na curva uma reta de 70 m sairia da pista pelo lado de dentro e acertaria
// quem a crianca nem ve; pela faixa, o que acerta e o que esta "na mesma pista, mais a frente".
// Visual: fita de luz gelada seguindo a curva (js/efeitos.js Feixes), ponta brilhante, cristais; bloco de gelo translucido no alvo,
// que estilhaca quando derrete (poder:fim -> o audio toca gelo_quebra no jogador).
import * as THREE from 'three';
import { PoderBase, difS } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_RAIOS = 4;
const SOME = 0.25;                         // s que o raio leva para apagar depois de acertar/acabar (visual)
const ALTURA = 0.9;                        // m acima do asfalto (visual; o acerto e pela faixa e pela altura do carro)
const ALTURA_MAX_DO_ALVO = 2.5;            // m: carro voando mais alto que isto passa por cima do raio
const CRISTAIS_NA_FITA = 3;                // faiscas por quadro espalhadas ao longo do raio (o corpo do raio brilha, nao so a ponta)
const COR = { r: 0.3, g: 0.85, b: 1.0 }, COR_GELO = { r: 0.5, g: 0.86, b: 1.0 }, COR_CACO = { r: 0.75, g: 0.95, b: 1.0 };
const _p = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class Congelante extends PoderBase {
  inicia() {
    this.raios = [];
    for (let k = 0; k < MAX_RAIOS; k++) this.raios.push({ ativo: false, voando: false, dono: null, sup: 0, s0: 0, d0: 0, frente: 0, alcance: 0, alvo: null, acertou: false, some: 0, slot: -1 });
    const n = this.corrida.carros.length;
    this.gelado = new Uint8Array(n);
    this.bloco = new Int16Array(n).fill(-1);
  }

  usa(c) {
    const r = this.raios.find((x) => !x.ativo) || this.raios[0];
    const sup = this.corrida.pista.sup(c.sup), cfg = this.cfg;
    r.ativo = true; r.voando = true; r.dono = c; r.sup = c.sup;
    r.s0 = c.s + this.P.meiaComp(c); r.d0 = c.d; r.frente = 0; r.acertou = false; r.some = 0;
    r.alcance = sup.fechada ? cfg.alcance : Math.max(0, Math.min(cfg.alcance, sup.comprimento - r.s0));
    r.alvo = this.P.carroAFrente(c, cfg.alcance);
    if (r.slot < 0) r.slot = this.ef.feixes.pega();
    sup.ponto(r.s0, r.d0, ALTURA, _p);
    this.ef.clarao(_p, 3, COR, 0.15, 0.9);
    return true;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg, pista = this.corrida.pista;
    for (const r of this.raios) {
      if (!r.ativo) continue;
      if (!r.voando) { r.some -= dt; if (r.some <= 0) { r.ativo = false; this.ef.feixes.solta(r.slot); r.slot = -1; } continue; }
      const sup = pista.sup(r.sup), ant = r.frente;
      r.frente = Math.min(r.alcance, r.frente + cfg.velocidadeDoRaio * dt);
      // o primeiro carro na faixa entre a ponta de antes e a de agora
      let alvo = null, melhor = Infinity;
      for (const x of this.corrida.carros) {
        if (x === r.dono || x.chegou || x.sup !== r.sup || Math.abs(x.h) > ALTURA_MAX_DO_ALVO) continue;
        const ds = difS(sup, r.s0, x.s), mc = P.meiaComp(x);
        if (ds + mc < ant || ds - mc > r.frente) continue;
        if (Math.abs(x.d - r.d0) >= cfg.larguraDoRaio * 0.5 + P.meiaLarg(x)) continue;
        if (ds < melhor) { melhor = ds; alvo = x; }
      }
      if (alvo) {
        r.frente = Math.max(0, melhor); r.acertou = true; r.voando = false; r.some = SOME;
        P.acerta('congelante', r.dono, alvo);
      } else if (r.frente >= r.alcance) {
        r.voando = false; r.some = SOME;
        if (r.alvo && !r.alvo.chegou) P.esquivou('congelante', r.dono, r.alvo);
      }
    }
    // o gelo derreteu (tempo ou toques no PODER): estilhaca e avisa
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.gelado[k] && !(c.efeitos.gelo > 0)) {
        this.gelado[k] = 0;
        P.centro(c, _p);
        this.ef.explosao(_p, 30, COR_CACO, { vel: 7, sobe: 3, tam: 0.5, vida: 0.7, grav: 14 });
        P.fim('congelante', c);
      }
    }
  }

  aplicaEm(alvo) {
    alvo.congela(this.cfg.duracao);
    this.gelado[alvo.indice] = 1;
    this.P.centro(alvo, _p);
    this.ef.explosao(_p, 26, COR_GELO, { vel: 5, sobe: 2, tam: 0.5, vida: 0.6, grav: 3 });
    this.ef.clarao(_p, 6, COR, 0.3, 0.9);
    return true;
  }

  iaDeveUsar(c) {
    // so com alvo A FRENTE, EM LINHA (na faixa do raio) e perto
    const cfg = this.cfg, sup = this.corrida.pista.sup(c.sup), P = this.P;
    for (const x of this.corrida.carros) {
      if (x === c || x.chegou || x.sup !== c.sup) continue;
      const ds = difS(sup, c.s, x.s);
      if (ds > 2 && ds < cfg.alcance * 0.85 && Math.abs(x.d - c.d) < cfg.larguraDoRaio * 0.5 + P.meiaLarg(x) * 0.8) return true;
    }
    return false;
  }

  ameacaPara(c) {
    const sup = this.corrida.pista.sup(c.sup);
    for (const r of this.raios) {
      if (!r.ativo || !r.voando || r.dono === c || r.sup !== c.sup) continue;
      const ds = difS(sup, r.s0 + r.frente, c.s);
      if (ds > 0 && ds < this.cfg.alcance && Math.abs(c.d - r.d0) < this.cfg.larguraDoRaio * 0.5 + this.P.meiaLarg(c)) return true;
    }
    return false;
  }

  quadro() {
    const pista = this.corrida.pista, F = this.ef.feixes, seg = F.seg;
    for (const r of this.raios) {
      if (!r.ativo || r.slot < 0) continue;
      const sup = pista.sup(r.sup), pts = F.pontos[r.slot];
      // a cauda acompanha a frente de quem atirou (o raio "sai do carro"); presa no ponto do disparo, o carro passava por cima dela
      let cauda = 0;
      if (r.dono.sup === r.sup) cauda = Math.max(0, Math.min(r.frente - 1, difS(sup, r.s0, r.dono.s + this.P.meiaComp(r.dono))));
      for (let k = 0; k <= seg; k++) sup.ponto(r.s0 + cauda + ((r.frente - cauda) * k) / seg, r.d0, ALTURA, pts[k]);
      const a = r.voando ? 1 : Math.max(0, r.some / SOME);
      // a fita tem a largura da faixa que congela (cfg.larguraDoRaio): o que a crianca ve e o perigo de verdade. Com 1,2 m (primeira
      // versao) a camera de tras via um fio de 5 px: a estrada de 10 a 30 m a frente ocupa so ~40 px de altura na tela
      F.define(r.slot, seg + 1, this.cfg.larguraDoRaio * (r.voando ? 1 : 1 + (1 - a)), COR.r, COR.g, COR.b, a);
      // ponta: cristais saindo; e cristais ao longo do corpo do raio (de tras, a fita sozinha e fina demais para ler)
      if (r.voando && aleatorio() < this.ef.q(1)) {
        const P2 = pts[seg];
        this.ef.faiscas.solta(P2.x, P2.y, P2.z, (aleatorio() - 0.5) * 4, aleatorio() * 3, (aleatorio() - 0.5) * 4, COR_CACO.r, COR_CACO.g, COR_CACO.b, 0.55, 0.1, 1, 0.35, 2, 1);
        this.ef.clarao(P2, 3.4, COR, 0.08, 0.8);
        const n = this.ef.q(CRISTAIS_NA_FITA);
        for (let i = 0; i < n; i++) {
          const Pk = pts[Math.floor(aleatorio() * seg)];
          this.ef.faiscas.solta(Pk.x + (aleatorio() - 0.5) * 0.8, Pk.y + (aleatorio() - 0.3) * 0.6, Pk.z + (aleatorio() - 0.5) * 0.8,
            (aleatorio() - 0.5) * 1.5, 0.5 + aleatorio() * 1.5, (aleatorio() - 0.5) * 1.5, COR_CACO.r, COR_CACO.g, COR_CACO.b, 0.45, 0.1, 1, 0.4, 1, 1);
        }
      }
    }
    // blocos de gelo (encolhe a opacidade quando o gelo esta acabando: a crianca ve que esta quebrando)
    const B = this.ef.gelos;
    for (const c of this.corrida.carros) {
      const k = c.indice, g = c.efeitos.gelo;
      if (this.gelado[k] && g > 0) {
        if (this.bloco[k] < 0) this.bloco[k] = B.pega();
        const e = (c.visual && c.visual.escala) || 1;
        _X.copy(c.direita).negate();
        matrizDaBase(_M, c.pos, _X, c.cima, c.frente, c.p.largura * 1.2 * e, c.p.altura * 1.15 * e, c.p.comprimento * 1.1 * e);
        B.poe(this.bloco[k], _M, COR_GELO.r, COR_GELO.g, COR_GELO.b, 0.55 + 0.4 * Math.min(1, g / 0.6));
      } else if (this.bloco[k] >= 0) { B.solta(this.bloco[k]); this.bloco[k] = -1; }
    }
  }

  destroi() {
    for (const r of this.raios || []) if (r.slot >= 0) this.ef.feixes.solta(r.slot);
    for (let k = 0; k < (this.bloco || []).length; k++) if (this.bloco[k] >= 0) this.ef.gelos.solta(this.bloco[k]);
  }
}
