# 🏁 Turbo Caos

Corrida maluca 3D que roda **direto no navegador do celular**, sem instalar nada. Escolha um dos 10 carros do Cidade Aberta — cada um
com atributos próprios e um **superpoder** para atrapalhar os rivais —, junte cápsulas de turbo pelo caminho e encare 10 pistas
temáticas, da Orla do Rio à Pista Maluca final, com atalhos, rampas e loops. Modos **Campeonato** (as pistas abrem em sequência) e
**Corrida Livre**; 8 corredores, 3 voltas; a dificuldade sobe aos poucos e se ajusta sozinha ao jogador.

## Como jogar

| Onde | Como |
|---|---|
| **Celular (principal)** | Abra **https://claude.ai/artifact/FWWGVVDUhpoUng3w8aTfUZ** e jogue deitado. |
| **Sem internet / PC** | Dois cliques no `TurboCaos.html` (ou no `Jogar.bat`). É um arquivo único (9,6 MB): dá para copiar para o celular. |
| **Desenvolvimento** | `Servidor.bat` (ou `python server.py 8125`) e `http://localhost:8125`. Com `--rede`, abre no celular pela Wi-Fi de casa. |

**Controles de toque** (no estilo dos jogos de corrida de celular): à esquerda o **botão de arrastar** — arraste o botão amarelo para o
lado para onde quer ir: pouco vai pouco, até a ponta vai rápido, e soltando ele volta para o meio. **Ajuda na direção:** solto, o carro
segue a estrada sozinho e fica na faixa; o arrasto leva o carro para o lado (não gira o carro), e na curva fechada demais o pé sai
sozinho do acelerador (nas opções dá para trocar por setas **◀ ▶** ou inclinar o celular fora
do artefato); à direita os pedais **ACELERA** e **FREIO** (segurar o freio numa curva rápida faz drift) e os botões redondos **TURBO** e
**PODER**. **TURBO e PODER são de um toque:** toque uma vez e o turbo gasta a barra inteira sozinho (o dedo volta para o acelerador); o
poder dura até o fim. Quando um deles está **pronto**, o botão pula e solta uma onda de luz — nada de mensagem no meio da tela. Nas opções dá para ligar "acelerar sozinho" (o pedal do acelerador some). Congelado? Toque várias vezes no PODER.
No PC: setas/WASD, espaço = turbo, E = poder, S = freio, Ctrl = drift, Esc = pausa.

**Turbo:** a barra é limitada e só enche com as **cápsulas** azuis da pista (+30 %); as **douradas**, raras e nos lugares arriscados,
enchem tudo. Cápsula pega com o turbo aceso soma e ele continua até acabar; o Pulso EMP, o gelo e o rodopio apagam o turbo, e o que
sobrou fica para o próximo toque. Apertar o TURBO bem no **VAI!** dá uma largada turbo (na contagem o toque não gasta a barra).

## Os carros e os poderes

| Carro | Vel | Acel | Curva | Peso | Turbo | Poder | Como escapar |
|---|---|---|---|---|---|---|---|
| Vulcão | 4 | 3 | 2 | 4 | 3 | 🌋 Terremoto (todo mundo escorrega) | estar no ar na hora do tremor |
| Dourado B7 | 5 | 3 | 3 | 2 | 3 | 🛡️ Escudo Refletor (bloqueia e devolve) | esperar o escudo acabar |
| Lagartixa | 3 | 4 | 5 | 2 | 2 | 🛢️ Mancha de Óleo (quem passa roda) | desviar da poça |
| Picolé | 2 | 2 | 3 | 5 | 4 | ❄️ Raio Congelante (congela o da frente) | mudar de faixa |
| Buguinho | 3 | 4 | 4 | 2 | 3 | 🔻 Encolhedor (rivais pequenos e lentos) | pegar uma cápsula |
| Kombosa | 2 | 3 | 3 | 4 | 4 | 💨 Cortina de Fumaça (embaça quem vem atrás) | passar pelo lado |
| Tubarão | 3 | 2 | 2 | 5 | 4 | 🧲 Ímã (puxa cápsulas, segura quem está perto) | ficar longe |
| Voador | 4 | 3 | 3 | 1 | 5 | 🌪️ Mini Tornado (levanta e gira) | desviar na hora certa |
| Faísca | 4 | 5 | 3 | 2 | 2 | ⚡ Pulso EMP (desliga o turbo de quem está perto) | sair do círculo azul |
| Jatinho | 3 | 4 | 5 | 1 | 3 | 🔄 Troca-Troca (troca de lugar com o da frente) | ligar o turbo durante a mira |

## As pistas

| # | Pista | Volta | Destaques |
|---|---|---|---|
| 1 | Orla do Rio | 1,6 km | atalho de areia, salto sobre o canal |
| 2 | Favela Morro Acima | 1,7 km | escadaria sem muro, curva fechada inclinada |
| 3 | Deserto | 1,8 km | vale de terra com rampa, 2 saltos |
| 4 | Gelo | 1,8 km | lago com impulso, 2 saltos |
| 5 | Vulcão | 1,9 km | pulo do lago de lava, loop, ponte sem muro |
| 6 | Selva | 1,7 km | atalho de lama, loop da cachoeira |
| 7 | Cidade Neon (noite) | 2,0 km | loop, saca-rolha, viaduto em oito |
| 8 | Porto/Docas | 2,1 km | salto do cais (vão de 22 m), loop |
| 9 | Canyon | 1,9 km | 3 saltos, loop, paredão de 65° |
| 10 | Pista Maluca | 2,2 km | 2 loops, saca-rolha, 2 paredões, 2 atalhos |

## Estrutura

```
index.html            página do desenvolvimento (ES modules + importmap)
TurboCaos.html        o jogo inteiro num arquivo só (gerado: node tools/monta.js)
js/                   código do jogo, um módulo por responsabilidade (contratos em docs/CONTRATOS.md)
js/pistas/            as 10 pistas (construtor de peças -> spline CatmullRom) + a pista de teste
js/poderes/           um arquivo por poder
config/               PARÂMETROS DE JOGO: carros, física, turbo, poderes, dificuldade, pistas, corrida
assets/cars/          os 10 carros (GLB meshopt + KTX2, 400–830 KB, vindos do cidadeaberta)
lib/                  three.js r170 + GLTFLoader/KTX2Loader + decoders meshopt e Basis (sem CDN)
tools/                monta.js (HTML único + pasta do artefato), carros/ (otimização dos GLB), fotos
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
