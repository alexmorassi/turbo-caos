// A IA DOS PILOTOS (fase 5; contrato em docs/CONTRATOS.md secao 9). Escreve o `controle` de todo carro que nao e o jogador — e do jogador
// quando `G.flags.auto` (o piloto automatico dos testes) ou depois que ele cruzou a chegada (a festa). Usa a MESMA fisica do jogador
// (js/carro.js): so mexe em acel, freio, direcao, drift, turbo e poder. Nada de teleporte, nada de velocidade alem do `mod`. Os numeros
// estao em config/dificuldade.js (IA); quem decide o quanto cada rival e bom e js/dificuldade.js (carro.ia).
//
// COMO ELA PENSA (tudo em coordenadas da pista, como a fisica):
//   1. NA CARGA (uma vez por pista, guardado): a LINHA DE CORRIDA de cada superficie pelo algoritmo K1999 (Remi Coulom, o robo do TORCS):
//      numa grade de 4 m, cada ponto anda de lado ate a curvatura dele ser a media da dos vizinhos — a curvatura fica linear entre os
//      pontos em que a linha encosta na margem, que e a linha de curvatura minima: abre antes, corta no apice, abre na saida. Do grosso
//      (vizinhos a 64 m) para o fino (4 m). A margem respeita muro, beira sem muro (mais folga) e boca de atalho; antes de cada rampa a
//      linha fica reta e no meio (sair torto e pousar fora). Cada salto e SIMULADO com a balistica da fisica (G_AR, bico de 8 graus,
//      tolerancia de pouso) para achar a velocidade minima que passa o vao.
//   2. NA LARGADA (por carro): o PERFIL DE VELOCIDADE — a maior velocidade em que o carro faz a curvatura da linha usando uma fracao do
//      volante (o raio de giro e o da fisica: raio(v) = 5,5 + (raioRef - 5,5)(v/36)^2), propagado para tras com a freada que o plano
//      conta (por habilidade). No trecho antes da rampa o perfil tem PISO (nunca freia abaixo do que o salto pede).
//   3. A CADA PASSO: o alvo lateral = linha (ou o MERGULHO na boca do atalho escolhido: arco suave + reta inclinada que cruza a borda no
//      meio da boca de 12 m sem raspar o muro antes dela) puxado para o desvio do momento (perigo que vem por tras, perigo parado a frente,
//      carro da frente, capsula) + o "erro humano" (passeio lento pela precisao). DIRECAO de Stanley (o robo de Stanford): angulo do alvo
//      logo a frente + atan(k x erro lateral / v) contra o angulo da VELOCIDADE (nao do nariz: derrapando o nariz mente), com a curvatura
//      do alvo x v de alimentacao direta lida 0,2 s a frente (o atraso do volante e do pneu). ACELERADOR/FREIO pela velocidade-alvo do
//      perfil; se o volante pedido passa do maximo, freia (a curva nao cabe). Derrapa de proposito so na curva fechada DA LINHA, quem tem
//      habilidade. No ar alinha o nariz com a pista para o pouso.
//   4. DECISOES com tempo de reacao: atalho (uma vez por volta, pela vantagem que o PROPRIO perfil estima, pelo risco — sem muro,
//      estreito, terra, salto que a velocidade alcancavel nao passa —, pela habilidade e pela posicao), turbo (reta livre e com parede a
//      frente, fuga do Troca-Troca, velocidade que falta para um salto; nunca antes de curva fechada), poder (so quando a heuristica da
//      fase 4 `iaDeveUsar` diz que da E a vontade do piloto aceita), toques no PODER quando congelado, re quando preso, manobra de costas.
//
// DETERMINISMO: sorteios num gerador proprio semeado pelo G.sorteio na largada (o mesmo da corrida em ?teste=); nada de Math.random.
// NADA ALOCADO NO PASSO: estado por carro criado no inicia(); temporarios no topo do modulo. As listas de capsulas e de perigos sao da fase 4
// (reaproveitadas por ela) e sao pedidas a cada CAPSULA_A_CADA / 3 passos.
import * as THREE from 'three';
import { MARCA, BOCA_DO_ATALHO } from './pista.js';
import { FISICA } from '../config/fisica.js';
import { IA as CFG, PILOTO_AUTO } from '../config/dificuldade.js';
import { PODERES } from '../config/poderes.js';
import { Sorteio } from './sorteio.js';
import { on, emite } from './eventos.js';

const F = FISICA;
const GRAUS = Math.PI / 180;
const limita = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const sinal = (x) => (x < 0 ? -1 : 1);

// temporarios do modulo (nada alocado no passo)
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();

/** Perigos da fase 4 (js/poderes.js perigos()) que tem LADO para desviar; os que VEM por tras (projetil na faixa do carro). Os pulsos de
 *  area (emp, encolhedor, terremoto) ficam de fora: 20-90 m em volta do dono nao tem lado. */
const TIPOS_COM_LADO = { oleo: true, fumaca: true, tornado: true, raio: true };
const TIPOS_QUE_VEM = { tornado: true, raio: true };
const MURO_OU_BOCA_ESQ = MARCA.MURO_ESQ | MARCA.ABRE_ESQ, MURO_OU_BOCA_DIR = MARCA.MURO_DIR | MARCA.ABRE_DIR;
/** Amostra sem parede de algum lado (fora do loop, que segura o carro): beira de risco. */
const semParede = (mk) => !(mk & MARCA.MAGNETICO) && (!(mk & MURO_OU_BOCA_ESQ) || !(mk & MURO_OU_BOCA_DIR));

/** Efeitos de poder que chegam no `mod` (Encolhedor: escala; Pulso EMP: semTurbo; Terremoto: aderencia). A IA roda depois do zeraMod e
 *  antes dos poderes: ve o efeito pelo `carro.modAnterior` (o mod que valeu no passo anterior, guardado pela js/corrida.js). */
const encolhidoDe = (c) => !!c.modAnterior && (c.modAnterior.escala || 1) < 0.99;
const semTurboDe = (c) => !!(c.mod.semTurbo || (c.modAnterior && c.modAnterior.semTurbo));
const pistaLisa = (c) => !!c.modAnterior && (c.modAnterior.aderencia || 1) < 0.99;

/** Raio de giro da fisica (js/carro.js, _passoNoChao) na velocidade v. */
function raioDeGiro(raioRef, v) { const q = v / F.VEL_REFERENCIA; return F.RAIO_MINIMO + (raioRef - F.RAIO_MINIMO) * q * q; }

/** Maior velocidade em que um carro de raio de referencia `raioRef` faz uma curva de curvatura `k` usando a fracao `frac` do volante:
 *  raio(v) = frac / |k| (a inversa da conta da fisica). */
function velDaCurva(k, raioRef, frac) {
  const ak = Math.abs(k);
  if (ak < 1e-5) return CFG.VEL_TETO_PLANO;
  const R = frac / ak;
  if (R <= F.RAIO_MINIMO + 0.3) return CFG.VEL_MIN_PLANO;
  return limita(F.VEL_REFERENCIA * Math.sqrt((R - F.RAIO_MINIMO) / (raioRef - F.RAIO_MINIMO)), CFG.VEL_MIN_PLANO, CFG.VEL_TETO_PLANO);
}

/** Valor de um array por amostra em `s` (interpolado; a principal da a volta, o atalho prende nas pontas). */
function valorEm(sup, arr, s) {
  const x = sup.normaliza(s) / sup.ds;
  let i = Math.floor(x);
  if (!sup.fechada && i >= sup.n - 1) return arr[sup.n - 1];
  const f = x - i;
  i = sup.idx(i);
  const a = arr[i];
  return a + (arr[sup.idx(i + 1)] - a) * f;
}

/** Distancia PARA A FRENTE de `de` ate `ate` (na principal da a volta; no atalho, a diferenca simples). */
function aFrente(sup, de, ate) {
  if (!sup.fechada) return ate - de;
  const L = sup.comprimento;
  return (((ate - de) % L) + L) % L;
}
/** Diferenca de s com sinal (ate - de), na principal entre -L/2 e L/2. */
function difS(sup, de, ate) {
  if (!sup.fechada) return ate - de;
  const L = sup.comprimento;
  let x = (((ate - de) % L) + L) % L;
  if (x > L * 0.5) x -= L;
  return x;
}

// =====================================================================================================================  plano da pista
/** O que se calcula UMA VEZ por definicao de pista (funcao pura da geometria e do config): guardado por `def`. */
const _planos = new WeakMap();

function planosDaPista(pista) {
  let p = _planos.get(pista.def);
  // a geometria e a mesma para a mesma def (a corrida remonta a Pista a cada largada); confere o tamanho por seguranca
  if (p && p.length === pista.superficies.length && p.every((x, k) => x.n === pista.superficies[k].n)) return p;
  p = pista.superficies.map((sup) => planoDaSuperficie(pista, sup));
  _planos.set(pista.def, p);
  return p;
}

