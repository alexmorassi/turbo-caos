# Fase 5 — IA dos pilotos e dificuldade (gradual + adaptativa)

Estado: **pronta**. `node testes/rodar.js --so ia dificuldade fundacao pistas telas --porta 8135` → **FALHAS: 0** (5 suítes, 121 s;
com `fisica corridas audio` também verde); `--so ia dificuldade --mobile pixel` → **FALHAS: 0**. A suíte `ia` roda 10 corridas completas (8 carros, 3 voltas,
todos cruzando a chegada) + 30 voltas solo em ~45 s: a física em coordenadas da pista é barata (uma corrida de 3 voltas simula em
0,3–1,3 s de relógio).

## 1. Arquivos

| Arquivo | O quê |
|---|---|
| `js/ia.js` | a IA: plano da pista (linha de corrida K1999, saltos simulados), perfil de velocidade por carro, direção de Stanley, desvios, atalhos (o "mergulho" na boca), turbo, poderes, ar, preso/contramão, festa, largada turbo |
| `js/dificuldade.js` | base gradual pela ordem da pista, papéis (forte/medianos/fraco), DDA por pista em `G.save('dda')`, elástico leve via `mod` |
| `config/dificuldade.js` | todos os números das duas (com a origem de cada um): `DIFICULDADE`, `PILOTO_AUTO`, `IA`, `curvaDaBase()` |
| `testes/teste_ia.js` | plano das 11 pistas, determinismo, quem a IA dirige, 10 corridas completas, ritmo contra o piloto de referência, casos montados |
| `testes/teste_dificuldade.js` | curva da base, papéis, regras do DDA, limites, persistência, elástico, save quebrado |

Nenhum arquivo de outra fase foi tocado.

## 2. Como testar

```
node testes/rodar.js --so ia dificuldade --porta 8135                 # as duas desta fase (~55 s)
node testes/rodar.js --so ia dificuldade --porta 8135 --mobile pixel  # emulando o Pixel 7
http://localhost:8125/index.html?pista=neon&carro=vulcao&auto=1        # ver a IA dirigindo o carro do jogador
```

## 3. Como a IA pensa

Tudo em coordenadas da pista `(s, d)`, como a física. A IA só escreve `controle` (acel, freio, direção, drift, turbo, poder): mesma física
do jogador, nada de teleporte, nada de velocidade além do `mod`.

1. **Plano da pista** (uma vez por definição, guardado num `WeakMap`): a **linha de corrida** de cada superfície (principal e atalhos)
   pelo algoritmo **K1999** (Rémi Coulom, o robô do TORCS) numa grade de 4 m — cada ponto anda de lado até a curvatura dele ser a média
   da dos vizinhos (a curvatura fica linear entre os pontos em que a linha encosta na margem = linha de curvatura mínima: abre antes,
   corta no ápice, abre na saída), do grosso (vizinhos a 64 m) para o fino (4 m), depois CatmullRom para cada amostra de 1 m. Margens:
   2,6 m do muro, 3,2 m da beira sem muro, 2,9 m da boca de atalho que não se quer pegar; da subida da rampa ao pouso a linha fica reta e
   em ±1,2 m do centro. Raio mínimo da linha 24–51 m contra 18–28 m do centro da pista. Cada **salto** é simulado com a balística da física
   (`G_AR`, bico de 8°, tolerância de pouso, largura) para achar a **velocidade mínima** que passa o vão (17–25 m/s nas pistas; 23,7 na de
   teste — a fase 2 mediu ~22); os 70 m antes da crista ganham um **piso** de 1,1 × essa velocidade.
2. **Perfil de velocidade** (por carro, na largada): a maior velocidade em que o carro faz a curvatura da linha usando uma fração do
   volante (74–90 % pela habilidade; raio de giro = o da física, `5,5 + (raioRef − 5,5)(v/36)²`), propagada para trás com a freada que o
   plano conta (50–78 % de `FISICA.FREIO`). A ponta de cada atalho termina na velocidade da principal ali.
3. **Direção de Stanley** (o robô de Stanford): ângulo desejado da **velocidade** = ângulo do alvo lateral logo à frente +
   `atan(2,2 × erro lateral / (v + 3))`; giro = curvatura do alvo × v (alimentação direta lida 0,2 s à frente: atraso do volante e do pneu)
   + 3,4 × erro de ângulo; volante = giro / (v / raio(v)). O ângulo é o da velocidade, não o do nariz (derrapando, o nariz mente). A
   primeira versão mirava um ponto a v × 0,55 s ("perseguição pura") e cortava a curva da própria linha: andava 1,07 m fora dela em
   média; o Stanley anda **0,44 m** (medido nas 10 pistas, volta solo).
