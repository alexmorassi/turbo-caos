// PISTA 3 — DESERTO. Retas longas entre dunas e o primeiro salto GRANDE (crista a 4,5 m, vao de 16 m, com faixa de impulso antes),
// uma curva rapida SEM MURO do lado de fora sobre o vale seco (quem abre demais cai) e o contorno da MESA — a pista principal da a
// volta no planalto de pedra e o atalho corta pelo meio do vale de AREIA, com uma rampa no caminho (corta mais, segura o carro na areia
// e cobra o salto). Sentido horario; a largada olha para o norte.
import { Construtor } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// um retangulo no sentido horario (rumos 0, -90, -180, -270): a largada sobe o lado esquerdo, o salto grande fica no topo, o contorno
// da mesa e um "dente" para FORA no lado direito (o atalho do vale segue reto por dentro) e a curva sem muro dobra o canto de baixo
c.reta(200, { nome: 'largada' })
  .direita(60, 90, { incl: 7 })
  .reta(60, { sobe: 5, marca: { tipo: 'impulso', de: 0.3, ate: 0.95 } })
  .rampa({ comp: 30, altura: 4.5, vao: 16, queda: 1.5, pouso: 36, nome: 'duna_grande', perigo: 'areia' })
  .reta(40, { sobe: -5 })
  .reta(60, { elastica: true })
  .direita(55, 90, { incl: 7 })
  .reta(30)
  .ponto('entrada_vale')
  .reta(30)
  // o contorno da mesa (bojo para a esquerda do piloto = para fora do retangulo)
  .esquerda(35, 90, { incl: 8, sobe: 4 })
  .reta(70, { sobe: 2 })
  .direita(35, 90, { incl: 8 })
  .reta(60)
  .direita(35, 90, { incl: 8, sobe: -3 })
  .reta(70, { sobe: -3 })
  .esquerda(35, 90, { incl: 8 })
  .reta(30)
  .ponto('saida_vale')
  .reta(40, { elastica: true })
  // a curva sem muro do lado de fora (esquerda), subindo a crista da duna: quem abre cai no vale
  .direita(70, 90, { incl: 10, sobe: 4, marca: { tipo: 'sem_muro_esq', de: 0.15, ate: 0.9 }, nome: 'curva_do_vale' })
  .reta(110, { sobe: -4 })
  .direita(80, 45, { incl: 6 })
  .esquerda(80, 45, { incl: 6 })
  .reta(60, { sobe: 'resto' })
  .direita(60, 90, { incl: 8 })
  .reta(80, { nome: 'chegada' });

c.atalho({
  de: 'entrada_vale', ate: 'saida_vale', lado: 'dir', largura: 9, nome: 'Atalho do Vale',
  via: (t) => t.direita(120, 8).reta(30).rampa({ comp: 22, altura: 2.6, vao: 11, queda: 0.8, pouso: 24, perigo: 'areia' }).esquerda(120, 8),
  douradas: [{ em: 2, d: 0 }],
});
const tracado = c.compila();
// a areia vai de boca a boca, menos a rampa (rampa de madeira no meio do vale)
for (const a of tracado.atalhos) {
  const r = a.figuras.find((f) => f.tipo === 'rampa');
  a.trechos.push({ de: -1, ate: r.de, tipo: 'terra' }, { de: r.ate, ate: a.pontos.length, tipo: 'terra' });
}

export default {
  id: 'deserto', nome: 'Deserto', ordem: 3, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.duna_grande.i, d: 0 }, { em: tracado.marcos.curva_do_vale.i - 2, d: -5 }],
  tema: {
    estilo: 'deserto',
    ceu: { topo: '#3d7fd6', meio: '#8fc0ea', horizonte: '#fbe7c2', baixo: '#f5d9a6' },
    sol: { dir: [0.3, 0.8, 0.45], cor: '#fff2d2', forca: 3.4, disco: '#fffbe8', halo: 0.55 },
    hemi: { ceu: '#fff1d6', chao: '#c79a5c', forca: 1.55 },
    neblina: { cor: '#f6e2bd', perto: 250, longe: 1500 },
    asfalto: '#5d5a58', faixa: '#ffffff', tracejado: '#ffffff', zebra: ['#e8321a', '#ffffff'], muro: ['#f7f1e4', '#e8761a'],
    estrutura: '#d6b98e', corTerra: '#f0c98a', corRampa: '#c8873e',
    terreno: { tipo: 'dunas', nivel: 0, cor: '#efc98e', cor2: '#e0b071', corRocha: '#b9774a', corAlto: '#f4d3a0', aterro: 0.5, corte: 0.6, ruido: 9 },
    nuvens: 0.35,
  },
};
