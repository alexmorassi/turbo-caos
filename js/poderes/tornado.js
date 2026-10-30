// PODER 8 — MINI TORNADO (Voador). Um projetil que ANDA PELA PISTA (segue a superficie: curva, subida, loop, atalho) a `velocidade` m/s
// ate `alcance` m, mirando DE LEVE no primeiro carro a frente: so corrige a faixa (d) a `mira` m/s, e so com o alvo a menos de `miraDe`
// m. O primeiro carro que encostar (3D, `raioAcerto`) e LEVANTADO girando (js/carro.js levanta). ESQUIVA (verdade aqui): "O tornado mira
// de leve: desvie para o lado na hora certa" — o carro vira de lado a 8-12 m/s e o tornado so acompanha a `mira` m/s; quem esta no ar por
// cima dele (salto) tambem passa. Quem foi ultrapassado sem ser pego escapou (poder:esquivou) e o tornado mira no proximo.
// Ele vem POR TRAS do alvo (fora da camera do jogador): o jogador alvo ve "Tornado vindo!" AVISO_TORNADO s antes e ouve o vento.
// Visual: funil girando (listras em diagonal, js/efeitos.js Funis), poeira e folhas na base.
import * as THREE from 'three';
import { PoderBase, difS, limita } from './comum.js';
import { PODERES_GERAL } from '../../config/poderes.js';
import { matrizDaBase, aleatorio } from '../efeitos.js';

const MAX_TORNADOS = 4;
const SOME = 0.35;                      // s apagando (visual)
const ALTURA_DO_CENTRO = 1.0;           // m: o meio do funil que acerta (o funil desenhado tem ~4,3 m)
const BEIRA = 1.0;                      // m da beira: o tornado nao sai do asfalto
const PASSOU = 4;                       // m: o tornado passou o alvo por isto sem pegar = o alvo escapou
const JANELA_SAIDA = 30;                // amostras: fim de atalho -> principal (a boca de saida tem 12 m)
const COR = { r: 0.55, g: 1.0, b: 0.6 }, COR_POEIRA = { r: 0.72, g: 0.82, b: 0.6 }, COR_FOLHA = { r: 0.45, g: 0.9, b: 0.35 };
const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3(), _X = new THREE.Vector3(), _Z = new THREE.Vector3(), _M = new THREE.Matrix4();
const _proj = { i: 0, s: 0, d: 0, h: 0, dist2: 0 };

export class Tornado extends PoderBase {
  inicia() {
    this.tornados = [];
    for (let k = 0; k < MAX_TORNADOS; k++) this.tornados.push({ ativo: false, voando: false, dono: null, sup: 0, s: 0, d: 0, percorrido: 0, alvo: null, avisou: false, some: 0, slot: -1, giro: 0, pos: new THREE.Vector3() });
    this.levantado = new Uint8Array(this.corrida.carros.length);
  }

  usa(c) {
    const t = this.tornados.find((x) => !x.ativo) || this.tornados[0];
    t.ativo = true; t.voando = true; t.dono = c; t.sup = c.sup;
    t.s = c.s + this.P.meiaComp(c) + 2; t.d = c.d; t.percorrido = 0; t.some = 0; t.giro = 0;
    t.alvo = this.P.carroAFrente(c, this.cfg.alcance); t.avisou = false;
    if (t.slot < 0) t.slot = this.ef.funis.pega();
    this._posicao(t);
    return true;
  }

  _posicao(t) {
    const sup = this.corrida.pista.sup(t.sup);
    sup.ponto(t.s, t.d, ALTURA_DO_CENTRO, t.pos);
  }

  /** Progresso do tornado na volta (para saber quem esta a frente dele). */
  _progresso(t) { return this.corrida.pista.sPrincipal(t.sup, t.s); }