/** Limites da linha, saltos, linha de corrida e curvatura dela numa superficie. */
function planoDaSuperficie(pista, sup) {
  const n = sup.n, M = sup.marcas;
  const limE = new Float32Array(n), limD = new Float32Array(n), piso = new Float32Array(n), rampa = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const mk = M[i], meia = sup.larg[i] * 0.5, mag = (mk & MARCA.MAGNETICO) !== 0;
    let mE = (mk & MARCA.MURO_ESQ) || mag ? CFG.MARGEM_MURO : CFG.MARGEM_SEM_MURO;
    let mD = (mk & MARCA.MURO_DIR) || mag ? CFG.MARGEM_MURO : CFG.MARGEM_SEM_MURO;
    if (mk & MARCA.ABRE_ESQ) mE = Math.max(mE, CFG.MARGEM_BOCA);
    if (mk & MARCA.ABRE_DIR) mD = Math.max(mD, CFG.MARGEM_BOCA);
    limE[i] = Math.max(0.3, meia - mE);
    limD[i] = Math.max(0.3, meia - mD);
  }
  // limites so do muro (sem o estreitamento das rampas): o desvio de perigo usa estes — pular meio de lado e melhor que pegar o oleo
  const limE0 = limE.slice(), limD0 = limD.slice();
  // --- saltos: a corrida de amostras LANCA que termina num VAO (crista -> pouso)
  const saltos = [];
  for (let i = 0; i < n; i++) {
    if (!(M[i] & MARCA.LANCA) || (M[sup.idx(i - 1)] & MARCA.LANCA)) continue;
    if (!sup.fechada && i === 0) continue;
    let fimLanca = i;
    while (fimLanca - i < 20 && (M[sup.idx(fimLanca + 1)] & MARCA.LANCA)) fimLanca++;
    let pouso = fimLanca + 1;
    while (pouso - fimLanca < 200 && (M[sup.idx(pouso)] & MARCA.VAO)) pouso++;
    if (!sup.fechada && pouso > n - 1) pouso = n - 1;
    const vMin = velocidadeMinimaDoSalto(sup, i, pouso);
    saltos.push({ i, s: i * sup.ds, pouso, sPouso: pouso * sup.ds, vMin });
    // linha reta e no meio da rampa ao pouso
    const a = Math.round(CFG.SALTO_ANTES / sup.ds), b = Math.round(CFG.SALTO_DEPOIS / sup.ds);
    for (let k = i - a; k <= pouso + b; k++) {
      if (!sup.fechada && (k < 0 || k > n - 1)) continue;
      const j = sup.idx(k);
      limE[j] = Math.min(limE[j], CFG.MEIA_FAIXA_DO_SALTO);
      limD[j] = Math.min(limD[j], CFG.MEIA_FAIXA_DO_SALTO);
      rampa[j] = 1;
    }
    const pisoV = vMin * CFG.FOLGA_SALTO;
    const c = Math.round(CFG.PISO_SALTO_ANTES / sup.ds);
    for (let k = i - c; k <= fimLanca; k++) {
      if (!sup.fechada && (k < 0 || k > n - 1)) continue;
      const j = sup.idx(k);
      piso[j] = Math.max(piso[j], pisoV);
      rampa[j] = Math.max(rampa[j], 2);       // 2 = subida para o salto (o carro nao freia aqui)
    }
  }
  // --- pontas fixas do atalho: entra e sai pela borda de dentro (a que encosta na principal)
  let fixoIni = null, fixoFim = null, lado = 0;
  if (sup.id !== 0) {
    const at = pista.atalhos[sup.id - 1];
    lado = at.lado;
    fixoIni = -lado * (lado > 0 ? limE[0] : limD[0]);
    fixoFim = -lado * (lado > 0 ? limE[n - 1] : limD[n - 1]);
  }
  const d = linhaDeCorrida(sup, limE, limD, fixoIni, fixoFim);
  const k = curvaturaDaLinha(sup, d);
  return { n, limE, limD, limE0, limD0, piso, rampa, saltos, d, k, lado };
}

/** Velocidade minima que passa um salto: simula a balistica da fisica (js/carro.js _decola/_passoNoAr: bico de ANGULO_EXTRA_DA_RAMPA,
 *  G_AR, pousa ate TOLERANCIA_DE_POUSO abaixo e dentro da largura, cai abaixo de QUEDA_ABAIXO) saindo do comeco da crista; acha a primeira
 *  velocidade que passa (de 1 em 1 m/s) e refina por bissecao. */
function velocidadeMinimaDoSalto(sup, iCrista, iPouso) {
  const sC = iCrista * sup.ds, sP = iPouso * sup.ds;
  const T0 = new THREE.Vector3(), N0 = new THREE.Vector3(), P0 = new THREE.Vector3();
  sup.quadro(sC, T0, N0, null);
  sup.ponto(sC, 0, 0, P0);
  const ce = Math.cos(F.ANGULO_EXTRA_DA_RAMPA * GRAUS), se = Math.sin(F.ANGULO_EXTRA_DA_RAMPA * GRAUS), dt = 1 / 60;
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), out = { i: 0, s: 0, d: 0, h: 0, dist2: 0 };
  const passa = (v) => {
    pos.copy(P0); vel.copy(T0).multiplyScalar(v * ce).addScaledVector(N0, v * se);
    let dica = iCrista;
    for (let t = 0; t < F.TEMPO_MAX_NO_AR; t += dt) {
      vel.y -= F.G_AR * dt;
      pos.addScaledVector(vel, dt);
      sup.projeta(pos, dica, F.JANELA_DE_BUSCA, out);
      dica = out.i;
      const mk = sup.marcasEm(out.s);
      const avancou = sup.fechada ? (((out.s - sC) % sup.comprimento) + sup.comprimento) % sup.comprimento : out.s - sC;
      if (out.h <= 0 && out.h >= -F.TOLERANCIA_DE_POUSO && Math.abs(out.d) <= sup.larguraEm(out.s) * 0.5 + 0.3 && !(mk & MARCA.VAO)) return avancou >= sP - sC - 0.5;
      if (out.h < -F.QUEDA_ABAIXO) return false;
    }
    return false;
  };
  // rapido demais tambem "nao passa" na conta (voa reto para fora da curva depois do pouso): procura a PRIMEIRA velocidade que passa,
  // de 1 em 1 m/s, e refina por bissecao entre ela e a anterior
  let hi = -1;
  for (let v = 6; v <= 70; v += 1) if (passa(v)) { hi = v; break; }
  if (hi < 0) return 70;
  let lo = hi - 1;
  for (let it = 0; it < 10; it++) { const m = (lo + hi) * 0.5; if (passa(m)) hi = m; else lo = m; }
  return hi;
}

/** K1999 (ver o cabecalho) numa grade grossa; devolve a linha por amostra (Float32Array de d). */
function linhaDeCorrida(sup, limE, limD, fixoIni, fixoFim) {
  const n = sup.n, L = sup.comprimento, fechada = sup.fechada, Lc = CFG.LINHA;
  const maior = Lc.ESCALAS[0];
  const blocos = Math.max(2, Math.round(L / Lc.PASSO / maior));
  const m = fechada ? blocos * maior : blocos * maior + 1;
  const h = fechada ? L / m : L / (m - 1);
  const kh = new Float64Array(m), lo = new Float64Array(m), hi = new Float64Array(m), d = new Float64Array(m), fixo = new Uint8Array(m);
  for (let j = 0; j < m; j++) {
    const s = j * h;
    kh[j] = sup.khEm(s);
    // limite do ponto grosso = o mais apertado das amostras do trecho dele (a linha interpolada nao passa da margem entre dois pontos)
    let e = Infinity, dd = Infinity;
    const i0 = Math.floor((s - h * 0.5) / sup.ds), i1 = Math.ceil((s + h * 0.5) / sup.ds);
    for (let i = i0; i <= i1; i++) {
      if (!fechada && (i < 0 || i > n - 1)) continue;
      const q = sup.idx(i);
      if (limE[q] < e) e = limE[q];
      if (limD[q] < dd) dd = limD[q];
    }
    lo[j] = -e; hi[j] = dd;
  }
  if (!fechada) {
    fixo[0] = fixo[m - 1] = 1;
    d[0] = fixoIni !== null ? limita(fixoIni, lo[0], hi[0]) : 0;
    d[m - 1] = fixoFim !== null ? limita(fixoFim, lo[m - 1], hi[m - 1]) : 0;
    for (let j = 1; j < m - 1; j++) d[j] = limita(lerp(d[0], d[m - 1], j / (m - 1)), lo[j], hi[j]);
  }
  const idx = fechada ? (j) => ((j % m) + m) % m : (j) => (j < 0 ? 0 : j > m - 1 ? m - 1 : j);
  const curv = (jj, k) => {
    const j = idx(jj), a = idx(jj - k), b = idx(jj + k), f = Math.max(0.3, 1 - kh[j] * d[j]), hh = k * h;
    return kh[j] / f + (d[a] - 2 * d[j] + d[b]) / (hh * hh * f * f);
  };
  for (const k of Lc.ESCALAS) {
    const hh = k * h;
    for (let it = 0; it < Lc.VARREDURAS; it++) {
      for (let j = 0; j < m; j += k) {
        if (fixo[j]) continue;
        if (!fechada && (j - k < 0 || j + k > m - 1)) continue;
        const alvo = 0.5 * (curv(j - k, k) + curv(j + k, k));
        const f = Math.max(0.3, 1 - kh[j] * d[j]);
        const der = (kh[j] * kh[j]) / (f * f) - 2 / (hh * hh * f * f);
        const nd = d[j] + (Lc.RELAXA * (alvo - curv(j, k))) / der;
        d[j] = nd < lo[j] ? lo[j] : nd > hi[j] ? hi[j] : nd;
      }
    }
    if (k > 1) { // interpola os pontos de dentro do passo (a escala seguinte parte deles)
      for (let j = 0; j < m; j += k) {
        const a = d[idx(j)], b = d[idx(j + k)];
        for (let q = 1; q < k; q++) {
          const jj = j + q;
          if (!fechada && jj >= m - 1) break;
          const x = idx(jj);
          if (!fixo[x]) d[x] = limita(a + (b - a) * (q / k), lo[x], hi[x]);
        }
      }
    }
  }
  // para as amostras (CatmullRom uniforme entre os pontos grossos) e de novo na margem da amostra
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * sup.ds) / h;
    let j = Math.floor(x);
    const t = x - j;
    if (!fechada && j >= m - 1) { j = m - 2; }
    const p0 = d[idx(j - 1)], p1 = d[idx(j)], p2 = d[idx(j + 1)], p3 = d[idx(j + 2)];
    const tt = !fechada && x >= m - 1 ? 1 : t;
    const v = 0.5 * (2 * p1 + (-p0 + p2) * tt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt * tt + (-p0 + 3 * p1 - 3 * p2 + p3) * tt * tt * tt);
    out[i] = limita(v, -limE[i], limD[i]);
  }
  return out;
}

