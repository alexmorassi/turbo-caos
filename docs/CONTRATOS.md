# TURBO CAOS — contratos entre os módulos

Este documento é a lei entre as fases. Quem escreve um módulo implementa **exatamente** a interface daqui; quem usa, usa só o que
está aqui. Mudar um contrato = anotar no relatório da fase (`docs/fases/faseN_*.md`) e avisar o maestro — nunca mudar por conta
própria o arquivo de outra fase.

---

## 0. Regras gerais

- **Dois agentes nunca escrevem no mesmo arquivo.** A tabela da seção 2 diz quem é dono de cada um. Agentes **nunca** rodam `git`.
- **Estilo** (o mesmo do Cidade Aberta e do dinotrails-web): comentários em português **sem acentos** explicando o **porquê**;
  cabeçalho em todo módulo; identificadores em português; textos visíveis ao jogador com acento normal; constantes em MAIÚSCULAS com
  comentário de onde veio o valor; **nada alocado dentro de `G.passo`** (vetores temporários no topo do módulo).
- ES modules, `import * as THREE from 'three'` e `three/addons/...` (importmap do `index.html`).
- **Determinismo:** a simulação anda só em `G.passo(1/60)`. Nada de `Math.random` na jogabilidade: use `G.sorteio` (semente fixa
  com `?teste=`). Nada de `Date.now()`/`performance.now()` na simulação (só para medir fps).
- **Duas entregas montadas por `tools/monta.js`:** o artefato do Claude (`dist/artefato/`, ES modules como no desenvolvimento, GLB
  como módulo `.glb.js`) e o HTML único `TurboCaos.html`, que abre em `file://`. Por causa dos dois:
  - nada de `fetch`/`XMLHttpRequest` de arquivo local — GLB só por `carregaGLB` (`js/glb.js`), que lê o bloco embutido;
  - nada de `import.meta`, nada de `import()` dinâmico (exceção: `main.js` carregando suíte de teste);
  - nada de CDN, imagem ou som em arquivo: textura é gerada em canvas/código, som é sintetizado no WebAudio (exceção: as fontes
    Baloo 2/Bungee do Google Fonts, injetadas pelo `telas.inicia()` fora dos testes, com fallback do sistema);
  - CSS em `css/jogo.css` (o `monta.js` embute).
- `localStorage` sempre em try/catch (em `file://` e no modo privativo ele levanta exceção no simples acesso). Só via `G.save`.
- Erro no console reprova a suíte de teste.

## 1. O laço e o objeto `G` (`js/main.js`, dono: fundação)

```
window.G = {
  PASSO: 1/60, relogio: { t, quadros },
  flags,                 // seção 11
  renderer, cena, camera,          // cena e camera DA CORRIDA (a vitrine dos menus tem a sua)
  desenho: { cena, camera } | null // o que o laco desenha neste quadro (corrida ou vitrine); null = so limpa
  sorteio,               // js/sorteio.js: num() [0,1), entre(a,b), inteiro(a,b), escolhe(lista), semente(n)
  entrada, camera3p?,    // fase 2
  telas, hud, audio, vibracao, save, qualidade,   // fase 6
  jogo,                  // js/jogo.js: maquina de estados
  corrida,               // js/corrida.js: a corrida atual ou null
  passo(dt), quadro(dtReal)
}
```
- **`G.passo(dt)`** (sempre 1/60): `entrada.passo` → `corrida.passo` (se houver) → `telas.passo` → `hud.passo` → `audio.passo`
  → `relogio`. Com `?teste=` o `requestAnimationFrame` **não** chama `passo`: quem chama é o harness.
- **`G.quadro(dtReal)`**: `corrida.quadro` (sincroniza malhas, efeitos) → `telas.quadro` → desenha `G.desenho`.
- Acumulador com teto de 4 passos por quadro de tela. Modo 30 fps (`G.qualidade.limiteFps === 30`): desenha 1 quadro a cada 2 passos.
- Aba escondida (`visibilitychange`): pausa a corrida, `audio.suspende()`, zera o acumulador e `entrada.esqueceTudo()`.
- `webglcontextlost`: mensagem "toque para recarregar".

