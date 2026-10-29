// STUB DA FUNDACAO (fase 1) — a fase 4 substitui: barra de turbo por carro (docs/CONTRATOS.md secao 8).
export class Turbo {
  constructor(G, corrida) { this.G = G; this.corrida = corrida; }
  inicia() { for (const c of this.corrida.carros) c.turbo = { carga: 0.5, capacidade: 4, ativo: false }; }
  passo() {} quadro() {} destroi() {}
}
