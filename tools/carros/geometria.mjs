// GEOMETRIA DOS CARROS (fase 1): extrai as malhas do GLB de origem em espaco de mundo, solda, simplifica, normaliza.
// Uma "parte" aqui e { nome, pos, nor, uv, idx } em Float32Array/Uint32Array, sem node transform: tudo que o GLB de
// saida precisar de transform e decidido depois (pivo das rodas) e o resto vai assado nos vertices.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { MeshoptSimplifier } = require('meshoptimizer');

// malha do no -> espaco de mundo (o Cidade Aberta so usa translation, mas a matriz inteira custa nada e protege)
export function extrai(no) {
  const M = no.getWorldMatrix(), prims = no.getMesh().listPrimitives();
  const nv = prims.reduce((s, p) => s + p.getAttribute('POSITION').getCount(), 0);
  const ni = prims.reduce((s, p) => s + p.getIndices().getCount(), 0);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  // matriz normal = inversa transposta do bloco 3x3; com escala uniforme basta normalizar depois
  let ov = 0, oi = 0;
  for (const p of prims) {
    const P = p.getAttribute('POSITION').getArray(), N = p.getAttribute('NORMAL').getArray(), T = p.getAttribute('TEXCOORD_0').getArray(), I = p.getIndices().getArray();
    const n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2], a = N[3 * i], b = N[3 * i + 1], c = N[3 * i + 2];
      const k = 3 * (ov + i);
      pos[k] = M[0] * x + M[4] * y + M[8] * z + M[12]; pos[k + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]; pos[k + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c, l = Math.hypot(nx, ny, nz) || 1;
      nor[k] = nx / l; nor[k + 1] = ny / l; nor[k + 2] = nz / l;
      uv[2 * (ov + i)] = T[2 * i]; uv[2 * (ov + i) + 1] = T[2 * i + 1];
    }
    for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov;
    ov += n; oi += I.length;
  }
  return { nome: no.getName(), pos, nor, uv, idx };
}

// junta varias partes numa so (chassis + carroceria do monster truck viram o body)
export function junta(nome, partes) {
  const nv = partes.reduce((s, p) => s + p.pos.length / 3, 0), ni = partes.reduce((s, p) => s + p.idx.length, 0);
  const out = { nome, pos: new Float32Array(nv * 3), nor: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), idx: new Uint32Array(ni) };
  let ov = 0, oi = 0;
  for (const p of partes) {
    out.pos.set(p.pos, ov * 3); out.nor.set(p.nor, ov * 3); out.uv.set(p.uv, ov * 2);
    for (let i = 0; i < p.idx.length; i++) out.idx[oi + i] = p.idx[i] + ov;
    ov += p.pos.length / 3; oi += p.idx.length;
  }
  return out;
}

