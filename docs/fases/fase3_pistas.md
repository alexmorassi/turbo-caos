# FASE 3 — Pistas, cenário e céu

O sistema de pistas por pedaços, as 10 pistas do campeonato, o visual (fita, zebras, muros, rampas, loops, pilares, pórtico,
placas), o terreno ajustado à pista, o cenário low-poly de cada tema, o céu com luz e neblina, a suíte `pistas` e as fotos.

## Arquivos

| Arquivo | O quê |
|---|---|
| `js/pistas/construtor.js` | **Construtor** ("tartaruga"): `reta`, `direita`/`esquerda` (com `incl`), `rampa` (crista com LANCA, VÃO, pouso), `loop` (usa `geraLoop`), `sacaRolha` (hélice com `cima` explícito), `paredao` (curva magnética que deita até 60–65°), `conecta`, `ponto`, `atalho({ de, ate, lado, via })`, opções `sobe` (perfil suave, `'resto'` fecha a altura), `elastica` (2 retas fecham a posição num sistema 2x2 exato), `marca`, `nome`, `elevado`, `ponte`. Ajudantes `travessia()` (rio/lava que cruza a pista no meio de um vão/ponte) e `lagoNoBojo()`. Modo rascunho (`globalThis.TURBO_RASCUNHO`) devolve o traçado aberto para plotar. |
| `js/pistas/{orla,favela,deserto,gelo,vulcao,selva,neon,porto,canyon,maluca}.js` | As 10 pistas (desenho + tema). |
| `js/pistas/consulta.js` | Índice de ponto → `s` em qualquer superfície (`sDoPontoNaSup`, `faixasEmS`, `figurasDaPista`); usado pelo visual e pela inspeção. |
| `js/pistas/inspecao.js` | Todas as verificações de geometria (roda no navegador e no Node; não entra no jogo). |
| `js/visual_pista.js` | `montaVisualDaPista(G, pista) -> { grupo, quadro(dt), destroi() }` + `conta()`, `aplicaQualidade(p)`, `terreno`, `sol`, `hemi`, `neblina`, `tMontagem`. Exporta também `coletaAmostras(pista)`. |
| `js/cenario.js` | Terreno (grade de 8 m ajustada à pista), água/lava, chão do horizonte, silhuetas de fundo, biblioteca de objetos (`OBJETOS`, peças `Pecas` no estilo do `models.js` do Breno) e as receitas de cada tema. |
| `js/ceu.js` | Céu (esfera com degradê por cor de vértice, como o Breno), sol/lua, nuvens instanciadas, estrelas, Hemisphere + Directional, neblina. |
| `config/pistas.js` | `PISTAS` (as 10, ordem 1..10) e `pistaPorId(id)`. |
| `testes/teste_pistas.js` | A suíte (ver abaixo). |
| `tools/foto_pistas.js` | As fotos (`docs/fotos/pistas/<id>_{planta,largada,figura,atalho,giro,folha}.jpg`). |

## As 10 pistas

Comprimentos e marcas medidos pela suíte (`[MEDE]`). "Sem muro" = metros da principal sem muro de algum lado (fora das bocas). As
voltas do piloto automático são do **stub** da fundação (`js/ia.js`: acelera e mira o centro) com a física real — servem para provar
que a volta fecha, não para medir o ritmo (na `VEL_REFERENCIA` de 36 m/s do `config/fisica.js` a volta seria de 44–60 s).

