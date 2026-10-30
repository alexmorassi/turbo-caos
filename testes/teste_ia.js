// SUITE DA IA (fase 5): js/ia.js. Corridas de verdade nas 10 pistas (8 carros, 3 voltas, o jogador no piloto automatico) e casos
// montados de proposito. Prova o pedido:
//   * o PLANO: a linha de corrida fica dentro da margem em toda amostra, curva mais aberta que o centro da pista, todo salto com a
//     velocidade minima simulada; a mesma semente da a mesma corrida (bit a bit);
//   * as CORRIDAS: todos terminam; ninguem parado/preso mais de 5 s; quedas raras (mede); nenhum NaN; a IA pega atalho as vezes (e as
//     vezes nao); usa turbo; pega capsula (quando a fase 4 poe capsula na pista); usa poder SO no passo em que a heuristica da fase 4
//     (`iaDeveUsar`) disse que da; a chegada nao repete a ordem da grade e o vencedor muda de pista para pista;
//   * o RITMO: a volta solo da IA (sem turbo, sem atalho, sem poder) perto da volta do piloto de referencia da suite da fisica (a mesma
//     fisica, o mesmo carro) — [MEDE] por pista; e a volta completa (com turbo e atalho) tambem medida;
//   * os CASOS: o jogador sem ?auto e da entrada (a IA nao mexe) e na festa e da IA; de costas para a pista ele manobra; encostado de bico
//     no muro, parado, ele sai; passa o carro lento da frente pelo lado livre sem bater; desvia de uma poca de oleo na linha; com a
//     precisao baixa desvia mais da linha (erro humano) sem cair nem perder muito tempo.
import { suite, ok, perto, mede, quadros, simulaAte, segura, solta, apagaProgresso, corridaDeTeste, largada, limpaTudo } from './harness.js';
import { on } from '../js/eventos.js';
import { PISTAS } from '../config/pistas.js';
import { CARROS } from '../config/carros.js';
import { FISICA } from '../config/fisica.js';
import { IA as CFG } from '../config/dificuldade.js';
import { Pista, MARCA } from '../js/pista.js';
import { planosDaPista } from '../js/ia.js';
import PISTA_TESTE from '../js/pistas/teste.js';

const TETO_DA_CORRIDA = 700;        // s de simulacao por corrida de 3 voltas (todos chegando: ~150-180 s medidos)
const PRESO_MAX = 5;                // s (pedido)
const PARADO = 1.2;                 // m/s
const REF_FOLGA = 1.05;             // a volta solo da IA sem turbo pode ser no maximo 5 % mais lenta que a do piloto de referencia

/** PILOTO DE REFERENCIA — copia do `piloto()` de testes/teste_fisica.js (fase 2): curvatura da pista 0,3 s a frente + PD em d e no
 *  rumo, acelerador no fundo. E a regua do pedido ("tempo de volta perto do piloto de referencia"). */
function piloto(c, alvoD = 0) {
  const sup = c.corrida.pista.sup(c.sup), v = Math.max(2, Math.abs(c.vf));
  const kh = sup.khEm(c.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (c.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (c.d - alvoD)));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - c.psi)) / (v / raio)));
}
const finito = (c) => Number.isFinite(c.pos.x + c.pos.y + c.pos.z + c.vel.x + c.vel.y + c.vel.z + c.s + c.d + c.psi + c.vf + c.vr);
/** Distancia de Kendall entre duas ordens (pares invertidos): 0 = a mesma ordem. */
function inversoes(a, b) { const pos = new Map(b.map((x, k) => [x, k])); let n = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (pos.get(a[i]) > pos.get(a[j])) n++; return n; }

