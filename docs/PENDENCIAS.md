# PENDÊNCIAS E DECISÕES — Turbo Caos

O que ficou para você conferir/decidir e as decisões que tomei sozinho (pedido: "se faltar alguma decisão, siga a opção mais simples,
registre aqui e continue"). Cada fase detalha as suas em `docs/fases/faseN_*.md`.

## 1. Para você fazer ou conferir

0. **As músicas do Suno** (02/11/2026), para ouvir no celular: as 12 faixas (`D:\Downloads\Turbo Caos Songs`) viraram um loop cada
   (`tools/musica/prepara.py`) e tocam no menu, no pódio e em cada pista; a sintetizada de antes ficou de reserva.
   - **As emendas**: a prévia `Turbo Caos - emendas dos loops.mp3` (3 min) toca o fim de cada loop e o pulo para o começo (0:08 Menu,
     0:23 Orla, 0:38 Favela, 0:53 Deserto, 1:08 Gelo, 1:23 Vulcão, 1:38 Selva, 1:53 Neon, 2:08 Porto, 2:23 Canyon, 2:38 Maluca,
     2:53 Pódio). Medido em todas: a batida no pulo cai a menos de 7 ms do lugar e o andamento muda menos de 0,6 %. Pela medida, as
     emendas mais fracas são **Vulcão** (a música quase não se repete: o pulo é liso, mas o trecho depois dele é outra parte) e
     **Selva**. Se alguma soar estranha, diga qual: troco o ponto do loop (o script lista as alternativas).
   - **O Suno acelera** ao longo da música (a Orla vai de 130 para 134 BPM): os últimos 8 compassos de cada loop foram esticados até
     2 % (Rubber Band, numa rampa) para o fim chegar no andamento do começo. Não deve dar para ouvir; se der, é ali.
   - **Duração**: as pistas ficaram com 94–113 s de loop, o menu com 80 s e o pódio com 53 s. **Deserto (77 s) e Neon (82 s)** ficaram
     abaixo dos 90 s do plano: dentro dos 90–120 s a emenda era bem pior.
   - **Volume**: as faixas tocam ~1 dB abaixo da sintetizada de antes (a mixagem do Suno é cheia e cobre mais os efeitos). Se a música
     sumir sob o motor, ou cobrir o som dos poderes, o número é `MUSICA_ARQUIVO_VOL` (`js/audio.js`); o de cada faixa, `ganho` em
     `config/musicas.js`.
   - **HTML único maior**: o `TurboCaos.html` foi de 15 para 37 MB (as faixas vão embutidas; o limite subiu de 25 para 45 MB, como o
     plano previa). Se ficar pesado para abrir no celular, a saída é embutir as faixas com metade da qualidade só nele.
   - Para comparar com a de antes: `?musica=sintetizada` (no GitHub Pages ou no servidor local).
1. **Repositório e link para compartilhar** (01/11/2026): o código está em https://github.com/alexmorassi/turbo-caos (público) e o
   jogo no **GitHub Pages: https://alexmorassi.github.io/turbo-caos/** — é esse o link para os amigos (o artefato do Claude é
   privado). O Pages sai do branch `gh-pages` (uma cópia do `main`, empurrada junto a cada atualização); se preferir que ele saia
   direto do `main`, é em Settings → Pages → Branch: `main` / `(root)`.
