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
// REGRA DOS ATRIBUTOS: 1 a 5 em velocidade, aceleracao, controle, peso e turbo, SOMA 16 em todos - nenhum carro e melhor em
// tudo, a escolha vira estilo de corrida. Cada atributo tem pelo menos um carro com 5 (velocidade: Dourado; aceleracao:
// Faisca; controle: Lagartixa e Jatinho; peso: Picole e Tubarao; turbo: Voador). O peso decide quem empurra quem na batida.
// Um poder por carro (os 10 de config/poderes.js). cor = destaque do carro na interface, minimapa e rastro, tirada da pintura.
// rodas.raio* = raio de CONTATO (do eixo ao ponto mais baixo do pneu, media das duas rodas do eixo), em metros.
// rodas.tem false = o jogo so inclina a carroceria; flutua = quanto ele pairava no Cidade Aberta (ja na escala nova).

export const CARROS = [
  // VULCAO: hot rod de pedra e lava: rodas traseiras enormes (empurra muito), pesado e duro de virar; o terremoto
  // combina com a rocha
  { id: 'vulcao', nome: 'Vulcão', modelo: 'assets/cars/vulcao.glb', origem: 'cidadeaberta/assets/vulcao.glb',
    cor: '#ff5a1f',            // laranja da lava: matiz da lava da textura (#db7855, 16 graus) com saturacao cheia - o vermelho puro ficou com o Voador
    atributos: { velocidade: 4, aceleracao: 3, controle: 2, peso: 4, turbo: 3 },
    poder: 'terremoto',
    medidas: { comprimento: 3.75, largura: 2.3, altura: 1.19 },  // escala 0.851 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.349, raioTras: 0.364 },
    descricao: 'Um carro de pedra e lava que faz a pista inteira tremer!',
    kb: 672, tris: 29596 },
  // DOURADO B7: carro de corrida classico com aerofolio: a maior velocidade final do grid (velocidade 5); o escudo
  // dourado combina com a pintura e compensa o peso leve
  { id: 'dourado', nome: 'Dourado B7', modelo: 'assets/cars/dourado.glb', origem: 'cidadeaberta/assets/dourado.glb',
    cor: '#e2a328',            // dourado da lataria (20 % da area)
    atributos: { velocidade: 5, aceleracao: 3, controle: 3, peso: 2, turbo: 3 },
    poder: 'escudo',
    medidas: { comprimento: 4.19, largura: 2.3, altura: 1.68 },  // escala 1.163 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.384, raioTras: 0.429 },
    descricao: 'O carro de corrida dourado: rápido, firme e protegido por um escudo brilhante.',
    kb: 451, tris: 22394 },
  // LAGARTIXA: esportivo baixo verde-limao: gruda na curva como lagartixa na parede (controle 5); deixa a mancha de
  // oleo para quem vem atras
  { id: 'lagartixa', nome: 'Lagartixa', modelo: 'assets/cars/lagartixa.glb', origem: 'cidadeaberta/assets/porsche.glb',
    cor: '#57c61c',            // verde-limao da lataria (15 % da area)
    atributos: { velocidade: 3, aceleracao: 4, controle: 5, peso: 2, turbo: 2 },
    poder: 'oleo',
    medidas: { comprimento: 4.2, largura: 1.91, altura: 1.25 },  // escala 0.917 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.345, raioTras: 0.35 },
    descricao: 'Verde, baixinho e grudento nas curvas. Quem vem atrás escorrega no óleo!',
    kb: 484, tris: 23198 },
  // PICOLE: caminhao de sorvete alto com casquinha no teto: o mais pesado das rodas comuns, compensa com turbo;
  // congelar e o poder obvio
  { id: 'picole', nome: 'Picolé', modelo: 'assets/cars/picole.glb', origem: 'cidadeaberta/assets/sorvete.glb',
    cor: '#fd4d91',            // rosa da bola de sorvete do teto: o turquesa da lataria (#05b4c5) brigava com o azul do Tubarao
    atributos: { velocidade: 2, aceleracao: 2, controle: 3, peso: 5, turbo: 4 },
    poder: 'congelante',
    medidas: { comprimento: 3.25, largura: 2.3, altura: 2.31 },  // escala 0.622 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.233, raioTras: 0.225 },
    descricao: 'O caminhão de sorvete que congela quem está na frente. Brrr!',
    kb: 465, tris: 18597 },
  // BUGUINHO: bugue de praia laranja (a unica cor livre do grid), aberto e de rodas grandes: leve, arranca e pula bem;
  // encolher os outros e a vinganca do pequeno. TROCA do Fuscao sugerido: o fusca.glb e BRANCO como o seal e a *_lo
  // dele tem cacos pretos na lataria (UV antiga do mklod); o fusca_teto (vermelho) tem o forro claro da porta
  // atravessando a lataria na *_lo (defeito de geometria: repintar a faixa pela malha cheia nao resolveu) e a malha
  // cheia nao simplifica sem estragar a textura. O bugue de praia brasileiro nasce sobre chassi de Fusca: a ideia
  // continua
  { id: 'buguinho', nome: 'Buguinho', modelo: 'assets/cars/buguinho.glb', origem: 'cidadeaberta/assets/buggy.glb',
    cor: '#eb7f43',            // laranja da fibra (#b46234, 9 %) com o brilho levantado para aparecer no HUD
    atributos: { velocidade: 3, aceleracao: 4, controle: 4, peso: 2, turbo: 3 },
    poder: 'encolhedor',
    medidas: { comprimento: 4.2, largura: 2.23, altura: 1.74 },  // escala 1.172 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.42, raioTras: 0.445 },
    descricao: 'O bugue laranja da praia que encolhe os adversários. Pequeno, mas valente!',
    kb: 588, tris: 22395 },
  // KOMBOSA: Kombi hippie com olhos no para-brisa e arco-iris: van alta e pesada, turbo de "ladeira abaixo"; a fumaca
  // colorida e a cara dela
  { id: 'kombosa', nome: 'Kombosa', modelo: 'assets/cars/kombosa.glb', origem: 'cidadeaberta/assets/kombi.glb',
    cor: '#3bf1a6',            // verde-menta da lataria
    atributos: { velocidade: 2, aceleracao: 3, controle: 3, peso: 4, turbo: 4 },
    poder: 'fumaca',
    medidas: { comprimento: 4.2, largura: 1.71, altura: 1.92 },  // escala 0.961 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.306, raioTras: 0.306 },
    descricao: 'A Kombi paz e amor que solta uma nuvem de fumaça colorida.',
    kb: 404, tris: 18992 },
  // TUBARAO: monster truck tubarao: o mais pesado do grid (peso 5) e o mais lento para sair, rodas gigantes passam por
  // cima de tudo; o ima puxa quem esta perto como um tubarao puxa a presa
  { id: 'tubarao', nome: 'Tubarão', modelo: 'assets/cars/tubarao.glb', origem: 'cidadeaberta/assets/shark.glb',
    cor: '#3d98d3',            // azul do tubarao
    atributos: { velocidade: 3, aceleracao: 2, controle: 2, peso: 5, turbo: 4 },
    poder: 'ima',
    medidas: { comprimento: 3.34, largura: 1.57, altura: 2.6 },  // escala 0.516 (limitada pela altura)
    rodas: { tem: true, raioFrente: 0.495, raioTras: 0.487 },
    descricao: 'Um tubarão monstro com rodas gigantes que puxa todo mundo com o ímã!',
    kb: 828, tris: 34779 },
  // VOADOR: carro de rali que flutua em quatro turbinas: o maior turbo (5, as turbinas sao a cara dele), o mais leve
  // (peso 1, sai voando na batida) e escorrega na curva como hovercraft; o tornado e vento, combina com quem voa
  { id: 'voador', nome: 'Voador', modelo: 'assets/cars/voador.glb', origem: 'cidadeaberta/assets/yarisvoador.glb',
    cor: '#d71517',            // vermelho da pintura de rali
    atributos: { velocidade: 4, aceleracao: 3, controle: 3, peso: 1, turbo: 5 },
    poder: 'tornado',
    medidas: { comprimento: 4.2, largura: 2.22, altura: 1.34 },  // escala 1.049 (limitada pelo comprimento)
    rodas: { tem: false, flutua: 0.205, pods: 'recolhidos' },
    descricao: 'Não tem rodas: voa! E ainda solta um tornado na pista.',
    kb: 556, tris: 24796 },
  // FAISCA: sedan eletrico branco: eletrico arranca de uma vez (aceleracao 5); o pulso eletrico (emp) desliga o turbo e
  // o poder de quem esta perto
  { id: 'faisca', nome: 'Faísca', modelo: 'assets/cars/faisca.glb', origem: 'cidadeaberta/assets/seal.glb',
    cor: '#d7d6d3',            // branco perola da lataria (22 % da area)
    atributos: { velocidade: 4, aceleracao: 5, controle: 3, peso: 2, turbo: 2 },
    poder: 'emp',
    medidas: { comprimento: 4.2, largura: 1.92, altura: 1.3 },  // escala 0.885 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.312, raioTras: 0.316 },
    descricao: 'O carro elétrico mais arrancador da pista. Seu choque desliga os rivais!',
    kb: 516, tris: 22395 },
  // JATINHO: kart com turbinas: leve (peso 1) e o mais agil (controle 5); o trocatroca troca de lugar com quem esta na
  // frente, golpe de quem e pequeno e esperto
  { id: 'jatinho', nome: 'Jatinho', modelo: 'assets/cars/jatinho.glb', origem: 'cidadeaberta/assets/kart_jato.glb',
    cor: '#2040d9',            // azul royal da carenagem (#122377) com o brilho levantado: o azul-marinho some no HUD escuro
    atributos: { velocidade: 3, aceleracao: 4, controle: 5, peso: 1, turbo: 3 },
    poder: 'trocatroca',
    medidas: { comprimento: 3.5, largura: 2.3, altura: 1.12 },  // escala 1.846 (limitada pela largura)
    rodas: { tem: true, raioFrente: 0.244, raioTras: 0.27 },
    descricao: 'O kart a jato que troca de lugar com quem está na frente. Zum!',
    kb: 662, tris: 26797 },
];

export const CARRO_PADRAO = 'vulcao';
