// SUITE DO TURBO E DAS CAPSULAS (fase 4): js/turbo.js e js/capsulas.js. A barra (capacidade pelo atributo, gasta so segurando, sem carga
// nao liga, EMP/gelo/rodopio impedem, eventos), o efeito na fisica (vMax sobe ~30 % no oval de retas de 900 m), as capsulas (normal soma,
// dourada enche, reaparece no tempo, encolhido volta ao normal, Ima puxa, proximas() no formato da IA) e ONDE elas ficam em TODAS as
// pistas (fileiras na principal, mais nos atalhos, linha na beira sem muro, terra e pouso de salto, 1 a 3 douradas, nunca em loop/vao/
// crista/boca). Por fim a IA (a de verdade, fase 5) pegando capsula numa corrida.
// Os rivais nao usados ficam "fora" (chegou = true: nao pegam capsula, nao batem) e os usados andam pelo piloto da suite.
import { suite, ok, perto, mede, quadros, segura, solta, apagaProgresso, corridaDeTeste, largada, simulaAte } from './harness.js';
import { FISICA } from '../config/fisica.js';
import { TURBO, CAPSULAS } from '../config/turbo.js';
import { PODERES } from '../config/poderes.js';
import { CARROS } from '../config/carros.js';
import { PISTAS } from '../config/pistas.js';
import { Pista, MARCA } from '../js/pista.js';
import { capacidadeDoTurbo } from '../js/turbo.js';
import { geraCapsulas } from '../js/capsulas.js';
import { on } from '../js/eventos.js';
import PISTA_TESTE from '../js/pistas/teste.js';

const OVAL = {
  id: 'oval_turbo', nome: 'Oval do turbo', ordem: 0, largura: 14,
  pontos: [[0, 0, 0], [0, 0, 300], [0, 0, 600], [0, 0, 900], [60, 0, 1000], [160, 0, 1000], [220, 0, 900], [220, 0, 600], [220, 0, 300], [220, 0, 0], [160, 0, -100], [60, 0, -100]],
  trechos: [], tema: PISTA_TESTE.tema,
};
const RIVAIS = ['dourado', 'lagartixa', 'picole', 'kombosa', 'jatinho'];

const ev = { liga: [], desliga: [], vazio: [], pega: [] };
const zera = () => { for (const k of Object.keys(ev)) ev[k] = []; };

function lateral(x, alvoD) {
  const sup = x.corrida.pista.sup(x.sup), v = Math.max(2, Math.abs(x.vf));
  const kh = sup.khEm(x.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (x.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (x.d - alvoD)));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - x.psi)) / (v / raio)));
}
/** O jogador pelo controle de verdade (entrada simulada), dirigindo na faixa d. */
function dirige(j, n, { acel = 1, turbo = false, d = 0, cada = null } = {}) {
  for (let k = 0; k < n; k++) {
    segura('acel', acel); segura('turbo', turbo ? 1 : 0); segura('direcao', lateral(j, d));
    quadros(1);
    if (cada) cada(k);
  }
}

async function nova(G, { def = OVAL, carro = 'vulcao', semente = 13 } = {}) {
  G.sorteio.semente(semente);
  const c = await corridaDeTeste({ def, pista: def ? undefined : 'teste', carro, corredores: 6, voltas: 9, rivais: RIVAIS });
  largada();
  c.ia.passo = () => { for (const x of c.carros) if (x !== c.jogador) { x.controle.acel = 0; x.controle.freio = 1; x.controle.turbo = false; x.controle.poder = false; x.controle.direcao = 0; } };
  c.dificuldade.passo = () => {};
  c.carros.forEach((x, k) => { if (x !== c.jogador) { x.chegou = true; x.fantasma = 1e9; x.colocaNaPista(0, 700 + k * 20, 0, 0, 0); } });
  zera();
  return c;
}

