// STUB DA FUNDACAO (fase 1) — a fase 5 substitui pela IA de verdade (docs/CONTRATOS.md secao 9). Aqui: acelera e mira o centro.
export class IA {
  constructor(G, corrida) { this.G = G; this.corrida = corrida; }
  inicia() {}
  passo() {
    for (const c of this.corrida.carros) {
      if (c.ehJogador && !this.G.flags.auto && !c.chegou) continue;
      c.controle.acel = 1; c.controle.freio = 0; c.controle.direcao = Math.max(-1, Math.min(1, -c.d * 0.3)); c.controle.turbo = false; c.controle.poder = false; c.controle.drift = false;
    }
  }
  quadro() {} destroi() {}
}