/** Curvatura (geodesica, no plano da pista) da linha d(s): k = kh / (1 - kh d) + d'' / (1 - kh d)^2, suavizada. */
function curvaturaDaLinha(sup, d) {
  const n = sup.n, ds = sup.ds, bruta = new Float32Array(n), out = new Float32Array(n);
  const ix = (i) => sup.idx(i);
  for (let i = 0; i < n; i++) {
    const f = Math.max(0.3, 1 - sup.kh[i] * d[i]);
    const d2 = (d[ix(i + 2)] - 2 * d[i] + d[ix(i - 2)]) / (4 * ds * ds);
    bruta[i] = sup.kh[i] / f + d2 / (f * f);
  }
  const r = CFG.LINHA.SUAVIZA;
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let q = -r; q <= r; q++) { const j = i + q; if (!sup.fechada && (j < 0 || j > n - 1)) continue; s += bruta[ix(j)]; c++; }
    out[i] = s / c;
  }
  return out;
}

/** Perfil de velocidade de um carro numa superficie (ver o cabecalho, item 2). `vFim` = limite na ponta do atalho (a principal la). */
function perfilDoCarro(sup, plano, raioRef, frac, aFreio, vFim) {
  const n = sup.n, ds = sup.ds, v = new Float32Array(n), piso = plano.piso;
  for (let i = 0; i < n; i++) v[i] = Math.max(velDaCurva(plano.k[i], raioRef, frac), piso[i]);
  const passa = (i, j) => { const lim = Math.sqrt(v[j] * v[j] + 2 * aFreio * ds); if (lim < v[i]) v[i] = Math.max(lim, piso[i]); };
  if (sup.fechada) { for (let r = 0; r < 2; r++) for (let i = n - 1; i >= 0; i--) passa(i, sup.idx(i + 1)); }
  else {
    if (vFim < v[n - 1]) v[n - 1] = Math.max(vFim, piso[n - 1]);
    for (let i = n - 2; i >= 0; i--) passa(i, i + 1);
  }
  return v;
}

/** Velocidade que o carro consegue ter na amostra `i1` saindo do comeco da tira a `v0`: motor A (1 - u2) da fisica, rampa (G_RAMPA),
 *  terra e impulso, sem passar do perfil (as curvas do caminho). E o que decide se o salto de um atalho passa: o vao pede vMin na crista,
 *  mas uma curva fechada antes da rampa deixa o carro lento sem a velocidade maxima dizer nada (Salto do Cais: curva de 13 m antes). */
function velocidadeAlcancada(sup, perfil, p, i1, v0) {
  let v = v0;
  for (let i = 0; i < i1 && i < sup.n - 1; i++) {
    const mk = sup.marcas[i];
    const teto = p.vMax * (mk & MARCA.TERRA ? F.TERRA_VEL : 1) * (mk & MARCA.IMPULSO ? F.IMPULSO_VEL : 1);
    const u = v / teto;
    const a = (u < 1 ? p.acel * (1 - u * u) : -(mk & MARCA.TERRA ? F.TERRA_DESACEL : F.DESACEL_ACIMA)) + (mk & MARCA.IMPULSO ? F.IMPULSO_ACEL : 0) - F.G_RAMPA * sup.T[i * 3 + 1];
    v = Math.sqrt(Math.max(1, v * v + 2 * a * sup.ds));
    if (v > perfil[i + 1]) v = perfil[i + 1];
  }
  return v;
}

/** Tempo estimado (s) de um trecho [s0, s0 + comp] pelo perfil, com o limite da terra (60 %) e do impulso. */
function tempoDoTrecho(sup, perfil, vMax, s0, comp) {
  let t = 0;
  for (let x = 0; x < comp; x += 1) {
    const s = s0 + x, mk = sup.marcasEm(s);
    let teto = vMax * (mk & MARCA.TERRA ? F.TERRA_VEL : 1);
    if (mk & MARCA.IMPULSO) teto = vMax * F.IMPULSO_VEL;
    t += 1 / Math.max(4, Math.min(valorEm(sup, perfil, s), teto));
  }
  return t;
}

// =====================================================================================================================  a IA
export class IA {
  constructor(G, corrida) {
    this.G = G;
    this.corrida = corrida;
    this.estados = [];
    /** contagens para as suites e o relatorio (nao e contrato) */
    this.estatisticas = { atalhos: 0, atalhosRecusados: 0, turbos: 0, poderes: 0, toquesGelo: 0, capsulasMiradas: 0, re: 0, contramao: 0, derrapagens: 0, largadasTurbo: 0, desvios: 0 };
    this._perigos = null;
    this._passos = 0;
    this._largou = false;
    this._desligar = [];
  }

  inicia() {
    const G = this.G, corrida = this.corrida, pista = corrida.pista;
    this.rng = new Sorteio(G.sorteio.inteiro(1, 0x7ffffffe));
    this.planos = planosDaPista(pista);
    this.atalhos = pista.atalhos.map((a) => this._infoDoAtalho(a));
    for (const c of corrida.carros) this.estados[c.indice] = this._novoEstado(c);
    // Troca-Troca mirando: quem esta logo a frente de quem usou foge no turbo (config/poderes.js: "ligue o TURBO para escapar dela"; o
    // js/poderes/trocatroca.js quebra a mira se o alvo ligar o turbo). O alvo e o mesmo que o poder escolhe (o mais perto a frente pelo
    // progresso, ate o alcance); a IA ve a mira com a chance da habilidade (a crianca tambem nem sempre ve)
    this._desligar.push(on('poder:usa', (e) => {
      const id = e && (typeof e.poder === 'string' ? e.poder : e.poder && (e.poder.id || e.poder.poder));
      if (id !== 'trocatroca' || !e.carro) return;
      const pd = this.corrida.poderes, alcance = (PODERES.trocatroca && PODERES.trocatroca.alcance) || 60;
      const alvo = pd && typeof pd.carroAFrente === 'function' ? pd.carroAFrente(e.carro, alcance) : this._carroAFrente(e.carro, alcance);
      const st = alvo ? this.estados[alvo.indice] : null;
      if (st && this.rng.num() < lerp(CFG.FUGA_TROCA[0], CFG.FUGA_TROCA[1], st.hab)) st.alertaTroca = CFG.TURBO_FOGE + st.reacaoTurbo;
    }));
  }

  /** Risco e geometria de um atalho (o que nao depende do carro). */
  _infoDoAtalho(a) {
    const sup = a.sup, M = sup.marcas, n = sup.n, nB = Math.round(BOCA_DO_ATALHO / sup.ds);
    let semMuro = 0, terra = 0;
    for (let i = nB; i < n - nB; i++) {
      if ((M[i] & (MARCA.MURO_ESQ | MARCA.MURO_DIR)) !== (MARCA.MURO_ESQ | MARCA.MURO_DIR)) semMuro++;
      if (M[i] & MARCA.TERRA) terra++;
    }
    const plano = this.planos[sup.id];
    return { a, id: sup.id, sup, semMuro: semMuro / Math.max(1, n - 2 * nB), terra: terra > 0, estreito: a.largura <= CFG.ATALHO_ESTREITO, saltos: plano.saltos };
  }

