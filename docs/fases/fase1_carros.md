# Fase 1 — Carros (relatório)

Dez carros do Cidade Aberta, visualmente distintos, otimizados para o celular, normalizados e com a configuração gerada.
Tudo reprodutível por `tools/carros/` (seção 5). Fotos: `docs/fotos/carros.jpg` (3/4 da frente) e
`docs/fotos/carros_lado.jpg` (lateral, frente para a direita), todos na **mesma distância de câmera** (os tamanhos se comparam).

## 1. Resultado

| id | nome | origem (`cidadeaberta/assets/`) | poder | KB | tris | texturas | C × L × A (m) | cor |
|---|---|---|---|---:|---:|---|---|---|
| vulcao | Vulcão | vulcao.glb | terremoto | 672 | 29.596 | cor 2048×256 ETC1S · mr 512×64 UASTC | 3,75 × 2,30 × 1,19 | `#ff5a1f` |
| dourado | Dourado B7 | dourado.glb | escudo | 451 | 22.394 | idem | 4,19 × 2,30 × 1,68 | `#e2a328` |
| lagartixa | Lagartixa | porsche.glb | oleo | 484 | 23.198 | idem | 4,20 × 1,91 × 1,26 | `#57c61c` |
| picole | Picolé | sorvete.glb | congelante | 465 | 18.597 | idem | 3,25 × 2,30 × 2,31 | `#fd4d91` |
| buguinho | Buguinho | buggy.glb | encolhedor | 588 | 22.395 | idem | 4,20 × 2,23 × 1,74 | `#eb7f43` |
| kombosa | Kombosa | kombi.glb | fumaca | 404 | 18.992 | idem | 4,20 × 1,71 × 1,92 | `#3bf1a6` |
| tubarao | Tubarão | shark.glb | ima | 828 | 34.779 | cor 1024² ETC1S · mr 256² UASTC · normal 512² UASTC | 3,34 × 1,57 × 2,60 | `#3d98d3` |
| voador | Voador | yarisvoador.glb | tornado | 556 | 24.796 | cor 2048×256 ETC1S · mr 512×64 UASTC | 4,20 × 2,22 × 1,34 | `#d71517` |
| faisca | Faísca | seal.glb | emp | 516 | 22.395 | idem | 4,20 × 1,92 × 1,30 | `#d7d6d3` |
| jatinho | Jatinho | kart_jato.glb | trocatroca | 662 | 26.797 | idem | 3,50 × 2,30 × 1,12 | `#2040d9` |

Total **5.625 KB** (≈ 7,3 MB em base64 no HTML único). Todos < 1,5 MB e nenhum acima do ideal de 500–900 KB (quatro abaixo).
Origem: 12–22 MB cada (400 mil triângulos no shark). `CARRO_PADRAO = 'vulcao'` (o do modelo de config do pedido).

Atributos (1–5, soma 16 em todos; cada atributo tem um carro com 5) — **até 31/10/2026**: desde então todos têm o mesmo nível
(velocidade 4, o resto 3; pedido: "ganhe quem utilizar melhor os turbos e os poderes"). A tabela abaixo é a da fase 1:

| id | vel | acel | ctrl | peso | turbo | por quê (resumo) |
|---|---|---|---|---|---|---|
| vulcao | 4 | 3 | 2 | 4 | 3 | hot rod de pedra, rodas traseiras enormes, pesado e duro de virar |
| dourado | **5** | 3 | 3 | 2 | 3 | carro de corrida clássico: a maior velocidade final |
| lagartixa | 3 | 4 | **5** | 2 | 2 | esportivo baixo: gruda na curva |
| picole | 2 | 2 | 3 | **5** | 4 | caminhão alto e pesado, compensa no turbo |
| buguinho | 3 | 4 | 4 | 2 | 3 | bugue leve, arranca e pula bem |
| kombosa | 2 | 3 | 3 | 4 | 4 | van alta e pesada |
| tubarao | 3 | 2 | 2 | **5** | 4 | monster truck: o mais pesado, lento para sair |
| voador | 4 | 3 | 3 | 1 | **5** | turbinas: o maior turbo, o mais leve, escorrega como hovercraft |
| faisca | 4 | **5** | 3 | 2 | 2 | elétrico: arranca de uma vez |
| jatinho | 3 | 4 | **5** | 1 | 3 | kart: o mais leve e ágil |

