// OS 10 PODERES (catalogo da fundacao; a fase 4 e dona dos NUMEROS — nenhum campo da fundacao saiu). Um por carro (config/carros.js,
// campo `poder`). Todo poder tem recarga por tempo (cooldown, o anel do botao), efeito visual, som e uma forma de ESQUIVA ou
// CONTRA-ATAQUE — descrita em `esquiva`, que a tela de selecao mostra para a crianca aprender jogando. O texto de `esquiva` e VERDADE no
// codigo (js/poderes/<id>.js) e a suite testes/teste_poderes.js prova cada um.
// Tempos em segundos, distancias em metros. Como cada um funciona: docs/fases/fase4_poderes.md.
export const PODERES = {
  oleo: {
    nome: 'Mancha de Óleo', icone: '🛢️', cor: '#3a2f6b',
    descricao: 'Deixa uma poça escorregadia atrás de você. Quem passar por cima roda!',
    esquiva: 'Desvie da poça — ela não ocupa a pista inteira.',
    recarga: 10,
    duracao: 10,           // s que a poca fica na pista (era 12: com 12 s cobria o pelotao inteiro e ainda pegava o retardatario)
    raio: 3.2,             // m da poca (a mancha desenhada); encolhe em pista estreita (ver `livre`)
    rodopio: 1.4,          // s de rodopio (js/carro.js rodopia: 2 voltas inteiras, perde ~75 % da velocidade)
    distanciaAtras: 6,     // m atras do carro que soltou
    contato: 0.8,          // m alem do raio: a roda (meia largura do carro ~1,1 m) encosta antes do centro
    livre: 1.6,            // m minimos de faixa LIVRE para o centro do carro passar ao lado (o "nao ocupa a pista inteira")
  },
  emp: {
    nome: 'Pulso EMP', icone: '⚡', cor: '#2fd3ff',
    descricao: 'Uma onda elétrica que desliga o turbo de quem estiver perto por 3 segundos.',
    esquiva: 'O pulso carrega por meio segundo: saia do círculo azul!',
    recarga: 14,
    duracao: 3,            // s sem turbo (mod.semTurbo)
    raio: 24,              // m (era 26: com 26 o pelotao inteiro de 8 carros ficava dentro e nao havia "saia do circulo")
    carga: 0.6,            // s ate o pulso estourar (o circulo cresce ate o raio nesse tempo)
  },
  congelante: {
    nome: 'Raio Congelante', icone: '❄️', cor: '#9fe8ff',
    descricao: 'Congela o carro logo à sua frente por um segundo e meio.',
    esquiva: 'O raio vai reto: mude de faixa. Congelado? Toque rápido no PODER para quebrar o gelo.',
    recarga: 12,
    duracao: 1.5,          // s congelado (js/carro.js congela; cada toque no PODER tira FISICA.GELO_POR_TOQUE)
    alcance: 70,           // m pela pista
    larguraDoRaio: 3,      // m: o raio corre na FAIXA (d) em que foi disparado; acerta quem estiver a menos de meia largura + meio carro
    velocidadeDoRaio: 80,  // m/s (era 120: 70 m em 0,58 s, ninguem reagia — o raio vem POR TRAS do alvo). A 80 m/s o raio leva
                           // ~1 s para alcancar quem vai a 30 m/s 50 m a frente: com o aviso na tela da para trocar de faixa
  },
  ima: {
    nome: 'Ímã', icone: '🧲', cor: '#ff3b5c',
    descricao: 'Puxa as cápsulas de turbo para você e segura quem estiver bem perto.',
    esquiva: 'Fique longe do campo magnético (mais de 14 m).',
    recarga: 13,
    duracao: 3,            // s de campo ligado
    raioCapsulas: 35,      // m: capsulas dentro disto voam para o dono
    raioCarros: 14,        // m: rival dentro disto e segurado (o "mais de 14 m" da esquiva)
    freio: 0.82,           // mod.velMax *= enquanto segurado
    segura: 0.35,          // s que o rival continua segurado depois de sair do campo (sem pisca-pisca na borda)
  },
  trocatroca: {
    nome: 'Troca-Troca', icone: '🔄', cor: '#ff5ad1',
    descricao: 'Troca de lugar com o carro logo à sua frente!',
    esquiva: 'A mira demora um segundo: ligue o TURBO para escapar dela.',
    recarga: 18,
    mira: 1.0,             // s de mira (o feixe rosa) antes da troca
    alcance: 60,           // m pela pista ate o carro da frente
    foge: 1.25,            // x alcance: o alvo que passa disto durante a mira escapou (o Escudo DEVOLVE a troca: quem mandou
                           // troca com quem vem logo ATRAS dele — ver js/poderes/trocatroca.js)
  },
  encolhedor: {
    nome: 'Encolhedor', icone: '🔻', cor: '#8a5cff',
    descricao: 'Encolhe os rivais perto de você: ficam pequenos, lentos e leves.',
    esquiva: 'Pegue uma cápsula de turbo para voltar ao tamanho normal.',
    recarga: 15,
    duracao: 4,            // s encolhido
    raio: 22,              // m
    escala: 0.55,          // mod.escala (o visual do carro e a caixa de colisao encolhem juntos)
    velMax: 0.8,           // mod.velMax *=
    carga: 0.5,            // s de carga do pulso (o anel roxo cresce)
    massa: 0.5,            // mod.massa *= — "leves": na batida o encolhido e empurrado longe
  },
  fumaca: {
    nome: 'Cortina de Fumaça', icone: '💨', cor: '#9aa3ad',
    descricao: 'Solta uma nuvem que embaça a visão de quem vem atrás.',
    esquiva: 'A nuvem não cobre a pista toda: passe pelo lado.',
    recarga: 11,
    duracao: 6,            // s de nuvem
    raio: 9,               // m de meio COMPRIMENTO da nuvem ao longo da pista (18 m de fumaca: a crianca ve de longe)
    distanciaAtras: 8,     // m atras do carro que soltou
    meiaLargura: 4.2,      // m de meia LARGURA da nuvem atravessada: numa pista de 14 m sobra uma faixa para passar ao lado
    livre: 1.6,            // m minimos de faixa livre para o centro do carro (o mesmo do oleo)
    visao: 0.85,           // mod.visao no meio da nuvem (o HUD embaca a tela; a IA perde precisao)
    cegoDevolvido: 2.5,    // s de visao embacada para quem mandou, quando o Escudo devolve
  },
  tornado: {
    nome: 'Mini Tornado', icone: '🌪️', cor: '#7ee081',
    descricao: 'Lança um tornado que levanta e gira o primeiro carro que pegar.',
    esquiva: 'O tornado mira de leve: desvie para o lado na hora certa.',
    recarga: 13,
    velocidade: 75,        // m/s pela pista (alcanca qualquer carro: o turbo vai a ~51)
    alcance: 220,          // m
    levanta: 1.3,          // s no ar (js/carro.js levanta: sobe ~3 m girando 2 voltas)
    raioAcerto: 2.4,       // m do centro do tornado (1 m acima do asfalto) ao centro do carro: pega o carro inteiro da faixa
    mira: 2.2,             // m/s de correcao lateral: "mira de leve" — o carro virando tudo vai de lado a 7-11 m/s e escapa se
                           // comecar ~0,9 s antes (o aviso na tela vem AVISO_TORNADO s antes); quem nao reage e pego
    miraDe: 120,           // m: so corrige a faixa com o alvo a menos disto (de mais longe vai reto na faixa em que saiu)
  },
  escudo: {
    nome: 'Escudo Refletor', icone: '🛡️', cor: '#ffd84a',
    descricao: 'Um escudo dourado que bloqueia o próximo poder e devolve para quem mandou.',
    esquiva: 'Contra o escudo, espere ele acabar antes de atacar.',
    recarga: 16,
    duracao: 8,            // s de escudo (ou ate bloquear um poder)
  },
  terremoto: {
    nome: 'Terremoto', icone: '🌋', cor: '#ff7a1a',
    descricao: 'Faz a pista tremer: todo mundo escorrega, menos você.',
    esquiva: 'Quem estiver no ar na hora do tremor não sente nada — pule numa rampa!',
    recarga: 17,
    duracao: 3,            // s escorregando
    raio: 90,              // m
    aderencia: 0.35,       // mod.aderencia *= (o k do pneu: o carro escorrega na curva)
    carga: 0.8,            // s de aviso antes do tremor (o chao ja treme de leve)
  },
};

/** Ordem de exibicao (a mesma do pedido). */
export const ORDEM_DOS_PODERES = ['oleo', 'emp', 'congelante', 'ima', 'trocatroca', 'encolhedor', 'fumaca', 'tornado', 'escudo', 'terremoto'];

/** Comum a todos os poderes (js/poderes.js). */
export const PODERES_GERAL = {
  PRIMEIRA_RECARGA: 5,     // s depois da largada ate o primeiro poder ficar pronto (pedido: "pronto ~5 s apos a largada")
  ALTURA_DO_CENTRO: 0.7,   // m acima do asfalto (x escala): o meio do carro, de onde se mede distancia 3D
  AVISO_TORNADO: 1.6,      // s antes de o tornado chegar ao JOGADOR: aviso na tela (ele vem por tras, fora da camera): da tempo de
                           // ler/ouvir (~0,5 s) e comecar a desviar ~1 s antes
};
