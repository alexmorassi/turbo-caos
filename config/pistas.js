// AS 10 PISTAS DO CAMPEONATO (fase 3), em ordem — a ordem e a sequencia do campeonato e a base da dificuldade (docs/CONTRATOS.md
// secao 4). Cada uma e desenhada por pedacos em js/pistas/<id>.js (js/pistas/construtor.js fecha o circuito) e vestida pelo tema dela
// (js/visual_pista.js, js/cenario.js, js/ceu.js). A complexidade cresce com a ordem: a 1 e larga e com muro em toda a volta; o primeiro
// loop e na 5; o viaduto (oito) na 7; a 10 junta loop duplo, saca-rolha, dois paredoes e a mega-rampa.
// A pista de teste (js/pistas/teste.js) fica FORA daqui: e das suites (o jogo a acha por id em js/jogo.js).
import orla from '../js/pistas/orla.js';
import favela from '../js/pistas/favela.js';
import deserto from '../js/pistas/deserto.js';
import gelo from '../js/pistas/gelo.js';
import vulcao from '../js/pistas/vulcao.js';
import selva from '../js/pistas/selva.js';
import neon from '../js/pistas/neon.js';
import porto from '../js/pistas/porto.js';
import canyon from '../js/pistas/canyon.js';
import maluca from '../js/pistas/maluca.js';

export const PISTAS = [orla, favela, deserto, gelo, vulcao, selva, neon, porto, canyon, maluca];

export function pistaPorId(id) { return PISTAS.find((p) => p.id === id) || null; }
