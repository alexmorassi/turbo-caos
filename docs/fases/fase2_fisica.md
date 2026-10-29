# Fase 2 — física do carro, colisões, controles de toque e câmera

Arquivos desta fase: `js/carro.js`, `js/visual_carro.js`, `js/colisoes.js`, `js/entrada.js`, `js/camera.js`, `config/fisica.js`,
`testes/teste_fisica.js`, `testes/teste_entrada.js`, `testes/teste_camera.js`, `tools/foto_fisica.js` e as fotos `docs/fotos/fase2_*.jpg`.
Nenhum arquivo de outra fase foi tocado.

## Como testar

```
node testes/rodar.js --so fisica entrada camera fundacao --porta 8132                 # desktop
node testes/rodar.js --so fisica entrada camera fundacao --porta 8132 --mobile pixel  # Pixel 7 deitado (tela de toque)
node testes/rodar.js --so fisica entrada camera fundacao --porta 8132 --mobile iphone # iPhone 14 deitado
node tools/foto_fisica.js --porta 8132 [--carro voador] [--mobile pixel]              # fotos em docs/fotos/fase2_*.jpg
```
Resultado final: bateria inteira verde (8 suítes, inclusive `pistas`, `telas`, `audio` e `save` das outras fases) e as 4 suítes acima
verdes no desktop, no Pixel 7 e no iPhone 14. Console limpo nas fotos.

## 1. A física (`js/carro.js`, números em `config/fisica.js`)

Modelo **híbrido em coordenadas da pista**, passo fixo 1/60 s, sem `Math.random`/`Date.now`, nada alocado no passo (só os objetos dos
eventos, que são raros).

- **No chão**: estado `(sup, s, d, psi, vf, vr)`, `h = 0`. `V_T = vf cosψ − vr sinψ`, `V_R = vf sinψ + vr cosψ`,
  `ṡ = V_T / max(0,3; 1 − kh·d)`, `ḋ = V_R`, `ψ̇ = ω − kh·ṡ`. O giro ω roda o referencial do carro (`(vf, vr)` roda de −ω·dt); depois o
  pneu puxa `vr → 0` (`exp(−k·dt)`) e devolve o embalo para a frente, menos `PERDA_NA_CURVA` (de lado — carro parado empurrado — ele só
  freia: `CONVERTE_ATE_GRAUS`). Sem esterçar o carro sai reto e bate no muro de fora (testado).
- **Giro**: `raio(v) = 5,5 + (raioRef − 5,5)·(v/36)²`, `ω = volante · v/raio(v)` → ~1,8 rad/s a 20 m/s, ~1,5 a 36 m/s, ~1,2 no turbo.
  Volante suavizado (rampa 7/s para virar, 14/s para voltar). Quase parado e acelerando (ou de ré), gira patinando até 1 rad/s
  (`GIRO_PARADO`): sem isso, encostado de bico num carro ou muro, ele nunca girava (visto no engavetamento da largada).
- **Longitudinal**: motor `A·(1 − u²)` com `u = rapidez/vMax` e `A = atanh(0,95)·vMax/t95` (a tabela diz o tempo até 95 %); freio 22 m/s²;
  ré lenta 7 m/s; rolando: atrito + arrasto; acima do teto (turbo acabou, terra, descida) corta a velocidade **inteira** na proporção
  (3/s, no máximo 7 m/s²; terra 8/s, no máximo 22 m/s²); rampa `−12·frente.y` (sobe freia, desce embala; na descida passa ~2 m/s da vMax).
- **Terra** 60 % da vMax e 0,7 da aderência; **impulso** +30 m/s² até 1,3 × vMax por 0,6 s; **magnético** (loop): sem gravidade de rampa,
  velocidade mínima 18 m/s, nunca decola (nem vão, nem crista, nem beira sem muro — a beira vira muro).
- **Muro**: prende `d`, devolve `V_R` com restituição 0,25, perde `0,3 m/s por m/s de pancada / √massa`, endireita o rumo na pancada
  (8 % por m/s) e enquanto encosta (10/s) — bate torto e sai deslizando ao longo do muro. `carro:batida` só acima de 2,5 m/s e no máximo a
  cada 0,35 s (raspar não vira metralhadora de som). **Sem muro** o meio do carro saindo do asfalto → cai.
- **Atalho**: na boca (`ABRE_*`) troca de tira quando o meio do carro cruza a borda (`pista.transicao`); nos últimos 30 m do atalho um
  puxão lateral leve (até 9 m/s²) leva para a borda aberta, e no fim (`s ≥ comprimento − 1`) a troca é forçada projetando na principal.