4. **Velocidade**: o perfil um pouco à frente × ritmo de curva (93–100 % pela habilidade) × o erro de freada; volante pedido além do
   máximo → freia (a curva não cabe); na subida para um salto nunca freia; no loop não freia.
5. **Alvo lateral** = linha → (se o atalho foi escolhido) o **mergulho na boca** → o desvio do momento → o erro humano:
   - **perigo que vem por trás** na faixa do carro (`raio` do Congelante, `tornado`): esquiva para o lado, com a chance da habilidade
     (15–80 %) — pode usar a largura toda, até na rampa;
   - **perigo parado à frente** (`oleo`, `fumaca`): passa pelo lado (pular meio de lado é melhor que pegar o óleo). EMP, Encolhedor e
     Terremoto são pulsos de 20–90 m em volta do dono: não têm lado e ficam de fora;
   - **carro da frente** no caminho, com a previsão de onde **ele** vai estar quando eu chegar (ele segue a linha dele): passa pelo
     lado livre (folga lateral 0,6–1,1 m pela agressividade) e, enquanto ainda está atrás dele, segura a velocidade; sem lado, segue a
     2,5–5 m de para-choque; **segura a faixa** se a volta para a linha passa por cima de quem está do lado (era metade das batidas de
     traseira: quem acabava de passar "fechava a porta");
   - **cápsula** (sem obstáculo): a mais valiosa que dá para pegar sem atravessar a pista (≤ 16° de desvio; a dourada vale o dobro e um
     desvio maior; com o turbo cheio só a dourada; **encolhido** pega qualquer uma — ela desencolhe) e só com o caminho de lado livre.
   Os efeitos de poder que chegam no `mod` (encolhido, EMP, terremoto) a IA lê do `carro.modAnterior` (ela roda antes dos poderes).
6. **Atalhos**: decide uma vez por volta, 90–160 m antes da boca, pela **vantagem que o próprio perfil estima** (tempo da principal
   pulada − tempo do atalho, com terra a 60 % e impulso), pelo **risco** (sem muro 0,45, estreito 0,15, terra 0,1, salto 0,35 × a margem
   da velocidade alcançável na crista — simulada pelo motor da física desde a boca: o Salto do Cais tem uma curva de 13 m antes da rampa),
   pela habilidade e pela posição (+25 % na metade de trás). Chance limitada a 3–85 %: nem o melhor pega sempre. Salto que a velocidade
   alcançável não passa = impossível. O piloto automático pega quando ganha ≥ 0,25 s com risco < 0,5.
   **O mergulho**: antes da boca a borda é muro, e raspar nele endireita o carro (`MURO_ENDIREITA`) — o ângulo de cruzar se perde e o
   carro passa reto pela boca (os primeiros testes: 0 entradas). O alvo sai da linha para o meio da pista, um **arco suave** de 28 m (a
   curvatura nasce e morre em zero) leva o rumo a 17° e uma **reta** cruza a borda 8,5 m dentro da boca de 12 m, com o canto do carro
   2,5 m longe do muro no começo dela; velocidade ≤ 37 m/s, sem turbo, sem derrapar, sem capsula. A janela de erro é [−1,2; +0,8] m em
   volta da reta. Na saída do atalho, o mesmo para a borda de dentro. Resultado: as entradas decididas entram (solo: 2 em 2 nas 5 pistas
   com atalho de risco baixo; nas 10 corridas: 148 de 152 — as 4 que falham levaram batida ou poder no caminho).
7. **Turbo**: liga depois do tempo de reação (0,15–0,8 s) quando o perfil aguenta 1,3 × vMax por 2,2 s à frente, **sem terra e com parede
   dos dois lados** (turbo na ponte sem muro voava para fora — Porto e Tobogã); para **fugir da mira do Troca-Troca** (o alvo é o mesmo
   que o poder escolhe; vê a mira com 30–90 % de chance); e na subida de um salto quando falta velocidade. Desliga quando a reta acaba.
   O bom guarda até 35 % da carga para a fuga. Nunca no mergulho de uma boca.
