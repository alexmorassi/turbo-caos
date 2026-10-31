// CARROS DO TURBO CAOS (fase 1). ARQUIVO GERADO por tools/carros/gera_config.mjs a partir de tools/carros/tabela.mjs
// (decisoes) e tools/carros/medidas.json (medido nos GLB pelo tools/carros/otimiza.mjs): nao edite a mao, edite a tabela.
//
// DE ONDE VEM CADA MODELO: os GLB do Cidade Aberta (Meshy, 12-22 MB, feitos para PC) viraram assets/cars/<id>.glb de 0,4 a
// 0,85 MB: malha leve *_lo do proprio Cidade Aberta (o Tubarao, que nao tem, e a malha cheia simplificada com meshopt), textura
// recortada da faixa do LOD em KTX2 (cor ETC1S sRGB, metal/rugosidade UASTC linear), geometria EXT_meshopt_compression.
// Todos normalizados: frente +Z, cima +Y, metros, x e z no centro da caixa, y = 0 no ponto mais baixo das rodas, escala
// uniforme s = min(4,2/comprimento, 2,3/largura, 2,6/altura) - cabem todos na mesma caixa de 4,2 x 2,3 x 2,6 m, entao a
// largura da pista e a colisao valem para qualquer um. Detalhe e fotos: docs/fases/fase1_carros.md, docs/fotos/carros*.png.
//
// HIERARQUIA DO GLB (o js/modelo_carro.js le assim): carro -> body (sem malha) -> body_malha; carro -> wheel1..4 (pivo sem
// malha no EIXO da roda, extras { radius, front, side }; 1/2 frente, 3/4 tras, side 1 = +X) -> wheelN_malha. Girar
// wheelN.rotation.x gira a roda no proprio eixo. Voador: sem wheel; pod0..3 filhos do body (extras { side, slide, aberto }).
//
// ATRIBUTOS: 1 a 5 em velocidade, aceleracao, controle, peso e turbo — o MESMO NIVEL em todos desde 31/10/2026 (pedido: "deixe todos
// os carros com o mesmo nivel, a ideia e que ganhe quem utilizar melhor os turbos e os poderes"; antes cada um tinha os seus, com soma
// 16, e o Carro Dourado B7 de velocidade 5 era impossivel de alcancar). O carro escolhe a cara e o poder (tools/carros/tabela.mjs).
// Os 10 primeiros tem um poder cada (os 10 de config/poderes.js); os 9 do Cidade Aberta de 30/10/2026 (o Prius e os carros de rua com
// pops and bangs) repetem poder. nome = o do Cidade Aberta em todos (31/10/2026; o id continua o de antes: o save guarda o id).
// cor = destaque do carro na interface, minimapa e rastro, tirada da pintura.
// pops = pops and bangs do Cidade Aberta (js/pipoco.js): 'turbo' estoura em cada reducao, 'esportivo' (o Porsche) tambem quando tira
// o pe embalado. escapamento.canos = boca de cada cano NO CARRO DAQUI (m, x = esquerda, y = cima, z = frente), dir = para onde a
// labareda sai (o x espelha pelo lado do cano).
// rodas.raio* = raio de CONTATO (do eixo ao ponto mais baixo do pneu, media das duas rodas do eixo), em metros.
// rodas.tem false = o jogo so inclina a carroceria; flutua = quanto ele pairava no Cidade Aberta (ja na escala nova).

