// PODER 5 — TROCA-TROCA (Jatinho). MIRA por `mira` s no carro logo a frente (o mais perto a frente pela pista, ate `alcance` m — um feixe
// rosa liga os dois e um anel cerca o alvo) e, no fim, TROCA os dois de lugar (estadoDePista/aplicaEstadoDePista: cada um leva a PROPRIA
// velocidade para o lugar novo — js/carro.js). ESQUIVA (verdade aqui): "A mira demora um segundo: ligue o TURBO para escapar dela" — o
// alvo com o turbo LIGADO em qualquer passo da mira quebra a mira (poder:esquivou); sair do alcance (`foge` x alcance) tambem.
// O jogador mirado ve "Ligue o TURBO!" na tela (e assim que a crianca aprende o contra-golpe).
// Sem ninguem a frente o feixe sai, procura e se apaga (o poder foi gasto: a IA so usa com alvo — iaDeveUsar).
// Escudo: a troca bate no escudo e VOLTA — quem mandou troca com quem vem logo ATRAS dele (o "devolver" de uma troca; trocar com o dono
// do escudo de novo seria a mesma troca). Sem ninguem atras, a troca so falha.
// A volta conta certo depois da troca: a corrida (js/corrida.js _regras) ve o s pular a linha e soma/tira a volta de cada um.
import * as THREE from 'three';
import { PoderBase } from './comum.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_MIRAS = 4;
const PROCURA = 0.45;                       // s do feixe sem alvo (visual)
const ALTURA = 1.0;                         // m do feixe (visual)
const FEIXE_FINO = 0.8, FEIXE_GROSSO = 2.0;   // m da fita no comeco e no fim da mira (visual; com 0,35..1,25 m a foto de tras nao mostrava o feixe)
const COR = { r: 1.0, g: 0.35, b: 0.85 }, COR_FLASH = { r: 1.0, g: 0.6, b: 0.95 };
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _X = new THREE.Vector3(), _M = new THREE.Matrix4();

export class TrocaTroca extends PoderBase {
  inicia() {
    this.miras = [];
    for (let k = 0; k < MAX_MIRAS; k++) this.miras.push({ ativo: false, dono: null, alvo: null, t: 0, feixe: -1, anel: -1 });
    this.trocas = 0;     // quantas trocas aconteceram (relatorio/suite)
  }

  usa(c) {
    const m = this.miras.find((x) => !x.ativo) || this.miras[0];
    m.ativo = true; m.dono = c; m.t = 0;
    m.alvo = this.P.carroAFrente(c, this.cfg.alcance);
    if (m.feixe < 0) m.feixe = this.ef.feixes.pega();
    if (m.alvo) {
      if (m.anel < 0) m.anel = this.ef.aneis.pega();
    }
    return true;
  }

  _termina(m) {
    m.ativo = false; m.alvo = null;
    this.ef.feixes.solta(m.feixe); m.feixe = -1;
    this.ef.aneis.solta(m.anel); m.anel = -1;
  }

  passo(dt) {
    const P = this.P, cfg = this.cfg;
    for (const m of this.miras) {
      if (!m.ativo) continue;
      m.t += dt;
      if (!m.alvo) { if (m.t >= PROCURA) this._termina(m); continue; }
      const a = m.alvo, frente = P.delta(m.dono, a);
      // o dono passou o alvo (ninguem para trocar a frente): acaba sem evento
      if (frente <= 0 || m.dono.chegou) { this._termina(m); continue; }
      if (a.chegou || (a.turbo && a.turbo.ativo) || frente > cfg.alcance * cfg.foge) { P.esquivou('trocatroca', m.dono, a); this._termina(m); continue; }
      if (m.t >= cfg.mira) { P.acerta('trocatroca', m.dono, a); this._termina(m); }
    }
  }

  /** Troca os dois de lugar (cada um com a propria velocidade). */
  _troca(a, b) {
    const ea = a.estadoDePista(), eb = b.estadoDePista();
    a.aplicaEstadoDePista(eb); b.aplicaEstadoDePista(ea);
    this.trocas++;
    for (const c of [a, b]) {
      this.P.centro(c, _p);
      this.ef.clarao(_p, 7, COR_FLASH, 0.4, 1);
      this.ef.explosao(_p, 22, COR, { vel: 6, sobe: 2, tam: 0.5, vida: 0.55, grav: 2 });
    }
    this.P.som('trocatroca', a.pos);
  }