8. **Poder**: só quando `corrida.poderes.iaDeveUsar(carro)` diz que dá **e** a vontade aceita (15–95 % por `usoDePoder × agressividade`);
   aperta depois do tempo de reação (0,22–0,9 s) **se a chance ainda estiver lá**; recusou, pensa de novo em 1,2–2,5 s. `controle.poder`
   fica verdadeiro por UM passo. Congelado: toques no PODER (1,5–6 por segundo pela habilidade) quebram o gelo.
9. **Derrapagem** de propósito só numa **curva fechada da linha** (raio < 40 m), em cima da linha, embalado, sem turbo, habilidade ≥ 0,6.
   Derrapar para corrigir erro era o jeito de bater: o carro atravessado escorregava 5 m para fora (era a maior parte das batidas).
10. **No ar**: alinha o nariz com a pista e puxa a trajetória de leve para a linha. **Preso** (parado > 2 s querendo andar; esperando o da
   frente conta pela metade): ré 1,1 s com o volante invertido. **De costas** (|rumo| > 92°): manobra virando tudo para o lado mais curto.
   **Largada turbo** (+9 m/s no VAI, a mesma da entrada do jogador): chance 15–85 % pela habilidade (o piloto automático do jogador não
   faz); emite `carro:largada_turbo`. **Festa** (depois da chegada): desfila a 70 %, sem poder, turbo, atalho nem cápsula.
11. **Erro humano** pela precisão: passeio lento (Ornstein-Uhlenbeck, 2,6 s) de até 1,6 m × (1 − precisão) na linha e de 7 % na
    velocidade de curva (freia cedo/tarde). Medido: precisão 1 anda 0,44 m da linha, precisão 0,3 anda 0,80 m, sem cair e perdendo < 1 %.

Determinismo: gerador próprio semeado pelo `G.sorteio` na largada; a suíte confere 900 passos de 8 carros bit a bit. Nada alocado no passo
(estado por carro no `inicia()`; as listas de cápsulas e perigos são as reaproveitadas da fase 4, pedidas a cada 6 / 3 passos).

## 4. Tempos de volta (s)

Volta solo (2ª volta, rivais parados longe), o mesmo carro nas três; o piloto de referência é o `piloto()` da suíte da física (centro da
pista, acelerador no fundo, sem turbo):

| Pista | Carro | Referência | IA sem turbo/atalho/poder | IA completa | Volta na corrida (piloto automático, melhor) |
|---|---|---|---|---|---|
| Orla | Vulcão | 42,4 | 40,5 (96 %) | 37,0 | 37,5 |
| Favela | Dourado | 42,7 | 41,1 (96 %) | 37,8 | 37,0 |
| Deserto | Lagartixa | 50,0 | 48,6 (97 %) | 42,2 (atalho) | 43,6 |
| Gelo | Picolé | 54,8 | 53,2 (97 %) | 44,8 | 48,3 |
| Vulcão | Buguinho | 54,2 | 53,0 (98 %) | 43,6 (atalho) | 46,4 |
| Selva | Kombosa | 51,7 | 49,7 (96 %) | 42,1 | 46,6 |
| Cidade Neon | Tubarão | 57,8 | 56,1 (97 %) | 42,7 (atalho) | 42,8 |
| Porto | Voador | 54,4 | 53,2 (98 %) | 39,5 (atalho) | 39,5 |
| Canyon | Faísca | 49,9 | 47,7 (96 %) | 42,3 | 44,8 |
| Pista Maluca | Jatinho | 62,3 | 59,8 (96 %) | 49,2 (atalho) | 51,3 |

O stub da fundação fazia 114–187 s por volta e caía 1–2 vezes por volta (fase 3). A linha de corrida ganha pouco sozinha (2–4 %): quase
toda curva do jogo é de pé embaixo na linha; o que separa os tempos é o turbo (≈ 20 %) e os atalhos.

**As 10 corridas da suíte** (8 carros, 3 voltas, todos cruzam a chegada): quedas **0,004 a 0,021 por volta de carro** conforme a semente
(1 a 5 em 240; as que sobram são óleo em cima da rampa ou batida na subida), ninguém preso mais de 0,4 s, batidas no muro 1,1–1,2 por volta
de carro (solo: 0,05 — o resto é empurrão de outro carro), ~120–150 entradas em atalho e ~120–140 recusas, ~1.200 turbos, ~2.700 cápsulas
dos rivais, ~330–360 poderes (todos no passo em que `iaDeveUsar` disse sim), nenhuma chegada na ordem da grade, 5–7 carros diferentes
venceram. O piloto automático (perfeito, sem DDA) vence 3–4 das 10 com carros variados. Batidas carro × carro nas 10 corridas: 744 → 421
com a previsão do carro da frente, a distância de para-choque e o "segura a faixa".

