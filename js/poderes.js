// OS 10 PODERES — o GERENTE (fase 4). Contrato: docs/CONTRATOS.md secao 8 (`podeUsar`, `usa`, `iaDeveUsar`, `recarga`, `ativosEm`,
// `perigos`) e os eventos da secao 3 (`poder:usa`, `poder:acerta`/`bloqueado`/`esquivou`, `poder:fim`). Cada poder mora no seu arquivo
// (js/poderes/<id>.js, base em js/poderes/comum.js); os numeros em config/poderes.js; o visual em js/efeitos.js.
//
// COMO (e por que):
//   * UM poder por carro (config/carros.js `poder`), recarga por TEMPO (o anel do botao). A corrida larga com o poder carregando: fica
//     pronto PRIMEIRA_RECARGA s depois do VAI (pedido: "pronto ~5 s apos a largada") — ninguem dispara na grade;
//   * quem dispara e o `controle.poder` (o toque do jogador, borda; ou a IA) lido aqui no passo — com o carro CONGELADO o toque quebra o
//     gelo (js/carro.js ja faz; `quebraGelo` vale uma vez por passo) e NAO dispara;
//   * todo acerto passa por `acerta()`: o ESCUDO bloqueia e DEVOLVE (o efeito vai para quem mandou: `aplicaEm(de, alvo, true)`), e o
//     devolvido nao volta de novo (dois escudos nao viram pingue-pongue). Nos poderes de AREA o dono do escudo fica imune e quem mandou
//     leva o efeito;
//   * todo poder tem efeito visual, som (o audio da fase 6 toca o do poder no `poder:usa`; momentos extras com G.audio.toca) e esquiva
//     que se VE (o feixe, o funil, o circulo, a mira): a crianca aprende o poder do outro jogando. Mensagem no meio da tela, nenhuma
//     (pedido do Morassi, 30/10/2026: atrapalhava o jogo — js/hud.js);
//   * determinismo: nada de Math.random/G.sorteio aqui (o visual tem gerador proprio). Nada alocado no passo alem dos objetos dos eventos
//     (raros) — perigos() e ativosEm() devolvem arrays e objetos reaproveitados.
import { PODERES, ORDEM_DOS_PODERES, PODERES_GERAL as GERAL } from '../config/poderes.js';
import { emite, on } from './eventos.js';
import { efeitosDaCorrida, largaEfeitos } from './efeitos.js';
import { Oleo } from './poderes/oleo.js';
import { Emp } from './poderes/emp.js';
import { Congelante } from './poderes/congelante.js';
import { Ima } from './poderes/ima.js';
import { TrocaTroca } from './poderes/trocatroca.js';
import { Encolhedor } from './poderes/encolhedor.js';
import { Fumaca } from './poderes/fumaca.js';
import { Tornado } from './poderes/tornado.js';
import { Escudo } from './poderes/escudo.js';
import { Terremoto } from './poderes/terremoto.js';

const CLASSES = { oleo: Oleo, emp: Emp, congelante: Congelante, ima: Ima, trocatroca: TrocaTroca, encolhedor: Encolhedor, fumaca: Fumaca, tornado: Tornado, escudo: Escudo, terremoto: Terremoto };
/** Poderes que atacam quem esta A FRENTE do dono (o resto — oleo e fumaca — pega quem vem atras; o escudo nao ataca). */
const ATACA_A_FRENTE = new Set(['emp', 'congelante', 'ima', 'trocatroca', 'encolhedor', 'tornado', 'terremoto']);
const ATACA_ATRAS = new Set(['oleo', 'fumaca']);
/** Ameaca que faz a IA ligar o Escudo: rival a menos disto (m de pista) com o poder pronto. */
const AMEACA_PERTO = 40;

