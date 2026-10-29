// PISTA 1 — ORLA DO RIO. A primeira do campeonato: larga (16 m), curvas abertas, muro em toda a volta, um salto pequeno sobre o canal
// e um atalho que a crianca ENXERGA da pista — a faixa de areia da praia, colada no calcadao, que corta o desvio pelas ruas de
// Copacabana. Areia segura o carro (TERRA), entao o atalho e menor mas mais lento: so compensa para quem entra e sai dele reto.
// Sentido horario (curvas a direita): o mar fica do lado de FORA da reta da largada, a cidade e os morros do lado de dentro.
//
// Desenho (rumo 0 = +Z, a largada olha para o norte com o mar a esquerda, no +X):
//   largada na avenida da praia -> curva larga para dentro da cidade -> subidinha -> rampa sobre o canal -> grande curva de volta
//   -> descida -> S -> curvas ate a praia de novo -> reta da praia com o DESVIO pelas ruas (o atalho de areia corta ele) -> largada.
import { Construtor } from './construtor.js';

const c = new Construtor({ inicio: [0, 0, 0], rumo: 0, largura: 16 });
c.reta(50, { nome: 'praia_largada' })
  .ponto('entrada_areia')
  .reta(25)
  // o desvio pelas ruas: um "dente" de 140 m de avanco e ~260 m de caminho (a areia faz os mesmos 140 m quase em linha)
  .direita(25, 90, { incl: 6 })
  .reta(30)
  .esquerda(25, 90, { incl: 6 })
  .reta(40)
  .esquerda(25, 90, { incl: 6 })
  .reta(30)
  .direita(25, 90, { incl: 6 })
  .reta(25)
  .ponto('saida_areia')
  .reta(40, { nome: 'praia_norte' })
  .direita(60, 90, { incl: 6 })
  .reta(90, { sobe: 4 })
  .reta(40, { marca: { tipo: 'impulso', de: 0.1, ate: 0.9 } })
  .rampa({ comp: 26, altura: 3, vao: 12, queda: 1.2, pouso: 32, nome: 'rampa_canal', perigo: 'agua' })
  .direita(55, 90, { incl: 8 })
  .reta(120, { sobe: 'resto' })
  .direita(70, 50, { incl: 4 })
  .esquerda(70, 50, { incl: 4 })
  .reta(80, { elastica: true })
  .direita(50, 90, { incl: 7 })
  .reta(150, { elastica: true, nome: 'praia_sul' })
  .direita(50, 90, { incl: 7 })
  .reta(100, { nome: 'praia_chegada' });

c.atalho({
  de: 'entrada_areia', ate: 'saida_areia', lado: 'esq', largura: 9, nome: 'Atalho da Areia',
  via: (t) => t.esquerda(90, 10).reta(60),
  douradas: [{ em: 1, d: 0 }, { em: 3, d: 0 }],
});
const tracado = c.compila();
// a areia vai de boca a boca (as bocas sao asfalto do nucleo; a terra comeca logo depois)
for (const a of tracado.atalhos) a.trechos.push({ de: -1, ate: a.pontos.length, tipo: 'terra' });

export default {
  id: 'orla', nome: 'Orla do Rio', ordem: 1, largura: 16,
  ...tracado,
  douradas: [{ em: tracado.marcos.rampa_canal.i, d: 0 }],
  tema: {
    estilo: 'orla',
    ceu: { topo: '#2f86e0', meio: '#77b9f2', horizonte: '#d4ecff', baixo: '#e8f1f4' },
    sol: { dir: [0.45, 0.75, -0.5], cor: '#fff3d6', forca: 3.2, disco: '#fffbe8' },
    hemi: { ceu: '#dff1ff', chao: '#d8c79a', forca: 1.5 },
    neblina: { cor: '#d4ecff', perto: 220, longe: 1500 },
    asfalto: '#5b5f66', faixa: '#ffffff', zebra: ['#e8242a', '#ffffff'], muro: ['#ffffff', '#1d6fd6'], estrutura: '#d9d4c7',
    terreno: { tipo: 'litoral', nivel: 0, areia: 9, agua: 78, fundo: -7, cor: '#7dbb4f', corAreia: '#f2dca2', ruido: 3 },
    agua: { nivel: -0.7, cor: '#1f9fd6', corFundo: '#0f6fa8' },
  },
};