// SOLDA: as *_lo do Cidade Aberta sao "sopa de triangulos" (3 vertices por triangulo, medido: 72.000 vertices para
// 24.000 triangulos no vulcao). Sopa comprime mal (cada canto viaja 3 vezes) e o simplificador nao enxerga vizinhanca.
// Solda so o que e IGUAL em posicao, normal e UV (dentro da tolerancia): a costura de UV e o vinco de normal ficam.
// Normal: dentro de um mesmo canto (posicao + UV) as normais da *_lo diferem quase sempre por < 0,5 grau (medido no
// vulcao: 16.324 de 26.162 cantos), sobra de arredondamento; juntar abaixo de `angulo` graus nao muda o sombreado e
// corta vertice. Acima disso e vinco de verdade (o lodnormals.py do Cidade Aberta deixa os de > 40 graus) e fica.
export function solda(p, { tolPos = 1e-5, tolUv = 2e-6, angulo = 2 } = {}) {
  const n = p.pos.length / 3, grupos = new Map(), novo = new Uint32Array(n), cosMin = Math.cos(angulo * Math.PI / 180);
  const pos = [], nor = [], uv = [], soma = [];   // soma = normal acumulada de cada vertice novo (media no fim)
  for (let i = 0; i < n; i++) {
    const ch = [Math.round(p.pos[3 * i] / tolPos), Math.round(p.pos[3 * i + 1] / tolPos), Math.round(p.pos[3 * i + 2] / tolPos),
      Math.round(p.uv[2 * i] / tolUv), Math.round(p.uv[2 * i + 1] / tolUv)].join(',');
    let lista = grupos.get(ch); if (!lista) grupos.set(ch, (lista = []));
    const a = p.nor[3 * i], b = p.nor[3 * i + 1], c = p.nor[3 * i + 2];
    let j = lista.find((k) => nor[3 * k] * a + nor[3 * k + 1] * b + nor[3 * k + 2] * c >= cosMin);
    if (j === undefined) { j = pos.length / 3; lista.push(j); pos.push(p.pos[3 * i], p.pos[3 * i + 1], p.pos[3 * i + 2]); nor.push(a, b, c); uv.push(p.uv[2 * i], p.uv[2 * i + 1]); soma.push(0, 0, 0); }
    soma[3 * j] += a; soma[3 * j + 1] += b; soma[3 * j + 2] += c;
    novo[i] = j;
  }
  for (let j = 0; j < soma.length; j += 3) { const l = Math.hypot(soma[j], soma[j + 1], soma[j + 2]) || 1; nor[j] = soma[j] / l; nor[j + 1] = soma[j + 1] / l; nor[j + 2] = soma[j + 2] / l; }
  const idx = new Uint32Array(p.idx.length); for (let i = 0; i < idx.length; i++) idx[i] = novo[p.idx[i]];
  return limpaDegenerados({ nome: p.nome, pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx });
}

// triangulo com dois cantos iguais depois da solda nao desenha nada: fora
function limpaDegenerados(p) {
  const out = []; for (let t = 0; t < p.idx.length; t += 3) { const a = p.idx[t], b = p.idx[t + 1], c = p.idx[t + 2]; if (a !== b && b !== c && a !== c) out.push(a, b, c); }
  p.idx = new Uint32Array(out); return p;
}

// remove vertices que nenhum triangulo usa (depois de simplificar sobram muitos)
export function compacta(p) {
  const n = p.pos.length / 3, novo = new Int32Array(n).fill(-1); let m = 0;
  for (const i of p.idx) if (novo[i] < 0) novo[i] = m++;
  const pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), uv = new Float32Array(m * 2);
  for (let i = 0; i < n; i++) { const j = novo[i]; if (j < 0) continue; pos.set(p.pos.subarray(3 * i, 3 * i + 3), 3 * j); nor.set(p.nor.subarray(3 * i, 3 * i + 3), 3 * j); uv.set(p.uv.subarray(2 * i, 2 * i + 2), 2 * j); }
  return { nome: p.nome, pos, nor, uv, idx: p.idx.map((i) => novo[i]) };
}

// SIMPLIFICA com o meshopt (com atributos: normal e UV entram no erro, senao o simplificador "acha" que uma dobra de
// UV no meio de uma carta nao custa nada e a pintura escorrega). A costura de UV e preservada pelo proprio meshopt
// (vertices na mesma posicao com UV diferente so andam ao longo da costura). erro = fracao da diagonal da malha.
export async function simplifica(p, alvoTris, { erro = 0.02, pesoNormal = 0.25, pesoUv = 1.0, flags = [] } = {}) {
  await MeshoptSimplifier.ready;
  const n = p.pos.length / 3, attrs = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) { attrs.set(p.nor.subarray(3 * i, 3 * i + 3), 5 * i); attrs[5 * i + 3] = p.uv[2 * i]; attrs[5 * i + 4] = p.uv[2 * i + 1]; }
  const [idx, erroObtido] = MeshoptSimplifier.simplifyWithAttributes(p.idx, p.pos, 3, attrs, 5, [pesoNormal, pesoNormal, pesoNormal, pesoUv, pesoUv], null, Math.floor(alvoTris) * 3, erro, flags);
  const out = compacta({ ...p, idx });
  out.erro = erroObtido * MeshoptSimplifier.getScale(p.pos, 3);   // erro em metros (o meshopt devolve relativo)
  return out;
}