## 2. Arquivos e donos

| Dono | Arquivos |
|---|---|
| fundação (maestro) | `index.html`, `js/main.js`, `js/jogo.js`, `js/corrida.js`, `js/pista.js`*, `js/glb.js`, `js/modelo_carro.js`, `js/eventos.js`, `js/sorteio.js`, `js/pistas/teste.js`, `config/corrida.js`, `tools/monta.js`, `server.py`, `Jogar.bat`, `testes/harness.js`, `testes/rodar.js`, `testes/teste_fundacao.js`, `testes/teste_html_unico.js`, `docs/CONTRATOS.md`, `docs/PENDENCIAS.md`, `CLAUDE.md`, `README.md` |
| fase 1 carros | `tools/carros/**`, `assets/cars/**`, `config/carros.js` |
| fase 2 física | `js/carro.js`, `js/visual_carro.js`, `js/colisoes.js`, `js/entrada.js`, `js/camera.js`, `config/fisica.js`, `testes/teste_fisica.js`, `testes/teste_entrada.js`, `testes/teste_camera.js` |
| fase 3 pistas | `js/pistas/*.js` (menos `teste.js`), `js/visual_pista.js`, `js/cenario.js`, `js/ceu.js`, `config/pistas.js`, `testes/teste_pistas.js`, `tools/foto_pistas.js` |
| fase 4 turbo/poderes | `js/turbo.js`, `js/capsulas.js`, `js/poderes.js`, `js/poderes/*.js`, `js/efeitos.js`, `config/turbo.js`, `config/poderes.js`, `testes/teste_turbo.js`, `testes/teste_poderes.js` |
| fase 5 IA | `js/ia.js`, `js/dificuldade.js`, `config/dificuldade.js`, `testes/teste_ia.js`, `testes/teste_dificuldade.js` |
| fase 6 interface | `css/jogo.css`, `js/telas.js`, `js/hud.js`, `js/minimapa.js`, `js/vitrine.js`, `js/audio.js`, `js/musica.js`, `js/vibracao.js`, `js/save.js`, `js/qualidade.js`, `testes/teste_telas.js`, `testes/teste_save.js`, `testes/teste_audio.js` |
| fase 7 testes | `testes/teste_corridas.js`, `testes/teste_mobile.js`, `tools/foto.js`, `tools/mede.js` |

`*` `js/pista.js` é da fundação; a fase 3 pode **acrescentar** funções a ele (sem mudar assinatura nem significado do que existe).
Os arquivos marcados como "stub" na fundação são substituídos por inteiro pelo dono.
Pendências de cada fase vão no relatório `docs/fases/faseN_<nome>.md`; o maestro consolida em `docs/PENDENCIAS.md`.

## 3. Eventos (`js/eventos.js`)

`on(nome, fn) -> desliga()`, `emite(nome, dados)`, `limpaOuvintes()` (o harness chama entre suítes). Quem emite está entre colchetes.