/** Corrida "solo": os rivais parados la longe, fantasmas e sem comando (so o jogador anda). `sem`: tira turbo, poder e atalho da IA. */
async function solo(G, id, carro, { ref = false, sem = false, precisao = null, semCapsula = false } = {}) {
  G.save.remove('dda');
  G.sorteio.semente(77);
  const c = await corridaDeTeste({ pista: id, carro, voltas: 2, corredores: 6, auto: !ref });
  const j = c.jogador, st = c.ia.estados[j.indice];
  if (sem) for (const a of st.atalhos) a.impossivel = true;
  if (precisao !== null) { st.prec = precisao; }
  if (semCapsula) c.capsulas.proximas = () => [];
  const iaPasso = c.ia.passo.bind(c.ia);
  c.ia.passo = (dt) => {
    iaPasso(dt);
    for (const x of c.carros) if (x !== j) { x.controle.acel = 0; x.controle.freio = 0; x.controle.turbo = false; x.controle.poder = false; }
    if (sem) { j.controle.turbo = false; j.controle.poder = false; }
  };
  largada();
  for (const x of c.carros) if (x !== j) { x.fantasma = 1e9; x.colocaNaPista(0, c.pista.comprimento * 0.5, 0, 0, 0); }
  let quedas = 0, desvio = 0, n = 0;
  const pl = c.ia.planos;
  const d1 = on('carro:queda', (e) => { if (e.carro === j) quedas++; });
  const seg = simulaAte(() => {
    if (ref) { segura('acel', 1); segura('direcao', piloto(j)); }
    if (j.noChao && j.volta >= 1) { const P = pl[j.sup]; desvio += Math.abs(j.d - P.d[Math.round(j.s / c.pista.sup(j.sup).ds) % P.n]); n++; }
    return j.volta >= 3;
  }, 400);
  if (ref) { solta('acel'); solta('direcao'); }
  d1();
  const r = { volta: j.temposDeVolta[1] || 0, quedas, seg, desvio: desvio / Math.max(1, n), atalhos: c.ia.estatisticas.atalhos };
  G.jogo.encerraCorrida();
  return r;
}

