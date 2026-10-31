// PISTA 2 — FAVELA MORRO ACIMA. A segunda do campeonato: a pista SOBE o morro (32 m de desnivel) entre casinhas coloridas empilhadas,
// lajes, caixas d'agua e fios. Tem o primeiro "cotovelo" (curva de 150 graus inclinada, raio 26 m), o salto da laje no alto do morro e
// a descida ate a avenida. O atalho e o BECO: estreito (8 m), SEM MURO e ingreme, corta o contorno do topo — quem cai do beco
// volta para a pista (respawn), quem acerta ganha uns 120 m. As capsulas douradas ficam no beco (fase 4).
// Sentido horario; a largada e na avenida no pe do morro.
import { Construtor } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// rumos (graus): 0 sobe a avenida; -90 entra no morro; -30 sobe a encosta; -180 depois do cotovelo (desce reto); o "dente" do topo
// volta a -180; -270 na reta do pe do morro; -360 de volta a avenida
c.reta(110, { nome: 'avenida' })
  .direita(50, 90, { incl: 7 })
  .reta(130, { sobe: 9 })
  .esquerda(50, 60, { incl: 7, sobe: 3 })
  .reta(110, { sobe: 7 })
  // o cotovelo: 150 graus inclinados para dentro
  .direita(50, 150, { incl: 12, sobe: 3 })
  .reta(40, { sobe: 4, elastica: true })
  .ponto('entrada_beco')
  .reta(30)
  // o contorno do topo do morro (o beco corta por dentro, em linha)
  .esquerda(50, 90, { incl: 8, sobe: 3 })
  .reta(50)
  .direita(50, 90, { incl: 8 })
  .rampa({ comp: 24, altura: 3, vao: 13, queda: 1.0, pouso: 30, nome: 'laje', perigo: 'abismo' })
  .direita(50, 90, { incl: 8 })
  .reta(50, { sobe: -3 })
  .esquerda(50, 90, { incl: 8 })
  .reta(30)
  .ponto('saida_beco')
  .reta(40, { nome: 'topo_b', sobe: -6 })
  // a descida ate a avenida
  .direita(50, 90, { incl: 9, sobe: -6 })
  .reta(120, { sobe: 'resto', elastica: true })
  .direita(50, 90, { incl: 7 })
  .reta(150, { nome: 'chegada' });

c.atalho({
  de: 'entrada_beco', ate: 'saida_beco', lado: 'dir', largura: 8, nome: 'Beco da Escadaria', muro: false,
  via: (t) => t.direita(70, 12, { sobe: 1 }),
  douradas: [{ em: 1, d: 0 }, { em: 3, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'favela', nome: 'Favela Morro Acima', ordem: 2, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.laje.i, d: 0 }],
  tema: {
    estilo: 'favela',
    ceu: { topo: '#3a7fd0', meio: '#86b8e8', horizonte: '#f6d9b0', baixo: '#f0d2a8' },
    sol: { dir: [-0.55, 0.45, 0.6], cor: '#ffe2b0', forca: 3.0, disco: '#fff0d0', halo: 0.6 },
    hemi: { ceu: '#ffe9cc', chao: '#a07860', forca: 1.5 },
    neblina: { cor: '#f3dcb8', perto: 200, longe: 1300 },
    asfalto: '#55555b', faixa: '#ffffff', tracejado: '#ffd21f', zebra: ['#ffd21f', '#1b1b1b'], muro: ['#ffffff', '#e8321a', '#ffffff', '#2d9a3e'],
    estrutura: '#c9b9a6', corTerra: '#d8b48a',
    terreno: { tipo: 'morro', nivel: 0, cor: '#8fae4f', cor2: '#a7884f', corRocha: '#a5764c', corAlto: '#7d9a45', aterro: 0.8, corte: 0.9, ruido: 4 },
  },
};