| Evento | Dados |
|---|---|
| `corrida:carregada` [corrida] | `{ corrida }` |
| `corrida:contagem` [corrida] | `{ n }` (3, 2, 1, 0 = VAI) |
| `corrida:largada` [corrida] | `{}` |
| `corrida:volta` [corrida] | `{ carro, volta, tempo }` (volta que COMEÇOU; tempo = da volta anterior) |
| `corrida:ultima_volta` [corrida] | `{ carro }` |
| `corrida:chegada` [corrida] | `{ carro, posicao, tempo }` |
| `corrida:fim` [corrida] | `{ resultado }` (seção 7) |
| `corrida:pausa` [corrida] | `{ pausada }` |
| `carro:batida` [física] | `{ carro, outro, forca, tipo: 'muro'|'carro' }` (forca em m/s) |
| `carro:decolou` / `carro:pouso` [física] | `{ carro, forca }` |
| `carro:queda` / `carro:volta_pista` [física] | `{ carro }` |
| `carro:drift` [física] | `{ carro, ligado }` |
| `carro:largada_turbo` [física] | `{ carro }` (apertou TURBO — ou ACELERA na aceleração manual — bem no VAI: +9 m/s) |
| `turbo:liga` / `turbo:desliga` / `turbo:vazio` [turbo] | `{ carro }` |
| `capsula:pega` [cápsulas] | `{ carro, dourada }` |
| `poder:usa` [poderes] | `{ carro, poder }` |
| `poder:acerta` / `poder:bloqueado` / `poder:esquivou` [poderes] | `{ de, alvo, poder }` |
| `poder:fim` [poderes] | `{ alvo, poder }` |
| `jogo:tela` [telas] | `{ nome }` |
| `qualidade:muda` [qualidade] | `{ nivel }` |

## 4. Pista (`js/pista.js` — núcleo pronto) e definição de pista (`js/pistas/<id>.js`)

**Curvas para a criança** (30/10/2026): nas 10 pistas toda curva tem raio de desenho ≥ 50 m (`direita/esquerda` do construtor; os
desvios de 90° viraram 60° onde o bojo cresceu demais) e a inspeção (`js/pistas/inspecao.js`, item 9) reprova curva cuja curvatura
média em ±4 m dê raio abaixo de `raioDaCrianca()` = raio de giro do carro que menos vira na vMax ÷ `AJUDA.FRACAO_DA_CURVA` + 6 m de
faixa de dentro (hoje 40,1 m; loop, paredão, saca-rolha e salto ficam fora). O construtor emite curva de 7,5° em 7,5° (era 15°: a
curvatura da CatmullRom ondulava ~20 %).

**Coordenadas da pista:** `(sup, s, d, h)` — superfície (0 = principal, k = atalho k), metros percorridos, metros à direita do
centro, metros acima do asfalto. Quadro por amostra: `T` frente, `N` cima da pista, `R = T × N` direita.

```js
export default {
  id: 'orla', nome: 'Orla do Rio', ordem: 1,      // ordem 1..10 = sequência do campeonato e base da dificuldade
  largura: 14,                // m (padrão 14); muro: true (padrão: muro dos dois lados)
  pontos: [ [x,y,z] | { p:[x,y,z], larg, incl } ],  // spline FECHADA; ponto 0 = LARGADA, numa reta; incl em graus (+ = borda direita mais baixa)
  trechos: [ { de, ate, tipo } ],   // de/ate = índice de ponto de controle (fração vale); tipo: vao | lanca | magnetico | terra | impulso | sem_muro | sem_muro_esq | sem_muro_dir
  atalhos: [ { de, ate, lado: 'dir'|'esq', largura, pontos: [...], trechos: [...], nome } ],  // de/ate = pontos da principal; trechos em índice dos pontos do atalho
  capsulas: [ { em, d } ], douradas: [ { em, d } ],   // opcionais (em = índice de ponto); a fase 4 gera o resto sozinha
  tema: { ... }               // esquema definido pela fase 3 (céu, neblina, luz, cores, cenário)
};
```
API do núcleo (ver o código de `js/pista.js`):
- `new Pista(def)`: `principal`, `atalhos[] { sup, lado, sEntrada, sSaida, sPulado, largura, nome }`, `superficies[]`, `comprimento`,
  `tema`, `sDoPonto(k)`, `sPrincipal(supId, s)` (progresso equivalente), `sup(id)`, `transicao(supId, s, d, pos, out)`, `grade(n)`.
