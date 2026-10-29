# 🏁 Turbo Caos

Corrida maluca 3D que roda **direto no navegador do celular**, sem instalar nada. Escolha um dos 10 carros do Cidade Aberta — cada um
com atributos próprios e um **superpoder** para atrapalhar os rivais —, junte cápsulas de turbo pelo caminho e encare 10 pistas
temáticas, da Orla do Rio à Pista Maluca final, com atalhos, rampas e loops. Modos **Campeonato** e **Corrida Livre**; a dificuldade
sobe aos poucos e se ajusta sozinha ao jogador.

## Como jogar

| Onde | Como |
|---|---|
| **Celular (principal)** | Abra o link do artefato do Claude (publicado a cada fase) e jogue deitado. |
| **Sem internet / PC** | Dois cliques no `TurboCaos.html` (ou no `Jogar.bat`). É um arquivo único: dá para copiar para o celular também. |
| **Desenvolvimento** | `Servidor.bat` (ou `python server.py 8125`) e abra `http://localhost:8125`. Com `--rede`, abre no celular pela Wi-Fi de casa. |

Controles de toque: direção por **botões** ou **joystick** (ou **inclinando o celular**), aceleração automática (opcional),
**FREIO/DRIFT**, **TURBO** e **PODER**. No PC: setas/WASD, espaço = turbo, E = poder, S = freio, Ctrl = drift.

## Estrutura

```
index.html            página do desenvolvimento (ES modules + importmap)
TurboCaos.html        o jogo inteiro num arquivo só (gerado: node tools/monta.js)
js/                   código do jogo (um módulo por responsabilidade; contratos em docs/CONTRATOS.md)
js/pistas/            as 10 pistas (spline CatmullRom) + a pista de teste
config/               PARÂMETROS DE JOGO: carros, física, turbo, poderes, dificuldade, pistas, corrida
assets/cars/          os 10 carros (GLB com meshopt + KTX2, vindos do cidadeaberta)
lib/                  three.js r170 + GLTFLoader/KTX2Loader + decoders meshopt e Basis (sem CDN)
tools/                monta.js (HTML único + artefato), carros/ (otimização dos GLB), fotos e medidas
testes/               bateria Playwright (node testes/rodar.js)
docs/                 CONTRATOS, PENDENCIAS, relatórios das fases, fotos
```

## Testes

```
node testes/rodar.js                          # bateria inteira (determinística: passo fixo de 1/60 s)
node testes/rodar.js --mobile pixel           # emulando Pixel 7 (ou --mobile iphone)
node testes/rodar.js --html --artefato        # + o HTML único em file:// e a pasta do artefato
```

## Decisões e pendências

Ver [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md).