suite('turbo', async (G) => {
  apagaProgresso();
  on('turbo:liga', (e) => ev.liga.push(e)); on('turbo:desliga', (e) => ev.desliga.push(e)); on('turbo:vazio', (e) => ev.vazio.push(e));
  on('capsula:pega', (e) => ev.pega.push(e));
  let nans = 0;

  // =============================================================================================== capacidade por atributo
  {
    const caps = CARROS.map((x) => capacidadeDoTurbo(x));
    ok(CARROS.every((x) => capacidadeDoTurbo(x) === TURBO.CAPACIDADE[x.atributos.turbo - 1]), 'capacidade = tabela pelo atributo turbo (1..5)');
    ok(Math.min(...caps) >= 2.5 && Math.max(...caps) <= 5.5 && TURBO.CAPACIDADE.every((v, i) => i === 0 || v > TURBO.CAPACIDADE[i - 1]), `capacidades de ${Math.min(...caps)} a ${Math.max(...caps)} s, crescendo com o atributo`);
    const c = await nova(G);
    ok(c.carros.every((x) => x.turbo && x.turbo.capacidade === capacidadeDoTurbo(x.cfg) && x.turbo.carga === TURBO.CARGA_INICIAL && x.turbo.ativo === false), `cada carro larga com ${Math.round(TURBO.CARGA_INICIAL * 100)}% e a sua capacidade`);
    const voador = CARROS.find((x) => x.id === 'voador'), faisca = CARROS.find((x) => x.id === 'faisca');
    ok(capacidadeDoTurbo(voador) > capacidadeDoTurbo(faisca), 'Voador (turbo 5) dura mais que Faísca (turbo 2)');
  }

  // =============================================================================================== gasta so segurando; vazio nao liga; eventos
  {
    const c = await nova(G);
    const j = c.jogador, cap = j.turbo.capacidade;
    for (const x of c.capsulas.lista) { x.ativa = false; x.espera = 1e9; }   // sem capsula no caminho: so a barra
    j.colocaNaPista(0, 20, 0, 0, 20);
    j.turbo.carga = 0.8;
    dirige(j, 60, { turbo: true });
    perto(j.turbo.carga, 0.8 - 1 / cap, 0.02, `segurando 1 s gasta 1/${cap} da barra`);
    ok(ev.liga.length === 1 && ev.liga[0].carro === j && j.turbo.ativo, 'turbo:liga ao ligar (e ativo)');
    ok(Math.abs(j.mod.velMax - TURBO.VEL_MAX) < 1e-9 && Math.abs(j.mod.empurrao - TURBO.EMPURRAO) < 1e-9, `ligado: mod.velMax x${TURBO.VEL_MAX} e mod.empurrao +${TURBO.EMPURRAO}`);
    const c0 = j.turbo.carga;
    dirige(j, 60, { turbo: false });
    ok(j.turbo.carga === c0 && !j.turbo.ativo && ev.desliga.length === 1, 'solto: nao gasta nada e turbo:desliga');
    ok(j.mod.velMax === 1 && j.mod.empurrao === 0, 'desligado: mod de volta ao normal');
    // ate esvaziar: turbo:vazio + turbo:desliga
    zera();
    dirige(j, Math.round(cap * 60 * c0) + 20, { turbo: true });
    ok(j.turbo.carga === 0 && !j.turbo.ativo && ev.vazio.length === 1 && ev.desliga.length === 1, 'a barra acabou ligada: turbo:vazio e desliga');
    // vazio: apertar de novo nao liga e avisa uma vez por aperto
    zera();
    dirige(j, 10, { turbo: false }); dirige(j, 30, { turbo: true });
    ok(!j.turbo.ativo && ev.liga.length === 0 && ev.vazio.length === 1, 'sem carga: nao liga (turbo:vazio no aperto, uma vez)');
    ok(j.mod.velMax === 1, 'sem carga o mod nao muda');
    // EMP (mod.semTurbo) impede; congelado e rodando tambem
    j.turbo.carga = 1; zera();
    c.poderes.mods.emp.aplicaEm(j);
    dirige(j, 60, { turbo: true });
    ok(!j.turbo.ativo && j.turbo.carga === 1 && j.mod.semTurbo === true, 'EMP (mod.semTurbo): segurando nao liga nem gasta');
    dirige(j, Math.round(PODERES.emp.duracao * 60), { turbo: true });
    ok(j.turbo.ativo && j.turbo.carga < 1, `passado o EMP (${PODERES.emp.duracao} s) liga de novo`);
    dirige(j, 5, { turbo: false });
    j.congela(1); dirige(j, 20, { turbo: true });
    ok(!j.turbo.ativo, 'congelado nao liga (o empurrao do turbo nao pode tirar o carro do gelo)');
    j.efeitos.gelo = 0; dirige(j, 5, { turbo: false });
    j.rodopia(1); dirige(j, 20, { turbo: true });
    ok(!j.turbo.ativo, 'rodando nao liga');
    j.efeitos.rodopio = 0;
    nans += j.nans;
  }

  // =============================================================================================== vMax sobe com o turbo (oval)
  {
    const c = await nova(G);
    const j = c.jogador;
    j.colocaNaPista(0, 5, 0, 0, 0);
    dirige(j, 60 * 11);
    const vSem = j.vf;
    j.turbo.carga = 1;
    let vCom = 0;
    dirige(j, 60 * 4, { turbo: true, cada: () => { j.turbo.carga = 1; vCom = Math.max(vCom, j.vf); } });
    mede('vMax sem turbo (m/s)', vSem);
    mede('vMax com turbo (m/s)', vCom);
    perto(vSem, j.p.vMax, j.p.vMax * 0.02, 'sem turbo para na vMax do carro');
    ok(vCom > vSem * (TURBO.VEL_MAX - 0.06) && vCom <= j.p.vMax * TURBO.VEL_MAX + 0.6, `com turbo passa a ~${TURBO.VEL_MAX}x (${(vCom / vSem).toFixed(2)}x)`);
    ok(c.camera.fovAtual > 62 + 9 + 5, `a camera abre o FOV no turbo (${c.camera.fovAtual.toFixed(0)} graus)`);
    G.quadro(1 / 60);
    ok(c.cena.getObjectByName('efeito:chamas').visible, 'chamas no escapamento com o turbo ligado');
    dirige(j, 60 * 3, { turbo: false });
    ok(j.vf < vCom - 3, 'desligou: volta para a vMax sem tranco');
    G.quadro(1 / 60);
    nans += j.nans;
  }

  // =============================================================================================== capsulas: soma, dourada enche, reaparece
  {
    const c = await nova(G, { def: null });
    const j = c.jogador, C = c.capsulas;
    const normal = C.lista.find((x) => x.sup === 0 && !x.dourada && x.origem === 'fileira' && Math.abs(x.d) < 0.5);
    j.turbo.carga = 0.2;
    j.colocaNaPista(0, normal.s - 12, normal.d, 0, 15);
    dirige(j, 60, { acel: 0.3, d: normal.d });
    const pegou = ev.pega.find((e) => e.carro === j);
    ok(!!pegou && pegou.dourada === false, 'passando pela capsula: capsula:pega { carro, dourada: false }');
    perto(j.turbo.carga, 0.2 + CAPSULAS.RECARGA, 0.005, `capsula soma ${Math.round(CAPSULAS.RECARGA * 100)}% da barra`);
    ok(!normal.ativa, 'a capsula pega some');
    ok(!C.proximas(j, 2000).includes(normal), 'e sai de proximas()');
    // reaparece no tempo
    quadros(Math.round((CAPSULAS.REAPARECE - 1 - 0.2) * 60));
    ok(!normal.ativa, 'ainda nao reapareceu');
    quadros(Math.round(1.5 * 60));
    ok(normal.ativa, `reapareceu ~${CAPSULAS.REAPARECE} s depois`);
    G.quadro(1 / 60);
    ok(normal.cresce < 1, 'e nasce crescendo (visual)');
    // dourada enche tudo e demora mais para voltar
    const dour = C.lista.find((x) => x.dourada);
    ok(!!dour, 'a pista de teste tem dourada (gerada sozinha: a definicao nao tem)');
    j.turbo.carga = 0.05; zera();
    j.colocaNaPista(dour.sup, dour.s - 12, dour.d, 0, 15);
    dirige(j, 60, { acel: 0.3, d: dour.d });
    ok(ev.pega.some((e) => e.carro === j && e.dourada) && j.turbo.carga === 1, 'dourada: capsula:pega { dourada: true } e a barra ENCHE');
    quadros(Math.round((CAPSULAS.REAPARECE + 2) * 60));
    ok(!dour.ativa, `a dourada demora mais (${CAPSULAS.REAPARECE_DOURADA} s)`);
    quadros(Math.round((CAPSULAS.REAPARECE_DOURADA - CAPSULAS.REAPARECE - 1) * 60));
    ok(dour.ativa, 'e volta');
    // proximas(): formato da IA, a frente, em ordem, ate o alcance
    j.colocaNaPista(0, 30, 0, 0, 0); quadros(1);
    const pr = C.proximas(j, 300);
    ok(pr.length > 0 && pr.every((x) => typeof x.sup === 'number' && typeof x.s === 'number' && typeof x.d === 'number' && typeof x.dourada === 'boolean' && x.pos && x.pos.isVector3 && x.ativa), 'proximas(): [{ sup, s, d, dourada, pos }] so as ativas');
    let emOrdem = true;
    for (let k = 1; k < pr.length; k++) if (pr[k]._frente < pr[k - 1]._frente) emOrdem = false;
    ok(emOrdem && pr.every((x) => x._frente >= 0 && x._frente <= 300), 'a frente do carro, da mais perto para a mais longe, ate o alcance');
    // encolhido que pega capsula volta ao normal
    const enc = c.poderes.mods.encolhedor;
    enc.aplicaEm(j);
    const prox = C.proximas(j, 400).find((x) => x.sup === 0 && x.ativa && Math.abs(x.d) < 0.5 && x._frente > 20);
    j.colocaNaPista(0, prox.s - 10, prox.d, 0, 14);
    quadros(2);
    ok(j.mod.escala < 0.6, 'encolhido');
    dirige(j, 60, { acel: 0.3, d: prox.d });
    ok(j.mod.escala === 1 && enc.restaEncolhido(j) === 0, 'encolhido que pega capsula VOLTA AO TAMANHO');
    // Ima: atrai puxa as capsulas perto para o carro, que pega
    j.turbo.carga = 0; zera();
    const alvoIma = C.proximas(j, 400).filter((x) => x.sup === 0 && x._frente > 25 && x._frente < 60);
    const nPuxa = C.atrai(j.pos, 60, j);
    ok(nPuxa >= alvoIma.length && nPuxa > 0, `atrai(pos, raio, carro): ${nPuxa} capsulas voando para o carro`);
    quadros(90);
    ok(ev.pega.filter((e) => e.carro === j).length >= Math.min(2, nPuxa) && j.turbo.carga > 0.5, `as puxadas chegam e sao pegas (${ev.pega.length}, turbo ${Math.round(j.turbo.carga * 100)}%)`);
    // voando por cima nao pega (a capsula fica onde o carro alcanca)
    nans += j.nans;
  }

  // =============================================================================================== onde ficam: todas as pistas
  {
    const defs = [PISTA_TESTE, ...PISTAS];
    const PROIBIDO = MARCA.MAGNETICO | MARCA.VAO | MARCA.LANCA;
    let ruins = 0, foraDaPista = 0, semDourada = 0, muitas = 0, atalhoSem = 0, atalhoMenos = 0, riscoSem = [], pousoSem = [], terraSem = [];
    for (const def of defs) {
      const p = new Pista(def), L = geraCapsulas(p);
      const dour = L.filter((x) => x.dourada).length;
      if (dour < 1) semDourada++;
      if (dour > CAPSULAS.MAX_DOURADAS) muitas++;
      for (const x of L) {
        const S = p.sup(x.sup);
        for (let k = -CAPSULAS.FOLGA_FIGURA; k <= CAPSULAS.FOLGA_FIGURA; k++) if (S.marcasEm(x.s + k) & PROIBIDO) { ruins++; break; }
        if (Math.abs(x.d) > S.larguraEm(x.s) * 0.5 - 1.15 + 1e-6) foraDaPista++;
      }
      // atalhos: tem e tem MAIS por metro que a principal
      const dens0 = L.filter((x) => x.sup === 0).length / p.principal.comprimento;
      for (const a of p.atalhos) {
        const n = L.filter((x) => x.sup === a.sup.id).length;
        if (n < 2) atalhoSem++;
        if (n / a.sup.comprimento <= dens0) atalhoMenos++;
      }
      // risco na principal: beira sem muro, terra, pouso de salto
      const P = p.principal, runs = (teste, min) => { const out = []; let i0 = -1; for (let i = 0; i <= P.n; i++) { const v = i < P.n && teste(P.marcas[i]); if (v && i0 < 0) i0 = i; if (!v && i0 >= 0) { if ((i - 1 - i0) * P.ds >= min) out.push([i0 * P.ds, (i - 1) * P.ds]); i0 = -1; } } return out; };
      const temEm = (a, b) => L.some((x) => x.sup === 0 && x.s >= a - 1 && x.s <= b + 1);
      for (const [a, b] of runs((m) => (!(m & MARCA.MURO_DIR) || !(m & MARCA.MURO_ESQ)) && !(m & (MARCA.ABRE_DIR | MARCA.ABRE_ESQ | PROIBIDO)), 30)) if (!temEm(a, b)) riscoSem.push(def.id + '@' + a.toFixed(0));
      for (const [a, b] of runs((m) => (m & MARCA.TERRA) !== 0, 30)) if (!temEm(a, b)) terraSem.push(def.id + '@' + a.toFixed(0));
      for (const [, b] of runs((m) => (m & MARCA.VAO) !== 0, 2)) if (!L.some((x) => x.sup === 0 && x.s > b && x.s < b + CAPSULAS.POUSO_DEPOIS + CAPSULAS.ANDA_ATE + 2)) pousoSem.push(def.id + '@' + b.toFixed(0));
      mede(`${def.id}: capsulas (douradas) / atalhos`, `${L.length} (${dour}) / ${p.atalhos.map((a) => L.filter((x) => x.sup === a.sup.id).length).join('+') || '-'}`);
    }
    ok(ruins === 0, 'nenhuma capsula dentro (ou a menos de 6 m) de loop, vao ou crista — so onde o carro alcanca');
    ok(foraDaPista === 0, 'todas dentro da faixa que o carro alcanca');
    ok(semDourada === 0 && muitas === 0, `1 a ${CAPSULAS.MAX_DOURADAS} douradas por volta em todas as pistas`);
    ok(atalhoSem === 0, 'todo atalho tem capsulas');
    ok(atalhoMenos === 0, 'os atalhos tem MAIS capsulas por metro que a principal');
    ok(riscoSem.length === 0, 'todo trecho sem muro (30 m ou mais) tem capsula' + (riscoSem.length ? ': falta ' + riscoSem.join(', ') : ''));
    ok(terraSem.length === 0, 'todo trecho de terra tem capsula' + (terraSem.length ? ': falta ' + terraSem.join(', ') : ''));
    ok(pousoSem.length === 0, 'todo salto tem capsula logo depois do pouso' + (pousoSem.length ? ': falta ' + pousoSem.join(', ') : ''));
  }

  // =============================================================================================== a IA (fase 5) pega capsula
  {
    G.sorteio.semente(21);
    const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 3, auto: true, rivais: RIVAIS });
    largada();
    zera();
    simulaAte(() => c.t > 30, 40, 240);
    const rivais = ev.pega.filter((e) => !e.carro.ehJogador).length, quem = new Set(ev.pega.filter((e) => !e.carro.ehJogador).map((e) => e.carro.indice)).size;
    mede('capsulas pegas pela IA em 30 s', rivais);
    ok(rivais >= 5 && quem >= 3, `a IA pega capsula (${rivais} pegas por ${quem} rivais em 30 s)`);
    ok(c.carros.some((x) => !x.ehJogador && x.turbo.carga !== TURBO.CARGA_INICIAL), 'e a barra dela muda (gasta e recarrega)');
    nans += c.carros.reduce((a, x) => a + x.nans, 0);
    G.flags.auto = false;
  }

  ok(nans === 0, 'nenhum NaN');
  solta('turbo'); solta('acel'); solta('direcao');
  G.jogo.encerraCorrida();
});
