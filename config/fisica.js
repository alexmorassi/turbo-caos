// FISICA DOS CARROS (fase 2). Todo numero de jogabilidade da fisica de arcade (js/carro.js, js/colisoes.js) mora aqui, com a origem
// ao lado. O modelo esta descrito no cabecalho de js/carro.js e em docs/fases/fase2_fisica.md; aqui so os numeros.
//
// ATRIBUTOS 1..5 (config/carros.js, fase 1) viram numeros pelas tabelas POR_ATRIBUTO (indice 0 = atributo 1). A soma dos atributos e
// fixa (16) em todos os carros: cada tabela tem de pesar parecido, senao um atributo vira "o que importa" e a escolha deixa de ser
// estilo de corrida. O atributo `turbo` nao entra aqui (e da fase 4: capacidade do turbo).
//
// PARA QUEM DESENHA PISTA (fase 3) — os numeros que decidem um SALTO:
//   * a crista marcada `lanca` lanca o carro com a velocidade que ele tem, so que ANGULO_EXTRA_DA_RAMPA (8 graus) mais para cima do
//     que o asfalto da crista ("o bico da rampa"); depois e balistica com G_AR = 20 m/s2.
//   * alcance em chao plano ~ v2 * sen(2a) / G_AR e tempo no ar ~ 2 v sen(a) / G_AR, com a = inclinacao da crista + 8 graus.
//     Crista de 10 graus (a = 18): 30 m/s -> 26 m e 0,9 s | 36 m/s -> 38 m e 1,1 s | 42 m/s -> 52 m e 1,3 s | turbo 47 -> 65 m.
//   * pista de teste (crista de ~4 graus, vao de 15 m, pouso 1 m abaixo): passa a partir de ~22 m/s; a 12 m/s cai (medido em
//     testes/teste_fisica.js). Um vao que so o turbo passa e um atalho de risco: deixe sempre um caminho sem vao.
//   * pousa quem chega ao asfalto ate TOLERANCIA_DE_POUSO (1 m) abaixo da borda do outro lado: "quase passou" passa (crianca).
//   * caiu (mais de QUEDA_ABAIXO = 3,5 m abaixo da pista, ou 4 s no ar): volta DEPOIS do buraco (ver RESPAWN_*).
// O LOOP (trecho `magnetico`) gruda o carro e garante VEL_MIN_NO_LOOP; a curva mais fechada que um carro de controle 3 faz na
// velocidade de referencia (36 m/s) tem RAIO 24 m; abaixo disso ele bate no muro de fora ou precisa frear/derrapar.

/** Indice da tabela de um atributo 1..5 (ausente ou fora da faixa = 3, o meio). */
export function indiceDoAtributo(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) - 1 : 2;
}

