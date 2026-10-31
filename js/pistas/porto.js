// PISTA 8 — PORTO / DOCAS. Conteineres coloridos empilhados, guindastes, navios atracados e agua por todo lado. A pista entra no mar
// por um PIER, cruza para o pier vizinho numa PONTE sem muro sobre a agua e volta pelo outro pier; o atalho e o SALTO DO CAIS: no meio
// do primeiro pier uma rampa joga o carro por cima da agua direto para o segundo (vao de 22 m) — o atalho mais curto do campeonato ate
// aqui, e o mais arriscado. O loop fica no cais, entre os guindastes. Sentido horario (os dois pieres somam zero).
import { Construtor } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: -90, largura: 14 });
// rumos: -90 (o cais da largada, o mar a esquerda) -> 0 (pier 1, mar adentro) -> -90 (ponte na ponta) -> -180 (pier 2, volta)
//        -> -90 (cais de novo, loop) -> -180 -> -270 (a rua dos armazens) -> -360 -> -450 (= -90)
c.reta(90, { nome: 'largada' })
  .esquerda(50, 90, { incl: 8 })
  .reta(70)
  .ponto('entrada_cais')
  .reta(100)
  .direita(50, 90, { incl: 9 })
  .reta(100, { ponte: true, marca: 'sem_muro', nome: 'ponte_pier' })
  .direita(50, 90, { incl: 9 })
  .reta(100)
  .ponto('saida_cais')
  .reta(70)
  .esquerda(50, 90, { incl: 8 })
  .reta(50)
  .reta(30, { marca: 'impulso' })
  .loop({ raio: 12, larg: 12, nome: 'loop_cais' })
  .reta(50)
  .direita(50, 90, { incl: 9 })
  .reta(80, { elastica: true })
  .direita(50, 90, { incl: 9 })
  .reta(60, { nome: 'armazens' })
  // a chicane entre os armazens
  .esquerda(50, 30, { incl: 6 })
  .direita(50, 60, { incl: 8 })
  .esquerda(50, 30, { incl: 6 })
  .reta(120, { elastica: true })
  .direita(50, 90, { incl: 9 })
  .reta(70)
  .direita(50, 90, { incl: 9 })
  .reta(90, { nome: 'chegada' });

c.atalho({
  de: 'entrada_cais', ate: 'saida_cais', lado: 'dir', largura: 9, nome: 'Salto do Cais',
  // a volta do fim e uma curva de raio 50 de verdade: a cubica de ligacao sozinha fechava em raio 13 (30/10/2026, curvas para a crianca)
  via: (t) => t.direita(50, 90, { incl: 6 }).reta(5).rampa({ comp: 24, altura: 3.6, vao: 22, queda: 1.2, pouso: 26, perigo: 'agua' }).direita(50, 90, { incl: 6 }),
  douradas: [{ em: 4, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'porto', nome: 'Porto', ordem: 8, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.ponte_pier.i - 2, d: -4 }],
  tema: {
    estilo: 'porto',
    ceu: { topo: '#2f6fb8', meio: '#7fb2e0', horizonte: '#e8eef0', baixo: '#d8e2e6' },
    sol: { dir: [0.6, 0.55, 0.4], cor: '#fff0d8', forca: 3.0, disco: '#fff8e8', halo: 0.45 },
    hemi: { ceu: '#e4f0ff', chao: '#6a6a5a', forca: 1.5 },
    neblina: { cor: '#dde7ec', perto: 200, longe: 1400 },
    asfalto: '#4a4c50', faixa: '#ffd21f', tracejado: '#ffffff', zebra: ['#ffd21f', '#1b1b1b'], muro: ['#e8e8e8', '#ffb020'],
    estrutura: '#9a9890', corRampa: '#e85a1a',
    terreno: { tipo: 'cais', nivel: 0, costa: 22, fundo: -8, cor: '#8a8a82', cor2: '#7a7a72', corRocha: '#5a5a55', aterro: 3, corte: 1, margemAterro: 9, ruido: 0.2 },
    agua: { nivel: -1.4, cor: '#2a7fb0' },
  },
};
