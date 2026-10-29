// STUB DA FUNDACAO (fase 1) — a fase 6 substitui (docs/CONTRATOS.md secao 10).
export class Vibracao { constructor(G) { this.G = G; } vibra(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* sem vibracao */ } } }
