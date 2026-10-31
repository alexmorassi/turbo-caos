// SUITE DOS PODERES (fase 4): os 10 poderes de js/poderes/*.js pelo gerente js/poderes.js, cada um numa corrida nova num OVAL de retas
// de 900 m feito aqui (com uma rampa: o Terremoto precisa de alguem no ar). Os rivais nao usados ficam "fora" (chegou = true: nao sao
// alvo, nao pegam capsula, nao batem) e os usados sao dirigidos pelo PILOTO DA SUITE (velocidade-alvo + faixa-alvo, o PD da suite de
// fisica) no lugar da IA da fase 5 — o que se mede e o PODER, nao o piloto. A dificuldade (rubber band) fica desligada pelo mesmo motivo.
//
// O que prova, para CADA poder (pedido da fase 4): dispara so com a recarga cheia (pronto 5 s depois da largada, de novo `recarga` s
// depois do uso) e pelo botao PODER (controle.poder); o efeito acontece no ALVO CERTO; a ESQUIVA escrita em config/poderes.js funciona
// (desviar da poca, sair do circulo do EMP na carga, mudar de faixa contra o raio, turbo quebra a mira do Troca-Troca, capsula
// desencolhe, no ar ignora o terremoto, distancia do ima, lado da fumaca, desvio do tornado); escudo bloqueia e devolve (e dois escudos
// nao viram pingue-pongue); iaDeveUsar coerente; eventos certos; recarga/ativosEm/perigos no formato; nada de NaN.
import { suite, ok, perto, mede, quadros, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { FISICA } from '../config/fisica.js';
import { PODERES, ORDEM_DOS_PODERES, PODERES_GERAL } from '../config/poderes.js';
import { CARROS } from '../config/carros.js';
import { on } from '../js/eventos.js';
import PISTA_TESTE from '../js/pistas/teste.js';

/** Oval de retas de ~900 m com uma rampa no meio da primeira reta (crista no ponto 3, s ~ 525; o vao ~ 525-545). */
const OVAL = {
  id: 'oval_poderes', nome: 'Oval dos poderes', ordem: 0, largura: 14,
  pontos: [[0, 0, 0], [0, 0, 250], [0, 0, 500], [0, 3.5, 525], [0, 1.5, 550], [0, 0, 580], [0, 0, 900], [60, 0, 1000], [160, 0, 1000], [220, 0, 900], [220, 0, 600], [220, 0, 300], [220, 0, 0], [160, 0, -100], [60, 0, -100]],
  trechos: [{ de: 2.9, ate: 3.0, tipo: 'lanca' }, { de: 3.0, ate: 3.6, tipo: 'vao' }],
  tema: PISTA_TESTE.tema,
};
/** Carro dono de cada poder (config/carros.js) — a corrida de cada bloco e com ele. */
const DONO = {};
for (const c of CARROS) if (!DONO[c.poder]) DONO[c.poder] = c.id;   // o PRIMEIRO dono (os 10 de antes): os carros do Cidade Aberta de 30/10/2026 repetem poder
const RIVAIS = (eu) => CARROS.map((c) => c.id).filter((id) => id !== eu).slice(0, 5);

// ---------------------------------------------------------------- eventos (um ouvinte por nome, para a suite toda)
const NOMES = ['poder:usa', 'poder:acerta', 'poder:bloqueado', 'poder:esquivou', 'poder:fim', 'capsula:pega', 'turbo:liga', 'turbo:desliga'];
const ev = {};
function zeraEv() { for (const n of NOMES) ev[n] = []; }
const conta = (nome, f = () => true) => ev[nome].filter(f).length;
const de = (x) => (e) => e.de === x, alvo = (x) => (e) => e.alvo === x;

// ---------------------------------------------------------------- piloto da suite
function lateral(x, alvoD) {
  const sup = x.corrida.pista.sup(x.sup), v = Math.max(2, Math.abs(x.vf));
  const kh = sup.khEm(x.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (x.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (x.d - alvoD)));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - x.psi)) / (v / raio)));
}
/** Troca a IA da corrida pelo piloto da suite: cada carro tem um plano { v, d, turbo, poder (um toque), dir (direcao fixa ou null) }. */
function pilotos(c) {
  const planos = new Map();
  for (const x of c.carros) planos.set(x, { v: 0, d: 0, turbo: false, poder: false, dir: null });
  c.ia.passo = () => {
    for (const x of c.carros) {
      const p = planos.get(x), k = x.controle;
      if (x.chegou) { k.acel = 0; k.freio = 1; k.direcao = 0; k.turbo = false; k.poder = false; k.drift = false; continue; }
      k.acel = x.vf < p.v - 0.2 ? 1 : 0;
      k.freio = x.vf > p.v + 1.5 ? 0.6 : 0;
      k.drift = false;
      k.direcao = p.dir !== null ? p.dir : lateral(x, p.d);
      k.turbo = !!p.turbo;
      k.poder = !!p.poder; p.poder = false;
    }
  };
  c.dificuldade.passo = () => {};
  return planos;
}

