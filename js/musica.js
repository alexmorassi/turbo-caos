// MUSICA PROCEDURAL (fase 6). O sequenciador do Breno (referencias/breno/js/audio.js: compose/schedule/newPlayer) adaptado para corrida:
// bateria + baixo + acorde/arpejo + melodia, tudo sintetizado na hora, nenhum arquivo de som.
// Desde 02/11/2026 e a RESERVA: quem toca e a faixa do Suno de cada pista (js/faixas.js). Esta toca na pista sem faixa (a de teste),
// quando a faixa nao decodifica a tempo ou falha, e com `?musica=sintetizada` (js/audio.js).
//
// O QUE MUDOU EM RELACAO AO BRENO (e por que):
//   * `div` (passos por tempo): o Breno anda em colcheias (div 2); corrida pede SEMICOLCHEIA (div 4) — o chimbal correndo a 16 por
//     compasso e o que da a sensacao de velocidade;
//   * `escala`: o Breno so tem a maior (um jogo de piratas fofo); a corrida tem tema de vulcao, espaco e deserto, que soam certos em
//     menor, dorica e menor harmonica. Os acordes continuam sendo os graus 0-2-4 da escala, entao qualquer escala de 7 notas funciona;
//   * um TEMA POR PISTA: `temaDaPista` le `tema.musica` se a fase 3 mandar, senao reconhece a pista pelo nome (Orla -> praia...), senao
//     pela ordem no campeonato. Assim pista nova ganha musica sem ninguem mexer aqui.
//
// A melodia e gerada por um mulberry32 com a semente do tema: a mesma pista toca sempre a mesma musica (loop reconhecivel — a crianca
// cantarola a da pista preferida), e a forma e A B A' C A B A' D em 8 compassos, a mesma do Breno.
//
// Este modulo NAO toca nada: compoe e agenda. Quem tem o AudioContext, os barramentos e o sintetizador e o js/audio.js — que passa o
// sintetizador para `agenda` (assim nao ha import circular e o teste pode compor sem som nenhum).

/** Nota MIDI -> Hz. */
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Escalas de 7 notas (semitons a partir da tonica). */
export const ESCALAS = {
  maior: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  dorica: [0, 2, 3, 5, 7, 9, 10],
  mixolidia: [0, 2, 4, 5, 7, 9, 10],
  harmonica: [0, 2, 3, 5, 7, 8, 11],
};
const mod7 = (d) => ((d % 7) + 7) % 7;
const grau = (tonica, d, escala) => tonica + 12 * Math.floor(d / 7) + escala[mod7(d)];

