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
// Os 10 primeiros tem um poder cada (os 10 de config/poderes.js); os 16 do Cidade Aberta (30/10/2026: o Prius e os carros com pops and
// bangs) repetem poder. cor = destaque do carro na interface, minimapa e rastro, tirada da pintura.
// pops = pops and bangs do Cidade Aberta (js/pipoco.js): 'turbo' estoura em cada reducao, 'esportivo' (o Porsche) tambem quando tira
// o pe embalado, 'prostock' tudo isso com rajada longa, labareda maior e estouro na troca de marcha. escapamento.canos = boca de cada
// cano NO CARRO DAQUI (m, x = esquerda, y = cima, z = frente), dir = para onde a labareda sai (o x espelha pelo lado do cano).
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
    pops: 'esportivo', escapamento: { canos: [[0.061, 0.288, -2.087], [-0.059, 0.288, -2.087]], dir: [0, 0, -1] },
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
  // PRIUS: hibrido (SPECS.prius hybrid, sem pops): economiza, entao o turbo dura mais (turbo 5) e e o mais lento de
  // ponta; o motor eletrico zune (timbre do Faisca) e da o choque
  { id: 'prius', nome: 'Prius', modelo: 'assets/cars/prius.glb', origem: 'cidadeaberta/assets/prius.glb',
    cor: '#e1ded4',            // branco perola da lataria (33 % somando os tons claros; o mesmo branco do Faisca)
    atributos: { velocidade: 2, aceleracao: 3, controle: 4, peso: 2, turbo: 5 },
    poder: 'emp',
    medidas: { comprimento: 4.2, largura: 2, altura: 1.4 },  // escala 0.909 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.299, raioTras: 0.299 },
    timbre: 'eletrico',   // som do motor (js/audio.js CAMADAS)
    descricao: 'O híbrido que economiza: o turbo dura mais e o choque elétrico desliga os rivais!',
    kb: 422, tris: 22397 },
  // FUSCA TETO SOLAR: o Fusca vermelho com turbo do Cidade Aberta: velhinho e devagar de ponta, mas o turbo e a alma
  // dele; Fusca velho vaza oleo
  { id: 'fusca_teto', nome: 'Fusca Teto Solar', modelo: 'assets/cars/fusca_teto.glb', origem: 'cidadeaberta/assets/fusca_teto.glb',
    cor: '#c60505',            // vermelho da lataria (40 % somando os tons)
    atributos: { velocidade: 2, aceleracao: 3, controle: 3, peso: 3, turbo: 5 },
    poder: 'oleo',
    medidas: { comprimento: 4.2, largura: 1.9, altura: 1.43 },  // escala 1.03 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.323, raioTras: 0.324 },
    pops: 'turbo', escapamento: { canos: [[0.361, 0.142, -2.097], [0.263, 0.142, -2.097], [-0.273, 0.142, -2.097], [-0.36, 0.142, -2.097]], dir: [0, 0, -1] },
    descricao: 'O Fusca turbinado: pipoca no escapamento e deixa óleo na pista!',
    kb: 392, tris: 22128 },
  // VOYAGE: sedan turbo equilibrado (3 em tudo, turbo 4); o escudo combina com o carro de familia
  { id: 'voyage', nome: 'Voyage', modelo: 'assets/cars/voyage.glb', origem: 'cidadeaberta/assets/voyage.glb',
    cor: '#8b9aa9',            // azul-acinzentado da lataria (28 %)
    atributos: { velocidade: 3, aceleracao: 3, controle: 3, peso: 3, turbo: 4 },
    poder: 'escudo',
    medidas: { comprimento: 4.2, largura: 1.87, altura: 1.3 },  // escala 1.01 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.282, raioTras: 0.282 },
    pops: 'turbo', escapamento: { canos: [[0.474, 0.213, -2.049]], dir: [0, 0, -1] },
    descricao: 'O Voyage turbinado: estoura no escapamento e se protege com um escudo.',
    kb: 427, tris: 23196 },
  // GOL GTI: hatch pequeno com o turbo mais forte da rua no Cidade Aberta (turboBar 2): turbo 5, leve (peso 1);
  // encolher os outros e golpe de pequeno
  { id: 'gol_gti', nome: 'Gol GTI', modelo: 'assets/cars/gol_gti.glb', origem: 'cidadeaberta/assets/gol_gti.glb',
    cor: '#fee768',            // amarelo-claro da lataria (21 %)
    atributos: { velocidade: 3, aceleracao: 4, controle: 3, peso: 1, turbo: 5 },
    poder: 'encolhedor',
    medidas: { comprimento: 4.2, largura: 1.89, altura: 1.63 },  // escala 1.049 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.34, raioTras: 0.346 },
    pops: 'turbo', escapamento: { canos: [[0.515, 0.227, -2.014]], dir: [0, 0, -1] },
    descricao: 'Pequeno e bravo: turbo forte, pipoco no escapamento e encolhe os adversários!',
    kb: 496, tris: 23195 },
  // HB20 TURBO: o mais rapido de ponta entre os de rua no Cidade Aberta (vmax 67) e firme (controle 4); turbo fraco
  // (turboBar 0,6): turbo 3
  { id: 'hb20', nome: 'HB20 Turbo', modelo: 'assets/cars/hb20.glb', origem: 'cidadeaberta/assets/hb20.glb',
    cor: '#5c6470',            // preto da lataria (76 %) levantado para cinza-grafite: preto some no HUD escuro
    atributos: { velocidade: 4, aceleracao: 3, controle: 4, peso: 2, turbo: 3 },
    poder: 'congelante',
    medidas: { comprimento: 4.2, largura: 2.03, altura: 1.55 },  // escala 1.072 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.314, raioTras: 0.32 },
    pops: 'turbo', escapamento: { canos: [[-0.237, 0.227, -2.113]], dir: [0, 0, -1] },
    descricao: 'Rápido e firme na curva, pipoca no escapamento e congela quem está na frente.',
    kb: 454, tris: 23285 },
  // MONZA: sedan grande dos anos 80 com turbo: pesado (peso 4) e lento para sair; o ima puxa os rivais como o carrao
  // puxa o olhar
  { id: 'monza', nome: 'Monza', modelo: 'assets/cars/monza.glb', origem: 'cidadeaberta/assets/monza_prata.glb',
    cor: '#a3a5aa',            // prata da lataria (25 %)
    atributos: { velocidade: 3, aceleracao: 2, controle: 3, peso: 4, turbo: 4 },
    poder: 'ima',
    medidas: { comprimento: 4.2, largura: 1.87, altura: 1.31 },  // escala 0.932 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.283, raioTras: 0.284 },
    pops: 'turbo', escapamento: { canos: [[0.374, 0.193, -2.051]], dir: [0, 0, -1] },
    descricao: 'O Monza turbo: grandão, estoura no escapamento e puxa todo mundo com o ímã.',
    kb: 496, tris: 23197 },
  // SPEED UP!: o menor carro do grid: o mais agil (controle 5) e o mais leve; troca de lugar com quem esta na frente,
  // golpe de quem e pequeno e esperto
  { id: 'speedup', nome: 'speed up!', modelo: 'assets/cars/speedup.glb', origem: 'cidadeaberta/assets/speedup.glb',
    cor: '#ebebeb',            // branco da lataria (26 %; o teto e preto)
    atributos: { velocidade: 2, aceleracao: 4, controle: 5, peso: 1, turbo: 4 },
    poder: 'trocatroca',
    medidas: { comprimento: 4.2, largura: 2.21, altura: 1.82 },  // escala 1.135 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.345, raioTras: 0.345 },
    pops: 'turbo', escapamento: { canos: [[-0.364, 0.217, -1.941]], dir: [0, 0, -1] },
    descricao: 'Pequenininho e esperto: estala no escapamento e troca de lugar com quem está na frente!',
    kb: 457, tris: 23194 },
  // CELTA: popular leve com turbo: arranca bem e e facil de guiar; o tornado e vento, combina com o carro leve
  { id: 'celta', nome: 'Celta', modelo: 'assets/cars/celta.glb', origem: 'cidadeaberta/assets/celta.glb',
    cor: '#454c59',            // preto da lataria (58 %) levantado, mais escuro que o do HB20 para os dois nao virarem a mesma bolinha
    atributos: { velocidade: 2, aceleracao: 4, controle: 4, peso: 2, turbo: 4 },
    poder: 'tornado',
    medidas: { comprimento: 4.2, largura: 2, altura: 1.93 },  // escala 1.12 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.343, raioTras: 0.336 },
    pops: 'turbo', escapamento: { canos: [[-0.471, 0.225, -1.993]], dir: [0, 0, -1] },
    descricao: 'O Celta turbinado: pipoca no escapamento e solta um tornado na pista!',
    kb: 432, tris: 23198 },
  // FURGAO: van turbo de 1,5 t (a mais pesada do Cidade Aberta entre estes): peso 5 empurra todo mundo, devagar para
  // sair; a fumaca e a do escapamento
  { id: 'furgao', nome: 'Furgão', modelo: 'assets/cars/furgao.glb', origem: 'cidadeaberta/assets/furgao.glb',
    cor: '#ebebeb',            // branco da lataria (45 %)
    atributos: { velocidade: 2, aceleracao: 2, controle: 3, peso: 5, turbo: 4 },
    poder: 'fumaca',
    medidas: { comprimento: 4.2, largura: 2.04, altura: 1.91 },  // escala 0.99 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.328, raioTras: 0.322 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'turbo', escapamento: { canos: [[0.418, 0.221, -2.095], [0.577, 0.221, -2.095]], dir: [0, 0, -1] },
    descricao: 'O furgão turbo: grandão, empurra todo mundo e solta uma nuvem de fumaça.',
    kb: 418, tris: 18594 },
  // GOL PRO STOCK: o Pro Stock pequeno: arranca como os outros (aceleracao 5), mais leve (peso 1) e mais facil de guiar
  { id: 'gol_prostock', nome: 'Gol Pro Stock', modelo: 'assets/cars/gol_prostock.glb', origem: 'cidadeaberta/assets/gol_prostock.glb',
    cor: '#d30605',            // vermelho da pintura (14 % somando os tons; o resto e preto e cinza)
    atributos: { velocidade: 4, aceleracao: 5, controle: 3, peso: 1, turbo: 3 },
    poder: 'congelante',
    medidas: { comprimento: 4.2, largura: 1.71, altura: 1.38 },  // escala 0.927 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.291, raioTras: 0.294 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.798, 0.158, 0.741], [-0.797, 0.158, 0.741]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Gol de arrancada: sai como um foguete, solta labaredas e congela os rivais.',
    kb: 511, tris: 22795 },
  // MUSTANG PORTERS: Pro Stock de arrancada: o mais rapido e o que mais arranca do grid (5 e 5), aspirado (turbo 1); a
  // fumaca e a do burnout
  { id: 'mustang', nome: 'Mustang Porters', modelo: 'assets/cars/mustang.glb', origem: 'cidadeaberta/assets/mustang.glb',
    cor: '#b1331b',            // vermelho-ferrugem da pintura (34 %)
    atributos: { velocidade: 5, aceleracao: 5, controle: 3, peso: 2, turbo: 1 },
    poder: 'fumaca',
    medidas: { comprimento: 4.2, largura: 1.54, altura: 1.03 },  // escala 0.76 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.257, raioTras: 0.335 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.722, 0.189, 0.766], [-0.723, 0.189, 0.766]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Mustang de arrancada: solta labaredas e uma fumaceira de burnout!',
    kb: 513, tris: 23198 },
  // CAMARO SUMMIT: Pro Stock de arrancada, o mais leve deles; cada BANG do escapamento faz a pista tremer: o terremoto
  { id: 'camaro', nome: 'Camaro Summit', modelo: 'assets/cars/camaro.glb', origem: 'cidadeaberta/assets/camaro.glb',
    cor: '#1c3bb0',            // azul-marinho da pintura (#0a1a76, 34 %) com o brilho levantado: o marinho some no HUD escuro
    atributos: { velocidade: 5, aceleracao: 5, controle: 3, peso: 1, turbo: 2 },
    poder: 'terremoto',
    medidas: { comprimento: 4.2, largura: 1.53, altura: 0.99 },  // escala 0.83 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.263, raioTras: 0.35 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.713, 0.208, 0.687], [-0.715, 0.208, 0.687]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Camaro de arrancada: cada estouro do escapamento faz a pista tremer!',
    kb: 512, tris: 22995 },
  // MUSTANG LARANJA: Pro Stock mais pesado (peso 3), um pouco menos de arrancada; o tornado e o vento que ele deixa
  // para tras
  { id: 'mustang_laranja', nome: 'Mustang Laranja', modelo: 'assets/cars/mustang_laranja.glb', origem: 'cidadeaberta/assets/mustang_laranja.glb',
    cor: '#e76d2a',            // laranja da pintura (47 % somando os tons)
    atributos: { velocidade: 5, aceleracao: 4, controle: 3, peso: 3, turbo: 1 },
    poder: 'tornado',
    medidas: { comprimento: 4.2, largura: 1.56, altura: 0.94 },  // escala 0.777 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.252, raioTras: 0.332 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.736, 0.195, 0.719], [-0.739, 0.195, 0.719]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Mustang laranja de arrancada: labaredas no escapamento e um tornado na pista!',
    kb: 472, tris: 23398 },
  // CAMARO RAD: Pro Stock de arrancada com um pouco menos de ponta (velocidade 4); o ima puxa os rivais para perto das
  // labaredas
  { id: 'camaro_rad', nome: 'Camaro RAD', modelo: 'assets/cars/camaro_rad.glb', origem: 'cidadeaberta/assets/camaro_rad.glb',
    cor: '#c8141c',            // vermelho do letreiro RAD: a lataria e branca (33 %) e branco ja tem quatro
    atributos: { velocidade: 4, aceleracao: 5, controle: 3, peso: 2, turbo: 2 },
    poder: 'ima',
    medidas: { comprimento: 4.2, largura: 1.68, altura: 1.1 },  // escala 0.784 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.27, raioTras: 0.353 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.799, 0.197, 0.736], [-0.785, 0.197, 0.736]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Camaro RAD de arrancada: labaredas no escapamento e um ímã para puxar os rivais.',
    kb: 461, tris: 22993 },
  // CAMARO BANDEIRA: Pro Stock de arrancada com a bandeira na pintura; o escudo brilhante protege a pintura
  { id: 'camaro_bandeira', nome: 'Camaro Bandeira', modelo: 'assets/cars/camaro_bandeira.glb', origem: 'cidadeaberta/assets/camaro_bandeira.glb',
    cor: '#1e46b4',            // azul das estrelas da bandeira (#052884) com o brilho levantado
    atributos: { velocidade: 5, aceleracao: 4, controle: 3, peso: 2, turbo: 2 },
    poder: 'escudo',
    medidas: { comprimento: 4.2, largura: 1.6, altura: 0.89 },  // escala 0.774 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.219, raioTras: 0.305 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.749, 0.195, 0.822], [-0.752, 0.195, 0.822]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Camaro da bandeira: labaredas no escapamento e um escudo brilhante.',
    kb: 457, tris: 22998 },
  // CAMARO HOT WHEELS: Pro Stock de arrancada com a pintura de carrinho de brinquedo; troca de lugar com quem esta na
  // frente, como na pista de brinquedo
  { id: 'camaro_hotwheels', nome: 'Camaro Hot Wheels', modelo: 'assets/cars/camaro_hotwheels.glb', origem: 'cidadeaberta/assets/camaro_hotwheels.glb',
    cor: '#0a6ad8',            // azul da pintura (23 % somando os tons) com o brilho levantado
    atributos: { velocidade: 4, aceleracao: 5, controle: 2, peso: 2, turbo: 3 },
    poder: 'trocatroca',
    medidas: { comprimento: 4.2, largura: 1.66, altura: 1.05 },  // escala 0.782 (limitada pelo comprimento)
    rodas: { tem: true, raioFrente: 0.268, raioTras: 0.331 },
    timbre: 'grave',   // som do motor (js/audio.js CAMADAS)
    pops: 'prostock', escapamento: { canos: [[0.782, 0.196, 0.656], [-0.782, 0.196, 0.656]], dir: [0.862, -0.08, -0.501] },
    descricao: 'O Camaro de arrancada de brinquedo: solta labaredas e troca de lugar com quem está na frente!',
    kb: 465, tris: 22996 },
];

export const CARRO_PADRAO = 'vulcao';
