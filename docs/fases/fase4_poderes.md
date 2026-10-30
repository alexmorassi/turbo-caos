# Fase 4 — Turbo, cápsulas e os 10 poderes (relatório)

O turbo limitado, as cápsulas que o recarregam (geradas sozinhas em qualquer pista) e os dez poderes, cada um com visual, som,
esquiva **verdadeira no código** e heurística para a IA. Tudo em coordenadas da pista, passo fixo, sem `Math.random` (os visuais usam
um gerador próprio, `aleatorio()` de `js/efeitos.js`; a jogabilidade não sorteia nada), sem alocação no passo (pools e temporários
no topo de cada módulo), números em `config/turbo.js` e `config/poderes.js` com a origem comentada.

## 1. Arquivos

| arquivo | o que é |
|---|---|
| `config/turbo.js` | `TURBO` (capacidade por atributo, carga inicial, ×vMax, empurrão, FOV) e `CAPSULAS` (recarga, raio de pega, reaparecer, onde gerar) |
| `config/poderes.js` | os 10 poderes (todos os campos da fundação mantidos; números ajustados com o porquê) + `PODERES_GERAL` |
| `js/turbo.js` | `Turbo`: barra, liga/desliga/vazio, `mod`, FOV da câmera, chamas do escapamento; exporta `capacidadeDoTurbo(cfg)` |
| `js/capsulas.js` | `geraCapsulas(pista)` (exportada: as suítes conferem as 10 pistas) e `Capsulas` (pegar, reaparecer, Ímã, visual instanciado) |
| `js/poderes.js` | o gerente: recarga, botão, Escudo (bloqueia e devolve), eventos, `perigos()`, ajudantes comuns (progresso, à frente/atrás, centro) |
| `js/poderes/comum.js` | `PoderBase`, `difS`, `chaoPara` (chão bom para pôr poça/nuvem), `dComFaixaLivre` (sempre sobra faixa para passar) |
| `js/poderes/<id>.js` | um arquivo por poder: `oleo`, `emp`, `congelante`, `ima`, `trocatroca`, `encolhedor`, `fumaca`, `tornado`, `escudo`, `terremoto` |
| `js/efeitos.js` | efeitos visuais compartilhados (pools fixos, uma malha por tipo): faíscas, pingos, brilhos, nuvens, anéis, bolhas, gelo, funis, chamas, feixes, manchas, círculos pintados |
| `testes/teste_turbo.js` | 49 asserções: turbo, cápsulas, geração nas 10 pistas, IA pegando cápsula |
| `testes/teste_poderes.js` | 116 asserções: contrato comum + um bloco por poder (efeito, esquiva, eventos, IA sim/não, Escudo) |
| `tools/foto_poderes.js` | 24 cenas → `docs/fotos/poderes/<cena>.png` (`--pista`, `--mobile pixel`, `--so <trecho>`, `--porta`) |

## 2. Turbo

- **Capacidade pelo atributo `turbo` (1–5): 2,5 / 3,25 / 4 / 4,75 / 5,5 s** de barra cheia. Começa com **40 %** (dá para usar logo,
  mas a cápsula já importa na primeira volta).
- Gasta **só enquanto o botão está apertado** e há carga. Ligado: `mod.velMax *= 1,3` e `mod.empurrao += 14` (m/s²); câmera
  `fov(+9°)` só para o jogador. Medido: vMax 38,93 → **50,70 m/s (1,30×)**, FOV 82°, volta à vMax sem tranco ao soltar.
- **Não liga** com `mod.semTurbo` (EMP), **congelado** nem **rodando** (decisão: a física aplica `mod.empurrao` mesmo nesses estados,
  então o turbo tiraria o carro do gelo).
- Eventos: `turbo:liga`, `turbo:desliga`, `turbo:vazio` (quando a barra acaba ligada **e** uma vez no aperto com a barra vazia — o
  HUD/áudio dão o "tóin" de vazio).
- **Recarrega SÓ com cápsula** (normal +30 %, dourada enche). Visual: duas chamas laranja no escapamento (shader próprio, 2,1 m), halo
  e faíscas de fogo; tudo reservado no `inicia()`.