  passo(dt) {
    const P = this.P, cfg = this.cfg, pista = this.corrida.pista;
    for (const t of this.tornados) {
      if (!t.ativo) continue;
      if (!t.voando) { t.some -= dt; if (t.some <= 0) { t.ativo = false; this.ef.funis.solta(t.slot); t.slot = -1; } continue; }
      let sup = pista.sup(t.sup);
      // mira de leve: so a faixa, devagar, e so com o alvo perto e na mesma tira
      const a = t.alvo;
      if (a && !a.chegou && a.sup === t.sup) {
        const ds = difS(sup, t.s, a.s);
        if (ds > -2 && ds < cfg.miraDe) t.d += limita(a.d - t.d, -cfg.mira * dt, cfg.mira * dt);
      }
      t.s += cfg.velocidade * dt; t.percorrido += cfg.velocidade * dt;
      if (sup.fechada) t.s = sup.normaliza(t.s);
      else if (t.s >= sup.comprimento - 1) {
        // fim do atalho: continua na principal (projeta como o carro em js/carro.js _saiDoAtalho)
        const at = pista.atalhos[t.sup - 1], Pr = pista.principal;
        sup.ponto(Math.min(t.s, sup.comprimento), t.d, 0, _p);
        Pr.projeta(_p, Math.round(at.sSaida / Pr.ds), JANELA_SAIDA, _proj);
        t.sup = 0; t.s = _proj.s; t.d = _proj.d; sup = Pr;
      }
      const lim = sup.larguraEm(t.s) * 0.5 - BEIRA;
      t.d = limita(t.d, -lim, lim);
      this._posicao(t);
      // acerta o primeiro que encostar
      const r2 = cfg.raioAcerto * cfg.raioAcerto;
      let pegou = null;
      for (const x of this.corrida.carros) {
        if (x === t.dono || x.chegou) continue;
        if (P.centro(x, _c).distanceToSquared(t.pos) <= r2) { pegou = x; break; }
      }
      if (pegou) { P.acerta('tornado', t.dono, pegou); t.voando = false; t.some = SOME; continue; }
      // o alvo ficou para tras sem ser pego: escapou, mira no proximo
      const pt = this._progresso(t);
      if (a && !a.chegou && P.deltaP(P.progresso(a), pt) > PASSOU) {
        P.esquivou('tornado', t.dono, a);
        t.alvo = P.aFrenteDoProgresso(pt, cfg.alcance - t.percorrido, t.dono); t.avisou = false;
      }
      // o jogador alvo e avisado (ele vem por tras)
      const b = t.alvo;
      if (b && b.ehJogador && !t.avisou) {
        const falta = P.deltaP(pt, P.progresso(b)), fecha = Math.max(5, cfg.velocidade - (b.velocidade || 0));
        if (falta > 0 && falta / fecha < PODERES_GERAL.AVISO_TORNADO) { t.avisou = true; P.aviso(b, 'Tornado vindo! Desvie!', 'ruim', '🌪️'); P.som('tornado', t.pos); }
      }
      if (t.percorrido >= cfg.alcance) { t.voando = false; t.some = SOME; }
    }
    for (const c of this.corrida.carros) {
      const k = c.indice;
      if (this.levantado[k] && !(c.efeitos.levantado > 0) && c.noChao) { this.levantado[k] = 0; P.fim('tornado', c); }
    }
  }

  aplicaEm(alvo) {
    alvo.levanta(this.cfg.levanta);
    this.levantado[alvo.indice] = 1;
    this.P.centro(alvo, _p);
    this.ef.explosao(_p, 24, COR_FOLHA, { vel: 6, sobe: 5, tam: 0.5, vida: 0.9, grav: 3 });
    return true;
  }

  iaDeveUsar(c) {
    const a = this.P.carroAFrente(c, this.cfg.alcance * 0.7);
    return !!a && this.P.delta(c, a) > 10;
  }

  perigos(P) { for (const t of this.tornados) if (t.ativo && t.voando) P.perigo('tornado', t.sup, t.s, t.d, this.cfg.raioAcerto, 0, t.dono, t.alvo); }
  ameacaPara(c) { for (const t of this.tornados) if (t.ativo && t.voando && t.alvo === c) return true; return false; }

  quadro(dt) {
    const pista = this.corrida.pista, F = this.ef.funis, q = this.ef.q(1);
    for (const t of this.tornados) {
      if (!t.ativo || t.slot < 0) continue;
      const sup = pista.sup(t.sup);
      t.giro += 9 * Math.min(dt || 0, 0.1);
      sup.quadro(t.s, _T, _N, _R);
      // gira em volta do "cima" da pista
      const cg = Math.cos(t.giro), sg = Math.sin(t.giro);
      _X.copy(_R).multiplyScalar(cg).addScaledVector(_T, sg);
      _Z.crossVectors(_X, _N);
      sup.ponto(t.s, t.d, 0, _p);
      const a = t.voando ? Math.min(1, t.percorrido / 6) : Math.max(0, t.some / SOME);
      // ~6 m de altura: o tornado tem de aparecer de longe (ele corre a 75 m/s) e passar por cima do carro que ele levanta
      const esc = 1.3 * (0.9 + 0.1 * Math.sin(t.giro * 1.7));
      matrizDaBase(_M, _p, _X, _N, _Z, esc, 1.4, esc);
      F.poe(t.slot, _M, COR.r, COR.g, COR.b, 0.9 * a);
      if (t.voando && aleatorio() < q) {
        // poeira e folhas rodando na base
        const ang = aleatorio() * 6.283, r = 0.6 + aleatorio() * 1.2;
        _c.copy(_p).addScaledVector(_R, Math.cos(ang) * r).addScaledVector(_T, Math.sin(ang) * r);
        const v = this.cfg.velocidade * 0.85;
        this.ef.pingos.solta(_c.x, _c.y + 0.3, _c.z, _T.x * v - Math.sin(ang) * 5, _N.y * 3 + 2, _T.z * v + Math.cos(ang) * 5,
          COR_FOLHA.r, COR_FOLHA.g, COR_FOLHA.b, 0.5, 0.15, 1, 0.4, 2, 1);
        if (aleatorio() < 0.5) this.ef.bolota(_c, _T.multiplyScalar(v * 0.9), 1.2, 3.2, COR_POEIRA, 0.45, 0.5);
      }
    }
  }

  destroi() { for (const t of this.tornados || []) if (t.slot >= 0) this.ef.funis.solta(t.slot); }
}
