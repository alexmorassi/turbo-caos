// O NUCLEO DA PISTA (fase 1, fundacao). Toda pista do Turbo Caos e uma SPLINE CatmullRom (centripeta, fechada) amostrada de metro em
// metro. Cada amostra guarda o ponto, o QUADRO da pista ali (T = frente, N = cima da pista, R = direita do piloto), a largura, a
// distancia percorrida `s`, as duas curvaturas e as marcas do trecho (muro, vao, rampa, loop...). Tudo o que anda na pista conversa com
// ela em COORDENADAS DA PISTA: (s, d, h) = quanto andou, quanto esta para a direita do centro, quanto esta acima do asfalto.
//
// POR QUE COORDENADAS DA PISTA (e nao fisica de mundo, como o Rapier do dinotrails-web): uma corrida maluca tem loop de cabeca para
// baixo, curva inclinada, saltos e atalhos. Em (s, d, h) o loop e so mais um trecho (N aponta para o centro do loop e o carro gruda),
// o muro e um |d| > meia largura, a posicao na corrida e o `s`, e a IA pensa num plano 2D. E a "fisica de arcade feita a mao, como no
// cidadeaberta" do pedido, com passo fixo de 1/60 s para os testes serem deterministicos.
//
// ATALHOS: alem da tira principal (fechada), a pista pode ter atalhos — tiras abertas que saem COLADAS na borda da principal, correm
// lado a lado uns 12 m (a "boca" do atalho, sem muro entre as duas) e depois se afastam; na volta, encostam de novo e a borda abre.
// Quem cruza a borda dentro da boca troca de superficie (`transicao`). O contrato completo esta em docs/CONTRATOS.md, secao 4.
//
// Convencao de eixos (a mesma do three.js e dos GLB do Cidade Aberta): Y para cima; o carro olha para +Z; a direita de quem olha para
// +Z e -X. Por isso R = T x N.
import * as THREE from 'three';

/** Distancia entre amostras (m). 1 m: o carro mais rapido anda ~1,6 m por passo, e a busca local acha a amostra certa em 2 ou 3. */
export const PASSO_AMOSTRA = 1.0;

/** Marcas por amostra (bits). Os nomes sao os que as pistas usam em `trechos[].tipo`. */
export const MARCA = {
  MURO_ESQ: 1,      // ha muro do lado esquerdo (sem muro: o carro pode cair da pista — trecho de risco)
  MURO_DIR: 2,
  VAO: 4,           // nao ha chao: buraco de salto. Quem cair ali e recolocado na pista (fisica: respawn)
  LANCA: 8,         // crista de rampa: o carro no chao que passa aqui sai voando com a velocidade que tem
  MAGNETICO: 16,    // loop/trecho invertido: o carro gruda (gravidade ao longo de -N) e nao perde velocidade subindo
  ABRE_ESQ: 32,     // boca de atalho do lado esquerdo (sem muro e com outra superficie colada)
  ABRE_DIR: 64,
  TERRA: 128,       // chao ruim (areia, gelo fofo, lama): limita a velocidade — risco/recompensa dos atalhos
  IMPULSO: 256,     // faixa aceleradora (seta no chao): empurrao de graca
  LARGADA: 512,     // a linha de chegada (s = 0 da principal)
};

/** Tipos de trecho aceitos na definicao da pista e a marca que cada um liga (ou desliga, no caso de 'sem_muro'). */
const TIPOS_DE_TRECHO = {
  vao: MARCA.VAO, lanca: MARCA.LANCA, magnetico: MARCA.MAGNETICO, terra: MARCA.TERRA, impulso: MARCA.IMPULSO,
  sem_muro: MARCA.MURO_ESQ | MARCA.MURO_DIR, sem_muro_esq: MARCA.MURO_ESQ, sem_muro_dir: MARCA.MURO_DIR,
};

/** Comprimento da boca de um atalho (m): o trecho em que ele corre colado na principal antes de se afastar. 12 m = 3 carros, da para
 *  a crianca ver a entrada e escolher sem freada brusca. */
export const BOCA_DO_ATALHO = 12;

/** Largura padrao (m) quando a pista nao diz. 14 m cabem 4 carros lado a lado (largura normalizada <= 2,3 m): ultrapassagem facil. */
export const LARGURA_PADRAO = 14;