- `Superficie`: arrays `P, T, N, R` (Float32Array ×3), `larg`, `kh` (curvatura no plano, + = curva à direita), `kv`, `marcas`
  (bits de `MARCA`), `n`, `ds`, `comprimento`, `fechada`; métodos `idx`, `normaliza`, `local`, `marcasEm`, `larguraEm`, `khEm`, `kvEm`,
  `quadro(s, T, N, R)`, `ponto(s, d, h, out)`, `projeta(pos, dica, janela, out)` → `{ i, s, d, h, dist2 }`.
- **Atalho:** nasce colado na borda (`lado`) e corre `BOCA_DO_ATALHO` (12 m) ao lado da principal; nas bocas as bordas que se tocam
  ficam com `ABRE_*` e sem muro. A física chama `pista.transicao(...)` quando o carro passa da meia largura numa amostra com `ABRE_*`
  do lado em que ele saiu, e também quando chega ao fim do atalho (`s >= comprimento - 1`, aí força a troca projetando na principal).
- `MARCA.LARGADA` na amostra 0 da principal. Atalho nunca cruza a largada.

Campos extras da definição que o núcleo ignora (fase 3): `figuras`, `elevados`, `marcos`, `comprimentoNominal`, `tema { ..., musica }`
e, nos atalhos, `figuras`, `elevados`, `douradas`/`capsulas` (índice de ponto DO ATALHO). Montagem por peças em `js/pistas/construtor.js`.

Visual da pista (fase 3): `export async function montaVisualDaPista(G, pista) -> { grupo, quadro(dt), destroi() }` (devolve também
`terreno`, `sol`, `hemi`, `neblina`, `tMontagem`, `conta()`, `aplicaQualidade(p)`; ouve `qualidade:muda`) em
`js/visual_pista.js` (asfalto, zebras, muros, rampas, loops, pilares, cenário instanciado, céu, luz, neblina). Lista de pistas:
`config/pistas.js` exporta `PISTAS` (as 10 defs, em ordem) e `pistaPorId(id)`.

## 5. Carro (`js/carro.js`, fase 2) e modelo (`js/modelo_carro.js`, fundação)

`criaModeloCarro(G, cfg) -> Promise<{ grupo, carroceria, rodas: [{ no, raio, frente, lado }], cfg }>` — clona o GLB normalizado
(`config/carros.js`), frente +Z, chão em y = 0. Usado pela corrida (fase 2) e pela vitrine/pódio (fase 6).

```
class Carro { constructor(G, corrida, { cfg, indice, ehJogador, nome }) }
  // identidade
  indice, cfg, ehJogador, nome
  // estado na pista (física)
  sup, s, d, h, psi, vf, vr, noChao, i          // psi = rumo relativo a T (rad, + = para a direita); vf/vr = velocidade no referencial do carro
  pos, vel (Vector3 mundo), quat (Quaternion), frente, cima, direita (Vector3 mundo)
  velocidade                                     // |vel| em m/s (para HUD/IA)
  // corrida (escrito pela corrida)
  volta, progresso, posicao, chegou, tempoChegada, temposDeVolta[], melhorVolta, sSeguro
  // comandos — escritos ANTES de carro.passo pela entrada (jogador) ou pela IA
  controle: { acel 0..1, freio 0..1, direcao -1..1, drift bool, turbo bool, poder bool (apertou neste passo) }
  // modificadores — ZERADOS pela corrida no começo de cada passo (`zeraMod()`) e multiplicados por turbo/poderes/dificuldade
  mod: { velMax 1, acel 1, aderencia 1, direcao 1, massa 1, escala 1, empurrao 0 (m/s² para a frente), semTurbo false, visao 0 (0..1, fumaça) }
  // sistemas por carro (cada fase cria o seu campo): turbo {carga, capacidade, ativo} (fase 4), poder {...} (fase 4), ia {...} (fase 5)
  fantasma                                        // s de invulnerabilidade depois de voltar à pista (sem colisão, pisca)
  // métodos (física)
  passo(dt)                                       // integra um passo (usa controle e mod)
  colocaNaPista(sup, s, d, psi = 0, vf = 0)       // teleporte no chão
  respawn()                                       // volta para sSeguro, centro da pista
  rodopia(seg)  congela(seg)  quebraGelo(seg)  levanta(seg)   // efeitos que a física sabe fazer (poderes chamam)
  empurra(dvf, dvr)                               // impulso no referencial do carro (m/s)
  estadoDePista() / aplicaEstadoDePista(e)        // para o Troca-Troca: { sup, s, d, h, psi, i, noChao }
  efeitos: { rodopio, gelo, levantado }            // segundos restantes (lidos por HUD/visual/IA)
  visual                                          // VisualCarro (fase 2): quadro(dt) sincroniza malha, rodas, inclinação, sombra
```
- `carro.i` = amostra atual em TODO passo (no chão e no ar): é a dica da projeção.
- `LANCA`: o carro sai com a velocidade que tem, 8° mais para cima (`ANGULO_EXTRA_DA_RAMPA` em config/fisica.js). Quem cai num vão
  volta à pista DEPOIS do buraco (senão cairia de novo para sempre).
