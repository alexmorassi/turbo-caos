// PISTA 10 — PISTA MALUCA. A final do campeonato: um PARQUE DE DIVERSOES. Arquibancadas cheias, baloes, roda-gigante, tendas listradas
// e cores fortes. Tudo o que as outras pistas ensinaram, junto: o LOOP DUPLO (dois loops seguidos), o SACA-ROLHA, DOIS PAREDOES fazendo
// os cantos do lobo de cima, o VIADUTO do oito e a MEGA-RAMPA (crista a 6 m, vao de 26 m). Dois atalhos: a RAMPA DO PALHACO (no desvio
// da avenida, pula por cima do circo) e o TOBOGA (no lobo de baixo, estreito e sem muro, com impulso).
// O oito: lobo de cima 270 graus para a direita, lobo de baixo 270 para a esquerda (soma zero).
import { Construtor } from './construtor.js';

const VIADUTO = 8.5; // m acima da avenida (folga de 6 m + laje + carro)
const c = new Construtor({ inicio: [0, 0, 0], rumo: -45, largura: 15 });
c.reta(60, { nome: 'largada' })
  .reta(35)
  .ponto('entrada_palhaco')
  .reta(25)
  // o desvio do circo (bojo para a esquerda); a rampa do palhaco corta reto por dentro. Curvas de 60 graus com raio 50 (eram 90
  // graus com raio 25: a crianca nao fazia no acelerador — 30/10/2026); com 90 graus e raio 50 a volta passava de 2,5 km
  .esquerda(50, 60, { incl: 8 })
  .reta(20)
  .direita(50, 60, { incl: 8 })
  .reta(10)
  .direita(50, 60, { incl: 8 })
  .reta(20)
  .esquerda(50, 60, { incl: 8 })
  .reta(25)
  .ponto('saida_palhaco')
  .reta(20)
  // lobo de cima: paredao, loop duplo, paredao, saca-rolha, curva (retas encurtadas em 30/10/2026 para a volta caber nos 2,2 km com
  // as curvas abertas)
  .paredao(40, 90, 'dir', { inclMax: 60, nome: 'paredao_1' })
  .reta(20)
  .reta(25, { marca: 'impulso' })
  .loop({ raio: 12, larg: 12, nome: 'loop_1' })
  .reta(40)
  .loop({ raio: 12, larg: 12, nome: 'loop_2' })
  .reta(20)
  .paredao(40, 90, 'dir', { inclMax: 60, nome: 'paredao_2' })
  .reta(20)
  .sacaRolha({ raio: 8, comp: 96, larg: 12, lado: 'esq', nome: 'saca_rolha' })
  .reta(20)
  .direita(50, 90, { incl: 10 })
  // o viaduto
  // (o cruzamento cai ~100 m depois do topo da subida: o plano do viaduto cobre 50 m de cada lado dele)
  .reta(80, { sobe: VIADUTO, perfil: 'linear' })
  .reta(130, { ponte: true, nome: 'viaduto' })
  .reta(75, { sobe: -VIADUTO, perfil: 'linear' })
  // lobo de baixo: o toboga (atalho) por dentro
  .esquerda(50, 90, { incl: 10 })
  .reta(20)
  .ponto('entrada_toboga')
  .reta(20)
  // o toboga por fora: curvas de 60 graus com raio 50 (eram 90 com raio 25), o mesmo motivo do desvio do circo
  .direita(50, 60, { incl: 8 })
  .reta(10)
  .esquerda(50, 60, { incl: 8 })
  .reta(15)
  .esquerda(50, 60, { incl: 8 })
  .reta(10)
  .direita(50, 60, { incl: 8 })
  .reta(20)
  .ponto('saida_toboga')
  .reta(30, { elastica: true })
  .esquerda(50, 90, { incl: 10 })
  .reta(50, { elastica: true })
  .esquerda(50, 90, { incl: 10 })
  // a mega-rampa na reta da chegada: a ultima emocao antes da bandeirada
  .reta(20)
  .rampa({ comp: 34, altura: 6, vao: 26, queda: 2, pouso: 42, nome: 'mega_rampa', perigo: 'abismo' })
  .reta(60, { nome: 'chegada' });

c.atalho({
  de: 'entrada_palhaco', ate: 'saida_palhaco', lado: 'dir', largura: 9, nome: 'Rampa do Palhaço',
  // a rampa depois de passar por baixo do viaduto (com o desvio mais comprido, o viaduto cruza o comeco do atalho: 6 m de folga)
  via: (t) => t.direita(140, 5).reta(70).rampa({ comp: 22, altura: 3.2, vao: 16, queda: 1.0, pouso: 24, perigo: 'abismo' }),
  douradas: [{ em: 2, d: 0 }],
});
c.atalho({
  de: 'entrada_toboga', ate: 'saida_toboga', lado: 'esq', largura: 8, nome: 'Tobogã', muro: false,
  via: (t) => t.esquerda(140, 5).reta(30, { marca: 'impulso' }).direita(140, 5),
  douradas: [{ em: 1, d: 0 }],
});
const tracado = c.compila();

export default {
  id: 'maluca', nome: 'Pista Maluca', ordem: 10, largura: 15,
  ...tracado,
  douradas: [{ em: tracado.marcos.mega_rampa.i, d: 0 }, { em: tracado.marcos.viaduto.i, d: 0 }],
  tema: {
    estilo: 'maluca',
    ceu: { topo: '#2a63d8', meio: '#7fb0f5', horizonte: '#ffe0f2', baixo: '#ffd6ea', nuvem: '#ffffff', nuvemBaixo: '#ffd0e6' },
    sol: { dir: [0.45, 0.68, -0.45], cor: '#fff4e0', forca: 3.2, disco: '#fffbe8', halo: 0.5 },
    hemi: { ceu: '#ffeefa', chao: '#7a9a5a', forca: 1.6 },
    neblina: { cor: '#ffe6f4', perto: 220, longe: 1500 },
    asfalto: '#4a4458', faixa: '#ffffff', tracejado: '#ffe14a', zebra: ['#ff2b8a', '#ffffff'], muro: ['#ff2b8a', '#ffe14a', '#22c6ff', '#7cff6b'],
    estrutura: '#b06ad8', corRampa: '#ff5ad0', portico: '#ff2b8a', corImpulso: '#7cff6b', corImpulso2: '#22e6ff',
    terreno: { tipo: 'plano', nivel: 0, cor: '#7cc85a', cor2: '#62b24a', corRocha: '#8a8a7a', ruido: 0.5, nivelFundo: -0.4 },
    nuvens: 1,
  },
};