- **Ar** (crista `lanca`, vão, beira sem muro): posição e velocidade de mundo, `G_AR = 20 m/s²`. A crista lança **com a velocidade que o
  carro tem, 8° mais para cima** que o asfalto (`ANGULO_EXTRA_DA_RAMPA`) — ver decisão D1. Controle no ar 1,6 rad/s de giro (25 % dele vira
  trajetória), a carroceria aponta para onde voa. Muro baixo segura e devolve; acima de 1,2 m, onde há muro, uma parede invisível segura o
  carro no corredor (decisão D3). Pousa ao chegar ao asfalto até 1 m abaixo da borda, dentro da largura e fora do vão; o impacto
  (componente normal) sai em `carro:pouso`; pousa no máximo 35° torto em relação a para onde vai.
- **Queda** (3,5 m abaixo do asfalto ou 4 s no ar) → `carro:queda` → `respawn()`: centro da pista, 12 m/s, fantasma 1,5 s,
  `carro:volta_pista`. `sSeguro` só anda no chão da principal fora de rampa/vão; se houver rampa ou vão até 45 m à frente dele, volta
  **depois** do buraco (decisão D2).
- **Efeitos**: `rodopia(seg)` 2 voltas inteiras (termina olhando para a frente), sem controle, perde ~80 %; `congela(seg)` sem controle,
  desacelera 3/s; `quebraGelo(seg)` tira tempo do gelo e vale **uma vez por passo**; `levanta(seg)` sobe 3 m numa parábola girando 2
  voltas em coordenadas da pista (não sai da pista; no loop só gira); `empurra(dvf, dvr)`; `estadoDePista()/aplicaEstadoDePista(e)`
  (cada carro leva a própria velocidade). `zeraMod()`. Os `mod` usados: `velMax, acel, aderencia, direcao, massa, escala, empurrao`.
- **Largada turbo**: apertar TURBO (ou ACELERA, na aceleração manual) até 0,35 s antes do VAI ou 0,2 s depois dá +9 m/s
  (`carro:largada_turbo`).
- Guarda contra NaN: volta para o ponto seguro e conta em `carro.nans` (as suítes exigem 0; nunca agiu).
- Campos extras só de leitura (não são contrato): `p` (números do carro), `volante`, `giro`, `aceleracao`, `derrapando`, `tempoNoAr`,
  `quedas`, `nans`, `estaVoando`, `velMaxAgora`; `parametrosDoCarro(cfg)` exportado (a IA pode ler a vMax).

### Números principais (por atributo 1..5, `config/fisica.js`)

| atributo | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| velocidade → vMax (m/s) | 30 | 33 | 36 | 39 | 42 |
| aceleração → 0 a 95 % (s) | 6,0 | 5,5 | 5,0 | 4,5 | 4,0 |
| controle → raio na direção toda a 36 m/s (m) | 30 | 27 | 24 | 21 | 18 |
| controle → aderência (1/s) | 7 | 8 | 9 | 10,5 | 12 |
| peso → massa relativa | 0,75 | 0,9 | 1,0 | 1,2 | 1,45 |

Medido (`teste_fisica`): Vulcão vMax 39 m/s, 0→95 % em 5,05 s (tabela: 5,0); giro com a direção toda a 30 m/s 1,31 rad/s, derrapando
1,90 rad/s com 28° de derrapagem; **salto da pista de teste a 36 m/s: 36 m, 1,02 s no ar**, impacto 10 m/s; passa a partir de ~22 m/s, a
12 m/s cai e volta depois do vão. Volta da pista de teste com o piloto da suíte: 25,8 s, zero batidas.

**Nas 10 pistas da fase 3** (piloto da suíte, uma volta cada, Vulcão e Picolé — o mais lento, vMax 33): **zero quedas**, todos os saltos
pousam (1,2–2,2 s no ar), os 6 loops completam de cabeça para baixo (`cima.y = −1`), nenhum NaN; voltas de 45–64 s (Vulcão) e 52–72 s
(Picolé). Fórmula para quem desenha salto: alcance ≈ v²·sen(2a)/20 e tempo ≈ 2·v·sen(a)/20, com a = inclinação da crista + 8°
(cabeçalho de `config/fisica.js`).

## 2. Colisões (`js/colisoes.js`)

