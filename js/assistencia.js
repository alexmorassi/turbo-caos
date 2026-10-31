// AJUDA NA DIRECAO DO JOGADOR (30/10/2026). O Morassi: "o controle para virar o carro esta muito sensivel, o carro esta virando demais
// e o jogador fica andando em zigue-zague. Nem crianca nem adulto estao conseguindo se manter na pista."
//
// POR QUE ZIGUE-ZAGUE: na fisica (js/carro.js) o rumo psi, relativo a pista, NAO volta sozinho — soltou a direcao, o carro segue torto
// ate o muro; numa curva, solto, ele aponta para fora (psi' = w - kh s'). E o giro com a direcao toda e forte (1,5 rad/s a 36 m/s). Todo
// toque pedia um contra-toque, e o contra-toque, feito por gente (com atraso de reacao), passava do ponto. A IA nao sofre disso: ela
// fecha a malha a 60 Hz (js/ia.js). E POR QUE SAIA NA CURVA: com o pe no fundo o carro chega em curvas que ele nao faz naquela
// velocidade (ver TIRA O PE em config/fisica.js AJUDA) — a IA freia antes, a crianca nao.
//
// O QUE FAZ (SO o comando do jogador, chamado por js/entrada.js aplicaNoCarro; a fisica e a IA nao mudam):
//   * O DEDO PEDE UM ANGULO EM RELACAO A ESTRADA, NAO UM GIRO: arrastar ate a ponta = "ande torto para la" a LATERAL_MAX m/s de lado
//     (13 graus a 36 m/s, 24 a 20 m/s); meio arrasto, meio angulo; solto = angulo zero = paralelo a pista. Com o giro (antes) a posicao do carro
//     era a integral da integral do dedo, e quem corrige com atraso de reacao passava do ponto — o zigue-zague. Com o angulo, a posicao
//     e so a integral: a correcao assenta (medido com a "crianca" de testes/teste_direcao.js);
//   * O ANGULO E O RUMO DE VERDADE — a direcao em que o carro anda, chi = psi + o escorregamento (na curva o pneu escorrega ~8 graus
//     para fora; segurar so o bico deixava o carro ir de lado ate o muro) — e chega no pedido a SEGUE por segundo;
//   * A ESTRADA VEM SOZINHA: soma o giro que a curva pede (kh x s', lido OLHA_A_FRENTE s adiante). Solto, o carro faz a curva e fica na
//     faixa dele (d nao e corrigido: a crianca escolhe a faixa). O total satura em 1: a curva mais fechada continua possivel;
//   * TIRA O PE NA CURVA QUE NAO DA (`pedaisAssistidos`): acima do teto de velocidade da curva a frente (o raio de giro do proprio carro
//     com FRACAO_DA_CURVA do volante, e a frenagem macia de AJUDA.FREIO para chegar nele), solta o acelerador e freia de leve;
//   * DESLIGADA: no ar, derrapando (o drift e de proposito), de re ou devagar (abaixo de VEL_MIN; ate VEL_CHEIA ela cresce aos poucos),
//     atravessado (|psi| > PSI_MAX: rodou, bateu) e sem controle (gelo, rodopio, tornado — a fisica ja ignora o comando).
// Numeros em config/fisica.js (AJUDA). Medido em testes/teste_direcao.js (solto numa pista de verdade, troca de faixa, "crianca" com
// atraso de reacao que corrige demais). Nada alocado no passo (o teto de cada tira e calculado uma vez e guardado).
import { FISICA as F } from '../config/fisica.js';
import { MARCA } from './pista.js';

const A = F.AJUDA;
const limita = (x, a, b) => (x < a ? a : x > b ? b : x);
const SEM_TETO = 1e9;

/** A ajuda vale para este carro agora? (no chao, andando para a frente, nao atravessado, com controle, sem derrapar) */
function ajudaVale(carro) {
  if (!carro || !carro.noChao || carro.derrapando || !(carro.vf > A.VEL_MIN) || Math.abs(carro.psi) > A.PSI_MAX) return false;
  const ef = carro.efeitos;
  if (ef && (ef.gelo > 0 || ef.rodopio > 0 || ef.levantado > 0)) return false;
  return !!(carro.corrida && carro.corrida.pista && carro.p);
}

/** Direcao final (-1..1) do carro do jogador: o que ele pediu (relativo a estrada) + a ajuda. Sem ajuda possivel, devolve o pedido. */
export function direcaoAssistida(carro, pedido) {
  const u = limita(pedido || 0, -1, 1);
  if (!ajudaVale(carro)) return u;
  const v = carro.vf;
  // giro por unidade de direcao — o mesmo de js/carro.js: w = direcao * v / raio(v) * mod.direcao, raio(v) cresce com v2
  const q = v / F.VEL_REFERENCIA;
  const raio = F.RAIO_MINIMO + (carro.p.raioRef - F.RAIO_MINIMO) * q * q;
  const porUnidade = (v / raio) * ((carro.mod && carro.mod.direcao) || 1);
  if (!(porUnidade > 1e-3)) return u;
  const peso = limita((v - A.VEL_MIN) / (A.VEL_CHEIA - A.VEL_MIN), 0, 1);
  // o giro que a ESTRADA pede para o rumo nao mudar (psi' = w - kh s', com s' = V_T / (1 - kh d))
  const sup = carro.corrida.pista.sup(carro.sup);
  const kh = sup.khEm(carro.s + v * A.OLHA_A_FRENTE);
  const cs = Math.cos(carro.psi), sn = Math.sin(carro.psi), vr = carro.vr || 0;
  const VT = v * cs - vr * sn, VR = v * sn + vr * cs;
  const sPonto = VT / Math.max(0.2, 1 - kh * carro.d);
  const curva = A.CURVA * kh * sPonto;
  // o angulo que o dedo pede (relativo a estrada) e o rumo de verdade (para onde a velocidade aponta, com o escorregamento)
  const angMax = Math.min(A.ANGULO_TETO, Math.asin(Math.min(1, A.LATERAL_MAX / v)));
  const chi = Math.atan2(VR, Math.max(0.5, VT));
  const segue = A.SEGUE * (u * angMax - chi);
  // devagar (entre VEL_MIN e VEL_CHEIA) a ajuda entra aos poucos por cima do dedo cru
  return limita((1 - peso) * u + (peso * (curva + segue)) / porUnidade, -1, 1);
}

