# 🏁 Turbo Caos

Corrida maluca 3D que roda **direto no navegador do celular**, sem instalar nada. Escolha um dos 19 carros do Cidade Aberta — todos com
o mesmo nível, cada um com um **superpoder** para atrapalhar os rivais —, junte cápsulas de turbo pelo caminho e encare 10 pistas
temáticas, da Orla do Rio à Pista Maluca final, com atalhos, rampas e loops. Modos **Campeonato** (as pistas abrem em sequência) e
**Corrida Livre**; 8 corredores, 3 voltas; a dificuldade sobe aos poucos e se ajusta sozinha ao jogador.

## Como jogar

| Onde | Como |
|---|---|
| **Compartilhar (qualquer celular)** | Mande o link **https://alexmorassi.github.io/turbo-caos/** (GitHub Pages, publicado do branch `gh-pages`) e jogue deitado. |
| **Celular (artefato do Claude)** | Abra **https://claude.ai/artifact/FWWGVVDUhpoUng3w8aTfUZ** (o mesmo jogo; ali a inclinação não funciona). |
| **Sem internet / PC** | Dois cliques no `TurboCaos.html` (ou no `Jogar.bat`). É um arquivo único (37 MB, com as músicas): dá para copiar para o celular. |
| **Desenvolvimento** | `Servidor.bat` (ou `python server.py 8125`) e `http://localhost:8125`. Com `--rede`, abre no celular pela Wi-Fi de casa. |

**Controles de toque** (no estilo dos jogos de corrida de celular): à esquerda o **botão de arrastar** — arraste o botão amarelo para o
lado para onde quer ir: pouco vai pouco, até a ponta vai rápido, e soltando ele volta para o meio. **Ajuda na direção:** solto, o carro
segue a estrada sozinho e fica na faixa; o arrasto leva o carro para o lado (não gira o carro), e na curva fechada demais o pé sai
sozinho do acelerador (nas opções dá para trocar por setas **◀ ▶** ou inclinar o celular fora
do artefato); à direita o pedal **ACELERA**, largo, no canto — **soltar o acelerador freia** (não há botão de freio) — e, colados nele,
os botões redondos **TURBO** (ao lado) e
**PODER**. **TURBO e PODER são de um toque:** toque uma vez e o turbo gasta a barra inteira sozinho (o dedo volta para o acelerador); o
poder dura até o fim. Quando um deles está **pronto**, o botão pula e solta uma onda de luz — nada de mensagem no meio da tela. Nas opções dá para ligar "acelerar sozinho" (o pedal do acelerador some). Congelado? Toque várias vezes no PODER.
No PC: setas/WASD, espaço = turbo, E = poder, S = freio, Ctrl = drift, Esc = pausa.

**Turbo:** a barra é limitada e só enche com as **cápsulas** azuis da pista (+30 %); as **douradas**, raras e nos lugares arriscados,
enchem tudo. Cápsula pega com o turbo aceso soma e ele continua até acabar; o Pulso EMP, o gelo e o rodopio apagam o turbo, e o que
sobrou fica para o próximo toque. Apertar o TURBO bem no **VAI!** dá uma largada turbo (na contagem o toque não gasta a barra).
**Nenhuma cápsula perto do pouso dos saltos** (01/11/2026): da crista até 12 m depois do ponto mais longe em que o carro mais rápido,
de turbo aceso, pode pousar (~80–130 m depois da crista).

## Os carros e os poderes

**Todos os carros têm o mesmo nível** (31/10/2026): velocidade 4, arrancada 3, curva 3, peso 3 e turbo 3. O carro escolhe a cara e o
poder; quem ganha é quem usa melhor o **turbo** e o **poder**. Antes cada carro tinha os seus atributos e o Carro Dourado B7
(velocidade 5) ficava impossível de alcançar.

| Carro | Poder | Como escapar |
|---|---|---|
| Carro Vulcão | 🌋 Terremoto (quem está no chão rodopia e escorrega) | estar no ar na hora do tremor |
| Carro Dourado B7 | 🛡️ Escudo Refletor (bloqueia e devolve) | esperar o escudo acabar |
| Porsche 911 GT3 RS | 🛢️ Mancha de Óleo (quem passa roda) | desviar da poça |
| Carro de Sorvete | ❄️ Raio Congelante (vai na faixa do carro da frente e congela) | mudar de faixa |
| Buggy | 🔻 Encolhedor (rivais pequenos e lentos) | pegar uma cápsula |
| Kombi | 💨 Cortina de Fumaça (quem entra fica sem enxergar e perde velocidade) | passar pelo lado |
| Monster Truck Tubarão | 🧲 Ímã (puxa cápsulas, segura quem está perto) | ficar longe |
| Toyota GR Yaris Voador | 🌪️ Mini Tornado (levanta e gira) | desviar na hora certa |
| BYD Seal | ⚡ Pulso EMP (choque: perde força e fica sem turbo) | sair do círculo azul |
| Kart a Jato | 🔄 Troca-Troca (troca de lugar com o da frente) | ligar o turbo durante a mira |

**Mais 9 do Cidade Aberta** (30/10/2026): o **Toyota Prius** e os carros de rua que fazem **pops and bangs** lá. Os poderes se
repetem (são 10). Os 7 Pro Stock entraram junto e saíram no dia seguinte, a pedido.

