// AS MUSICAS DO SUNO (gerado por tools/musica/prepara.py — nao edite os numeros do loop a mao: rode o script de novo). Uma faixa
// por id: menu, podio e o id de cada pista (js/pistas/*.js). O arquivo tem o LOOP com 1 compasso de folga de cada lado; `inicio` e
// `fim` sao o loop em segundos DENTRO do arquivo (AudioBufferSourceNode.loopStart/loopEnd), ja com a emenda misturada no fim. Todas
// sairam em -16 LUFS; `ganho` e o ajuste fino de cada uma no jogo (1 = como saiu; o script preserva o que estiver escrito aqui). O
// volume da musica toda contra a sintetizada fica em MUSICA_ARQUIVO_VOL (js/audio.js). Pista sem linha aqui (a de teste, uma nova)
// toca a musica sintetizada do js/musica.js.
export const MUSICAS = {
  menu: { arquivo: 'assets/musica/menu.mp3', inicio: 1.996792, fim: 81.869250, ganho: 1, bpm: 120.19, compassos: 40 },
  orla: { arquivo: 'assets/musica/orla.mp3', inicio: 1.838208, fim: 96.326917, ganho: 1, bpm: 132.08, compassos: 52 },
  favela: { arquivo: 'assets/musica/favela.mp3', inicio: 1.841271, fim: 104.810312, ganho: 1, bpm: 130.52, compassos: 56 },
  deserto: { arquivo: 'assets/musica/deserto.mp3', inicio: 1.931333, fim: 78.633958, ganho: 1, bpm: 125.16, compassos: 40 },
  gelo: { arquivo: 'assets/musica/gelo.mp3', inicio: 1.778375, fim: 100.942521, ganho: 1, bpm: 135.53, compassos: 56 },
  vulcao: { arquivo: 'assets/musica/vulcao.mp3', inicio: 1.588521, fim: 96.126875, ganho: 1, bpm: 152.32, compassos: 60 },
  selva: { arquivo: 'assets/musica/selva.mp3', inicio: 1.842667, fim: 104.141979, ganho: 1, bpm: 131.38, compassos: 56 },
  neon: { arquivo: 'assets/musica/neon.mp3', inicio: 1.713437, fim: 83.915292, ganho: 1, bpm: 140.14, compassos: 48 },
  porto: { arquivo: 'assets/musica/porto.mp3', inicio: 1.553313, fim: 107.111292, ganho: 1, bpm: 154.61, compassos: 68 },
  canyon: { arquivo: 'assets/musica/canyon.mp3', inicio: 1.786667, fim: 101.770708, ganho: 1, bpm: 134.42, compassos: 56 },
  maluca: { arquivo: 'assets/musica/maluca.mp3', inicio: 1.495146, fim: 114.509375, ganho: 1, bpm: 161.40, compassos: 76 },
  podio: { arquivo: 'assets/musica/podio.mp3', inicio: 1.888208, fim: 54.507896, ganho: 1, bpm: 127.71, compassos: 28 },
};