## 2. Escolhas e trocas

Olhando as fotos das origens (as sugeridas + 24 alternativas), a lista sugerida foi mantida com **uma troca de carro**:

- **Fuscão (`fusca.glb`) → Buguinho (`buggy.glb`)**, mesmo poder (`encolhedor`). O Fusca sugerido é **branco** como o seal
  (mesma cor principal). Tentei os dois Fuscas: a `body_lo` do `fusca.glb` tem cacos pretos na lataria (UV do mklod antigo) e
  a do `fusca_teto.glb` (vermelho) tem o **forro claro da porta atravessando a lataria** decimada e furos no pé da porta
  (`docs/fotos/carros_fusca_descartado.jpg`: malha cheia × `_lo` original × `_lo` repintada — idênticas, porque o defeito é de
  geometria). A malha cheia do fusca_teto não simplifica: sem `Permissive` o meshopt trava em 103 mil triângulos (costuras de UV
  do Meshy); com `Permissive` a lataria vira mosaico de cartas erradas (fotografado). O bugue entra **laranja** (a única cor
  livre do grid), silhueta única (aberto, santantônio) e mantém a ideia: o bugue de praia brasileiro nasce sobre chassi de Fusca.
- **Voador: turbinas recolhidas.** O `yarisvoador.glb` guarda os pods **abertos** (modo voo do Cidade Aberta); com eles a
  largura de 3,36 m limita a escala e o carro fica com **2,74 m** (metade dos outros). Recolhidos pelo `slide` de cada pod (o
  mesmo cálculo do `vehicles.js`: `x − side × slide`) ele tem 4,2 m e o brilho azul das turbinas aparece por baixo da carroceria
  (`docs/fotos/carros_voador_pods.jpg`). O jogo pode abrir as turbinas como efeito: `pod.position.x += side × slide`.
- Pares que conferi de perto e mantive: Voador (preto/vermelho/branco, chato, com pods) × nenhum outro vermelho; Picolé
  (turquesa/rosa, alto, casquinha no teto) × Faísca (sedã branco baixo); Lagartixa (verde-limão, baixo) × Kombosa (menta, van);
  Tubarão (azul-céu, monstro) × Jatinho (azul royal, kart). Silhueta e tom dominante diferem em todos.
- Nomes sem marca. **Mas as texturas herdadas têm logotipos** (VW na Kombosa, Toyota/GR no Voador, brasão no Lagartixa) — ver
  pendências.

## 3. Como o jogo carrega (o contrato)

**Carga:** `GLTFLoader` (r170) + `KTX2Loader` com o transcoder de `lib/addons/libs/basis/` e **`detectSupport(renderer)` antes
do primeiro GLB** + `setMeshoptDecoder(MeshoptDecoder)`. É exatamente o `js/glb.js` da fundação; `KHR_mesh_quantization` o
GLTFLoader trata sozinho. Extensões obrigatórias em todos: `EXT_meshopt_compression`, `KHR_mesh_quantization`,
`KHR_texture_basisu`. Conferido pelo `js/glb.js` + `js/modelo_carro.js` reais (seção 6).

**Hierarquia (nomes de nó):**

```
cena
└─ carro            extras { id, nome, origem, rodas: true|false, escala, limitadaPor, medidas{comprimento,largura,altura},
   │                         [voador: flutua, pods: 'recolhidos'] }
   ├─ body          SEM malha, na origem: o jogo inclina ESTE nó (rolagem/arfagem)
   │  ├─ body_malha (a malha; a quantização põe translation/scale AQUI — por isso o pivô é o pai)
   │  └─ pod0..pod3 (só no Voador: filhos do body, inclinam junto; extras { side, slide (m), aberto: false })
   │     └─ podN_malha
   └─ wheel1..4     SEM malha, translation = EIXO da roda; extras { radius (m, de contato), front, side }
      └─ wheelN_malha  centrada no pivô
```

- wheel1/2 = frente (+Z), wheel3/4 = trás; `side` 1 = +X. Rodar: `wheelN.rotation.x`. **Esterçar no mesmo nó:** use
  `wheelN.rotation.order = 'YXZ'` (senão o giro de rolagem passa a ser em volta do eixo já esterçado).
