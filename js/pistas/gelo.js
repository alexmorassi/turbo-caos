// PISTA 4 — GELO. Serra nevada, pinheiros com neve, blocos de gelo. A curva inclinada mais forte ate aqui (12 graus) no canto de cima,
// o salto da FENDA (vao de 18 m sobre a rachadura azul), o RESSALTO de neve (salto pequeno no fim da volta) e o contorno do LAGO CONGELADO: a pista principal da a volta no lago por um bojo
// redondo e o atalho atravessa o gelo — gelo fofo segura o carro (TERRA), mas tem uma faixa de IMPULSO no meio para quem mira certo.
// Sentido horario; largada para o norte.
import { Construtor, lagoNoBojo } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 14 });
// rumos 0, -90 (topo), -180 (direita, com o bojo do lago para fora), -270 (baixo, chicane), -360
c.reta(230, { nome: 'largada' })
  .direita(65, 90, { incl: 10 })
  .reta(70, { sobe: 6 })
  .rampa({ comp: 30, altura: 4, vao: 18, queda: 1.6, pouso: 36, nome: 'fenda', perigo: 'gelo' })
  .reta(40, { sobe: -6, elastica: true })
  .direita(60, 90, { incl: 12 })
  .reta(25)
  .ponto('entrada_lago')
  .reta(30)
  // o bojo em volta do lago (para fora)
  .esquerda(50, 90, { incl: 8 })
  .direita(55, 180, { incl: 10, sobe: 3 })
  .esquerda(50, 90, { incl: 8, sobe: -3 })
  .reta(30)
  .ponto('saida_lago')
  .reta(60, { elastica: true })
  .direita(50, 90, { incl: 10 })
  .reta(70, { sobe: 4 })
  .esquerda(60, 30, { incl: 6 })
  .direita(60, 30, { incl: 6, sobe: -4 })
  .reta(70, { sobe: 3 })
  .rampa({ comp: 22, altura: 2.5, vao: 10, queda: 0.8, pouso: 26, nome: 'ressalto', perigo: 'gelo' })
  .reta(70, { sobe: 'resto' })
  .direita(60, 90, { incl: 10 })
  .reta(90, { nome: 'chegada' });

c.atalho({
  de: 'entrada_lago', ate: 'saida_lago', lado: 'dir', largura: 9, nome: 'Atalho do Lago',
  via: (t) => t.direita(150, 6).reta(40).reta(40, { marca: 'impulso' }).esquerda(150, 6),
  douradas: [{ em: 2, d: 0 }],
});
const tracado = c.compila();
for (const a of tracado.atalhos) a.trechos.push({ de: -1, ate: a.pontos.length, tipo: 'terra' });

export default {
  id: 'gelo', nome: 'Gelo', ordem: 4, largura: 14,
  ...tracado,
  douradas: [{ em: tracado.marcos.fenda.i, d: 0 }],
  tema: {
    estilo: 'gelo',
    ceu: { topo: '#5d8fd6', meio: '#a9c8ec', horizonte: '#eef4fb', baixo: '#f2f6fb', nuvem: '#ffffff', nuvemBaixo: '#d2dceb' },
    sol: { dir: [0.5, 0.42, -0.6], cor: '#f4f8ff', forca: 2.8, disco: '#ffffff', halo: 0.35 },
    hemi: { ceu: '#e6f0ff', chao: '#9fb4c8', forca: 1.6 },
    neblina: { cor: '#e8f0f8', perto: 160, longe: 1100 },
    asfalto: '#4f5966', faixa: '#ffffff', tracejado: '#9fe3ff', zebra: ['#1f6fe0', '#ffffff'], muro: ['#ffffff', '#1f6fe0'],
    estrutura: '#c9d6e2', corTerra: '#e6f4ff', corRampa: '#5aa8e8',
    terreno: { tipo: 'neve', nivel: 0, cor: '#f4f8fc', cor2: '#dde8f2', corRocha: '#8e99a8', corAlto: '#ffffff', aterro: 0.6, corte: 0.8, ruido: 7, lagos: [lagoNoBojo(tracado, 'entrada_lago', 'saida_lago', 4)] },
    agua: { nivel: -0.75, cor: '#cfeaff', gelo: true },
    nuvens: 0.8,
  },
};