| # | Pista | Volta | Atalho(s) (economia) | Saltos | Loops / giros | Riscos | Desnível |
|---|---|---|---|---|---|---|---|
| 1 | Orla do Rio (16 m de largura) | 1600 m | Atalho da Areia — faixa de areia na praia, corta o desvio pelas ruas (115 m) | 1 (canal, vão 12 m) | — | só a areia (TERRA) do atalho; muro em toda a volta | 7 m |
| 2 | Favela Morro Acima | 1659 m | Beco da Escadaria — 8 m, **sem muro**, corta o contorno do topo (168 m) | 1 (laje, vão 13 m) | cotovelo de 150° inclinado 12° | beco sem muro | 32 m |
| 3 | Deserto | 1802 m | Atalho do Vale — areia + rampa no meio, corta o contorno da mesa (218 m) | 2 (duna grande 4,5 m/vão 16, com impulso; rampa do vale) | — | curva rápida **sem muro** por fora (83 m), saltos | 10 m |
| 4 | Gelo | 1751 m | Atalho do Lago — gelo fofo (TERRA) com faixa de **impulso** no meio (96 m) | 2 (fenda 18 m; ressalto) | — | gelo fofo do atalho | 11 m |
| 5 | Vulcão | 1927 m | Pulo do Lago de Lava — **rampa que corta caminho** sobre o lago (vão 20 m) (97 m) | 2 (+1 no atalho) | **1º loop** (r 12, deslocamento 16 m) | ponte **sem muro** sobre o rio de lava (111 m), saltos sobre lava | 28 m |
| 6 | Selva | 1671 m | Atalho da Lama — 8 m, lama, **sem muro** (148 m) | 1 (rio, vão 18 m) | loop da cachoeira (r 13), serpentina | atalho sem muro, salto do rio | 29 m |
| 7 | Cidade Neon (noite) | 2029 m | Beco do Neon — 8 m, impulso na saída (147 m) | 1 | loop, **1º saca-rolha** (r 8, 96 m), **viaduto** do oito (8,5 m de folga) | saltos, saca-rolha | 24 m |
| 8 | Porto | 2091 m | Salto do Cais — **pula de um píer para o outro** sobre a água (vão 22 m) (212 m) | 1 (+1 no atalho) | loop do cais | ponte **sem muro** entre os píeres (101 m), o salto do cais | 24 m |
| 9 | Canyon | 1864 m | Atalho da Saliência — prateleira de 8 m **sem muro**, com impulso (96 m) | 3 (20, 18 e 24 m de vão) | loop do mirante, **paredão** (90°, deita 65°) | ponte estreita (12 m) **sem muro** sobre o abismo de 22 m (101 m), três saltos | 24 m |
| 10 | Pista Maluca (parque) | 2177 m | Rampa do Palhaço — rampa por cima do circo (116 m); Tobogã — 8 m, sem muro, impulso (87 m) | 2 (mega-rampa 6 m/vão 26; rampa do palhaço) | **loop duplo**, saca-rolha, **2 paredões**, viaduto do oito | mega-rampa, tobogã sem muro | 24 m |

Todas: circuito fechado, ponto 0 com `MARCA.LARGADA` no meio de uma reta plana (curvatura < 0,003 1/m e N.y > 0,999 de −45 a +30 m),
largura 12–16 m na principal (loops e saca-rolha com 12) e 8–10 nos atalhos, quadros ortonormais (pior desvio ~1e-7), topo de cada
loop/saca-rolha com N.y < −0,9 e magnético, nenhuma amostra a menos de uma largura de outra não vizinha (as únicas exceções são os
viadutos da Neon e da Maluca, com 8,5 m de folga vertical), atalhos que conectam nas duas bocas (`pista.transicao` na entrada, na
saída e de volta pela entrada) e são mais curtos que o trecho que pulam, nunca cruzando a largada. Douradas (`douradas: [{ em, d }]`)
nos lugares arriscados: crista das rampas, borda da ponte sem muro, curva sem muro; os atalhos levam as suas em `atalhos[k].douradas`
(índice de ponto DO ATALHO — a fase 4 decide se usa).

Os temas: Orla (calçadão de ondas pretas e brancas, mar, areia, palmeiras, guarda-sóis, quiosques, prédios de Copacabana, Pão de Açúcar,
Urca e Corcovado com o Cristo); Favela (1.500 casinhas coloridas no morro, lajes, caixas d'água, postes e fios, morros vizinhos
cobertos de casas); Deserto (dunas, cactos, pedras, mesas ao fundo); Gelo (neve, pinheiros nevados, blocos de gelo, bonecos de neve,
lago congelado, serra nevada); Vulcão (rocha, lago e rios de lava emissivos, brasas, árvores secas, o cone fumegante com cratera e
riachos de lava); Selva (árvores gigantes com cipós, palmeiras, flores gigantes, rio serpenteando, cachoeira animada); Neon (prédios
azul-arroxeados com janelas acesas e faixa neon no topo, faixas neon nos muros, arcos de luz sobre a pista, postes, skyline, lua e
estrelas); Porto (pátios de contêineres, guindastes, navios atracados, armazéns, farol, píeres com cais de pedra); Canyon (planalto em
camadas vermelhas, abismos sob os saltos e a ponte, pináculos, mesas); Maluca (arquibancadas lotadas na largada, roda-gigante girando,
balões, tendas listradas, loops de montanha-russa, arcos de luz, nuvens cor-de-rosa).