- Rodas: `wheelN.rotation.order = 'YXZ'`; rolar = `rotation.x`, esterçar = `rotation.y` (só 1 e 2).
Colisões carro × carro: `js/colisoes.js` → `colide(corrida)` chamado pela corrida depois de todos os `carro.passo`.
Parâmetros de física por atributo (1–5): `config/fisica.js` (fase 2).
Câmera: `js/camera.js` → `new CameraCorrida(G, corrida)` com `passo(dt)`, `quadro(dt)`, `treme(intensidade, seg)`, `fov(extra)`.

## 6. Entrada (`js/entrada.js`, fase 2)

`G.entrada`: `estado { acel, freio, direcao, drift, turbo, poder, pausa }` (0..1 / -1..1), `apertou(acao)` (borda no passo atual),
`simulada` (o harness escreve `estado` direto), `passo(dt)`, `aplicaNoCarro(carro)`, `mostraControles(bool)`, `esqueceTudo()`,
`configura({ modo: 'botoes'|'joystick'|'inclinacao', acelAuto: bool })`. Cria o próprio DOM dos controles de toque (`#controles`) e
lê/grava a configuração por `G.save` (`opcoes.controle` e `opcoes.acelAuto`, os mesmos campos da tela de opções). Layout (pedido do
Morassi, 29/10/2026, no estilo dos jogos de corrida de celular): à esquerda o **botão de ARRASTAR** (`#stick` / `#stick-base` /
`#stick-knob`; o modo `'joystick'`, **padrão desde 30/10/2026** a pedido da criança: progressivo, a ponta do trilho é a direção toda —
`raioDoArrasto()` = (trilho − botão) / 2 —, solto volta ao meio com mola; é também a reserva da inclinação sem sensor). `'botoes'`
(setas ◀ ▶) fica nas opções como "Setas"; `'botoes'` gravado antes de 30/10 sem a marca `opcoes.arrastarPadrao` vira o arrastar uma
vez. À direita o ACELERADOR `#btn-acel` (pedal LARGO no canto) e, colada nele, a coluna redonda `#btn-turbo` (embaixo, ao lado do
pedal) + `#btn-poder` (em cima) — o alcance do polegar no acelerador até o TURBO e o PODER é medido no `teste_mobile` (30/10/2026,
pedido para a criança de 5 anos). **Sem FREIO na tela** (30/10/2026): soltar o acelerador freia (`freioAoSoltar`, `FREIO_AO_SOLTAR`
= 0,2 do freio acima de 2 m/s; parado não vira ré); o teclado mantém S/↓ = freio e Ctrl = drift. **Aceleração automática
DESLIGADA por padrão** (o acelerador aparece); ligada nas opções, o acelerador some e a coluna redonda vai para o canto. `#btn-pausa` só liga `estado.pausa` (a fase 6 põe o botão de pausa dela por cima e lê `apertou('pausa')`).
**AJUDA NA DIREÇÃO** (30/10/2026, `js/assistencia.js`, números em `config/fisica.js` `AJUDA`): `aplicaNoCarro` passa a direção pela
`direcaoAssistida(carro, dedo)` — o dedo pede um **ângulo em relação à estrada** (até `LATERAL_MAX` m/s de lado), solto = paralelo
à pista, a curva da estrada vem sozinha — e o acelerador/freio pela `pedaisAssistidos` ("tira o pé" na curva que o carro não faz
naquela velocidade; nunca antes de salto). Só o jogador: a IA e a física não mudam. `G.entrada.ajuda` (padrão ligada;
`opcoes.ajudaDirecao === false` desliga) — as suítes que pilotam com controlador próprio (física, câmera, IA, turbo) desligam.
`Entrada.curvaDoArrasto(m)` = a curva do arrastar (zona morta + expoente 1,5).
**A tela de corrida (`#tela-corrida`, no `#ui`) fica por cima dos controles e é transparente ao toque** (`#ui #tela-corrida {
pointer-events: none }`; só o `.hud-pausa` recebe toque). Toda camada nova por cima da corrida segue a mesma regra, e o
`teste_mobile` confere com `elementFromPoint` que o dedo no centro de cada controle acerta o próprio controle.
Teclado (desenvolvimento): setas/WASD, espaço = turbo, E/Shift = poder, S/↓ = freio, Ctrl = drift.

