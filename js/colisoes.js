// COLISOES CARRO x CARRO (fase 2): `colide(corrida)` e chamado pela corrida DEPOIS do `passo` de todos os carros (docs/CONTRATOS.md
// secoes 5 e 7). 8 carros = 28 pares por passo; cada par custa uma subtracao quando esta longe.
//
// DOIS JEITOS, conforme onde os dois estao:
//   * NO CHAO E NA MESMA TIRA (o caso de 99 % da corrida): caixa em COORDENADAS DA PISTA (s, d) com as medidas x mod.escala, rodada
//     pelo rumo psi (o carro atravessado na derrapagem ocupa mais largura). Resolve no eixo de MENOR penetracao — de lado empurra em d,
//     de traseira empurra em s — dividindo pelo inverso da massa (peso x mod.massa): o pesado anda menos e o leve vai longe (pedido:
//     "quem e mais pesado empurra mais e perde menos na batida"). Troca de velocidade so no eixo da batida, com restituicao baixa e um
//     afastamento minimo (sem isto dois carros de lado ficavam "colados" raspando a corrida inteira).
//   * NO AR OU EM TIRAS DIFERENTES (boca de atalho, salto por cima de alguem): esfera no mundo. Quem esta no chao recebe o empurrao
//     convertido para (s, d) e (vf, vr); quem esta voando, direto em pos/vel.
// `fantasma` (voltou da queda) ignora tudo.
import * as THREE from 'three';
import { emite } from './eventos.js';
import { FISICA as F } from '../config/fisica.js';

const _D = new THREE.Vector3(), _dp = new THREE.Vector3(), _dv = new THREE.Vector3();
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
/** ultimo evento por par (s), por corrida: alocado uma vez so, na primeira chamada */
const _registros = new WeakMap();

function registro(corrida, n) {
  let r = _registros.get(corrida);
  if (!r || r.length !== n * n) { r = new Float64Array(n * n).fill(-1e9); _registros.set(corrida, r); }
  return r;
}

export function colide(corrida) {
  const cs = corrida.carros, n = cs.length;
  if (n < 2 || !corrida.pista) return;
  const reg = registro(corrida, n), t = corrida.G && corrida.G.relogio ? corrida.G.relogio.t : 0;
  for (let a = 0; a < n; a++) {
    const A = cs[a];
    if (A.fantasma > 0) continue;
    for (let b = a + 1; b < n; b++) {
      const B = cs[b];
      if (B.fantasma > 0) continue;
      const forca = A.noChao && B.noChao && A.sup === B.sup ? naPista(corrida, A, B) : noMundo(corrida, A, B);
      if (forca > F.COLISAO_FORCA_EVENTO && t - reg[a * n + b] > F.COLISAO_INTERVALO) {
        reg[a * n + b] = t;
        emite('carro:batida', { carro: A, outro: B, forca, tipo: 'carro' });
        emite('carro:batida', { carro: B, outro: A, forca, tipo: 'carro' });
      }
    }
  }
}

/** Meia extensao do carro ao longo de s (eixo 0) ou de d (eixo 1), rodada pelo psi. */
function meia(c, eixo) {
  const e = c.mod.escala || 1, L = c.p.comprimento * 0.5 * e, W = c.p.largura * 0.5 * e;
  const cs = Math.abs(Math.cos(c.psi)), sn = Math.abs(Math.sin(c.psi));
  return eixo === 0 ? L * cs + W * sn : L * sn + W * cs;
}
const massa = (c) => c.p.massa * (c.mod.massa || 1);

