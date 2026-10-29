// CONSULTAS SOBRE A DEFINICAO DAS PISTAS (fase 3). O nucleo (js/pista.js) sabe o `s` de um ponto de controle so da principal
// (`pista.sDoPonto`); o construtor (js/pistas/construtor.js) marca figuras (rampa, loop, saca-rolha, paredao) e trechos elevados por
// INDICE DE PONTO de qualquer superficie. Estas funcoes traduzem indice -> s em qualquer superficie — o visual (pilares, rampas, placas)
// e a inspecao (testes) usam as mesmas, entao o que o teste mede e o que a crianca ve.
import * as THREE from 'three';
import { BOCA_DO_ATALHO } from '../pista.js';

const _a = new THREE.Vector3();

/** s (na propria tira) de um ponto de controle k de uma superficie: principal pelo nucleo; atalho projetando o ponto (a spline passa
 *  exatamente pelos pontos de controle). k fracionario interpola. Os indices -3..-1 e n..n+2 sao as bocas que o nucleo poe. */
export function sDoPontoNaSup(pista, supId, k) {
  if (supId === 0) return pista.sDoPonto(k);
  const a = pista.atalhos[supId - 1], def = pista.def.atalhos[supId - 1], sup = a.sup, n = def.pontos.length;
  const sInt = (j) => {
    if (j <= -3) return 0;
    if (j === -2) return BOCA_DO_ATALHO * 0.5;
    if (j === -1) return BOCA_DO_ATALHO;
    if (j >= n + 2) return sup.comprimento;
    if (j === n + 1) return sup.comprimento - BOCA_DO_ATALHO * 0.5;
    if (j === n) return sup.comprimento - BOCA_DO_ATALHO;
    const p = def.pontos[j], q = Array.isArray(p) ? p : p.p;
    _a.set(q[0], q[1], q[2]);
    // dica: proporcional ao indice (o atalho e curto e a projecao local acha a amostra certa numa janela larga)
    const dica = Math.round(((j + 3) / (n + 5)) * (sup.n - 1));
    return sup.projeta(_a, dica, Math.max(30, sup.n), {}).s;
  };
  const k0 = Math.floor(k), f = k - k0;
  const s0 = sInt(k0);
  return f < 1e-9 ? s0 : s0 + (sInt(k0 + 1) - s0) * f;
}

/** Faixas de s (na tira) de uma lista { de, ate } em indices de ponto. */
export function faixasEmS(pista, supId, lista) {
  return (lista || []).map((t) => ({ ...t, s0: sDoPontoNaSup(pista, supId, t.de), s1: sDoPontoNaSup(pista, supId, t.ate) }));
}

/** Figuras de todas as superficies, com s0/s1: [{ sup, tipo, s0, s1, ... }] */
export function figurasDaPista(pista) {
  const out = [];
  for (const f of faixasEmS(pista, 0, pista.def.figuras)) out.push({ sup: 0, ...f });
  (pista.def.atalhos || []).forEach((a, k) => { for (const f of faixasEmS(pista, k + 1, a.figuras)) out.push({ sup: k + 1, ...f }); });
  return out;
}