export const CARROS = [
  // CARRO VULCAO: hot rod de pedra e lava com rodas traseiras enormes; o terremoto combina com a rocha
  { id: 'vulcao', nome: 'Carro Vulcão', modelo: 'assets/cars/vulcao.glb', origem: 'cidadeaberta/assets/vulcao.glb',
    cor: '#ff5a1f',            // laranja da lava: matiz da lava da textura (#db7855, 16 graus) com saturacao cheia - o vermelho puro ficou com o Voador
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'terremoto',
    medidas: { comprimento: 3.75, largura: 2.3, altura: 1.19 },  // escala 0.851 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.349, raioTras: 0.364 },
    descricao: 'Um carro de pedra e lava que faz a pista inteira tremer!',
    kb: 672, tris: 29596 },
  // CARRO DOURADO B7: carro de corrida classico com aerofolio; o escudo dourado combina com a pintura
  { id: 'dourado', nome: 'Carro Dourado B7', modelo: 'assets/cars/dourado.glb', origem: 'cidadeaberta/assets/dourado.glb',
    cor: '#e2a328',            // dourado da lataria (20 % da area)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'escudo',
    medidas: { comprimento: 4.19, largura: 2.3, altura: 1.68 },  // escala 1.163 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.384, raioTras: 0.429 },
    descricao: 'O carro de corrida dourado, protegido por um escudo brilhante.',
    kb: 451, tris: 22394 },
  // PORSCHE 911 GT3 RS: esportivo baixo verde-limao, colado no chao como lagartixa na parede; deixa a mancha de oleo
  // para quem vem atras
  { id: 'lagartixa', nome: 'Porsche 911 GT3 RS', modelo: 'assets/cars/lagartixa.glb', origem: 'cidadeaberta/assets/porsche.glb',
    cor: '#57c61c',            // verde-limao da lataria (15 % da area)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'oleo',
    medidas: { comprimento: 4.2, largura: 1.91, altura: 1.25 },  // escala 0.917 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.345, raioTras: 0.35 },
    pops: 'esportivo', escapamento: { canos: [[0.061, 0.288, -2.087], [-0.059, 0.288, -2.087]], dir: [0, 0, -1] },
    descricao: 'Verde e baixinho, estala no escapamento. Quem vem atrás escorrega no óleo!',
    kb: 484, tris: 23198 },
  // CARRO DE SORVETE: caminhao de sorvete alto com casquinha no teto; congelar e o poder obvio
  { id: 'picole', nome: 'Carro de Sorvete', modelo: 'assets/cars/picole.glb', origem: 'cidadeaberta/assets/sorvete.glb',
    cor: '#fd4d91',            // rosa da bola de sorvete do teto: o turquesa da lataria (#05b4c5) brigava com o azul do Tubarao
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'congelante',
    medidas: { comprimento: 3.25, largura: 2.3, altura: 2.31 },  // escala 0.622 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.233, raioTras: 0.225 },
    descricao: 'O caminhão de sorvete que congela quem está na frente. Brrr!',
    kb: 465, tris: 18597 },
  // BUGGY: bugue de praia laranja (a unica cor livre do grid), aberto e de rodas grandes; encolher os outros e a
  // vinganca do pequeno. TROCA do Fuscao sugerido: o fusca.glb e BRANCO como o seal e a *_lo dele tem cacos pretos na
  // lataria (UV antiga do mklod); o fusca_teto (vermelho) tem o forro claro da porta atravessando a lataria na *_lo
  // (defeito de geometria: repintar a faixa pela malha cheia nao resolveu) e a malha cheia nao simplifica sem estragar
  // a textura. O bugue de praia brasileiro nasce sobre chassi de Fusca: a ideia continua
  { id: 'buguinho', nome: 'Buggy', modelo: 'assets/cars/buguinho.glb', origem: 'cidadeaberta/assets/buggy.glb',
    cor: '#eb7f43',            // laranja da fibra (#b46234, 9 %) com o brilho levantado para aparecer no HUD
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'encolhedor',
    medidas: { comprimento: 4.2, largura: 2.23, altura: 1.74 },  // escala 1.172 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.42, raioTras: 0.445 },
    descricao: 'O bugue laranja da praia que encolhe os adversários. Pequeno, mas valente!',
    kb: 588, tris: 22395 },
  // KOMBI: Kombi hippie com olhos no para-brisa e arco-iris; a fumaca colorida e a cara dela
  { id: 'kombosa', nome: 'Kombi', modelo: 'assets/cars/kombosa.glb', origem: 'cidadeaberta/assets/kombi.glb',
    cor: '#3bf1a6',            // verde-menta da lataria
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'fumaca',
    medidas: { comprimento: 4.2, largura: 1.71, altura: 1.92 },  // escala 0.961 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.306, raioTras: 0.306 },
    descricao: 'A Kombi paz e amor que solta uma nuvem de fumaça colorida.',
    kb: 404, tris: 18992 },
  // MONSTER TRUCK TUBARAO: monster truck tubarao de rodas gigantes; o ima puxa quem esta perto como um tubarao puxa a
  // presa
  { id: 'tubarao', nome: 'Monster Truck Tubarão', modelo: 'assets/cars/tubarao.glb', origem: 'cidadeaberta/assets/shark.glb',
    cor: '#3d98d3',            // azul do tubarao
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'ima',
    medidas: { comprimento: 3.34, largura: 1.57, altura: 2.6 },  // escala 0.516 (limitada pela altura)
    rodas: { tem: true, raioFrente: 0.495, raioTras: 0.487 },
    descricao: 'Um tubarão monstro com rodas gigantes que puxa todo mundo com o ímã!',
    kb: 828, tris: 34779 },
  // TOYOTA GR YARIS VOADOR: carro de rali que flutua em quatro turbinas; o tornado e vento, combina com quem voa
  { id: 'voador', nome: 'Toyota GR Yaris Voador', modelo: 'assets/cars/voador.glb', origem: 'cidadeaberta/assets/yarisvoador.glb',
    cor: '#d71517',            // vermelho da pintura de rali
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'tornado',
    medidas: { comprimento: 4.2, largura: 2.22, altura: 1.34 },  // escala 1.049 (limitada pelo comprimento)
    rodas: { tem: false, flutua: 0.205, pods: 'recolhidos' },
    descricao: 'Não tem rodas: voa! E ainda solta um tornado na pista.',
    kb: 556, tris: 24796 },
  // BYD SEAL: sedan eletrico branco; o pulso eletrico (emp) da o choque em quem esta perto
  { id: 'faisca', nome: 'BYD Seal', modelo: 'assets/cars/faisca.glb', origem: 'cidadeaberta/assets/seal.glb',
    cor: '#d7d6d3',            // branco perola da lataria (22 % da area)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'emp',
    medidas: { comprimento: 4.2, largura: 1.92, altura: 1.3 },  // escala 0.885 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.312, raioTras: 0.316 },
    descricao: 'O carro elétrico silencioso. Seu choque elétrico segura os rivais!',
    kb: 516, tris: 22395 },
  // KART A JATO: kart com turbinas; o trocatroca troca de lugar com quem esta na frente, golpe de quem e pequeno e
  // esperto
  { id: 'jatinho', nome: 'Kart a Jato', modelo: 'assets/cars/jatinho.glb', origem: 'cidadeaberta/assets/kart_jato.glb',
    cor: '#2040d9',            // azul royal da carenagem (#122377) com o brilho levantado: o azul-marinho some no HUD escuro
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'trocatroca',
    medidas: { comprimento: 3.5, largura: 2.3, altura: 1.12 },  // escala 1.846 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.244, raioTras: 0.27 },
    descricao: 'O kart a jato que troca de lugar com quem está na frente. Zum!',
    kb: 662, tris: 26797 },
  // TOYOTA PRIUS: hibrido (SPECS.prius hybrid, sem pops); o motor eletrico zune (o timbre do BYD Seal) e da o choque
  { id: 'prius', nome: 'Toyota Prius', modelo: 'assets/cars/prius.glb', origem: 'cidadeaberta/assets/prius.glb',
    cor: '#e1ded4',            // branco perola da lataria (33 % somando os tons claros; o mesmo branco do Faisca)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'emp',
    medidas: { comprimento: 4.2, largura: 2, altura: 1.4 },  // escala 0.909 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.299, raioTras: 0.299 },
    timbre: 'eletrico',   // som do motor (js/audio.js CAMADAS)
    descricao: 'O híbrido que zune baixinho e dá um choque elétrico nos rivais!',
    kb: 422, tris: 22397 },
  // FUSCA TETO SOLAR: o Fusca vermelho com turbo do Cidade Aberta: o turbo e a alma dele; Fusca velho vaza oleo
  { id: 'fusca_teto', nome: 'Fusca Teto Solar', modelo: 'assets/cars/fusca_teto.glb', origem: 'cidadeaberta/assets/fusca_teto.glb',
    cor: '#c60505',            // vermelho da lataria (40 % somando os tons)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'oleo',
    medidas: { comprimento: 4.2, largura: 1.9, altura: 1.43 },  // escala 1.03 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.323, raioTras: 0.324 },
    pops: 'turbo', escapamento: { canos: [[0.361, 0.142, -2.097], [0.263, 0.142, -2.097], [-0.273, 0.142, -2.097], [-0.36, 0.142, -2.097]], dir: [0, 0, -1] },
    descricao: 'O Fusca turbinado: pipoca no escapamento e deixa óleo na pista!',
    kb: 392, tris: 22128 },
  // VW VOYAGE: sedan turbo de familia; o escudo combina com o carro de familia
  { id: 'voyage', nome: 'VW Voyage', modelo: 'assets/cars/voyage.glb', origem: 'cidadeaberta/assets/voyage.glb',
    cor: '#8b9aa9',            // azul-acinzentado da lataria (28 %)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'escudo',
    medidas: { comprimento: 4.2, largura: 1.87, altura: 1.3 },  // escala 1.01 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.282, raioTras: 0.282 },
    pops: 'turbo', escapamento: { canos: [[0.474, 0.213, -2.049]], dir: [0, 0, -1] },
    descricao: 'O Voyage turbinado: estoura no escapamento e se protege com um escudo.',
    kb: 427, tris: 23196 },
  // VW GOL GTI: hatch pequeno com turbo do Cidade Aberta; encolher os outros e golpe de pequeno
  { id: 'gol_gti', nome: 'VW Gol GTI', modelo: 'assets/cars/gol_gti.glb', origem: 'cidadeaberta/assets/gol_gti.glb',
    cor: '#fee768',            // amarelo-claro da lataria (21 %)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'encolhedor',
    medidas: { comprimento: 4.2, largura: 1.89, altura: 1.63 },  // escala 1.049 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.34, raioTras: 0.346 },
    pops: 'turbo', escapamento: { canos: [[0.515, 0.227, -2.014]], dir: [0, 0, -1] },
    descricao: 'Pequeno e bravo: pipoca no escapamento e encolhe os adversários!',
    kb: 496, tris: 23195 },
  // HYUNDAI HB20 TURBO: hatch turbo do Cidade Aberta; congela quem esta na frente
  { id: 'hb20', nome: 'Hyundai HB20 Turbo', modelo: 'assets/cars/hb20.glb', origem: 'cidadeaberta/assets/hb20.glb',
    cor: '#5c6470',            // preto da lataria (76 %) levantado para cinza-grafite: preto some no HUD escuro
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'congelante',
    medidas: { comprimento: 4.2, largura: 2.03, altura: 1.55 },  // escala 1.072 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.314, raioTras: 0.32 },
    pops: 'turbo', escapamento: { canos: [[-0.237, 0.227, -2.113]], dir: [0, 0, -1] },
    descricao: 'O HB20 turbo: pipoca no escapamento e congela quem está na frente.',
    kb: 454, tris: 23285 },
  // CHEVROLET MONZA SL/E: sedan grande dos anos 80 com turbo; o ima puxa os rivais como o carrao puxa o olhar
  { id: 'monza', nome: 'Chevrolet Monza SL/E', modelo: 'assets/cars/monza.glb', origem: 'cidadeaberta/assets/monza_prata.glb',
    cor: '#a3a5aa',            // prata da lataria (25 %)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'ima',
    medidas: { comprimento: 4.2, largura: 1.87, altura: 1.31 },  // escala 0.932 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.283, raioTras: 0.284 },
    pops: 'turbo', escapamento: { canos: [[0.374, 0.193, -2.051]], dir: [0, 0, -1] },
    descricao: 'O Monza turbo: grandão, estoura no escapamento e puxa todo mundo com o ímã.',
    kb: 496, tris: 23197 },
  // VW SPEED UP! TSI: o menor carro do grid; troca de lugar com quem esta na frente, golpe de quem e pequeno e esperto
  { id: 'speedup', nome: 'VW speed up! TSI', modelo: 'assets/cars/speedup.glb', origem: 'cidadeaberta/assets/speedup.glb',
    cor: '#ebebeb',            // branco da lataria (26 %; o teto e preto)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'trocatroca',
    medidas: { comprimento: 4.2, largura: 2.21, altura: 1.82 },  // escala 1.135 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.345, raioTras: 0.345 },
    pops: 'turbo', escapamento: { canos: [[-0.364, 0.217, -1.941]], dir: [0, 0, -1] },
    descricao: 'Pequenininho e esperto: estala no escapamento e troca de lugar com quem está na frente!',
    kb: 457, tris: 23194 },
  // CHEVROLET CELTA: popular com turbo; o tornado e vento, combina com o carrinho
  { id: 'celta', nome: 'Chevrolet Celta', modelo: 'assets/cars/celta.glb', origem: 'cidadeaberta/assets/celta.glb',
    cor: '#454c59',            // preto da lataria (58 %) levantado, mais escuro que o do HB20 para os dois nao virarem a mesma bolinha
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'tornado',
    medidas: { comprimento: 4.2, largura: 2, altura: 1.93 },  // escala 1.12 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.343, raioTras: 0.336 },
    pops: 'turbo', escapamento: { canos: [[-0.471, 0.225, -1.993]], dir: [0, 0, -1] },
    descricao: 'O Celta turbinado: pipoca no escapamento e solta um tornado na pista!',
    kb: 432, tris: 23198 },
  // FURGAO: van turbo grandona do Cidade Aberta; a fumaca e a do escapamento
  { id: 'furgao', nome: 'Furgão', modelo: 'assets/cars/furgao.glb', origem: 'cidadeaberta/assets/furgao.glb',
    cor: '#ebebeb',            // branco da lataria (45 %)
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 3, turbo: 3 },
    poder: 'fumaca',
    medidas: { comprimento: 4.2, largura: 2.04, altura: 1.91 },  // escala 0.99 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.328, raioTras: 0.322 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'turbo', escapamento: { canos: [[0.418, 0.221, -2.095], [0.577, 0.221, -2.095]], dir: [0, 0, -1] },
    descricao: 'O furgão turbo: grandão, estoura no escapamento e solta uma nuvem de fumaça.',
    kb: 418, tris: 18594 },
];

export const CARRO_PADRAO = 'vulcao';
