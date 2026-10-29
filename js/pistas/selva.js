// PISTA 6 — SELVA. Arvores gigantes, cipos, a CACHOEIRA e o rio. O loop da cachoeira (raio 13 m, logo depois da faixa de impulso), o
// salto do RIO (vao de 18 m), a SERPENTINA (esquerda-direita-esquerda inclinadas, no meio das arvores) e o atalho de LAMA: a principal
// desvia por um "dente" para fora e o atalho segue reto pela lama — curto, lento e sem muro (a mata dos dois lados).
// Sentido horario.
import { Construtor, travessia } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// rumos: 0 -> -90 (topo: impulso, loop da cachoeira e salto do rio) -> -180 (direita: dente para fora) -> -270 (fundo: serpentina) -> -360
c.reta(220, { nome: 'largada' })
  .direita(60, 90, { incl: 9 })
  .reta(40, { sobe: 3 })
  .reta(35, { marca: 'impulso' })
  .loop({ raio: 13, larg: 12, nome: 'loop_cachoeira' })
  .reta(50)
  .rampa({ comp: 28, altura: 4, vao: 18, queda: 1.5, pouso: 34, nome: 'salto_rio', perigo: 'agua' })
  .reta(30, { sobe: -3 })
  .direita(50, 90, { incl: 10 })
  .reta(40)
  .ponto('entrada_lama')
  .reta(30)
  // o dente para fora (esquerda do piloto); o atalho de lama segue reto por dentro
  .esquerda(30, 90, { incl: 8, sobe: 3 })
  .reta(40, { sobe: 2 })
  .direita(30, 90, { incl: 8 })
  .reta(50)
  .direita(30, 90, { incl: 8, sobe: -3 })
  .reta(40, { sobe: -2 })
  .esquerda(30, 90, { incl: 8 })
  .reta(30)
  .ponto('saida_lama')
  .reta(40, { elastica: true })
  .direita(55, 90, { incl: 9 })
  .reta(60)
  // a serpentina, no fundo da selva
  .esquerda(40, 60, { incl: 9 })
  .direita(40, 120, { incl: 11 })
  .esquerda(40, 60, { incl: 9 })
  .reta(80, { sobe: 'resto', elastica: true })
  .direita(55, 90, { incl: 9 })
  .reta(80, { nome: 'chegada' });

c.atalho({
  de: 'entrada_lama', ate: 'saida_lama', lado: 'dir', largura: 8, nome: 'Atalho da Lama', muro: false,
  via: (t) => t.direita(120, 8).reta(40).esquerda(120, 8),
  douradas: [{ em: 1, d: 0 }],
});
const tracado = c.compila();
for (const a of tracado.atalhos) a.trechos.push({ de: -1, ate: a.pontos.length, tipo: 'terra' });

export default {
  id: 'selva', nome: 'Selva', ordem: 6, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.salto_rio.i, d: 0 }],
  tema: {
    estilo: 'selva',
    ceu: { topo: '#3d86c8', meio: '#9fd0d8', horizonte: '#d9f0d0', baixo: '#cfe6c0', nuvem: '#ffffff', nuvemBaixo: '#c8d8d0' },
    sol: { dir: [0.35, 0.7, 0.55], cor: '#fff6d8', forca: 3.0, disco: '#fffbe6', halo: 0.5 },
    hemi: { ceu: '#e6ffd8', chao: '#3f6a2a', forca: 1.6 },
    neblina: { cor: '#cfe8c8', perto: 90, longe: 900 },
    asfalto: '#4d4f4a', faixa: '#ffffff', tracejado: '#ffd21f', zebra: ['#ffd21f', '#2a8a2e'], muro: ['#7a5532', '#a8763f'], muroTopo: '#5a3f22',
    estrutura: '#8a7a5a', corTerra: '#9a6a3a', corRampa: '#a8682a',
    terreno: { tipo: 'selva', nivel: 0, cor: '#3f8f35', cor2: '#2f7a2c', corRocha: '#6a6a5a', corAlto: '#2f6a2a', aterro: 0.8, corte: 0.9, ruido: 8, fosso: 7,
      rios: [travessia(tracado, 'salto_rio', { comp: 1500, larg: 30, curva: 60, ondas: 2.6 })] },
    agua: { nivel: -2.5, cor: '#2f9fb0' },
  },
};