  _novoEstado(c) {
    const ia = c.ia || PILOTO_AUTO, hab = limita(ia.habilidade ?? 0.5, 0, 1), prec = limita(ia.precisao ?? 0.5, 0, 1);
    const ag = limita(ia.agressividade ?? 0.5, 0, 1), uso = limita(ia.usoDePoder ?? 0.5, 0, 1);
    const pista = this.corrida.pista, p = c.p;
    const frac = lerp(CFG.FRACAO_VOLANTE[0], CFG.FRACAO_VOLANTE[1], hab);
    const aFreio = F.FREIO * lerp(CFG.FREIO_PLANO[0], CFG.FREIO_PLANO[1], hab);
    // perfis: principal primeiro (a ponta de cada atalho termina na velocidade da principal ali)
    const perfis = [];
    perfis[0] = perfilDoCarro(pista.principal, this.planos[0], p.raioRef, frac, aFreio, CFG.VEL_TETO_PLANO);
    for (const at of pista.atalhos) perfis[at.sup.id] = perfilDoCarro(at.sup, this.planos[at.sup.id], p.raioRef, frac, aFreio, valorEm(pista.principal, perfis[0], at.sSaida));
    // vantagem e risco de cada atalho PARA ESTE CARRO
    const atalhos = this.atalhos.map((info) => {
      const a = info.a;
      const tPrincipal = tempoDoTrecho(pista.principal, perfis[0], p.vMax, a.sEntrada, a.sPulado);
      const tAtalho = tempoDoTrecho(a.sup, perfis[a.sup.id], p.vMax, 0, a.sup.comprimento);
      let risco = info.semMuro > 0.05 ? CFG.RISCO_SEM_MURO * Math.min(1, info.semMuro * 2) : 0;
      if (info.estreito) risco += CFG.RISCO_ESTREITO;
      if (info.terra) risco += CFG.RISCO_TERRA;
      let impossivel = false;
      for (const sl of info.saltos) {
        const vCrista = velocidadeAlcancada(a.sup, perfis[a.sup.id], p, sl.i, Math.min(p.vMax, CFG.ATALHO_VEL));
        const margem = vCrista / sl.vMin - 1;
        if (margem < 0.06) impossivel = true;
        risco += CFG.RISCO_SALTO * limita(1 - margem / 0.3, 0.2, 1);
      }
      return { vantagem: tPrincipal - tAtalho, risco, impossivel, tPrincipal, tAtalho };
    });
    const st = {
      hab, prec, ag, uso, frac, aFreio, perfis, atalhos,
      ritmoCurva: lerp(CFG.CURVA_RITMO[0], CFG.CURVA_RITMO[1], hab),
      reacaoTurbo: lerp(CFG.TURBO_REACAO[0], CFG.TURBO_REACAO[1], hab),
      reacaoPoder: lerp(CFG.PODER_REACAO[0], CFG.PODER_REACAO[1], hab),
      pensaPoder: lerp(CFG.PODER_PENSA[0], CFG.PODER_PENSA[1], hab),
      vontade: lerp(CFG.PODER_VONTADE[0], CFG.PODER_VONTADE[1], uso * (0.55 + 0.45 * ag)),
      toquesGelo: lerp(CFG.GELO_TOQUES[0], CFG.GELO_TOQUES[1], hab),
      guardaTurbo: lerp(CFG.TURBO_GUARDA[0], CFG.TURBO_GUARDA[1], hab),
      folgaLateral: lerp(CFG.FOLGA_LATERAL[0], CFG.FOLGA_LATERAL[1], ag),
      segueDist: lerp(CFG.SEGUE_DIST[0], CFG.SEGUE_DIST[1], ag),
      alcancePerigo: lerp(CFG.ALCANCE_PERIGO[0], CFG.ALCANCE_PERIGO[1], hab),
      derrapa: hab >= CFG.DERRAPA_HABILIDADE,
      auto: c.ehJogador,
      // decisoes
      atalho: 0, decisaoVolta: new Int32Array(pista.atalhos.length + 1).fill(-99),
      // desvio (carro, perigo, capsula): alvo lateral e peso
      dDesvio: 0, wDesvio: 0, ladoDesvio: 0, tipoDesvio: 0, limiteVel: CFG.VEL_TETO_PLANO,
      capSup: -1, capS: 0, capD: 0, capDourada: false, capPassos: (c.indice * 3) % CFG.CAPSULA_A_CADA, capSAnt: -1e9,
      // erros humanos (passeios lentos)
      ruido: 0, erroFreio: 0,
      // preso, re, turbo, poder
      tParado: 0, tRe: 0, tTurbo: 0, turboLigado: false, alertaTroca: 0,
      poderEspera: -1, poderPensa: 0.5 + (c.indice % 4) * 0.25, tGelo: 0,
      derrapando: false, supAnt: 0,
      // medidas
      tPreso: 0, maxPreso: 0,
    };
    return st;
  }

  passo(dt) {
    const G = this.G, corrida = this.corrida;
    this._passos++;
    if (corrida.poderes && typeof corrida.poderes.perigos === 'function' && this._passos % 3 === 1) this._perigos = corrida.poderes.perigos();
    const largada = !this._largou;
    this._largou = true;
    const carros = corrida.carros;
    for (let k = 0; k < carros.length; k++) {
      const c = carros[k];
      if (c.ehJogador && !G.flags.auto && !c.chegou) continue;
      const st = this.estados[c.indice];
      if (!st) continue;
      if (largada) this._largadaTurbo(c, st);
      this._controla(c, st, dt);
    }
  }

  /** No VAI: a largada turbo da entrada do jogador (+9 m/s, FISICA.LARGADA_TURBO), com a chance pela habilidade. O piloto automatico do
   *  jogador nao faz (e o reflexo da crianca; e as suites medem o carro do jogador saindo do zero — o tom do motor, teste_audio). */
  _largadaTurbo(c, st) {
    const p = st.auto ? 0 : lerp(CFG.LARGADA_TURBO[0], CFG.LARGADA_TURBO[1], st.hab);
    if (this.rng.num() >= p) return;
    c.empurra(F.LARGADA_TURBO, 0);
    emite('carro:largada_turbo', { carro: c });
    this.estatisticas.largadasTurbo++;
  }

  _controla(c, st, dt) {
    const ctl = c.controle, ef = c.efeitos;
    ctl.acel = 0; ctl.freio = 0; ctl.direcao = 0; ctl.drift = false; ctl.turbo = false; ctl.poder = false;
    // passeios lentos do erro humano (Ornstein-Uhlenbeck: correlacao de TAU segundos, desvio pela precisao)
    const erro = 1 - st.prec;
    if (erro > 0.001) {
      st.ruido += (-st.ruido / CFG.RUIDO_TAU) * dt + CFG.RUIDO_LINHA * erro * Math.sqrt((2 * dt) / CFG.RUIDO_TAU) * this._normal();
      st.erroFreio += (-st.erroFreio / CFG.ERRO_TAU) * dt + CFG.ERRO_FREIO * erro * Math.sqrt((2 * dt) / CFG.ERRO_TAU) * this._normal();
    }
    if (st.alertaTroca > 0) st.alertaTroca -= dt;
    // atalho: chegou na principal de volta -> o plano acabou
    if (c.sup !== st.supAnt) {
      if (st.supAnt === 0 && c.sup !== 0) this.estatisticas.atalhos++;
      if (c.sup === 0) st.atalho = 0;
      st.supAnt = c.sup;
    }
    if (ef.gelo > 0) { this._congelado(c, st, dt); return; }
    if (!c.noChao) { this._noAr(c, st); return; }
    if (ef.rodopio > 0) { st.tParado = 0; return; }
    this._noChao(c, st, dt);
  }

  /** Normal aproximada (soma de 4 uniformes, variancia 1). */
  _normal() { const r = this.rng; return (r.num() + r.num() + r.num() + r.num() - 2) * 1.7320508; }

  /** Congelado (Raio Congelante): toques no PODER (a fisica quebra o gelo, js/carro.js quebraGelo), na frequencia da habilidade. */
  _congelado(c, st, dt) {
    st.tGelo += dt;
    if (st.tGelo >= 1 / st.toquesGelo) { st.tGelo = 0; c.controle.poder = true; this.estatisticas.toquesGelo++; }
    c.controle.acel = 1;
  }