## Desempenho (SwiftShader, 1280 x 720, qualidade alta, SEM os carros)

Desenho de verdade (`renderer.info`) com a câmera de corrida em dois pontos; "cena" = tudo o que o visual pôs na cena.

| Pista | Largada: chamadas / triângulos | Meio da volta | Cena (triângulos) | Montagem do visual |
|---|---|---|---|---|
| orla | 70 / 119 mil | 73 / 134 mil | 188 mil | 346 ms |
| favela | 92 / 148 mil | 55 / 107 mil | 265 mil | 369 ms |
| deserto | 44 / 103 mil | 28 / 89 mil | 232 mil | 238 ms |
| gelo | 49 / 107 mil | 25 / 69 mil | 183 mil | 288 ms |
| vulcao | 48 / 58 mil | 35 / 43 mil | 117 mil | 238 ms |
| selva | 58 / 217 mil | 32 / 148 mil | 374 mil | 297 ms |
| neon | 88 / 221 mil | 57 / 192 mil | 248 mil | 809 ms |
| porto | 53 / 118 mil | 17 / 58 mil | 158 mil | 524 ms |
| canyon | 42 / 67 mil | 43 / 67 mil | 134 mil | 382 ms |
| maluca | 77 / 149 mil | 88 / 171 mil | 221 mil | 321 ms |

Meta do pedido: < ~150 chamadas e < ~300 mil triângulos de cenário na alta — todas passam com folga para os carros (8 carros x ~5
malhas). A BAIXA (`densidadeCenario` 0,4, `distancia` 450) corta cada bloco de instâncias para 40% (a suíte mede: ex. Favela 265 → 135
mil) e traz a neblina para 720 m.

Como chegou aí (cada número medido nesta fase):
- fita em pedaços de 100 m, UM material (Lambert + atlas de canvas em colunas: asfalto com faixas, branco, concreto, terra, perigo,
  rampa) e cor de vértice — zebra, muro, saia, laje, pilar e tampa do vão saem no mesmo desenho do pedaço;
- tudo que brilha da fita (faixas neon) numa malha por superfície: com uma por pedaço a largada da Neon desenhava 31 malhas só disso;
- objetos instanciados por BLOCO (280 m; 520 m nos prédios da Neon, 700 m nos postes): a esfera de culling única do InstancedMesh;
- peças repetidas emagrecidas: janelas da casa e do prédio e nervuras do contêiner viraram quadros de 2 triângulos (eram caixas de
  12) — a Favela caiu de 510 para 265 mil triângulos na cena e o Porto de 463 para 158 mil; copas e arbustos em icosaedro simples;
- chão em ladrilhos de 448 m, chão do horizonte num anel em volta da grade, céu como o último dos opacos (renderOrder 1000).

## Decisões

1. **Pista por pedaços com fechamento calculado** (`construtor.js`) em vez de pontos à mão: duas retas elásticas + `sobe: 'resto'`
   fecham posição e altura exatamente; a soma das curvas tem de dar múltiplo de 360° (o oito dá 0) — erro com número, nunca pista torta.
2. **Rampa** = perfil de trampolim + ponto "fantasma" 3 m depois da crista (dentro do vão): sem ele a CatmullRom achata a tangente da
   crista e o carro sairia quase reto. LANCA nos últimos ~2 m antes da crista; VÃO da crista até o pouso, 1,0–2 m mais baixo.
3. **Atalho** sempre numa boca de reta (12 m de reta antes/depois), com o caminho desenhado pela mesma tartaruga e ligado à boca de
   saída por uma Bézier; risco/recompensa por TERRA, sem muro, estreito, impulso ou rampa.
4. **Terreno** = relevo do tema corrigido por dois envelopes da pista (aterro e corte, com acostamento de 10 m > diagonal da célula de
   8 m: o chão nunca fura o asfalto); trecho elevado/ponte não segura chão; debaixo de cada vão o chão cava um FOSSO (a água/lava do
   tema enche). A saia da fita desce até o chão desenhado (mesma interpolação dos triângulos).