## 5. A dificuldade

### Base gradual (ordem 1..10; a curva do Breno: `lerp(início, fim, ((ordem − 1)/9)^1,2)`)

| campo | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| ritmo (× vMax, via `mod.velMax`) | 0,87 | 0,88 | 0,89 | 0,90 | 0,92 | 0,93 | 0,94 | 0,96 | 0,97 | 0,99 |
| aceleração (× `mod.acel`) | 0,88 | 0,89 | 0,90 | 0,91 | 0,93 | 0,94 | 0,95 | 0,97 | 0,98 | 1,00 |
| habilidade | 0,40 | 0,43 | 0,48 | 0,53 | 0,58 | 0,64 | 0,70 | 0,76 | 0,82 | 0,88 |
| agressividade | 0,25 | 0,29 | 0,35 | 0,41 | 0,48 | 0,55 | 0,62 | 0,69 | 0,77 | 0,85 |
| precisão | 0,50 | 0,53 | 0,57 | 0,61 | 0,66 | 0,71 | 0,76 | 0,81 | 0,86 | 0,92 |
| uso de poder | 0,30 | 0,34 | 0,39 | 0,45 | 0,51 | 0,57 | 0,64 | 0,71 | 0,78 | 0,85 |

**Papéis**: o **forte** é quem larga na pole (+3,5 % ritmo, +0,12 habilidade, +0,08 precisão…): a criança vê o adversário a caçar desde a
largada; o **fraco** é o último rival da grade (−3 %, −0,10); os **medianos** ganham um sorteio pequeno (±1,5 % ritmo, ±0,06 habilidade) para
não andarem em fila. No campeonato os rivais são fixos: o forte é sempre o mesmo carro (um "rival da temporada").
`carro.ia = { habilidade, agressividade, precisao, usoDePoder, ritmo, aceleracao, papel, fator }`; o jogador recebe `PILOTO_AUTO`
(habilidade e precisão 1, sem DDA nem elástico).

### DDA (fator por pista em `G.save('dda')`, 0,85..1,15)

O fator multiplica a base: ritmo × `1 + (f − 1) × 0,5` (±7,5 %), aceleração × `1 + (f − 1) × 0,6`, habilidade e precisão × `1 + (f − 1)`,
agressividade × 1,2, uso de poder × 1,5 (criança perdendo leva bem menos poder na cabeça). Regras de `registra(resultado)` (a corrida chama
no fim):
- **derrota** = fora do pódio (o mesmo 3 do desbloqueio do `js/jogo.js`). **2ª derrota seguida na mesma pista: −0,05** (e a 3ª, a 4ª…);
  em último, −0,02 a mais. Uma derrota sozinha não mexe (a criança pode só ter errado uma curva);
- **vitória com folga** (≥ 3 s sobre o 2º): **+0,05**; vitória apertada: +0,02;
- muitas batidas (≥ 6 por volta) sem vencer: −0,015; melhor volta 4 % mais rápida que a mediana dos rivais: +0,015 (volta de mentira,
  < metade da mediana, não vale — ver pendência 1);
- **mudança máxima por corrida: 0,06**; pista nunca corrida começa no fator **global**, que anda metade do passo.

Formato salvo: `{ versao: 1, global: { fator, corridas }, pistas: { <id>: { fator, corridas, derrotasSeguidas, vitoriasSeguidas,
historico: [{ pos, n, vitoria, folga, ritmo, batidas, fator, delta }] (6 últimas) } } }`. Tudo conferido na leitura (texto, número, lista,
campo de outro tipo, `NaN` → padrão); `le`/`grava` que levantam não derrubam. Legível: `corrida.dificuldade.fator`, `.historico`,
`.estado`, `.base`, `.elastico`, `.ultimoRegistro`; exportados `leDDA`, `avaliaCorrida`, `fatorDaPista`, `CHAVE_DDA`.

### Elástico (dentro da corrida, só nos rivais)