## 7. Corrida (`js/corrida.js`, fundação)

`G.jogo.iniciaCorrida({ pista, carro, modo: 'livre'|'campeonato', corredores, voltas, rivais? })` → `Promise<Corrida>`.
```
Corrida: G, opcoes, pista (Pista), visual (da fase 3), carros[], jogador, estado ('carregando'|'contagem'|'correndo'|'terminou'),
  t (s desde a largada), voltas, ordem[] (carros por posição), resultado, pausada
  turbo, capsulas, poderes (fase 4) · ia, dificuldade (fase 5) · camera (fase 2)
  passo(dt), quadro(dt), pausa(bool), reinicia(), destroi()
resultado = { pista, modo, tempoTotal, classificacao: [{ carro, indice, nome, cfgId, posicao, tempo, melhorVolta, ehJogador }],
              jogador: { posicao, tempo, melhorVolta, batidas, vitoria }, voltas }
```
Ordem do passo: `zeraMod` de todos → controles (`entrada.aplicaNoCarro(jogador)` ou IA se `?auto=1`; `ia.passo`) →
`dificuldade.passo` → `poderes.passo` → `turbo.passo` → `carro.passo` de todos → `colide` → `capsulas.passo` → regras (voltas,
posições, chegada) → `camera.passo`. Regras: a volta conta ao cruzar `s = 0` da principal para a frente; terminou quem completou
`voltas`; a corrida acaba quando o jogador chega (os outros recebem tempo estimado pelo progresso) ou em 15 s depois do primeiro,
o que vier antes, com teto de segurança. Interfaces que a corrida espera de cada sistema: `new X(G, corrida)`, `inicia()` (depois da
grade montada), `passo(dt)`, `quadro(dt)`, `destroi()`.

## 8. Turbo, cápsulas e poderes (fase 4)

- **`controle.turbo` é "ligado neste passo"** (a IA segura: liga na reta, solta antes da curva). **O jogador é de UM TOQUE** (pedido do
  Morassi, 30/10/2026): `entrada.aplicaNoCarro` acende no toque e mantém `controle.turbo` ligado sem o dedo até o `js/turbo.js` apagar
  (barra vazia, EMP, gelo, rodopio) — nunca reacende sozinho. Toque rápido (desce e sobe entre dois passos) vale um passo apertado em
  TURBO, PODER e PAUSA.