- Frente **+Z**, cima +Y, metros; x e z no centro da caixa; **y = 0 no ponto mais baixo das rodas** (Voador: do carro).
- `config/carros.js` traz `rodas.raioFrente/raioTras` (média por eixo) e, no Voador, `rodas: { tem: false, flutua: 0.205,
  pods: 'recolhidos' }` (`flutua` = quanto ele pairava no Cidade Aberta, já na escala nova; a altura de voo é do jogo).

**Espaço de cor:** cor em **sRGB** (DFD do KTX2 com OETF sRGB; o GLTFLoader marca `SRGBColorSpace`), metal/rugosidade e normal
**lineares** (o KTX2Loader marca `srgb-linear`). `renderer.outputColorSpace = SRGBColorSpace`. **Não reatribua `colorSpace`.**
Amostrador: `CLAMP_TO_EDGE` (a textura é recortada de borda a borda) com `LINEAR_MIPMAP_LINEAR`; todas com mipmaps.
Material: um por carro, `MeshStandardMaterial` com `doubleSided` (como na origem: as cascas do Meshy não são fechadas).

**Cuidados:** a geometria é quantizada (posição int16 normalizada com escala/deslocamento no nó `*_malha`, normal int8
octaédrica, UV uint16): **não mescle geometrias** de malhas diferentes (escalas de quantização diferentes embaralham UV —
armadilha registrada no dinotrails-web) e não leia `position` como metros sem a matriz do nó (`Box3.setFromObject` já faz certo).
O `modelo_carro.js` clona a cena e compartilha geometria/material com o cache — não dar `dispose`.

## 4. Decisões medidas

**Malhas `_lo` em vez das cheias (pedido) — e o que elas são de verdade:** as `_lo` do Cidade Aberta (`lodatlas.py`) usam uma
**faixa própria do atlas, v de 0,875 a 1** (12,5 % de baixo; medido nos 9 carros `lo`: v mínimo 0,8756), pintada a partir do
modelo cheio. Na escala de jogo elas ficam iguais às cheias (comparado em foto). Consequências:
- a textura de cor é **recortada** nessa faixa na resolução original do LOD: **2048 × 256** (reduzir o atlas inteiro para 1024
  deixaria o LOD com 1024 × 128, metade da nitidez). Custa ~100–135 KB em ETC1S;
- o mapa de normais na faixa é **plano** (128,128,255 em toda a faixa): **descartado** nos 9 carros `lo` (−200 KB cada);
- as `_lo` são **sopa de triângulos** (3 vértices por triângulo: 72.000 vértices para 24.000 triângulos no vulcão). A solda
  junta o que é igual em posição + UV e normais a menos de 2° (medido: 16 mil dos 26 mil cantos do vulcão diferem < 0,5°,
  sobra de arredondamento); vincos de verdade ficam. Vulcão: 72.000 → 41.157 vértices.
- **Tubarão (sem `_lo`)**: malha cheia simplificada com meshopt. Carroceria com `Permissive` (128 mil → 18 mil, erro 0,8 cm,
  textura limpa na foto); rodas **sem** `Permissive` (com ele o pneu ganhou pintas azuis da carroceria: o colapso atravessa a
  costura de UV), param sozinhas em ~4,5 mil cada. Total 34,8 mil. Textura: atlas da malha cheia (v 0–0,875) esticado para
  1024², mr 256², normal 512² (aqui o mapa tem detalhe de verdade: os cravos do pneu).
- **Dourado: wheel3 = wheel4 espelhada.** A `wheel3_lo` não tem o topo do pneu (36 cm de raio em cima contra 43 no resto):
  girando, o buraco passava embaixo e o pneu pulava 3 cm.
- **Chapa de cor única** (assoalho do `assoalho.py`: triângulos todos na mesma UV): não conta para a janela de textura; se a UV
  dela cair fora da faixa, ganha um bloco 8×8 com a cor dela (nenhum dos 10 finais precisou; o fusca_teto precisava).

**Texturas** (PSNR sempre contra a mesma referência cheia — o menor é ampliado de volta; comparar resoluções diferentes direto
engana, e enganou numa primeira medida):