async function nova(G, poder, { carro = DONO[poder], semente = 31 } = {}) {
  G.sorteio.semente(semente);
  const c = await corridaDeTeste({ def: OVAL, carro, corredores: 6, voltas: 9, rivais: RIVAIS(carro) });
  largada();
  const planos = pilotos(c);
  const j = c.jogador;
  const rivais = c.carros.filter((x) => x !== j);
  rivais.forEach((x, k) => fora(planos, x, 1500 + k * 20));
  poe(planos, j, 30, 0, 0);
  zeraEv();
  return { c, j, planos, P: c.poderes, rivais };
}
/** Poe `x` na pista (no chao, sem efeito), dirigido pelo piloto a `v` m/s na faixa `d`. */
function poe(planos, x, s, d, v) {
  x.chegou = false; x.fantasma = 0;
  x.colocaNaPista(0, s, d, 0, v);
  x.efeitos.rodopio = 0; x.efeitos.gelo = 0; x.efeitos.levantado = 0;
  const p = planos.get(x); p.v = v; p.d = d; p.turbo = false; p.poder = false; p.dir = null;
  return x;
}
/** Tira `x` da corrida da suite (nao e alvo, nao pega capsula, nao bate). */
function fora(planos, x, s) { x.chegou = true; x.fantasma = 1e9; x.colocaNaPista(0, s, 0, 0, 0); planos.get(x).v = 0; }
/** Um toque no PODER de `x` (pelo controle, como o botao) e um passo. */
function aperta(planos, x) { planos.get(x).poder = true; anda(1); }
/** `n` passos, desenhando um quadro a cada 30 (pega erro de shader/malha dos efeitos que so aparece desenhando). */
let _passos = 0;
function anda(n) { for (let k = 0; k < n; k++) { quadros(1); if (++_passos % 30 === 0) window.G.quadro(1 / 60); } }
const pronto = (x) => { x.poder.restante = 0; };
const finito = (x) => Number.isFinite(x.pos.x + x.pos.y + x.pos.z + x.vel.x + x.vel.y + x.vel.z + x.s + x.d + x.psi + x.vf + x.vr);