/** Caixa em (s, d). Devolve a forca (m/s de aproximacao) ou 0. */
function naPista(corrida, A, B) {
  const sup = corrida.pista.sup(A.sup);
  let ds = B.s - A.s;
  if (sup.fechada) { const L = sup.comprimento; if (ds > L * 0.5) ds -= L; else if (ds < -L * 0.5) ds += L; }
  const dd = B.d - A.d;
  if (ds > 9 || ds < -9 || dd > 7 || dd < -7) return 0;          // longe: a conta de baixo nem comeca
  const px = meia(A, 0) + meia(B, 0) - Math.abs(ds), py = meia(A, 1) + meia(B, 1) - Math.abs(dd);
  if (px <= 0 || py <= 0) return 0;
  const iA = 1 / massa(A), iB = 1 / massa(B), soma = iA + iB;
  const ca = Math.cos(A.psi), sa = Math.sin(A.psi), cb = Math.cos(B.psi), sb = Math.sin(B.psi);
  let VTa = A.vf * ca - A.vr * sa, VRa = A.vf * sa + A.vr * ca;
  let VTb = B.vf * cb - B.vr * sb, VRb = B.vf * sb + B.vr * cb;
  let forca = 0;
  if (px < py) {
    // um atras do outro: separa em s
    const sinal = ds >= 0 ? 1 : -1;                                  // +1: B esta na frente de A
    A.s = sup.normaliza(A.s - sinal * px * (iA / soma));
    B.s = sup.normaliza(B.s + sinal * px * (iB / soma));
    const u = (VTb - VTa) * sinal;                                   // < 0: aproximando
    const alvo = Math.max(-F.COLISAO_RESTITUICAO * u, F.COLISAO_SEPARA_FRENTE);
    if (u < alvo) {
      const J = (alvo - u) / soma;
      VTa -= sinal * J * iA; VTb += sinal * J * iB;
    }
    forca = Math.max(0, -u);
  } else {
    // lado a lado: separa em d
    const sinal = dd >= 0 ? 1 : -1;                                  // +1: B esta a direita de A
    A.d -= sinal * py * (iA / soma);
    B.d += sinal * py * (iB / soma);
    const u = (VRb - VRa) * sinal;
    const alvo = Math.max(-F.COLISAO_RESTITUICAO * u, F.COLISAO_SEPARA_LADO);
    if (u < alvo) {
      const J = (alvo - u) / soma;
      VRa -= sinal * J * iA; VRb += sinal * J * iB;
    }
    forca = Math.max(0, -u);
  }
  A.vf = VTa * ca + VRa * sa; A.vr = -VTa * sa + VRa * ca;
  B.vf = VTb * cb + VRb * sb; B.vr = -VTb * sb + VRb * cb;
  A._prendeNoMuro(); B._prendeNoMuro();                              // o muro nao se mexe: quem foi empurrado contra ele para nele
  A._atualizaMundo(); B._atualizaMundo();
  return forca;
}

/** Esfera no mundo. Devolve a forca ou 0. */
function noMundo(corrida, A, B) {
  const rA = F.COLISAO_RAIO * (A.p.comprimento + A.p.largura) * (A.mod.escala || 1);
  const rB = F.COLISAO_RAIO * (B.p.comprimento + B.p.largura) * (B.mod.escala || 1);
  _D.subVectors(B.pos, A.pos);
  const d2 = _D.lengthSq(), min = rA + rB;
  if (d2 >= min * min || d2 < 1e-10) return 0;
  const dist = Math.sqrt(d2);
  _D.divideScalar(dist);                                             // normal de A para B
  const iA = 1 / massa(A), iB = 1 / massa(B), soma = iA + iB, pen = min - dist;
  const u = _dv.subVectors(B.vel, A.vel).dot(_D);
  let J = 0;
  if (u < 0) J = (-(1 + F.COLISAO_RESTITUICAO) * u) / soma;
  empurraNoMundo(corrida, A, _dp.copy(_D).multiplyScalar(-pen * (iA / soma)), -J * iA);
  empurraNoMundo(corrida, B, _dp.copy(_D).multiplyScalar(pen * (iB / soma)), J * iB);
  return Math.max(0, -u);
}

/** Desloca `c` por `dp` (mundo) e soma `dvn` m/s ao longo de _D. No chao vira (s, d) e (vf, vr) no quadro da pista. */
function empurraNoMundo(corrida, c, dp, dvn) {
  if (c.estaVoando) {
    c.pos.add(dp);
    c.vel.addScaledVector(_D, dvn);
    return;
  }
  const sup = corrida.pista.sup(c.sup);
  sup.quadro(c.s, _T, _N, _R);
  c.s = sup.normaliza(c.s + dp.dot(_T));
  c.d += dp.dot(_R);
  const cs = Math.cos(c.psi), sn = Math.sin(c.psi);
  const VT = c.vf * cs - c.vr * sn + dvn * _D.dot(_T), VR = c.vf * sn + c.vr * cs + dvn * _D.dot(_R);
  c.vf = VT * cs + VR * sn; c.vr = -VT * sn + VR * cs;
  c._prendeNoMuro();
  c._atualizaMundo();
}
