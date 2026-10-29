// TABELA DOS CARROS DO TURBO CAOS (fase 1): origem -> id, e tudo o que e DECISAO DE PROJETO (nome, poder, atributos,
// frase). O que e MEDIDA (tris, KB, medidas, raio das rodas) nao mora aqui: sai do otimiza.mjs (medidas.json) e o
// gera_config.mjs junta as duas coisas em config/carros.js. Assim mudar um atributo nao exige reprocessar GLB, e
// reprocessar GLB nao apaga decisao.
//
// fonte: o tipo de malha que entra no jogo.
//   'lo'   = as malhas leves *_lo que o Cidade Aberta ja fez (lodatlas.py: cartas proprias numa FAIXA de 12,5 % do atlas,
//            v de 0,875 a 1, pintadas a partir do modelo cheio). O mapa de normais nessa faixa e PLANO (medido: cor 128,128,
//            255 em toda a faixa), entao nao vai para o GLB.
//   'alta' = a malha cheia simplificada aqui com meshopt (o carro nao tem *_lo: os monster trucks).
// rodas: 'rodas' (wheel1..4: 1/2 frente, 3/4 tras, side 1 = +X) | 'pods' (carro voador: pod0..3 sem girar).
//
// ATRIBUTOS: 1 a 5 em velocidade, aceleracao, controle, peso e turbo, SOMA 16 em todos. Soma fixa = nenhum carro e
// melhor em tudo; a escolha vira estilo de corrida (regra do GDD do Turbo Caos: "cada um com atributos proprios"). O
// peso entra na conta porque decide quem empurra quem nas batidas: o pesado anda menos mas nao e jogado para fora.
export const TABELA = [
  { id: 'vulcao', origem: 'vulcao.glb', fonte: 'lo', rodas: 'rodas', nome: 'Vulcão', poder: 'terremoto',
    cor: '#ff5a1f', porqueCor: 'laranja da lava: matiz da lava da textura (#db7855, 16 graus) com saturacao cheia - o vermelho puro ficou com o Voador',
    atributos: { velocidade: 4, aceleracao: 3, controle: 2, peso: 4, turbo: 3 },
    porque: 'hot rod de pedra e lava: rodas traseiras enormes (empurra muito), pesado e duro de virar; o terremoto combina com a rocha',
    descricao: 'Um carro de pedra e lava que faz a pista inteira tremer!' },
  { id: 'dourado', origem: 'dourado.glb', fonte: 'lo', rodas: 'rodas', nome: 'Dourado B7', poder: 'escudo',
    espelha: { wheel3: 'wheel4' },   // a wheel3_lo nao tem o topo do pneu (36 cm de raio em cima contra 43 no resto): girando, pulava 3 cm
    cor: '#e2a328', porqueCor: 'dourado da lataria (20 % da area)',
    atributos: { velocidade: 5, aceleracao: 3, controle: 3, peso: 2, turbo: 3 },
    porque: 'carro de corrida classico com aerofolio: a maior velocidade final do grid (velocidade 5); o escudo dourado combina com a pintura e compensa o peso leve',
    descricao: 'O carro de corrida dourado: rápido, firme e protegido por um escudo brilhante.' },
  { id: 'lagartixa', origem: 'porsche.glb', fonte: 'lo', rodas: 'rodas', nome: 'Lagartixa', poder: 'oleo',
    cor: '#57c61c', porqueCor: 'verde-limao da lataria (15 % da area)',
    atributos: { velocidade: 3, aceleracao: 4, controle: 5, peso: 2, turbo: 2 },
    porque: 'esportivo baixo verde-limao: gruda na curva como lagartixa na parede (controle 5); deixa a mancha de oleo para quem vem atras',
    descricao: 'Verde, baixinho e grudento nas curvas. Quem vem atrás escorrega no óleo!' },
  { id: 'picole', origem: 'sorvete.glb', fonte: 'lo', rodas: 'rodas', nome: 'Picolé', poder: 'congelante',
    cor: '#fd4d91', porqueCor: 'rosa da bola de sorvete do teto: o turquesa da lataria (#05b4c5) brigava com o azul do Tubarao',
    atributos: { velocidade: 2, aceleracao: 2, controle: 3, peso: 5, turbo: 4 },
    porque: 'caminhao de sorvete alto com casquinha no teto: o mais pesado das rodas comuns, compensa com turbo; congelar e o poder obvio',
    descricao: 'O caminhão de sorvete que congela quem está na frente. Brrr!' },
  { id: 'buguinho', origem: 'buggy.glb', fonte: 'lo', rodas: 'rodas', nome: 'Buguinho', poder: 'encolhedor',
    cor: '#eb7f43', porqueCor: 'laranja da fibra (#b46234, 9 %) com o brilho levantado para aparecer no HUD',
    atributos: { velocidade: 3, aceleracao: 4, controle: 4, peso: 2, turbo: 3 },
    porque: 'bugue de praia laranja (a unica cor livre do grid), aberto e de rodas grandes: leve, arranca e pula bem; encolher os outros e a vinganca do pequeno. ' +
      'TROCA do Fuscao sugerido: o fusca.glb e BRANCO como o seal e a *_lo dele tem cacos pretos na lataria (UV antiga do mklod); o fusca_teto (vermelho) ' +
      'tem o forro claro da porta atravessando a lataria na *_lo (defeito de geometria: repintar a faixa pela malha cheia nao resolveu) e a malha cheia nao ' +
      'simplifica sem estragar a textura. O bugue de praia brasileiro nasce sobre chassi de Fusca: a ideia continua',
    descricao: 'O bugue laranja da praia que encolhe os adversários. Pequeno, mas valente!' },
  { id: 'kombosa', origem: 'kombi.glb', fonte: 'lo', rodas: 'rodas', nome: 'Kombosa', poder: 'fumaca',
    cor: '#3bf1a6', porqueCor: 'verde-menta da lataria',
    atributos: { velocidade: 2, aceleracao: 3, controle: 3, peso: 4, turbo: 4 },
    porque: 'Kombi hippie com olhos no para-brisa e arco-iris: van alta e pesada, turbo de "ladeira abaixo"; a fumaca colorida e a cara dela',
    descricao: 'A Kombi paz e amor que solta uma nuvem de fumaça colorida.' },
  { id: 'tubarao', origem: 'shark.glb', fonte: 'alta', rodas: 'rodas', nome: 'Tubarão', poder: 'ima',
    cor: '#3d98d3', porqueCor: 'azul do tubarao',
    atributos: { velocidade: 3, aceleracao: 2, controle: 2, peso: 5, turbo: 4 },
    porque: 'monster truck tubarao: o mais pesado do grid (peso 5) e o mais lento para sair, rodas gigantes passam por cima de tudo; o ima puxa quem esta perto como um tubarao puxa a presa',
    descricao: 'Um tubarão monstro com rodas gigantes que puxa todo mundo com o ímã!' },
  { id: 'voador', origem: 'yarisvoador.glb', fonte: 'lo', rodas: 'pods', pods: 'recolhidos', nome: 'Voador', poder: 'tornado',
    cor: '#d71517', porqueCor: 'vermelho da pintura de rali',
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 1, turbo: 5 },
    porque: 'carro de rali que flutua em quatro turbinas: o maior turbo (5, as turbinas sao a cara dele), o mais leve (peso 1, sai voando na batida) e escorrega na curva como hovercraft; o tornado e vento, combina com quem voa',
    descricao: 'Não tem rodas: voa! E ainda solta um tornado na pista.' },
  { id: 'faisca', origem: 'seal.glb', fonte: 'lo', rodas: 'rodas', nome: 'Faísca', poder: 'emp',
    cor: '#d7d6d3', porqueCor: 'branco perola da lataria (22 % da area)',
    atributos: { velocidade: 4, aceleracao: 5, controle: 3, peso: 2, turbo: 2 },
    porque: 'sedan eletrico branco: eletrico arranca de uma vez (aceleracao 5); o pulso eletrico (emp) desliga o turbo e o poder de quem esta perto',
    descricao: 'O carro elétrico mais arrancador da pista. Seu choque desliga os rivais!' },
  { id: 'jatinho', origem: 'kart_jato.glb', fonte: 'lo', rodas: 'rodas', nome: 'Jatinho', poder: 'trocatroca',
    cor: '#2040d9', porqueCor: 'azul royal da carenagem (#122377) com o brilho levantado: o azul-marinho some no HUD escuro',
    atributos: { velocidade: 3, aceleracao: 4, controle: 5, peso: 1, turbo: 3 },
    porque: 'kart com turbinas: leve (peso 1) e o mais agil (controle 5); o trocatroca troca de lugar com quem esta na frente, golpe de quem e pequeno e esperto',
    descricao: 'O kart a jato que troca de lugar com quem está na frente. Zum!' },
];

export const CARRO_PADRAO = 'vulcao';   // o do modelo de config pedido na fase 1

// medidas-alvo da normalizacao (m): s = min(4,2/comprimento, 2,3/largura, 2,6/altura) - todo carro cabe na mesma caixa,
// entao a colisao e a largura da faixa da pista valem para todos. Pedido da fase 1.
export const ALVO = { comprimento: 4.2, largura: 2.3, altura: 2.6 };