- `carro.turbo = { carga 0..1, capacidade (s de turbo cheio), ativo }`. Turbo ativo → `mod.velMax *=`, `mod.empurrao +=`
  (valores em `config/turbo.js`, objetos `TURBO` e `CAPSULAS`). `mod.semTurbo` (EMP), gelo e rodopio impedem ligar. Extras:
  `turbo.soma(carro, fracao)`, `turbo.bloqueado(carro)`, `capacidadeDoTurbo(cfg)`. A faixa IMPULSO leva a 1,3 × a vMax do carro e
  NÃO empilha com o turbo.
- `corrida.capsulas`: `proximas(carro, alcance) -> [{ sup, s, d, dourada, pos }]` (ativas, à frente), `atrai(pos, raio, carro)` (Ímã),
  `contaPerto(pos, raio)`; geração automática em `geraCapsulas(pista)` (+ `capsulas`/`douradas` da definição e dos atalhos).
- `corrida.poderes`: `podeUsar(carro)`, `usa(carro)`, `iaDeveUsar(carro) -> bool` (heurística do poder daquele carro: Raio Congelante
  só com alvo à frente em linha, etc.), `recarga(carro) -> 0..1` (anel do botão), `ativosEm(carro)` (efeitos atuais, para o HUD),
  `perigos() -> [{ tipo: 'oleo'|'fumaca'|'tornado', sup, s, d, raio, comprimento, dono, alvo }]` (o que se desvia pela faixa; pulsos e
  Ímã não entram). `ativosEm(c) -> [{ poder, id, resta }]` (sem o que a física já mostra: gelo, rodopio, levantado, encolhido).
  `carro.poder = { id, restante, total, usos }`. Extras: `acerta(id, de, alvo)`, `escudoAtivo(c)`, `ameacado(c)`.
  Eventos: `turbo:vazio` também no aperto com a barra vazia; `poder:fim` para todo efeito com tempo (Escudo inclusive);
  `poder:esquivou` só quando o alvo escapou de verdade.
  Configuração de cada poder em `config/poderes.js`. Todo poder: efeito visual, som (`G.audio.toca`), esquiva/contra-ataque.

## 9. IA e dificuldade (fase 5)

- `corrida.ia.passo(dt)` escreve `controle` de todo carro com `!ehJogador`, e do jogador quando `G.flags.auto` (piloto automático dos
  testes) ou `jogador.chegou` (a festa depois da chegada).
- `corrida.dificuldade`: `inicia()` define `carro.ia = { habilidade, agressividade, precisao, usoDePoder }` pela pista (base gradual)
  e pelo histórico (DDA); `passo(dt)` aplica o fator 0,85–1,15 e o rubber band leve via `mod`; `registra(resultado)` no fim
  (persiste em `G.save`). Números em `config/dificuldade.js` (`BASE`, `DDA`, `ELASTICO`).
- `carro.ia` ganha `ritmo`, `aceleracao`, `papel` ('forte'|'mediano'|'fraco'|'auto') e `fator`; `corrida.dificuldade` expõe `fator`,
  `historico`, `estado`, `base`, `elastico`, `ultimoRegistro`. Leitura (não contrato forte): `corrida.ia.estatisticas`,
  `corrida.ia.planos`; `js/ia.js` exporta `planosDaPista`, `velDaCurva`, `raioDeGiro`, `perfilDoCarro`.
- `carro.modAnterior` (corrida): o `mod` do passo anterior, copiado antes do `zeraMod` — a IA roda antes dos poderes e enxerga o
  efeito por ele. `carro:largada_turbo` vale para rivais também (a IA emite).

## 10. Interface, áudio, salvamento, qualidade (fase 6)

- `G.telas`: `mostra(nome, dados)`, `passo(dt)`, `quadro(dt)`; telas: carregando, menu, selecao_carro, selecao_pista, corrida
  (pausa), resultado (pódio), campeonato, opcoes. Inicia corrida por `G.jogo.iniciaCorrida`; ouve `corrida:fim`.