## 3. Cápsulas

**Onde nascem** (`geraCapsulas`, de qualquer pista; nada é escrito à mão nas definições — mas as `capsulas`/`douradas` de uma
definição entram):
1. fileiras atravessadas na principal a cada **125 ± 20 m** (a primeira a 70 m da largada), 3 por fileira em pista ≥ 12 m (2 nas
   estreitas), cobrindo a largura: todo mundo pega um pouco;
2. **atalhos**: fileiras a cada **45 m** (mais cápsula por metro que a principal — conferido nas 10 pistas);
3. **risco/recompensa**: uma linha colada na beira **sem muro** (≥ 30 m), uma no meio da **terra** e um par no **pouso** de cada salto,
   fora do centro (8 m depois do pouso);
4. **douradas: 1 a 3 por volta** — as da definição; sem nenhuma, uma no meio de cada atalho e no pouso do primeiro salto; no máximo 3,
   atalho tem preferência (na Maluca o viaduto perde a dele);
5. **nunca** em loop/saca-rolha/paredão (marca MAGNÉTICO), vão, crista, boca de atalho nem a 12 m da largada: o lugar ruim empurra a
   cápsula até 30 m para a frente, senão ela não existe. Nenhuma a menos de 6 m de figura, todas dentro da faixa que o carro alcança.

Resultado (cápsulas, douradas, atalhos): teste 30 (2) / Orla 56 (3) / Favela 58 (3) / Deserto 72 (3) / Gelo 61 (2) / Vulcão 65 (3) /
Selva 60 (2) / Neon 56 (2) / Porto 66 (2) / Canyon 71 (3) / Maluca 61 (3).

**Pegar**: distância 3D do centro do carro ao da cápsula < **2,2 m × escala** — qualquer carro, IA também; quem voa por cima não pega;
quem já chegou não pega. Reaparece em **3 s** (dourada **15 s**), "nascendo" crescendo. Encolhido que pega volta ao tamanho.
Evento `capsula:pega { carro, dourada }`. A IA real pegou **23 cápsulas com 5 rivais em 30 s** na suíte.

**API**: `proximas(carro, alcance) -> [{ sup, s, d, dourada, pos }]` (só ativas, à frente, da mais perto à mais longe; array e objetos
reaproveitados por carro), `atrai(pos, raio, carro) -> quantas` (Ímã: voam a 28 m/s, no mínimo 30 m/s com o dono rápido),
`contaPerto(pos, raio)` (heurística do Ímã). Visual: dois `InstancedMesh` (azul 1,3 m e dourada 1,75 m, cápsula + anel inclinado,
girando e flutuando a 1,25 m), halo por billboard reservado, faíscas douradas, explosão de pingos + clarão ao pegar.

## 4. Os 10 poderes

**Comum a todos**: primeiro poder pronto **5 s depois do VAI**; recarga por tempo (`recarga` do config; o anel do botão é
`recarga(c)`); o botão PODER é por **borda** (apertar, não segurar); **congelado, o PODER quebra o gelo** (`quebraGelo`, idempotente
por passo) e **não dispara**; ninguém aplica efeito direto — tudo passa por `acerta(id, de, alvo)`, que confere o **Escudo**
(bloqueia, estoura a bolha, `poder:bloqueado`, e **devolve** uma vez para quem mandou: sem pingue-pongue). Eventos: `poder:usa`,
`poder:acerta`, `poder:bloqueado`, `poder:esquivou` (o alvo escapou de verdade), `poder:fim` (todo efeito com tempo, ao acabar).
O jogador recebe aviso na tela (`G.hud.aviso`) quando é o alvo e a câmera treme quando é acertado.