const UP = new THREE.Vector3(0, 1, 0);
// temporarios do modulo (nada e alocado dentro de G.passo)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
// os da projecao sao SEPARADOS: ponto() e quadro() usam _a/_b/_c/_t por dentro, e passar um deles como `out` embaralha o resultado
// (custou 1 m de erro sistematico no s na primeira versao)
const _pT = new THREE.Vector3(), _pN = new THREE.Vector3(), _pR = new THREE.Vector3(), _pBase = new THREE.Vector3();

/** Uma tira de pista amostrada: a principal (fechada) ou um atalho (aberto). Arrays planos (Float32Array) para a busca ser barata. */
export class Superficie {
  constructor({ id, fechada, pontos, frente, cima, larguras, marcas, passo }) {
    this.id = id;
    this.fechada = fechada;
    const n = pontos.length;
    this.n = n;
    this.ds = passo || PASSO_AMOSTRA; // o passo real (comprimento / numero de trechos): ~1 m, e o s da tira fica igual ao comprimento de arco
    this.P = new Float32Array(n * 3);
    this.T = new Float32Array(n * 3);
    this.N = new Float32Array(n * 3);
    this.R = new Float32Array(n * 3);
    this.larg = new Float32Array(n);
    this.kh = new Float32Array(n); // curvatura no plano da pista (> 0: curva para a direita)
    this.kv = new Float32Array(n); // curvatura vertical (> 0: a pista sobe em concha, como o fundo de um vale ou o loop)
    this.marcas = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      pontos[i].toArray(this.P, i * 3);
      frente[i].toArray(this.T, i * 3);
      cima[i].toArray(this.N, i * 3);
      _a.crossVectors(frente[i], cima[i]).normalize().toArray(this.R, i * 3);
      this.larg[i] = larguras[i];
      this.marcas[i] = marcas[i];
    }
    // comprimento: na fechada, n trechos de ds (a amostra n e a 0); na aberta, n - 1
    this.comprimento = (fechada ? n : n - 1) * this.ds;
    this._curvaturas();
  }

  _curvaturas() {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = this.idx(i - 1), b = this.idx(i + 1);
      const den = (b - a === 0 ? 1 : (this.fechada ? 2 : Math.abs(b - a))) * this.ds;
      _a.fromArray(this.T, b * 3).sub(_b.fromArray(this.T, a * 3)).divideScalar(den);
      this.kh[i] = _a.dot(_c.fromArray(this.R, i * 3));
      this.kv[i] = _a.dot(_c.fromArray(this.N, i * 3));
    }
  }

  /** Indice valido: na fechada da a volta, na aberta prende nas pontas. */
  idx(i) {
    const n = this.n;
    if (this.fechada) return ((i % n) + n) % n;
    return i < 0 ? 0 : (i >= n ? n - 1 : i);
  }

  /** `s` dentro da tira: na fechada, entre 0 e o comprimento; na aberta, preso nas pontas. */
  normaliza(s) {
    const L = this.comprimento;
    if (this.fechada) return ((s % L) + L) % L;
    return s < 0 ? 0 : (s > L ? L : s);
  }

  /** Amostra de um `s` (a de tras) e a fracao ate a proxima. */
  local(s, out) {
    const sn = this.normaliza(s), x = sn / this.ds;
    let i = Math.floor(x);
    if (!this.fechada && i >= this.n - 1) i = this.n - 2;
    out.i = this.idx(i); out.f = Math.min(1, Math.max(0, x - i));
    return out;
  }

  /** Marcas da amostra mais proxima de `s`. */
  marcasEm(s) { return this.marcas[this.idx(Math.round(this.normaliza(s) / this.ds))]; }
  /** Largura em `s` (interpolada). */
  larguraEm(s) { const l = this.local(s, _loc); return this.larg[l.i] + (this.larg[this.idx(l.i + 1)] - this.larg[l.i]) * l.f; }
  /** Curvatura no plano em `s` (interpolada). */
  khEm(s) { const l = this.local(s, _loc); return this.kh[l.i] + (this.kh[this.idx(l.i + 1)] - this.kh[l.i]) * l.f; }
  kvEm(s) { const l = this.local(s, _loc); return this.kv[l.i] + (this.kv[this.idx(l.i + 1)] - this.kv[l.i]) * l.f; }

  /** Quadro da pista em `s` (interpolado e reortonormalizado). Qualquer saida pode ser null. */
  quadro(s, outT, outN, outR) {
    const l = this.local(s, _loc), i = l.i, j = this.idx(i + 1), f = l.f;
    const T = outT || _t;
    T.fromArray(this.T, i * 3).lerp(_a.fromArray(this.T, j * 3), f).normalize();
    const N = (outN || _b).fromArray(this.N, i * 3).lerp(_a.fromArray(this.N, j * 3), f);
    N.addScaledVector(T, -N.dot(T)).normalize();
    if (outR) outR.crossVectors(T, N).normalize();
    return T;
  }

  /** Ponto do mundo em (s, d, h). */
  ponto(s, d, h, out) {
    const l = this.local(s, _loc), i = l.i, j = this.idx(i + 1), f = l.f;
    out.fromArray(this.P, i * 3).lerp(_a.fromArray(this.P, j * 3), f);
    if (d !== 0 || h !== 0) {
      this.quadro(s, _t, _b, _c);
      out.addScaledVector(_c, d).addScaledVector(_b, h);
    }
    return out;
  }

  /** PROJECAO: coordenadas da pista de um ponto do mundo, procurando so perto da `dica` (indice da amostra da ultima vez). A busca local
   *  e o que impede o carro de "pular" para outro trecho que passa por cima ou por baixo (ponte, loop). `janela` em amostras.
   *  Escreve em `out` { i, s, d, h, dist2 } e devolve `out`. */
  projeta(pos, dica, janela, out) {
    const P = this.P, n = this.n;
    let melhor = -1, md = Infinity;
    const ini = this.fechada ? dica - janela : Math.max(0, dica - janela);
    const fim = this.fechada ? dica + janela : Math.min(n - 1, dica + janela);
    for (let k = ini; k <= fim; k++) {
      const i = this.idx(k), o = i * 3;
      const dx = pos.x - P[o], dy = pos.y - P[o + 1], dz = pos.z - P[o + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < md) { md = d2; melhor = i; }
    }
    // refina: anda para a amostra cuja "fatia" contem o ponto (no maximo 3 passos)
    let i = melhor;
    for (let it = 0; it < 3; it++) {
      _a.set(pos.x - P[i * 3], pos.y - P[i * 3 + 1], pos.z - P[i * 3 + 2]);
      const sl = _a.dot(_t.fromArray(this.T, i * 3));
      if (sl > this.ds * 0.5 && (this.fechada || i < n - 1)) i = this.idx(i + 1);
      else if (sl < -this.ds * 0.5 && (this.fechada || i > 0)) i = this.idx(i - 1);
      else break;
    }
    _a.set(pos.x - P[i * 3], pos.y - P[i * 3 + 1], pos.z - P[i * 3 + 2]);
    const sl = _a.dot(_t.fromArray(this.T, i * 3));
    out.i = i;
    out.s = this.normaliza(i * this.ds + sl);
    // uma iteracao de Newton com o quadro interpolado no s achado: na curva fechada a tangente gira dentro do metro, e sem isto o
    // carro a 5 m do centro de uma curva de 18 m "anda" 16 cm para tras e para frente a cada passo (tremedeira no d)
    this.quadro(out.s, _pT, _pN, _pR);
    let base = this.ponto(out.s, 0, 0, _pBase);
    const ajuste = (pos.x - base.x) * _pT.x + (pos.y - base.y) * _pT.y + (pos.z - base.z) * _pT.z;
    if (Math.abs(ajuste) > 1e-4) {
      out.s = this.normaliza(out.s + ajuste);
      this.quadro(out.s, _pT, _pN, _pR);
      base = this.ponto(out.s, 0, 0, _pBase);
    }
    const vx = pos.x - base.x, vy = pos.y - base.y, vz = pos.z - base.z;
    out.d = vx * _pR.x + vy * _pR.y + vz * _pR.z;
    out.h = vx * _pN.x + vy * _pN.y + vz * _pN.z;
    out.dist2 = md;
    return out;
  }
}
const _loc = { i: 0, f: 0 };