5. **Céu do Breno** (degradê por vértice, sem shader próprio) + `toneMapped: false` no céu: a neblina (aplicada depois do tone mapping)
   chega no horizonte com a mesma cor dele.
6. **Neon "noite de cinema"** (lição do `noite.js` do Cidade Aberta): prédios azul-arroxeados, Hemisphere 2,2, lua 2,2 — nada preto.
7. Cenário sempre igual: gerador com semente pelo id da pista (`sementeDe`), nada de `Math.random`.
8. Placas de aviso (SALTO!, LOOP!, ATALHO, CUIDADO!) 45–50 m antes de cada figura e boca de atalho.

## Contrato

- Formato da definição: o da seção 4 + campos novos que o núcleo ignora: `figuras: [{ tipo: 'rampa'|'loop'|'saca_rolha'|'paredao',
  de, ate, crista?, pouso?, ... }]`, `elevados: [{ de, ate, ponte? }]`, `marcos: { nome: { i, i0, x, y, z, psi, larg } }`,
  `comprimentoNominal`; nos atalhos `figuras`, `elevados`, `douradas`, `capsulas`. `tema` (esquema da fase 3): `estilo` (receita do
  cenário), `noite`, `ceu { topo, meio, horizonte, baixo, nuvem, nuvemBaixo }`, `sol { dir, cor, forca, disco, halo, tamanho }`,
  `hemi { ceu, chao, forca }`, `neblina { cor, perto, longe }`, `asfalto`, `faixa`, `tracejado`, `zebra[2]`, `muro[n]`, `muroTopo`,
  `muroBrilho[n]`, `estrutura`, `corTerra`, `corRampa`, `portico`, `corImpulso*`, `terreno { tipo, ... }`, `agua`/`lava { nivel, cor }`,
  `nuvens`.
- **Nada mudou em `js/pista.js`** (nem acrescentei funções: as consultas ficaram em `js/pistas/consulta.js`).
- Proposta (opcional): `Pista._montaAtalho` poderia guardar `info.sDoPonto = am.sCtrl` (o `s` dos pontos de controle do atalho);
  hoje `consulta.js` acha projetando o ponto, que dá o mesmo resultado.
- O visual expõe `sol` (DirectionalLight): quem for ligar sombra na ALTA (fase 2/6) configura a câmera de sombra dele.

## Pendências / observações para o maestro

1. **Física (fase 2) — resolvido durante esta fase.** A suíte pegou um teleporte: no chão o carro não atualizava `this.i` e, ao
   decolar (rampa, vão, borda sem muro), a busca local no ar partia da amostra da GRADE — o carro era jogado ~1 km para trás e o Vulcão
   nunca fechava a volta (caía da ponte sem muro, voltava para s≈80, repetia). O `js/carro.js` de 20:23 já atualiza o índice em
   `_anda` e `_decola`; desde então as 10 corridas de 1 volta fecham, com 0 teleportes. A suíte continua medindo cobertura da volta e
   teleportes (pulos de mais de 60 m num passo) para pegar uma volta disso.
2. **Piloto automático (stub, fase 5):** só corrige `d`, oscila de um lado para o outro (±5 m) e cai nos trechos sem muro e em alguns
   saltos (1–2 quedas por volta). A volta leva 114–184 s. Não mexi em `js/ia.js`.
3. Douradas dos atalhos estão em `atalhos[k].douradas` com índice de ponto do atalho; a fase 4 precisa decidir se lê.
4. Desempenho medido em SwiftShader; falta medir no celular de verdade (fase 7, `tools/mede.js`).
5. As quatro primeiras pistas têm a mesma "cara" na planta (retângulo com um bojo do atalho); a partir da 5 as formas variam (pentágono,
   oito com viaduto, píeres, quadrilátero com paredão). Vale um playtest para ver se a criança sente isso — se sentir, é só redesenhar
   com o construtor (o fechamento é automático).

## Rodar

```
node testes/rodar.js --so pistas fundacao --porta 8133      # FALHAS: 0 (~55 s)
node tools/foto_pistas.js [ids...] [--porta 8133] [--gpu]     # fotos em docs/fotos/pistas/ (+ folha de contato por pista)
```