  /** No ar: nariz alinhado com a pista no pouso e a trajetoria puxada de leve para o alvo (o controle no ar e pequeno: GIRO_NO_AR). */
  _noAr(c, st) {
    const ctl = c.controle;
    ctl.acel = 1;
    if (c.efeitos.levantado > 0 && !c.estaVoando) return; // tornado: a fisica gira o carro, nao ha o que fazer
    const sup = this.corrida.pista.sup(c.sup);
    sup.quadro(c.s, _T, _N, _R);
    const psiAr = Math.atan2(c.frente.dot(_R), c.frente.dot(_T));
    const betaAr = Math.atan2(c.vel.dot(_R), Math.max(1, c.vel.dot(_T)));
    const alvo = limita(-0.08 * (c.d - valorEm(sup, this.planos[c.sup].d, c.s)), -0.2, 0.2);
    ctl.direcao = limita(2.2 * (alvo - psiAr) + 1.2 * (alvo - betaAr), -1, 1);
    ctl.turbo = st.turboLigado && !!c.turbo && c.turbo.carga > 0.02;
  }

  // -----------------------------------------------------------------------------------------------------------------  no chao
  _noChao(c, st, dt) {
    const corrida = this.corrida, pista = corrida.pista, sup = pista.sup(c.sup), plano = this.planos[c.sup];
    const ctl = c.controle, m = c.mod, p = c.p;
    const vf = c.vf, v = Math.max(1, Math.abs(vf));
    const festa = c.chegou;

    // --- preso: parado mais de PARADO_TEMPO -> re com o volante invertido (de re o carro vira ao contrario, js/carro.js)
    if (st.tRe > 0) {
      st.tRe -= dt;
      ctl.freio = 1;
      ctl.direcao = limita(c.psi * 3, -1, 1) || (c.d > 0 ? -1 : 1);
      return;
    }
    // (esperando o carro da frente sair conta mais devagar: na largada a fila anda sozinha)
    const parado = Math.abs(vf) < CFG.PARADO_VEL && corrida.estado === 'correndo';
    st.tParado = parado ? st.tParado + dt * (st.esperando ? 0.5 : 1) : Math.max(0, st.tParado - 2 * dt);
    st.tPreso = parado ? st.tPreso + dt : 0;
    if (st.tPreso > st.maxPreso) st.maxPreso = st.tPreso;
    if (st.tParado > CFG.PARADO_TEMPO) { st.tParado = 0; st.tRe = CFG.RE_TEMPO; this.estatisticas.re++; return; }

    // --- de costas para a pista (rodopio torto, batida): manobra virando tudo para o lado mais curto
    if (Math.abs(c.psi) > CFG.CONTRAMAO) {
      ctl.acel = 0.7;
      ctl.direcao = -sinal(c.psi);
      if (!st.contramao) { st.contramao = true; this.estatisticas.contramao++; }
      return;
    }
    st.contramao = false;

    // --- decisoes. Indo para uma boca (entrada do atalho escolhido, ou a saida do atalho) nao se derrapa, nao se desvia para capsula
    // nem se liga o turbo: o mergulho pela boca e preciso (ver _bordaDaBoca)
    if (c.sup === 0 && !festa) this._decideAtalho(c, st);
    let naBoca = false;
    if (st.atalho && c.sup === 0) {
      const x = difS(sup, pista.atalhos[st.atalho - 1].sEntrada, c.s);
      naBoca = x > -CFG.ATALHO_PREPARA && x < BOCA_DO_ATALHO;
    } else if (c.sup !== 0) naBoca = sup.comprimento - c.s < CFG.ATALHO_SAIDA;
    this._olhaAFrente(c, st, dt, naBoca);

    // --- direcao (Stanley, o robo de Stanford, em coordenadas da pista): o angulo desejado da VELOCIDADE e o angulo do alvo lateral logo a
    // frente mais atan(k x erro lateral / v); o giro e a curvatura do alvo x v (alimentacao direta, lida AVANCO_CURVA s a frente) mais
    // GANHO_RUMO x erro de angulo. O angulo e o da velocidade, nao o do nariz: derrapando o nariz mente. (A primeira versao mirava um ponto
    // a v x 0,55 s a frente — "perseguicao pura" — e cortava a curva da propria linha: andava 1,07 m fora dela em media; esta anda 0,49 m.)
    const cs = Math.cos(c.psi), sn = Math.sin(c.psi);
    const VT = vf * cs - c.vr * sn, VR = vf * sn + c.vr * cs;
    const beta = Math.abs(vf) > 3 ? Math.atan2(VR, Math.max(0.5, VT)) : c.psi;
    const sL = c.s + v * CFG.AVANCO_LINHA;
    const dA = this._alvoLateral(c, st, sL - 2), dB = this._alvoLateral(c, st, sL + 2), dL = this._alvoLateral(c, st, sL);
    const fL = Math.max(0.3, 1 - sup.khEm(sL) * dL);
    const theta = Math.atan((dB - dA) / (4 * fL)) + Math.atan((CFG.GANHO_LATERAL * (dL - c.d)) / (v + CFG.VEL_LATERAL));
    const sFF = c.s + v * CFG.AVANCO_CURVA, h = CFG.DELTA_CURVA;
    const d0 = this._alvoLateral(c, st, sFF - h), d1 = this._alvoLateral(c, st, sFF), d2 = this._alvoLateral(c, st, sFF + h);
    const khF = sup.khEm(sFF), fF = Math.max(0.3, 1 - khF * d1);
    const kAlvo = khF / fF + (d0 - 2 * d1 + d2) / (h * h * fF * fF);
    const wDes = kAlvo * v + CFG.GANHO_RUMO * (theta - beta);
    const raio = raioDeGiro(p.raioRef, v);
    const derrapandoAgora = c.derrapando;
    // quase parado a fisica vira patinando (GIRO_PARADO): sem isto o volante pedido na largada seria "infinito"
    const giroBase = Math.max(v / raio, v < F.GIRO_PARADO_ATE ? F.GIRO_PARADO * (1 - v / F.GIRO_PARADO_ATE) : 0);
    const giroPorVolante = giroBase * (m.direcao || 1) * (derrapandoAgora ? F.DRIFT_GIRO : 1);
    const volPedido = wDes / giroPorVolante;
    ctl.direcao = limita(volPedido, -1, 1);

    // --- derrapagem de proposito (quem sabe): so numa CURVA FECHADA DA LINHA (raio < DERRAPA_RAIO), embalado, em cima da linha e sem
    // turbo; sai quando a curva abre. Derrapar para corrigir um erro (volante saturado fora da linha) e o jeito de bater no muro: o carro
    // atravessado escorrega 5 m para fora (medido: era a maior parte das batidas)
    if (st.derrapa && !festa) {
      const kLinha = Math.abs(valorEm(sup, plano.k, c.s + v * 0.2));
      const naLinha = Math.abs(c.d - valorEm(sup, plano.d, c.s)) < CFG.DERRAPA_FORA_DA_LINHA;
      const pedidoSemDrift = Math.abs(wDes / ((v / raio) * (m.direcao || 1)));
      if (!st.derrapando && kLinha > 1 / CFG.DERRAPA_RAIO && naLinha && pedidoSemDrift > CFG.DERRAPA_ENTRA && vf > CFG.DERRAPA_VEL_MIN && !st.turboLigado && !naBoca
        && !plano.rampa[sup.idx(Math.round(sup.normaliza(c.s) / sup.ds))]) { st.derrapando = true; this.estatisticas.derrapagens++; }
      else if (st.derrapando && (naBoca || kLinha < 0.6 / CFG.DERRAPA_RAIO || pedidoSemDrift < CFG.DERRAPA_SAI || vf < CFG.DERRAPA_VEL_MIN - 4)) st.derrapando = false;
      ctl.drift = st.derrapando;
    }

    // --- velocidade
    const iAqui = sup.idx(Math.round(sup.normaliza(c.s) / sup.ds));
    const naRampa = plano.rampa[iAqui] === 2;
    let vAlvo = this._velocidadeAlvo(c, st, v);
    if (Math.abs(volPedido) > 1 && v > CFG.SATURA_VEL && !naRampa && !derrapandoAgora) vAlvo = Math.min(vAlvo, Math.max(CFG.SATURA_VEL, v - (Math.abs(volPedido) - 1) * CFG.SATURA_FREIA));
    if (st.limiteVel < vAlvo) vAlvo = st.limiteVel;
    if (naBoca && vAlvo > CFG.ATALHO_VEL) vAlvo = CFG.ATALHO_VEL;
    if (festa) vAlvo = Math.min(vAlvo, p.vMax * CFG.FESTA_RITMO);
    const loop = (sup.marcas[iAqui] & MARCA.MAGNETICO) !== 0 && Math.abs(plano.k[iAqui]) < 0.012;
    const erroV = vAlvo - vf;
    if (erroV > 0.6 || naRampa) ctl.acel = 1;
    else if (erroV > -1.2 || loop) ctl.acel = limita(0.4 + erroV * 0.5, 0, 1);
    else if (vf > 2 && !ctl.drift) { ctl.freio = limita(-erroV / 5, 0.15, 1); }

    // --- turbo e poder
    if (!festa) { this._turbo(c, st, dt, v, naRampa, naBoca); this._poder(c, st, dt); }
  }

