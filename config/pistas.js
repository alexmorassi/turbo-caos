// STUB DA FUNDACAO (fase 1) — a fase 3 substitui pela lista das 10 pistas em ordem (docs/CONTRATOS.md secao 4).
import teste from '../js/pistas/teste.js';
export const PISTAS = [teste];
export function pistaPorId(id) { return PISTAS.find((p) => p.id === id) || null; }
