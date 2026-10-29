# PENDÊNCIAS E DECISÕES — Turbo Caos

Decisões tomadas sozinho (pedido: "se faltar alguma decisão, siga a opção mais simples, registre aqui e continue") e o que ficou para
você decidir ou conferir. Cada fase detalha as suas em `docs/fases/`.

## Para você conferir/decidir

1. **Referências lidas nos seus artefatos do Claude** ("Breno e o Tesouro do Pirata Morassi" e "Rampa Radical"). Os dois padrões são
   diferentes; segui o do **Breno** (pedido):
   - Breno: artefato com VÁRIOS arquivos — `index.html` + `js/*.js` (ES modules) + `lib/basis/` (transcodificador KTX2 no projeto) +
     cada GLB como módulo `assets/<nome>.glb.js` em base64 (o artefato não serve `.glb`), carregado por `import()` sob demanda.
   - Rampa Radical: um `index.html` único com todo o código dentro e texturas geradas em canvas (sem GLB).
   - Turbo Caos: igual ao Breno (`dist/artefato/`), e ALÉM disso um `TurboCaos.html` único que funciona sem internet em `file://`.
   - **Diferença deliberada:** o Breno carrega o three.js r170 do CDN jsdelivr; aqui o three.js (e os decoders meshopt/KTX2) ficam em
     `lib/` dentro do projeto — o pedido exige "decoders salvos no próprio projeto (sem CDN externo)", e o decoder meshopt mora nos
     addons do three. Funciona igual e não depende de CDN.
   - O Breno tem um GLB reserva `*_web.glb` (texturas comuns) para quando o KTX2 falha. Aqui ainda não: se a textura KTX2 falhar,
     o carro aparece na cor dele (ver fase 1). Dá para acrescentar se algum celular mostrar o problema.
   - Fontes: os dois usam Google Fonts (Baloo 2 / Bungee) com fonte do sistema de reserva; aqui também (sem internet cai na reserva).
2. **Repositório `alexmorassi/turbo-caos`:** não existia e esta sessão não tem permissão para criar repositório. Os commits estão
   prontos; o push acontece assim que o repositório (vazio) existir.

## Decisões da fundação (fase 1)

- **Entrega = `TurboCaos.html` único + `index.html` de desenvolvimento.** O `index.html` usa ES modules + importmap + `server.py`,
  igual às referências. O `TurboCaos.html` é montado por `tools/monta.js` (esbuild empacota o código num script clássico; GLB e
  transcodificador Basis vão em base64 em blocos `<script type="application/octet-stream" id="embutido:...">`) e abre em `file://`
  sem servidor — testado no Chromium (`node testes/rodar.js --html`). Os carros ficam no arquivo e só viram malha quando usados
  ("carregados sob demanda"); as pistas são geradas por código na hora da corrida.
- **WebGL1:** o three r170 (o mesmo das referências) só tem WebGL2 — o WebGL1 saiu no r163. Todo Chrome de Android e Safari de
  iOS 15+ tem WebGL2. Sem ele, o jogo mostra a mensagem "atualize o navegador" em vez de tela preta. Manter um segundo three antigo
  só para WebGL1 dobraria o código por quase nenhum aparelho.
- **toktx bloqueado:** baixar o binário do KTX-Software foi bloqueado no ambiente; as texturas KTX2 são codificadas com o pacote npm
  `ktx2-encoder` (o mesmo Basis Universal, em WebAssembly).
- **Porta 8125** para o servidor e a bateria (a 8123 é a do Cidade Aberta; o dinotrails-web perdeu uma hora com dois servidores na
  mesma porta).
- **Jogador larga em penúltimo** (ultrapassar é a graça; a dificuldade adaptativa evita frustração).
- **A corrida termina 3 s depois de o jogador cruzar a chegada**; quem não chegou recebe tempo estimado pela velocidade média.
- **Campeonato:** pódio (1º–3º) desbloqueia a próxima pista; senão, corre a mesma de novo. Pontos 10-8-6-5-4-3-2-1.