  /** Velocidade-alvo: perfil do carro um pouco a frente, a entrada do atalho escolhido, o erro de freada e o ritmo de curva. */
  _velocidadeAlvo(c, st, v) {
    const pista = this.corrida.pista, sup = pista.sup(c.sup), perfil = st.perfis[c.sup];
    let vA = valorEm(sup, perfil, c.s + v * CFG.AVANCO_PERFIL);
    if (c.sup === 0 && st.atalho) {
      const a = pista.atalhos[st.atalho - 1], ds = aFrente(sup, c.s, a.sEntrada);
      if (ds < CFG.ATALHO_PREPARA + 40) vA = Math.min(vA, Math.sqrt(st.perfis[a.sup.id][0] ** 2 + 2 * st.aFreio * ds));
    }
    if (vA < CFG.VEL_TETO_PLANO * 0.9) vA *= st.ritmoCurva * (1 + st.erroFreio) * (pistaLisa(c) ? CFG.TERREMOTO_RITMO : 1);
    return vA;
  }

  /** Alvo lateral em `s` (na superficie do carro): linha -> caminho do atalho -> desvio -> erro humano, dentro da margem. */
  _alvoLateral(c, st, s) {
    const pista = this.corrida.pista, sup = pista.sup(c.sup), plano = this.planos[c.sup];
    let d = valorEm(sup, plano.d, s);
    let lim0 = -valorEm(sup, plano.limE, s), lim1 = valorEm(sup, plano.limD, s);
    let transfere = 0;
    if (c.sup === 0 && st.atalho) {
      // o MERGULHO na boca do atalho escolhido (ver _bordaDaBoca). x < 0 antes da boca; depois dela a reta continua no alvo (a curvatura
      // do alvo e o angulo da linha nao podem ver um degrau la na frente)
      const a = pista.atalhos[st.atalho - 1], x = difS(sup, a.sEntrada, s);
      if (x > -CFG.ATALHO_PREPARA && x < BOCA_DO_ATALHO + CFG.ATALHO_ALEM) {
        const meia = sup.larguraEm(s) * 0.5, x0 = Math.max(-CFG.ATALHO_PREPARA + 10, this._inicioDoMergulho(meia));
        transfere = suave((x + CFG.ATALHO_PREPARA) / (CFG.ATALHO_PREPARA + x0));
        const borda = a.lado * this._bordaDaBoca(meia, x);
        d = lerp(d, borda, transfere);
        if (a.lado > 0) lim1 = Math.max(lim1, borda); else lim0 = Math.min(lim0, borda);
      }
    } else if (c.sup !== 0) {
      // fim do atalho: o mesmo para a borda de dentro, cruzando na boca de saida
      const L = sup.comprimento, x = s - (L - BOCA_DO_ATALHO), lado = plano.lado;
      if (x > -(CFG.ATALHO_SAIDA - BOCA_DO_ATALHO)) {
        const meia = sup.larguraEm(s) * 0.5, comeco = CFG.ATALHO_SAIDA - BOCA_DO_ATALHO;
        const x0 = Math.max(-comeco + 6, this._inicioDoMergulho(meia));
        transfere = suave((x + comeco) / (comeco + x0));
        const borda = -lado * this._bordaDaBoca(meia, x);
        d = lerp(d, borda, transfere);
        if (-lado > 0) lim1 = Math.max(lim1, borda); else lim0 = Math.min(lim0, borda);
      }
    }
    const livre = 1 - transfere;
    if (st.wDesvio > 0) {
      d = lerp(d, st.dDesvio, st.wDesvio * livre);
      if (st.tipoDesvio === 2 || st.tipoDesvio === 3) { lim0 = Math.min(lim0, -valorEm(sup, plano.limE0, s)); lim1 = Math.max(lim1, valorEm(sup, plano.limD0, s)); }
    }
    d += st.ruido * livre;
    return d < lim0 ? lim0 : d > lim1 ? lim1 : d;
  }

  // -----------------------------------------------------------------------------------------------------------------  atalhos
  /** |d| (do lado do atalho) do caminho que MERGULHA na boca, `x` m depois do comeco dela: do meio da pista, um ARCO suave (ATALHO_ARCO m,
   *  curvatura que nasce e morre em zero) leva o rumo de 0 a ATALHO_RAMPA e uma RETA com essa inclinacao cruza a borda (o meio do carro
   *  passa de meia largura) em x = ATALHO_CRUZA_EM. Reta inclinada, e nao "encostar no muro e abrir": antes da boca a borda e muro, e raspar nele
   *  endireita o carro (js/carro.js MURO_ENDIREITA) — o angulo de cruzar se perde. Inclinada o bastante para o canto do carro ainda nao
   *  tocar o muro em x = 0 (canto = meia comprimento x sen + meia largura x cos). Antes do arco: 0 (o meio da pista). */
  _bordaDaBoca(meia, x) {
    const m = CFG.ATALHO_RAMPA, L = CFG.ATALHO_ARCO, xc = CFG.ATALHO_CRUZA_EM;
    const x1 = xc - (meia - (m * L) / 2) / m, x0 = x1 - L;
    if (x >= x1) return meia + m * (x - xc);
    if (x <= x0) return 0;
    // inclinacao m * smoothstep(u): a curvatura nasce e morre em zero nas duas pontas do arco (sem degrau de curvatura o volante nao
    // passa do ponto na saida do arco — com o arco de curvatura constante o rumo passava 0,09 rad e o carro raspava o muro antes da boca)
    const u = (x - x0) / L;
    return m * L * (u * u * u - (u * u * u * u) / 2);
  }
  /** Onde o arco do mergulho comeca (x, antes da boca): ate ali o alvo vai da linha para o meio da pista. */
  _inicioDoMergulho(meia) { const m = CFG.ATALHO_RAMPA, L = CFG.ATALHO_ARCO; return CFG.ATALHO_CRUZA_EM - (meia - (m * L) / 2) / m - L; }

  _decideAtalho(c, st) {
    const pista = this.corrida.pista, P = pista.principal;
    for (let k = 0; k < pista.atalhos.length; k++) {
      const a = pista.atalhos[k], id = a.sup.id, ds = aFrente(P, c.s, a.sEntrada);
      if (ds > CFG.ATALHO_DECIDE[0] || ds < CFG.ATALHO_DECIDE[1] || st.decisaoVolta[id] === c.volta) continue;
      st.decisaoVolta[id] = c.volta;
      const est = st.atalhos[k];
      let pega;
      if (est.impossivel) pega = false;
      else if (st.auto) pega = est.vantagem > CFG.ATALHO_AUTO_VANTAGEM && est.risco < CFG.ATALHO_AUTO_RISCO;
      else {
        const n = this.corrida.carros.length, atras = c.posicao > n / 2 ? 1 : 0;
        const chance = CFG.ATALHO_BASE + CFG.ATALHO_VANTAGEM * est.vantagem + CFG.ATALHO_HABILIDADE * (st.hab - 0.5) + CFG.ATALHO_ATRAS * atras
          - CFG.ATALHO_RISCO * est.risco * (1.15 - st.hab);
        pega = this.rng.num() < limita(chance, CFG.ATALHO_CHANCE[0], CFG.ATALHO_CHANCE[1]);
      }
      if (pega && !st.atalho) st.atalho = id;
      else if (!pega) this.estatisticas.atalhosRecusados++;
    }
    // desistiu no caminho (rodou, foi empurrado, devagar demais para o salto): passou da boca sem entrar
    if (st.atalho && c.sup === 0) {
      const a = pista.atalhos[st.atalho - 1], x = difS(P, a.sEntrada, c.s);
      if (x > BOCA_DO_ATALHO + 2 || (x > -40 && x < 0 && c.vf < 8)) st.atalho = 0;
    }
  }