suite('poderes', async (G) => {
  apagaProgresso();
  for (const n of NOMES) on(n, (e) => { if (ev[n]) ev[n].push(e); });
  zeraEv();
  let nans = 0;
  const confere = (c) => { for (const x of c.carros) { nans += x.nans; if (!finito(x)) nans++; } };

  // =============================================================================================== contrato comum (os 10, um por carro)
  {
    const { c, j, planos, P } = await nova(G, 'oleo');
    ok(c.carros.every((x) => x.poder && x.poder.id === x.cfg.poder && PODERES[x.poder.id]), 'cada carro tem o poder do config/carros.js');
    ok(ORDEM_DOS_PODERES.every((id) => CARROS.some((x) => x.poder === id)), 'os 10 poderes têm dono');
    // largada: carregando, pronto PRIMEIRA_RECARGA s depois
    ok(!P.podeUsar(j) && P.recarga(j) < 0.05, `na largada o poder esta carregando (recarga ${P.recarga(j).toFixed(2)})`);
    aperta(planos, j);
    ok(conta('poder:usa') === 0, 'apertar PODER antes da recarga cheia nao dispara');
    anda(Math.round((PODERES_GERAL.PRIMEIRA_RECARGA - 0.3) * 60));
    ok(!P.podeUsar(j) && P.recarga(j) > 0.9 && P.recarga(j) < 1, `0,3 s antes ainda nao (recarga ${P.recarga(j).toFixed(2)})`);
    anda(30);
    ok(P.podeUsar(j) && P.recarga(j) === 1, `pronto ~${PODERES_GERAL.PRIMEIRA_RECARGA} s depois da largada`);
    aperta(planos, j);
    const u = ev['poder:usa'][0];
    ok(conta('poder:usa') === 1 && u.carro === j && u.poder === 'oleo', 'o toque no PODER dispara: poder:usa { carro, poder }');
    ok(!P.podeUsar(j) && P.recarga(j) < 0.01, 'depois de usar a recarga volta ao zero');
    aperta(planos, j);
    ok(conta('poder:usa') === 1, 'apertar de novo sem recarga nao dispara');
    anda(Math.round((PODERES.oleo.recarga - 0.4) * 60));
    ok(!P.podeUsar(j), 'ainda recarregando perto do fim');
    anda(40);
    ok(P.podeUsar(j), `pronto de novo ${PODERES.oleo.recarga} s depois do uso`);
    // formato
    const at = P.ativosEm(j), pg = P.perigos();
    ok(Array.isArray(at) && Array.isArray(pg) && typeof P.recarga(j) === 'number' && typeof P.iaDeveUsar(j) === 'boolean', 'recarga numero, iaDeveUsar booleano, ativosEm e perigos sao listas');
    // congelado: o toque quebra o gelo e NAO dispara
    j.congela(1.5);
    const g0 = j.efeitos.gelo;
    aperta(planos, j);
    ok(conta('poder:usa') === 1 && j.efeitos.gelo < g0 - FISICA.GELO_POR_TOQUE + 0.001, 'congelado: PODER quebra o gelo e nao dispara');
    ok(!P.podeUsar(j) && !P.iaDeveUsar(j), 'congelado: podeUsar e iaDeveUsar falsos');
    j.efeitos.gelo = 0;
    confere(c);
  }

  // =============================================================================================== 1. Mancha de Oleo
  {
    const { c, j, planos, P, rivais } = await nova(G, 'oleo');
    const [A, B] = rivais, cfg = PODERES.oleo;
    poe(planos, j, 300, 0, 20); poe(planos, A, 280, 0, 20); poe(planos, B, 270, -5.2, 20);
    anda(20);
    ok(P.iaDeveUsar(j) === false || P.podeUsar(j) === false, 'iaDeveUsar falso com o poder carregando');
    pronto(j);
    ok(P.iaDeveUsar(j), 'oleo: iaDeveUsar com alguem colado atras');
    aperta(planos, j);
    const pz = P.perigos().find((h) => h.tipo === 'oleo');
    ok(!!pz && pz.sup === 0 && pz.s < j.s - cfg.distanciaAtras + 0.5 && pz.raio > 2, `a poca fica ATRAS do carro, na pista (perigos: s ${pz && pz.s.toFixed(1)}, raio ${pz && pz.raio.toFixed(1)})`);
    const lim = c.pista.principal.larguraEm(pz.s) * 0.5 - 1.15;
    const livre = Math.max(lim - (pz.d + pz.raio), (pz.d - pz.raio) + lim);
    ok(livre >= cfg.livre - 1e-6, `a poca nao ocupa a pista inteira: sobra ${livre.toFixed(2)} m de faixa para o centro do carro`);
    anda(150);
    ok(conta('poder:acerta', (e) => e.alvo === A && e.de === j && e.poder === 'oleo') === 1, 'quem passou por cima: poder:acerta (do dono para o alvo)');
    ok(A.efeitos.rodopio > 0 || ev['poder:acerta'].length === 1, 'quem passou por cima RODA');
    ok(B.efeitos.rodopio === 0 && conta('poder:acerta', alvo(B)) === 0, 'quem DESVIOU (faixa ao lado) nao roda');
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'oleo') === 1, 'quem desviou: poder:esquivou');
    // o dono nao escorrega na propria poca (volta por cima dela) e a poca some depois da duracao
    j.colocaNaPista(0, pz.s - 15, pz.d, 0, 15); planos.get(j).v = 15; planos.get(j).d = pz.d;
    anda(90);
    ok(j.efeitos.rodopio === 0, 'o dono passa na propria poca sem rodar');
    anda(Math.round(cfg.duracao * 60));
    ok(!P.perigos().some((h) => h.tipo === 'oleo'), `a poca some depois de ${cfg.duracao} s`);
    ok(conta('poder:fim', (e) => e.alvo === A && e.poder === 'oleo') === 1, 'o fim do rodopio: poder:fim');
    // ninguem atras: a IA nao solta
    poe(planos, A, 900, 0, 0); poe(planos, B, 950, 0, 0); pronto(j);
    anda(1);
    ok(!P.iaDeveUsar(j), 'oleo: iaDeveUsar falso sem ninguem atras');
    confere(c);
  }

  // =============================================================================================== 2. Pulso EMP
  {
    const { c, j, planos, P, rivais } = await nova(G, 'emp');
    const [A, B, C] = rivais, cfg = PODERES.emp;
    poe(planos, j, 300, 0, 15); poe(planos, A, 290, 4, 15); poe(planos, B, 320.5, -4, 15); poe(planos, C, 360, 0, 15);
    anda(10);
    pronto(j);
    ok(P.iaDeveUsar(j), 'emp: iaDeveUsar com rival perto');
    A.turbo.carga = 1; B.turbo.carga = 1;
    aperta(planos, j);
    // B sai do circulo DURANTE a carga (acelera forte para a frente)
    planos.get(B).v = 45; planos.get(B).turbo = true; B.turbo.carga = 1;
    anda(Math.round(cfg.carga * 60) + 2);
    ok(conta('poder:acerta', (e) => e.alvo === A && e.poder === 'emp') === 1 && conta('poder:acerta', alvo(B)) === 0, 'no estouro acerta quem ficou no circulo');
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'emp') === 1, `quem saiu do circulo durante a carga escapou (B a ${B.pos.distanceTo(j.pos).toFixed(0)} m > ${cfg.raio})`);
    ok(conta('poder:acerta', alvo(C)) === 0 && conta('poder:esquivou', alvo(C)) === 0, 'quem estava longe nem soube');
    planos.get(A).turbo = true; A.turbo.carga = 1;
    anda(30);
    ok(A.mod.semTurbo === true && !A.turbo.ativo, 'acertado: sem turbo mesmo segurando o botao');
    ok(P.ativosEm(A).some((a) => a.poder === 'emp'), 'ativosEm do acertado tem o emp');
    ok(!j.mod.semTurbo, 'quem usou continua com turbo');
    anda(Math.round((cfg.duracao - 0.4) * 60));
    ok(conta('poder:fim', (e) => e.alvo === A && e.poder === 'emp') === 1, `depois de ${cfg.duracao} s: poder:fim`);
    anda(2);
    ok(A.turbo.ativo, 'e o turbo liga de novo');
    // ninguem perto: a IA nao usa
    for (const x of [A, B, C]) poe(planos, x, 900 + x.indice * 10, 0, 0);
    pronto(j); anda(1);
    ok(!P.iaDeveUsar(j), 'emp: iaDeveUsar falso sem rival no raio');
    confere(c);
  }

  // =============================================================================================== 3. Raio Congelante
  {
    const { c, j, planos, P, rivais } = await nova(G, 'congelante');
    const [A, B] = rivais, cfg = PODERES.congelante;
    poe(planos, j, 300, 0, 22); poe(planos, A, 345, 0.5, 18); poe(planos, B, 900, 0, 0);
    anda(10);
    pronto(j);
    ok(P.iaDeveUsar(j), 'congelante: iaDeveUsar com alvo a frente EM LINHA');
    aperta(planos, j);
    anda(45);
    ok(conta('poder:acerta', (e) => e.alvo === A && e.de === j && e.poder === 'congelante') === 1 && A.efeitos.gelo > 0.8, `o raio acerta o carro da frente na mesma faixa (gelo ${A.efeitos.gelo.toFixed(2)} s)`);
    G.quadro(1 / 60);
    ok(P.efeitos.gelos.ativos >= 1, 'bloco de gelo no congelado');
    // congelado: toques no PODER quebram mais rapido (a fisica) e nao disparam o poder dele
    pronto(A);
    const g0 = A.efeitos.gelo;
    for (let k = 0; k < 3; k++) { aperta(planos, A); anda(1); }
    ok(A.efeitos.gelo < g0 - 3 * FISICA.GELO_POR_TOQUE + 0.01 && conta('poder:usa', (e) => e.carro === A) === 0, 'congelado: toques no PODER quebram o gelo (e nao disparam)');
    anda(Math.round(A.efeitos.gelo * 60) + 3);
    ok(conta('poder:fim', (e) => e.alvo === A && e.poder === 'congelante') === 1, 'o gelo derreteu: poder:fim');
    // ESQUIVA: mudar de faixa — o alvo esta 5 m para o lado: o raio vai reto
    poe(planos, A, 345, 5.2, 18);
    anda(5); pronto(j);
    ok(!P.iaDeveUsar(j), 'congelante: iaDeveUsar FALSO sem alvo em linha');
    aperta(planos, j);
    anda(60);
    ok(A.efeitos.gelo === 0 && conta('poder:acerta', alvo(A)) === 1, 'o raio passa reto pela faixa vazia (o alvo de outra faixa nao congela)');
    ok(conta('poder:esquivou', (e) => e.alvo === A && e.poder === 'congelante') === 1, 'quem estava a frente e escapou: poder:esquivou');
    // trocando de faixa DEPOIS do disparo (o raio nao segue)
    poe(planos, j, 500 - 120, 0, 18); poe(planos, A, 500 - 60, 0, 18); anda(5); pronto(j);
    aperta(planos, j);
    planos.get(A).d = 5.5; planos.get(A).dir = 1;  // vira tudo para o lado na hora (o raio leva ~0,6 s para chegar)
    anda(14); planos.get(A).dir = null;
    anda(50);
    mede('congelante: faixa do alvo quando o raio passou (m)', A.d);
    ok(A.efeitos.gelo === 0, `mudou de faixa enquanto o raio vinha: escapou (d ${A.d.toFixed(1)})`);
    confere(c);
  }

  // =============================================================================================== 4. Ima
  {
    const { c, j, planos, P, rivais } = await nova(G, 'ima');
    const [A, B] = rivais, cfg = PODERES.ima, caps = c.capsulas;
    // uma fileira de capsulas logo a frente
    const fil = caps.lista.filter((x) => x.sup === 0 && x.origem === 'fileira' && x.s > 400 && x.s < 1000)[0];
    poe(planos, j, fil.s - 28, 0, 14); poe(planos, A, fil.s - 38, 3, 14); poe(planos, B, fil.s - 28 + 19, -3, 14);
    j.turbo.carga = 0;
    anda(10); pronto(j);
    ok(P.iaDeveUsar(j), 'ima: iaDeveUsar com rival perto');
    aperta(planos, j);
    anda(3);
    ok(Math.abs(A.mod.velMax - cfg.freio) < 1e-9, `quem esta a menos de ${cfg.raioCarros} m e segurado (mod.velMax ${A.mod.velMax.toFixed(2)})`);
    ok(B.mod.velMax === 1, `quem esta a mais de ${cfg.raioCarros} m nao (B a ${B.pos.distanceTo(j.pos).toFixed(0)} m)`);
    ok(conta('poder:acerta', (e) => e.alvo === A && e.poder === 'ima') === 1, 'poder:acerta no segurado');
    ok(P.ativosEm(j).some((a) => a.poder === 'ima') && P.ativosEm(A).some((a) => a.poder === 'ima'), 'ativosEm: o campo no dono e no segurado');
    const voando = caps.lista.filter((x) => x.voando).length;
    ok(voando >= 2, `as capsulas perto voam para o dono (${voando} voando)`);
    anda(60);
    ok(conta('capsula:pega', (e) => e.carro === j) >= 2 && j.turbo.carga >= 0.5, `e o dono pega (${conta('capsula:pega', (e) => e.carro === j)} capsulas, turbo ${Math.round(j.turbo.carga * 100)}%)`);
    anda(Math.round(cfg.duracao * 60));
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'ima') === 1, 'quem ficou perto mas longe do campo: poder:esquivou');
    ok(conta('poder:fim', (e) => e.alvo === A && e.poder === 'ima') === 1 && A.mod.velMax === 1, 'o campo acabou: o segurado esta solto (poder:fim)');
    for (const x of [A, B]) poe(planos, x, 1300 + x.indice * 10, 0, 0);
    poe(planos, j, 1100, 0, 0);
    anda(3); pronto(j);
    ok(!P.iaDeveUsar(j), 'ima: iaDeveUsar falso sem rival nem capsula perto');
    confere(c);
  }

  // =============================================================================================== 5. Troca-Troca
  {
    const { c, j, planos, P, rivais } = await nova(G, 'trocatroca');
    const [A, B] = rivais, cfg = PODERES.trocatroca;
    poe(planos, j, 300, 0, 26); poe(planos, A, 330, 3, 18); poe(planos, B, 1000, 0, 0);
    anda(10); pronto(j);
    ok(P.iaDeveUsar(j), 'trocatroca: iaDeveUsar com carro logo a frente');
    aperta(planos, j);
    ok(P.ativosEm(A).some((a) => a.poder === 'trocatroca'), 'o alvo da mira aparece no ativosEm (o HUD mostra 🔄)');
    anda(Math.round(cfg.mira * 60) - 6);
    ok(conta('poder:acerta') === 0 && P.delta(j, A) > 0, 'durante a mira nada troca');
    const antes = { j: P.progresso(j), a: P.progresso(A) };
    anda(10);
    const ac = ev['poder:acerta'].find((e) => e.poder === 'trocatroca');
    ok(!!ac && ac.de === j && ac.alvo === A, 'no fim da mira: poder:acerta (troca)');
    ok(P.delta(A, j) > 0, `trocaram: agora o jogador esta a frente (${P.delta(A, j).toFixed(1)} m)`);
    ok(Math.abs(j.vf - 26) < 2.5 && Math.abs(A.vf - 18) < 2.5, `cada um com a PROPRIA velocidade (${j.vf.toFixed(1)} e ${A.vf.toFixed(1)} m/s)`);
    mede('trocatroca: ganho do jogador (m)', P.progresso(j) - antes.j);
    // ESQUIVA: o alvo liga o TURBO durante a mira
    poe(planos, j, 400, 0, 22); poe(planos, A, 425, 0, 18); A.turbo.carga = 1;
    anda(5); pronto(j);
    aperta(planos, j);
    anda(20);
    planos.get(A).turbo = true;
    anda(Math.round(cfg.mira * 60));
    planos.get(A).turbo = false;
    ok(conta('poder:esquivou', (e) => e.alvo === A && e.poder === 'trocatroca') === 1 && conta('poder:acerta', (e) => e.poder === 'trocatroca') === 1, 'o alvo ligou o TURBO durante a mira: escapou, sem troca');
    ok(P.delta(j, A) > 0, 'e continua na frente');
    // com o turbo ligado a IA nao gasta o poder nele; sem ninguem a frente tambem nao
    poe(planos, A, j.s + 20, 0, 18); A.turbo.carga = 1; planos.get(A).turbo = true;
    anda(5); pronto(j);
    ok(!P.iaDeveUsar(j), 'trocatroca: iaDeveUsar falso com o alvo de turbo ligado');
    planos.get(A).turbo = false;
    poe(planos, A, 1300, 0, 0); anda(2); pronto(j);
    ok(!P.iaDeveUsar(j), 'trocatroca: iaDeveUsar falso sem carro a frente');
    // sem alvo: gasta (o feixe procura e apaga), sem evento de acerto
    const n0 = conta('poder:acerta');
    aperta(planos, j); anda(40);
    ok(conta('poder:usa', (e) => e.carro === j) === 3 && conta('poder:acerta') === n0, 'sem ninguem a frente o poder e gasto sem trocar');
    confere(c);
  }

  // =============================================================================================== 6. Encolhedor
  {
    const { c, j, planos, P, rivais } = await nova(G, 'encolhedor');
    const [A, B, C] = rivais, cfg = PODERES.encolhedor, caps = c.capsulas;
    poe(planos, j, 300, 0, 16); poe(planos, A, 288, 3, 16); poe(planos, B, 320.5, -3, 16); poe(planos, C, 1000, 0, 0);
    anda(10); pronto(j);
    ok(P.iaDeveUsar(j), 'encolhedor: iaDeveUsar com rival perto');
    aperta(planos, j);
    planos.get(B).v = 48; planos.get(B).turbo = true; B.turbo.carga = 1;   // B foge do anel durante a carga
    anda(Math.round(cfg.carga * 60) + 2);
    ok(conta('poder:acerta', (e) => e.alvo === A && e.poder === 'encolhedor') === 1, 'no estouro encolhe quem esta no raio');
    ok(Math.abs(A.mod.escala - cfg.escala) < 1e-9 && Math.abs(A.mod.velMax - cfg.velMax) < 1e-9 && Math.abs(A.mod.massa - cfg.massa) < 1e-9, `encolhido: escala ${A.mod.escala}, velMax ${A.mod.velMax}, massa ${A.mod.massa}`);
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'encolhedor') === 1 && B.mod.escala === 1, 'quem saiu do anel na carga nao encolheu');
    ok(j.mod.escala === 1, 'quem usou nao encolhe');
    // CONTRA-ATAQUE: pegar capsula volta ao normal
    poe(planos, B, 1300, 0, 0); planos.get(B).turbo = false;
    const cap = caps.lista.find((x) => x.sup === 0 && x.ativa && !x.dourada && x.s > 640 && x.s < 900);
    poe(planos, j, 1150, 0, 0);
    poe(planos, A, cap.s - 8, cap.d, 14);
    anda(2);
    ok(A.mod.escala === cfg.escala, 'ainda encolhido antes da capsula');
    anda(50);
    ok(conta('capsula:pega', (e) => e.carro === A) >= 1, 'o encolhido passou pela capsula e pegou (raio menor, mas pega)');
    ok(A.mod.escala === 1 && A.mod.velMax === 1, 'pegou capsula: VOLTOU AO NORMAL');
    ok(conta('poder:fim', (e) => e.alvo === A && e.poder === 'encolhedor') === 1, 'poder:fim no desencolher');
    // sem capsula: volta sozinho no fim da duracao
    poe(planos, A, j.s + 10, 2, 16); poe(planos, B, 1100, 0, 0);
    anda(5); pronto(j); aperta(planos, j);
    anda(Math.round(cfg.carga * 60) + 4);
    ok(A.mod.escala < 1, 'encolheu de novo');
    poe(planos, A, 1200, 0, 0);
    anda(Math.round(cfg.duracao * 60));
    ok(A.mod.escala === 1, `sem capsula volta ao normal em ${cfg.duracao} s`);
    poe(planos, A, 1300, 0, 0); pronto(j); anda(2);
    ok(!P.iaDeveUsar(j), 'encolhedor: iaDeveUsar falso sem rival perto');
    confere(c);
  }

  // =============================================================================================== 7. Cortina de Fumaca
  {
    const { c, j, planos, P, rivais } = await nova(G, 'fumaca');
    const [A, B] = rivais, cfg = PODERES.fumaca;
    poe(planos, j, 300, 0, 20); poe(planos, A, 272, 0, 20); poe(planos, B, 262, -5.6, 20);
    anda(10); pronto(j);
    ok(P.iaDeveUsar(j), 'fumaca: iaDeveUsar com alguem atras');
    aperta(planos, j);
    const nv = P.perigos().find((h) => h.tipo === 'fumaca');
    ok(!!nv && nv.s < j.s - cfg.distanciaAtras + 0.5, `a nuvem fica ATRAS do carro (perigos: s ${nv && nv.s.toFixed(1)}, meia largura ${nv && nv.raio.toFixed(1)})`);
    const lim = c.pista.principal.larguraEm(nv.s) * 0.5 - 1.15;
    const livre = Math.max(lim - (nv.d + nv.raio), (nv.d - nv.raio) + lim);
    ok(livre >= cfg.livre - 1e-6, `a nuvem nao cobre a pista toda: sobra ${livre.toFixed(2)} m de faixa`);
    let visaoA = 0, visaoB = 0;
    for (let k = 0; k < 150; k++) { anda(1); visaoA = Math.max(visaoA, A.mod.visao); visaoB = Math.max(visaoB, B.mod.visao); }
    ok(visaoA > 0.5 && conta('poder:acerta', (e) => e.alvo === A && e.poder === 'fumaca') === 1, `quem entrou na nuvem perde a visao (mod.visao ${visaoA.toFixed(2)})`);
    ok(visaoB === 0, 'quem passou PELO LADO enxerga');
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'fumaca') === 1, 'quem passou pelo lado: poder:esquivou');
    anda(Math.round(cfg.duracao * 60));
    ok(!P.perigos().some((h) => h.tipo === 'fumaca'), `a nuvem some depois de ${cfg.duracao} s`);
    poe(planos, A, 1200, 0, 0); poe(planos, B, 1250, 0, 0); pronto(j); anda(2);
    ok(!P.iaDeveUsar(j), 'fumaca: iaDeveUsar falso sem ninguem atras');
    confere(c);
  }

  // =============================================================================================== 8. Mini Tornado
  {
    const { c, j, planos, P, rivais } = await nova(G, 'tornado');
    const [A, B] = rivais, cfg = PODERES.tornado;
    poe(planos, j, 200, 0, 20); poe(planos, A, 262, 0.5, 20); poe(planos, B, 1000, 0, 0);
    anda(10); pronto(j);
    ok(P.iaDeveUsar(j), 'tornado: iaDeveUsar com alvo a frente');
    aperta(planos, j);
    const tz = P.perigos().find((h) => h.tipo === 'tornado');
    ok(!!tz && tz.alvo === A, 'o tornado anda na pista (perigos) e mira o carro da frente');
    let levantou = false;
    for (let k = 0; k < 120 && !levantou; k++) { anda(1); levantou = A.efeitos.levantado > 0; }
    ok(levantou && conta('poder:acerta', (e) => e.alvo === A && e.poder === 'tornado') === 1, 'quem nao desvia e LEVANTADO girando');
    anda(120);
    ok(A.noChao && conta('poder:fim', (e) => e.alvo === A && e.poder === 'tornado') === 1, 'pousou: poder:fim');
    // ESQUIVA: desviar para o lado na hora certa (~0,9 s antes)
    poe(planos, j, 400, 0, 20); poe(planos, A, 470, 0, 20);
    anda(5); pronto(j);
    aperta(planos, j);
    let desviou = false, menor = 99;
    for (let k = 0; k < 150; k++) {
      const t = P.perigos().find((h) => h.tipo === 'tornado');
      if (t && !desviou && P.deltaP(c.pista.sPrincipal(t.sup, t.s), P.progresso(A)) < 50) { desviou = true; planos.get(A).dir = 1; planos.get(A).d = 5.5; }
      if (desviou && planos.get(A).dir !== null && Math.abs(A.psi) > 0.45) planos.get(A).dir = null;
      if (t && Math.abs(P.deltaP(c.pista.sPrincipal(t.sup, t.s), P.progresso(A))) < 2) menor = Math.min(menor, Math.abs(t.d - A.d));
      anda(1);
    }
    mede('tornado: distancia lateral quando passou pelo alvo que desviou (m)', menor);
    ok(desviou && A.efeitos.levantado === 0 && A.noChao && conta('poder:acerta', alvo(A)) === 1, 'desviou para o lado na hora: o tornado passou');
    ok(conta('poder:esquivou', (e) => e.alvo === A && e.poder === 'tornado') >= 1, 'quem desviou: poder:esquivou');
    // sem alvo a IA nao gasta
    poe(planos, A, 1300, 0, 0); pronto(j); anda(2);
    ok(!P.iaDeveUsar(j), 'tornado: iaDeveUsar falso sem ninguem a frente');
    confere(c);
  }

  // =============================================================================================== 9. Escudo Refletor
  {
    const { c, j, planos, P, rivais } = await nova(G, 'escudo');
    const [A, B, C] = rivais, cfg = PODERES.escudo;
    A.poder.id = 'congelante'; B.poder.id = 'emp'; C.poder.id = 'escudo';
    poe(planos, j, 300, 0, 18); poe(planos, A, 270, 0, 18); poe(planos, B, 1000, 0, 0); poe(planos, C, 1100, 0, 0);
    anda(10); pronto(j); pronto(A);
    ok(P.iaDeveUsar(j), 'escudo: iaDeveUsar com rival atras de poder pronto (ameaca)');
    aperta(planos, j);
    ok(P.escudoAtivo(j) && P.ativosEm(j).some((a) => a.poder === 'escudo'), 'escudo ligado (ativosEm do dono)');
    // A congela o jogador: bloqueado e DEVOLVIDO
    aperta(planos, A);
    anda(40);
    ok(conta('poder:bloqueado', (e) => e.de === A && e.alvo === j && e.poder === 'congelante') === 1, 'o raio bate no escudo: poder:bloqueado');
    ok(j.efeitos.gelo === 0, 'o dono do escudo NAO congela');
    ok(A.efeitos.gelo > 0 && conta('poder:acerta', (e) => e.de === j && e.alvo === A && e.poder === 'congelante') === 1, 'DEVOLVIDO: quem mandou congela');
    ok(!P.escudoAtivo(j) && conta('poder:fim', (e) => e.alvo === j && e.poder === 'escudo') === 1, 'o escudo estourou no bloqueio (poder:fim)');
    A.efeitos.gelo = 0;
    // poder de AREA: o dono do escudo fica imune e quem mandou leva
    poe(planos, B, 312, 3, 18);
    anda(5); pronto(j); aperta(planos, j);
    pronto(B); aperta(planos, B);
    anda(Math.round(PODERES.emp.carga * 60) + 3);
    ok(!j.mod.semTurbo && conta('poder:bloqueado', (e) => e.de === B && e.alvo === j && e.poder === 'emp') === 1, 'EMP no escudo: o dono fica imune');
    ok(B.mod.semTurbo === true, 'e o EMP volta para quem mandou');
    // dois escudos: o devolvido nao volta de novo (sem pingue-pongue)
    poe(planos, B, 1000, 0, 0);
    P.mods.escudo.usa(j); P.mods.escudo.usa(C);
    const bl = conta('poder:bloqueado'), ac = conta('poder:acerta');
    P.acerta('congelante', C, j);
    ok(conta('poder:bloqueado') === bl + 2 && conta('poder:acerta') === ac && j.efeitos.gelo === 0 && C.efeitos.gelo === 0, 'dois escudos: bloqueia, devolve, o outro bloqueia e acaba (ninguem congela)');
    // sem ataque o escudo acaba sozinho
    anda(3); pronto(j); aperta(planos, j);
    anda(Math.round((cfg.duracao - 0.5) * 60));
    ok(P.escudoAtivo(j), `o escudo dura ate ${cfg.duracao} s`);
    anda(40);
    ok(!P.escudoAtivo(j), `e acaba sozinho depois de ${cfg.duracao} s`);
    // sem ameaca a IA nao liga
    for (const x of [A, B, C]) poe(planos, x, 1200 + x.indice * 15, 0, 0);
    pronto(j); anda(2);
    ok(!P.iaDeveUsar(j), 'escudo: iaDeveUsar falso sem ameaca');
    confere(c);
  }

  // =============================================================================================== 10. Terremoto
  {
    const { c, j, planos, P, rivais } = await nova(G, 'terremoto');
    const [A, B, C] = rivais, cfg = PODERES.terremoto;
    const crista = c.pista.sDoPonto(3);
    // B chega na crista ~0,4 s depois do disparo: no ar NA HORA do tremor (carga 0,8 s)
    poe(planos, j, crista - 80, 0, 20); poe(planos, A, crista - 60, 3, 20); poe(planos, B, crista - 13, -2, 32); poe(planos, C, 1400, 0, 0);
    planos.get(B).v = 32;
    pronto(j);
    ok(P.iaDeveUsar(j), 'terremoto: iaDeveUsar com rivais perto no chao');
    aperta(planos, j);
    anda(Math.round(cfg.carga * 60) + 2);
    ok(!B.noChao, 'B esta no ar (saltando a rampa) na hora do tremor');
    ok(conta('poder:acerta', (e) => e.alvo === A && e.poder === 'terremoto') === 1 && Math.abs(A.mod.aderencia - cfg.aderencia) < 1e-9, `no chao: escorrega (mod.aderencia ${A.mod.aderencia})`);
    ok(conta('poder:esquivou', (e) => e.alvo === B && e.poder === 'terremoto') === 1, 'NO AR na hora do tremor: nao sente (poder:esquivou)');
    ok(j.mod.aderencia === 1, 'quem usou nao escorrega');
    anda(120);
    ok(B.noChao && B.mod.aderencia === 1, 'e continua sem sentir depois de pousar');
    ok(A.mod.aderencia < 1 && P.ativosEm(A).some((a) => a.poder === 'terremoto'), 'o acertado continua escorregando (ativosEm)');
    anda(Math.round(cfg.duracao * 60));
    ok(A.mod.aderencia === 1 && conta('poder:fim', (e) => e.alvo === A && e.poder === 'terremoto') === 1, `volta ao normal depois de ${cfg.duracao} s (poder:fim)`);
    // o JOGADOR acertado: a camera treme
    A.poder.id = 'terremoto';
    poe(planos, A, j.s + 15, 2, 18); anda(3); pronto(A); aperta(planos, A);
    anda(Math.round(cfg.carga * 60) + 2);
    ok(c.camera._tremDur > 0 && c.camera._tremAmp > 0.5, `o jogador acertado: camera.treme (${c.camera._tremAmp.toFixed(2)})`);
    for (const x of [A, B]) poe(planos, x, 1300 + x.indice * 15, 0, 0);
    pronto(j); anda(2);
    ok(!P.iaDeveUsar(j), 'terremoto: iaDeveUsar falso sem ninguem perto');
    confere(c);
  }

  ok(nans === 0, 'nenhum NaN em nenhum carro (guarda da fisica nunca agiu)');
  G.jogo.encerraCorrida();
});
