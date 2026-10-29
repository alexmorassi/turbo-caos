// STUB DA FUNDACAO (fase 1) — a fase 4 substitui: os 10 poderes (docs/CONTRATOS.md secao 8).
export class Poderes {
  constructor(G, corrida) { this.G = G; this.corrida = corrida; }
  inicia() { for (const c of this.corrida.carros) c.poder = { id: c.cfg.poder, recarga: 0 }; }
  passo() {} quadro() {} destroi() {}
  podeUsar() { return false; } usa() {} iaDeveUsar() { return false; } recarga() { return 1; } ativosEm() { return []; }
}