/** Interpola um atributo dos pontos de controle (largura, inclinacao) no parametro t da curva, com suavizacao (smoothstep) entre dois
 *  pontos vizinhos: degrau de largura vira rampa suave, sem quina na malha. */
function atributoEm(valores, t, fechada) {
  const m = valores.length, segs = fechada ? m : m - 1;
  const x = Math.min(segs - 1e-6, Math.max(0, t * segs));
  const k = Math.floor(x), f = x - k;
  const a = valores[k], b = valores[(k + 1) % m];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Normaliza um ponto de controle: aceita [x, y, z] ou { p: [x, y, z], larg, incl, cima }. `cima` (opcional, so faz sentido em
 *  trecho magnetico) e o "cima da pista" naquele ponto — o loop gerado por `geraLoop` aponta para o eixo do loop. */
function pontoDeControle(c) {
  if (Array.isArray(c)) return { p: new THREE.Vector3(c[0], c[1], c[2]), larg: null, incl: null, cima: null };
  return { p: new THREE.Vector3(c.p[0], c.p[1], c.p[2]), larg: c.larg ?? null, incl: c.incl ?? null,
    cima: c.cima ? new THREE.Vector3(c.cima[0], c.cima[1], c.cima[2]).normalize() : null };
}

/** LOOP pronto para a lista de pontos de uma pista: `n` pontos de `passoGraus` em `passoGraus` numa volta inteira, a partir de
 *  `inicio`, andando na direcao horizontal `direcao`, com raio `raio` e deslocando `desloca` metros para a DIREITA do piloto ao
 *  longo da volta (para a saida passar ao lado da entrada: use desloca >= largura + 2). Cada ponto leva o `cima` apontando para o
 *  eixo do loop — num loop deslocado (helice) o quadro transportado tomba ate 40 graus no topo, o eixo nao. Marque os indices
 *  devolvidos como trecho 'magnetico'. */
export function geraLoop({ inicio, direcao, raio = 10, desloca = 16, passoGraus = 30, largura = null }) {
  const T0 = new THREE.Vector3(direcao[0], 0, direcao[2]).normalize();
  const R0 = new THREE.Vector3().crossVectors(T0, UP).normalize(); // direita do piloto
  const out = [], n = Math.round(360 / passoGraus);
  for (let k = 0; k <= n; k++) {
    const a = THREE.MathUtils.degToRad(k * passoGraus);
    const p = new THREE.Vector3(...inicio).addScaledVector(T0, raio * Math.sin(a)).addScaledVector(UP, raio * (1 - Math.cos(a)))
      .addScaledVector(R0, (desloca * k) / n);
    const cima = new THREE.Vector3().copy(UP).multiplyScalar(Math.cos(a)).addScaledVector(T0, -Math.sin(a));
    const c = { p: p.toArray(), cima: cima.toArray() };
    if (largura) c.larg = largura;
    out.push(c);
  }
  return out;
}

/** Amostra uma curva CatmullRom de metro em metro e monta os quadros. `controles` = pontos normalizados; `fechada`; `trechos` em
 *  indice de ponto de controle ({ de, ate, tipo }, fracionario vale). Devolve os arrays para a Superficie e a tabela t -> s. */
function amostraCurva(controles, fechada, larguraBase, trechos, comMuro) {
  const pts = controles.map((c) => c.p);
  const curva = new THREE.CatmullRomCurve3(pts, fechada, 'centripetal');
  const m = pts.length, segs = fechada ? m : m - 1;
  // tabela fina t -> s (64 por segmento): da o s de cada ponto de controle (os trechos sao marcados por ponto de controle)
  const FINO = segs * 64;
  const tabT = new Float64Array(FINO + 1), tabS = new Float64Array(FINO + 1);
  let acc = 0; curva.getPoint(0, _a);
  for (let k = 1; k <= FINO; k++) { curva.getPoint(k / FINO, _b); acc += _b.distanceTo(_a); _a.copy(_b); tabT[k] = k / FINO; tabS[k] = acc; }
  const L = acc;
  const sDeT = (t) => { const x = Math.min(FINO, Math.max(0, t * FINO)); const k = Math.min(FINO - 1, Math.floor(x)); return tabS[k] + (tabS[k + 1] - tabS[k]) * (x - k); };
  const tDeS = (s) => { // busca binaria na tabela
    let lo = 0, hi = FINO; if (s <= 0) return 0; if (s >= L) return 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tabS[mid] < s) lo = mid; else hi = mid; }
    const f = (s - tabS[lo]) / Math.max(1e-9, tabS[hi] - tabS[lo]); return (lo + f) / FINO;
  };
  // numero de amostras: fechada = n trechos iguais que fecham a volta; aberta = n + 1 pontos das pontas inclusive
  const nTrechos = Math.max(4, Math.round(L / PASSO_AMOSTRA));
  const passo = L / nTrechos; // ~1 m (a Superficie usa este passo: o s dela e o comprimento de arco de verdade)
  const nAm = fechada ? nTrechos : nTrechos + 1;
  const pontos = [], frente = [], cima = [], larguras = [], marcas = [], ts = [];
  const larg = controles.map((c) => c.larg ?? larguraBase), incl = controles.map((c) => c.incl ?? 0);
  for (let i = 0; i < nAm; i++) {
    const t = tDeS(i * passo); ts.push(t);
    pontos.push(curva.getPoint(t, new THREE.Vector3()));
    larguras.push(atributoEm(larg, t, fechada));
  }
  for (let i = 0; i < nAm; i++) {
    const a = fechada ? (i - 1 + nAm) % nAm : Math.max(0, i - 1), b = fechada ? (i + 1) % nAm : Math.min(nAm - 1, i + 1);
    frente.push(new THREE.Vector3().subVectors(pontos[b], pontos[a]).normalize());
  }
  // marcas: muro dos dois lados por padrao (comMuro), e os trechos por cima
  const sCtrl = (k) => sDeT(k / segs);
  for (let i = 0; i < nAm; i++) marcas.push(comMuro ? (MARCA.MURO_ESQ | MARCA.MURO_DIR) : 0);
  for (const tr of trechos || []) {
    const bit = TIPOS_DE_TRECHO[tr.tipo];
    if (bit === undefined) throw new Error('trecho desconhecido: ' + tr.tipo);
    const s0 = sCtrl(tr.de), s1 = sCtrl(tr.ate);
    const i0 = Math.round(s0 / passo), i1 = Math.round(s1 / passo);
    const desliga = tr.tipo.startsWith('sem_muro');
    for (let k = i0; k <= (i1 >= i0 ? i1 : i1 + nAm); k++) {
      const i = fechada ? k % nAm : Math.min(nAm - 1, k);
      marcas[i] = desliga ? (marcas[i] & ~bit) : (marcas[i] | bit);
    }
  }
  // QUADROS. Fora do loop: "cima" = o Y do mundo projetado no plano normal a T (absoluto: nao acumula erro numa volta de 3 km) girado
  // pela inclinacao do ponto de controle. Dentro de trecho MAGNETICO (loop): o cima e TRANSPORTADO amostra a amostra (quadro que nao
  // gira em torno de T), que e o que faz N apontar para o centro do loop la em cima; na saida, mistura de volta para o absoluto em
  // MISTURA amostras para nao dar degrau.
  const MISTURA = 20;
  const absoluto = (i, out) => {
    const T = frente[i];
    out.copy(UP).addScaledVector(T, -UP.dot(T));
    if (out.lengthSq() < 1e-6) out.set(0, 0, 1).addScaledVector(T, -T.z); // pista vertical fora de loop: so por seguranca
    out.normalize();
    const b = THREE.MathUtils.degToRad(atributoEm(incl, ts[i], fechada));
    if (b !== 0) { // inclinacao positiva: N tomba para a direita (borda direita mais baixa) — curva para a direita
      _c.crossVectors(T, out).normalize(); // R
      out.multiplyScalar(Math.cos(b)).addScaledVector(_c, Math.sin(b)).normalize();
    }
    return out;
  };
  // cima explicito dos pontos de controle (loop do geraLoop): interpolado entre os dois pontos do segmento quando os dois tem
  const cimaCtrl = (t, out) => {
    const x = Math.min(segs - 1e-6, Math.max(0, t * segs)), k = Math.floor(x), f = x - k;
    const a = controles[k].cima, b = controles[(k + 1) % m].cima;
    if (!a || !b) return null;
    return out.copy(a).lerp(b, f * f * (3 - 2 * f));
  };
  let transportado = null, depois = MISTURA + 1;
  for (let i = 0; i < nAm; i++) {
    const mag = (marcas[i] & MARCA.MAGNETICO) !== 0;
    const T = frente[i];
    const nAbs = absoluto(i, new THREE.Vector3());
    const explicito = mag ? cimaCtrl(ts[i], new THREE.Vector3()) : null;
    if (explicito && explicito.lengthSq() > 1e-6) {
      explicito.addScaledVector(T, -explicito.dot(T)).normalize();
      cima.push(explicito);
      transportado = explicito.clone(); depois = 0;
    } else if (mag) {
      if (!transportado) transportado = (i > 0 ? cima[i - 1].clone() : nAbs.clone());
      transportado.addScaledVector(T, -transportado.dot(T)).normalize();
      cima.push(transportado.clone());
      depois = 0;
    } else if (transportado && depois < MISTURA) {
      transportado.addScaledVector(T, -transportado.dot(T)).normalize();
      const w = (depois + 1) / MISTURA; // 0 -> 1: do transportado para o absoluto
      const nm = transportado.clone().lerp(nAbs, w);
      cima.push(nm.addScaledVector(T, -nm.dot(T)).normalize());
      depois++;
      if (depois >= MISTURA) transportado = null;
    } else {
      cima.push(nAbs);
    }
  }
  return { pontos, frente, cima, larguras, marcas, L, sCtrl, passo, curva, tDeS };
}

