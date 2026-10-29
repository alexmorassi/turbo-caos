// INSPECAO DAS PISTAS (fase 3). As contas que dizem se uma pista PRESTA, sem desenhar nada: sem NaN, comprimento na faixa, quadros
// ortonormais, loop de cabeca para baixo no topo, nenhuma pista atravessando outra (salvo ponte com folga), atalhos que conectam e
// encurtam, largada numa reta. Mora fora da suite porque roda em dois lugares: no navegador (testes/teste_pistas.js) e no Node,
// enquanto a pista e desenhada (a geometria nao precisa de placa de video) — e nao entra no jogo: ninguem do jogo importa este arquivo.
import * as THREE from 'three';
import { MARCA, BOCA_DO_ATALHO } from '../pista.js';
import { figurasDaPista } from './consulta.js';

/** Faixa de comprimento da volta (m): 45 a 60 s a ~35 m/s, com folga de 1,4 a 2,2 km (o pedido). */
export const COMPRIMENTO_MIN = 1400, COMPRIMENTO_MAX = 2200;
/** Folga vertical que libera duas pistas de passarem perto (ponte sobre pista): 6 m (o pedido). */
export const FOLGA_VERTICAL = 6;
/** Distancia (m, ao longo da tira) abaixo da qual duas amostras da MESMA tira sao vizinhas e nao contam como "outra pista". */
export const VIZINHANCA = 40;
/** Comprimento (m) da zona de transicao de cada boca de atalho, alem dos 12 m da boca: e onde o atalho ainda esta se afastando. */
export const TRANSICAO_DA_BOCA = 45;
/** Passo (m) das amostras na conta de vizinhanca: 2 m basta (largura minima 8 m) e deixa a conta em ~1 milhao de pares. */
const PASSO_VIZ = 2;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/** Roda todas as verificacoes. Devolve { linhas: [{ ok, msg }], medidas: { nome: valor } }. */
export function inspeciona(pista) {
  const linhas = [], medidas = {};
  const ok = (c, msg) => { linhas.push({ ok: !!c, msg }); return !!c; };
  const P = pista.principal, nome = pista.id;

  // ------------------------------------------------------------ 1. NaN
  let nan = 0;
  for (const sup of pista.superficies) for (const arr of [sup.P, sup.T, sup.N, sup.R, sup.larg, sup.kh, sup.kv]) for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) nan++;
  ok(nan === 0, `${nome}: monta sem NaN (${nan} valores ruins)`);

  // ------------------------------------------------------------ 2. comprimento
  medidas.comprimento = P.comprimento;
  ok(P.comprimento >= COMPRIMENTO_MIN && P.comprimento <= COMPRIMENTO_MAX, `${nome}: volta de ${P.comprimento.toFixed(0)} m (faixa ${COMPRIMENTO_MIN}–${COMPRIMENTO_MAX})`);

  // ------------------------------------------------------------ 3. quadros ortonormais
  let pior = 0;
  for (const sup of pista.superficies) {
    for (let i = 0; i < sup.n; i++) {
      _a.fromArray(sup.T, i * 3); _b.fromArray(sup.N, i * 3); _c.fromArray(sup.R, i * 3);
      pior = Math.max(pior, Math.abs(_a.dot(_b)), Math.abs(_a.dot(_c)), Math.abs(_b.dot(_c)), Math.abs(_a.length() - 1), Math.abs(_b.length() - 1), Math.abs(_c.length() - 1));
    }
  }
  ok(pior < 1e-3, `${nome}: quadros ortonormais (pior desvio ${pior.toExponential(1)})`);

  // ------------------------------------------------------------ 4. larguras
  let lmin = Infinity, lmax = 0;
  for (let i = 0; i < P.n; i++) { lmin = Math.min(lmin, P.larg[i]); lmax = Math.max(lmax, P.larg[i]); }
  // loop e saca-rolha podem ser mais estreitos (12 m) que a reta: a faixa vale para a pista toda
  ok(lmin >= 11.9 && lmax <= 16.01, `${nome}: largura da principal entre ${lmin.toFixed(1)} e ${lmax.toFixed(1)} m (12–16)`);
  for (const a of pista.atalhos) {
    let amin = Infinity, amax = 0;
    for (let i = 0; i < a.sup.n; i++) { amin = Math.min(amin, a.sup.larg[i]); amax = Math.max(amax, a.sup.larg[i]); }
    ok(amin >= 7.9 && amax <= 10.01, `${nome}: largura do ${a.nome} entre ${amin.toFixed(1)} e ${amax.toFixed(1)} m (8–10)`);
  }

  // ------------------------------------------------------------ 5. loops e saca-rolhas de cabeca para baixo no topo
  const figs = figurasDaPista(pista);
  let nLoops = 0;
  for (const f of figs) {
    if (f.tipo !== 'loop' && f.tipo !== 'saca_rolha') continue;
    const sup = pista.sup(f.sup);
    let topo = -1, ymax = -Infinity;
    for (let s = f.s0; s <= f.s1; s += sup.ds) { const i = sup.idx(Math.round(sup.normaliza(s) / sup.ds)); if (sup.P[i * 3 + 1] > ymax) { ymax = sup.P[i * 3 + 1]; topo = i; } }
    const ny = topo >= 0 ? sup.N[topo * 3 + 1] : 1, mag = topo >= 0 && (sup.marcas[topo] & MARCA.MAGNETICO) !== 0;
    ok(ny < -0.9 && mag, `${nome}: topo do ${f.tipo === 'loop' ? 'loop' : 'saca-rolha'} (sup ${f.sup}, s ${f.s0.toFixed(0)}) com N.y = ${ny.toFixed(2)} e magnetico`);
    if (f.tipo === 'loop') nLoops++;
  }
  medidas.loops = nLoops;

  // ------------------------------------------------------------ 6. ninguem atravessa ninguem
  // amostras a cada 2 m de todas as superficies, com o s e a superficie
  const am = [];
  for (const sup of pista.superficies) {
    const n = Math.floor(sup.comprimento / PASSO_VIZ);
    for (let k = 0; k <= n; k++) {
      const s = Math.min(k * PASSO_VIZ, sup.comprimento - (sup.fechada ? PASSO_VIZ * 0.5 : 0));
      sup.ponto(s, 0, 0, _a);
      am.push({ sup: sup.id, s, x: _a.x, y: _a.y, z: _a.z, l: sup.larguraEm(s), vao: (sup.marcasEm(s) & MARCA.VAO) !== 0 });
    }
  }
  const L = P.comprimento;
  const naBoca = (a, b) => {
    // a: amostra de atalho; b: amostra da principal. Zona da boca: os primeiros/ultimos (12 + transicao) m do atalho contra a principal
    // em volta da entrada/saida
    const at = pista.atalhos[a.sup - 1], Z = BOCA_DO_ATALHO + TRANSICAO_DA_BOCA;
    const dist = (s, ref) => { const x = Math.abs(((s - ref) % L + L) % L); return Math.min(x, L - x); };
    if (a.s <= Z && dist(b.s, at.sEntrada + a.s) <= Z) return true;
    if (a.s >= at.sup.comprimento - Z && dist(b.s, at.sSaida - (at.sup.comprimento - a.s)) <= Z) return true;
    return false;
  };
  let piorD = Infinity, piorPar = null, conflitos = 0, pontes = 0;
  // grade espacial de 20 m (so x, z): os pares candidatos sao os da mesma celula e das vizinhas
  const CEL = 20, grade = new Map(), chave = (i, j) => i * 100003 + j;
  am.forEach((p, k) => { const c = chave(Math.floor(p.x / CEL), Math.floor(p.z / CEL)); let l = grade.get(c); if (!l) grade.set(c, (l = [])); l.push(k); });
  for (let ia = 0; ia < am.length; ia++) {
    const a = am[ia], ci = Math.floor(a.x / CEL), cj = Math.floor(a.z / CEL);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const lista = grade.get(chave(ci + di, cj + dj)); if (!lista) continue;
      for (const ib of lista) {
        if (ib <= ia) continue;
        const b = am[ib];
        if (a.sup === b.sup) {
          const sup = pista.sup(a.sup);
          let ds = Math.abs(a.s - b.s); if (sup.fechada) ds = Math.min(ds, sup.comprimento - ds);
          if (ds < VIZINHANCA) continue;
        } else {
          // atalho contra principal perto das bocas; dois atalhos nunca se tocam
          if (b.sup === 0 && naBoca(a, b)) continue;
          if (a.sup === 0 && naBoca(b, a)) continue;
        }
        if (a.vao && b.vao) continue; // dois buracos nao se atravessam
        const dy = Math.abs(a.y - b.y);
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), lim = Math.max(a.l, b.l);
        if (d >= lim) continue;
        if (dy >= FOLGA_VERTICAL) { pontes++; continue; }
        conflitos++;
        if (d < piorD) { piorD = d; piorPar = [a, b]; }
      }
    }
  }
  medidas.passagensComFolga = pontes;
  ok(conflitos === 0, conflitos === 0 ? `${nome}: nenhuma amostra perto demais de outra (pontes com folga >= ${FOLGA_VERTICAL} m: ${pontes} pares)`
    : `${nome}: ${conflitos} pares perto demais; pior a ${piorD.toFixed(1)} m: sup ${piorPar[0].sup} s ${piorPar[0].s.toFixed(0)} (${piorPar[0].x.toFixed(0)}, ${piorPar[0].y.toFixed(1)}, ${piorPar[0].z.toFixed(0)}) x sup ${piorPar[1].sup} s ${piorPar[1].s.toFixed(0)} (${piorPar[1].x.toFixed(0)}, ${piorPar[1].y.toFixed(1)}, ${piorPar[1].z.toFixed(0)})`);

  // ------------------------------------------------------------ 7. atalhos: conectam nas duas bocas e encurtam
  for (const a of pista.atalhos) {
    const lado = a.lado, sE = a.sEntrada + 5, dE = (P.larguraEm(sE) * 0.5 + 1) * lado;
    P.ponto(sE, dE, 0.3, _a);
    const t1 = pista.transicao(0, sE, dE, _a, {});
    const sup = a.sup, sS = sup.comprimento - 5, dS = -(sup.larguraEm(sS) * 0.5 + 1) * lado;
    sup.ponto(sS, dS, 0.3, _b);
    const t2 = pista.transicao(sup.id, sS, dS, _b, {});
    // e as duas mao inversas de verdade: entrar pela saida (contramao) nao vale, mas o carro que sai do atalho na boca de entrada volta
    const sE2 = 6, dE2 = -(sup.larguraEm(sE2) * 0.5 + 1) * lado; sup.ponto(sE2, dE2, 0.3, _c);
    const t3 = pista.transicao(sup.id, sE2, dE2, _c, {});
    ok(t1 && t1.sup === sup.id, `${nome}: ${a.nome} — passar da borda na boca de entrada troca para o atalho`);
    ok(t2 && t2.sup === 0, `${nome}: ${a.nome} — passar da borda na boca de saida volta para a principal`);
    ok(t3 && t3.sup === 0, `${nome}: ${a.nome} — voltar para a principal pela boca de entrada funciona`);
    ok(sup.comprimento < a.sPulado, `${nome}: ${a.nome} com ${sup.comprimento.toFixed(0)} m pula ${a.sPulado.toFixed(0)} m da principal (economia de ${(a.sPulado - sup.comprimento).toFixed(0)} m)`);
    ok(a.sEntrada < a.sSaida, `${nome}: ${a.nome} nao cruza a largada`);
    medidas['economia ' + a.nome] = a.sPulado - sup.comprimento;
  }

  // ------------------------------------------------------------ 8. largada numa reta plana
  let curvaLargada = 0, inclLargada = 1;
  for (let s = -45; s <= 30; s += 1) { const ss = P.normaliza(s); curvaLargada = Math.max(curvaLargada, Math.abs(P.khEm(ss)), Math.abs(P.kvEm(ss))); P.quadro(ss, null, _a); inclLargada = Math.min(inclLargada, _a.y); }
  ok((P.marcas[0] & MARCA.LARGADA) !== 0, `${nome}: amostra 0 com MARCA.LARGADA`);
  ok(curvaLargada < 0.003 && inclLargada > 0.999, `${nome}: largada numa reta plana (curvatura ${curvaLargada.toFixed(4)} 1/m, N.y ${inclLargada.toFixed(4)})`);
  const semMuroNaLargada = [-40, -20, 0, 20].some((s) => (P.marcasEm(P.normaliza(s)) & (MARCA.VAO | MARCA.MAGNETICO | MARCA.LANCA)) !== 0);
  ok(!semMuroNaLargada, `${nome}: grade de largada sem vao, rampa ou loop`);

  // ------------------------------------------------------------ medidas uteis para o relatorio
  const conta = (bit) => { let n = 0; for (const sup of pista.superficies) for (let i = 0; i < sup.n; i++) if (sup.marcas[i] & bit) n++; return n; };
  medidas.saltos = figs.filter((f) => f.tipo === 'rampa').length;
  medidas.sacaRolhas = figs.filter((f) => f.tipo === 'saca_rolha').length;
  medidas.paredoes = figs.filter((f) => f.tipo === 'paredao').length;
  // metros da principal sem muro de algum lado (fora das bocas dos atalhos): o risco de cair
  let semMuro = 0;
  for (let i = 0; i < P.n; i++) { const m = P.marcas[i]; if ((m & (MARCA.MURO_ESQ | MARCA.MURO_DIR)) !== (MARCA.MURO_ESQ | MARCA.MURO_DIR) && !(m & (MARCA.ABRE_ESQ | MARCA.ABRE_DIR | MARCA.VAO))) semMuro++; }
  medidas.mSemMuro = semMuro * P.ds;
  medidas.mTerra = conta(MARCA.TERRA);
  medidas.mImpulso = conta(MARCA.IMPULSO);
  let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < P.n; i++) { ymin = Math.min(ymin, P.P[i * 3 + 1]); ymax = Math.max(ymax, P.P[i * 3 + 1]); }
  medidas.desnivel = ymax - ymin;
  return { linhas, medidas };
}