  // -----------------------------------------------------------------------------------------------------------------  outros carros, perigos, capsulas
  /** O desvio do momento, em ordem de prioridade: o perigo que vem POR TRAS na faixa do carro (raio congelante, tornado: esquiva para o
   *  lado, se o reflexo da habilidade pegar), o perigo parado a frente (oleo, fumaca) e o carro da frente no caminho (passa pelo lado
   *  livre ou segue), e sem nada disso a capsula que vale o desvio. Escreve st.dDesvio/st.wDesvio (suavizados), st.tipoDesvio e
   *  st.limiteVel. Os pulsos de area (EMP, encolhedor, terremoto: 20-90 m em volta do dono) nao tem lado para desviar e ficam de fora. */
  _olhaAFrente(c, st, dt, naBoca) {
    const corrida = this.corrida, pista = corrida.pista, sup = pista.sup(c.sup), carros = corrida.carros, plano = this.planos[c.sup];
    const v = Math.max(0, c.vf), W = c.p.largura * (c.mod.escala || 1);
    const iAqui = sup.idx(Math.round(sup.normaliza(c.s) / sup.ds));
    const subindo = plano.rampa[iAqui] === 2;
    st.limiteVel = CFG.VEL_TETO_PLANO;
    let alvo = null, melhorDs = Infinity, oD = 0, oMeia = 0, oV = 0, tipo = 0, oAgora = 0, oComp = 0;
    // --- perigos da fase 4 (corrida.poderes.perigos(), pedido a cada 3 passos)
    const perigos = this._perigos;
    let ameaca = false;
    if (perigos && perigos.length) {
      for (let k = 0; k < perigos.length; k++) {
        const hz = perigos[k];
        if (!hz || (hz.sup || 0) !== c.sup || !Number.isFinite(hz.s) || hz.dono === c || !TIPOS_COM_LADO[hz.tipo]) continue;
        const ds = difS(sup, c.s, hz.s), r = (hz.raio || 2) + W * 0.5 + CFG.FOLGA_PERIGO;
        if (TIPOS_QUE_VEM[hz.tipo]) {
          // vem por tras na faixa do carro: esquiva (uma chance por ameaca, pela habilidade)
          if (ds < 0 && ds > -CFG.AMEACA_ATRAS && Math.abs((hz.d || 0) - c.d) < r) {
            ameaca = true;
            if (!st.ameacaVista) { st.ameacaVista = true; st.esquiva = this.rng.num() < lerp(CFG.ESQUIVA[0], CFG.ESQUIVA[1], st.hab); }
            if (st.esquiva && tipo !== 3) { alvo = hz; melhorDs = 0; oD = hz.d || 0; oMeia = hz.raio || 2; oV = 0; tipo = 3; }
          }
          continue;
        }
        if (tipo === 3 || ds < -1 || ds > st.alcancePerigo) continue;
        const dMeu = this._alvoLateralSemDesvio(c, st, hz.s);
        if (Math.abs((hz.d || 0) - dMeu) < r && ds < melhorDs) { melhorDs = ds; alvo = hz; oD = hz.d || 0; oMeia = hz.raio || 2; oV = 0; tipo = 2; }
      }
    }
    if (!ameaca) st.ameacaVista = false;
    // --- carros (o perigo mais perto que 10 m alem do carro tem a vez)
    if (tipo !== 3) {
      const limiteCarro = tipo === 2 ? melhorDs - 10 : Infinity;
      for (let k = 0; k < carros.length; k++) {
        const o = carros[k];
        if (o === c || o.sup !== c.sup || o.fantasma > 0 || c.fantasma > 0) continue;
        const ds = difS(sup, c.s, o.s);
        const alcance = CFG.ALCANCE_CARRO + v * 0.45 + Math.max(0, v - o.vf) * 2.5;
        if (ds < -2 || ds > alcance || ds > limiteCarro) continue;
        const Wo = o.p.largura * (o.mod.escala || 1);
        const precisa = (W + Wo) * 0.5 + st.folgaLateral;
        const dMeu = ds < 1 ? c.d : this._alvoLateralSemDesvio(c, st, c.s + ds);
        const vemPerto = v > o.vf - 0.5 || ds < 5;
        // onde ELE vai estar quando eu chegar: segue a linha dele (todos os carros seguem a mesma linha; sem isto o desvio mirava o lugar
        // de agora e o da frente "fechava a porta" sozinho, so por seguir a curva)
        // (se ele e mais rapido nao ha encontro: vale onde ele esta agora)
        const tEncontro = v > o.vf + 0.5 ? limita(ds / (v - o.vf), 0, CFG.PREVE_ATE) : 0;
        const oDp = ds < 1 ? o.d : o.d + valorEm(sup, plano.d, o.s + o.vf * tEncontro) - valorEm(sup, plano.d, o.s);
        if (Math.abs(oDp - dMeu) < precisa && vemPerto && (tipo !== 1 || ds < melhorDs)) { melhorDs = ds; alvo = o; oD = oDp; oMeia = Wo * 0.5; oV = o.vf; tipo = 1; oAgora = o.d; oComp = (c.p.comprimento + o.p.comprimento) * 0.5; }
      }
    }
    let quer = 0, dQuer = st.dDesvio;
    if (alvo) {
      const sO = c.s + melhorDs;
      const meiaFolga = W * 0.5 + oMeia + (tipo === 1 ? st.folgaLateral : CFG.FOLGA_PERIGO);
      const dE = oD - meiaFolga, dDir = oD + meiaFolga;
      // perigo: os limites do muro (nem a rampa estreita o desvio); carro: os da linha
      const lE = tipo === 1 ? plano.limE : plano.limE0, lD = tipo === 1 ? plano.limD : plano.limD0;
      const lim0 = -valorEm(sup, lE, sO), lim1 = valorEm(sup, lD, sO);
      const okE = dE >= lim0 && (tipo !== 1 || this._ladoLivre(c, sO, dE, W)), okD = dDir <= lim1 && (tipo !== 1 || this._ladoLivre(c, sO, dDir, W));
      const dMeu = tipo === 3 ? c.d : this._alvoLateralSemDesvio(c, st, sO);
      let lado = 0;
      if (okE && okD) lado = st.ladoDesvio && st.tipoDesvio === tipo ? st.ladoDesvio : (Math.abs(dE - dMeu) < Math.abs(dDir - dMeu) ? -1 : 1);
      else if (okE) lado = -1;
      else if (okD) lado = 1;
      if (lado) {
        quer = 1; dQuer = lado < 0 ? dE : dDir; st.ladoDesvio = lado; st.tipoDesvio = tipo;
        // ainda atras dele (sobrepostos de lado) e chegando: segura ate sair de tras — ninguem passa de faixa por dentro do carro da frente
        // (sem isto 2 de cada 3 batidas eram de traseira, medido nas 10 pistas)
        if (tipo === 1 && !subindo && Math.abs(oAgora - c.d) < (W + oMeia * 2) * 0.5 + 0.3 && melhorDs - oComp < st.segueDist + Math.max(0, v - oV)) {
          st.limiteVel = Math.max(0, oV + (melhorDs - oComp - st.segueDist * CFG.SEGUE_PASSANDO) * CFG.SEGUE_GANHO);
        }
      } else if (tipo === 1 && !subindo) {
        // nao da para passar: segue a uma distancia segura (fecha a porta, como gente). Na subida para um salto nao: frear ali e cair
        st.limiteVel = Math.max(0, oV + (melhorDs - oComp - st.segueDist) * CFG.SEGUE_GANHO);
        st.ladoDesvio = 0;
      }
      if (lado && !st.desviando) { st.desviando = true; this.estatisticas.desvios++; }
    } else { st.ladoDesvio = 0; st.desviando = false; }
    // --- segura a faixa: voltando para a linha (ou a linha virando para o lado) com alguem DO LADO no caminho, fica onde esta ate ele
    // sair — sem isto quem acabava de passar "fechava a porta" em cima do ultrapassado (metade das batidas de traseira, medido)
    if (!quer && !naBoca) {
      const dVai = this._alvoLateralSemDesvio(c, st, c.s + CFG.SEGURA_A_FRENTE);
      if (Math.abs(dVai - c.d) > 0.4 && !this._caminhoLivre(c, c.s + CFG.SEGURA_A_FRENTE, dVai, true)) { quer = 1; dQuer = c.d; st.tipoDesvio = 1; }
    }
    st.esperando = st.limiteVel < 3;
    // --- capsula (so sem obstaculo, fora do mergulho da boca e antes da chegada — depois dela nao se pega mais): a mais valiosa que da
    // para pegar sem atravessar a pista
    if (naBoca || c.chegou) st.capSup = -1;
    else if (!quer) {
      if (--st.capPassos <= 0) { st.capPassos = CFG.CAPSULA_A_CADA; this._escolheCapsula(c, st); }
      if (st.capSup === c.sup) {
        const ds = difS(sup, c.s, st.capS);
        if (ds < -1.5 || ds > CFG.ALCANCE_CAPSULA + 10 || (st.capPassos === 1 && !this._caminhoLivre(c, st.capS, st.capD))) st.capSup = -1;
        else { quer = 1; dQuer = st.capD; st.tipoDesvio = 4; }
      }
    }
    // --- suaviza (o alvo anda no maximo DESVIO_TAXA m/s; o peso sobe e desce em rampa; da esquiva sobe ligeiro)
    const passoMax = CFG.DESVIO_TAXA * dt * (tipo === 3 ? 3 : 1);
    if (quer) {
      if (st.wDesvio < 0.01) st.dDesvio = dQuer;
      else st.dDesvio += limita(dQuer - st.dDesvio, -passoMax * 2, passoMax * 2);
      st.wDesvio = Math.min(1, st.wDesvio + CFG.DESVIO_ENTRA * dt * (tipo === 3 ? 3 : 1));
    } else st.wDesvio = Math.max(0, st.wDesvio - CFG.DESVIO_SAI * dt);
  }

  /** Alvo lateral sem o desvio (para saber onde o carro IRIA passar). */
  _alvoLateralSemDesvio(c, st, s) {
    const w = st.wDesvio;
    st.wDesvio = 0;
    const d = this._alvoLateral(c, st, s);
    st.wDesvio = w;
    return d;
  }