- `G.hud`: `mostra(corrida)`, `esconde()`, `passo(dt)`; posição, volta, tempo, barra de turbo, botão de poder com anel de progresso,
  minimapa (`js/minimapa.js`), contagem 3-2-1-VAI, sobreposição de fumaça (`mod.visao`). **Nenhuma mensagem no meio da tela durante a
  corrida** (pedido do Morassi, 30/10/2026: o `aviso()` e a faixa de última volta saíram). No lugar: classe **`tc-pronto`** em
  `#btn-turbo` (carga, apagado, sem EMP/gelo/rodopio) e `#btn-poder` (recarregado) quando um toque funciona agora — o botão pula, solta
  uma onda e balança o ícone (`css/jogo.css`); última volta = `.hud-pilula.ultima` (vermelha, pulsa).
- `G.audio`: `desbloqueia()` (no primeiro toque), `toca(nome, { vol, tom, pos }) -> bool`, `motor(carro)`, `musica(nome|pista|null)`
  (devolve o tema; `temaAtual`), `suspende()`/`retoma()`, `volume(geral, musica, efeitos)` em 0..1 (null mantém), `passo(dt)`; ouve os
  eventos da seção 3 para os efeitos (o som de cada poder toca no `poder:usa`; nomes extras: `gelo_quebra`, `acerto_bom`,
  `acerto_ruim`, `esquiva`, `escudo_bloqueia`).
- `G.vibracao.vibra(ms | padrão)` (respeita a opção; `navigator.vibrate` em try/catch).
- `G.save`: `le(chave, padrao)`, `grava(chave, valor)`, `apaga()`, `remove(chave)`, `opcoes()`, `mudaOpcoes(parcial)`, `OPCOES_PADRAO`
  — chaves `turbocaos.*`, tudo em try/catch, cópia em memória se o armazenamento falhar (o jogo continua). Chaves: `progresso`,
  `opcoes`, `carro`, `dda`, `qualidade_auto`, `campeonato_fim`.
- `G.qualidade`: `nivel` ('baixa'|'media'|'alta'), `auto`, `escolha`, `p` (pixelRatio, sombras, densidadeCenario, distancia,
  particulas), `limiteFps` (60|30), `mede(dtReal)` (chamado pelo laço a cada quadro), `define('auto'|nivel, persiste)`; emite
  `qualidade:muda`.
- As telas só reagem às corridas que ELAS começaram: suíte que abre corrida por `G.jogo.iniciaCorrida` não ganha HUD nem pódio
  (para ver o HUD: `G.hud.mostra(c)`).

## 11. Flags de URL e testes

`?teste=<suite>` (o laço para; o harness chama `G.passo`), `?pista=<id>` + `?carro=<id>` (pula os menus e larga direto),
`?auto=1` (IA dirige o jogador), `?corredores=n`, `?voltas=n`, `?qualidade=baixa|media|alta`, `?semente=n`, `?mudo=1`, `?foto=1`, `?sem_armazenamento=1` (localStorage levanta exceção: para testar).
Com `?teste=`, `?foto=` ou `?semente=` o `Math.random` e o `G.sorteio` usam semente fixa.

Bateria: `node testes/rodar.js` (todas), `--so <nome>`, `--mobile pixel|iphone` (emulação de aparelho), `--html` (abre o
`TurboCaos.html` em `file://`), `--gpu`. Saída: `[OK]`, `[ERRO]`, `[MEDE]`, `FALHAS: n`. Suíte = `testes/teste_<nome>.js`:
```js
import { suite, ok, perto, mede, quadros, segundos, segura, solta, aperta, corridaDeTeste, apagaProgresso } from './harness.js';
suite('nome', async (G) => { apagaProgresso(); const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao' }); ... });
```
