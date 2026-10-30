// BASE COMUM DOS 10 PODERES (fase 4). Cada poder mora em js/poderes/<id>.js e estende `PoderBase`; o gerente (js/poderes.js) chama,
// nesta ordem, no passo: `passo(dt)` de todos (projeteis, pulsos, pocas e os efeitos que duram, aplicados no `mod` do carro) — e quando um
// carro aperta PODER, `usa(carro)`. Quem ACERTA alguem nunca aplica o efeito direto: chama `P.acerta(id, de, alvo)`, que confere o Escudo
// (bloqueia e devolve: `aplicaEm(de, alvo, true)`) e emite os eventos. Por isso todo poder tem `aplicaEm(alvo, de, refletido)`:
//   true  = aplicou (evento poder:acerta), false = o alvo escapou (poder:esquivou), null = nada aconteceu (sem evento).
// Tudo que dura por carro mora em Float32Array por indice do carro (alocado no `inicia`, nunca no passo).
export const DUAS_PI = Math.PI * 2;
export const limita = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Meia largura de carro (m) que a faixa livre de oleo e fumaca respeita: todos cabem em 2,3 m (config/carros.js). */
export const MEIA_CARRO = 1.15;

/** Diferenca de s numa tira (fechada: entre -L/2 e L/2). */
export function difS(sup, a, b) {
  let ds = b - a;
  if (sup.fechada) { const L = sup.comprimento; ds = ((ds % L) + L) % L; if (ds >= L * 0.5) ds -= L; }
  return ds;
}

/** Onde por uma coisa de "raio lateral" R na faixa `d0`, deixando `livre` m para o CENTRO do carro passar de um lado (o "nao ocupa a
 *  pista inteira" do oleo e da fumaca). `lim` = o |d| maximo do centro do carro ali. Devolve o d. */
export function dComFaixaLivre(d0, R, lim, livre) {
  const dMaxPos = lim - livre - R, dMinNeg = -lim + livre + R;
  if (d0 <= dMaxPos || d0 >= dMinNeg) return limita(d0, -lim, lim);
  return d0 - dMaxPos < dMinNeg - d0 ? dMaxPos : dMinNeg;
}

/** Procura chao "de verdade" na tira (sem `proibido` em +-folga m), andando primeiro para TRAS (oleo e fumaca saem atras do carro) e
 *  depois para a frente. Devolve o s ou o proprio s se nao achar. */
export function chaoPara(sup, s, proibido, folga = 3, ate = 40) {
  const ok = (x) => { for (let k = -folga; k <= folga; k++) if (sup.marcasEm(x + k) & proibido) return false; return true; };
  const presa = (x) => (sup.fechada ? sup.normaliza(x) : limita(x, 2, sup.comprimento - 2));
  s = presa(s);
  if (ok(s)) return s;
  for (let k = 2; k <= ate; k += 2) { const a = presa(s - k); if (ok(a)) return a; const b = presa(s + k); if (ok(b)) return b; }
  return s;
}

export class PoderBase {
  constructor(P, cfg, id) {
    this.P = P; this.cfg = cfg; this.id = id;
    this.G = P.G; this.corrida = P.corrida; this.ef = P.efeitos;
  }
  /** Por carro: um Float32Array zerado (chame no inicia). */
  porCarro() { return new Float32Array(Math.max(1, this.corrida.carros.length)); }
  inicia() {}
  /** Disparou (o gerente ja conferiu a recarga). Devolve true. */
  usa() { return true; }
  passo() {}
  /** O efeito no alvo (ver o cabecalho). */
  aplicaEm() { return true; }
  /** Heuristica da IA (o gerente ja conferiu que o poder esta pronto). */
  iaDeveUsar() { return false; }
  /** s restantes do efeito DESTE poder em `carro` (0 = nada), para corrida.poderes.ativosEm. */
  ativoEm() { return 0; }
  /** Escreve os perigos na pista: P.perigo(tipo, sup, s, d, raio, comprimento). */
  perigos() {}
  /** Este poder ameaca `carro` agora? (o Escudo da IA usa) */
  ameacaPara() { return false; }
  aoPegarCapsula() {}
  quadro() {}
  destroi() {}
}
// (cada modulo de poder tem os SEUS vetores temporarios: o `acerta` de um chama o `aplicaEm` de outro no meio da conta — o Escudo
// devolvendo — e um temporario compartilhado seria sobrescrito no caminho)
