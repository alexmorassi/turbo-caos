// STUB DA FUNDACAO (fase 1) — a fase 6 substitui: 3 niveis + escolha automatica pelo fps medido (docs/CONTRATOS.md secao 10).
const NIVEIS = { baixa: { pixelRatio: 1, sombras: false, densidadeCenario: 0.4, distancia: 450, particulas: 0.4 }, media: { pixelRatio: 1.5, sombras: false, densidadeCenario: 0.7, distancia: 700, particulas: 0.7 }, alta: { pixelRatio: 2, sombras: true, densidadeCenario: 1, distancia: 1000, particulas: 1 } };
export class Qualidade {
  constructor(G) { this.G = G; this.nivel = 'media'; this.auto = true; this.p = NIVEIS.media; this.limiteFps = 60; }
  define(n) { if (NIVEIS[n]) { this.nivel = n; this.p = NIVEIS[n]; } }
  mede() {}
}
