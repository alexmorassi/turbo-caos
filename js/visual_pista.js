// VISUAL DA PISTA (fase 3) — o contrato da secao 4: `montaVisualDaPista(G, pista) -> { grupo, quadro(dt), destroi() }`.
// Monta, nesta ordem: as AMOSTRAS da pista (o que cada metro e: asfalto, terra, vao, rampa, elevado, muro...), o CENARIO (o chao
// ajustado a pista e os objetos do tema — js/cenario.js), as FITAS (asfalto, zebras, muros, saias, lajes, pilares, rampas), as setas do
// IMPULSO, a linha de chegada com a grade, o PORTICO, as placas de aviso e o CEU com a luz e a neblina (js/ceu.js).
//
// DESEMPENHO (o celular manda):
//   * a fita e cortada em PEDACOS de ~60 m (culling por pedaco) e cada pedaco e UMA malha com UM material: Lambert com uma textura
//     ATLAS de canvas em colunas (asfalto com as faixas, branco, concreto, terra, perigo, rampa) e cor de vertice. As colunas repetem
//     em v (ao longo da pista) e cada parte da fita escolhe a coluna pelo u — zebra, muro, saia, pilar e laje saem no mesmo desenho;
//   * o que brilha (setas do impulso, luzes do portico, faixas neon) e MeshBasic sem tone mapping, poucas malhas;
//   * nada e alocado no quadro(dt): ele so rola a textura das setas, segue a camera com o ceu e corta o cenario por distancia.
// O "risco tem de ser visivel": onde nao ha muro nao se desenha muro (a borda fica com a saia nua e os cones de aviso do cenario), o
// vao some de verdade (a fita acaba numa face de perigo listrada, com o fosso embaixo) e a terra tem cor de terra.
import * as THREE from 'three';
import { MARCA } from './pista.js';
import { montaCeu } from './ceu.js';
import { montaCenario, Pecas, cor, gerador, sementeDe } from './cenario.js';
import { faixasEmS } from './pistas/consulta.js';
import { on } from './eventos.js';

/** Amostras por pedaco da fita (~100 m): culling fino o bastante sem virar centenas de chamadas de desenho (com 60 m a Neon desenhava
 *  31 pedacos de uma vez no cruzamento do oito). */
const PEDACO = 100;
/** Altura e espessura do muro (m). O muro da fisica e infinito (|d| > meia largura); o desenhado e uma mureta que a crianca enxerga. */
const MURO_ALTURA = 1.0, MURO_ESPESSURA = 0.5;
/** Espessura da laje dos trechos elevados (m) e intervalo dos pilares (m). */
const LAJE = 0.9, PILAR_CADA = 14;
/** Comprimento do ladrilho da textura ao longo da pista (m): as faixas tracejadas e as zebras repetem nele. */
const LADRILHO = 16;
/** Zebra: largura (m) e curvatura minima (1/m) — so nas curvas mais fechadas que ~170 m de raio, como no autodromo. */
const ZEBRA_LARG = 1.1, ZEBRA_CURVA = 1 / 170;
/** Altura acima da qual um trecho marcado como elevado deixa de segurar o chao (m). */
const ELEVADO_MIN = 1.2;

// colunas do atlas (fracoes de u) — ver `atlas()`
const W_ATLAS = 1024, H_ATLAS = 512;
const COL = {
  asfalto: [4, 444], branco: [460, 476], concreto: [492, 612], terra: [628, 812], perigo: [828, 916], rampa: [932, 1020],
};
for (const k of Object.keys(COL)) COL[k] = [COL[k][0] / W_ATLAS, COL[k][1] / W_ATLAS];

const _v = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3(), _c = new THREE.Color();

// ================================================================ texturas de canvas
function canvas(w, h, desenha) { const c = document.createElement('canvas'); c.width = w; c.height = h; desenha(c.getContext('2d'), w, h); return c; }
const hex = (c) => '#' + cor(c).getHexString();

/** O ATLAS da fita (1024 x 512): uma coluna por material, todas repetindo em v a cada LADRILHO metros. O asfalto ja sai com a cor do
 *  tema e as faixas (a cor de vertice do asfalto e branca); as outras colunas sao claras e levam a cor do tema pelo vertice. */