| mapa | escolha | por quê (medido) |
|---|---|---|
| cor | ETC1S q200, mipmaps, sRGB | atlas 1024: UASTC 1.111 KB × ETC1S q200 237 KB (30,3 dB); q255 só +0,3 dB por +25 KB. Faixa 2048×256: 98–135 KB, 24,7–30,9 dB |
| metal/rugosidade | UASTC + RDO 2 + zstd, 1/4 do lado da cor (512×64; 256²) | mesmo tamanho: ETC1S cheio empata ou perde (shark 34,7 × 35,3 dB; fusca_teto 21,7 × 25,0 dB: G e B independentes). UASTC cheio daria 41 dB por +90 KB por carro |
| normal | UASTC + RDO 2, 512², só no Tubarão | 128 KB, 42,9 dB |

Toda textura é decodificada de volta pelo **transcoder do jogo** (`lib/addons/libs/basis`) antes de entrar no GLB: prova que o
KTX2 do encoder Basis v2.5 (pacote `ktx2-encoder`) abre no transcoder do three r170 e confere o OETF (cor sRGB, resto linear).

**Geometria:** `reorder` + `quantize` (posição 14 bits, UV 14) + `EXT_meshopt_compression` com filtro (normal octaédrica 8 bits).
Menos bits **não** diminui o arquivo (vulcão: 14/14 → 11/12 bits = 766,7 → 766,0 KB): o `quantize` do gltf-transform replica os
bits altos nos baixos (para o normalizado chegar a 1,0) e o codec do meshopt não ganha nada. UV em 14 porque o lodatlas deixa só
1 texel de margem entre cartas na textura de 2048. A geometria é 60–75 % do arquivo (~10 bytes por vértice; o atlas do LOD é
picado em muitas cartas: 1,5–1,7 vértice por triângulo).

**Normalização:** `s = min(4,2/C, 2,3/L, 2,6/A)` sobre a caixa do carro inteiro (pedido). Quem fica menor e por quê: Picolé
3,25 m e Tubarão 3,34 m (limitados pela largura do toldo/casquinha e pela altura da barbatana), Jatinho 3,5 m (kart largo),
Vulcão 3,75 m (rodas traseiras largas).

**Eixo das rodas:** o centro "pela caixa" falha com pneu de topo cortado (dourado: centro 1,6 cm baixo, pneu 0,8 cm dentro do
chão) e com cravo/saliência (shark: +6 cm em cima). O pivô é o **círculo ajustado na banda de rodagem** (vértices a ≥ 85 % do
raio, Kasa, 4 voltas); raio = do eixo ao ponto mais baixo do pneu (contato). Fica a 0,1–1,8 cm do eixo de consenso do Cidade
Aberta (a diferença é quase toda em x, a largura do pneu).

**Cor de destaque:** amostrada na textura pela área real de cada triângulo (preto de pneu/vidro domina e foi ignorado); matiz da
pintura, escolhida sem repetir no HUD (o Picolé ficou com o rosa da bola de sorvete porque o turquesa brigava com o Tubarão; o
Vulcão com o laranja da lava, `#ff5a1f`, porque o vermelho puro é do Voador; Jatinho e Buguinho com o brilho levantado).

## 5. Reproduzir

```
node tools/carros/otimiza.mjs [id ...]   # origem -> assets/cars/<id>.glb + tools/carros/medidas.json (~50 s os 10)
node tools/carros/gera_config.mjs        # tabela.mjs + medidas.json -> config/carros.js (confere soma 16, 1 poder por carro)
node tools/carros/confere.mjs [id ...]   # Chromium/SwiftShader: nós, extras, caixa, frente, eixo, cor; integração (sem ids)
node tools/carros/valida.mjs             # validador do Khronos (npm install --no-save gltf-validator)
node tools/carros/folha.mjs              # docs/fotos/carros.jpg e carros_lado.png (--origem a b c: fotos das ORIGENS)
```
Arquivos: `tabela.mjs` (origem → id e toda decisão de projeto), `otimiza.mjs` (pipeline), `geometria.mjs` (extrai, solda,
simplifica, eixo da roda), `texturas.mjs` (KTX2 decodifica/codifica em Node), `chapa.mjs`, `comum.mjs` (servidor + Chromium),
`folha.html` (página de foto e conferência, mesmo carregador do jogo), `medidas.json` e `conferencia.json` (registros).
Do zero (apagando GLB e medidas) os 5 comandos rodam em ~1 min; o mesmo carro refeito sai igual byte a byte.