// passo = 60 / (bpm * div) s. mask: onde a melodia toca (1 compasso). prog: graus dos acordes (0 = I, 3 = IV, 4 = V, 5 = vi).
// baixo: R fundamental, 5 quinta, O oitava, 3 terca. bateria: k bumbo, s caixa, h chimbal, c chocalho, b/B tamborim/bongo, t/T tambor
// (surdo), X = acento. Tudo em texto para o Morassi poder mexer num tema sem entender o compositor.
export const TEMAS = {
  // menus: alegre e sem pressa — a crianca fica um tempo escolhendo carro
  menu: { bpm: 118, div: 2, tonica: 62, escala: 'maior', mask: 'x.xx.x.x', prog: [0, 5, 3, 4], semente: 11, lp: 3600,
    lead: { tipo: 'square', vol: 0.1 }, baixo: 'R..R5.R.', acorde: '..x...x.', bateria: { k: 'x...x...', s: '..x...x.', h: 'x.xxx.xx' } },
  // Orla do Rio: samba-funk — surdo, tamborim e chocalho
  praia: { bpm: 128, div: 4, tonica: 65, escala: 'maior', mask: 'x..x..x...x.x...', prog: [0, 3, 4, 0], semente: 3, lp: 4200, balanco: 0.12,
    lead: { tipo: 'triangle', vol: 0.26, segura: 0.3 }, baixo: 'R..R..5.R..R..O.',
    bateria: { k: 'x.......x.......', T: '....x.......x...', c: 'xxxxxxxxxxxxxxxx', b: 'x.x..x.x.x..x.x.' } },
  // cidade, tunel, noite: eletronico
  cidade: { bpm: 140, div: 4, tonica: 69, escala: 'menor', mask: 'x.x...x.x.x...x.', prog: [0, 5, 3, 4], semente: 21, lp: 2600,
    lead: { tipo: 'sawtooth', vol: 0.1, segura: 0.5 }, baixo: 'R.R.R.R.R.R.O.R.', acorde: '....x.......x...',
    bateria: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' } },
  // selva e floresta: bongos e sino
  selva: { bpm: 124, div: 4, tonica: 67, escala: 'maior', mask: 'x...x.x...x.x.x.', prog: [0, 0, 3, 4], semente: 5, lp: 5000,
    lead: { tipo: 'sine', vol: 0.3, sino: true }, baixo: 'R...R.5.R...R.5.',
    bateria: { b: 'x.xx.x.xx.xx.x.x', B: '..x...x...x...x.', c: 'x.x.x.x.x.x.x.x.', k: 'x.....x.x.......' } },
  // gelo e neve: brilhante, arpejo de sino
  gelo: { bpm: 132, div: 4, tonica: 72, escala: 'maior', mask: 'x...x...x.x.x...', prog: [0, 5, 3, 4], semente: 13, lp: 6000,
    lead: { tipo: 'sine', vol: 0.24, sino: true }, arpejo: 'x.x.x.x.x.x.x.x.', baixo: 'R.......5.......',
    bateria: { k: 'x...x...x...x...', h: 'x.x.x.x.x.x.x.x.', s: '....x.......x...' } },
  // deserto: menor harmonica e tambores
  deserto: { bpm: 120, div: 4, tonica: 64, escala: 'harmonica', mask: 'x..x..x.x...x...', prog: [0, 3, 4, 0], semente: 34, lp: 3000,
    lead: { tipo: 'square', vol: 0.09, vib: [5, 0.012] }, baixo: 'R..R..R.5..5..R.',
    bateria: { t: 'x..x..x.x..x..x.', T: 'x.......x.......', c: '..x...x...x...x.' } },
  // vulcao e lava: pesado e rapido
  vulcao: { bpm: 150, div: 4, tonica: 64, escala: 'menor', mask: 'x.x.x...x.x.xx..', prog: [0, 5, 3, 4], semente: 9, lp: 2200,
    lead: { tipo: 'sawtooth', vol: 0.1, segura: 0.4 }, baixo: 'R.R.O.R.R.R.O.R.',
    bateria: { k: 'x..xx...x..xx...', s: '....x.......x...', T: 'x.......x.......', h: 'xxxxxxxxxxxxxxxx' } },
  // espaco: dorica, arpejo e vibrato
  espaco: { bpm: 136, div: 4, tonica: 66, escala: 'dorica', mask: 'x.....x.x...x...', prog: [0, 3, 5, 4], semente: 55, lp: 4500,
    lead: { tipo: 'sine', vol: 0.26, vib: [6, 0.015], segura: 0.5 }, arpejo: 'x.x.x.x.x.x.x.x.', baixo: 'R...R...5...R...',
    bateria: { k: 'x...x...x...x...', h: '..x...x...x...x.', s: '....x.......x...' } },
  // doces: fofo, acordes curtinhos
  doces: { bpm: 130, div: 4, tonica: 67, escala: 'maior', mask: 'x.x...x...x.x...', prog: [0, 5, 3, 4], semente: 6, lp: 3800,
    lead: { tipo: 'triangle', vol: 0.26 }, baixo: 'R...5...R...5...', acorde: '..x...x...x...x.',
    bateria: { k: 'x.......x.......', s: '....x.......x...', c: 'x.x.x.x.x.x.x.x.' } },
  // montanha, estrada, fazenda: rock de estrada
  montanha: { bpm: 134, div: 4, tonica: 62, escala: 'mixolidia', mask: 'x..x..x.x.......', prog: [0, 6, 3, 0], semente: 17, lp: 3000,
    lead: { tipo: 'square', vol: 0.1, segura: 0.4 }, baixo: 'R.R.R.R.R.R.5.5.',
    bateria: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
  // favela / morro: funk carioca — o "tamborzao" no tambor grave e o chocalho correndo
  funk: { bpm: 130, div: 4, tonica: 63, escala: 'menor', mask: 'x..x..x...x.x...', prog: [0, 0, 5, 4], semente: 42, lp: 2800,
    lead: { tipo: 'square', vol: 0.09, vib: [5, 0.01] }, baixo: 'R..R..R.R..R..5.',
    bateria: { k: 'x..x...x..x.x...', t: '..x...x...x...x.', c: 'x.x.x.x.x.x.x.x.', s: '....x.......x...' } },
  // porto / cais: ska rapido — acorde no contratempo e baixo andando
  porto: { bpm: 150, div: 4, tonica: 65, escala: 'maior', mask: 'x...x.x.x...x...', prog: [0, 3, 4, 3], semente: 27, lp: 3600,
    lead: { tipo: 'triangle', vol: 0.24, segura: 0.3 }, baixo: 'R...5...O...5...', acorde: '..x...x...x...x.',
    bateria: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' } },
  // a Pista Maluca final: o mais rapido de todos
  maluca: { bpm: 158, div: 4, tonica: 67, escala: 'mixolidia', mask: 'x.xx.x.xx.x.x.xx', prog: [0, 5, 3, 4], semente: 77, lp: 3200,
    lead: { tipo: 'square', vol: 0.09 }, baixo: 'R.O.R.O.R.O.5.O.',
    bateria: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', T: '..............xx' } },
  // podio e fim de campeonato: festa
  podio: { bpm: 124, div: 2, tonica: 67, escala: 'maior', mask: '.xx.x.xx', prog: [0, 5, 3, 4], semente: 8, lp: 3500,
    lead: { tipo: 'square', vol: 0.1 }, baixo: 'R.O.R.O.', acorde: '..x...x.', bateria: { k: 'x.x.x.x.', h: '.x.x.x.x', s: '..x...x.' } },
};
export const NOMES_DOS_TEMAS = Object.keys(TEMAS);

/** Temas de corrida, na ordem usada quando a pista nao diz nada e o nome nao bate com nenhuma palavra. */
const POR_ORDEM = ['praia', 'funk', 'deserto', 'gelo', 'vulcao', 'selva', 'cidade', 'porto', 'montanha', 'maluca'];
/** Palavra no id/nome da pista -> tema. A primeira que casar vence ("Vulcão de Gelo" e vulcao). */
const PALAVRAS = [
  [/maluca|final|caos|loucura|radical/i, 'maluca'],
  [/vulc|lava|fogo|magma/i, 'vulcao'],
  [/espa[cç]o|lua|gal[aá]x|estrela|planeta|astro|c[oó]smic|foguete/i, 'espaco'],
  [/gelo|neve|polo|glacia|inverno|frio|pinguim/i, 'gelo'],
  [/desert|areia|duna|egito|sert[aã]o/i, 'deserto'],
  [/doce|bolo|chocolate|bala|candy|sorvete|confeit|brinquedo/i, 'doces'],
  [/selva|floresta|mata|amaz|jungle|jardim|parque|dino/i, 'selva'],
  [/favela|morro|comunidade|baile/i, 'funk'],
  [/porto|cais|navio|p[ií]er|doca/i, 'porto'],
  [/cidade|centro|neon|noite|t[uú]nel|metr[oô]|avenida|pr[eé]dio|urban/i, 'cidade'],
  [/montanha|serra|estrada|pico|trilha|fazenda|campo|rodovia|c[aâ]nion|canyon/i, 'montanha'],
  [/orla|praia|rio|copacabana|mar|ilha|onda|surf/i, 'praia'],
];

/** O tema musical de uma pista (Pista ou definicao). Ver o cabecalho. */
export function temaDaPista(p) {
  if (!p) return 'praia';
  // id de pista em texto ('neon', o que o js/audio.js recebe da tela de carga) cai na mesma busca por palavra da definicao
  if (typeof p === 'string') return TEMAS[p] ? p : temaDaPista({ id: p });
  const tema = p.tema || {};
  if (typeof tema.musica === 'string' && TEMAS[tema.musica]) return tema.musica;
  // o estilo e o tipo de terreno que a fase 3 pos no tema tambem contam (orla, morro, cais, canyon...)
  const texto = (p.id || '') + ' ' + (p.nome || '') + ' ' + (typeof tema.estilo === 'string' ? tema.estilo : '') + ' ' + (tema.terreno && typeof tema.terreno.tipo === 'string' ? tema.terreno.tipo : '');
  for (const [re, nome] of PALAVRAS) if (re.test(texto)) return nome;
  let n = Number.isFinite(p.ordem) && p.ordem > 0 ? p.ordem - 1 : 0;
  if (!n && p.id) for (const ch of String(p.id)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return POR_ORDEM[n % POR_ORDEM.length];
}

/** mulberry32 (o mesmo do Breno e do js/sorteio.js): a melodia gerada e sempre a mesma por tema. */
function gerador(s) {
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ehNotaDoAcorde = (d, c) => [0, 2, 4].includes(mod7(d - c));
const notaDoAcordePerto = (d, c) => { for (const k of [0, 1, -1, 2, -2]) if (ehNotaDoAcorde(d + k, c)) return d + k; return d; };

const compostas = {};
/** Compoe um tema: { sd (s por passo), passos: [[evento...]...] } com 8 compassos (frase A B A' C A B A' D). Fica em cache. */
export function compoe(nome) {
  if (compostas[nome]) return compostas[nome];
  const T = TEMAS[nome];
  const escala = ESCALAS[T.escala] || ESCALAS.maior;
  const porCompasso = T.mask.length, n = porCompasso * 8, sd = 60 / (T.bpm * (T.div || 2));
  const passos = Array.from({ length: n }, () => []);
  const acordeEm = (compasso) => T.prog[compasso % T.prog.length];
  const R = gerador(T.semente || 1);
  // cadencia: so a primeira metade do compasso (a frase respira antes da volta)
  const cad = [...T.mask].map((ch, s) => ((s <= porCompasso / 2 && ch === 'x') || s === 0 ? 'x' : '.')).join('');
  let anterior = 2;
  const gera = (compasso, mask, fim) => {
    const c = acordeEm(compasso), saida = [];
    [...mask].forEach((ch, s) => {
      if (ch !== 'x') return;
      let d = saida.length ? anterior + [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(R() * 8)] : notaDoAcordePerto(anterior + [0, 2, -2][Math.floor(R() * 3)], c);
      if (s % (porCompasso / 2) === 0) d = notaDoAcordePerto(d, c);
      d = Math.max(-2, Math.min(9, d));
      saida.push([s, d]);
      anterior = d;
    });
    if (fim != null && saida.length) saida[saida.length - 1][1] = notaDoAcordePerto(fim, c);
    return saida;
  };
  const A = gera(0, T.mask), B = gera(1, T.mask), desloc = acordeEm(2) - acordeEm(0);
  const A2 = A.map(([s, d]) => [s, d + desloc > 9 ? d + desloc - 7 : d + desloc]);
  const C = gera(3, cad, 4), D = gera(3, cad, 0);
  const melodia = [];
  [A, B, A2, C, A, B, A2, D].forEach((comp, ci) => comp.forEach(([s, d]) => melodia.push([ci * porCompasso + s, d])));
  melodia.forEach(([s, d], i) => {
    const prox = melodia[i + 1] ? melodia[i + 1][0] : melodia[0][0] + n;
    passos[s].push({ i: 'lead', m: grau(T.tonica, d, escala), d: Math.min(prox - s, porCompasso / 2) * sd * 0.85 });
  });
  const intervalo = { R: 0, 5: 4, O: 7, 3: 2 };
  const baixoEm = [...T.baixo].map((ch, s) => (ch !== '.' ? s : -1)).filter((s) => s >= 0);
  for (let comp = 0; comp < 8; comp++) {
    const c = acordeEm(comp), b0 = comp * porCompasso;
    baixoEm.forEach((s, j) => {
      const prox = (baixoEm[j + 1] ?? baixoEm[0] + porCompasso) - s;
      passos[b0 + s].push({ i: 'baixo', m: grau(T.tonica - 24, c + intervalo[T.baixo[s]], escala), d: prox * sd * 0.9 });
    });
    if (T.acorde) [...T.acorde].forEach((ch, s) => ch === 'x' && passos[b0 + s].push({ i: 'acorde', m: [c, c + 2, c + 4].map((d) => grau(T.tonica - 12, d, escala)), d: sd * 1.6 }));
    if (T.arpejo) [...T.arpejo].forEach((ch, s) => ch === 'x' && passos[b0 + s].push({ i: 'arpejo', m: grau(T.tonica, c + [0, 2, 4, 7][(s / 2) % 4 | 0], escala) }));
    for (const k in T.bateria) [...T.bateria[k]].forEach((ch, s) => ch !== '.' && passos[b0 + s].push({ i: k, v: ch === 'X' ? 1.4 : 1 }));
  }
  // viradinha no fim da frase (o "tum-tum-tum" que avisa que a musica vai voltar ao comeco)
  const virada = T.bateria.s ? 's' : T.bateria.t ? 't' : T.bateria.b ? 'b' : T.bateria.T ? 'T' : null;
  if (virada) for (let s = porCompasso / 2; s < porCompasso; s += (T.div || 2) >= 4 ? 2 : 1) passos[7 * porCompasso + s].push({ i: virada, v: 0.6 + (s / porCompasso) * 0.6 });
  return (compostas[nome] = { sd, passos });
}

/** Toca um evento do sequenciador no sintetizador `S` (o mesmo de js/audio.js). */
export function tocaEvento(S, e, T) {
  const v = e.v ?? 1;
  switch (e.i) {
    case 'lead': {
      const L = T.lead;
      S.nota(0, hz(e.m), e.d, { tipo: L.tipo, vol: L.vol, segura: L.segura ?? 0.25, vib: L.vib, ataque: 0.01 });
      if (L.sino) S.nota(0, hz(e.m) * 4, e.d * 0.3, { vol: L.vol * 0.15 });
      break;
    }
    case 'baixo': S.nota(0, hz(e.m), e.d, { tipo: 'triangle', vol: 0.45, segura: 0.5, ataque: 0.01 }); S.nota(0, hz(e.m) * 2, e.d * 0.7, { vol: 0.1, ataque: 0.01 }); break;
    case 'acorde': e.m.forEach((m) => S.nota(0, hz(m), e.d, { tipo: 'triangle', vol: 0.08, segura: 0.2, ataque: 0.01 })); break;
    case 'arpejo': S.nota(0, hz(e.m) * 2, 0.3, { vol: 0.07 }); S.nota(0, hz(e.m) * 6, 0.1, { vol: 0.015 }); break;
    case 'k': S.nota(0, 150, 0.16, { f2: 50, vol: 0.7 * v }); break;
    case 's': S.ruido(0, 0.12, { f: 1800, q: 0.8, vol: 0.26 * v }); S.nota(0, 220, 0.07, { tipo: 'triangle', f2: 170, vol: 0.13 * v }); break;
    case 'h': S.ruido(0, 0.03, { tipo: 'highpass', f: 7000, vol: 0.1 * v }); break;
    case 'c': S.ruido(0, 0.05, { tipo: 'highpass', f: 5000, vol: 0.06 * v, ataque: 0.015 }); break;
    case 'b': S.nota(0, 440, 0.1, { f2: 400, vol: 0.28 * v }); break;
    case 'B': S.nota(0, 310, 0.14, { f2: 280, vol: 0.3 * v }); break;
    case 't': S.nota(0, 200, 0.18, { f2: 140, vol: 0.38 * v }); break;
    case 'T': S.nota(0, 120, 0.3, { f2: 90, vol: 0.5 * v }); S.ruido(0, 0.1, { tipo: 'lowpass', f: 300, vol: 0.2 * v }); break;
    default: break;
  }
}

/** Um tocador: um tema com o seu ganho (o crossfade mexe so nele) e o filtro do tema. `ate` = Infinity enquanto e o atual. */
export function novoTocador(ctx, destino, nome, t, fade, alvo = 0.7) {
  const T = TEMAS[nome], g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = T.lp || 5000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(alvo, t + fade);
  g.connect(f);
  f.connect(destino);
  return { nome, T, g, f, musica: compoe(nome), passo: 0, prox: t + 0.05, ate: Infinity, alvo };
}

/** Agenda as notas do tocador ate o instante `ate` (tempo do AudioContext). `criaS(ctx, saida, t)` devolve o sintetizador. */
export function agenda(ctx, tocador, ate, criaS) {
  const { sd, passos } = tocador.musica;
  // aba voltou / timer atrasou: nao despeja de uma vez as notas que ja deviam ter tocado (o Breno faz igual)
  if (tocador.prox < ctx.currentTime - 0.05) tocador.prox = ctx.currentTime + 0.02;
  let n = 0;
  while (tocador.prox < ate && n < 64) {
    const lista = passos[tocador.passo];
    if (lista.length) {
      const t = tocador.prox + (tocador.passo % 2 ? (tocador.T.balanco || 0) * sd : 0);
      const S = criaS(ctx, tocador.g, t);
      for (const e of lista) tocaEvento(S, e, tocador.T);
    }
    tocador.prox += sd;
    tocador.passo = (tocador.passo + 1) % passos.length;
    n++;
  }
}