  /** Ninguem ocupando (s, d) alem do proprio carro e do da frente? */
  _ladoLivre(c, s, d, W) {
    const carros = this.corrida.carros, sup = this.corrida.pista.sup(c.sup);
    for (let k = 0; k < carros.length; k++) {
      const o = carros[k];
      if (o === c || o.sup !== c.sup || o.fantasma > 0) continue;
      const ds = difS(sup, s, o.s);
      if (ds < -6 || ds > 6) continue;
      if (Math.abs(o.d - d) < (W + o.p.largura * (o.mod.escala || 1)) * 0.5 + 0.3 && Math.abs(o.d - d) > 0.05) return false;
    }
    return true;
  }

  /** Ninguem entre o carro e o ponto (s, d) a frente: nem do lado agora, nem no caminho. A capsula nao vale uma pancada de lado (medido:
   *  um terco das batidas sem motivo era alguem indo buscar capsula por cima de quem estava do lado). */
  _caminhoLivre(c, s, d, soDoLado = false) {
    const carros = this.corrida.carros, sup = this.corrida.pista.sup(c.sup), W = c.p.largura * (c.mod.escala || 1);
    const ate = difS(sup, c.s, s), d0 = Math.min(c.d, d), d1 = Math.max(c.d, d);
    for (let k = 0; k < carros.length; k++) {
      const o = carros[k];
      if (o === c || o.sup !== c.sup || o.fantasma > 0 || c.fantasma > 0) continue;
      const ds = difS(sup, c.s, o.s);
      if (ds < -CFG.CAPSULA_VIZINHO || ds > ate + 3) continue;
      // so do lado: quem esta na mesma faixa (atras ou a frente) nao trava a volta para a linha — o da frente e assunto do desvio
      if (soDoLado && Math.abs(o.d - c.d) < (W + o.p.largura * (o.mod.escala || 1)) * 0.5) continue;
      const folga = (W + o.p.largura * (o.mod.escala || 1)) * 0.5 + 0.4;
      if (o.d > d0 - folga && o.d < d1 + folga) return false;
    }
    return true;
  }

  /** Capsula a frente (fase 4: corrida.capsulas.proximas) que vale o desvio: dourada vale mais; com o turbo cheio so a dourada. */
  _escolheCapsula(c, st) {
    const cap = this.corrida.capsulas;
    st.capSup = -1;
    if (!cap || typeof cap.proximas !== 'function') return;
    const lista = cap.proximas(c, CFG.ALCANCE_CAPSULA);
    if (!lista || !lista.length) return;
    const sup = this.corrida.pista.sup(c.sup), plano = this.planos[c.sup];
    const carga = c.turbo ? c.turbo.carga : 0;
    let melhor = -Infinity;
    for (let k = 0; k < lista.length; k++) {
      const x = lista[k];
      if (!x || (x.sup || 0) !== c.sup || !Number.isFinite(x.s)) continue;
      const ds = difS(sup, c.s, x.s);
      if (ds < CFG.CAPSULA_MIN || ds > CFG.ALCANCE_CAPSULA) continue;
      const encolhido = encolhidoDe(c);
      if (!x.dourada && carga > CFG.CAPSULA_TURBO_CHEIO && !encolhido) continue;
      const dx = x.d || 0, dLinha = this._alvoLateralSemDesvio(c, st, x.s);
      const lim0 = -valorEm(sup, plano.limE, x.s), lim1 = valorEm(sup, plano.limD, x.s);
      if (dx < lim0 - 0.5 || dx > lim1 + 0.5) continue;
      const cabe = (x.dourada || encolhido ? CFG.CAPSULA_DOURADA : CFG.CAPSULA_ANGULO) * ds;
      const desvio = Math.abs(dx - dLinha);
      if (desvio > cabe || !this._caminhoLivre(c, x.s, dx)) continue;
      const nota = (x.dourada ? 2 : 1) * (encolhido ? 2 : 1.2 - carga) - desvio * 0.15 - ds * 0.004;
      if (nota > melhor) { melhor = nota; st.capSup = c.sup; st.capS = x.s; st.capD = limita(dx, lim0, lim1); st.capDourada = !!x.dourada; }
    }
    if (st.capSup >= 0 && Math.abs(st.capS - st.capSAnt) > 2) { st.capSAnt = st.capS; this.estatisticas.capsulasMiradas++; }
  }

  /** O carro mais perto a frente de `c` (mesma tira) ate `alcance` m. */
  _carroAFrente(c, alcance) {
    const sup = this.corrida.pista.sup(c.sup);
    let melhor = null, md = alcance;
    for (const o of this.corrida.carros) {
      if (o === c || o.sup !== c.sup) continue;
      const ds = difS(sup, c.s, o.s);
      if (ds > 0 && ds < md) { md = ds; melhor = o; }
    }
    return melhor;
  }

  // -----------------------------------------------------------------------------------------------------------------  turbo e poder
  /** Turbo: reta livre a frente (o perfil aguenta a velocidade do turbo por TURBO_VISTA s, sem terra), fuga do Troca-Troca ou salto que
   *  pede mais velocidade. Nunca antes de curva fechada. Liga depois do tempo de reacao; desliga quando a reta acaba. */
  _turbo(c, st, dt, v, naRampa, naBoca) {
    const tb = c.turbo, ctl = c.controle;
    if (!tb || semTurboDe(c) || (naBoca && st.alertaTroca <= 0)) { st.turboLigado = false; st.tTurbo = 0; return; }
    const sup = this.corrida.pista.sup(c.sup), perfil = st.perfis[c.sup], vT = c.p.vMax * CFG.TURBO_VEL;
    const vista = vT * CFG.TURBO_VISTA;
    // reta livre: o perfil aguenta a velocidade do turbo, sem terra e COM PAREDE dos dois lados (turbo na ponte sem muro ou no atalho sem
    // muro e o jeito de voar para fora: medido no Porto e no Toboga)
    let livre = !semParede(sup.marcasEm(c.s));
    for (let k = 1; k <= 8 && livre; k++) {
      const s = c.s + (vista * k) / 8, mk = sup.marcasEm(s);
      if (valorEm(sup, perfil, s) < vT * 0.97 || (mk & MARCA.TERRA) || semParede(mk)) livre = false;
      if (!sup.fechada && s > sup.comprimento) break;
    }
    const carga = tb.carga || 0;
    const foge = st.alertaTroca > 0 && carga > 0.03;
    let salto = false;
    if (naRampa) {
      const saltos = this.planos[c.sup].saltos;
      for (let k = 0; k < saltos.length; k++) { const sl = saltos[k], ds = aFrente(sup, c.s, sl.s); if (ds < CFG.PISO_SALTO_ANTES + 5 && v < sl.vMin * CFG.FOLGA_SALTO) salto = true; }
    }
    const reserva = st.auto ? 0 : st.guardaTurbo;
    const quer = foge || (salto && carga > 0.05) || (livre && carga > CFG.TURBO_CARGA_MIN + reserva && v > 12);
    if (st.turboLigado) {
      if (!(foge || salto || livre) || carga <= 0.02) { st.turboLigado = false; st.tTurbo = 0; }
    } else if (quer) {
      st.tTurbo += dt;
      if (st.tTurbo >= (foge ? st.reacaoTurbo * 0.5 : st.reacaoTurbo)) { st.turboLigado = true; this.estatisticas.turbos++; }
    } else st.tTurbo = 0;
    ctl.turbo = st.turboLigado;
  }

  /** Poder: so quando a heuristica da fase 4 (`iaDeveUsar`) diz que da E a vontade do piloto aceita; aperta depois do tempo de reacao,
   *  se a chance ainda estiver la. Recusou: pensa de novo em PODER_PENSA s. */
  _poder(c, st, dt) {
    const pd = this.corrida.poderes;
    if (!pd || typeof pd.iaDeveUsar !== 'function') return;
    if (st.poderEspera > 0) {
      st.poderEspera -= dt;
      if (st.poderEspera <= 0) {
        st.poderEspera = -1;
        st.poderPensa = st.pensaPoder;
        if (this._podeUsar(pd, c) && pd.iaDeveUsar(c)) { c.controle.poder = true; this.estatisticas.poderes++; }
      }
      return;
    }
    if (st.poderPensa > 0) { st.poderPensa -= dt; return; }
    if (!this._podeUsar(pd, c) || !pd.iaDeveUsar(c)) { st.poderPensa = 0.2; return; }
    if (this.rng.num() < st.vontade) st.poderEspera = st.reacaoPoder * (0.7 + 0.6 * this.rng.num());
    else st.poderPensa = st.pensaPoder * (0.7 + 0.6 * this.rng.num());
  }

  _podeUsar(pd, c) { return typeof pd.podeUsar !== 'function' || pd.podeUsar(c); }

  quadro() {}

  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
  }
}

// para as suites (a mesma conta que a IA usa)
export { planosDaPista, velDaCurva, raioDeGiro, perfilDoCarro };