| poder (carro) | recarga | o que faz (números) | esquiva — verdade no código | a IA usa quando |
|---|---:|---|---|---|
| 🛢️ Óleo (Lagartixa) | 10 s | poça 6 m atrás, raio 3,2 m (+0,8 de contato), dura **10 s**; quem passa no chão roda 1,4 s; o dono é imune | a poça encolhe/desloca para sobrar **1,6 m de faixa livre**: passe pelo lado (`esquivou` ao passar rente) | rival 4–30 m atrás |
| ⚡ Pulso EMP (Faísca) | 14 s | carga **0,6 s** (círculo azul pintado + cortina crescendo), estoura em **24 m**: sem turbo por 3 s | quem estava dentro e **saiu do círculo** antes do estouro escapa | rival a < 19 m |
| ❄️ Raio Congelante (Picolé) | 12 s | raio corre **pela faixa** do disparo a **80 m/s**, até 70 m; o 1º carro na faixa (1,5 m + meio carro) congela **1,5 s** em bloco de gelo | **mude de faixa** (aviso "Raio de gelo! Mude de faixa!"); voando > 2,5 m passa por cima; congelado, toques no PODER quebram | alvo à frente **em linha**, 2–60 m |
| 🧲 Ímã (Tubarão) | 13 s | campo de 3 s: cápsulas a 35 m voam para o dono; rival a **< 14 m** fica segurado (vMax × 0,82, +0,35 s depois de sair) | **fique a mais de 14 m** (`esquivou` para quem chegou perto sem entrar) | rival a < 12,6 m ou ≥ 2 cápsulas a 28 m |
| 🔄 Troca-Troca (Jatinho) | 18 s | mira **1 s** (feixe rosa + anel) no carro da frente (≤ 60 m) e troca os dois de lugar (posição, velocidade, faixa) | **ligue o TURBO** durante a mira (ou fuja além de 75 m): a mira quebra | carro à frente a 6–48 m, sem turbo nem escudo |
| 🔻 Encolhedor (Buguinho) | 15 s | carga 0,5 s (círculo roxo), encolhe quem estiver a **22 m** por **4 s**: escala 0,55, vMax × 0,8, massa × 0,5 | **pegue uma cápsula**: volta ao normal na hora (`poder:fim`); ou saia do círculo na carga | rival a < 17,6 m |
| 💨 Fumaça (Kombosa) | 11 s | nuvem colorida 8 m atrás, **18 m × 8,4 m**, dura 6 s; dentro, `mod.visao` sobe até 0,85 no meio (o HUD embaça a tela, a IA erra mais) | a nuvem **não cobre a pista toda** (1,6 m livres): passe pelo lado | rival 4–35 m atrás |
| 🌪️ Mini Tornado (Voador) | 13 s | projétil a **75 m/s** pela pista (até 220 m), mira de leve (**2,2 m/s** de correção lateral a < 120 m); pega a 2,4 m do centro: levanta 1,3 s girando | **desvie para o lado na hora certa** (aviso 1,6 s antes para o jogador); quem passou ileso `esquivou` e o tornado mira no próximo; voando por cima também escapa | carro à frente a 10–154 m |
| 🛡️ Escudo Refletor (Dourado B7) | 16 s | bolha dourada **8 s** ou até bloquear: bloqueia o próximo poder (poça e nuvem inclusive) e devolve; em poder de área o dono fica imune e quem mandou leva | (para quem ataca) **espere a bolha acabar** — pisca no último 1,5 s; a IA não gasta Troca-Troca nela | há ameaça: projétil/raio/mira/pulso vindo, ou rival perto com poder pronto que alcança |
| 🌋 Terremoto (Vulcão) | 17 s | carga **0,8 s** (chão já treme, círculo laranja), tremor em **90 m**: quem está **no chão** escorrega 3 s (aderência × 0,35); o dono nunca | **pule numa rampa**: no ar na hora do tremor não sente nada (`esquivou`) | ≥ 2 rivais a 54 m ou 1 a 35 m |

Medidas da suíte: o alvo do Congelante que trocou de faixa estava a **4,45 m** da faixa do raio quando ele passou; o Troca-Troca deu
**25,15 m** de ganho ao jogador; o carro que desviou do tornado estava a **3,10 m** de lado quando ele passou.