## 6. Verificação (feita e aprovada)

- **`confere.mjs`: APROVADO nos 10**, console e rede sem erro. Por carro: nós `carro`, `body`, `wheel1..4` (`pod0..3`), pivôs sem
  malha, extras; caixa com y mínimo 0 (|y| ≤ 1,3 mm), centro x/z 0, a regra de escala; rodas da frente em +Z; **excentricidade
  do eixo ≤ 0,07 cm** em todas as rodas (círculo da banda × pivô, medido no three depois de carregar — a quantização não mexeu
  no pivô); nenhum pneu com pedaço faltando; girando `rotation.x` em 12 ângulos o centro da caixa da roda anda ≤ 0,44 cm em
  seis carros, 1,5 cm no Vulcão, 1,4 cm no Buguinho e 2,9 cm no Tubarão — o que o perfil do próprio pneu explica (pneu do Meshy
  oval em 1,7 cm no Vulcão e 2,2 cm no bugue; cravos de 50 a 54 cm de raio no Tubarão); eixo − raio ≤ 0,9 cm (o bugue tem a traseira 0,9 cm acima do chão, como na
  origem); cor comprimida + mipmaps + sRGB, dados lineares.
- **Integração:** os 10 pelo `js/glb.js` + `js/modelo_carro.js` da fundação com o `config/carros.js` gerado: `carroceria = body`,
  4 rodas (0 no Voador) com raio/frente/lado certos, nenhuma malha caiu na cor de reserva.
- **Validador do Khronos 2.0.0-dev.3.10: zero erro.** Os avisos são todos esperados: ele não conhece `KHR_texture_basisu`
  (acusa o mimeType `image/ktx2`) e, no Tubarão, normal sem TANGENT (o three gera por derivada, como na origem).
- **Fotos olhadas:** texturas certas (nada preto/branco/rosa), faróis na frente na vista 3/4, frentes para a direita na lateral,
  pneus no chão, os 10 distintos. O SwiftShader oferece ASTC, ETC1/ETC2, BC1–3 e BC7: o KTX2Loader transcodificou a cor (ETC1S)
  para BC7 e os mapas UASTC para ASTC 4×4. No celular sai ETC2/ASTC, conforme o aparelho.
- **Determinismo:** refazer um carro dá o mesmo arquivo byte a byte (sha256 igual em duas rodadas).

## 7. Problemas que custaram tempo (para quem mexer depois)

- **A `_lo` não é a malha cheia reduzida:** faixa própria do atlas, normal plano na faixa, sopa de triângulos.
- **`Permissive` do meshopt suja a textura** nos GLB do Meshy (colapso atravessa costura de UV): ok na carroceria do shark (14 %),
  mosaico no fusca_teto (10 %), pintas no pneu do shark (2,8 %). Carro novo em fonte `alta`: olhe a foto de perto.
- **Repintar a faixa do LOD não cura defeito de geometria** (o forro interno atravessando a lataria aparece com qualquer
  textura). Testado com ponto mais próximo e com raio vindo de fora; o código saiu do pipeline.
- **Chromium headless marca `net::ERR_ABORTED` em pedido já entregue inteiro** (o FileLoader do three lê o corpo até o fim; o
  servidor confirma `finish`). Não é erro de carga: `comum.mjs` só aceita quando o servidor confirmou a entrega; o resto reprova.
- O encoder Basis v2.5 imprime cada fatia mesmo com `setDebug(false)`: precisa de `setStatusOutput(false)`.
- O transcoder do three (`basis_transcoder.js`, UMD do Emscripten) roda em Node dentro de um `vm` — é o jeito de decodificar o
  UASTC de origem sem toktx.

## 8. Pendências

1. **Logotipos nas texturas** herdadas (VW na frente da Kombosa, Toyota/"GR" no Voador, brasão no capô do Lagartixa). Os nomes
   não têm marca; se for preciso, repintar essas regiões da faixa do LOD (`tools/carros/texturas.mjs` já decodifica/codifica).
2. **Fusca fora do grid**: volta se alguém refizer a `body_lo` do `fusca_teto` no Cidade Aberta (o forro da porta atravessa a
   lataria) — candidato a 11º carro.
