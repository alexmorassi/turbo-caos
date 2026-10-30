// TURBO E CAPSULAS (fase 4). Todo numero de jogabilidade da barra de turbo (js/turbo.js) e das capsulas que a recarregam
// (js/capsulas.js) mora aqui, com a origem ao lado. O desenho do sistema esta em docs/fases/fase4_poderes.md.
//
// A REGRA DO PEDIDO: "o turbo e limitado e so recarrega com capsulas espalhadas pelo caminho. Por isso, escolher a trajetoria e tao
// importante quanto acelerar". Entao:
//   * a barra e uma FRACAO (0..1) e a capsula soma uma fracao — o atributo `turbo` (config/carros.js) diz quantos SEGUNDOS a barra cheia
//     dura. Carro de turbo 5 ganha 1,65 s de turbo por capsula; o de turbo 1, 0,75 s. E assim que o atributo pesa na corrida;
//   * as fileiras atravessadas na principal dao um pouco a todo mundo (corrida de crianca: ninguem fica sem turbo); quem arrisca —
//     atalho, beira sem muro, terra, salto — pega MAIS, e as douradas (enchem a barra) so moram nos lugares de risco;
//   * a capsula pega some por alguns segundos: no pelotao, quem vem logo atras na mesma linha fica sem — vale abrir para o lado.

export const TURBO = {
  // s de turbo com a barra cheia, pelo atributo turbo 1..5 (indice 0 = atributo 1). Pedido: "ex. 2,5...5,5 s"
  CAPACIDADE: [2.5, 3.25, 4, 4.75, 5.5],
  CARGA_INICIAL: 0.4,      // pedido: "comeca a corrida com ~40%" (da para a largada turbo e mais um empurrao)
  VEL_MAX: 1.3,            // mod.velMax *= — pedido "~1,3": o Vulcao (39 m/s) vai a 51 m/s; e o mesmo IMPULSO_VEL do config/fisica.js
  EMPURRAO: 14,            // m/s2 em mod.empurrao — pedido "~12-16". A fisica (js/carro.js) tira o empurrao perto do teto: de 39 a
                           // ~47 m/s em ~1 s, que e o "chute nas costas" que a crianca sente sem virar foguete
  FOV_EXTRA: 9,            // graus de camera.fov(extra) no jogador: o mesmo FOV_TURBO de js/camera.js (que ja abre sozinho com
                           // turbo.ativo — vale o maior dos dois, entao nao dobra)
};

export const CAPSULAS = {
  // ------------------------------------------------------------------ recarga
  RECARGA: 0.3,            // fracao da barra por capsula normal. Pedido "+~25-35% da capacidade"
  RECARGA_DOURADA: 1,      // pedido: "DOURADA rara (enche tudo)"
  // ------------------------------------------------------------------ pegar
  RAIO_PEGA: 2.2,          // m (x mod.escala do carro), do CENTRO do carro ao centro da capsula — pedido "raio ~2,2 m x escala".
                           // Encolhido (escala 0,55) pega com 1,2 m: mais dificil, mas e o contra-ataque dele (volta ao normal)
  CENTRO_DO_CARRO: 0.7,    // m acima do asfalto (x escala): o meio da carroceria de um carro de 1,2-2,6 m de altura
  ALTURA: 1.25,            // m: a capsula (1,9 m de altura) flutua com o centro a 1,25 m do asfalto — o carro no chao pega (o centro
                           // dele fica a 0,7 m: 0,55 m de diferenca, ainda 2,1 m de raio de lado), o carro voando por cima nao
  FLUTUA: 0.18,            // m de sobe-e-desce (so visual: a pegada usa a altura do meio)
  REAPARECE: 3,            // s depois de pega. Curto o bastante para a proxima volta sempre ter, longo o bastante para o segundo
                           // carro do pelotao na mesma linha ficar sem (a 36 m/s sao 108 m de distancia)
  REAPARECE_DOURADA: 15,   // s: a dourada e rara — quem vem logo atras no mesmo risco nao ganha a segunda
  CRESCE: 0.45,            // s da animacao de reaparecer (cresce do zero)
  // ------------------------------------------------------------------ onde ficam (js/capsulas.js gera sozinho, de qualquer pista)
  PRIMEIRA_FILEIRA: 70,    // m depois da largada: a grade larga ate 42 m atras da linha e embola nos primeiros metros
  ESPACO_FILEIRAS: 125,    // m entre fileiras atravessadas na principal (pedido "a cada ~100-150 m")
  VARIA_FILEIRAS: 20,      // m: alterna +-20 (115 / 135 / ...), para a crianca nao decorar o ritmo
  ESPACO_ATALHO: 45,       // m entre fileiras no atalho: "mais nos atalhos" (o atalho de 120 m tem 2 ou 3 fileiras)
  BOCA_LIVRE: 14,          // m do comeco e do fim do atalho sem capsula (a boca: carro trocando de tira, borda aberta)
  ANDA_ATE: 30,            // m: lugar ruim (loop, vao, crista, boca) empurra a fileira para a frente ate isto; nao achou, pula
  FOLGA_FIGURA: 6,         // m antes e depois de loop, vao e crista sem capsula (pedido: "nada dentro de loop nem no ar sobre vao")
  FOLGA_LARGADA: 12,       // m de cada lado da linha de chegada sem capsula (o portico e a contagem de volta)
  NA_FILEIRA_LARGA: 3,     // capsulas por fileira em pista >= LARGURA_DE_3 m; 2 nas mais estreitas (atalho de 8-10 m)
  LARGURA_DE_3: 12,
  FRACAO_DA_FILEIRA: 0.3,  // d = +-30 % da largura: com 3 capsulas e o raio de 2,2 m a fileira cobre a pista toda (todo mundo pega
                           // uma: e a "fileira atravessada" de kart); com 2, sobra o meio livre
  // risco/recompensa (pedido: "mais ... nos trechos de risco (sem muro, terra, vao — recompensa do risco)")
  RISCO_ESPACO: 15,        // m entre as capsulas de uma linha de risco
  RISCO_MINIMO: 20,        // m: trecho de risco mais curto que isto nao ganha linha
  RISCO_MAXIMO: 5,         // capsulas no maximo por linha de risco (a ponte de 110 m sem muro nao vira um colar de 8)
  BEIRA: 2.6,              // m da beira sem muro ate o centro da capsula: o carro passa com as rodas a ~1,5 m do vazio
  POUSO_DEPOIS: 8,         // m depois do fim do vao: o par de capsulas do pouso (premio de quem pulou)
  POUSO_LADO: 0.3,         // x largura para cada lado: FORA do centro, onde o carro que caiu volta (js/carro.js respawn: d = 0)
  JUNTAS: 3,               // m: duas capsulas mais perto que isto viram uma (a dourada fica)
  // douradas
  MAX_DOURADAS: 3,         // pedido: "1-3 douradas por volta nos lugares arriscados"; as do atalho tem preferencia
  // ------------------------------------------------------------------ Ima (js/poderes/ima.js chama capsulas.atrai)
  IMA_VEL: 28,             // m/s A MAIS que o carro que puxa: a capsula sempre o alcanca (o turbo vai a ~51 m/s)
  IMA_VEL_MIN: 30,         // m/s minimos da capsula puxada
};