`perigos()` (para a IA da fase 5 desviar): só o que está **na pista e se desvia pela faixa** — `oleo`, `fumaca`, `tornado` —
`{ tipo, sup, s, d, raio, comprimento, dono, alvo }` (array e objetos reaproveitados). Pulsos (EMP, Encolhedor, Terremoto) e o
Ímã não entram: são círculos em volta do dono, não obstáculo de faixa; o raio do Congelante e a mira do Troca-Troca entram pela
`ameacaPara` de cada módulo (o Escudo da IA). `ativosEm(c) -> [{ poder, id, resta }]` lista só o que a física não mostra sozinha
(sem turbo do EMP, Ímã — o campo do dono e o rival segurado —, mira do Troca-Troca no alvo, Fumaça, Escudo, escorregando do Terremoto): gelo, rodopio, levantado e encolhido o HUD já mostra pelo carro.

## 5. Efeitos visuais (`js/efeitos.js`)

Uma malha por TIPO de efeito (o padrão do Breno): ~12 chamadas de desenho a mais com todos os poderes na tela, nenhuma sem efeito
(malha sem ninguém ativo fica invisível). Pools fixos (480 faíscas, 480 pingos, 384 brilhos, 224 nuvens, 20 anéis, 10 bolhas, 8 gelos,
6 funis, 24 chamas, 6 feixes de 24 segmentos, 10 manchas, 10 círculos pintados), `G.qualidade.p.particulas` escala as partículas.
Regras aprendidas nas fotos (estão no cabeçalho do módulo):
- **Cor em sRGB convertida no vértice (pow 2,2) e `toneMapped: false`**: sem isso o azul do EMP saía branco desbotado (o ACES lava cor
  saturada).
- **Aditivo só para LUZ** (faíscas, brilhos, chamas): cortina, bolha, funil, feixe e nuvem são mistura normal — aditivo sobre o céu
  claro de dia vira branco.
- Os poderes de área **pintam o asfalto** (`Circulos`, decalque que segue a pista): a cortina vista de dentro quase some; o círculo
  no chão é o que a criança lê como "saia daqui".
- `smoothstep(a, b, x)` com `a >= b` é indefinido no GLSL (NaN no SwiftShader): o anel sumia. Use `1.0 - smoothstep(b, a, x)`.
- A fita do raio tem a **largura da faixa que congela** (3 m): com 1,2 m a câmera de trás via um fio de 5 px (a estrada de 10 a 30 m à
  frente ocupa ~40 px de altura na tela).

## 6. Fotos

`node tools/foto_poderes.js` (Orla, carro Vulcão, qualidade alta; `--mobile pixel` grava `<cena>_pixel.png`; `--so congelante` refaz
só as cenas que casam). 24 cenas em `docs/fotos/poderes/`: turbo, turbo_lado, capsulas, capsula_dourada, capsula_pega, oleo_poca,
oleo_rodando, emp_carga, emp_estouro, congelante_raio, congelante_gelo, ima, trocatroca_mira, trocatroca_troca, encolhedor_carga,
encolhedor_encolhidos, fumaca_nuvem, fumaca_dentro, tornado, tornado_levanta, escudo, escudo_bloqueia, terremoto_carga,
terremoto_onda. Todas olhadas; o que estava invisível ou feio foi corrigido (seção 5). São PNG (o `.gitignore` ignora PNG em
`docs/fotos`): `python3 tools/fotos_jpg.py` (maestro) converte para JPEG antes do commit. Console limpo em todas.

## 7. Como testar

```
node testes/rodar.js --so turbo poderes fundacao fisica telas --porta 8134               # 106 s, FALHAS: 0
node testes/rodar.js --so turbo poderes fundacao fisica telas --porta 8134 --mobile pixel  # 128 s, FALHAS: 0
node testes/rodar.js --so camera entrada audio save ia dificuldade corridas mobile pistas --porta 8134   # 169 s, FALHAS: 0
node tools/foto_poderes.js --porta 8134
```
As suítes trocam o `ia.passo`/`dificuldade.passo` dos carros por pilotos de roteiro (velocidade, faixa, turbo, poder) — a IA real só
entra no bloco "a IA pega cápsula". Cada poder tem um bloco: efeito aplicado, esquiva funcionando (o alvo que faz o que o texto
`esquiva` diz escapa e recebe `poder:esquivou`), eventos, `iaDeveUsar` verdadeiro na situação boa e falso na ruim, Escudo
(bloqueia, devolve, imune nos poderes de área, sem pingue-pongue), terremoto pulado numa rampa, câmera tremendo no jogador.