  aplicaEm(alvo, de, refletido) {
    if (!refletido) { this._troca(de, alvo); return true; }
    // devolvido pelo Escudo: `alvo` e quem mandou; troca com quem vem logo atras dele
    const atras = this.P.carroAtras(alvo, this.cfg.alcance);
    if (!atras || atras === de) return null;
    this._troca(alvo, atras);
    return true;
  }

  iaDeveUsar(c) {
    const P = this.P, a = P.carroAFrente(c, this.cfg.alcance * 0.8);
    return !!a && P.delta(c, a) > 6 && !(a.turbo && a.turbo.ativo) && !P.escudoAtivo(a);
  }

  ativoEm(c) {
    for (const m of this.miras) if (m.ativo && m.alvo === c) return Math.max(0.01, this.cfg.mira - m.t);
    return 0;
  }

  ameacaPara(c) { for (const m of this.miras) if (m.ativo && m.alvo === c) return true; return false; }

  quadro() {
    const F = this.ef.feixes, seg = F.seg, pista = this.corrida.pista, cfg = this.cfg;
    for (const m of this.miras) {
      if (!m.ativo || m.feixe < 0) continue;
      const pts = F.pontos[m.feixe], d = m.dono;
      if (!m.alvo) {
        // procurando: o feixe sai reto pela pista e apaga
        const sup = pista.sup(d.sup), u = Math.min(1, m.t / PROCURA);
        for (let k = 0; k <= seg; k++) sup.ponto(d.s + this.P.meiaComp(d) + (cfg.alcance * 0.5 * u * k) / seg, d.d, ALTURA, pts[k]);
        F.define(m.feixe, seg + 1, FEIXE_FINO, COR.r, COR.g, COR.b, 0.9 * (1 - u));
        continue;
      }
      const a = m.alvo, u = Math.min(1, m.t / cfg.mira);
      if (a.sup === d.sup) {
        // mesma tira: o feixe segue a pista de um ao outro (na curva nao corta por fora)
        const sup = pista.sup(d.sup);
        let ds = a.s - d.s;
        if (sup.fechada) { const L = sup.comprimento; ds = ((ds % L) + L) % L; if (ds > L * 0.5) ds -= L; }
        for (let k = 0; k <= seg; k++) { const f = k / seg; sup.ponto(d.s + ds * f, d.d + (a.d - d.d) * f, ALTURA + Math.sin(f * Math.PI) * 0.8, pts[k]); }
      } else {
        this.P.centro(d, _p); this.P.centro(a, _q);
        for (let k = 0; k <= seg; k++) pts[k].lerpVectors(_p, _q, k / seg);
      }
      // o feixe engrossa e pisca mais rapido conforme a mira fecha (a crianca sente o "vai trocar!")
      const pisca = 0.7 + 0.3 * Math.sin(m.t * (14 + 30 * u));
      F.define(m.feixe, seg + 1, FEIXE_FINO + (FEIXE_GROSSO - FEIXE_FINO) * u, COR.r, COR.g, COR.b, pisca);
      if (m.anel >= 0) {
        _X.copy(a.direita).negate();
        const r = 3.4 - 1.0 * u;
        matrizDaBase(_M, a.pos, _X, a.cima, a.frente, r, 1.8, r);
        this.ef.aneis.poe(m.anel, _M, COR.r, COR.g, COR.b, pisca);
      }
      if (aleatorio() < this.ef.q(0.5)) { const P2 = pts[seg]; this.ef.pingos.solta(P2.x, P2.y, P2.z, (aleatorio() - 0.5) * 3, aleatorio() * 2, (aleatorio() - 0.5) * 3, COR.r, COR.g, COR.b, 0.4, 0.1, 1, 0.3, 0, 1); }
    }
  }

  destroi() { for (const m of this.miras || []) if (m.ativo) this._termina(m); }
}