export class Poderes {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    this.efeitos = efeitosDaCorrida(G, corrida);
    this.mods = {};
    for (const id of ORDEM_DOS_PODERES) this.mods[id] = new CLASSES[id](this, PODERES[id], id);
    this.lista = ORDEM_DOS_PODERES.map((id) => this.mods[id]);
    this._perigos = []; this._poolPerigos = []; this._nPerigos = 0;
    this._ativos = [];
    this._desligar = [on('capsula:pega', (e) => { if (e && e.carro) for (const m of this.lista) m.aoPegarCapsula(e.carro); })];
  }

  get pista() { return this.corrida.pista; }
  get carros() { return this.corrida.carros; }

  inicia() {
    for (const c of this.corrida.carros) {
      const id = c.cfg && PODERES[c.cfg.poder] ? c.cfg.poder : ORDEM_DOS_PODERES[0];
      c.poder = { id, restante: GERAL.PRIMEIRA_RECARGA, total: GERAL.PRIMEIRA_RECARGA, usos: 0 };
    }
    for (const m of this.lista) m.inicia();
  }

  // ================================================================================================================  o passo
  passo(dt) {
    const cs = this.corrida.carros;
    for (const c of cs) { const p = c.poder; if (p && p.restante > 0) p.restante = Math.max(0, p.restante - dt); }
    for (const c of cs) {
      if (!c.controle || !c.controle.poder) continue;
      // congelado: o toque quebra o gelo e nao dispara (a fisica tambem chama; vale uma vez por passo)
      if (c.efeitos && c.efeitos.gelo > 0) { c.quebraGelo(); continue; }
      this.usa(c);
    }
    for (const m of this.lista) m.passo(dt);
  }

  // ================================================================================================================  contrato
  /** Pronto para disparar? (correndo, recarga cheia, nao chegou, nao congelado) */
  podeUsar(c) {
    return !!(c && c.poder && this.corrida.estado === 'correndo' && !c.chegou && c.poder.restante <= 0 && !(c.efeitos && c.efeitos.gelo > 0));
  }

  /** Dispara o poder do carro (se puder). Devolve true se disparou. */
  usa(c) {
    if (!this.podeUsar(c)) return false;
    const id = c.poder.id, m = this.mods[id];
    if (!m || m.usa(c) === false) return false;
    const cfg = PODERES[id];
    c.poder.restante = cfg.recarga; c.poder.total = cfg.recarga; c.poder.usos++;
    emite('poder:usa', { carro: c, poder: id });
    return true;
  }

  /** A IA deve disparar agora? (heuristica do poder DAQUELE carro; falso se nao estiver pronto) */
  iaDeveUsar(c) {
    if (!this.podeUsar(c)) return false;
    const m = this.mods[c.poder.id];
    return !!(m && m.iaDeveUsar(c));
  }

  /** Anel do botao: 0 (acabou de usar) .. 1 (pronto). */
  recarga(c) {
    const p = c && c.poder;
    if (!p || !(p.total > 0)) return 1;
    const r = 1 - p.restante / p.total;
    return r < 0 ? 0 : r > 1 ? 1 : r;
  }

  /** Efeitos de poder em `c` agora (para o HUD): [{ poder, id, resta }] — os que a fisica NAO mostra sozinha (gelo, rodopio,
   *  levantado e mod.escala ja viram icone no HUD: repetir daria dois iguais). Array e objetos reaproveitados. */
  ativosEm(c) {
    if (!c) return [];
    const k = c.indice | 0;
    let out = this._ativos[k];
    if (!out) { out = []; out._pool = this.lista.map((m) => ({ poder: m.id, id: m.id, resta: 0 })); this._ativos[k] = out; }
    out.length = 0;
    for (let i = 0; i < this.lista.length; i++) {
      const r = this.lista[i].ativoEm(c);
      if (r > 0) { const o = out._pool[i]; o.resta = r; out.push(o); }
    }
    return out;
  }

  /** O que esta NA PISTA agora e a IA pode desviar: [{ tipo, sup, s, d, raio, comprimento, dono, alvo }] (array e objetos
   *  reaproveitados: valem ate a proxima chamada). Tipos: 'oleo' (poca parada, raio = de contato), 'fumaca' (nuvem parada: raio = meia
   *  largura, comprimento = meio comprimento) e 'tornado' (andando a frente: alvo = quem ele mira). Os pulsos (EMP, Encolhedor,
   *  Terremoto) e o raio congelante NAO entram: nao sao obstaculo de faixa (a IA desviaria de um "obstaculo" de 90 m). */
  perigos() {
    this._perigos.length = 0; this._nPerigos = 0;
    for (const m of this.lista) m.perigos(this);
    return this._perigos;
  }
  perigo(tipo, sup, s, d, raio, comprimento = 0, dono = null, alvo = null) {
    let o = this._poolPerigos[this._nPerigos];
    if (!o) { o = { tipo: '', sup: 0, s: 0, d: 0, raio: 0, comprimento: 0, dono: null, alvo: null }; this._poolPerigos.push(o); }
    o.tipo = tipo; o.sup = sup; o.s = s; o.d = d; o.raio = raio; o.comprimento = comprimento; o.dono = dono; o.alvo = alvo;
    this._nPerigos++;
    this._perigos.push(o);
    return o;
  }

  // ================================================================================================================  acertos
  /** Todo acerto passa aqui: Escudo (bloqueia e devolve), efeito e evento. Devolve true se o efeito foi aplicado em `alvo`. */
  acerta(id, de, alvo, refletido = false) {
    if (!alvo || alvo === de) return false;
    const esc = this.mods.escudo;
    if (esc.ativo(alvo)) {
      esc.quebra(alvo);
      emite('poder:bloqueado', { de, alvo, poder: id });
      // devolve para quem mandou (o devolvido nao volta: refletido = true)
      if (!refletido && de && de !== alvo && !de.chegou) this.acerta(id, alvo, de, true);
      return false;
    }
    const r = this.mods[id].aplicaEm(alvo, de, refletido);
    if (r === true) emite('poder:acerta', { de, alvo, poder: id });
    else if (r === false) emite('poder:esquivou', { de, alvo, poder: id });
    return r === true;
  }
  esquivou(id, de, alvo) { if (alvo) emite('poder:esquivou', { de, alvo, poder: id }); }
  fim(id, alvo) { if (alvo) emite('poder:fim', { alvo, poder: id }); }
  escudoAtivo(c) { return this.mods.escudo.ativo(c); }

  // ================================================================================================================  ajudas dos poderes
  /** Progresso na volta (s equivalente na principal). */
  progresso(c) { return this.corrida.pista.sPrincipal(c.sup, c.s); }
  /** Progresso de `b` menos o de `a`, entre -L/2 e L/2 (positivo = b esta a frente). */
  delta(a, b) { return this.deltaP(this.progresso(a), this.progresso(b)); }
  deltaP(p0, p1) { const L = this.corrida.pista.comprimento; let d = ((p1 - p0) % L + L) % L; if (d >= L * 0.5) d -= L; return d; }
  /** O rival mais perto A FRENTE de `c` (ate `alcance` m de pista), que ainda corre. */
  carroAFrente(c, alcance) { return this.aFrenteDoProgresso(this.progresso(c), alcance, c); }
  aFrenteDoProgresso(p0, alcance, exclui, exclui2 = null) {
    let melhor = null, md = Infinity;
    for (const x of this.corrida.carros) {
      if (x === exclui || x === exclui2 || x.chegou) continue;
      const d = this.deltaP(p0, this.progresso(x));
      if (d > 0 && d <= alcance && d < md) { md = d; melhor = x; }
    }
    return melhor;
  }
  /** O rival mais perto ATRAS de `c` (ate `alcance` m). */
  carroAtras(c, alcance) {
    let melhor = null, md = Infinity;
    const p0 = this.progresso(c);
    for (const x of this.corrida.carros) {
      if (x === c || x.chegou) continue;
      const d = -this.deltaP(p0, this.progresso(x));
      if (d > 0 && d <= alcance && d < md) { md = d; melhor = x; }
    }
    return melhor;
  }
  /** Quantos rivais de `c` estao a menos de `raio` m (3D). `soNoChao`: so os que estao no chao. */
  rivaisPerto(c, raio, soNoChao = false) {
    let n = 0;
    const r2 = raio * raio;
    for (const x of this.corrida.carros) {
      if (x === c || x.chegou) continue;
      if (soNoChao && !x.noChao) continue;
      if (x.pos.distanceToSquared(c.pos) <= r2) n++;
    }
    return n;
  }
  /** Centro do carro (m acima do asfalto pelo `cima`, x escala). */
  centro(c, out) { return out.copy(c.pos).addScaledVector(c.cima, GERAL.ALTURA_DO_CENTRO * ((c.mod && c.mod.escala) || 1)); }
  meiaComp(c) { return c.p.comprimento * 0.5 * ((c.mod && c.mod.escala) || 1); }
  meiaLarg(c) { return c.p.largura * 0.5 * ((c.mod && c.mod.escala) || 1); }
  /** Tremor da camera SO no jogador. */
  treme(c, intensidade, seg) { const cam = this.corrida.camera; if (c && c.ehJogador && cam && cam.treme) cam.treme(intensidade, seg); }
  /** Som de um momento extra (o do disparo o audio ja toca no poder:usa). */
  som(nome, pos = null) { const a = this.G.audio; if (a && a.toca) a.toca(nome, pos ? { pos } : undefined); }

  /** Algo ameaca `c` agora? (o Escudo da IA): projetil/raio/mira/pulso vindo nele, ou rival perto com poder pronto que alcanca `c`. */
  ameacado(c) {
    for (const m of this.lista) if (m.ameacaPara(c)) return true;
    const p0 = this.progresso(c);
    for (const x of this.corrida.carros) {
      if (x === c || x.chegou || !x.poder || x.poder.restante > 0) continue;
      const d = this.deltaP(p0, this.progresso(x));   // > 0: x esta a frente de c
      if (d < 0 && -d <= AMEACA_PERTO && ATACA_A_FRENTE.has(x.poder.id)) return true;
      if (d > 0 && d <= AMEACA_PERTO && ATACA_ATRAS.has(x.poder.id)) return true;
    }
    return false;
  }

  // ================================================================================================================  desenho
  quadro(dt) {
    for (const m of this.lista) m.quadro(dt);
    this.efeitos.quadro(dt);
  }

  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    for (const m of this.lista) m.destroi();
    largaEfeitos(this.corrida);
  }
}

