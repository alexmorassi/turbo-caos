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
// ATRIBUTOS: 1 a 5 em velocidade, aceleracao, controle, peso e turbo. MESMO NIVEL EM TODOS desde 31/10/2026 (pedido do
// Morassi: "o carro dourado esta muito rapido, esta impossivel de ganhar dele. Deixe todos os carros com o mesmo nivel, a ideia
// e que ganhe quem utilizar melhor os turbos e os poderes"). Antes cada carro tinha os seus, com soma 16 (fase 1: "cada um com
// atributos proprios"), e a soma fixa nao bastou: o Carro Dourado B7 (velocidade 5 = 42 m/s) de rival forte andava ~38 m/s ja
// na pista 1, mais do que a crianca com um carro de velocidade 2 ou 3 (33-36 m/s) conseguia de acelerador no fundo. Agora o
// carro escolhe a CARA e o PODER; quem ganha e quem usa melhor o turbo e o poder. O gera_config.mjs reprova carro diferente.
// O nivel: velocidade 4 (39 m/s: a corrida continua rapida), o resto 3 (o meio da tabela) — soma 16, e a
// curva para a crianca (inspecao item 9) fica ate mais folgada que com o Carro Vulcao de antes (velocidade 4, controle 2).
export const MESMO_NIVEL = Object.freeze({ velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 });

