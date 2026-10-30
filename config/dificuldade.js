// IA DOS PILOTOS E DIFICULDADE (fase 5). Todo numero de jogabilidade de js/ia.js e js/dificuldade.js mora aqui, com a origem ao lado.
// Como a IA pensa e como a dificuldade anda estao nos cabecalhos dos dois modulos e em docs/fases/fase5_ia.md; aqui so os numeros.
//
// TRES CAMADAS, uma por cima da outra (todas so nos RIVAIS; o jogador no piloto automatico dos testes tem o perfil fixo PILOTO_AUTO):
//   1. BASE GRADUAL pela ordem da pista no campeonato (1..10): a curva do Breno (referencias/breno/js/difficulty.js: lerp de [inicio,
//      fim] por ((ordem - 1) / 9) ^ CURVA). Sobe ritmo, habilidade, agressividade, precisao e uso de poder.
//   2. DDA (dificuldade adaptativa): um FATOR de 0,85 a 1,15 por pista, guardado em G.save('dda'), que anda devagar entre as corridas
//      (perdeu 2 seguidas na mesma pista: alivia; venceu com folga: aperta). O fator multiplica a camada 1.
//   3. ELASTICO (rubber band) leve dentro da corrida: quem esta muito a frente do jogador perde um pouco, quem esta muito atras ganha
//      um pouco — teto pequeno, suavizado, nunca mais rapido que o turbo deixaria.

/** Interpolacao de uma faixa [inicio, fim] da base pela ordem da pista (1..10). Exportada: as suites usam a mesma conta. */
export function curvaDaBase(ordem, faixa, curva = DIFICULDADE.CURVA) {
  const o = Math.min(10, Math.max(1, Math.round(Number(ordem) || 1)));
  const t = Math.pow((o - 1) / 9, curva);
  return faixa[0] + (faixa[1] - faixa[0]) * t;
}