suite('ia', async (G) => {
  apagaProgresso();
  // o piloto desta suite JA e um controlador (le psi, d e a curva): sem a ajuda na direcao por cima (js/assistencia.js), a fisica crua
  G.entrada.ajuda = false;
  let nans = 0;

  // ------------------------------------------------------------------ 1. o plano de cada pista (linha, curvatura, saltos)
  for (const def of [PISTA_TESTE, ...PISTAS]) {
    const pista = new Pista(def), planos = planosDaPista(pista);
    let fora = 0, ruins = 0, kLinha = 0, kCentro = 0;
    for (const [k, pl] of planos.entries()) {
      const sup = pista.sup(k);
      for (let i = 0; i < sup.n; i++) {
        if (!Number.isFinite(pl.d[i]) || !Number.isFinite(pl.k[i])) ruins++;
        if (pl.d[i] < -pl.limE[i] - 1e-4 || pl.d[i] > pl.limD[i] + 1e-4) fora++;
        if (k === 0 && !(sup.marcas[i] & MARCA.MAGNETICO)) { kLinha = Math.max(kLinha, Math.abs(pl.k[i])); kCentro = Math.max(kCentro, Math.abs(sup.kh[i])); }
      }
    }
    const saltos = planos.flatMap((pl) => pl.saltos);
    ok(ruins === 0 && fora === 0, `${def.id}: linha de corrida finita e dentro da margem em todas as amostras (${planos.length} superficies)`);
    ok(kLinha < kCentro, `${def.id}: a linha corta as curvas (raio minimo ${(1 / kLinha).toFixed(0)} m contra ${(1 / kCentro).toFixed(0)} m no centro)`);
    ok(saltos.every((s) => s.vMin > 5 && s.vMin < 40), `${def.id}: ${saltos.length} salto(s) com a velocidade minima simulada (${saltos.map((s) => s.vMin.toFixed(1)).join(', ')} m/s)`);
    ok(planos[0].saltos.every((s) => planos[0].piso[s.i] >= s.vMin), `${def.id}: a subida de cada salto tem piso de velocidade (nao freia para cair)`);
  }

  // ------------------------------------------------------------------ 2. determinismo: mesma semente, mesma corrida
  {
    const roda = async () => {
      G.save.remove('dda'); G.sorteio.semente(4242);
      const c = await corridaDeTeste({ pista: 'favela', carro: 'faisca', voltas: 1, corredores: 8, auto: true });
      largada(); quadros(900);
      const r = c.carros.map((x) => [x.sup, x.s, x.d, x.psi, x.vf].join(','));
      G.jogo.encerraCorrida();
      return r.join('|');
    };
    const a = await roda(), b = await roda();
    ok(a === b, 'mesma semente: 900 passos com 8 carros na IA dao o mesmo estado bit a bit');
  }

  // ------------------------------------------------------------------ 3. quem a IA dirige
  {
    G.save.remove('dda'); G.sorteio.semente(5);
    const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', voltas: 1, corredores: 6 });
    largada();
    segura('acel', 0.3); segura('direcao', -0.7);
    quadros(2);
    const j = c.jogador;
    ok(Math.abs(j.controle.direcao + 0.7) < 1e-9 && Math.abs(j.controle.acel - 0.3) < 1e-9, 'sem ?auto o jogador e da entrada: a IA nao mexe no controle dele');
    quadros(60);
    ok(Math.abs(j.controle.direcao + 0.7) < 1e-9, 'um segundo depois, ainda da entrada');
    ok(c.carros.filter((x) => !x.ehJogador).every((x) => x.vf > 3), `os rivais sao da IA: em 1 s todos sairam da grade (${c.carros.filter((x) => !x.ehJogador).map((x) => x.vf.toFixed(0)).join(' ')} m/s)`);
    solta('acel'); solta('direcao');
    j.chegou = true;   // a festa: depois da chegada o carro segue no piloto automatico
    quadros(2);
    ok(j.controle.acel > 0, 'depois da chegada (festa) a IA dirige o jogador');
    G.jogo.encerraCorrida();
  }

  // ------------------------------------------------------------------ 4. as 10 corridas
  const tot = { quedas: 0, atalhosIA: 0, recusados: 0, turbosIA: 0, ligaTurbo: 0, capsIA: 0, capsTodas: 0, poderesIA: 0, semPermissao: 0, muro: 0, inversoes: 0, vencedores: new Set(), miradas: 0 };
  let corridasComTurbo = 0, corridasFase4Turbo = 0, corridasComCapsula = 0, corridasComPoder = 0, ordensDiferentes = 0;
  for (const [k, def] of PISTAS.entries()) {
    limpaTudo();
    G.save.remove('dda');
    G.sorteio.semente(1000 + k);
    const carro = CARROS[k % CARROS.length].id;
    const c = await corridaDeTeste({ pista: def.id, carro, voltas: 3, corredores: 8, auto: true });
    const n = c.carros.length, grade = c.carros.slice().sort((a, b) => a.indice - b.indice).map((x) => x.indice);
    const ev = { quedas: 0, muro: 0, liga: 0, ligaIA: 0, caps: 0, capsIA: 0, poder: 0, semPermissao: 0 };
    // a heuristica da fase 4 diz "sim" em que passo, para quem
    const simEm = new Array(n).fill(-1);
    const deve = c.poderes.iaDeveUsar.bind(c.poderes);
    c.poderes.iaDeveUsar = (x) => { const r = deve(x); if (r) simEm[x.indice] = G.relogio.quadros; return r; };
    const desl = [
      on('carro:queda', () => ev.quedas++),
      on('carro:batida', (e) => { if (e.tipo === 'muro') ev.muro++; }),
      on('turbo:liga', (e) => { ev.liga++; if (e.carro && !e.carro.ehJogador) ev.ligaIA++; }),
      on('capsula:pega', (e) => { ev.caps++; if (e.carro && !e.carro.ehJogador) ev.capsIA++; }),
      on('poder:usa', (e) => { ev.poder++; if (e.carro && simEm[e.carro.indice] !== G.relogio.quadros) ev.semPermissao++; }),
    ];
    largada();
    const preso = new Float64Array(n), presoMax = new Float64Array(n);
    let passos = 0;
    const seg = simulaAte(() => {
      // todos terminam: a corrida acaba 3 s depois do jogador (js/corrida.js); aqui ela espera o ultimo cruzar a linha
      if (c.jogador.chegou && c.fimEm !== null && !c.carros.every((x) => x.chegou)) c.fimEm = c.t + 1000;
      if (c.carros.every((x) => x.chegou) && c.fimEm > c.t + 5) c.fimEm = c.t;
      for (const x of c.carros) {
        const ef = x.efeitos, livre = !x.chegou && x.noChao && !(ef.rodopio > 0 || ef.gelo > 0 || ef.levantado > 0);
        preso[x.indice] = livre && Math.abs(x.vf) < PARADO ? preso[x.indice] + 1 / 60 : 0;
        if (preso[x.indice] > presoMax[x.indice]) presoMax[x.indice] = preso[x.indice];
      }
      if (++passos % 30 === 0 && !c.carros.every(finito)) nans++;
      return c.estado === 'terminou';
    }, TETO_DA_CORRIDA, 2500);
    for (const d of desl) d();
    const r = c.resultado, chegaram = c.carros.filter((x) => x.chegou).length, est = c.ia.estatisticas;
    nans += c.carros.reduce((a, x) => a + x.nans, 0);
    ok(seg > 0 && chegaram === n, `${def.id} (${carro}): os ${n} carros terminam as 3 voltas (${seg.toFixed(0)} s de simulacao)`);
    const pior = Math.max(...presoMax);
    ok(pior < PRESO_MAX, `${def.id}: ninguem parado/preso mais de ${PRESO_MAX} s (pior ${pior.toFixed(1)} s)`);
    ok(ev.quedas <= n, `${def.id}: quedas raras (${ev.quedas} em ${n * 3} voltas de carro)`);
    ok(ev.semPermissao === 0, `${def.id}: ${ev.poder} poderes usados, todos no passo em que iaDeveUsar disse que da`);
    const ordem = r ? r.classificacao.map((l) => l.indice) : [];
    const inv = inversoes(grade, ordem);
    if (inv > 0) ordensDiferentes++;
    if (ordem.length) tot.vencedores.add(c.carros[ordem[0]].cfg.id);
    mede(`${def.id} chegada (indices da grade, pole = 0)`, ordem.join(' '));
    mede(`${def.id} quedas / batidas no muro (todos)`, `${ev.quedas} / ${ev.muro}`);
    mede(`${def.id} atalhos da IA (entrou / recusou)`, `${est.atalhos} / ${est.atalhosRecusados}`);
    mede(`${def.id} turbo (decisoes da IA / turbo:liga) | capsulas (IA / todas) | poderes`, `${est.turbos} / ${ev.liga} | ${ev.capsIA} / ${ev.caps} | ${ev.poder}`);
    mede(`${def.id} jogador (piloto automatico): posicao e voltas (s)`, `${r ? r.jogador.posicao : '?'}º — ${c.jogador.temposDeVolta.map((x) => x.toFixed(1)).join(' / ')}`);
    tot.quedas += ev.quedas; tot.atalhosIA += est.atalhos; tot.recusados += est.atalhosRecusados; tot.turbosIA += est.turbos; tot.ligaTurbo += ev.ligaIA;
    tot.capsIA += ev.capsIA; tot.capsTodas += ev.caps; tot.poderesIA += ev.poder; tot.semPermissao += ev.semPermissao; tot.muro += ev.muro; tot.inversoes += inv;
    tot.miradas += est.capsulasMiradas;
    if (est.turbos > 0) corridasComTurbo++;
    if (ev.liga > 0) corridasFase4Turbo++;
    if (ev.capsIA > 0) corridasComCapsula++;
    if (ev.poder > 0) corridasComPoder++;
    G.jogo.encerraCorrida();
  }
  const N = PISTAS.length;
  ok(tot.atalhosIA > 0 && tot.recusados > 0, `a IA pega atalho as vezes (${tot.atalhosIA} entradas) e as vezes nao (${tot.recusados} recusas)`);
  ok(corridasComTurbo === N, `a IA usa turbo em todas as corridas (${tot.turbosIA} decisoes)`);
  if (corridasFase4Turbo > 0) ok(tot.ligaTurbo > 0 && corridasFase4Turbo === N, `turbo da fase 4: ${tot.ligaTurbo} turbo:liga dos rivais (em ${corridasFase4Turbo} de ${N} corridas)`);
  else mede('turbo da fase 4 ainda stub (nenhum turbo:liga)', 'pulado');
  if (tot.capsTodas > 0 || tot.miradas > 0) ok(corridasComCapsula === N, `a IA pega capsulas em todas as corridas (${tot.capsIA} capsulas dos rivais; ${tot.capsTodas} de todos)`);
  else mede('capsulas da fase 4 ainda stub (nenhuma capsula na pista)', 'pulado');
  ok(corridasComPoder >= N - 1 && tot.semPermissao === 0, `a IA usa poderes (${tot.poderesIA} no total, em ${corridasComPoder} de ${N} corridas) e nunca sem iaDeveUsar`);
  ok(ordensDiferentes === N && tot.vencedores.size >= 3, `posicoes variam: nenhuma chegada repete a grade (${tot.inversoes} inversoes) e ${tot.vencedores.size} carros diferentes venceram`);
  mede('quedas por volta de carro (10 corridas)', tot.quedas / (N * 8 * 3));
  mede('batidas no muro por volta de carro', tot.muro / (N * 8 * 3));

  // ------------------------------------------------------------------ 5. ritmo: volta solo contra o piloto de referencia
  let piorRazao = 0;
  for (const [k, def] of PISTAS.entries()) {
    const carro = CARROS[k % CARROS.length].id;
    const ref = await solo(G, def.id, carro, { ref: true });
    const ia = await solo(G, def.id, carro, { sem: true });
    const cheia = await solo(G, def.id, carro);
    const razao = ia.volta / ref.volta;
    piorRazao = Math.max(piorRazao, razao);
    mede(`${def.id} (${carro}) volta solo: referencia / IA sem turbo / IA com turbo e atalho (s)`, `${ref.volta.toFixed(1)} / ${ia.volta.toFixed(1)} / ${cheia.volta.toFixed(1)}${cheia.atalhos ? ' (atalho)' : ''}`);
    ok(ia.volta > 0 && razao <= REF_FOLGA && ia.quedas === 0 && cheia.quedas === 0, `${def.id}: volta da IA perto da referencia (${(razao * 100).toFixed(0)}% do tempo dela) e sem cair`);
    G.flags.auto = false;
  }
  mede('pior razao IA / referencia', piorRazao);

  // ------------------------------------------------------------------ 6. casos montados
  {
    // erro humano pela precisao: desvia mais da linha, sem cair e sem perder muito
    const exato = await solo(G, 'gelo', 'dourado', { sem: true, precisao: 1, semCapsula: true });
    const humano = await solo(G, 'gelo', 'dourado', { sem: true, precisao: 0.3, semCapsula: true });
    mede('erro humano: desvio medio da linha com precisao 1 / 0,3 (m)', `${exato.desvio.toFixed(2)} / ${humano.desvio.toFixed(2)}`);
    ok(humano.desvio > exato.desvio + 0.2 && humano.quedas === 0 && humano.volta < exato.volta * 1.08,
      `precisao baixa desvia mais da linha (${humano.desvio.toFixed(2)} m contra ${exato.desvio.toFixed(2)}) sem cair e perdendo pouco (${humano.volta.toFixed(1)} s contra ${exato.volta.toFixed(1)})`);
    G.flags.auto = false;
  }
  const caso = async (semente) => {
    G.save.remove('dda'); G.sorteio.semente(semente);
    const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', voltas: 3, corredores: 6, auto: true });
    largada();
    // todos parados longe, fantasmas; cada caso solta quem precisa
    for (const x of c.carros) { x.fantasma = 1e9; x.colocaNaPista(0, 300 + x.indice * 9, 0, 0, 0); }
    return c;
  };
  {
    // de costas para a pista: manobra e volta a andar para a frente
    const c = await caso(41), j = c.jogador;
    j.colocaNaPista(0, 30, 0, Math.PI * 0.95, 0);
    const seg = simulaAte(() => Math.abs(j.psi) < 0.5 && j.vf > 8, 12);
    ok(seg > 0 && seg < 8, `de costas para a pista: manobra e sai andando para a frente em ${seg.toFixed(1)} s`);
    // de bico no muro, parado: re e sai
    j.colocaNaPista(0, 180, -4.6, -1.25, 0);
    const seg2 = simulaAte(() => j.vf > 8 && Math.abs(j.psi) < 0.5, 12);
    ok(seg2 > 0 && seg2 < 8, `encostado de bico no muro, parado: sai em ${seg2.toFixed(1)} s (re: ${c.ia.estatisticas.re})`);
    G.jogo.encerraCorrida();
  }
  {
    // carro lento na linha: passa pelo lado livre sem bater
    const c = await caso(42), j = c.jogador, lento = c.carros.find((x) => x !== j);
    lento.fantasma = 0; j.fantasma = 0;
    const iaPasso = c.ia.passo.bind(c.ia);
    c.ia.passo = (dt) => { iaPasso(dt); lento.controle.acel = 0.35; lento.controle.freio = 0; lento.controle.direcao = 0; lento.controle.turbo = false; lento.controle.poder = false; j.controle.turbo = false; j.controle.poder = false; };
    const P = c.ia.planos[0];
    lento.colocaNaPista(0, 40, P.d[40], 0, 12);
    j.colocaNaPista(0, 5, P.d[5], 0, 28);
    let bateu = 0;
    const d = on('carro:batida', (e) => { if (e.tipo === 'carro' && ((e.carro === j && e.outro === lento) || (e.carro === lento && e.outro === j))) bateu++; });
    const seg = simulaAte(() => j.s > lento.s + 15, 12);
    d();
    ok(seg > 0 && bateu === 0, `passa o carro lento da frente pelo lado livre sem encostar (${seg.toFixed(1)} s, ${bateu} batidas)`);
    G.jogo.encerraCorrida();
  }
  {
    // poca de oleo na linha: desvia
    const c = await caso(43), j = c.jogador, P = c.ia.planos[0];
    const S = 60, oleo = { tipo: 'oleo', sup: 0, s: S, d: P.d[S], raio: 3.2, comprimento: 0, dono: null };
    const lista = [oleo];
    c.poderes.perigos = () => lista;
    j.colocaNaPista(0, 0, P.d[0], 0, 25);
    let minDist = Infinity;
    const seg = simulaAte(() => { if (Math.abs(j.s - S) < 2.5) minDist = Math.min(minDist, Math.abs(j.d - oleo.d)); return j.s > S + 10; }, 10);
    const precisa = oleo.raio + j.p.largura * 0.5;
    ok(seg > 0 && minDist > precisa, `desvia da poca de oleo na linha (passou a ${minDist.toFixed(1)} m do centro dela; encosta a ${precisa.toFixed(1)})`);
    G.jogo.encerraCorrida();
  }
  {
    // Pulso EMP: sem turbo. A IA ve o efeito pelo carro.modAnterior (js/corrida.js) — com o EMP ligado no mod por 4 s ela nao pede turbo;
    // desligado, volta a pedir na primeira reta
    const c = await caso(45), j = c.jogador;
    j.colocaNaPista(0, 0, 0, 0, 30);
    let emp = true, pediuComEmp = 0, pediuSem = 0;
    const difPasso = c.dificuldade.passo.bind(c.dificuldade);
    c.dificuldade.passo = (dt) => { difPasso(dt); if (emp) j.mod.semTurbo = true; };
    if (j.turbo) j.turbo.carga = 1;
    simulaAte(() => { if (j.controle.turbo) pediuComEmp++; return c.t > 4; }, 6);
    emp = false;
    const t0 = c.t;
    simulaAte(() => { if (j.controle.turbo) pediuSem++; return c.t > t0 + 6; }, 8);
    ok(pediuComEmp === 0 && pediuSem > 0, `Pulso EMP (mod.semTurbo no passo anterior): nenhum pedido de turbo em 4 s; sem ele, ${pediuSem} passos de turbo`);
    G.jogo.encerraCorrida();
  }
  {
    // poder: com a heuristica dizendo nao, nenhum disparo; dizendo sim, dispara (com a recarga pronta)
    for (const resposta of [false, true]) {
      G.save.remove('dda'); G.sorteio.semente(44);
      const c = await corridaDeTeste({ pista: 'orla', carro: 'vulcao', voltas: 1, corredores: 8, auto: true });
      c.poderes.iaDeveUsar = (x) => resposta && (typeof c.poderes.podeUsar !== 'function' || c.poderes.podeUsar(x));
      let usos = 0;
      const d = on('poder:usa', () => usos++);
      largada();
      simulaAte(() => c.t > 40, 60);
      d();
      if (!resposta) ok(usos === 0, `iaDeveUsar sempre falso: nenhum poder em 40 s (${usos})`);
      else ok(usos >= 8, `iaDeveUsar sempre verdadeiro: a IA usa (${usos} poderes em 40 s, a recarga manda)`);
      G.jogo.encerraCorrida();
    }
    G.flags.auto = false;
  }

  ok(nans === 0, 'nenhum numero invalido nos carros (a guarda contra NaN da fisica nunca agiu)');
  G.flags.auto = false;
});