## 8. Decisões (a opção mais simples, anotadas)

- **D1** Turbo não liga congelado nem rodando (além do EMP): a física aplica o empurrão nesses estados.
- **D2** O Troca-Troca devolvido pelo Escudo faz quem mandou trocar com **quem vem logo atrás dele** (trocar com o dono do escudo
  seria acertar o próprio alvo); sem ninguém atrás, nada acontece (sem evento).
- **D3** O dono é imune à própria poça e à própria nuvem; quem já cruzou a chegada não é alvo nem pega cápsula.
- **D4** No máximo 3 douradas por volta, atalho primeiro (na Maluca a do viaduto sai).
- **D5** `poder:fim` sai para todo efeito com tempo (rodopio do óleo, gelo, sem turbo, segurado, encolhido, nuvem, levantado,
  escorregando, escudo) — o áudio toca `gelo_quebra` no fim do Congelante do jogador.
- **D6** Números mudados com o porquê no config: óleo 12 → 10 s, EMP raio 26 → 24 m, Congelante 120 → 80 m/s, tornado acerto 2,6 →
  2,4 m (sem esses, a esquiva escrita não funcionava ou o pelotão inteiro ficava dentro).
- **D7** Os efeitos não passam pelo tonemap ACES (`toneMapped: false`), para a cor do poder ser a cor escolhida.

## 9. Pendências

1. **Feixes de frente** (Congelante, Troca-Troca) continuam discretos vistos da câmera de trás — perspectiva: a estrada à frente ocupa
   pouca altura na tela. Lê-se pela fita da largura da faixa, pelos cristais, pelo clarão da ponta, pelo aviso no alvo e pelo selo do
   HUD. Se o playtest disser que não dá para ver, o próximo passo é uma faixa de gelo pintada no asfalto (decalque que segue a pista).
2. Turbo × faixa de impulso empilham (1,3 × 1,3 = 1,69 × vMax) — já anotado pela fase 5; pode ser de propósito.
3. Não rodei `tools/monta.js` (maestro). Os meus arquivos não têm `fetch`, `import.meta`, `Math.random` nem `Date.now`; as texturas
   são de canvas, os sons são os nomes que o `js/audio.js` já sintetiza.
4. PNG das fotos esperando o `tools/fotos_jpg.py` (maestro).

## 10. Mudanças de contrato propostas ao maestro (seção 8 do `docs/CONTRATOS.md`)

1. `perigos()` devolve `{ tipo: 'oleo'|'fumaca'|'tornado', sup, s, d, raio, comprimento, dono, alvo }` — `comprimento` (meio
   comprimento da nuvem pela pista), `dono` e `alvo` (o tornado tem alvo); pulsos e Ímã não entram (não se desviam pela faixa).
2. `ativosEm(c) -> [{ poder, id, resta }]` sem o que a física já mostra (gelo, rodopio, levantado, encolhido).
3. `carro.poder = { id, restante, total, usos }` (criado no `poderes.inicia()`).
4. APIs a mais: `geraCapsulas(pista)` e `capsulas.contaPerto(pos, raio)`; `turbo.soma(carro, fracao)`, `turbo.bloqueado(carro)`,
   `capacidadeDoTurbo(cfg)`; `poderes.acerta(id, de, alvo)`, `escudoAtivo(c)`, `ameacado(c)`, `perigo(...)`,
   `mods.encolhedor.restaEncolhido(c)`.
5. Seção 3: `turbo:vazio` também no aperto com a barra vazia (uma vez por aperto); `poder:fim` para todo efeito com tempo, Escudo
   inclusive; `poder:esquivou` só quando o alvo escapou de verdade.
6. `config/poderes.js`: campos novos (`contato`, `livre`, `segura`, `foge`, `massa`, `meiaLargura`, `cegoDevolvido`, `raioAcerto`,
   `mira`, `miraDe`, `carga` do EMP/Encolhedor/Terremoto) e `PODERES_GERAL`; `config/turbo.js` com `TURBO` e `CAPSULAS`.