export const TABELA = [
  { id: 'vulcao', origem: 'vulcao.glb', fonte: 'lo', rodas: 'rodas', nome: 'Carro Vulcão', poder: 'terremoto',
    cor: '#ff5a1f', porqueCor: 'laranja da lava: matiz da lava da textura (#db7855, 16 graus) com saturacao cheia - o vermelho puro ficou com o Voador',
    atributos: MESMO_NIVEL,
    porque: 'hot rod de pedra e lava com rodas traseiras enormes; o terremoto combina com a rocha',
    descricao: 'Um carro de pedra e lava que faz a pista inteira tremer!' },
  { id: 'dourado', origem: 'dourado.glb', fonte: 'lo', rodas: 'rodas', nome: 'Carro Dourado B7', poder: 'escudo',
    espelha: { wheel3: 'wheel4' },   // a wheel3_lo nao tem o topo do pneu (36 cm de raio em cima contra 43 no resto): girando, pulava 3 cm
    cor: '#e2a328', porqueCor: 'dourado da lataria (20 % da area)',
    atributos: MESMO_NIVEL,
    porque: 'carro de corrida classico com aerofolio; o escudo dourado combina com a pintura',
    descricao: 'O carro de corrida dourado, protegido por um escudo brilhante.' },
  { id: 'lagartixa', origem: 'porsche.glb', fonte: 'lo', rodas: 'rodas', nome: 'Porsche 911 GT3 RS', poder: 'oleo',
    pops: 'esportivo', escapamento: { canos: [[0.065, 0.31, -2.26], [-0.065, 0.31, -2.26]] },   // SPECS.porsche (pops: true)
    cor: '#57c61c', porqueCor: 'verde-limao da lataria (15 % da area)',
    atributos: MESMO_NIVEL,
    porque: 'esportivo baixo verde-limao, colado no chao como lagartixa na parede; deixa a mancha de oleo para quem vem atras',
    descricao: 'Verde e baixinho, estala no escapamento. Quem vem atrás escorrega no óleo!' },
  { id: 'picole', origem: 'sorvete.glb', fonte: 'lo', rodas: 'rodas', nome: 'Carro de Sorvete', poder: 'congelante',
    cor: '#fd4d91', porqueCor: 'rosa da bola de sorvete do teto: o turquesa da lataria (#05b4c5) brigava com o azul do Tubarao',
    atributos: MESMO_NIVEL,
    porque: 'caminhao de sorvete alto com casquinha no teto; congelar e o poder obvio',
    descricao: 'O caminhão de sorvete que congela quem está na frente. Brrr!' },
  { id: 'buguinho', origem: 'buggy.glb', fonte: 'lo', rodas: 'rodas', nome: 'Buggy', poder: 'encolhedor',
    cor: '#eb7f43', porqueCor: 'laranja da fibra (#b46234, 9 %) com o brilho levantado para aparecer no HUD',
    atributos: MESMO_NIVEL,
    porque: 'bugue de praia laranja (a unica cor livre do grid), aberto e de rodas grandes; encolher os outros e a vinganca do pequeno. ' +
      'TROCA do Fuscao sugerido: o fusca.glb e BRANCO como o seal e a *_lo dele tem cacos pretos na lataria (UV antiga do mklod); o fusca_teto (vermelho) ' +
      'tem o forro claro da porta atravessando a lataria na *_lo (defeito de geometria: repintar a faixa pela malha cheia nao resolveu) e a malha cheia nao ' +
      'simplifica sem estragar a textura. O bugue de praia brasileiro nasce sobre chassi de Fusca: a ideia continua',
    descricao: 'O bugue laranja da praia que encolhe os adversários. Pequeno, mas valente!' },
  { id: 'kombosa', origem: 'kombi.glb', fonte: 'lo', rodas: 'rodas', nome: 'Kombi', poder: 'fumaca',
    cor: '#3bf1a6', porqueCor: 'verde-menta da lataria',
    atributos: MESMO_NIVEL,
    porque: 'Kombi hippie com olhos no para-brisa e arco-iris; a fumaca colorida e a cara dela',
    descricao: 'A Kombi paz e amor que solta uma nuvem de fumaça colorida.' },
  { id: 'tubarao', origem: 'shark.glb', fonte: 'alta', rodas: 'rodas', nome: 'Monster Truck Tubarão', poder: 'ima',
    cor: '#3d98d3', porqueCor: 'azul do tubarao',
    atributos: MESMO_NIVEL,
    porque: 'monster truck tubarao de rodas gigantes; o ima puxa quem esta perto como um tubarao puxa a presa',
    descricao: 'Um tubarão monstro com rodas gigantes que puxa todo mundo com o ímã!' },
  { id: 'voador', origem: 'yarisvoador.glb', fonte: 'lo', rodas: 'pods', pods: 'recolhidos', nome: 'Toyota GR Yaris Voador', poder: 'tornado',
    cor: '#d71517', porqueCor: 'vermelho da pintura de rali',
    atributos: MESMO_NIVEL,
    porque: 'carro de rali que flutua em quatro turbinas; o tornado e vento, combina com quem voa',
    descricao: 'Não tem rodas: voa! E ainda solta um tornado na pista.' },
  { id: 'faisca', origem: 'seal.glb', fonte: 'lo', rodas: 'rodas', nome: 'BYD Seal', poder: 'emp',
    cor: '#d7d6d3', porqueCor: 'branco perola da lataria (22 % da area)',
    atributos: MESMO_NIVEL,
    porque: 'sedan eletrico branco; o pulso eletrico (emp) da o choque em quem esta perto',
    descricao: 'O carro elétrico silencioso. Seu choque elétrico segura os rivais!' },
  { id: 'jatinho', origem: 'kart_jato.glb', fonte: 'lo', rodas: 'rodas', nome: 'Kart a Jato', poder: 'trocatroca',
    cor: '#2040d9', porqueCor: 'azul royal da carenagem (#122377) com o brilho levantado: o azul-marinho some no HUD escuro',
    atributos: MESMO_NIVEL,
    porque: 'kart com turbinas; o trocatroca troca de lugar com quem esta na frente, golpe de quem e pequeno e esperto',
    descricao: 'O kart a jato que troca de lugar com quem está na frente. Zum!' },

  // ---------------------------------------------------------------- 30/10/2026, pedido do Morassi: "coloque o Toyota Prius e os
  // carros com pops and bangs do jogo Cidade Aberta disponiveis para jogar". Os com pops sao os SPECS do cidadeaberta/js/carmodels.js
  // com `turbo` (pipoco na reducao) ou `pops` (o Porsche, que aqui ja estava: id lagartixa). Os `proStock` (os 7 de arrancada) entraram
  // e SAIRAM no dia seguinte (31/10/2026, pedido: "remover os carros pro stock"): ficam o Prius e os 8 de rua com turbo.
  // NOME (31/10/2026, pedido: "usar o mesmo nome do Cidade Aberta em todos os carros"): o `name` do SPECS de la, sem o emoji, em todos
  // os 19 - os 10 de antes tinham apelido (Vulcao, Lagartixa, Picole...). O `id` continua o de antes: o save guarda o carro pelo id.
  // ATRIBUTOS: o MESMO_NIVEL de todos (31/10/2026, cabecalho). A regra da curva para a crianca continua no gera_config.mjs
  // (velocidade 5 pede controle >= 3, velocidade 4 pede controle >= 2: js/pistas/inspecao.js raioDaCrianca).
  // PODER: 19 carros e 10 poderes, entao poder repete; nenhum poder novo.
  { id: 'prius', origem: 'prius.glb', fonte: 'lo', rodas: 'rodas', nome: 'Toyota Prius', poder: 'emp', timbre: 'eletrico',
    cor: '#e1ded4', porqueCor: 'branco perola da lataria (33 % somando os tons claros; o mesmo branco do Faisca)',
    atributos: MESMO_NIVEL,
    porque: 'hibrido (SPECS.prius hybrid, sem pops); o motor eletrico zune (o timbre do BYD Seal) e da o choque',
    descricao: 'O híbrido que zune baixinho e dá um choque elétrico nos rivais!' },
  { id: 'fusca_teto', origem: 'fusca_teto.glb', fonte: 'lo', rodas: 'rodas', nome: 'Fusca Teto Solar', poder: 'oleo',
    // a body_lo do Cidade Aberta tem o forro da porta atravessando a lataria (fase 1: por isso o Fusca ficou fora); refeita a partir da
    // pele de fora da malha cheia pelo tools/carros/refaz_lod.mjs (rode antes do otimiza: a copia fica em tools/carros/cache/)
    refeita: true,
    pops: 'turbo', escapamento: { canos: [[0.35, 0.137, -2.04], [0.255, 0.137, -2.04], [-0.265, 0.137, -2.04], [-0.35, 0.137, -2.04]] },   // SPECS.fuscaTeto
    cor: '#c60505', porqueCor: 'vermelho da lataria (40 % somando os tons)',
    atributos: MESMO_NIVEL,
    porque: 'o Fusca vermelho com turbo do Cidade Aberta: o turbo e a alma dele; Fusca velho vaza oleo',
    descricao: 'O Fusca turbinado: pipoca no escapamento e deixa óleo na pista!' },
  { id: 'voyage', origem: 'voyage.glb', fonte: 'lo', rodas: 'rodas', nome: 'VW Voyage', poder: 'escudo',
    pops: 'turbo', escapamento: { canos: [[0.47, 0.21, -2.03]] },   // SPECS.voyage
    cor: '#8b9aa9', porqueCor: 'azul-acinzentado da lataria (28 %)',
    atributos: MESMO_NIVEL,
    porque: 'sedan turbo de familia; o escudo combina com o carro de familia',
    descricao: 'O Voyage turbinado: estoura no escapamento e se protege com um escudo.' },
  { id: 'gol_gti', origem: 'gol_gti.glb', fonte: 'lo', rodas: 'rodas', nome: 'VW Gol GTI', poder: 'encolhedor',
    pops: 'turbo', escapamento: { canos: [[0.49, 0.215, -1.92]] },   // SPECS.golGti
    cor: '#fee768', porqueCor: 'amarelo-claro da lataria (21 %)',
    atributos: MESMO_NIVEL,
    porque: 'hatch pequeno com turbo do Cidade Aberta; encolher os outros e golpe de pequeno',
    descricao: 'Pequeno e bravo: pipoca no escapamento e encolhe os adversários!' },
  { id: 'hb20', origem: 'hb20.glb', fonte: 'lo', rodas: 'rodas', nome: 'Hyundai HB20 Turbo', poder: 'congelante',
    pops: 'turbo', escapamento: { canos: [[-0.22, 0.21, -1.97]] },   // SPECS.hb20
    cor: '#5c6470', porqueCor: 'preto da lataria (76 %) levantado para cinza-grafite: preto some no HUD escuro',
    atributos: MESMO_NIVEL,
    porque: 'hatch turbo do Cidade Aberta; congela quem esta na frente',
    descricao: 'O HB20 turbo: pipoca no escapamento e congela quem está na frente.' },
  { id: 'monza', origem: 'monza_prata.glb', fonte: 'lo', rodas: 'rodas', nome: 'Chevrolet Monza SL/E', poder: 'ima',
    pops: 'turbo', escapamento: { canos: [[0.4, 0.205, -2.2]] },   // SPECS.monzaPrata
    cor: '#a3a5aa', porqueCor: 'prata da lataria (25 %)',
    atributos: MESMO_NIVEL,
    porque: 'sedan grande dos anos 80 com turbo; o ima puxa os rivais como o carrao puxa o olhar',
    descricao: 'O Monza turbo: grandão, estoura no escapamento e puxa todo mundo com o ímã.' },
  { id: 'speedup', origem: 'speedup.glb', fonte: 'lo', rodas: 'rodas', nome: 'VW speed up! TSI', poder: 'trocatroca',
    pops: 'turbo', escapamento: { canos: [[-0.32, 0.19, -1.71]] },   // SPECS.speedup
    cor: '#ebebeb', porqueCor: 'branco da lataria (26 %; o teto e preto)',
    atributos: MESMO_NIVEL,
    porque: 'o menor carro do grid; troca de lugar com quem esta na frente, golpe de quem e pequeno e esperto',
    descricao: 'Pequenininho e esperto: estala no escapamento e troca de lugar com quem está na frente!' },
  { id: 'celta', origem: 'celta.glb', fonte: 'lo', rodas: 'rodas', nome: 'Chevrolet Celta', poder: 'tornado',
    pops: 'turbo', escapamento: { canos: [[-0.42, 0.2, -1.78]] },   // SPECS.celta
    cor: '#454c59', porqueCor: 'preto da lataria (58 %) levantado, mais escuro que o do HB20 para os dois nao virarem a mesma bolinha',
    atributos: MESMO_NIVEL,
    porque: 'popular com turbo; o tornado e vento, combina com o carrinho',
    descricao: 'O Celta turbinado: pipoca no escapamento e solta um tornado na pista!' },
  { id: 'furgao', origem: 'furgao.glb', fonte: 'lo', rodas: 'rodas', nome: 'Furgão', poder: 'fumaca', timbre: 'grave',
    espelha: { wheel2: 'wheel1', wheel4: 'wheel3' },   // as *_lo do lado esquerdo cortam o pneu (setor com 90-91 % do raio no confere.mjs)
    pops: 'turbo', escapamento: { canos: [[0.42, 0.22, -2.12], [0.58, 0.22, -2.12]] },   // SPECS.furgao
    cor: '#ebebeb', porqueCor: 'branco da lataria (45 %)',
    atributos: MESMO_NIVEL,
    porque: 'van turbo grandona do Cidade Aberta; a fumaca e a do escapamento',
    descricao: 'O furgão turbo: grandão, estoura no escapamento e solta uma nuvem de fumaça.' },
];

export const CARRO_PADRAO = 'vulcao';   // o do modelo de config pedido na fase 1

// medidas-alvo da normalizacao (m): s = min(4,2/comprimento, 2,3/largura, 2,6/altura) - todo carro cabe na mesma caixa,
// entao a colisao e a largura da faixa da pista valem para todos. Pedido da fase 1.
export const ALVO = { comprimento: 4.2, largura: 2.3, altura: 2.6 };