/** Uma pista inteira: a superficie principal (fechada) + atalhos + dados da corrida (grade de largada, tema...). */
export class Pista {
  /** `def` = o objeto exportado por js/pistas/<id>.js (formato em docs/CONTRATOS.md secao 4). */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.nome = def.nome;
    this.tema = def.tema || {};
    const base = def.largura || LARGURA_PADRAO;
    const ctrl = def.pontos.map(pontoDeControle);
    const am = amostraCurva(ctrl, true, base, def.trechos, def.muro !== false);
    am.marcas[0] |= MARCA.LARGADA;
    this.principal = new Superficie({ id: 0, fechada: true, ...am });
    this.comprimento = this.principal.comprimento;
    this._sCtrl = am.sCtrl;
    /** s (na principal) de um ponto de controle k da principal — para posicionar coisas pelo indice do ponto. */
    this.sDoPonto = (k) => am.sCtrl(k);
    this.superficies = [this.principal];
    this.atalhos = [];
    for (const [k, a] of (def.atalhos || []).entries()) this._montaAtalho(k + 1, a, base);
  }

  /** ATALHO: uma tira aberta que nasce colada na borda da principal no ponto `de`, corre BOCA_DO_ATALHO metros ao lado dela, passa pelos
   *  `pontos` do atalho e volta a encostar na borda no ponto `ate`. Nas duas bocas a borda da principal e a borda interna do atalho
   *  abrem (sem muro), e quem cruza a borda ali troca de superficie. */
  _montaAtalho(id, a, base) {
    const P = this.principal, lado = a.lado === 'esq' ? -1 : 1;
    const lb = a.largura || Math.round(base * 0.6);
    const sA = this.sDoPonto(a.de), sB = this.sDoPonto(a.ate);
    const desvio = (s) => (P.larguraEm(s) * 0.5 + lb * 0.5) * lado;
    const ctrl = [];
    // boca de entrada: 3 pontos paralelos a principal (0, 6 e 12 m)
    for (const k of [0, 0.5, 1]) ctrl.push({ p: P.ponto(sA + k * BOCA_DO_ATALHO, desvio(sA + k * BOCA_DO_ATALHO), 0, new THREE.Vector3()).toArray(), larg: lb });
    for (const c of a.pontos) { const pc = pontoDeControle(c); ctrl.push({ p: pc.p.toArray(), larg: pc.larg ?? lb, incl: pc.incl ?? 0 }); }
    for (const k of [1, 0.5, 0]) ctrl.push({ p: P.ponto(sB - k * BOCA_DO_ATALHO, desvio(sB - k * BOCA_DO_ATALHO), 0, new THREE.Vector3()).toArray(), larg: lb });
    const nCtrl = ctrl.length;
    // os trechos do atalho vem em indice dos `pontos` do atalho; desloca 3 (a boca de entrada)
    const trechos = (a.trechos || []).map((t) => ({ ...t, de: t.de + 3, ate: t.ate + 3 }));
    const am = amostraCurva(ctrl.map(pontoDeControle), false, lb, trechos, a.muro !== false);
    const sup = new Superficie({ id, fechada: false, ...am });
    // bocas: abre a borda de dentro do atalho e a borda da principal nos dois encontros
    const bitPrincipal = lado > 0 ? MARCA.ABRE_DIR : MARCA.ABRE_ESQ, muroPrincipal = lado > 0 ? MARCA.MURO_DIR : MARCA.MURO_ESQ;
    const bitAtalho = lado > 0 ? MARCA.ABRE_ESQ : MARCA.ABRE_DIR, muroAtalho = lado > 0 ? MARCA.MURO_ESQ : MARCA.MURO_DIR;
    const nB = Math.round(BOCA_DO_ATALHO / sup.ds);
    for (let i = 0; i <= nB; i++) { sup.marcas[sup.idx(i)] = (sup.marcas[sup.idx(i)] | bitAtalho) & ~muroAtalho; sup.marcas[sup.idx(sup.n - 1 - i)] = (sup.marcas[sup.idx(sup.n - 1 - i)] | bitAtalho) & ~muroAtalho; }
    for (const s0 of [sA, sB - BOCA_DO_ATALHO]) {
      const i0 = Math.round(P.normaliza(s0) / P.ds);
      for (let k = 0; k <= nB; k++) { const i = P.idx(i0 + k); P.marcas[i] = (P.marcas[i] | bitPrincipal) & ~muroPrincipal; }
    }
    const info = { sup, lado, sEntrada: P.normaliza(sA), sSaida: P.normaliza(sB), largura: lb, nome: a.nome || ('Atalho ' + id), nCtrl };
    // trecho da principal que o atalho pula (para converter o s do atalho em "progresso" na corrida)
    info.sPulado = P.normaliza(sB - sA);
    this.atalhos.push(info);
    this.superficies.push(sup);
  }

  /** PROGRESSO equivalente na principal: o `s` de quem esta num atalho e convertido proporcionalmente para o trecho da principal que o
   *  atalho pula. E o que ordena os carros na corrida e conta a volta (os atalhos nunca cruzam a largada). */
  sPrincipal(supId, s) {
    if (supId === 0) return s;
    const a = this.atalhos[supId - 1];
    return this.principal.normaliza(a.sEntrada + (s / a.sup.comprimento) * a.sPulado);
  }

  /** Superficie por id (0 = principal). */
  sup(id) { return this.superficies[id]; }

  /** TROCA DE SUPERFICIE na boca de um atalho. Chamado pela fisica quando o carro passou da borda (|d| > meia largura) numa amostra
   *  com ABRE_*. Devolve { sup, i, s, d, h } na nova superficie ou null (nao ha superficie ali: e muro de verdade ou queda). */
  transicao(supId, s, d, pos, out) {
    const lado = d > 0 ? 1 : -1;
    if (supId === 0) {
      for (const a of this.atalhos) {
        if (a.lado !== lado) continue;
        const naEntrada = this._dentro(s, a.sEntrada, BOCA_DO_ATALHO + 2), naSaida = this._dentro(s, a.sSaida - BOCA_DO_ATALHO, BOCA_DO_ATALHO + 2);
        if (!naEntrada && !naSaida) continue;
        const dica = naEntrada ? 0 : a.sup.n - 1;
        a.sup.projeta(pos, dica, Math.round(BOCA_DO_ATALHO * 1.5), out);
        if (Math.abs(out.d) <= a.sup.larguraEm(out.s) * 0.5 + 0.5 && Math.abs(out.h) < 2.5) { out.sup = a.sup.id; return out; }
      }
      return null;
    }
    const a = this.atalhos[supId - 1];
    if (a.lado !== -lado) return null; // a borda de dentro do atalho e a do lado oposto ao lado em que ele saiu
    const P = this.principal;
    const dica = Math.round((s < a.sup.comprimento * 0.5 ? a.sEntrada : a.sSaida) / P.ds);
    P.projeta(pos, dica, Math.round(BOCA_DO_ATALHO * 2.5), out);
    if (Math.abs(out.d) <= P.larguraEm(out.s) * 0.5 + 0.5 && Math.abs(out.h) < 2.5) { out.sup = 0; return out; }
    return null;
  }

  _dentro(s, ini, comp) { const L = this.comprimento; const x = ((s - ini) % L + L) % L; return x <= comp; }

  /** GRADE DE LARGADA: n posicoes atras da linha (s = 0), em filas de 2, 8 m entre filas, a 1/4 da largura do centro. A primeira e a pole.
   *  Devolve [{ s, d }] na principal. */
  grade(n) {
    const P = this.principal, out = [];
    for (let k = 0; k < n; k++) {
      const fila = Math.floor(k / 2), s = P.normaliza(-10 - fila * 8 - (k % 2) * 3);
      const d = (k % 2 === 0 ? -1 : 1) * P.larguraEm(s) * 0.22;
      out.push({ s, d });
    }
    return out;
  }
}
