// CHAPA DE COR UNICA NA FAIXA DO LOD (fase 1). O assoalho.py do Cidade Aberta fecha o fundo dos carros com uma chapa escura cujos
// triangulos apontam TODOS para 1 texel do atlas cheio (visto no fusca_teto: 1.108 triangulos, 5,5 m2, u 0,982 v 0,084). Quando so a
// faixa do LOD vai para o GLB, esse texel some; a chapa ganha um bloco livre da faixa pintado com a cor dela (otimiza.mjs).

// bloco livre (nenhuma carta encosta) de lado x lado texels na faixa, para pendurar a chapa do assoalho
export function blocoLivre(dono, W, H, lado = 8) {
  for (let y = H - lado; y >= 0; y -= lado) for (let x = W - lado; x >= 0; x -= lado) {
    let livre = true;
    for (let j = -2; j < lado + 2 && livre; j++) for (let i = -2; i < lado + 2; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; if (dono[yy * W + xx]) { livre = false; break; } }
    if (livre) return { x, y, lado };
  }
  return null;
}

// texels cobertos por alguma carta (sem margem) das partes dadas: 1 = coberto. Para achar bloco livre sem repintar.
export function cobertura(partes, janela, W, H) {
  const dono = new Int8Array(W * H);
  for (const p of partes) for (let t = 0; t < p.idx.length; t += 3) {
    const ids = [p.idx[t], p.idx[t + 1], p.idx[t + 2]];
    if (ids.some((i) => p.uv[2 * i + 1] < janela[0] - 1e-4 || p.uv[2 * i + 1] > janela[1] + 1e-4)) continue;
    const q = ids.map((i) => [p.uv[2 * i] * W, ((p.uv[2 * i + 1] - janela[0]) / (janela[1] - janela[0])) * H]);
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0])) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1])) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dono[y * W + x] = 1;   // caixa do triangulo: conservador
  }
  return dono;
}
