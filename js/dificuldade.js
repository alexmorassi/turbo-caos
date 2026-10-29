// STUB DA FUNDACAO (fase 1) — a fase 5 substitui: base gradual + dificuldade adaptativa (docs/CONTRATOS.md secao 9).
export class Dificuldade {
  constructor(G, corrida) { this.G = G; this.corrida = corrida; }
  inicia() { for (const c of this.corrida.carros) c.ia = { habilidade: 0.5, agressividade: 0.5, precisao: 0.5, usoDePoder: 0.5 }; }
  passo() {} quadro() {} destroi() {} registra() {}
}
