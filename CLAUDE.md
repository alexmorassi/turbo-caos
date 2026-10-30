# TURBO CAOS — instruções do projeto

Corrida maluca 3D para o **navegador do celular** (Chrome Android / Safari iOS), sem instalar nada: 10 carros do Cidade Aberta com
superpoderes, turbo limitado recarregado por cápsulas, 10 pistas temáticas (loops, rampas, atalhos), Campeonato e Corrida Livre,
dificuldade adaptativa. Público: crianças de 6 a 20 anos. **Fale português comigo neste projeto.**

Arquitetura do jogo de referência **Breno e o Tesouro do Pirata Morassi** (artefato do Claude; cópia de leitura em
`/home/claude/referencias/breno` quando existir) e do `cidadeaberta`/`dinotrails-web`: three.js **r170**, ES modules **sem bundler**,
`lib/` vendorizado (sem CDN), `server.py` + `Servidor.bat`, harness Playwright com passo fixo. **Duas entregas**, as duas montadas por
`node tools/monta.js`:
1. **Artefato do Claude** (a principal, igual ao Breno): `dist/artefato/` = index.html + js/ + config/ + css/ + lib/ + cada GLB como
   módulo `assets/cars/<id>.glb.js` (o artefato não serve `.glb`); publicado pelo maestro, o Morassi abre pelo link no celular.
   **Publicado em https://claude.ai/artifact/FWWGVVDUhpoUng3w8aTfUZ** (slug `757e8c0b-bd1a-4cb4-bcb7-7d6bdde8b396`): republique com
   `publish_files` (slug + base_version da última publicação) a lista de `dist/artefato/arquivos.json`. No artefato não há query
   string (sem flags), o sensor de inclinação é bloqueado pelo iframe (a direção cai para as setas) e fetch a outros hosts é bloqueado.
2. **`TurboCaos.html`** (extra, commitado): HTML único que abre em `file://` sem internet (dois cliques, Jogar.bat).
Os contratos entre módulos estão em **`docs/CONTRATOS.md`** — leia antes de mexer.

## Regras

- **Física de arcade feita à mão em coordenadas da pista** `(s, d, h)` (`js/pista.js`), passo fixo **1/60 s** (`G.passo`). Nada de
  `Math.random` na jogabilidade (`G.sorteio`); nada de `Date.now()` na simulação.
- **Parâmetros de jogo em `config/`**: `carros.js`, `fisica.js`, `turbo.js`, `poderes.js`, `dificuldade.js`, `pistas.js`, `corrida.js`.
  Número de jogabilidade fora de `config/` só com comentário dizendo de onde veio.
- **HTML único:** nada de `fetch` de arquivo (GLB só por `carregaGLB`), nada de `import.meta`, nada de CDN/imagem/som externo
  (textura em canvas, som sintetizado). Única exceção: as fontes Baloo 2/Bungee do Google Fonts, como nos jogos de referência — o
  `<link>` é injetado pelo `telas.inicia()` (fora de `?teste=`/`?foto=`/`?semente=`) e sem internet cai na fonte do sistema.
  Se precisar de um arquivo novo em tempo de execução, ele entra na lista do `tools/monta.js`.
- `localStorage` só por `G.save` (tudo em try/catch, cópia em memória).
- **Estilo:** comentários em português sem acentos explicando o PORQUÊ, cabeçalho em todo módulo, identificadores em português,
  textos visíveis com acento, constantes em MAIÚSCULAS com a origem do valor, nada alocado dentro de `G.passo`.
- Decisão em aberto: a opção mais simples, anotada em `docs/PENDENCIAS.md`.

## Rodar

```
Jogar.bat                       # abre o TurboCaos.html (HTML unico, sem servidor)
Servidor.bat                    # python server.py 8125 + http://localhost:8125 (desenvolvimento, ES modules)
python server.py 8125 --rede    # idem, aberto na rede de casa (testar no celular: http://<ip-do-pc>:8125)
node tools/monta.js             # remonta o TurboCaos.html e a pasta do artefato (dist/artefato) depois de mexer em codigo ou carros
node testes/rodar.js            # bateria inteira (Playwright headless, SwiftShader); FALHAS: 0 ou nao esta pronto
node testes/rodar.js --so fisica --mobile pixel   # so algumas suites, emulando o Pixel 7 (ou iphone)
node testes/rodar.js --html --artefato   # + TurboCaos.html em file:// e dist/artefato por HTTP, uma corrida em cada
node tools/carros/otimiza.mjs   # refaz os GLB dos carros a partir do cidadeaberta (fase 1)
```
Flags de URL: `?pista=<id>&carro=<id>` (larga direto), `?auto=1` (IA dirige o jogador), `?corredores=n`, `?voltas=n`,
`?qualidade=baixa|media|alta`, `?semente=n`, `?mudo=1`, `?teste=<suite>` (o laço para; o harness chama `G.passo`).

## Armadilhas já conhecidas (custaram tempo)

- **`String.replace` com texto como substituto interpreta `$&`** — o código minificado tem `a=$&&b`; no `tools/monta.js` todo
  `replace` usa função. Sintoma: `SyntaxError: Unexpected token '<'` no HTML único.
- **`import()` com texto concatenado faz o esbuild empacotar tudo que casa com o padrão** (até `.git/`): o caminho da suíte de teste
  fica numa variável.
- **Nunca passe um vetor temporário do módulo como `out`** de `ponto()`/`quadro()` da pista: eles usam os mesmos por dentro (1 m de
  erro sistemático no `s`).
- **Loop deslocado (hélice) com quadro transportado tomba ~40° no topo**: use `geraLoop()` (o `cima` de cada ponto aponta para o eixo).
- Herdadas do dinotrails-web: `KTX2Loader.detectSupport(renderer)` antes do primeiro GLB; `Math.random` é compartilhado com o three.js
  (por isso `G.sorteio`); aba escondida não para o som (`visibilitychange`); `localStorage` levanta exceção em `file://`/privativo;
  `devicePixelRatio` muda sem `innerWidth` mudar; `server.py` em HTTP/1.1; erro no console reprova a suíte.

## Fluxo

Fases em `docs/fases/`, pendências consolidadas em `docs/PENDENCIAS.md`. Ao fechar cada fase: bateria verde, `node tools/monta.js`,
`--html --artefato` verdes, commit, push e republicar o artefato (pedido do Morassi).