3. **Tamanhos desiguais pela regra de normalização:** Picolé 3,25 m e Tubarão 3,34 m de comprimento. Se a física quiser
   comprimentos iguais, a regra (pedido da fase) tem de mudar — hoje tudo cabe em 4,2 × 2,3 × 2,6 m.
4. **Rodas não perfeitamente redondas** (do Meshy): Tubarão sobe/desce até ~4 cm rolando (cravos), Buguinho ~2 cm, Vulcão ~1,5 cm. Para a física
   de arcade o carro anda sobre a pista, não sobre a malha da roda — só visual.
5. Materiais `doubleSided` (herdado; custa preenchimento no celular). Tirar exige conferir normais/ordem dos cantos do Meshy.
6. Pacote npm instalado **sem salvar** no `package.json`: `gltf-validator` (só para `tools/carros/valida.mjs`).

## 9. Os carros novos do Cidade Aberta (30/10/2026; Pro Stock fora e nomes do Cidade Aberta em 31/10/2026)

Pedido do Morassi: "coloque o Toyota Prius e os carros com pops and bangs do jogo Cidade Aberta disponíveis para jogar". Entraram o
**Prius** e os 15 SPECS do `cidadeaberta/js/carmodels.js` que estouram (`turbo`, `proStock`; o `pops` é o Porsche, que já era a
Lagartixa). Todos na fonte `lo`, pelo mesmo `otimiza.mjs` (378–513 KB, 18,6–23,4 mil triângulos). No dia seguinte (31/10/2026) os 7
**Pro Stock saíram** ("remover os carros pro stock": GLB, medidas e o tipo de pipoco `prostock`) e **todos os 19 passaram a usar o
nome do Cidade Aberta** (o `name` do SPECS sem o emoji; os 10 da fase 1 tinham apelido — Vulcão, Lagartixa, Picolé, Buguinho,
Kombosa, Tubarão, Voador, Faísca, Jatinho, Dourado B7). O `id` não muda: o save guarda o carro pelo id. `confere.mjs` aprova os 19.

- **Furgão**: as `wheel2_lo` e `wheel4_lo` cortam o pneu (setor com 90–91 % do raio): `espelha: { wheel2: 'wheel1', wheel4: 'wheel3' }`.
- **Fusca Teto Solar**: a `body_lo` do Cidade Aberta tem o defeito de geometria da seção 2. `tools/carros/refaz_lod.mjs` (+
  `refaz_lod.py`, as funções do `cidadeaberta/tools/lodatlas.py`) refaz a versão leve numa cópia do GLB em `tools/carros/cache/`
  (`refeita: true` na tabela): (1) só a **pele de fora** da malha cheia (z-buffer de pontos em 9 vistas, a amostra conta só virada para
  quem olha), (2) as **rachaduras** da lataria (laço de borda < 60 cm) tampadas em leque e a visibilidade de novo, (3) redução com o
  meshopt soldando só por posição, (4) a malha leve vista de fora (o triângulo escondido sai; o resto fica virado para o lado de onde
  foi visto; furos < 60 cm tampados de novo), (5) **cartas novas na faixa** de 2048 × 256 (a carroceria e as quatro rodas leves de
  origem, que apontavam para a mesma faixa) e cada texel pintado pela amostra **vista de fora** mais "de fora" entre as 16 mais perto
  que concordam com a normal suave. O otimiza lê PNG ou KTX2. Resultado: sem o forro claro e sem os furos grandes; de perto, a porta
  ainda tem pontinhos escuros (frestas entre pedaços de camadas a menos de 2,5 mm uma da outra). Tentado e descartado: exigir metade
  das amostras do triângulo vistas (tirou os vidros, que ficam 2 mm para dentro da moldura) e refazer a lataria por voxel + marching
  cubes (fechou as frestas, mas a casca saiu dos dois lados da lataria e ficou facetada e manchada).
- **Escapamento**: os canos do Cidade Aberta (`SPECS.<tipo>.exhaust`, metros do GLB de origem) vão para o carro daqui pela mesma conta
  da normalização — o otimiza grava `transforma: { origem, escala }` em `medidas.json` e o `gera_config.mjs` converte.
