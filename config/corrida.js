// REGRAS DA CORRIDA (fase 1, fundacao). Os numeros que o pedido fixou e os que a fundacao escolheu, num lugar so.
export const CORRIDA = {
  VOLTAS: 3,                 // pedido: "3 voltas"
  CORREDORES: 8,             // pedido: "6 a 8 corredores (jogador + IA)"; 8 enche a grade e da briga o tempo todo
  CORREDORES_MIN: 6,
  CONTAGEM: 3,               // 3, 2, 1, VAI — 1 s cada
  ESPERA_DEPOIS_DO_PRIMEIRO: 15, // s: depois que o primeiro chega, quem nao chegou em 15 s recebe tempo estimado (crianca nao espera o ultimo)
  TETO_DA_CORRIDA: 600,      // s: seguranca (piloto parado de proposito, bug): a corrida termina mesmo assim
  // pontos do campeonato por posicao (1o..8o) — escala de kart, todo mundo pontua e a crianca ve o numero subir
  PONTOS: [10, 8, 6, 5, 4, 3, 2, 1],
};
