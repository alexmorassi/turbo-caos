// PISTA DE TESTE (fase 1, fundacao). Nao entra no campeonato: existe para as suites (fisica, poderes, IA) medirem tudo o que uma
// pista de verdade tem num circuito curto e conhecido — reta de largada, RAMPA com VAO (o carro lento cai), curva para a direita,
// LOOP de 10 m de raio (trecho magnetico), uma curva em S com ATALHO de terra pelo lado de dentro, e a volta para a largada.
// Os numeros foram escolhidos para o salto: rampa de ~8 graus com crista a 3,5 m; a 20 m/s o carro voa ~20 m e passa o vao de 15 m,
// a 12 m/s voa ~10 m e cai (o teste_fisica mede os dois).

import { geraLoop } from '../pista.js';

/** O loop: 13 pontos de 30 em 30 graus, raio 10, andando para -X e deslocando 15 m para a direita do piloto (-Z) para a saida passar
 *  ao lado da entrada (com 15 m e largura 12 as duas faixas nao se encostam). */
const loop = geraLoop({ inicio: [-90, 0, 225], direcao: [-1, 0, 0], raio: 10, desloca: 15, passoGraus: 30, largura: 12 });

export default {
  id: 'teste',
  nome: 'Pista de Teste',
  ordem: 0,
  largura: 14,
  pontos: [
    [0, 0, 0],          // 0 largada
    [0, 0, 50],         // 1
    [0, 0, 95],         // 2 pe da rampa
    [0, 3.5, 120],      // 3 crista (lanca)
    [0, 1.5, 145],      // 4 pouso
    [0, 0, 175],        // 5
    [-5, 0, 205],       // 6 curva para a direita (o piloto vira para -X)
    [-30, 0, 222],      // 7
    [-70, 0, 225],      // 8 reta de entrada do loop
    ...loop,            // 9..21 o loop
    [-112, 0, 210],     // 22
    [-140, 0, 205],     // 23
    [-160, 0, 190],     // 24
    [-168, 0, 165],     // 25 entrada do atalho (lado direito = +X)
    [-180, 0, 135],     // 26 o S abre para a esquerda
    [-205, 0, 105],     // 27
    [-205, 0, 70],      // 28
    [-180, 0, 40],      // 29
    [-168, 0, 15],      // 30 saida do atalho
    [-160, 0, -15],     // 31
    [-135, 0, -35],     // 32
    [-95, 0, -40],      // 33
    [-50, 0, -40],      // 34
    [-15, 0, -30],      // 35
    [-2, 0, -15],       // 36
  ],
  trechos: [
    { de: 2.9, ate: 3.0, tipo: 'lanca' },
    { de: 3.0, ate: 3.6, tipo: 'vao' },
    { de: 9, ate: 21, tipo: 'magnetico' },
  ],
  atalhos: [
    { de: 25, ate: 30, lado: 'dir', largura: 8, nome: 'Atalho de terra',
      pontos: [[-158, 0, 120], [-158, 0, 60]],
      trechos: [{ de: 0, ate: 1, tipo: 'terra' }] },
  ],
  tema: { ceu: '#7cc4ff', horizonte: '#d8efff', chao: '#5aa04a', asfalto: '#3b3f46', neblina: ['#cfe8ff', 120, 700] },
};