| Carro | Poder | Pops and bangs |
|---|---|---|
| Toyota Prius | ⚡ Pulso EMP | — (híbrido: o motor zune) |
| Fusca Teto Solar | 🛢️ Mancha de Óleo | de rua: estoura nas reduções |
| VW Voyage | 🛡️ Escudo Refletor | de rua |
| VW Gol GTI | 🔻 Encolhedor | de rua |
| Hyundai HB20 Turbo | ❄️ Raio Congelante | de rua |
| Chevrolet Monza SL/E | 🧲 Ímã | de rua |
| VW speed up! TSI | 🔄 Troca-Troca | de rua |
| Chevrolet Celta | 🌪️ Mini Tornado | de rua |
| Furgão | 💨 Cortina de Fumaça | de rua |

**Pops and bangs** (do Cidade Aberta): o carro **de rua** estoura no escapamento a cada redução — soltou o acelerador e a marcha
caiu; o **Porsche 911 GT3 RS** também estala logo que tira o pé embalado. Ligar o **turbo** de quem estoura solta um **BANG**.

**Todo poder pega de verdade** (31/10/2026): medido numa corrida com a IA, o rival acertado perde de 30 a 70 m nos 5 s seguintes. O
Terremoto, o EMP e a Fumaça quase não tiravam nada (o rival seguia igual) e o Raio Congelante só corria na faixa de quem atirou.

Os nomes são **os do Cidade Aberta**, iguais para todos (31/10/2026): os 10 primeiros tinham apelido (Vulcão, Lagartixa, Picolé…).

## As pistas

| # | Pista | Volta | Destaques |
|---|---|---|---|
| 1 | Orla do Rio | 1,9 km | atalho de areia, salto sobre o canal |
| 2 | Favela Morro Acima | 1,8 km | escadaria sem muro, curva inclinada |
| 3 | Deserto | 1,8 km | vale de terra com rampa, 2 saltos |
| 4 | Gelo | 1,8 km | lago com impulso, 2 saltos |
| 5 | Vulcão | 2,1 km | pulo do lago de lava, loop, ponte sem muro |
| 6 | Selva | 1,7 km | atalho de lama, loop da cachoeira |
| 7 | Cidade Neon (noite) | 2,1 km | loop, saca-rolha, viaduto em oito |
| 8 | Porto/Docas | 2,2 km | salto do cais (vão de 22 m), loop |
| 9 | Canyon | 1,9 km | 3 saltos, loop, paredão de 65° |
| 10 | Pista Maluca | 2,2 km | 2 loops, saca-rolha, 2 paredões, 2 atalhos |

**Curvas para a criança** (30/10/2026): toda curva das 10 pistas tem raio de 50 m ou mais — qualquer carro (todos viram igual) faz a
volta inteira com o acelerador no fundo, sem frear nem diminuir. A inspeção das pistas (`teste_pistas`) reprova curva mais fechada.

## A música

Cada pista, o menu e o pódio têm a **sua música** (02/11/2026: 12 faixas feitas no Suno). Cada uma virou um **loop sem emenda** de
77–113 s (o pódio, 53 s) — o pulo do fim para o começo cai em cima da batida, no mesmo andamento — e toca em
`assets/musica/<id>.mp3` (~1,3 MB cada). Os efeitos continuam sintetizados; a música procedural de antes ficou de reserva (pista sem
faixa, arquivo que não chegou a tempo) e volta com `?musica=sintetizada`.

Para trocar uma música: gere no Suno, salve como `Turbo Caos - <Nome>.wav` (Orla, Favela, Deserto, Gelo, Vulcao, Selva, Neon, Porto,
Canyon, Maluca, Menu, Podio) e rode `python3 tools/musica/prepara.py "<pasta>" --so <id> --previa <pasta da prévia>` (precisa de
Python com numpy, scipy, soundfile, librosa e pyloudnorm, do ffmpeg e da biblioteca do Rubber Band). Ele acha o loop, acerta o
volume, grava o MP3 e a linha do `config/musicas.js`; depois, `node tools/monta.js`.

## Estrutura

```
index.html            página do desenvolvimento (ES modules + importmap)
TurboCaos.html        o jogo inteiro num arquivo só (gerado: node tools/monta.js)
js/                   código do jogo, um módulo por responsabilidade (contratos em docs/CONTRATOS.md)
js/pistas/            as 10 pistas (construtor de peças -> spline CatmullRom) + a pista de teste
js/poderes/           um arquivo por poder
config/               PARÂMETROS DE JOGO: carros, física, turbo, poderes, dificuldade, pistas, corrida
assets/cars/          os 19 carros (GLB meshopt + KTX2, 380–830 KB, vindos do cidadeaberta)
assets/musica/        as 12 músicas (MP3 com o loop pronto; os pontos do loop em config/musicas.js)
lib/                  three.js r170 + GLTFLoader/KTX2Loader + decoders meshopt e Basis (sem CDN)
tools/                monta.js (HTML único + pasta do artefato), carros/ (otimização dos GLB), musica/ (os loops), fotos
testes/               bateria Playwright (node testes/rodar.js)
docs/                 CONTRATOS, PENDENCIAS, relatórios das fases, fotos
```

## Testes

```
node testes/rodar.js                          # bateria inteira (16 suítes; determinística: passo fixo de 1/60 s)
node testes/rodar.js --mobile pixel           # emulando o Pixel 7 deitado (ou --mobile iphone)
node testes/rodar.js --html --artefato        # + o HTML único em file:// e a pasta do artefato por HTTP
node testes/rodar.js --so corridas            # 3 voltas com 8 carros nas 10 pistas, pelas telas
```
A bateria abre o jogo de verdade num Chromium (Playwright, SwiftShader) e reprova com qualquer erro no console.

## Decisões e pendências

Ver [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) — inclusive o que precisa de playtest no celular de verdade.