2. **Playtest no celular de verdade** (o que a bateria não mede):
   - **fps real**: a bateria roda em SwiftShader (renderização por software), onde os números só comparam níveis entre si
     (BAIXA 12 fps, ALTA 2–4 fps a 839×412). No celular, a qualidade AUTO desce de nível sozinha abaixo de 50 fps e trava em 30 fps
     na BAIXA. Desenho por quadro na corrida (ALTA): ~134 chamadas e ~390 mil triângulos.
   - tela cheia + trava de orientação no Android; safe-area do iPhone; aviso de girar; som destravando no primeiro toque; volume no
     alto-falante; vibração.
   - **dificuldade para criança pequena**: o ritmo dos rivais na pista 1 é 87 % da vMax e o DDA alivia até 85 %. Os números estão em
     `config/dificuldade.js` (`BASE`, `DDA`, `ELASTICO`).
   - **carros todos iguais e poderes mais fortes** (31/10/2026): com o mesmo carro para todos, quem decide é o turbo, o poder e a
     dificuldade. Numa simulação da "criança preguiçosa" (acelerador no fundo, sem virar, turbo e poder tocados quando acendem) ela
     chegou em 2º, 1º e 3º nas pistas 1, 3 e 5, e o pelotão terminou mais junto (do 1º ao último: 18–25 s; antes 45–55 s, com o
     Carro Dourado B7 abrindo 5–11 s). O **rival forte** (o da pole) continua 3,5 % mais rápido que os outros rivais, de propósito:
     é o adversário a caçar (`config/dificuldade.js` `PAPEIS.forte`). Os poderes da IA agora também tiram de verdade quando pegam o
     jogador: se a criança achar que apanha demais, o número é o `usoDePoder` da `BASE`.
   - na seleção, as **barras de atributo** ficaram iguais em todos os carros (é a verdade). Se confundir, dá para tirar as barras
     e deixar só o poder.
   - se os **feixes do Raio Congelante e do Troca-Troca** se veem bem da câmera de trás (se não, o próximo passo é pintar a faixa
     de gelo no asfalto).
   - **sem as mensagens no meio da tela** (pedido de 30/10/2026) a criança perdeu os avisos de "você é o alvo" ("Raio de gelo! Mude
     de faixa!", "Tornado vindo! Desvie!", "Ligue o TURBO!", "Saia do círculo azul!", "Terremoto! Pule!"). Ficaram o feixe, o
     círculo, a mira e os sons — mas o **tornado vem por trás, fora da câmera**: só o vento avisa (e o celular costuma estar no
     mudo). Se ela não conseguir mais desviar, o próximo passo é um sinal sem texto na BEIRA da tela (brilho vermelho embaixo),
     longe da área que atrapalhava.
   - se as **pistas 1 a 4** parecem repetidas na planta (todas são um retângulo com o bojo do atalho); redesenhar é barato, porque o
     construtor fecha o circuito sozinho.
3. **No artefato do Claude** o iframe bloqueia o sensor de movimento: a direção por **inclinação** cai sozinha para as setas
   (funciona no `TurboCaos.html` e pelo servidor local). Também não há query string, então as flags (`?pista=`…) só valem fora dele.
4. **Logotipos nas texturas herdadas** do Cidade Aberta (VW na Kombi, Toyota/GR no Toyota GR Yaris Voador, brasão no Porsche; e
   nos 9 de 30/10/2026, os emblemas das pinturas). Desde 31/10/2026 **todos usam o nome do Cidade Aberta, com a montadora** ("Toyota
   Prius", "Porsche 911 GT3 RS"; pedido: "usar o mesmo nome do Cidade Aberta em todos os carros"), sem o emoji que o nome tem lá: a
   criança acha o carro que conhece. Os 10 primeiros tinham apelido (Vulcão, Lagartixa, Picolé…); o `id` continua o mesmo (o save
   guarda o carro pelo id). Nome comprido (até 22 letras) encolhe na seleção e corta com "…" na tabela do resultado.
6. **Os 9 carros novos do Cidade Aberta** (30/10/2026), para conferir no celular:
   - **Fusca Teto Solar**: a versão leve do Cidade Aberta tem o forro da porta atravessando a lataria (por isso ele ficou fora na fase
     1). Refeita aqui (`tools/carros/refaz_lod.mjs`: só a pele de fora da malha cheia, rachaduras tampadas, faixa de textura nova).
     Ficou bom de longe; **de perto, na vitrine, a porta ainda tem pontinhos escuros** (frestas pequenas entre pedaços de camadas da
     lataria do Meshy). Se incomodar: refazer a `body_lo` no próprio Cidade Aberta, com a lataria fechada antes da redução.
   - **O pops and bangs é do Cidade Aberta** (as reduções, o estalo de tirar o pé do Porsche); só o BANG de ligar o turbo
     é daqui. Rival também estoura (a labareda sempre; o som mais baixo e só perto). Se o som ficar "metralhadora" com 8 carros, o
     próximo passo é tocar o som só do jogador e do rival mais perto.
   - **HTML único maior**: com 19 carros o `TurboCaos.html` passou de 9,6 para 15 MB (abre em `file://`; o artefato carrega só os
     carros da corrida). Os 7 **Pro Stock** (Gol Pro Stock, Mustang, Camaros) entraram junto e **saíram em 31/10/2026**, a pedido.
5. **Fonte com internet**: as fotos foram tiradas sem internet (fonte do sistema). Com o Baloo 2/Bungee carregados o texto fica um
   pouco mais largo; as larguras têm folga, mas vale olhar uma vez.

## 2. Referências e entrega

- **Lidas nos seus artefatos do Claude** ("Breno e o Tesouro do Pirata Morassi" e "Rampa Radical"). Os dois padrões são diferentes;
  segui o do **Breno** (pedido):
  - Breno: artefato com vários arquivos — `index.html` + `js/*.js` (ES modules) + `lib/basis/` (transcodificador KTX2 no projeto) +
    cada GLB como módulo `assets/<nome>.glb.js` em base64 (o artefato não serve `.glb`), carregado por `import()` sob demanda.
  - Rampa Radical: um `index.html` único com todo o código dentro e texturas geradas em canvas (sem GLB).
  - **Turbo Caos**: igual ao Breno (`dist/artefato/`, publicado em https://claude.ai/artifact/FWWGVVDUhpoUng3w8aTfUZ) e ALÉM disso
    o `TurboCaos.html` único (15 MB com os 19 carros), que funciona sem internet em `file://` — testado na bateria (`--html` e `--artefato`).
- **Diferença deliberada:** o Breno carrega o three.js r170 do CDN jsdelivr; aqui three.js e os decoders meshopt/KTX2 ficam em `lib/`
  (o pedido exige "decoders salvos no próprio projeto, sem CDN externo", e o decoder meshopt mora nos addons do three).
- O Breno tem um GLB reserva `*_web.glb` para quando o KTX2 falha; aqui, se a textura falhar, o carro aparece na cor dele.
- **WebGL1:** o three r170 (o mesmo das referências) só tem WebGL2 — o WebGL1 saiu no r163. Todo Chrome de Android e Safari de iOS
  15+ tem WebGL2; sem ele aparece "atualize o navegador" em vez de tela preta.
- **toktx bloqueado** no ambiente: as texturas KTX2 foram codificadas com o pacote npm `ktx2-encoder` (o mesmo Basis Universal).
- Porta **8125** para o servidor e a bateria (a 8123 é a do Cidade Aberta).

## 3. Decisões de jogo

- **Carros** (fase 1): o Fuscão saiu (o `fusca.glb` é branco como o Faísca e a versão leve tem defeitos de malha) e entrou o
  **Buguinho** (laranja, chassi de Fusca, mesmo poder). O **Voador** fica com as turbinas recolhidas (abertas ele teria 2,7 m). Pela
  regra de escala (4,2 × 2,3 × 2,6 m), o Picolé (3,25 m) e o Tubarão (3,34 m) ficam mais curtos. Atributos somavam 16 em todos (desde
  31/10/2026, o mesmo nível em todos: ver abaixo).
- **Os 9 carros novos do Cidade Aberta** (30/10/2026, pedido: "coloque o Toyota Prius e os carros com pops and bangs"): os com pops
  são os SPECS do `cidadeaberta/js/carmodels.js` com `turbo` (Fusca Teto Solar, VW Voyage, VW Gol GTI, Hyundai HB20 Turbo, Chevrolet
  Monza SL/E, VW speed up! TSI, Chevrolet Celta, Furgão) ou `pops` (o Porsche 911 GT3 RS, que já estava aqui: ganhou o estouro).
  Atributos somam 16 e respeitam a curva para a criança (velocidade 5 só com controle ≥ 3); o poder repete entre os 19 (são 10
  poderes); o Toyota Prius zune como o BYD Seal e o Furgão ronca grave. O campeonato continua com os 10 primeiros de rivais (os pontos
  de um campeonato salvo não mudam de dono); a corrida livre sorteia entre os 19. Na seleção, as bolinhas encolheram e o nome comprido
  ("Toyota GR Yaris Voador") encolhe para caber. Os 7 `proStock` (de arrancada) entraram junto e **saíram em 31/10/2026** ("remover os
  carros pro stock"); no mesmo dia **todos passaram a usar o nome do Cidade Aberta** (os 10 primeiros tinham apelido).
- **Física** (fase 2): crista da rampa lança 8° mais para cima (sem isso a rampa da pista de teste virava lombada); quem cai num vão
  volta DEPOIS do buraco; parede invisível no ar acima dos muros; FREIO e DRIFT num botão só; loop nunca derruba (mínimo 18 m/s).
- **Turbo × faixa de impulso não empilham** (maestro): os dois juntos davam 1,69 × a vMax (66 m/s antes do loop da Neon).
- **Curvas para a criança** (30/10/2026: "curvas mais suaves, com o dedo no acelerador o tempo inteiro"): as 10 pistas foram
  redesenhadas com raio ≥ 50 m em toda curva (o Vulcão, o que menos vira, faz a volta inteira sem a ajuda tirar o pé). As voltas
  ficaram entre 1,7 e 2,2 km; os desvios do Beco (Neon) e do Circo e do Tobogã (Maluca) viraram curvas de 60°; a rampa do Palhaço
  passou para depois do viaduto; o atalho do Cais (Porto) ganhou a curva de volta de raio 50. **No turbo** (1,3 × a velocidade) as
  curvas de raio 50 ainda pedem um pouco de freio nos carros de controle baixo: a ajuda tira o pé sozinha ali.
- **Ajuda na direção** (30/10/2026: "o carro está virando demais, zigue-zague, ninguém se mantém na pista"): só o jogador. Medido em
  `teste_direcao`: uma volta SOLTA (só o acelerador) em cada pista bate 0–1 vez com a ajuda contra 11–17 sem; a "criança" com 0,3 s de
  reação que ia de muro em muro agora volta para o meio e assenta. Escolhas: o dedo pede ângulo (no máximo 8 m/s de lado); "tira o pé"
  sozinho na curva que o carro não faz (o Vulcão não faz a 1ª curva da Orla a 36 m/s). **Para o playtest:** se adulto achar que "o
  carro anda sozinho", dá para pôr "Ajuda na direção" nas Opções (o gancho já existe: `opcoes.ajudaDirecao`). As batidas que sobram
  são pousos de salto em curva (Orla, Favela, Porto, Canyon): no ar a ajuda não age.
- **Turbo e poder de um toque** (pedido do Morassi, 30/10/2026): o toque acende o turbo e ele gasta a barra inteira sozinho; o EMP, o
  gelo e o rodopio apagam e ele não reacende sozinho (a sobra fica para o próximo toque — escolha mais simples e previsível). **A IA
  continua segurando**: liga o turbo na reta e solta antes da curva, então gasta melhor que o jogador (que pode entrar numa curva
  com o turbo aceso). O DDA compensa; se nos testes com a criança os rivais parecerem espertos demais no turbo, dá para fazer a IA
  também de um toque (só acende quando a reta à frente comporta a barra inteira).
- **Nenhuma cápsula perto do pouso dos saltos** (01/11/2026, pedido: "não colocar turbos próximos ao pouso dos saltos"). Havia um par
  de cápsulas 8 m depois de cada vão, as douradas que as pistas marcam no salto caíam no pouso (empurradas para fora da crista) e as
  fileiras também: de 18 a 68 m depois da crista. Agora nenhuma da crista até 12 m depois do pouso mais longe possível (o carro mais
  rápido com turbo; a conta cobre o pouso de verdade medido em 9 pistas). A cápsula que cairia lá vai para depois; a pista perde
  poucas (Deserto 75 → 65, Vulcão 73 → 66, Canyon 71 → 63) e todas continuam com 1 a 3 douradas.
- **Mesmo nível em todos os carros** (31/10/2026, pedido: "o carro dourado está muito rápido, está impossível de ganhar dele. Deixe
  todos os carros com o mesmo nível, a ideia é que ganhe quem utilizar melhor os turbos e os poderes"): velocidade 4, arrancada 3,
  curva 3, peso 3, turbo 3 em todos (`MESMO_NIVEL` em `tools/carros/tabela.mjs`; o `gera_config.mjs` reprova diferença). Velocidade
  4 para a corrida continuar rápida; o resto no meio da tabela (soma 16). As frases que falavam de vantagem ("o mais arrancador",
  "o turbo dura mais") foram reescritas. O tamanho de cada modelo (o Tubarão e o Carro de Sorvete são mais curtos) continua o dele.
- **Todo poder pega de verdade** (31/10/2026, pedido: "o poder do jogador não está surtindo efeito nos outros carros"). Medido numa
  corrida com a IA e a dificuldade ligadas, tocando o poder assim que acende: o rival acertado perdia −7 m em 5 s no Terremoto, 3 m na
  Fumaça e 14 m no EMP (só escorregar, só embaçar e só tirar o turbo não se viam), e o Raio Congelante errava 10 de 13 tiros (só corria
  na faixa de quem atirou). Agora: **Terremoto** dá o tranco (rodopia uma volta em 0,7 s) além de escorregar; **EMP** dá o choque
  (perde 40 % da velocidade na hora e o motor fica fraco 1,2 s) além de tirar o turbo; **Fumaça** dá o susto na entrada (−25 %) e
  deixa mais lento lá dentro e 1,2 s depois; **Raio Congelante** vai para a faixa do carro da frente (quem troca de faixa enquanto ele
  vem escapa); **Ímã** segura 0,7 (era 0,82) e continua segurando 1,2 s depois do campo (era 0,35); **Encolhedor** 0,7 (era 0,8).
  Resultado: 30–70 m perdidos por acerto em todos. E a IA esquiva menos (`ESQUIVA` 0,1–0,5, era 0,15–0,8; fuga do Troca-Troca 0,2–0,6,
  era 0,3–0,9): o rival bom escapava de 4 em 5 tornados. As regras valem para todos: a IA acertando o jogador também tira de verdade.
- **Poderes** (fase 4): o Troca-Troca devolvido pelo Escudo faz quem mandou trocar com quem vem atrás dele; o dono não sofre com a
  própria poça/nuvem; quem já chegou não é alvo; no máximo 3 cápsulas douradas por volta. Números ajustados para a esquiva escrita
  funcionar de verdade (óleo 10 s, EMP 24 m, raio congelante 80 m/s, tornado 2,4 m).
- **IA/dificuldade** (fase 5): "derrota" = fora do pódio (o mesmo critério do campeonato); o rival forte é o da pole; o piloto
  automático (`?auto=1`, só nos testes) também alimenta o DDA e não faz a largada turbo.
- **Corrida**: o jogador larga em penúltimo; a corrida termina 3 s depois de ele cruzar a chegada (quem não chegou recebe tempo
  estimado); no campeonato o pódio (1º–3º) desbloqueia a próxima pista e os pontos são 10-8-6-5-4-3-2-1 com rivais fixos.
- **Interface** (fase 6): fontes Baloo 2/Bungee do Google Fonts como nos jogos de referência (sem internet cai na fonte do sistema);
  qualidade AUTO lembra o nível aprendido no aparelho.
