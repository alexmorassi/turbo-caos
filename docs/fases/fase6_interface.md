# Fase 6 — interface, HUD, áudio, vibração, salvamento e qualidade

Estado: **pronta**. `node testes/rodar.js --so telas save audio fundacao --porta 8136` → **FALHAS: 0** no desktop, com
`--mobile pixel` e com `--mobile iphone` (com as 10 pistas da fase 3 e os 10 carros da fase 1). Fotos de todas as telas em 5 aparelhos
em `docs/fotos/telas/`, olhadas uma a uma (o que corrigi depois de olhar está na seção 8).

Linguagem visual: a do **Breno e o Tesouro do Pirata Morassi** (`/home/claude/referencias/breno`) — botões redondos grandes com
emoji/SVG, painéis creme de borda grossa, sombra "de brinquedo", letras grossas com contorno, quase nenhum texto — com a paleta do
Turbo Caos (noite `#0b1630`, céu `#2a4fb8`, fogo `#ffe45c → #ff7a1a → #e8321a`). O som segue o sintetizador do Breno (`audio.js` dele).

## 1. Arquivos

| Arquivo | O que é |
|---|---|
| `css/jogo.css` | visual das telas, do HUD e a decoração dos botões de toque da fase 2 (tudo escopado em `#ui`/`#hud`) |
| `js/telas.js` | as telas e o fluxo (menu, carro, pista, carga, corrida/pausa, resultado/pódio, campeonato, opções, confirmação) |
| `js/vitrine.js` | cena 3D dos menus: plataforma giratória com lâmpadas e o pódio com confete e facho de luz |
| `js/hud.js` | HUD da corrida + decoração de `#btn-turbo .deco` e `#btn-poder .deco` |
| `js/minimapa.js` | minimapa em canvas 2D (pista pré-desenhada, pontos dos carros) |
| `js/audio.js` | WebAudio sintetizado: barramentos, 43 efeitos, motores, laços de turbo/derrapagem, eventos |
| `js/musica.js` | sequenciador procedural (bateria + baixo + acorde/arpejo + melodia), 14 temas, tema por pista |
| `js/vibracao.js` | `vibra(ms|padrão)` com opção, limite de 110 ms e só depois de um gesto |
| `js/save.js` | ampliado sem mudar a API (`le/grava/apaga/falhou` + `remove`, `opcoes`, `mudaOpcoes`, sonda, `?sem_armazenamento=1`) |
| `js/qualidade.js` | baixa/média/alta + AUTO pelo fps medido, trava em 30 fps |
| `testes/teste_telas.js`, `teste_save.js`, `teste_audio.js` | as três suítes (seção 7) |
| `tools/foto_telas.js` | fotos de todas as telas em aparelho emulado deitado |
| `docs/fotos/telas/*.jpg` | 60 fotos (12 telas × pixel, iphone, pequeno, tablet, desktop) |

## 2. Telas