28 pares por passo. Mesma tira e no chão: caixa em `(s, d)` com as medidas do `config/carros.js` × `mod.escala`, rodada pelo `psi`;
resolve no eixo de menor penetração pelo inverso da massa (`peso × mod.massa`); troca só a velocidade do eixo, restituição 0,3 e
afastamento mínimo (2,4 m/s de lado, 1 m/s de traseira: "toc!", nunca grudados). Quem é empurrado contra o muro para nele. No ar ou em
tiras diferentes: esfera no mundo. `fantasma` ignora. `carro:batida` tipo `carro` para os dois, acima de 1,5 m/s, no máximo a cada 0,3 s
por par. Testado: de lado o Jatinho (0,75) anda 1,9× o que o Tubarão (1,45) anda.

## 3. Visual (`js/visual_carro.js`)

`VisualCarro` com `grupo` (parado na origem, com o carro e a sombra dentro) e `quadro(dt)`. Rodas giram `v/raio` (teto de 32 rad/s
desenhados) e as da frente esterçam (contra-esterço na derrapagem); só o nó `body` inclina (rola para fora da curva, arfa no
acelerar/frear, balança no pouso — molas visuais). Voador: sobe `rodas.flutua` (0,205 m) + flutua ±6 cm e inclina 1,6×. Sombra: mancha
de retângulo arredondado com borda macia (canvas, `shadowBlur` — o `ctx.filter` não existe no Safari) colada no asfalto, cresce e some
com a altura, some no vão. Pisca no fantasma. Partículas: UM `THREE.Points` de 192 por corrida (fumaça de derrapagem, poeira de terra,
faísca de batida, poeira de pouso), escaladas por `G.qualidade.p.particulas`, com gerador próprio (nunca `G.sorteio`/`Math.random`).
Nada do GLB recebe `dispose`.

## 4. Entrada (`js/entrada.js`)

Padrão do Breno (pedido do maestro): Pointer Events com `pointerId` e `setPointerCapture`, joystick de base FIXA numa área grande à
esquerda (só o X, zona morta 0,12, curva 1,15), botões redondos `.big` (borda branca, sombra, afundam com `.down`, tamanhos `clamp(…vh…)`)
e as travas anti-dedo-preso (fim do toque ouvido na janela toda, `touchend` sem dedos, `touchcancel`/`blur`/`visibilitychange`, vigia de
250 ms que solta o dedo de um elemento que sumiu). Contadores por ação: o passo não aloca.
- Modos `botoes` (◀ ▶), `joystick`, `inclinacao` (DeviceOrientation → vetor da gravidade → giro de volante no plano da tela, qualquer
  ângulo de tela; 22° = direção toda, zona morta 2,5°; ângulo de tela trocado de 180° se conserta sozinho; iPhone: `requestPermission`
  no toque — `'prompt'` continua perguntando). Sem evento do sensor em 1,5 s as setas aparecem de reserva com o aviso acima delas.
- Direita em arco em volta do polegar: TURBO no canto, PODER na diagonal, FREIO ao lado (o PODER empilhado encostava no minimapa da
  fase 6). Aceleração manual: 2 × 2 com ACELERA no canto. `#btn-turbo` e `#btn-poder` têm o filho `.deco` vazio (a fase 6 já decora).
- **FREIO é um botão só para freio e derrapagem** (no toque manda `freio = 1` e `drift = 1`; a física derrapa se estiver andando e
  virando, senão freia). No teclado são dois: S/↓ freio, Ctrl derrapagem. Setas/WASD, espaço turbo, E/Shift poder, Esc/P pausa.
- `configura({ modo, acelAuto })` grava `opcoes.controle` e `opcoes.acelAuto` em `G.save('opcoes')` sem apagar o resto; aceleração
  automática começa LIGADA. `mostraControles(bool)`: só aparecem com tela de toque (`entrada.toque`; vira true no primeiro toque de dedo).
- `#btn-pausa` (canto superior direito) só liga `estado.pausa`; a fase 6 já põe o botão dela por cima e lê `apertou('pausa')`.

## 5. Câmera (`js/camera.js`)

