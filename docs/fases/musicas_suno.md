# As músicas do Suno (02/11/2026)

Pedido: "a atualização das músicas está em D:\Downloads\Turbo Caos Songs. criei no padrão "Turbo Caos - Nome"". Plano: o doc
"Turbo Caos — músicas do Suno" (12 faixas: menu, pódio e uma por pista; loop sem emenda; −16 LUFS; MP3 ~115 kbps; a sintetizada de
reserva).

## O que entrou

- `tools/musica/prepara.py` (+ `estica.py`): das 12 faixas inteiras (WAV 48 kHz, ~150 s) sai um MP3 com o loop e 1 compasso de folga
  de cada lado, e a linha de `config/musicas.js` (início e fim do loop dentro do arquivo). O método está no cabeçalho do script.
- `js/faixas.js`: busca (bloco embutido / módulo `.mp3.js` / HTTP, como o `carregaGLB`) e decodifica; no máximo 2 decodificadas.
- `js/audio.js`: `musica()` toca a faixa num `AudioBufferSourceNode` em loop; espera até 1,5 s, senão a sintetizada entra e a faixa
  entra por cima quando chega; pedido novo vence faixa atrasada; `preparaMusica()` (a tela de carga da corrida pede a da pista).
- `tools/monta.js`: as faixas embutidas no HTML único (15 → 37 MB; limite 25 → 45 MB) e como `.mp3.js` no artefato.
- Testes: `teste_audio` (as 12 decodificam, emenda renderizada sem estalo, trocas seguidas, teto de memória, faixa que falha e faixa
  lenta, `?mudo=1` não busca nada) e `--html --artefato` (as faixas chegam pelo caminho de cada entrega e decodificam).

## Medido

O Suno não gera em andamento fixo (a Orla acelera de 130 para 134 BPM): as batidas são marcadas uma a uma e o fim do loop é esticado
numa rampa de 8 compassos (coluna "estica") para chegar no andamento do começo. "Pulo" e "andamento" são medidos no MP3 pronto, 8
batidas de cada lado da emenda. Acorde e timbre: semelhança das 8 batidas em volta do fim com as 8 em volta do começo (antes/depois).
Junção: o pulo comparado com as transições da própria música (percentil; 50 = tão liso quanto um ponto qualquer dela).

| faixa | loop (s) | compassos | BPM | começa em (s) | acorde | timbre | junção | estica | pulo (ms) | andamento | KB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| menu | 79.9 | 40 | 120.2 | 49.2 | 0.97/0.96 | 0.58/0.65 | 64 | 0,0 % | −0.6 | −0,17 % | 1232 |
| orla | 94.5 | 52 | 132.1 | 5.5 | 0.91/0.91 | 0.73/0.63 | 81 | +2,0 % | −2.9 | +0,08 % | 1349 |
| favela | 103.0 | 56 | 130.5 | 23.5 | 0.91/0.91 | 0.50/0.50 | 79 | +0,3 % | +1.9 | +0,50 % | 1507 |
| deserto | 76.7 | 40 | 125.2 | 25.5 | 0.92/0.91 | 0.49/0.49 | 88 | +0,6 % | +4.4 | −0,10 % | 1140 |
| gelo | 99.2 | 56 | 135.5 | 7.1 | 0.70/0.67 | 0.56/0.56 | 91 | +1,2 % | +3.9 | +0,28 % | 1440 |
| vulcao | 94.5 | 60 | 152.3 | 42.7 | 0.67/0.75 | 0.02/0.22 | 93 | +1,7 % | −4.9 | +0,09 % | 1333 |
| selva | 102.3 | 56 | 131.4 | 35.0 | 0.91/0.78 | 0.34/0.33 | 86 | +1,4 % | −1.0 | +0,12 % | 1500 |
| neon | 82.2 | 48 | 140.1 | 27.6 | 0.96/0.97 | 0.71/0.75 | 84 | +0,2 % | +4.3 | +0,19 % | 1228 |
| porto | 105.6 | 68 | 154.6 | 18.9 | 0.89/0.89 | 0.60/0.66 | 67 | +1,1 % | +6.9 | +0,57 % | 1519 |
| canyon | 100.0 | 56 | 134.4 | 4.4 | 0.90/0.87 | 0.63/0.36 | 92 | +0,4 % | +1.7 | +0,43 % | 1349 |
| maluca | 113.0 | 76 | 161.4 | 15.2 | 0.99/0.98 | 0.60/0.61 | 82 | +1,5 % | +1.3 | +0,39 % | 1600 |
| podio | 52.6 | 28 | 127.7 | 19.2 | 0.99/0.99 | 0.84/0.82 | 87 | +1,2 % | +4.8 | +0,04 % | 785 |

Todas em −16 LUFS (pico verdadeiro de −2,1 a −6,3 dBTP: nenhuma precisou de limitador). A sintetizada sai do tocador em −15,1 LUFS;
com `MUSICA_ARQUIVO_VOL = 1` as faixas ficam ~1 dB abaixo dela.

## Decisões (em `docs/PENDENCIAS.md`)

- Deserto e Neon ficaram abaixo dos 90 s do plano (77 e 82 s): fora da faixa só quando a emenda ganha da melhor de dentro por 0,10
  na nota (ganharam por 0,26 e 0,14).
- 48 kHz (o original), não 44,1: reamostrar só perderia; o navegador converte ao decodificar.
- O HTML único leva as faixas com a mesma qualidade do artefato (37 MB, o plano previa ~43).
- Vulcão é a emenda mais fraca pela medida: a música quase não se repete (timbre 0,02/0,22), o pulo é liso (junção 93) mas o que
  vem depois é outra parte. Selva vem depois. Esperando o Morassi ouvir a prévia.
