// PISTA 5 — VULCAO. Rocha escura, rios de lava e o cone fumegante no fundo. O PRIMEIRO LOOP do campeonato (raio 12 m, a saida passa
// 16 m ao lado da entrada), o salto do RIO DE LAVA, a ponte SEM MURO sobre a lava (a linha arriscada: estreita a vista, mas e reta) e o
// lago de lava: a pista principal o contorna por um bojo e o atalho PULA o lago numa rampa (o salto mais longo ate aqui, vao de 20 m) —
// quem chega devagar cai na lava. Sentido horario.
import { Construtor, lagoNoBojo, travessia } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// rumos: 0 -> -60 (loop) -> -120 (bojo do lago para fora) -> -210 (ponte e salto) -> -270 -> -360
c.reta(150, { nome: 'largada' })
  .direita(70, 60, { incl: 8 })
  .reta(90, { sobe: 4 })
  .reta(30, { marca: 'impulso' })
  .loop({ raio: 12, larg: 12, nome: 'loop' })
  .reta(60, { elastica: true })
  .direita(60, 60, { incl: 10 })
  .reta(40)
  .ponto('entrada_lago')
  .reta(30)
  .esquerda(50, 90, { incl: 8 })
  .direita(55, 180, { incl: 10, sobe: 3 })
  .esquerda(50, 90, { incl: 8, sobe: -3 })
  .reta(30)
  .ponto('saida_lago')
  .reta(40)
  .direita(55, 90, { incl: 10 })
  // a ponte sobre o rio de lava, sem muro (a lava fica 6 m abaixo)
  .reta(110, { ponte: true, marca: 'sem_muro', nome: 'ponte_lava' })
  .reta(40)
  .rampa({ comp: 28, altura: 4, vao: 16, queda: 1.4, pouso: 34, nome: 'salto_lava', perigo: 'lava' })
  .direita(60, 60, { incl: 9 })
  .reta(80, { sobe: 'resto', elastica: true })
  .direita(55, 90, { incl: 9 })
  .reta(90, { nome: 'chegada' });

c.atalho({
  de: 'entrada_lago', ate: 'saida_lago', lado: 'dir', largura: 9, nome: 'Pulo do Lago de Lava',
  via: (t) => t.reta(20).rampa({ comp: 26, altura: 3.5, vao: 20, queda: 1.2, pouso: 30, perigo: 'lava' }),
  douradas: [{ em: 0, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'vulcao', nome: 'Vulcão', ordem: 5, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.ponte_lava.i - 2, d: 4 }, { em: tracado.marcos.salto_lava.i, d: 0 }],
  tema: {
    estilo: 'vulcao',
    ceu: { topo: '#4a2a52', meio: '#c0584a', horizonte: '#ffc080', baixo: '#f0a060', nuvem: '#c8a4a0', nuvemBaixo: '#7a5a60' },
    sol: { dir: [-0.6, 0.25, -0.5], cor: '#ffc89a', forca: 2.6, disco: '#ffd9a0', halo: 0.8, tamanho: 0.22 },
    hemi: { ceu: '#ffc8a0', chao: '#7a4a3a', forca: 1.9 },
    neblina: { cor: '#f0a070', perto: 140, longe: 1100 },
    asfalto: '#46424a', faixa: '#ffd21f', tracejado: '#ff8a1a', zebra: ['#ff5a1a', '#1b1b1b'], muro: ['#2b2b2e', '#ff6a1a'],
    estrutura: '#8a7a72', corTerra: '#7a5a4a', corRampa: '#e84a1a', corImpulso: '#ffe14a', corImpulso2: '#ff6a1a',
    terreno: { tipo: 'vulcanico', nivel: 0, cor: '#7a5e54', cor2: '#5e4a44', corRocha: '#4a3a36', corAlto: '#8a6a5a', aterro: 0.8, corte: 0.9, ruido: 6, fosso: 9, fossoPonte: 10,
      lagos: [lagoNoBojo(tracado, 'entrada_lago', 'saida_lago', 2)], rios: [travessia(tracado, 'ponte_lava', { comp: 1400, larg: 26, curva: 55 }), travessia(tracado, 'salto_lava', { comp: 1200, larg: 18, curva: 45, fase: 2.1 })] },
    lava: { nivel: -3.2, cor: '#ffffff' },
    nuvens: 0.45,
  },
};