export const DIFICULDADE = {
  // ------------------------------------------------------------------ 1. base gradual (pista 1 = [0], pista 10 = [1])
  CURVA: 1.2,                  // expoente da curva (Breno: LEVEL_CURVE 1,35 em 10 fases). Um pouco mais reto aqui: o campeonato inteiro
                               // tem so 10 corridas e a pista 2 ja precisa ser diferente da 1
  BASE: {
    // multiplicador da vMax dos rivais (mod.velMax). Pista 1 = 87 %: crianca de 6 anos com aceleracao automatica, batendo nas curvas,
    // anda ~15-20 % abaixo do piloto perfeito (medido com o piloto da suite da fisica: o pior caso do muro custa ~10 %). Pista 10 = 99 %:
    // a final e disputada de igual para igual
    ritmo: [0.87, 0.99],
    aceleracao: [0.88, 1.0],   // multiplicador do motor (mod.acel): a largada dos rivais na pista 1 e mais mole
    habilidade: [0.40, 0.88],  // 0..1: linha, ponto de freada, derrapagem, atalho, tempo de reacao
    agressividade: [0.25, 0.85],// 0..1: briga por posicao (ultrapassa mais colado, mira poder em quem esta perto)
    precisao: [0.50, 0.92],    // 0..1: 1 - tamanho dos "erros humanos" (desvio da linha, freada cedo/tarde)
    usoDePoder: [0.30, 0.85],  // 0..1: vontade de usar o poder quando a heuristica da fase 4 diz que da
  },
  // Pista sem ordem (a de teste das suites, ordem 0) usa a base da pista 1.

  // ------------------------------------------------------------------ papeis entre os rivais (pedido: "o rival forte e os medianos")
  // O rival FORTE e quem larga na pole (o primeiro da grade): a crianca ve o adversario a cacar desde a largada. O FRACO e o ultimo dos
  // rivais na grade. Os outros sao medianos com um sorteio pequeno (G.sorteio, semente da corrida) para nao andarem em fila indiana.
  PAPEIS: {
    forte: { ritmo: 0.035, habilidade: 0.12, precisao: 0.08, agressividade: 0.12, usoDePoder: 0.08 },
    mediano: { ritmo: 0, habilidade: 0, precisao: 0, agressividade: 0, usoDePoder: 0 },
    fraco: { ritmo: -0.03, habilidade: -0.10, precisao: -0.08, agressividade: -0.10, usoDePoder: -0.05 },
  },
  SORTEIO_MEDIANO: { ritmo: 0.015, habilidade: 0.06, precisao: 0.05, agressividade: 0.10, usoDePoder: 0.10 }, // +- por rival mediano

  // ------------------------------------------------------------------ 2. DDA entre corridas (fator por pista, G.save 'dda')
  DDA: {
    MIN: 0.85, MAX: 1.15,      // pedido: "FATOR de 0,85 a 1,15"
    INICIAL: 1.0,
    PASSO_MAX: 0.06,           // mudanca maxima do fator numa corrida so (pedido: "mudanca SUAVE entre corridas")
    PODIO: 3,                  // derrota = fora do podio (o mesmo PODIO_DESBLOQUEIA de js/jogo.js: e o "ganhei" da crianca)
    DERROTAS_PARA_ALIVIAR: 2,  // pedido: "perdeu 2 vezes seguidas na mesma pista -> reduz um pouco"
    ALIVIO: 0.05,              // quanto reduz a cada derrota a partir da segunda seguida
    ALIVIO_ULTIMO: 0.02,       // a mais quando chegou em ultimo (a crianca nem viu os outros)
    FOLGA_S: 3.0,              // s de vantagem sobre o 2o para "venceu com folga" (3 s = ~100 m: a crianca cruza sozinha)
    APERTO_FOLGA: 0.05,        // venceu com folga: aumenta
    APERTO_VITORIA: 0.02,      // venceu apertado: aumenta pouco (a proxima continua disputada)
    MUITAS_BATIDAS: 6,         // batidas por volta acima disto (muro + carro) e sem vencer: alivia um pouco a mais
    ALIVIO_BATIDAS: 0.015,
    RITMO_SOBRA: 0.04,         // melhor volta do jogador 4 % mais rapida que a mediana dos rivais: aperta um pouco (passeio)
    APERTO_RITMO: 0.015,
    PESO_GLOBAL: 0.5,          // o fator GLOBAL (pista nunca corrida comeca nele) anda a metade do passo da pista
    HISTORICO: 6,              // ultimas corridas guardadas por pista (legivel para o HUD/teste)
    // como o fator vira IA: multiplicadores = 1 + (fator - 1) * PESO_*
    PESO_RITMO: 0.5,           // 1,15 -> vMax dos rivais +7,5 %; 0,85 -> -7,5 %
    PESO_ACELERACAO: 0.6,
    PESO_HABILIDADE: 1.0,      // habilidade e precisao em escala cheia (0,85 -> erros maiores, freada mais cedo)
    PESO_PRECISAO: 1.0,
    PESO_AGRESSIVIDADE: 1.2,
    PESO_USO_DE_PODER: 1.5,    // crianca perdendo leva bem menos poder na cabeca
  },

  // ------------------------------------------------------------------ 3. elastico (rubber band) dentro da corrida
  ELASTICO: {
    ZONA_MORTA: 50,            // m de distancia ao jogador (pelo progresso) sem nenhum efeito: briga de perto e briga de verdade
    PLENO: 350,                // m: a partir daqui o efeito e o teto
    TETO_FREIA: 0.06,          // quem esta muito a frente perde ate 6 % da vMax
    TETO_ACELERA: 0.04,        // quem esta muito atras ganha ate 4 % (menor que o freio: a crianca nunca e "cacada" por um foguete)
    TAU: 3.0,                  // s: suavizacao (exponencial) — o efeito entra e sai em ~3 s, nunca de um passo para o outro
    TETO_TOTAL: 1.06,          // multiplicador TOTAL da vMax de um rival (base x DDA x elastico) nunca passa disto; o turbo da fase 4
                               // multiplica por ~1,3: o rival nunca fica mais rapido do que o proprio turbo deixaria
    PISO_TOTAL: 0.72,
    ULTIMA_VOLTA: 0.5,         // na ultima volta o elastico cai para a metade (a chegada e decidida na pista, nao na conta)
  },
};

/** Perfil do jogador no piloto automatico (?auto=1 e a festa depois da chegada): BOM, sem erro, sem DDA nem elastico. E ele que faz as
 *  corridas completas da bateria. */
export const PILOTO_AUTO = { habilidade: 1, agressividade: 0.5, precisao: 1, usoDePoder: 0.7, ritmo: 1, aceleracao: 1, papel: 'auto' };