function atlas(tema) {
  const r = gerador(sementeDe('atlas' + (tema.estilo || '')));
  const c = canvas(W_ATLAS, H_ATLAS, (g) => {
    const px = (k) => Math.round(COL[k][0] * W_ATLAS) - 4, larg = (k) => Math.round((COL[k][1] - COL[k][0]) * W_ATLAS) + 8;
    // --- asfalto: cor do tema com granulado, marcas de pneu, bordas brancas e tracejado no meio
    {
      const x0 = px('asfalto'), w = larg('asfalto');
      const base = cor(tema.asfalto, '#4a4e55');
      g.fillStyle = hex(base); g.fillRect(x0, 0, w, H_ATLAS);
      for (let k = 0; k < 9000; k++) {
        const x = x0 + r() * w, y = r() * H_ATLAS, v = r();
        g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.10)';
        g.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
      }
      // marcas de pneu nas trajetorias (duas faixas mais escuras)
      for (const f of [0.3, 0.68]) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0 + w * f, 0, w * 0.07, H_ATLAS); }
      const faixa = hex(tema.faixa || '#ffffff');
      g.fillStyle = faixa;
      g.fillRect(x0 + w * 0.035, 0, w * 0.028, H_ATLAS);
      g.fillRect(x0 + w * (1 - 0.063), 0, w * 0.028, H_ATLAS);
      // tracejado: 6 m pintados, 10 m vazios (o ladrilho e de 16 m)
      g.fillStyle = hex(tema.tracejado || tema.faixa || '#ffffff');
      g.fillRect(x0 + w * 0.493, 0, w * 0.018, H_ATLAS * (6 / 16));
    }
    // --- branco (zebra, painel do muro: a cor vem do vertice)
    g.fillStyle = '#ffffff'; g.fillRect(px('branco'), 0, larg('branco'), H_ATLAS);
    // --- concreto: claro, com juntas a cada 4 m e manchas leves (saia, laje, pilar)
    {
      const x0 = px('concreto'), w = larg('concreto');
      g.fillStyle = '#e8e6e0'; g.fillRect(x0, 0, w, H_ATLAS);
      for (let k = 0; k < 1400; k++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'; g.fillRect(x0 + r() * w, r() * H_ATLAS, 2 + r() * 5, 2 + r() * 5); }
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0; k < 4; k++) g.fillRect(x0, (k * H_ATLAS) / 4, w, 3);
    }
    // --- terra: bege granulado com pedrinhas (a cor do tema multiplica: areia, lama, neve fofa)
    {
      const x0 = px('terra'), w = larg('terra');
      g.fillStyle = '#e9dcc4'; g.fillRect(x0, 0, w, H_ATLAS);
      for (let k = 0; k < 5000; k++) { const v = r(); g.fillStyle = v < 0.45 ? 'rgba(90,60,30,0.16)' : v < 0.8 ? 'rgba(255,255,255,0.18)' : 'rgba(60,40,20,0.3)'; g.fillRect(x0 + r() * w, r() * H_ATLAS, 1 + r() * 3, 1 + r() * 3); }
      // sulcos de pneu
      g.fillStyle = 'rgba(80,55,30,0.18)';
      for (const f of [0.28, 0.36, 0.64, 0.72]) g.fillRect(x0 + w * f, 0, w * 0.035, H_ATLAS);
    }
    // --- perigo: amarelo e preto em diagonal
    {
      const x0 = px('perigo'), w = larg('perigo');
      g.fillStyle = '#ffd21f'; g.fillRect(x0, 0, w, H_ATLAS);
      g.save(); g.beginPath(); g.rect(x0, 0, w, H_ATLAS); g.clip();
      g.fillStyle = '#1b1b1b';
      for (let y = -w; y < H_ATLAS + w; y += 64) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y + w * 0.6); g.lineTo(x0 + w, y + w * 0.6 + 30); g.lineTo(x0, y + 30); g.closePath(); g.fill(); }
      g.restore();
    }
    // --- rampa: laranja com divisas brancas apontando para a frente (v crescente = sentido da corrida; canvas y para cima = +v)
    {
      const x0 = px('rampa'), w = larg('rampa');
      g.fillStyle = hex(tema.corRampa || '#ff7a1a'); g.fillRect(x0, 0, w, H_ATLAS);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (let k = 0; k < 4; k++) {
        const y = k * (H_ATLAS / 4) + 30;
        g.beginPath(); g.moveTo(x0 + w * 0.12, y + 70); g.lineTo(x0 + w * 0.5, y); g.lineTo(x0 + w * 0.88, y + 70); g.lineTo(x0 + w * 0.88, y + 100); g.lineTo(x0 + w * 0.5, y + 32); g.lineTo(x0 + w * 0.12, y + 100); g.closePath(); g.fill();
      }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Setas do impulso: divisas em ciano/amarelo com alfa (alphaTest corta o desenho; nada de transparencia ordenada). */
function texturaSetas(tema) {
  const c = canvas(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    const c1 = hex(tema.corImpulso || '#22e6ff'), c2 = hex(tema.corImpulso2 || '#fff36a');
    for (const [y, cc] of [[14, c1], [70, c2]]) {
      g.fillStyle = cc;
      g.beginPath(); g.moveTo(10, y + 44); g.lineTo(64, y); g.lineTo(118, y + 44); g.lineTo(118, y + 56); g.lineTo(64, y + 16); g.lineTo(10, y + 56); g.closePath(); g.fill();
    }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Xadrez da chegada (16 x 4 quadros) com uma faixa branca embaixo para as marcas da grade. */
function texturaChegada() {
  const c = canvas(256, 80, (g) => {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111111' : '#f6f6f6'; g.fillRect(i * 16, j * 16, 16, 16); }
    g.fillStyle = '#ffffff'; g.fillRect(0, 64, 256, 16);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Faixa do portico: nome do jogo e da pista, com xadrez nas pontas. */
function texturaFaixa(nome) {
  const c = canvas(1024, 160, (g) => {
    g.fillStyle = '#10204a'; g.fillRect(0, 0, 1024, 160);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 32, 16, 32); g.fillRect(1024 - 96 + i * 16, j * 32, 16, 32); }
    const gr = g.createLinearGradient(0, 20, 0, 110); gr.addColorStop(0, '#ffe45c'); gr.addColorStop(0.6, '#ff7a1a'); gr.addColorStop(1, '#e8321a');
    g.fillStyle = gr; g.font = 'italic 900 78px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TURBO CAOS', 512, 66);
    g.fillStyle = '#ffffff'; g.font = '700 34px system-ui, Arial, sans-serif'; g.fillText(nome.toUpperCase(), 512, 130);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Placas de aviso (atlas 4 x 1): salto, loop, atalho, cuidado. */
const PLACAS = { salto: 0, loop: 1, atalho: 2, cuidado: 3 };
function texturaPlacas() {
  const textos = [['SALTO!', '#ffd21f'], ['LOOP!', '#ff4fd8'], ['ATALHO', '#39d96a'], ['CUIDADO!', '#ff6a2a']];
  const c = canvas(1024, 256, (g) => {
    textos.forEach(([t, fundo], k) => {
      const x = k * 256;
      g.fillStyle = '#1b1b1b'; g.fillRect(x, 0, 256, 256);
      g.fillStyle = fundo; g.fillRect(x + 10, 10, 236, 236);
      g.fillStyle = '#1b1b1b'; g.font = '900 56px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x + 128, 176);
      // icone
      g.beginPath();
      if (k === 0) { g.moveTo(x + 50, 120); g.quadraticCurveTo(x + 128, 20, x + 206, 120); g.lineWidth = 14; g.stroke(); }
      else if (k === 1) { g.arc(x + 128, 80, 46, 0, Math.PI * 2); g.lineWidth = 14; g.stroke(); }
      else if (k === 2) { g.moveTo(x + 60, 80); g.lineTo(x + 160, 80); g.lineTo(x + 160, 50); g.lineTo(x + 210, 92); g.lineTo(x + 160, 134); g.lineTo(x + 160, 104); g.lineTo(x + 60, 104); g.closePath(); g.fill(); }
      else { g.moveTo(x + 128, 30); g.lineTo(x + 190, 130); g.lineTo(x + 66, 130); g.closePath(); g.fill(); g.fillStyle = fundo; g.fillRect(x + 121, 62, 14, 40); g.fillRect(x + 121, 110, 14, 12); }
    });
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ================================================================ amostras
/** Tudo o que o visual e o terreno precisam de cada amostra de cada superficie. Devolve { sups: [{ S, am: [...] }], lista (a cada 2 m,
 *  para o terreno) }. */
export function coletaAmostras(pista) {
  const sups = [], lista = [];
  const defs = [{ elevados: pista.def.elevados, figuras: pista.def.figuras }, ...(pista.def.atalhos || []).map((a) => ({ elevados: a.elevados, figuras: a.figuras }))];
  for (const S of pista.superficies) {
    const d = defs[S.id] || {};
    const elev = faixasEmS(pista, S.id, d.elevados);
    const figs = faixasEmS(pista, S.id, d.figuras).map((f) => ({ ...f, sC: f.crista !== undefined ? faixaDe(pista, S.id, f.crista) : null, sP: f.pouso !== undefined ? faixaDe(pista, S.id, f.pouso) : null }));
    const am = [];
    const n = S.n;
    // altura de referencia de cada faixa elevada: a reta entre as alturas das duas pontas (o chao "de antes e de depois")
    const yEm = (s) => S.ponto(S.normaliza(s), 0, 0, _v).y;
    const refs = elev.map((e) => ({ ...e, y0: yEm(e.s0), y1: yEm(e.s1) }));
    for (let i = 0; i < n; i++) {
      const s = i * S.ds, o = i * 3, m = S.marcas[i];
      const x = S.P[o], y = S.P[o + 1], z = S.P[o + 2];
      const ny = S.N[o + 1];
      let elevado = false, ponte = false;
      for (const e of refs) {
        if (s < e.s0 - 0.5 || s > e.s1 + 0.5) continue;
        const f = e.s1 > e.s0 ? (s - e.s0) / (e.s1 - e.s0) : 0, yr = e.y0 + (e.y1 - e.y0) * f;
        if (e.ponte || y - yr > ELEVADO_MIN || ny < 0.75) elevado = true;
        if (e.ponte) ponte = true;
      }
      let rampa = null;
      for (const f of figs) {
        if (f.tipo !== 'rampa') continue;
        if (s >= f.s0 && s <= f.sC) rampa = 'subida';
        else if (f.sP !== null && s >= f.sP && s <= f.s1) rampa = 'pouso';
      }
      const tx = S.T[o], tz = S.T[o + 2], th = Math.hypot(tx, tz) || 1;
      const rx = S.R[o], ry = S.R[o + 1], rz = S.R[o + 2], rh = Math.hypot(rx, rz) || 1e-3;
      const hw = S.larg[i] * 0.5;
      const a = {
        sup: S.id, i, s, x, y, z, ny, hw, m,
        tx: tx / th, tz: tz / th, rhx: rx / rh, rhz: rz / rh, rh, ry, hwH: hw * rh, yMin: y - Math.abs(ry) * hw,
        vao: (m & MARCA.VAO) !== 0, elev: elevado, ponte, rampa, terra: (m & MARCA.TERRA) !== 0, impulso: (m & MARCA.IMPULSO) !== 0,
        mag: (m & MARCA.MAGNETICO) !== 0, kh: S.kh[i],
      };
      am.push(a);
      if (i % 2 === 0) lista.push(a);
    }
    // zebra: curvatura forte ou pista inclinada, dilatada 8 amostras para cada lado (entra antes e sai depois da curva)
    const zeb = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = am[i];
      if (a.vao || a.mag || a.rampa || a.terra) continue;
      if (Math.abs(a.kh) > ZEBRA_CURVA || Math.abs(a.ry) > 0.06) for (let k = -8; k <= 8; k++) { const j = S.fechada ? ((i + k) % n + n) % n : Math.min(n - 1, Math.max(0, i + k)); zeb[j] = 1; }
    }
    for (let i = 0; i < n; i++) { const a = am[i]; a.zebra = zeb[i] === 1 && !a.vao && !a.mag && !a.rampa && !a.terra; }
    sups.push({ S, am, figs });
  }
  return { sups, lista };
}
function faixaDe(pista, sup, k) { return faixasEmS(pista, sup, [{ de: k, ate: k }])[0].s0; }

// ================================================================ fita (geometria acumulada de um pedaco)
class Fita {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get vazia() { return this.idx.length === 0; }
  /** quadrilatero p0 p1 p2 p3 (em ordem em volta), normal de referencia `n` (a face da frente fica do lado dela), uvs [[u,v] x4], cor */
  quad(p0, p1, p2, p3, n, uvs, c, normais = null) {
    const b = this.pos.length / 3;
    const ps = [p0, p1, p2, p3];
    for (let k = 0; k < 4; k++) {
      const p = ps[k]; this.pos.push(p.x, p.y, p.z);
      const nn = normais ? normais[k] : n; this.nor.push(nn.x, nn.y, nn.z);
      this.uv.push(uvs[k][0], uvs[k][1]);
      this.col.push(c.r, c.g, c.b);
    }
    // orientacao: (p1 - p0) x (p2 - p0) tem de concordar com n
    const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z, bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * n.x + cy * n.y + cz * n.z >= 0) this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// vetores de trabalho da montagem (a montagem roda uma vez por corrida, fora do passo)
const W = Array.from({ length: 16 }, () => new THREE.Vector3());

/** Ponto do mundo na amostra `a` da superficie S em (d, h): P + R d + N h. */
function pt(S, i, d, h, out) {
  const o = i * 3;
  return out.set(S.P[o] + S.R[o] * d + S.N[o] * h, S.P[o + 1] + S.R[o + 1] * d + S.N[o + 1] * h, S.P[o + 2] + S.R[o + 2] * d + S.N[o + 2] * h);
}
const vecN = (S, i, out) => out.fromArray(S.N, i * 3);
const vecR = (S, i, out) => out.fromArray(S.R, i * 3);
const vecT = (S, i, out) => out.fromArray(S.T, i * 3);

/** Altura h (no quadro da amostra) que leva o ponto (d) ate o chao desenhado menos `abaixo` m. Para a saia e o muro dos trechos no chao. */
function hAteChao(S, i, d, terreno, abaixo = 0.35) {
  const p = pt(S, i, d, 0, W[15]);
  const ny = Math.max(0.35, S.N[i * 3 + 1]);
  const h = (terreno.altura(p.x, p.z) - abaixo - p.y) / ny;
  return Math.max(-14, Math.min(-0.45, h));
}

/** As fitas de todas as superficies: devolve as malhas (pedacos) e as setas do impulso. */
function montaFitas(pista, A, terreno, tema, materiais) {
  const malhas = [], brilhos = [];
  const cAsf = new THREE.Color(1, 1, 1);
  const cEst = cor(tema.estrutura, '#d9d4c7'), cEstEsc = cEst.clone().multiplyScalar(0.72), cBaixo = cEst.clone().multiplyScalar(0.55);
  const cTerra = cor(tema.corTerra, '#c9a46a');
  const zebra = (tema.zebra || ['#e8242a', '#ffffff']).map((c) => cor(c));
  const muro = (tema.muro || ['#ffffff', '#e8242a']).map((c) => cor(c));
  const cTopoMuro = cor(tema.muroTopo, '#f2f2f2');
  const brilhoMuro = tema.muroBrilho ? (Array.isArray(tema.muroBrilho) ? tema.muroBrilho : [tema.muroBrilho]).map((c) => cor(c)) : null;
  const uvc = (col, f) => col[0] + (col[1] - col[0]) * f;
  const Ub = (uvc(COL.branco, 0.5)), Uc0 = COL.concreto[0], Uc1 = COL.concreto[1];

  for (const { S, am } of A.sups) {
    const n = S.n, ultimo = S.fechada ? n : n - 1;
    // o que brilha (faixas neon do muro) e uma malha so por superficie: fino demais para valer o culling, e cada malha e uma chamada
    const setas = new Fita(), fb = new Fita();
    for (let p0 = 0; p0 < ultimo; p0 += PEDACO) {
      const f = new Fita();
      const p1 = Math.min(ultimo, p0 + PEDACO);
      for (let i = p0; i < p1; i++) {
        const j = S.idx(i + 1), a = am[i], b = am[j];
        const si = a.s, sj = si + S.ds;
        const vi = si / LADRILHO, vj = sj / LADRILHO;
        const hwi = a.hw, hwj = b.hw;
        const Ni = vecN(S, i, W[0]), Nj = vecN(S, j, W[1]);
        const furado = a.vao || b.vao;
        if (!furado) {
          // ---- topo: asfalto, terra ou rampa
          const col = a.rampa ? COL.rampa : a.terra ? COL.terra : COL.asfalto;
          const c = a.terra ? cTerra : cAsf;
          f.quad(pt(S, i, -hwi, 0, W[2]), pt(S, i, hwi, 0, W[3]), pt(S, j, hwj, 0, W[4]), pt(S, j, -hwj, 0, W[5]), Ni,
            [[col[0], vi], [col[1], vi], [col[1], vj], [col[0], vj]], c, [Ni, Ni, Nj, Nj]);
          // ---- faixa de perigo na boca do vao (ultimos 1,5 m da rampa)
          if (a.rampa === 'subida') {
            const sC = (A.sups[S.id].figs.find((g) => g.tipo === 'rampa' && si >= g.s0 && si <= g.sC) || {}).sC;
            if (sC !== undefined && sC - si < 1.6) f.quad(pt(S, i, -hwi, 0.02, W[2]), pt(S, i, hwi, 0.02, W[3]), pt(S, j, hwj, 0.02, W[4]), pt(S, j, -hwj, 0.02, W[5]), Ni,
              [[COL.perigo[0], vi * 3], [COL.perigo[1], vi * 3], [COL.perigo[1], vj * 3], [COL.perigo[0], vj * 3]], cAsf, [Ni, Ni, Nj, Nj]);
          }
          // ---- zebras
          if (a.zebra && b.zebra) {
            const cz = zebra[Math.floor(si / 2.5) % 2];
            for (const lado of [-1, 1]) {
              const abre = lado < 0 ? (a.m & MARCA.ABRE_ESQ) : (a.m & MARCA.ABRE_DIR);
              if (abre) continue;
              f.quad(pt(S, i, lado * (hwi - ZEBRA_LARG), 0.03, W[2]), pt(S, i, lado * hwi, 0.03, W[3]), pt(S, j, lado * hwj, 0.03, W[4]), pt(S, j, lado * (hwj - ZEBRA_LARG), 0.03, W[5]), Ni,
                [[Ub, vi], [Ub, vi], [Ub, vj], [Ub, vj]], cz, [Ni, Ni, Nj, Nj]);
            }
          }
          // ---- muros e saias
          const solido = !!(a.rampa || b.rampa);
          const elev = (a.elev || b.elev) && !solido;
          for (const lado of [-1, 1]) {
            const bitM = lado < 0 ? MARCA.MURO_ESQ : MARCA.MURO_DIR, bitA = lado < 0 ? MARCA.ABRE_ESQ : MARCA.ABRE_DIR;
            const temMuro = (a.m & bitM) && (b.m & bitM);
            const aberto = (a.m & bitA) || (b.m & bitA);
            const Ri = vecR(S, i, W[6]).multiplyScalar(lado), Rj = vecR(S, j, W[7]).multiplyScalar(lado);
            const fora = temMuro ? MURO_ESPESSURA : 0;
            // fundo: laje (elevado), ate o chao (no chao e na rampa macica)
            const hBi = elev ? -LAJE : hAteChao(S, i, lado * (hwi + fora), terreno);
            const hBj = elev ? -LAJE : hAteChao(S, j, lado * (hwj + fora), terreno);
            if (temMuro) {
              const cm = muro[Math.floor(si / 4) % muro.length];
              const nIn = W[8].copy(Ri).negate();
              f.quad(pt(S, i, lado * hwi, 0, W[2]), pt(S, i, lado * hwi, MURO_ALTURA, W[3]), pt(S, j, lado * hwj, MURO_ALTURA, W[4]), pt(S, j, lado * hwj, 0, W[5]), nIn, [[Ub, vi], [Ub, vi], [Ub, vj], [Ub, vj]], cm);
              if (brilhoMuro) {
                const cb = brilhoMuro[Math.floor(si / 8) % brilhoMuro.length];
                fb.quad(pt(S, i, lado * (hwi - 0.01), MURO_ALTURA * 0.62, W[2]), pt(S, i, lado * (hwi - 0.01), MURO_ALTURA * 0.86, W[3]), pt(S, j, lado * (hwj - 0.01), MURO_ALTURA * 0.86, W[4]), pt(S, j, lado * (hwj - 0.01), MURO_ALTURA * 0.62, W[5]), nIn, [[0, 0], [0, 0], [0, 0], [0, 0]], cb);
              }
              f.quad(pt(S, i, lado * hwi, MURO_ALTURA, W[2]), pt(S, i, lado * (hwi + fora), MURO_ALTURA, W[3]), pt(S, j, lado * (hwj + fora), MURO_ALTURA, W[4]), pt(S, j, lado * hwj, MURO_ALTURA, W[5]), Ni, [[Ub, vi], [Ub, vi], [Ub, vj], [Ub, vj]], cTopoMuro);
              f.quad(pt(S, i, lado * (hwi + fora), MURO_ALTURA, W[2]), pt(S, i, lado * (hwi + fora), hBi, W[3]), pt(S, j, lado * (hwj + fora), hBj, W[4]), pt(S, j, lado * (hwj + fora), MURO_ALTURA, W[5]), Ri,
                [[Uc0, vi], [Uc1, vi], [Uc1, vj], [Uc0, vj]], cEstEsc);
            } else if (!aberto) {
              f.quad(pt(S, i, lado * hwi, 0, W[2]), pt(S, i, lado * hwi, hBi, W[3]), pt(S, j, lado * hwj, hBj, W[4]), pt(S, j, lado * hwj, 0, W[5]), Ri,
                [[Uc0, vi], [Uc1, vi], [Uc1, vj], [Uc0, vj]], solido ? cEst : cEstEsc);
            }
          }
          // ---- laje por baixo (elevado, loop, saca-rolha, paredao): o loop visto de fora e solido
          if (elev) {
            const mE = (a.m & MARCA.MURO_ESQ) && (b.m & MARCA.MURO_ESQ) ? MURO_ESPESSURA : 0, mD = (a.m & MARCA.MURO_DIR) && (b.m & MARCA.MURO_DIR) ? MURO_ESPESSURA : 0;
            const nB = W[9].copy(Ni).negate();
            f.quad(pt(S, i, -hwi - mE, -LAJE, W[2]), pt(S, i, hwi + mD, -LAJE, W[3]), pt(S, j, hwj + mD, -LAJE, W[4]), pt(S, j, -hwj - mE, -LAJE, W[5]), nB, [[Uc0, vi], [Uc1, vi], [Uc1, vj], [Uc0, vj]], cBaixo);
          }
        }
        // ---- tampas do vao: a face da frente da rampa e a de tras do pouso, listradas de perigo, da pista ate o chao (ou a laje)
        if (a.vao !== b.vao) {
          const k = a.vao ? j : i; // a amostra com chao
          const Tk = vecT(S, k, W[10]).multiplyScalar(a.vao ? -1 : 1);
          const hw = am[k].hw, elev = am[k].elev && !am[k].rampa;
          const hE = elev ? -LAJE : hAteChao(S, k, -hw, terreno), hD = elev ? -LAJE : hAteChao(S, k, hw, terreno);
          const vv = Math.max(Math.abs(hE), Math.abs(hD)) / 4;
          f.quad(pt(S, k, -hw - MURO_ESPESSURA, 0, W[2]), pt(S, k, hw + MURO_ESPESSURA, 0, W[3]), pt(S, k, hw + MURO_ESPESSURA, hD, W[4]), pt(S, k, -hw - MURO_ESPESSURA, hE, W[5]), Tk,
            [[COL.perigo[0], 0], [COL.perigo[1], 0], [COL.perigo[1], vv], [COL.perigo[0], vv]], cAsf);
        }
        // ---- pilares debaixo da laje
        if (a.elev && !a.vao && !a.rampa && a.ny > 0.55 && Math.floor(si / PILAR_CADA) !== Math.floor((si - S.ds) / PILAR_CADA)) {
          const nP = hwi > 7 ? 2 : 1;
          for (let q = 0; q < nP; q++) {
            const d = nP === 1 ? 0 : (q ? 1 : -1) * hwi * 0.55;
            const topo = pt(S, i, d, -LAJE, W[11]).clone();
            const chao = terreno.altura(topo.x, topo.z) - 0.5;
            if (topo.y - chao < 1.2) continue;
            if (pilarBatePista(A, S.id, a, topo)) continue;
            pilar(f, topo, chao, 0.75, cEst);
          }
        }
        // ---- setas do impulso
        if (a.impulso && !furado) {
          const w = 0.42;
          setas.quad(pt(S, i, -hwi * w * 2, 0.04, W[2]), pt(S, i, hwi * w * 2, 0.04, W[3]), pt(S, j, hwj * w * 2, 0.04, W[4]), pt(S, j, -hwj * w * 2, 0.04, W[5]), Ni,
            [[0, si / 6], [1, si / 6], [1, sj / 6], [0, sj / 6]], cAsf, [Ni, Ni, Nj, Nj]);
        }
      }
      if (!f.vazia) { const m = new THREE.Mesh(f.geometria(), materiais.fita); m.name = 'fita'; m.matrixAutoUpdate = false; malhas.push(m); }
    }
    if (!fb.vazia) { const m = new THREE.Mesh(fb.geometria(), materiais.brilho); m.name = 'fita-brilho'; m.matrixAutoUpdate = false; brilhos.push(m); }
    if (!setas.vazia) { const m = new THREE.Mesh(setas.geometria(), materiais.setas); m.name = 'setas'; m.matrixAutoUpdate = false; brilhos.push(m); }
  }
  return { malhas, brilhos };
}

/** Pilar quadrado de `topo` ate `chao` (lado `r`*2), 4 faces na coluna de concreto. */
function pilar(f, topo, chao, r, c) {
  const vT = (topo.y - chao) / 4;
  const cantos = [[-r, -r], [r, -r], [r, r], [-r, r]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = cantos[k], [bx, bz] = cantos[(k + 1) % 4];
    const nx = (ax + bx) / 2, nz = (az + bz) / 2, nl = Math.hypot(nx, nz);
    const n = W[12].set(nx / nl, 0, nz / nl);
    f.quad(W[13].set(topo.x + ax, topo.y, topo.z + az), W[14].set(topo.x + bx, topo.y, topo.z + bz), new THREE.Vector3(topo.x + bx, chao, topo.z + bz), new THREE.Vector3(topo.x + ax, chao, topo.z + az), n,
      [[COL.concreto[0], 0], [COL.concreto[1], 0], [COL.concreto[1], vT], [COL.concreto[0], vT]], c);
  }
}

/** O pilar desceria em cima de outra pista (a de baixo da ponte)? */
function pilarBatePista(A, supId, a, topo) {
  for (const { S, am } of A.sups) {
    for (let i = 0; i < am.length; i += 2) {
      const b = am[i];
      if (S.id === supId) { let ds = Math.abs(b.s - a.s); if (S.fechada) ds = Math.min(ds, S.comprimento - ds); if (ds < 30) continue; }
      if (b.y > topo.y - 2) continue;
      if (Math.hypot(b.x - topo.x, b.z - topo.z) < b.hwH + MURO_ESPESSURA + 1.5) return true;
    }
  }
  return false;
}

// ================================================================ portico, chegada, placas
/** Linha de chegada xadrez em s = 0 e as marcas brancas da grade de largada. */
function montaChegada(pista, mat) {
  const S = pista.principal, f = new Fita(), branco = new THREE.Color(1, 1, 1);
  const hw = S.larguraEm(0) * 0.5;
  const quadS = (s0, s1, d0, d1, u0, u1, v0, v1, h = 0.035) => {
    S.quadro(S.normaliza(s0), _T, _N, _R);
    const a = S.ponto(S.normaliza(s0), d0, h, new THREE.Vector3()), b = S.ponto(S.normaliza(s0), d1, h, new THREE.Vector3());
    const c = S.ponto(S.normaliza(s1), d1, h, new THREE.Vector3()), d = S.ponto(S.normaliza(s1), d0, h, new THREE.Vector3());
    f.quad(a, b, c, d, _N.clone(), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], branco);
  };
  // xadrez: 2,4 m na direcao da corrida, a largura toda (o v do xadrez ocupa 0,2..1 da textura)
  quadS(-1.2, 1.2, -hw, hw, 0, 1, 0.2, 1);
  // grade: um "colchete" branco na frente de cada lugar
  for (const g of pista.grade(8)) {
    const s = g.s, d = g.d, w = 1.25;
    quadS(s + 2.6, s + 2.9, d - w, d + w, 0.1, 0.9, 0.02, 0.18);
    quadS(s + 1.2, s + 2.9, d - w, d - w + 0.18, 0.1, 0.9, 0.02, 0.18);
    quadS(s + 1.2, s + 2.9, d + w - 0.18, d + w, 0.1, 0.9, 0.02, 0.18);
  }
  const m = new THREE.Mesh(f.geometria(), mat);
  m.name = 'chegada'; m.matrixAutoUpdate = false;
  return m;
}

/** O portico da largada/chegada: duas torres, a viga com a faixa e o semaforo. Montado no quadro da pista em s = 0 (local: +X a
 *  esquerda do piloto, +Y o cima da pista, +Z a frente — o mesmo dos carros). */
function montaPortico(pista, tema, mats, guarda) {
  const S = pista.principal, hw = S.larguraEm(0) * 0.5, H = 8.5, X = hw + 1.8;
  const P = new Pecas(), Pb = new Pecas();
  const c1 = hex(tema.portico || '#e8321a'), c2 = '#f4f4f4';
  for (const lado of [-1, 1]) {
    P.add('caixa', c1, [lado * X, 0, 0], [1.4, H, 1.4]);
    P.add('caixa', c2, [lado * X, H * 0.25, 0], [1.46, 0.5, 1.46]);
    P.add('caixa', c2, [lado * X, H * 0.55, 0], [1.46, 0.5, 1.46]);
    P.add('caixa', '#3a3a3a', [lado * X, -1.2, 0], [2.0, 1.2, 2.0]);
  }
  P.add('caixa', c1, [0, H - 0.2, 0], [2 * X + 1.4, 1.9, 1.2]);
  // semaforo da largada (5 luzes vermelhas, brilho proprio)
  P.add('caixa', '#1b1b1b', [0, H - 2.0, -0.7], [6.2, 1.2, 0.5]);
  for (let k = 0; k < 5; k++) Pb.add('esfera', '#ff2a1a', [-2.4 + k * 1.2, H - 1.4, -0.98], 0.38);
  const geo = guarda(P.geo()), geoB = guarda(Pb.geo());
  S.quadro(0, _T, _N, _R);
  const base = S.ponto(0, 0, 0, new THREE.Vector3());
  const M = new THREE.Matrix4().makeBasis(_R.clone().negate(), _N.clone(), _T.clone()).setPosition(base);
  const grupo = new THREE.Group(); grupo.name = 'portico';
  const m1 = new THREE.Mesh(geo, mats.objeto), m2 = new THREE.Mesh(geoB, mats.brilho);
  for (const m of [m1, m2]) { m.matrixAutoUpdate = false; m.matrix.copy(M); grupo.add(m); }
  // a faixa: frente e costas (cada uma com a sua face, para o texto nao sair espelhado)
  const tex = guarda(texturaFaixa(pista.nome || 'Turbo Caos'));
  const mf = guarda(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  for (const sentido of [-1, 1]) {
    const g = guarda(new THREE.PlaneGeometry(2 * X - 1.2, 1.7));
    const m = new THREE.Mesh(g, mf);
    const L = new THREE.Matrix4().makeRotationY(sentido < 0 ? Math.PI : 0).setPosition(0, H - 0.2, sentido * 0.62);
    m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(M, L);
    m.name = 'faixa';
    grupo.add(m);
  }
  return grupo;
}

/** Placas de aviso na beira da pista antes de cada rampa, loop, saca-rolha, paredao e boca de atalho. Uma malha so (atlas de 4). */
function montaPlacas(pista, A, terreno, mat) {
  const f = new Fita(), branco = new THREE.Color(1, 1, 1), poste = new Fita();
  const placas = [];
  for (const { S, figs } of A.sups) {
    for (const g of figs) placas.push({ S, s: g.s0 - 45, tipo: g.tipo === 'rampa' ? 'salto' : g.tipo === 'paredao' ? 'cuidado' : 'loop' });
  }
  for (const a of pista.atalhos) placas.push({ S: pista.principal, s: a.sEntrada - 50, tipo: 'atalho', lado: a.lado === 'esq' ? -1 : 1 });
  const P = new THREE.Vector3();
  for (const pl of placas) {
    const S = pl.S, s = S.normaliza(pl.s);
    S.quadro(s, _T, _N, _R);
    if (_N.y < 0.9) continue;
    const lado = pl.lado ?? 1, hw = S.larguraEm(s) * 0.5 + MURO_ESPESSURA + 1.6;
    S.ponto(s, lado * hw, 0, P);
    const y0 = terreno.altura(P.x, P.z);
    const k = PLACAS[pl.tipo], u0 = k / 4 + 0.002, u1 = (k + 1) / 4 - 0.002;
    const fr = new THREE.Vector3(-_T.x, 0, -_T.z).normalize(); // a placa olha para quem vem
    const lat = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fr).normalize();
    const L = 1.6, Hb = Math.max(P.y, y0) + 2.2;
    const c0 = P.clone().addScaledVector(lat, -L).setY(Hb), c1 = P.clone().addScaledVector(lat, L).setY(Hb);
    const c2 = c1.clone().setY(Hb + 3.2), c3 = c0.clone().setY(Hb + 3.2);
    f.quad(c0, c1, c2, c3, fr, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], branco);
    // costas cinza e o poste (coluna de concreto da fita nao: aqui e tudo do atlas das placas, canto preto)
    const tras = fr.clone().negate();
    const d0 = c0.clone().addScaledVector(tras, 0.06), d1 = c1.clone().addScaledVector(tras, 0.06), d2 = c2.clone().addScaledVector(tras, 0.06), d3 = c3.clone().addScaledVector(tras, 0.06);
    f.quad(d1, d0, d3, d2, tras, [[u0, 0.995], [u0 + 0.001, 0.995], [u0 + 0.001, 0.999], [u0, 0.999]], branco);
    const base = P.clone().setY(y0 - 0.3), topoP = P.clone().setY(Hb + 0.2);
    for (const off of [-0.9, 0.9]) {
      const b0 = base.clone().addScaledVector(lat, off - 0.08), b1 = base.clone().addScaledVector(lat, off + 0.08), t1 = topoP.clone().addScaledVector(lat, off + 0.08), t0 = topoP.clone().addScaledVector(lat, off - 0.08);
      for (const sentido of [1, -1]) { const nn = fr.clone().multiplyScalar(sentido); const o = nn.clone().multiplyScalar(0.03); f.quad(b0.clone().add(o), b1.clone().add(o), t1.clone().add(o), t0.clone().add(o), nn, [[u0, 0.995], [u0 + 0.001, 0.995], [u0 + 0.001, 0.999], [u0, 0.999]], branco); }
    }
  }
  void poste;
  if (f.vazia) return null;
  const m = new THREE.Mesh(f.geometria(), mat);
  m.name = 'placas'; m.matrixAutoUpdate = false;
  return m;
}

// ================================================================ a montagem
export async function montaVisualDaPista(G, pista) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const tema = pista.tema || {};
  const grupo = new THREE.Group(); grupo.name = 'visual-pista';
  const descartaveis = [];
  const guarda = (x) => { descartaveis.push(x); return x; };

  const A = coletaAmostras(pista);
  const cen = montaCenario(G, pista, A.lista);
  grupo.add(cen.grupo);

  // materiais da pista
  const texAtlas = guarda(atlas(tema));
  const aniso = G.renderer && G.renderer.capabilities ? Math.min(4, G.renderer.capabilities.getMaxAnisotropy()) : 1;
  texAtlas.anisotropy = aniso;
  const texSetas = guarda(texturaSetas(tema));
  const materiais = {
    fita: guarda(new THREE.MeshLambertMaterial({ map: texAtlas, vertexColors: true })),
    brilho: guarda(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
    setas: guarda(new THREE.MeshBasicMaterial({ map: texSetas, alphaTest: 0.5, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    objeto: cen.ctx.materiais.objeto,
  };
  const fitas = montaFitas(pista, A, cen.terreno, tema, materiais);
  for (const m of fitas.malhas) { guarda(m.geometry); grupo.add(m); }
  for (const m of fitas.brilhos) { guarda(m.geometry); grupo.add(m); }

  const texCheg = guarda(texturaChegada());
  const chegada = montaChegada(pista, guarda(new THREE.MeshLambertMaterial({ map: texCheg, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  guarda(chegada.geometry); grupo.add(chegada);
  grupo.add(montaPortico(pista, tema, cen.ctx.materiais, guarda));
  const texPlacas = guarda(texturaPlacas());
  const placas = montaPlacas(pista, A, cen.terreno, guarda(new THREE.MeshLambertMaterial({ map: texPlacas })));
  if (placas) { guarda(placas.geometry); grupo.add(placas); }

  const ceu = montaCeu(G, tema, { semente: sementeDe(pista.id || 'ceu') });
  grupo.add(ceu.grupo);

  // qualidade: densidade do cenario e neblina (contrato secao 10)
  const aplica = (p) => { cen.aplicaQualidade(p); ceu.aplicaQualidade(p); };
  const desliga = on('qualidade:muda', () => aplica(G.qualidade && G.qualidade.p));

  const tMontagem = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  let t = 0;
  const visual = {
    grupo, terreno: cen.terreno, sol: ceu.sol, hemi: ceu.hemi, neblina: ceu.neblina, tMontagem,
    quadro(dt) {
      t += dt;
      texSetas.offset.y = -t * 1.6;
      const cam = G.camera;
      ceu.quadro(dt, cam);
      cen.quadro(dt, cam);
    },
    /** { chamadas, triangulos } do que o visual pos na cena (sem carros): o [MEDE] da suite */
    conta() {
      let tri = 0, chamadas = 0;
      grupo.traverse((o) => {
        if (!(o.isMesh || o.isPoints || o.isSprite) || !o.visible) return;
        if (o.isSprite) { chamadas++; tri += 2; return; }
        const g = o.geometry; if (!g) return;
        const n = o.isPoints ? 0 : (g.index ? g.index.count / 3 : g.attributes.position.count / 3);
        tri += o.isInstancedMesh ? n * o.count : n; chamadas++;
      });
      return { chamadas, triangulos: Math.round(tri) };
    },
    aplicaQualidade: aplica,
    destroi() {
      desliga();
      ceu.destroi();
      cen.destroi();
      for (const d of descartaveis) if (d && d.dispose) d.dispose();
      if (grupo.parent) grupo.parent.remove(grupo);
    },
  };
  // o primeiro quadro ja com o ceu no lugar (a foto e o primeiro desenho nao veem o ceu na origem)
  visual.quadro(0);
  return visual;
}