Posição calculada em **coordenadas da pista** (6 m atrás ao longo da pista, +1,8 m a 40 m/s, +1 no turbo, 2,25 m acima): no loop a câmera
fica dentro dele, acima do asfalto, de cabeça para baixo junto com o carro (cima = N da pista + cima do carro); no ar volta ao Y do mundo.
O rumo segue para onde o carro VAI (derrapagem e rodopio não balançam). Olha 16 m à frente na pista (32 % do olhar): na curva puxa para
dentro. FOV 62° + 9° a 40 m/s + 9° no turbo (`carro.turbo.ativo`, lido sozinho) ou `fov(extra)` — vale o maior dos dois, para não dobrar.
`treme(intensidade, seg)` com relógio próprio; tremor automático na batida e no pouso forte do jogador. Contagem: giro de apresentação
de 155° terminando atrás do carro no VAI. Chegada: festa girando 0,55 rad/s. Volta da queda: corta direto para trás do carro. Nunca NaN.
`G.camera3p` = a câmera da corrida. Tudo no `passo` (as suítes medem sem desenhar).

## 6. Decisões tomadas sozinho (para o `docs/PENDENCIAS.md`)

- **D1 — a crista lança 8° mais para cima.** O contrato diz "com a velocidade que tem": a rapidez é a mesma, só a direção sobe 8°. Sem isso
  a crista suave da pista de teste só era vencida a 42+ m/s (medido) e o salto virava lombada. `ANGULO_EXTRA_DA_RAMPA = 0` volta ao literal.
- **D2 — queda volta depois do buraco**, não no ponto seguro antes da rampa: a 12 m/s antes da rampa o carro cai de novo, para sempre.
- **D3 — parede invisível no ar** acima do muro (até 30 m), só onde a pista tem muro: saindo torto da rampa a criança não voa para fora.
- **D4 — FREIO/DRIFT num botão só** no toque (ver 4).
- **D5 — `quebraGelo` automático**: a física chama quando `controle.poder` chega com o carro congelado; é idempotente no passo, então os
  poderes podem chamar também sem contar dobrado.
- **D6 — giro patinando quase parado** (`GIRO_PARADO`), **funil no fim do atalho**, **loop nunca derruba** (beira vira muro).
- **D7 — `#btn-pausa` próprio** (a fase 6 sobrepõe o dela; se preferir, esconda o meu por CSS).

## 7. Pendências e avisos para outras fases

- **Fase 5 (IA)**: o piloto stub (`direcao = −0,3·d`) oscila com física de rumo de verdade (zigue-zague, engavetamento na largada; a
  corrida termina, em ~64–100 s por volta na pista de teste). Piloto de referência que funciona: `piloto()` em `testes/teste_fisica.js`
  (curvatura da pista 0,3 s à frente como alimentação direta + PD em `d` e `psi`). A IA pode derrapar (`controle.drift`) e fazer largada
  turbo (`carro.empurra(FISICA.LARGADA_TURBO, 0)` no VAI).
- **Fase 4 (poderes)**: semântica dos efeitos acima; turbo = `mod.velMax *=` e `mod.empurrao +=` (o empurrão some perto do teto);
  a câmera já abre o FOV com `turbo.ativo`. Terremoto: `mod.aderencia` multiplica o k do pneu.
- **Fase 3 (pistas)**: no topo do loop o carro fica escuro (a luz vem de cima e ele está de cabeça para baixo) — sugiro uma luz de
  preenchimento presa à câmera ou um `HemisphereLight` com o chão mais claro.
- **Artefato do Claude**: dentro de um iframe sem `allow="accelerometer; gyroscope"` o navegador não entrega DeviceOrientation; a
  inclinação cai sozinha para as setas (D-reserva acima). Vale conferir no celular.
- A emulação do Playwright informa ângulo de tela 0 mesmo deitada; a conta foi conferida para 0/90/180/270 na suíte (erro 0,0000°).
- Não rodei `tools/monta.js` (é do maestro e outros agentes estavam ativos); conferi que o pacote fecha com o esbuild nas opções do
  `monta.js`, e meus arquivos não têm `fetch`, `import.meta`, `Math.random` nem `Date.now`.

## 8. Mudanças de contrato pedidas ao maestro

1. Seção 3 (eventos): acrescentar `carro:largada_turbo` [física/entrada] `{ carro }`.
2. Seção 5: `carro.i` (dica da projeção) vale a amostra atual em TODO passo (chão e ar) — antes só no teleporte, o que fazia a decolagem
   projetar noutro trecho (bug achado e corrigido aqui: selva, gelo, orla e neon caíam nos saltos).
3. Seção 5: `LANCA` = "sai voando com a velocidade que tem, `FISICA.ANGULO_EXTRA_DA_RAMPA` (8°) mais para cima"; queda volta depois do vão.
4. Seção 6: chaves `opcoes.controle` e `opcoes.acelAuto`; botão de toque FREIO = `freio` + `drift`; `#btn-pausa` liga `estado.pausa`.
