// PISTA 9 — CANYON COM SALTOS. Paredoes vermelhos em camadas, abismos e pontes. TRES saltos grandes sobre fendas (o maior com vao de
// 24 m), o PAREDAO (curva magnetica de 90 graus que deita ate 65 graus: o carro anda na parede do canyon), a ponte ESTREITA sem muro
// sobre o abismo (12 m de largura, 20 m de queda) e o loop do mirante. O atalho e a SALIENCIA: uma prateleira estreita (8 m) e sem
// muro na parede do canyon, que corta o contorno do cotovelo — com impulso no meio para quem tem coragem. Sentido horario.
import { Construtor } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// um quadrilatero no sentido horario: topo (saltos 1 e 2 em sequencia) -> o PAREDAO faz o canto de cima -> lado direito (ponte
// estreita e o salto grande) -> fundo (cotovelo com a saliencia por dentro, impulso e loop) -> lado esquerdo (largada)
c.reta(200, { nome: 'largada' })
  .direita(60, 90, { incl: 9 })
  .reta(70, { sobe: 3 })
  .rampa({ comp: 30, altura: 5, vao: 20, queda: 1.6, pouso: 38, nome: 'salto_1', perigo: 'abismo' })
  .reta(50, { sobe: -3 })
  .reta(40)
  .rampa({ comp: 28, altura: 4, vao: 18, queda: 1.4, pouso: 34, nome: 'salto_3', perigo: 'abismo' })
  .reta(40)
  .paredao(45, 90, 'dir', { inclMax: 65, nome: 'paredao' })
  .reta(80, { elastica: true })
  // a ponte estreita sem muro sobre o abismo
  .reta(100, { ponte: true, larg: 12, marca: 'sem_muro', nome: 'ponte_estreita' })
  .reta(40)
  .rampa({ comp: 32, altura: 5.5, vao: 24, queda: 1.8, pouso: 40, nome: 'salto_2', perigo: 'abismo' })
  .direita(60, 90, { incl: 9 })
  .reta(40)
  .ponto('entrada_saliencia')
  .reta(30)
  // o cotovelo (bojo para fora); a saliencia corta reto por dentro
  .esquerda(30, 90, { incl: 8 })
  .direita(55, 180, { incl: 11, sobe: 4 })
  .esquerda(30, 90, { incl: 8, sobe: -4 })
  .reta(30)
  .ponto('saida_saliencia')
  .reta(40)
  .reta(30, { marca: 'impulso' })
  .loop({ raio: 12, larg: 12, nome: 'loop_mirante' })
  .reta(60, { elastica: true, sobe: 'resto' })
  .direita(60, 90, { incl: 9 })
  .reta(90, { nome: 'chegada' });

c.atalho({
  de: 'entrada_saliencia', ate: 'saida_saliencia', lado: 'dir', largura: 8, nome: 'Atalho da Saliência', muro: false,
  via: (t) => t.direita(150, 6).reta(30).reta(35, { marca: 'impulso' }).esquerda(150, 6),
  douradas: [{ em: 2, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'canyon', nome: 'Canyon', ordem: 9, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.salto_2.i, d: 0 }, { em: tracado.marcos.ponte_estreita.i - 2, d: 3 }],
  tema: {
    estilo: 'canyon',
    ceu: { topo: '#2f73c8', meio: '#8ab8e2', horizonte: '#f6d6b0', baixo: '#e8b88a' },
    sol: { dir: [-0.4, 0.62, 0.55], cor: '#fff0d0', forca: 3.3, disco: '#fff6e0', halo: 0.5 },
    hemi: { ceu: '#ffe6c8', chao: '#a05a3a', forca: 1.5 },
    neblina: { cor: '#f0cfa8', perto: 220, longe: 1500 },
    asfalto: '#57514e', faixa: '#ffffff', tracejado: '#ffd21f', zebra: ['#e8321a', '#ffffff'], muro: ['#f2e6d6', '#c8461a'],
    estrutura: '#b8774f', corRampa: '#d8641a',
    terreno: { tipo: 'canyon', nivel: 0, cor: '#c8703f', cor2: '#b25a32', corRocha: '#9a4426', corAlto: '#d68a52', aterro: 2.2, corte: 2.2, ruido: 5, fosso: 22, fossoPonte: 22 },
    nuvens: 0.6,
  },
};
