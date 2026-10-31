// PISTA 7 — CIDADE NEON A NOITE. Um OITO: a pista cruza a si mesma num VIADUTO (8,5 m acima da avenida de baixo, pilares fora da
// pista de baixo). Predios escuros com janelas acesas, faixas neon no alto dos muros, a lua. O loop fica no lobo de cima, o primeiro
// SACA-ROLHA do campeonato (uma volta inteira em 96 m, raio 8 m) no lado comprido, o salto da avenida de baixo, e o atalho e o BECO DO NEON: a avenida desvia por um
// "dente" e o beco corta reto, estreito (8 m) — com faixa de impulso no fim para quem sai dele inteiro.
// O oito: o lobo de cima vira 270 graus para a DIREITA e o de baixo 270 para a ESQUERDA (soma zero, o construtor aceita).
import { Construtor } from './construtor.js';

const VIADUTO = 8.5; // m acima da avenida: folga de 6 m (o pedido) + laje de 0,9 m + o carro, com sobra
const c = new Construtor({ inicio: [0, 0, 0], rumo: -45, largura: 14 });
// eixo "u" = rumo -45 (a avenida da largada), eixo "v" = rumo +45 (a pista do viaduto)
c.reta(60, { nome: 'largada' })
  .reta(70)
  .ponto('entrada_beco')
  .reta(30)
  // o desvio da avenida (bojo para a esquerda); o beco segue reto por dentro. Curvas de 60 graus com raio 50 (eram 90 graus com raio
  // 30: o carro mais rapido de controle baixo nao fazia no acelerador — 30/10/2026); com 90 graus e raio 50 o bojo crescia ate
  // encostar na descida do viaduto
  .esquerda(50, 60, { incl: 8 })
  .reta(40)
  .direita(50, 60, { incl: 8 })
  .reta(40)
  .direita(50, 60, { incl: 8 })
  .reta(40)
  .esquerda(50, 60, { incl: 8 })
  .reta(30)
  .ponto('saida_beco')
  .reta(50)
  // lobo de cima: 270 graus para a direita, com o loop
  .direita(50, 90, { incl: 10 })
  .reta(40, { elastica: true })
  .reta(30, { marca: 'impulso' })
  .loop({ raio: 12, larg: 12, nome: 'loop_neon' })
  .reta(50)
  .direita(50, 90, { incl: 10 })
  .reta(60)
  .sacaRolha({ raio: 8, comp: 96, larg: 12, nome: 'saca_rolha' })
  .reta(70)
  .direita(50, 90, { incl: 10 })
  // o viaduto: sobe, cruza a avenida da largada por cima, desce
  .reta(110, { sobe: VIADUTO, perfil: 'linear' })
  .reta(70, { ponte: true, nome: 'viaduto' })
  .reta(110, { sobe: -VIADUTO, perfil: 'linear' })
  // lobo de baixo: 270 graus para a esquerda
  .esquerda(50, 90, { incl: 10 })
  .reta(40, { elastica: true })
  .rampa({ comp: 28, altura: 4, vao: 16, queda: 1.4, pouso: 32, nome: 'salto_neon', perigo: 'abismo' })
  .reta(20)
  .esquerda(50, 90, { incl: 10 })
  .reta(80)
  .esquerda(50, 90, { incl: 10 })
  .reta(70, { nome: 'chegada' });

c.atalho({
  de: 'entrada_beco', ate: 'saida_beco', lado: 'dir', largura: 8, nome: 'Beco do Neon',
  via: (t) => t.direita(140, 6).reta(50).reta(40, { marca: 'impulso' }).esquerda(140, 6),
  douradas: [{ em: 1, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'neon', nome: 'Cidade Neon', ordem: 7, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.viaduto.i, d: 0 }],
  tema: {
    estilo: 'neon', noite: true,
    ceu: { topo: '#070a24', meio: '#1a1450', horizonte: '#4a2a7a', baixo: '#2a1a4a', nuvem: '#3a3466', nuvemBaixo: '#1c1838' },
    sol: { dir: [-0.35, 0.55, 0.6], cor: '#c8d4ff', forca: 2.2, disco: '#ffffff', halo: 0.25, tamanho: 0.07 },
    hemi: { ceu: '#a898ff', chao: '#4a3a7a', forca: 2.2 },
    neblina: { cor: '#2e1f5a', perto: 120, longe: 1000 },
    asfalto: '#34344a', faixa: '#5af0ff', tracejado: '#ff4fd8', zebra: ['#ff2bd6', '#2a2a3a'], muro: ['#2a2a44', '#34345a'], muroTopo: '#5a5a80',
    muroBrilho: ['#ff2bd6', '#22e6ff', '#ffe14a'],
    estrutura: '#6a6a90', corTerra: '#4a4a55', corRampa: '#7a3aff', portico: '#7a3aff', corImpulso: '#22e6ff', corImpulso2: '#ff4fd8',
    terreno: { tipo: 'plano', nivel: 0, cor: '#3a3a58', cor2: '#33334e', corRocha: '#44445e', ruido: 0.3, nivelFundo: -0.4 },
    nuvens: 0.5,
  },
};