Pela distância de progresso ao jogador: até 50 m nada (briga de perto é de verdade); daí até 350 m o efeito cresce em smoothstep até
**−6 %** (quem está muito à frente) ou **+4 %** (muito atrás); metade disso na última volta; **nada de empurrão com o turbo ligado**;
suavizado em 3 s (no máximo 0,0003 por passo, medido); o multiplicador total (base × DDA × elástico) fica em [0,72; 1,06] — o turbo da
fase 4 multiplica por 1,3, então um rival nunca fica mais rápido do que o próprio turbo deixaria.

## 6. Decisões tomadas sozinho (para o `docs/PENDENCIAS.md`)

- **D1 — derrota = fora do pódio** (o mesmo 3 do `jogo.js`), não "não venceu": casa com o campeonato, que repete a pista nesse caso.
- **D2 — rival forte = o da pole**; fraco = o último rival da grade. No campeonato, sempre o mesmo carro.
- **D3 — `?auto=1` também treina o DDA** (registra como se fosse o jogador). No artefato não há query string, então não acontece no
  celular; as suítes precisam do registro.
- **D4 — o jogador no piloto automático usa poder/turbo/atalho como um rival bom** (é ele que faz as corridas completas da bateria),
  mas **não faz a largada turbo**: é o reflexo da criança, e a suíte do áudio mede o tom do motor do jogador saindo do zero (com +9 m/s no
  VAI o tom de 9 e de 31 m/s ficava igual por causa das pseudo-marchas).
- **D5 — a IA emite `carro:largada_turbo`** para o rival que acerta a largada (o contrato diz `{ carro }`, sem ser só o jogador).
- **D6 — calibração para criança pequena é chute medido**: ritmo dos rivais na pista 1 = 87 % da vMax e o DDA chega a 80 %. O piloto
  automático (perfeito) vence 3–4 das 10 corridas da suíte com carros variados. **Precisa de playtest** com a criança; os números estão em
  `config/dificuldade.js` (`BASE`, `DDA`, `ELASTICO`).

## 7. Pendências e avisos para outras fases

1. ~~Fundação (`js/corrida.js`): o Troca-Troca logo depois da linha de chegada registrava uma volta de 1,4 s.~~ **Resolvido pelo
   maestro** (cruzar de novo depois da ré só devolve a volta tirada). O DDA continua ignorando volta < metade da mediana dos rivais.
2. ~~A IA não enxergava o `mod` do passo.~~ **Resolvido**: a corrida guarda `carro.modAnterior` antes do `zeraMod`, e a IA lê dele o
   encolhido (`escala`), o Pulso EMP (`semTurbo`) e o Terremoto (`aderencia`) — no lugar da primeira versão, que deduzia pelos eventos
   `poder:acerta`/`poder:fim` e pela `duracao` do config. A suíte confere o EMP (nenhum pedido de turbo com `semTurbo`).
3. **Fase 2/4**: turbo × faixa de impulso empilham (1,3 × 1,3 = 1,69 × vMax: 66 m/s antes do loop da Neon). Pode ser de propósito.
4. **Bateria das outras fases** (não é desta fase): `teste_pistas` com `--mobile pixel` reprovou numa rodada em "qualidade BAIXA corta o
   cenário" de 4 pistas (no celular a qualidade já nasce média e o corte fica abaixo de 15 %) — asserção de visual, não passa pela IA; a do
   áudio tem uma asserção de tempo real ("o mesmo som não toca duas vezes em 60 ms") que reprovou uma vez com a máquina carregada. O
   `teste_mobile` deixou de exigir botões de toque fora do `--mobile` (maestro).
5. Não rodei `tools/monta.js` (é do maestro); conferi que o pacote fecha com o esbuild nas opções dele e que os meus arquivos não têm
   `fetch`, `import.meta`, `Math.random` nem `Date.now`.

## 8. Mudanças de contrato propostas ao maestro

1. Seção 9: `carro.ia` ganha `ritmo`, `aceleracao`, `papel` ('forte'|'mediano'|'fraco'|'auto') e `fator`; `corrida.dificuldade` expõe
   `fator`, `historico`, `estado`, `base`, `elastico`, `ultimoRegistro`; formato da chave `dda` (seção 5 acima).
2. Seção 9: `corrida.ia.estatisticas` (contagens: atalhos, turbos, poderes, cápsulas miradas, ré, derrapagens…) e `corrida.ia.planos`
   (linha de corrida por superfície) — leitura para suítes/HUD, não contrato forte. `js/ia.js` exporta `planosDaPista`, `velDaCurva`,
   `raioDeGiro`, `perfilDoCarro`.
3. Seção 3: `carro:largada_turbo` também para rivais (emitido pela IA).