export const FISICA = {
  // ------------------------------------------------------------------ por atributo (indice 0 = atributo 1 ... 4 = atributo 5)
  POR_ATRIBUTO: {
    // m/s. Pedido: "velocidade maxima de arcade ~30-42 m/s" (108-151 km/h); o turbo da fase 4 multiplica por ~1,3.
    VEL_MAX: [30, 33, 36, 39, 42],
    // s para ir de 0 a 95 % da velocidade maxima numa reta plana. Pedido: "0 -> vMax em 4-6 s". A forca do motor e
    // A * (1 - u2) (u = v / vMax), entao u(t) = tanh(A t / vMax) e A = atanh(0,95) * vMax / t (js/carro.js parametrosDoCarro).
    TEMPO_ATE_95: [6.0, 5.5, 5.0, 4.5, 4.0],
    // m: raio da curva mais fechada com a direcao toda virada, a VEL_REFERENCIA. Pedido: "curvas de raio ~25 m em velocidade
    // maxima" -> 24 m no controle 3. Controle 5 faz a curva de 18 m da largada da pista de teste sem frear; controle 1 nao.
    RAIO_NA_REFERENCIA: [30, 27, 24, 21, 18],
    // 1/s: quanto o pneu "segura" o escorregamento de lado (vr -> 0 com exp(-k dt)). 9/s = 0,11 s de constante de tempo: o carro
    // aponta e vai; nos numeros menores ele escorrega um pouco mais na curva (carro pesado, "duro de virar").
    ADERENCIA: [7, 8, 9, 10.5, 12],
    // massa relativa (peso 1..5): decide quem empurra quem na batida entre carros e quanto se perde batendo no muro. Pedido:
    // "quem e mais pesado empurra mais e perde menos na batida". 1,45 / 0,75 ~ 2: o tubarao (5) empurra o jatinho (1) o dobro.
    MASSA: [0.75, 0.9, 1.0, 1.2, 1.45],
  },

  // ------------------------------------------------------------------ direcao
  VEL_REFERENCIA: 36,      // m/s: onde vale RAIO_NA_REFERENCIA (a vMax do meio da tabela). O raio e do PNEU, nao do carro: na mesma
                           // velocidade dois carros de mesmo controle viram igual; o mais rapido so precisa de mais espaco la no alto
  RAIO_MINIMO: 5.5,        // m: o raio de manobra parado/devagar (entre-eixos de ~2,6 m e 25 graus de roda)
  // raio(v) = RAIO_MINIMO + (raioRef - RAIO_MINIMO) * (v / VEL_REFERENCIA)^2 -> giro maximo = v / raio(v): ~1,8 rad/s a 20 m/s,
  // 1,5 rad/s a 36 m/s e 1,2 rad/s no turbo. E o "cai em alta velocidade para nao ficar nervoso" do pedido.
  GIRO_PARADO: 1.0,        // rad/s: quase parado e acelerando (ou de re), o carro ainda vira patinando — sem isto, encostado de bico
                           // num muro ou noutro carro ele nao gira nunca (o giro normal e v / raio: zero parado) e a crianca fica presa
  GIRO_PARADO_ATE: 4,      // m/s: acima disto vale so o giro normal
  VOLANTE_IDA: 7,          // 1/s: rampa do volante quando a crianca aperta (botao e digital: 0 -> 1 em ~0,3 s, sem tranco)
  VOLANTE_VOLTA: 14,       // 1/s: soltar ou inverter e rapido (atraso na volta e a receita do zigue-zague — cidadeaberta vehicles.js)

  // ------------------------------------------------------------------ ajuda na direcao do JOGADOR (js/assistencia.js; a IA nao usa)
  // 30/10/2026, o Morassi: "o carro esta virando demais e o jogador fica andando em zigue-zague; nem crianca nem adulto se mantem na
  // pista". O rumo psi nao volta sozinho nesta fisica (soltou, o carro segue torto ate o muro; na curva, solto, aponta para fora) e o
  // giro cheio a 36 m/s e 1,5 rad/s: todo toque pedia um contra-toque que passava do ponto. Medido em testes/teste_direcao.js.
  AJUDA: {
    // O DEDO PEDE UM ANGULO, NAO UM GIRO: arrastar = "ande torto para la", com no maximo ANGULO_MAX relativo a ESTRADA; solto = angulo
    // zero (paralelo a pista). Com o giro (o de antes) a posicao da crianca era a integral da integral do dedo e a correcao com atraso
    // de reacao passava do ponto (teste_direcao: a "crianca" batia de muro em muro); com o angulo, ela assenta.
    CURVA: 1,              // fracao do giro que a ESTRADA pede somada sozinha: solto, o carro faz a curva da pista
    SEGUE: 3.5,            // 1/s: rapidez com que o rumo de verdade (chi) chega no angulo pedido (~0,3 s)
    LATERAL_MAX: 8,        // m/s de lado com o dedo todo: o angulo maximo e asen(LATERAL_MAX / v) — 13 graus a 36 m/s, 24 a 20 m/s.
                           // Desviar de oleo, pegar a capsula do lado, entrar no atalho: 3-8 m em ~1 s. Mais que isso, quem corrige com
                           // atraso de reacao (0,3 s de crianca) passa do meio e bate do outro lado (teste_direcao, a "crianca")
    ANGULO_TETO: 0.75,     // rad (43 graus): devagar o angulo nao passa disto (manobra perto do muro)
    OLHA_A_FRENTE: 0.2,    // s: a curva e lida onde o carro vai estar (o volante leva ~0,15 s para chegar: VOLANTE_IDA)
    VEL_MIN: 6,            // m/s: abaixo disto, nenhuma ajuda (manobra, saida do muro, re)
    VEL_CHEIA: 12,         // m/s: a ajuda cresce de VEL_MIN ate aqui
    PSI_MAX: 1.0,          // rad (~57 graus): mais atravessado que isto (rodou, bateu) quem endireita e a crianca
    // TIRA O PE NA CURVA QUE NAO DA: o Vulcao (controle 2) faz no maximo 1,33 rad/s a 36 m/s e a primeira curva da Orla (raio 21-26 m)
    // pede 1,4-1,7: com o pe no fundo ele bate no muro de fora mesmo virando certo. Acima do teto da curva a frente a ajuda solta o
    // acelerador e freia de leve — nunca acelera pelo jogador, nunca antes de salto (VAO/LANCA ate SALTO_LIVRE m a frente: ele precisa
    // da velocidade) nem no loop (MAGNETICO: a fisica garante a velocidade minima).
    FRACAO_DA_CURVA: 0.9,  // fracao do volante que o teto supoe (sobra 10 % para o dedo corrigir)
    FREIO: 12,             // m/s2 do plano de frenagem (FREIO cheio da fisica = 22): freia cedo e macio
    OLHA_TETO: 0.25,       // s: o teto e lido onde o carro vai estar
    FREIO_MAX: 0.55,       // fracao do freio que a ajuda usa no maximo
    FREIO_POR_MS: 0.12,    // fracao do freio por m/s acima do teto
    SALTO_LIVRE: 70,       // m antes de VAO/LANCA sem teto
  },
  PERDA_NA_CURVA: 0.04,    // fracao do escorregamento tirado pelo pneu que vira perda de velocidade (o resto volta para a frente:
                           // "mantem o embalo"). Curva toda virada a 36 m/s custa ~2 m/s2: segurar a curva fechada e mais lento
  CONVERTE_ATE_GRAUS: 45,  // ate este angulo de escorregamento o pneu "devolve" o embalo para a frente; de lado (carro parado
                           // empurrado de lado) ele so freia: sem isto uma batida de lado viraria velocidade para a frente

  // ------------------------------------------------------------------ derrapagem (botao FREIO/DRIFT andando e virando, Ctrl no teclado)
  DRIFT_VEL_ENTRA: 11,     // m/s: abaixo disto o botao so freia (derrapar parado nao existe)
  DRIFT_VEL_SAI: 7,        // m/s: histerese (perdeu embalo no meio: sai da derrapagem)
  DRIFT_DIRECAO_MIN: 0.3,  // volante minimo para ENTRAR (o mesmo botao em linha reta e freio)
  DRIFT_ADERENCIA: 0.35,   // a traseira solta: k * 0,35 -> o carro atravessa ~25-30 graus
  DRIFT_GIRO: 1.4,         // e vira 40 % mais: a curva de 24 m vira de ~17 m — o porque de derrapar
  DRIFT_PERDA: 0.015,      // perde menos embalo por grau virado que a curva normal (derrapar bem e mais rapido)
  DRIFT_MOTOR: 0.6,        // o motor segue empurrando na derrapagem, mais fraco (cidadeaberta: "o carro NAO para")
  DRIFT_ANGULO_MAX: 42,    // graus: o carro atravessa ate aqui e segura (nao vira rodopio — cidadeaberta: "uns 35 graus")

  // ------------------------------------------------------------------ longitudinal
  FREIO: 22,               // m/s2 (2,2 g): de 36 m/s ate parar em 1,6 s
  RE_VEL: 7,               // m/s: re lenta (sair de um encosto no muro)
  RE_ACEL: 6,              // m/s2
  ROLAMENTO: 0.8,          // m/s2 sem acelerar (solta o acelerador e o carro desliza um bom pedaco)
  ARRASTO: 0.0016,         // 1/m: a v2 * ARRASTO sem acelerar (36 m/s -> 2,1 m/s2). Acelerando, quem segura e o (1 - u2) do motor
  DESACEL_ACIMA: 7,        // m/s2 no maximo, de volta para a vMax quando o turbo acaba (sem tranco)
  ACIMA_TAXA: 3,           // 1/s: acima da vMax o excesso cai na proporcao (com teto DESACEL_ACIMA). Na descida a rampa empurra e o
                           // carro passa ~G_RAMPA sen(a) / 3 da vMax (30 graus: +2 m/s) — "descer embala" sem virar foguete
  G_RAMPA: 12,             // m/s2: componente da gravidade na subida/descida (-G_RAMPA * frente.y). Um pouco mais que 9,8: em
                           // jogo a rampa tem de se sentir (subir freia, descer embala)
  VEL_TETO: 75,            // m/s: teto de seguranca (nada chega aqui jogando)

  // ------------------------------------------------------------------ chao especial (marcas da pista, js/pista.js MARCA)
  TERRA_VEL: 0.6,          // pedido: "TERRA limita a velocidade (~60%)" — o risco/recompensa do atalho de terra
  TERRA_DESACEL: 22,       // m/s2: entrou embalado na terra, ela segura (de 39 para 23 m/s em ~0,8 s: rapido, sem parede invisivel)
  TERRA_TAXA: 8,           // 1/s: o mesmo excesso proporcional do ACIMA_TAXA, mais forte
  TERRA_ADERENCIA: 0.7,    // e escorrega mais (cidadeaberta: SURF.dirt grip 0,55 — aqui menos, e arcade)
  IMPULSO_ACEL: 30,        // m/s2 enquanto em cima da seta e IMPULSO_TEMPO depois
  IMPULSO_VEL: 1.3,        // ate 1,3 x vMax (a mesma conta do turbo)
  IMPULSO_TEMPO: 0.6,      // s
  VEL_MIN_NO_LOOP: 18,     // m/s: pedido "velocidade minima garantida (~18 m/s) — crianca sempre completa o loop" (raio 10 m:
                           // 18 m/s dao 3,3 g de centripeta, o carro gruda com folga)

  // ------------------------------------------------------------------ muros
  MURO_RESTITUICAO: 0.25,  // pedido: "restituicao baixa" — o carro nao quica de volta para o meio da pista
  MURO_PERDA: 0.3,         // m/s de velocidade para a frente perdidos por m/s de pancada (de frente no muro perde muito; raspando, quase nada)
  MURO_ENDIREITA: 10,      // 1/s: o rumo vira para a parede enquanto encosta (desliza ao longo do muro em vez de grudar de bico)
  MURO_ENDIREITA_POR_MS: 0.08, // na PANCADA o rumo ja perde 8 % por m/s de pancada (10 m/s -> fica com ~20 % do angulo): a crianca
                           // bate torto e sai andando ao longo do muro, como num fliperama (com no maximo 85 % de correcao)
  MURO_FORCA_EVENTO: 2.5,  // m/s: abaixo disto e raspada, nao "batida" (nao conta, nao vibra)
  MURO_INTERVALO: 0.35,    // s entre dois eventos de batida no muro do mesmo carro (raspar o muro nao vira metralhadora de som)
  ALTURA_DO_MURO: 1.2,     // m: no ar abaixo disto o muro de verdade segura e devolve (pulinho na beira nao sai da pista)
  PAREDE_NO_AR: 30,        // m: acima do muro, onde a pista tem muro, uma parede INVISIVEL segura o carro no corredor (so tira a velocidade
                           // para fora, sem quicar). Medido nas pistas da fase 3: saindo 5-10 graus torto da rampa a 38 m/s o carro voava
                           // 1,5 s, passava por cima da linha do muro a 5 m de altura e caia fora (selva, gelo, neon). Sem muro (trecho de
                           // risco), nada segura: voar para fora ali e o risco do trecho

  // ------------------------------------------------------------------ no ar
  G_AR: 20,                // m/s2 (~2 g). Pedido: "forte o bastante para o salto nao ficar flutuante". Com 9,8 o carro de 4 m a
                           // 130 km/h parece em camera lenta (cidadeaberta usa 9,8 com carro bem mais lento)
  ANGULO_EXTRA_DA_RAMPA: 8,// graus: o "bico" da rampa (ver o cabecalho). 0 = so a velocidade que tem: a crista suave da pista de teste
                           // so seria vencida a 42+ m/s (medido) e o salto viraria uma lombada
  GIRO_NO_AR: 1.6,         // rad/s: pedido "pequeno controle no ar (girar o rumo)"
  CONTROLE_NO_AR: 0.25,    // fracao do giro no ar que tambem vira a trajetoria (a crianca acerta o pouso, mas nao faz curva voando)
  ALINHA_NO_AR: 2.2,       // 1/s: a carroceria vai apontando para onde o carro voa (bico desce na queda) e nivela o rolamento
  INCLINA_MAX_NO_AR: 0.6,  // rad: o bico nunca aponta mais que ~35 graus para cima/baixo
  TOLERANCIA_DE_POUSO: 1.0,// m (ver o cabecalho)
  RUMO_MAX_NO_POUSO: 0.6,  // rad: pousa no maximo 35 graus torto em relacao a para onde vai (crianca nao pousa de lado e para)
  QUEDA_ABAIXO: 3.5,       // m abaixo do asfalto: caiu (o chao do cenario fica ~3-4 m abaixo dos vaos)
  TEMPO_MAX_NO_AR: 4,      // s: pedido "mais de ~4 s no ar" = perdido
  JANELA_DE_BUSCA: 8,      // amostras (~8 m) da busca local da projecao no ar (o carro anda no maximo ~1,2 m por passo)

  // ------------------------------------------------------------------ voltar para a pista
  VEL_RESPAWN: 12,         // m/s. Pedido: "~12 m/s"
  FANTASMA: 1.5,           // s sem colisao, piscando. Pedido.
  RESPAWN_OLHA_FRENTE: 45, // m: se houver rampa/vao ate aqui na frente do ponto seguro, volta DEPOIS do buraco (12 m/s antes da
                           // rampa e cair de novo: a crianca ficaria presa num laco de queda). Como no kart, a queda custa o tempo
                           // da queda e a velocidade, nao o salto inteiro de novo
  RESPAWN_DEPOIS: 8,       // m depois do fim do vao

  // ------------------------------------------------------------------ atalhos (js/pista.js BOCA_DO_ATALHO)
  FUNIL_ATALHO: 30,        // m finais do atalho em que o carro e puxado de leve para a borda aberta (a boca de saida tem 12 m:
                           // quem segue reto pelo meio do atalho tambem sai na principal, sem bater no fim da tira)
  ACEL_FUNIL: 9,           // m/s2 de puxao lateral no fim do funil (cresce do zero)

  // ------------------------------------------------------------------ carro x carro (js/colisoes.js)
  COLISAO_RESTITUICAO: 0.3,   // pedido: "restituicao baixa" — bater nao e bilhar
  COLISAO_SEPARA_LADO: 2.4,   // m/s minimos de afastamento numa batida de LADO: "toc!" e cada um para o seu lado, nunca grudados
  COLISAO_SEPARA_FRENTE: 1.0, // m/s minimos numa batida de traseira (quem bate atras perde, quem leva ganha um empurraozinho)
  COLISAO_FORCA_EVENTO: 1.5,  // m/s de aproximacao abaixo dos quais e so encostar (nao conta batida, nao faz som)
  COLISAO_INTERVALO: 0.3,     // s entre dois eventos do mesmo par
  COLISAO_RAIO: 0.25,         // raio da esfera (no ar ou em tiras diferentes) = 0,25 x (comprimento + largura) ~ 1,6 m

  // ------------------------------------------------------------------ efeitos dos poderes (fase 4 chama; tempos vem dela)
  RODOPIO_VOLTAS: 2,       // voltas INTEIRAS: o rodopio termina olhando para onde o carro ia (meia volta deixaria a crianca de costas)
  RODOPIO_FREIO: 1.6,      // 1/s: perde ~75 % da velocidade num rodopio de 1,4 s (Mancha de Oleo)
  RODOPIO_ADERENCIA: 0.12, // o carro escorrega enquanto roda (segue mais ou menos na direcao em que vinha)
  GELO_FREIO: 3.0,         // 1/s: "parado no gelo, desacelera forte" — de 36 m/s a ~2 m/s em 1 s
  GELO_POR_TOQUE: 0.3,     // s tirados do gelo a cada toque no PODER (quebraGelo)
  TORNADO_ALTURA: 3,       // m. Pedido: "sobe ~3 m girando e cai"
  TORNADO_VOLTAS: 2,       // voltas inteiras no ar (termina olhando para onde ia)
  TORNADO_FREIO: 1.2,      // 1/s de perda de velocidade enquanto esta no tornado
  LARGADA_TURBO: 9,        // m/s de empurrao para quem acelera (ou aperta o TURBO) bem no VAI
  LARGADA_JANELA_ANTES: 0.35, // s antes do VAI que ainda valem
  LARGADA_JANELA_DEPOIS: 0.2, // s depois do VAI que ainda valem
};