export const IA = {
  // ------------------------------------------------------------------ linha de corrida (K1999 de Remi Coulom, ver js/ia.js)
  LINHA: {
    PASSO: 4,                  // m entre os pontos da grade grossa (curvatura por diferenca finita de 4 m e estavel; 1 m e ruido)
    ESCALAS: [16, 8, 4, 2, 1], // vizinhos a 64, 32, 16, 8 e 4 m: do grosso para o fino (multigrade: converge em poucas varreduras)
    VARREDURAS: 60,            // por escala
    RELAXA: 0.6,               // passo de Newton amortecido (1 oscila nas chicanes)
    SUAVIZA: 2,                // amostras de media movel na curvatura final (tira o serrilhado da spline de 1 m)
  },
  MARGEM_MURO: 2.6,            // m do centro do carro ate a borda com muro: meia largura (1,15) + o canto rodado no rumo (~0,35) + o erro
                               // de seguir a linha (~0,5 m medio). Medido nas 10 pistas, volta solo: 2,0 -> 14 batidas, 2,3 -> 4, 2,6 -> 1;
                               // o tempo de volta nao muda (502,3 -> 502,8 s na soma: quase toda curva do jogo e de pe embaixo)
  MARGEM_SEM_MURO: 3.2,        // sem muro (cair e perder 3 s): mais folga
  MARGEM_BOCA: 2.9,            // borda aberta de boca de atalho que o carro NAO quer pegar (passar dela troca de tira)
  SALTO_ANTES: 45,             // m antes da crista em que a linha fica no meio e reta (sair torto da rampa e pousar fora)
  SALTO_DEPOIS: 10,            // m depois do pouso, idem
  MEIA_FAIXA_DO_SALTO: 1.2,    // m: |d| maximo da linha nesse trecho

  // ------------------------------------------------------------------ velocidade (plano)
  VEL_TETO_PLANO: 80,          // m/s: "sem limite de curva" (acima de qualquer turbo)
  VEL_MIN_PLANO: 9,            // m/s: nenhuma curva do jogo pede menos (abaixo disto o carro nao derrapa nem embala)
  FRACAO_VOLANTE: [0.74, 0.9], // parte do volante que o plano usa, por habilidade (o resto e reserva para corrigir)
  FREIO_PLANO: [0.5, 0.78],    // fracao de FISICA.FREIO (22 m/s2) que o plano conta para frear antes da curva, por habilidade
  CURVA_RITMO: [0.93, 1.0],    // multiplicador da velocidade de curva, por habilidade (o mediano entra um pouco mais devagar)
  AVANCO_PERFIL: 0.12,         // s: a velocidade-alvo e lida um pouco a frente (o motor e o freio levam um tempo)
  FOLGA_SALTO: 1.1,            // x a velocidade minima do salto (simulada na carga: o mesmo G_AR e o mesmo bico de 8 graus da fisica)
  PISO_SALTO_ANTES: 70,        // m antes da crista em que o plano nao deixa frear abaixo do piso do salto

  // ------------------------------------------------------------------ direcao (Stanley em coordenadas da pista, ver js/ia.js)
  AVANCO_LINHA: 0.08,          // s: o angulo e o erro da linha sao lidos um pouco a frente (atraso do volante)
  GANHO_LATERAL: 2.2,          // 1/s: erro lateral -> angulo, atan(k e / (v + v0)). Medido nas 10 pistas, volta solo: 1,5 e 2,2 iguais
                               // (0,44-0,49 m de erro medio); 3,5 oscila (42 batidas em vez de 6)
  VEL_LATERAL: 3,              // m/s: o v0 (devagar o ganho nao explode)
  GANHO_RUMO: 3.4,             // 1/s: erro de angulo da velocidade -> giro (o piloto da suite da fisica usa 3 no rumo)
  AVANCO_CURVA: 0.2,           // s: a curvatura da alimentacao direta e lida a frente (volante 7/s + pneu 9/s: ~0,25 s de atraso)
  DELTA_CURVA: 4,              // m: diferenca finita da curvatura do alvo lateral
  SATURA_FREIA: 7,             // m/s de velocidade-alvo a menos por unidade de volante pedido alem do maximo (nao faz a curva: freia)
  SATURA_VEL: 12,              // m/s: abaixo disto o raio de giro ja e pequeno (5,5 m parado) e frear nao ajuda a virar

  // ------------------------------------------------------------------ derrapagem (so quem tem habilidade)
  DERRAPA_HABILIDADE: 0.6,     // habilidade minima para derrapar de proposito
  DERRAPA_ENTRA: 0.92,         // volante pedido (fracao do maximo sem derrapar) para entrar na derrapagem
  DERRAPA_SAI: 0.5,            // ... e para sair (histerese)
  DERRAPA_VEL_MIN: 16,         // m/s (a fisica so entra acima de 11; abaixo de 16 derrapar nao ganha nada)
  DERRAPA_RAIO: 40,            // m: so derrapa quando a LINHA curva mais fechado que isto (cotovelo, grampo)
  DERRAPA_FORA_DA_LINHA: 1.5,  // m: fora da linha mais que isto nao entra na derrapagem

  // ------------------------------------------------------------------ outros carros, perigos e capsulas
  FOLGA_LATERAL: [1.1, 0.6],   // m entre as laterais na ultrapassagem, por agressividade (agressivo passa mais colado)
  ALCANCE_CARRO: 14,           // m minimos de olhar para o carro da frente (+ 0,45 s de velocidade + 2,5 s de aproximacao)
  SEGUE_DIST: [5, 2.5],        // m de para-choque a para-choque atras do carro da frente quando nao da para passar, por agressividade
  SEGUE_PASSANDO: 0.6,         // fracao dessa distancia enquanto troca de faixa para passar (chega mais perto, mas nao bate)
  SEGUE_GANHO: 1.2,            // 1/s: m/s de velocidade-alvo por m de distancia a mais ou a menos (fecha a distancia em ~1 s)
  DESVIO_TAXA: 5,              // m/s maximos de mudanca do alvo de desvio (sem tranco)
  DESVIO_ENTRA: 3,             // 1/s: peso do desvio subindo
  DESVIO_SAI: 1.2,             // 1/s: e descendo (volta para a linha devagar)
  ALCANCE_PERIGO: [35, 65],    // m de olhar para oleo/fumaca/tornado, por habilidade (o mediano ve tarde)
  FOLGA_PERIGO: 1.2,           // m alem do raio do perigo + meia largura
  AMEACA_ATRAS: 45,            // m: raio congelante / tornado vindo por tras na faixa do carro, ate esta distancia
  ESQUIVA: [0.15, 0.8],        // chance de ver e esquivar a ameaca de tras, por habilidade (a crianca tambem nem sempre ve)
  ALCANCE_CAPSULA: 70,         // m
  CAPSULA_MIN: 8,              // m: mais perto que isto nao da mais tempo de desviar
  CAPSULA_ANGULO: 0.28,        // |d da capsula - linha| <= 0,28 x distancia (~16 graus): pega sem atravessar a pista
  CAPSULA_DOURADA: 0.4,        // a dourada vale um desvio maior
  CAPSULA_TURBO_CHEIO: 0.95,   // carga acima disto: capsula comum nao vale o desvio
  CAPSULA_A_CADA: 6,           // passos entre duas consultas de capsulas por carro (e entre duas conferidas do caminho ate ela)
  CAPSULA_VIZINHO: 6,          // m para tras que ainda contam como "do lado" no caminho ate a capsula
  PREVE_ATE: 1.5,              // s: ate quanto a frente se preve onde o carro da frente vai estar (ele segue a linha dele)
  SEGURA_A_FRENTE: 6,          // m a frente em que se olha para onde a linha leva quando ha alguem do lado

  // ------------------------------------------------------------------ atalhos
  ATALHO_DECIDE: [160, 90],    // m antes da boca: a decisao e tomada uma vez por volta, entre estas distancias
  ATALHO_PREPARA: 110,         // m antes da boca em que o carro comeca a ir para o mergulho
  ATALHO_ARCO: 28,             // m do arco que leva o rumo de 0 a ATALHO_RAMPA (curvatura maxima 1,5 x 0,3 / 28: raio de 62 m, cabe a
                               // qualquer velocidade); antes dele o alvo sai da linha para o meio da pista
  ATALHO_VEL: 37,              // m/s maximos no mergulho (a 45 m/s com turbo o carro se atrasa na reta e cruza depois do fim da boca)
  ATALHO_RAMPA: 0.3,           // inclinacao da reta do mergulho (17 graus): com ela o canto do carro nao toca o muro no comeco da boca
                               // (carro de 4,2 x 2,3 m rodado 0,3 rad: 2,1 sen + 1,15 cos = 1,72 m; a reta passa a 2,55 m da borda) e ainda
                               // cruza dentro da boca quem se atrasa ate 1,2 m: a janela e [-1,2; +0,8] m em volta da reta
  ATALHO_CRUZA_EM: 8.5,        // m depois do comeco da boca de 12 m em que o meio do carro cruza a borda
  ATALHO_ALEM: 25,             // m depois da boca em que a reta do mergulho continua no alvo (senao a curvatura do alvo ve um degrau)
  ATALHO_SAIDA: 60,            // m antes do fim do atalho em que o carro comeca o mergulho para a borda de saida
  ATALHO_BASE: 0.2,            // chance base de pegar
  ATALHO_VANTAGEM: 0.12,       // + por segundo de vantagem estimada (pelo perfil de velocidade do proprio carro)
  ATALHO_CHANCE: [0.03, 0.85], // a chance nunca passa destes limites (nem o melhor pega sempre: corrida nao e trilho)
  ATALHO_HABILIDADE: 0.5,      // + (habilidade - 0,5) x isto
  ATALHO_ATRAS: 0.25,          // + se esta na metade de tras da corrida (pedido: "atalho de risco e para quem e bom ou esta atras")
  ATALHO_RISCO: 1.1,           // - risco x (1,15 - habilidade) x isto
  RISCO_SEM_MURO: 0.45, RISCO_ESTREITO: 0.15, RISCO_TERRA: 0.1, RISCO_SALTO: 0.35,  // pesos do risco (sem muro pesa mais: cair custa 3 s)
  ATALHO_ESTREITO: 8,          // m: atalho desta largura ou menos e "estreito" (as pistas tem atalhos de 8 a 10 m)
  ATALHO_AUTO_VANTAGEM: 0.25,  // s: o piloto automatico pega o atalho quando ganha isto e o risco e baixo
  ATALHO_AUTO_RISCO: 0.5,

  // ------------------------------------------------------------------ turbo
  TURBO_VISTA: 2.2,            // s de pista a frente (na velocidade de turbo) que precisam estar livres de curva
  TURBO_VEL: 1.3,              // x vMax: a velocidade do turbo que o plano confere (config/turbo.js da fase 4 multiplica por ~1,3)
  TURBO_CARGA_MIN: 0.2,        // carga minima para ligar
  TURBO_REACAO: [0.8, 0.15],   // s de espera entre "da para ligar" e ligar, por habilidade
  TURBO_FOGE: 1.3,             // s de turbo para fugir da mira do Troca-Troca (config/poderes.js: a mira dura 1 s)
  FUGA_TROCA: [0.3, 0.9],      // chance de ver a mira do Troca-Troca e fugir, por habilidade
  TURBO_GUARDA: [0, 0.35],     // carga guardada para a fuga, por habilidade (o bom guarda um pouco)
  TERREMOTO_RITMO: 0.85,       // x velocidade de curva com a pista tremendo (config/poderes.js: aderencia 0,35)

  // ------------------------------------------------------------------ poderes
  PODER_REACAO: [0.9, 0.22],   // s entre a chance aparecer e apertar, por habilidade
  PODER_PENSA: [2.5, 1.2],     // s ate reconsiderar uma chance recusada
  PODER_VONTADE: [0.15, 0.95], // chance de aceitar uma chance, por usoDePoder x agressividade (combinados)
  GELO_TOQUES: [1.5, 6],       // toques por segundo no PODER quando congelado, por habilidade

  // ------------------------------------------------------------------ erros humanos (precisao)
  RUIDO_LINHA: 1.6,            // m de desvio lateral (1 sigma) com precisao 0
  RUIDO_TAU: 2.6,              // s de correlacao (o desvio passeia devagar: parece mao, nao tremedeira)
  ERRO_FREIO: 0.07,            // fracao da velocidade de curva (1 sigma) com precisao 0: + = freia tarde, - = cedo
  ERRO_TAU: 3.5,

  // ------------------------------------------------------------------ preso, contramao, largada, festa
  PARADO_VEL: 1.2,             // m/s
  PARADO_TEMPO: 2,             // s (pedido: "parado > 2 s -> re/realinha")
  RE_TEMPO: 1.1,               // s de re
  CONTRAMAO: 1.6,              // rad (~92 graus): de costas para a pista, manobra
  LARGADA_TURBO: [0.15, 0.85], // chance de acertar a largada turbo (+9 m/s no VAI, a mesma da entrada do jogador), por habilidade
  FESTA_RITMO: 0.7,            // depois da chegada o jogador desfila a 70 %
};
