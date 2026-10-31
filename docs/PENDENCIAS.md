# PENDÊNCIAS E DECISÕES — Turbo Caos

O que ficou para você conferir/decidir e as decisões que tomei sozinho (pedido: "se faltar alguma decisão, siga a opção mais simples,
registre aqui e continue"). Cada fase detalha as suas em `docs/fases/faseN_*.md`.

## 1. Para você fazer ou conferir

1. **Criar o repositório `alexmorassi/turbo-caos` no GitHub (vazio, sem README).** Esta sessão não tem permissão para criar
   repositório; os commits de cada fase estão prontos e o push sai assim que ele existir.
2. **Playtest no celular de verdade** (o que a bateria não mede):
   - **fps real**: a bateria roda em SwiftShader (renderização por software), onde os números só comparam níveis entre si
     (BAIXA 12 fps, ALTA 2–4 fps a 839×412). No celular, a qualidade AUTO desce de nível sozinha abaixo de 50 fps e trava em 30 fps
     na BAIXA. Desenho por quadro na corrida (ALTA): ~134 chamadas e ~390 mil triângulos.
   - tela cheia + trava de orientação no Android; safe-area do iPhone; aviso de girar; som destravando no primeiro toque; volume no
     alto-falante; vibração.
   - **dificuldade para criança pequena**: o ritmo dos rivais na pista 1 é 87 % da vMax e o DDA alivia até 85 %. Os números estão em
     `config/dificuldade.js` (`BASE`, `DDA`, `ELASTICO`).
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
4. **Logotipos nas texturas herdadas** do Cidade Aberta (VW na Kombosa, Toyota/GR no Voador, brasão no Lagartixa). Os nomes no jogo
   não têm marca.
5. **Fonte com internet**: as fotos foram tiradas sem internet (fonte do sistema). Com o Baloo 2/Bungee carregados o texto fica um
   pouco mais largo; as larguras têm folga, mas vale olhar uma vez.

## 2. Referências e entrega

- **Lidas nos seus artefatos do Claude** ("Breno e o Tesouro do Pirata Morassi" e "Rampa Radical"). Os dois padrões são diferentes;
  segui o do **Breno** (pedido):
  - Breno: artefato com vários arquivos — `index.html` + `js/*.js` (ES modules) + `lib/basis/` (transcodificador KTX2 no projeto) +
    cada GLB como módulo `assets/<nome>.glb.js` em base64 (o artefato não serve `.glb`), carregado por `import()` sob demanda.
  - Rampa Radical: um `index.html` único com todo o código dentro e texturas geradas em canvas (sem GLB).
  - **Turbo Caos**: igual ao Breno (`dist/artefato/`, publicado em https://claude.ai/artifact/FWWGVVDUhpoUng3w8aTfUZ) e ALÉM disso
    o `TurboCaos.html` único (9,6 MB), que funciona sem internet em `file://` — testado na bateria (`--html` e `--artefato`).
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
  regra de escala (4,2 × 2,3 × 2,6 m), o Picolé (3,25 m) e o Tubarão (3,34 m) ficam mais curtos. Atributos somam 16 em todos.
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
- **Poderes** (fase 4): o Troca-Troca devolvido pelo Escudo faz quem mandou trocar com quem vem atrás dele; o dono não sofre com a
  própria poça/nuvem; quem já chegou não é alvo; no máximo 3 cápsulas douradas por volta. Números ajustados para a esquiva escrita
  funcionar de verdade (óleo 10 s, EMP 24 m, raio congelante 80 m/s, tornado 2,4 m).
- **IA/dificuldade** (fase 5): "derrota" = fora do pódio (o mesmo critério do campeonato); o rival forte é o da pole; o piloto
  automático (`?auto=1`, só nos testes) também alimenta o DDA e não faz a largada turbo.
- **Corrida**: o jogador larga em penúltimo; a corrida termina 3 s depois de ele cruzar a chegada (quem não chegou recebe tempo
  estimado); no campeonato o pódio (1º–3º) desbloqueia a próxima pista e os pontos são 10-8-6-5-4-3-2-1 com rivais fixos.
- **Interface** (fase 6): fontes Baloo 2/Bungee do Google Fonts como nos jogos de referência (sem internet cai na fonte do sistema);
  qualidade AUTO lembra o nível aprendido no aparelho.