export function caixa(partes) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of partes) for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.pos[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  return { min, max, tam: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], centro: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

// p' = s * (p - origem): escala uniforme e translacao assadas nos vertices (normal nao muda com escala uniforme)
export function normaliza(p, s, origem) {
  const pos = new Float32Array(p.pos.length);
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = s * (p.pos[i + k] - origem[k]);
  return { ...p, pos };
}

export function desloca(p, d) {
  const pos = new Float32Array(p.pos.length);
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] = p.pos[i + k] - d[k];
  return { ...p, pos };
}

export const tris = (p) => p.idx.length / 3;

// EIXO DA RODA por ajuste de circulo na BANDA DE RODAGEM (plano YZ), nao pelo centro da caixa. Medido: a caixa erra
// quando a *_lo corta o topo do pneu escondido no para-lama (dourado traseira: altura 3,3 cm menor que o comprimento,
// centro 1,6 cm baixo e pneu 0,8 cm dentro do chao) e quando o pneu tem cravo/saliencia de um lado (shark: +6 cm em
// cima). Girando em volta de um centro errado a roda "pula" a cada volta.
// Como: comeca no centro da caixa; pega os vertices mais externos (>= 85 % do raio maximo: a banda); ajusta circulo
// algebrico (Kasa) e repete 4 vezes. x = meio da largura do pneu (caixa). Devolve tambem o que a caixa diria.
export function eixoDaRoda(p) {
  const c = caixa([p]);
  let cy = c.centro[1], cz = c.centro[2], R = c.tam[2] / 2;
  const n = p.pos.length / 3;
  for (let volta = 0; volta < 4; volta++) {
    const rs = new Float64Array(n); let rmax = 0;
    for (let i = 0; i < n; i++) { rs[i] = Math.hypot(p.pos[3 * i + 1] - cy, p.pos[3 * i + 2] - cz); if (rs[i] > rmax) rmax = rs[i]; }
    // Kasa: minimiza sum (y^2 + z^2 + D y + E z + F)^2 -> sistema 3x3
    let Syy = 0, Szz = 0, Syz = 0, Sy = 0, Sz = 0, S1 = 0, Sy3 = 0, Sz3 = 0, Syzz = 0;
    for (let i = 0; i < n; i++) {
      if (rs[i] < 0.85 * rmax) continue;
      const y = p.pos[3 * i + 1] - cy, z = p.pos[3 * i + 2] - cz, q = y * y + z * z;
      Syy += y * y; Szz += z * z; Syz += y * z; Sy += y; Sz += z; S1++; Sy3 += y * q; Sz3 += z * q; Syzz += q;
    }
    if (S1 < 12) break;                                     // banda pequena demais: fica com o que tem
    // [Syy Syz Sy][D]   [-Sy3]
    // [Syz Szz Sz][E] = [-Sz3]
    // [Sy  Sz  S1][F]   [-Syzz]
    const A = [[Syy, Syz, Sy], [Syz, Szz, Sz], [Sy, Sz, S1]], b = [-Sy3, -Sz3, -Syzz];
    const sol = resolve3(A, b); if (!sol) break;
    const [D, E, F] = sol, ny = -D / 2, nz = -E / 2, nR = Math.sqrt(Math.max(0, ny * ny + nz * nz - F));
    cy += ny; cz += nz; R = nR;
  }
  // raio = do eixo ao ponto mais baixo do pneu (raio de CONTATO: e o que o jogo usa para por a roda no chao); o raio do
  // circulo ajustado (media da banda, um pouco menor por causa do ombro do pneu) vai so para o relatorio
  return { centro: [c.centro[0], cy, cz], raio: cy - c.min[1], raioAjuste: R, caixa: { centro: c.centro, raio: (c.tam[1] + c.tam[2]) / 4, tam: c.tam }, base: c.min[1] };
}

function resolve3(A, b) {
  const m = A.map((l, i) => [...l, b[i]]);
  for (let k = 0; k < 3; k++) {
    let p = k; for (let i = k + 1; i < 3; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (Math.abs(m[p][k]) < 1e-12) return null; [m[k], m[p]] = [m[p], m[k]];
    for (let i = 0; i < 3; i++) if (i !== k) { const f = m[i][k] / m[k][k]; for (let j = k; j < 4; j++) m[i][j] -= f * m[k][j]; }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