// --------------------------------------------------------------------------------------------- tira o pe na curva que nao da
/** teto[i] (m/s) por amostra de uma tira para um raio de referencia: guardado por superficie (a pista e remontada a cada largada). */
const _tetos = new WeakMap();

function tetoDaTira(sup, raioRef) {
  let porRaio = _tetos.get(sup);
  if (!porRaio) { porRaio = new Map(); _tetos.set(sup, porRaio); }
  let t = porRaio.get(raioRef);
  if (t) return t;
  const n = sup.n, ds = sup.ds;
  t = new Float32Array(n);
  // a curva sozinha: raio(v) = FRACAO / |kh| (a inversa da conta da fisica), com a curvatura media em +-CURVA_JANELA m (o volante leva
  // ~0,15 s para chegar: o carro nao segue o pico de 2 m na emenda da spline — e a mesma conta da inspecao das pistas)
  const jan = Math.max(1, Math.round(A.CURVA_JANELA / ds));
  for (let i = 0; i < n; i++) {
    let soma = 0, m = 0;
    for (let j = -jan; j <= jan; j++) { const q = sup.fechada ? sup.idx(i + j) : i + j; if (q < 0 || q >= n) continue; soma += Math.abs(sup.kh[q]); m++; }
    const k = soma / Math.max(1, m);
    if (k < 1e-4) { t[i] = SEM_TETO; continue; }
    const R = A.FRACAO_DA_CURVA / k;
    t[i] = R <= F.RAIO_MINIMO + 0.3 ? 4 : F.VEL_REFERENCIA * Math.sqrt((R - F.RAIO_MINIMO) / (raioRef - F.RAIO_MINIMO));
  }
  // frenagem macia para chegar no teto (de tras para a frente; a principal da a volta: duas passadas)
  const voltas = sup.fechada ? 2 : 1;
  for (let p = 0; p < voltas; p++) {
    for (let i = n - 2 + (sup.fechada ? 1 : 0); i >= 0; i--) {
      const prox = t[sup.idx(i + 1)];
      if (prox >= SEM_TETO) continue;
      const v = Math.sqrt(prox * prox + 2 * A.FREIO * ds);
      if (v < t[i]) t[i] = v;
    }
  }
  // antes de salto, nenhum teto: ele precisa da velocidade (a crista e o vao decidem, nao a curva); no loop, paredao e saca-rolha
  // (MAGNETICO) e em volta deles, tambem nao: a fisica garante a velocidade minima e a faixa de impulso de antes e para isso
  const livre = Math.round(A.SALTO_LIVRE / ds), folga = Math.round(A.CURVA_FIGURA_LIVRE / ds);
  for (let i = 0; i < n; i++) {
    const mk = sup.marcas[i];
    if (mk & (MARCA.VAO | MARCA.LANCA)) for (let k = 0; k <= livre; k++) { const j = i - k; if (j < 0 && !sup.fechada) break; t[sup.idx(j)] = SEM_TETO; }
    if (mk & MARCA.MAGNETICO) for (let k = -folga; k <= folga; k++) { const j = i + k; if ((j < 0 || j >= n) && !sup.fechada) continue; t[sup.idx(j)] = SEM_TETO; }
  }
  porRaio.set(raioRef, t);
  return t;
}

/** Teto de velocidade (m/s) do carro agora: a curva a frente (OLHA_TETO s) na tira dele. Sem teto: um numero enorme. */
export function tetoDaCurva(carro) {
  if (!ajudaVale(carro)) return SEM_TETO;
  const sup = carro.corrida.pista.sup(carro.sup);
  const t = tetoDaTira(sup, carro.p.raioRef);
  const x = sup.normaliza(carro.s + carro.vf * A.OLHA_TETO) / sup.ds;
  let i = Math.floor(x);
  if (!sup.fechada && i >= sup.n - 1) return t[sup.n - 1];
  const a = t[sup.idx(i)], b = t[sup.idx(i + 1)];
  return a >= SEM_TETO || b >= SEM_TETO ? Math.min(a, b) : a + (b - a) * (x - i);
}

/** Acelerador e freio do jogador com o "tira o pe": acima do teto da curva, solta o acelerador e freia de leve. Escreve em `ctl`. */
export function pedaisAssistidos(carro, ctl) {
  const teto = tetoDaCurva(carro);
  const passou = carro.vf - teto;
  if (!(passou > 0.3)) return false;
  ctl.acel = 0;
  ctl.freio = Math.max(ctl.freio || 0, Math.min(A.FREIO_MAX, passou * A.FREIO_POR_MS));
  return true;
}