Fluxo: **Menu** (logo, 🏆 CAMPEONATO, 🏁 CORRIDA LIVRE, ⚙️, tela cheia, placar de pistas abertas/vitórias, o carro escolhido girando
na vitrine) → **Seleção de carro** (carro 3D na plataforma, setas ◀ ▶ e deslizar o dedo, nome grande, 5 barras de atributo 1–5,
cartão do poder com ícone/nome/descrição/**esquiva**, pontinhos com a cor dos 10 carros, ✔ verde) → **Seleção de pista** (cartões
rolando para o lado: número, ícone do tema, **desenho da pista vista de cima** gerado da spline, nome, recorde, 🔒 nas trancadas,
anel dourado pulsando na próxima a correr) → **Carga** (ícone do tema, nome, barra, dica do poder do carro ou dica geral) →
**Corrida** (HUD + botão de pausa) → **Pausa** (▶ continuar, 🔁 reiniciar, 🏠 sair) → **Resultado** (pódio 3D com os três primeiros
carros de verdade, título "VOCÊ VENCEU!"/"2º LUGAR!"/"5º lugar", estrelas, selos de recorde e de pista nova, tabela com
posição/tempo/melhor volta, botões ▶ próxima / 🔁 de novo / 🏠 menu) → **Campeonato** (trilha das 10 etapas, tabela de pontos,
próxima pista com o desenho, ▶ correr; no fim, cerimônia de campeão).

- **Campeonato**: sem campeonato salvo, CAMPEONATO pede o carro e chama `G.jogo.campeonato(true)`. O carro fica o do campeonato
  (`c.carro`) — trocar no meio misturaria os pontos, que o `jogo.js` guarda por id de carro. Os rivais são **fixos**
  (`rivaisDoCampeonato`: os carros na ordem da config, menos o do jogador) e vão em `opcoes.rivais`: tabela de pontos só faz sentido
  com os mesmos adversários em todas as pistas. Não subir no pódio = corre a mesma pista de novo (regra do `jogo.js`).
- **Corrida livre**: todas as pistas aparecem; só as desbloqueadas largam (a trancada faz "boing", treme e vibra 20 ms).
- **Opções**: direção (🔘 Botões / 🕹️ Joystick / 📱 Inclinar — este só em celular), acelerar sozinho, gráficos
  (Auto/Baixa/Média/Alta), volume da música e dos efeitos (deslizadores), vibração (só onde `navigator.vibrate` existe — no iPhone
  some), aviso discreto se o armazenamento falhou, 🗑️ apagar progresso com confirmação (apaga progresso, carro, campeonato e DDA;
  mantém as opções).
- `mostra('corrida_direta', { pista, carro })` (o `?pista=` do main.js) larga sem passar pelos menus. `#carregando` some no fim do
  `inicia()`, depois de o carro do menu carregar (no máximo 5 s de espera; com `?teste=` não espera).
- **Tela cheia**: no primeiro toque *de verdade* (click/pointerup/touchend — `pointerdown` de dedo não conta como gesto para o
  navegador) em celular: `requestFullscreen` + `screen.orientation.lock('landscape')`, tudo em try/catch. No iPhone não há tela cheia
  para página: o layout já ocupa 100dvh e o `#gire` do index.html pede para deitar. Nunca se pede "adicionar à tela inicial".
- **Fontes**: Baloo 2 (texto) e Bungee (títulos e números do HUD) do Google Fonts, como nos jogos de referência (mudança de regra do
  maestro). O `<link>` é injetado pelo `telas.inicia()` e **não** entra com `?teste=`, `?foto=` ou `?semente=` (a bateria, o `--html` e
  o `--artefato` rodam sem internet — o Google Fonts é bloqueado aqui — e um "Failed to load resource" reprovaria). Sem a fonte tudo cai
  na fonte do sistema: `font-synthesis: none` + peso 900 fazem o Bungee ficar como é e o fallback sair grosso em vez de fino.
- Teclado (desenvolvimento): ←/→ trocam carro, Enter escolhe, Esc volta; na corrida Esc/P pausam (a tecla e a ação `pausa` da entrada
  não dobram: 300 ms de anti-repetição).

## 3. HUD

Esquerda em cima: **posição** enorme (`3º/8`, dourada brilhando em 1º, pula quando sobe — e toca `ultrapassou`), pílula com
🏁 volta `2/3` e tempo `1:23.4`, barra de 🔥 **turbo** (brilha cheia, fogo com o turbo ligado, cinza vazia) e os ícones dos efeitos
sobre o jogador (❄️ gelo, 🌀 rodopio, 🌪️ levantado, ⚡ sem turbo, 🔻 encolhido, e o ícone de cada poder ativo de `ativosEm`). Direita:
**minimapa** abaixo do botão de pausa (reta de largada sempre para cima; atalhos tracejados em amarelo; um ponto por carro na cor do
carro; o jogador maior, com anel branco pulsando). Centro: **contagem 3-2-1-VAI!** enorme (vermelho, laranja, amarelo, verde), faixa
**ÚLTIMA VOLTA!** atravessando a tela, **avisos** curtos com emoji (no máximo 3, 1,7 s, sem repetir o mesmo em 0,9 s). Tela inteira:
**fumaça** pela `mod.visao`, borda de **gelo** com `efeitos.gelo`, **clarão vermelho + tremida** na batida forte (no máximo a cada
0,8 s; a onomatopeia "PAM!/BUM!/CRASH!/POW!" a cada 1,5 s).

Avisos por evento: poder recebido ("Congelou! Toque PODER!", "Óleo! Segura!", "Turbo desligado!"...), poder usado pelo jogador (o nome
do poder), acertou/bloqueou/escapou/errou, turbo cheio, turbo vazio, cápsula dourada, caiu, volta N, chegada ("VOCÊ VENCEU!"), poder
pronto. Botões da fase 2: `#btn-poder .deco` ganha o ícone do poder do carro e um **anel cônico** de recarga
(`corrida.poderes.recarga`), pulsando quando pronto; `#btn-turbo .deco` ganha a **carga** subindo de baixo e o 🔥.

Leveza: o DOM só é escrito quando o valor muda (décimo de segundo inteiro, 1% de turbo, bits de classe), o minimapa redesenha a cada
3 passos com a pista pré-desenhada num canvas de fundo, os efeitos a cada 6 passos por máscara de bits — **nada alocado no passo**.
Tudo que some sozinho conta tempo de **simulação** (com `?teste=` o harness anda o tempo).

## 4. Áudio

WebAudio 100% sintetizado (nenhum arquivo). Grafo: `música + efeitos (+ motores dentro dos efeitos) → geral → compressor (limitador do
Breno) → corte 0,8 → saída`. Níveis-base do Breno (música bem abaixo dos efeitos); volumes da tela de opções em cima.
- **43 efeitos** (`toca(nome, { vol, tom, pos })`): interface `clique voltar trocar confirmar bloqueado desbloqueio recorde estrela`;
  corrida `bipe largada volta ultima_volta ultrapassou chegada vitoria derrota capsula capsula_dourada turbo turbo_vazio turbo_cheio
  batida batida_forte raspao pouso decolou queda reaparece acerto_bom acerto_ruim esquiva escudo_bloqueia gelo_quebra`; e um por poder
  com o **id do poder**: `oleo emp congelante ima trocatroca encolhedor fumaca tornado escudo terremoto`. Clima de desenho animado
  (batida é "PAM!" com boing, queda é apito descendo + plof). Anti-metralhadora: o mesmo nome não toca duas vezes em 60 ms; teto de
  14 vozes (rouba a mais velha); posicional barato (ganho pela distância até a câmera, lado pelo StereoPanner).
- **Eventos ouvidos** (seção 3 do contrato): contagem → bipes e largada; volta/última volta/chegada do jogador; batida (jogador cheio,
  rival posicional; forte ≥ 12 m/s; raspão de muro fraco); pouso, decolagem, queda, volta à pista; drift liga o chiado; turbo
  liga/vazio; cápsula (dourada); `poder:usa` toca o som do poder (do jogador cheio, do rival posicional); acerto/bloqueio/esquiva/fim
  do gelo; pausa abaixa a música.
- **Motor** contínuo do jogador com **pseudo-marchas** (o giro sobe e cai na troca), timbre por carro: Faísca elétrico (zumbido do
  inversor, o do Cidade Aberta), Voador e Jatinho turbina, Vulcão/Tubarão/Picolé/Kombosa graves, os outros "motor". Dois motores leves
  para os **2 rivais mais perto** (ganho pela distância, panorama). Sopro do **turbo** e chiado da **derrapagem** são laços de ruído
  sempre montados (criar nó a cada aperto estala no celular).
- **Música**: 14 temas — `menu`, `podio` e um por estilo de pista: Orla=praia (samba-funk), Favela=funk (tamborzão), Deserto=deserto
  (menor harmônica), Gelo=gelo (sino e arpejo), Vulcão=vulcao, Selva=selva (bongôs), Cidade Neon=cidade (eletrônico), Porto=porto (ska),
  Canyon=montanha (rock de estrada), Pista Maluca=maluca (158 bpm); mais `espaco` e `doces` sobrando. A escolha: `tema.musica` se a
  pista mandar → palavra no id/nome/`tema.estilo`/`tema.terreno.tipo` → ordem no campeonato. Melodia gerada com semente por tema
  (sempre a mesma: loop reconhecível). Crossfade de 0,8 s; **cada troca cria um tocador novo** e quem está saindo nunca é
  reaproveitado — três trocas seguidas deixam só a última tocando, no volume cheio (medido no teste).
- `desbloqueia()` no primeiro toque (e o buffer mudo do iPhone); o que for pedido antes (a música do menu) começa quando o contexto
  nasce. `suspende()`/`retoma()` na aba escondida; suspenso de propósito não empilha efeito. `?mudo=1` = nenhum AudioContext; sem
  WebAudio tudo vira no-op. Sorteio de enfeite do áudio tem gerador próprio (não consome o `Math.random` semeado da bateria).

## 5. Vibração, salvamento, qualidade

- **Vibração**: só o carro do jogador — batida ≥ 7 m/s (40 ms; ≥ 12,6 m/s padrão forte), pouso ≥ 6 m/s, queda, poder recebido
  (congelado tem padrão próprio). Máx. 1 chamada a cada 110 ms (regra do Cidade Aberta); antes do primeiro gesto não chama (o Chrome
  bloquearia e escreveria um "[Intervention]"); opção liga/desliga.
- **Salvamento**: sonda no carregamento (o aviso das opções já sabe na primeira tela), `remove(chave)`, `opcoes()`/`mudaOpcoes()` com
  padrões num lugar só (`OPCOES_PADRAO`; `controle` e `acelAuto` são **os mesmos campos que a entrada da fase 2 lê e grava**),
  `?sem_armazenamento=1` (localStorage levantando exceção no simples acesso — para o teste e para ver o aviso).
- **Qualidade**: os três níveis da fundação (`pixelRatio 1/1,5/2`, sombras, densidade, distância, partículas). AUTO por padrão: começa
  na MÉDIA em celular (`pointer: coarse` ou userAgent) e na ALTA no desktop — ou no nível que o aparelho já aprendeu
  (`qualidade_auto`); mede só com a corrida correndo, ignora 2,5 s depois da largada/troca (primeiro desenho compila programas),
  desce um nível com < 50 fps por 3 s, e na baixa < 45 fps trava `limiteFps = 30`; nunca sobe sozinho; manual desliga o auto;
  "Auto" de novo esquece o aprendido. Emite `qualidade:muda`. Aplica o pixelRatio no renderer na hora (o `ajusta()` do laço confirma).
  `?teste=`/`?foto=` não medem.

## 6. Vitrine 3D

Cena própria (G.desenho = a dela enquanto ativa): céu em degradê por cor de vértice, leque de raios girando devagar, chão com brilho,
plataforma listrada amarelo/laranja com 28 lâmpadas piscando em sequência (1 InstancedMesh), mancha de sombra em textura, três luzes
(sol quente, contraluz azul, lateral). Pódio: degraus ouro/prata/bronze com o número na frente, os carros de lado olhando para o meio,
facho de luz no 1º, 260 confetes (1 draw call) reciclando sem alocar, câmera balançando. O carro fica onde a tela manda
(`setViewOffset`: à esquerda na seleção, à direita no menu) e a câmera recua em tela mais quadrada (tablet 4:3). Carros por
`criaModeloCarro`, um clone por carro guardado; **nunca** dá dispose na malha do GLB (cache compartilhado); pedido com ficha (deslizar
rápido mostra só o último carro).

## 7. Testes

```
node testes/rodar.js --so telas save audio fundacao --porta 8136                 # FALHAS: 0
node testes/rodar.js --so telas save audio fundacao --porta 8136 --mobile pixel  # FALHAS: 0
node testes/rodar.js --so telas save audio fundacao --porta 8136 --mobile iphone # FALHAS: 0
node tools/foto_telas.js --aparelho todos                                        # 60 fotos, console limpo
```
- **teste_telas** (~100 asserções): clica pelo DOM de verdade o fluxo inteiro — menu (vitrine desenhada, carro na plataforma, botão
  ≥ 44 px), seleção (nome, barras = atributos do config, poder/esquiva, setas, deslizar), pista (um cartão por pista, cadeados, trancada
  não larga), carga, corrida (HUD, controles ligados, contagem 3 → VAI!, pausa/continuar, posição/tempo/volta/turbo no HUD, botões da
  fase 2 decorados, minimapa pintado, avisos que somem, tremida, faixa, fumaça), fim com `G.flags.auto` (resultado, corrida
  desmontada, tabela, registro único, recorde, pódio 3D com 3 carros), campeonato (pede carro, rivais fixos, rivais freados pela suíte
  → pódio → pontos somados, **desbloqueia a pista 2 e avança**, tabela com os pontos), opções (direção e acelerar sozinho chegam à
  entrada e ao save, qualidade manual e Auto, volumes, vibração, apagar progresso mantendo opções), regra do AUTO (carência, desce um
  nível, não sobe, chega na baixa, trava em 30, guarda e esquece o aprendido), `corrida_direta`, reiniciar e sair pela pausa, e o
  `jogo:tela` de cada tela.
- **teste_save**: `localStorage` com o getter levantando SecurityError e depois só o `setItem` levantando — nada levanta, memória
  responde; e o **jogo inteiro num iframe com `?sem_armazenamento=1`** abre, chega ao menu, larga pelos botões, corre até o fim no
  piloto automático, mostra o resultado e as opções avisam.
- **teste_audio**: grafo, 43 sons tocam, 10 poderes com som, anti-repetição, nome desconhecido, cada efeito e cada tema renderizados
  num OfflineAudioContext **soam** (pico > 0,03) e **não estouram** (pior pico 0,48), melodias distintas e fixas, tema por pista (as 10
  pistas com 10 temas diferentes), **três trocas de música seguidas → só a última, no volume cheio**, motor segue a velocidade, eventos
  tocam o som certo, posicional cala longe, pausa abaixa a música, suspende/retoma, volumes, sem AudioContext = no-op.

## 8. Fotos e o que mudou depois de olhar

`docs/fotos/telas/<aparelho>_<nn>_<tela>.jpg` em pixel CSS (Pixel 7 839×412, iPhone 14 664×390, Galaxy S8 740×360, iPad 1080×810,
desktop 1280×720). Corrigido depois de olhar: o ✔ da seleção cobria a esquiva (o painel reserva a altura do botão); no celular baixo
sai a frase do carro e fica a esquiva (é o que ensina a jogar); palco e pódio mais altos e recuando em tela 4:3 (no iPad o palco
invadia o painel); o desenho da pista no campeonato virava mancha preta (`fill="none"` como atributo do SVG); pílula de recorde vazia
escondida; "Apagar progresso" cortado no fim das opções (virou 🗑️ redondo no canto); fallback de fonte fino (peso 900 +
`font-synthesis: none`); texto branco do botão verde com contorno; avisos por cima da faixa de última volta (e descendo para baixo
dela); onomatopeias de batida empilhadas na largada (1 a cada 1,5 s) e pisca-pisca vermelho (1 a cada 0,8 s); minimapa encostando no
botão PODER (menor e mais alto); medalha para quem tem 0 ponto; e **estrelas e número da posição invisíveis na foto**: animação que
começa em opacidade 0 com atraso ficava presa no primeiro quadro quando a página engasgava — agora só escala, sem atraso.

## 9. Decisões tomadas sozinho

- As telas só reagem às corridas que **elas** começaram (menus, reinício, `corrida_direta`): suíte de outra fase que abre corrida por
  `G.jogo.iniciaCorrida` não ganha HUD, pódio nem `registraResultado` automático (senão contaria duas vezes e trocaria o `G.desenho` no
  meio da medida dela). Para ver o HUD numa corrida aberta assim: `G.hud.mostra(c)`.
- O fim da corrida é processado no **passo seguinte** das telas (não dentro do `corrida:fim`, que sai de dentro do `corrida.passo`):
  registra, desmonta a corrida e mostra o pódio. "Correr de novo" usa as opções guardadas.
- O botão de pausa mora no `#ui` (camada de cima): zonas de toque largas dos controles podem cobrir o `#hud`. Ele fica no mesmo canto
  do `#btn-pausa` da fase 2, 4 px maior, cobrindo o dela por inteiro na corrida das telas (o dela continua funcionando nas suítes dela).
- Fim de campeonato: o `jogo.js` não guarda "terminou"; guardo uma assinatura (`campeonato_fim` = corridas + soma dos pontos) quando
  o resumo diz `fimDoCampeonato`.
- Qualidade AUTO lembra o nível aprendido no aparelho (sem isso o celular fraco engasgaria 3 s no começo de toda sessão).
- Volume, opções e qualidade valem já ao mexer (o jogador ouve enquanto arrasta); o save grava no `change`.

## 10. Pendências e o que conferir

1. **Celular de verdade**: tela cheia + trava de orientação no Android, entalhe/safe-area do iPhone, o aviso de girar, o desbloqueio
   do som no primeiro toque do iPhone e o balanço de volume no alto-falante do celular (os níveis foram acertados pelo pico offline,
   não pelo ouvido). Vibração só testada no emulador.
2. **Fonte**: com internet o Baloo 2/Bungee chegam e o texto fica um pouco mais largo que nas fotos (feitas sem internet). Vale uma
   foto com internet para conferir que nada estoura (as larguras têm folga, mas não medi).
3. `VEL_REF = 38 m/s` (o giro do motor no topo) supõe a velocidade máxima da física; se a fase 2 terminar com outra, ajustar em
   `js/audio.js`.
4. Formato de `corrida.poderes.ativosEm(carro)` (fase 4): o HUD aceita lista de ids ou de objetos com `poder`/`id`. Com o stub o anel do
   PODER fica sempre cheio (`recarga` = 1).
5. Os sons dos poderes tocam no `poder:usa`. Se a fase 4 quiser sons de momento (gelo quebrando, óleo pegando), os nomes existem:
   `gelo_quebra`, `acerto_ruim`, `acerto_bom`, `esquiva`, `escudo_bloqueia`; nome que não existe é ignorado com um aviso no console.
6. A exceção das fontes já está no `CLAUDE.md` e na seção 0 do contrato (atualizados pelo maestro durante a fase).

## 11. Mudanças de contrato propostas (não mudei nada de outra fase)

- **Seção 10, `G.hud.aviso(texto, tipo, icone?)`**: terceiro parâmetro opcional (emoji). Tipos: `info bom ruim poder turbo ouro`.
- **`G.audio.volume(geral, musica, efeitos)`** em 0..1 (null mantém); `G.audio.musica()` aceita nome de tema, Pista/definição ou null e
  devolve o tema escolhido; `G.audio.temaAtual`; `G.audio.toca()` devolve true/false.
- **`G.qualidade.define('auto' | nivel, persiste = true)`** (o `?qualidade=` usa `persiste = false`) e `G.qualidade.escolha`.
- **`G.save.remove(chave)`, `G.save.opcoes()`, `G.save.mudaOpcoes(parcial)`, `OPCOES_PADRAO`**; chaves novas `opcoes`,
  `qualidade_auto`, `campeonato_fim`.
- **Seção 11 (flags)**: `?sem_armazenamento=1` (o `js/save.js` faz o localStorage levantar exceção no simples acesso, como em `file://`
  e no privativo) — usado pelo `teste_save` e útil para ver o aviso das opções.
- **Seção 4 (pistas)**: campo opcional `tema.musica` (nome de tema de `js/musica.js`) para a fase 3 escolher a música; sem ele vale o
  reconhecimento por nome/estilo (hoje dá certo para as 10).
- **jogo.js (fundação)**: guardar `rivais` e `terminou` no objeto do campeonato (hoje a fase 6 deriva os rivais e guarda a assinatura).
- **Coordenação com a fase 2**: ela usa `.tc-big`/`.tc-redondo` dentro de `#controles` (nomes iguais aos da linguagem do Breno); todo o
  meu CSS de componente está escopado em `#ui` para um não pintar o outro. O `.deco` dela tem `inset: -5px`; a decoração respeita.
