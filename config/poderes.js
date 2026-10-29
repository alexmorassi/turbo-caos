// OS 10 PODERES (fundacao: catalogo e numeros iniciais; a fase 4 e dona e pode AJUSTAR os numeros, sem tirar campo). Um por carro
// (config/carros.js, campo `poder`). Todo poder tem recarga por tempo (cooldown, o anel do botao), efeito visual, som e uma forma de
// ESQUIVA ou CONTRA-ATAQUE — descrita em `esquiva`, que a tela de selecao mostra para a crianca aprender jogando.
// Tempos em segundos, distancias em metros.
export const PODERES = {
  oleo: {
    nome: 'Mancha de Óleo', icone: '🛢️', cor: '#3a2f6b',
    descricao: 'Deixa uma poça escorregadia atrás de você. Quem passar por cima roda!',
    esquiva: 'Desvie da poça — ela não ocupa a pista inteira.',
    recarga: 10, duracao: 12, raio: 3.2, rodopio: 1.4, distanciaAtras: 6,
  },
  emp: {
    nome: 'Pulso EMP', icone: '⚡', cor: '#2fd3ff',
    descricao: 'Uma onda elétrica que desliga o turbo de quem estiver perto por 3 segundos.',
    esquiva: 'O pulso carrega por meio segundo: saia do círculo azul!',
    recarga: 14, duracao: 3, raio: 26, carga: 0.6,
  },
  congelante: {
    nome: 'Raio Congelante', icone: '❄️', cor: '#9fe8ff',
    descricao: 'Congela o carro logo à sua frente por um segundo e meio.',
    esquiva: 'O raio vai reto: mude de faixa. Congelado? Toque rápido no PODER para quebrar o gelo.',
    recarga: 12, duracao: 1.5, alcance: 70, larguraDoRaio: 3, velocidadeDoRaio: 120,
  },
  ima: {
    nome: 'Ímã', icone: '🧲', cor: '#ff3b5c',
    descricao: 'Puxa as cápsulas de turbo para você e segura quem estiver bem perto.',
    esquiva: 'Fique longe do campo magnético (mais de 14 m).',
    recarga: 13, duracao: 3, raioCapsulas: 35, raioCarros: 14, freio: 0.82,
  },
  trocatroca: {
    nome: 'Troca-Troca', icone: '🔄', cor: '#ff5ad1',
    descricao: 'Troca de lugar com o carro logo à sua frente!',
    esquiva: 'A mira demora um segundo: ligue o TURBO para escapar dela.',
    recarga: 18, mira: 1.0, alcance: 60,
  },
  encolhedor: {
    nome: 'Encolhedor', icone: '🔻', cor: '#8a5cff',
    descricao: 'Encolhe os rivais perto de você: ficam pequenos, lentos e leves.',
    esquiva: 'Pegue uma cápsula de turbo para voltar ao tamanho normal.',
    recarga: 15, duracao: 4, raio: 22, escala: 0.55, velMax: 0.8, carga: 0.5,
  },
  fumaca: {
    nome: 'Cortina de Fumaça', icone: '💨', cor: '#9aa3ad',
    descricao: 'Solta uma nuvem que embaça a visão de quem vem atrás.',
    esquiva: 'A nuvem não cobre a pista toda: passe pelo lado.',
    recarga: 11, duracao: 6, raio: 9, distanciaAtras: 8,
  },
  tornado: {
    nome: 'Mini Tornado', icone: '🌪️', cor: '#7ee081',
    descricao: 'Lança um tornado que levanta e gira o primeiro carro que pegar.',
    esquiva: 'O tornado mira de leve: desvie para o lado na hora certa.',
    recarga: 13, velocidade: 75, alcance: 220, levanta: 1.3, raioAcerto: 2.6,
  },
  escudo: {
    nome: 'Escudo Refletor', icone: '🛡️', cor: '#ffd84a',
    descricao: 'Um escudo dourado que bloqueia o próximo poder e devolve para quem mandou.',
    esquiva: 'Contra o escudo, espere ele acabar antes de atacar.',
    recarga: 16, duracao: 8,
  },
  terremoto: {
    nome: 'Terremoto', icone: '🌋', cor: '#ff7a1a',
    descricao: 'Faz a pista tremer: todo mundo escorrega, menos você.',
    esquiva: 'Quem estiver no ar na hora do tremor não sente nada — pule numa rampa!',
    recarga: 17, duracao: 3, raio: 90, aderencia: 0.35, carga: 0.8,
  },
};

/** Ordem de exibicao (a mesma do pedido). */
export const ORDEM_DOS_PODERES = ['oleo', 'emp', 'congelante', 'ima', 'trocatroca', 'encolhedor', 'fumaca', 'tornado', 'escudo', 'terremoto'];
