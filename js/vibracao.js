// VIBRACAO DO CELULAR (fase 6). Um lugar so decide QUANDO e COMO o celular vibra; o resto do jogo so emite o evento (a fisica nao
// sabe que existe vibracao para a batida forte tremer a mao da crianca).
//
// REGRAS (as mesmas do dinotrails-web e do Cidade Aberta, adaptadas ao navigator.vibrate):
//   * toques CURTOS e proporcionais ao evento — vibrar o tempo todo cansa e a crianca desliga;
//   * nada vibra em menu sozinho (so o toque na pista trancada, que e resposta a um dedo);
//   * NO MAXIMO UMA CHAMADA A CADA 110 ms: duas vibracoes coladas viram uma so no driver (a segunda cancela a primeira), entao o
//     atropelo so empobrece o toque (regra do Cidade Aberta);
//   * so depois de um GESTO: o Chrome bloqueia navigator.vibrate antes do primeiro toque e escreve um "[Intervention]" no console —
//     e erro no console reprova a suite;
//   * iPhone nao tem navigator.vibrate: `suportada` fica false e a tela de opcoes esconde a linha da vibracao.
import { on } from './eventos.js';
import * as save from './save.js';

/** Intervalo minimo entre chamadas ao driver, em ms (regra herdada do Cidade Aberta). */
const INTERVALO_MINIMO = 110;
/** Batida que vibra: forca em m/s (carro:batida, docs/CONTRATOS.md secao 3). 7 m/s ~ 25 km/h de diferenca: encostar no rival nao vibra. */
const BATIDA_FORTE = 7;
/** Pouso que vibra (m/s de velocidade vertical no toque): o salto da rampa de teste pousa a ~8 m/s; quiques pequenos nao. */
const POUSO_FORTE = 6;
/** Padroes (ms). Curtos de proposito (ver o cabecalho). */
export const PADROES = {
  batida: 40,
  batida_forte: [60, 40, 50],
  pouso: 35,
  poder_recebido: [30, 50, 30],
  congelado: [20, 30, 20, 30, 20],
  bloqueado: 20,
  queda: 70,
};

export class Vibracao {
  constructor(G) {
    this.G = G;
    this.ligada = save.opcoes().vibracao !== false;
    this.suportada = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    /** quantas vezes chamou o driver (as suites usam) */
    this.vezes = 0;
    this.ultimo = null;
    this._ultimaEm = -1e9;
    this._ouve();
  }

  /** Vibra `p` (ms ou padrao [vibra, pausa, vibra...]) se a opcao deixar. Devolve true se chegou ao driver. */
  vibra(p) {
    if (!this.ligada || !this.suportada || !p) return false;
    // sem gesto ainda: o navegador recusaria e reclamaria no console (ver o cabecalho)
    const ua = typeof navigator !== 'undefined' ? navigator.userActivation : null;
    if (ua && !ua.hasBeenActive) return false;
    const agora = typeof performance !== 'undefined' ? performance.now() : 0;
    if (agora - this._ultimaEm < INTERVALO_MINIMO) return false;
    this._ultimaEm = agora;
    try { navigator.vibrate(p); } catch (e) { return false; }
    this.vezes++;
    this.ultimo = p;
    return true;
  }

  /** Liga/desliga (opcao da tela de opcoes; a tela grava, aqui so aplica). */
  liga(sim) {
    this.ligada = !!sim;
    if (!this.ligada) this.para();
  }

  para() { try { if (this.suportada) navigator.vibrate(0); } catch (e) { /* sem vibracao */ } }

  // ------------------------------------------------------------ eventos (so o carro do JOGADOR vibra o celular)
  _ouve() {
    const eJogador = (c) => !!(c && c.ehJogador);
    on('carro:batida', (e) => {
      if (!(eJogador(e.carro) || eJogador(e.outro))) return;
      const f = e.forca || 0;
      if (f >= BATIDA_FORTE * 1.8) this.vibra(PADROES.batida_forte);
      else if (f >= BATIDA_FORTE) this.vibra(PADROES.batida);
    });
    on('carro:pouso', (e) => { if (eJogador(e.carro) && (e.forca || 0) >= POUSO_FORTE) this.vibra(PADROES.pouso); });
    on('carro:queda', (e) => { if (eJogador(e.carro)) this.vibra(PADROES.queda); });
    on('poder:acerta', (e) => {
      if (!eJogador(e.alvo)) return;
      this.vibra(e.poder === 'congelante' ? PADROES.congelado : PADROES.poder_recebido);
    });
  }
}
