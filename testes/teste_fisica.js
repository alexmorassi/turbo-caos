// SUITE DA FISICA (fase 2): o carro de arcade de js/carro.js e as colisoes de js/colisoes.js medidos na pista de teste (rampa com vao,
// loop magnetico, atalho de terra) e num oval de retas longas feito aqui. Cada bloco poe o jogador onde quer (colocaNaPista), deixa os
// rivais fantasmas (nao batem em ninguem) e dirige com o PILOTO desta suite — curvatura da pista adiante + PD em d e no rumo — porque o
// piloto automatico da fundacao (js/ia.js) so mira o centro e zigue-zagueia com fisica de rumo de verdade.
//
// O que prova (pedido da fase 2): acelera ate a vMax no tempo da tabela; curva exige estercar (sem estercar bate no muro de fora);
// muro devolve com restituicao baixa e emite batida; rapido passa o vao e pousa, lento cai e volta DEPOIS do buraco; o loop gruda
// (sempre no chao, cima.y < -0,9 no topo, ate devagar); atalho entra pela boca e sai na principal; terra segura a velocidade; batida
// empurra o mais leve; derrapagem vira mais fechado; mesmos comandos = mesma corrida bit a bit; rodopio, gelo, tornado e Troca-Troca.
import { suite, ok, perto, mede, quadros, segura, solta, aperta, apagaProgresso, corridaDeTeste, largada, simulaAte } from './harness.js';
import { FISICA } from '../config/fisica.js';
import { CARROS } from '../config/carros.js';
import { MARCA } from '../js/pista.js';
import { parametrosDoCarro } from '../js/carro.js';
import { colide } from '../js/colisoes.js';
import { on } from '../js/eventos.js';
import PISTA_TESTE from '../js/pistas/teste.js';

const RIVAIS = ['dourado', 'lagartixa', 'picole', 'kombosa', 'jatinho', 'faisca', 'voador', 'tubarao'];

/** Oval de retas de ~900 m (a reta da pista de teste nao da para medir a vMax). Mesmo tema da pista de teste (a fase 3 pode exigir). */
const OVAL = {
  id: 'oval_fisica', nome: 'Oval da física', ordem: 0, largura: 16,
  pontos: [[0, 0, 0], [0, 0, 300], [0, 0, 600], [0, 0, 900], [60, 0, 1000], [160, 0, 1000], [220, 0, 900], [220, 0, 600], [220, 0, 300], [220, 0, 0], [160, 0, -100], [60, 0, -100]],
  trechos: [], tema: PISTA_TESTE.tema,
};

/** Eventos do jogador, contados (o ouvinte e um so para a suite toda; `alvo` diz de quem). */
const ev = { alvo: null, batidas: [], decolou: [], pouso: [], queda: 0, volta: 0, drift: [] };
function zeraEventos(c) { ev.alvo = c; ev.batidas = []; ev.decolou = []; ev.pouso = []; ev.queda = 0; ev.volta = 0; ev.drift = []; }

/** Corrida nova, ja correndo, com os rivais fantasmas (a suite mede um carro de cada vez). */
async function nova(G, op = {}) {
  G.sorteio.semente(op.semente || 77);
  const c = await corridaDeTeste({ pista: op.pista || 'teste', def: op.def, carro: op.carro || 'vulcao', corredores: 6, voltas: 5, rivais: op.rivais || RIVAIS });
  largada();
  if (op.isola !== false) for (const x of c.carros) if (x !== c.jogador) x.fantasma = 1e9;
  zeraEventos(c.jogador);
  return c;
}

/** PILOTO DA SUITE: segue a curvatura da pista adiante e corrige d e rumo (PD). Devolve a direcao -1..1. */
function piloto(c, alvoD = 0) {
  const sup = c.corrida.pista.sup(c.sup), v = Math.max(2, Math.abs(c.vf));
  const kh = sup.khEm(c.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (c.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (c.d - alvoD)));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - c.psi)) / (v / raio)));
}

/** Dirige `seg` segundos com o piloto. `ate()` para antes; `cada()` roda depois de cada passo. Devolve o tempo gasto (s). */
function dirige(c, seg, { alvoD = 0, acel = 1, cada = null, ate = null, semPiloto = false, direcao = 0 } = {}) {
  const j = c.jogador, n = Math.round(seg * 60);
  for (let k = 0; k < n; k++) {
    segura('acel', acel);
    segura('direcao', semPiloto ? direcao : piloto(j, typeof alvoD === 'function' ? alvoD() : alvoD));
    quadros(1);
    if (cada) cada(k);
    if (ate && ate()) return (k + 1) / 60;
  }
  return n / 60;
}

function finito(c) { return Number.isFinite(c.pos.x + c.pos.y + c.pos.z + c.vel.x + c.vel.y + c.vel.z + c.s + c.d + c.psi + c.vf + c.vr); }
const embrulha = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
/** Diferenca de s numa tira fechada, entre -L/2 e L/2. */
const embrulhaS = (sup, ds) => { const L = sup.comprimento; ds = ((ds % L) + L) % L; return ds > L / 2 ? ds - L : ds; };

suite('fisica', async (G) => {
  apagaProgresso();
  // o piloto desta suite JA e um controlador (le psi, d e a curva): sem a ajuda na direcao por cima (js/assistencia.js) e sem o freio
  // ao soltar o acelerador (js/entrada.js) — a fisica crua
  G.entrada.ajuda = false; G.entrada.freioAoSoltar = false;
  on('carro:batida', (e) => { if (e.carro === ev.alvo) ev.batidas.push({ tipo: e.tipo, forca: e.forca, outro: e.outro, s: e.carro.s }); });
  on('carro:decolou', (e) => { if (e.carro === ev.alvo) ev.decolou.push({ s: e.carro.s, t: G.relogio.t, v: e.carro.velocidade }); });
  on('carro:pouso', (e) => { if (e.carro === ev.alvo) ev.pouso.push({ s: e.carro.s, t: G.relogio.t, forca: e.forca }); });
  on('carro:queda', (e) => { if (e.carro === ev.alvo) ev.queda++; });
  on('carro:volta_pista', (e) => { if (e.carro === ev.alvo) ev.volta++; });
  on('carro:drift', (e) => { if (e.carro === ev.alvo) ev.drift.push(e.ligado); });
  let nans = 0;

  // ------------------------------------------------------------------ 1. aceleracao e velocidade maxima (oval, reta de 900 m)
  {
    const c = await nova(G, { def: OVAL, carro: 'vulcao' });
    const j = c.jogador, p = parametrosDoCarro(j.cfg);
    j.colocaNaPista(0, 5, 0, 0, 0);
    let t95 = -1, t = 0;
    dirige(c, 14, { cada: () => { t += 1 / 60; if (t95 < 0 && j.vf >= 0.95 * p.vMax) t95 = t; } });
    mede('vulcao: vMax (m/s)', p.vMax);
    mede('vulcao: 0 -> 95% (s)', t95);
    perto(t95, p.tempoAte95, 0.3, `0 a 95% da vMax no tempo da tabela (aceleracao ${j.cfg.atributos.aceleracao})`);
    perto(j.vf, p.vMax, p.vMax * 0.015, 'chega na vMax da tabela e para nela (motor A (1 - u2))');
    ok(p.vMax >= 30 && p.vMax <= 42 && t95 >= 3.7 && t95 <= 6.3, 'vMax 30-42 m/s e 0 -> vMax em 4-6 s (pedido)');
    nans += j.nans;
    // a tabela inteira: todo carro do config/carros.js dentro da faixa do pedido
    const ps = CARROS.map((cfg) => parametrosDoCarro(cfg));
    ok(ps.every((x) => x.vMax >= 30 && x.vMax <= 42 && x.tempoAte95 >= 4 && x.tempoAte95 <= 6 && x.raioRef >= 18 && x.raioRef <= 30), `os ${CARROS.length} carros dentro da faixa do pedido`);
    // derrapagem: virando tudo a ~30 m/s, derrapar vira mais fechado e atravessa o carro
    const giro = (drift) => {
      // comeca encostado na esquerda: virando tudo para a direita por 0,6 s ainda nao chega no muro da direita
      j.colocaNaPista(0, 250, -6.5, 0, 30);
      let soma = 0, n = 0, angMax = 0;
      segura('drift', 0);
      dirige(c, 0.1, { semPiloto: true, direcao: 0 });
      segura('drift', drift ? 1 : 0);
      dirige(c, 0.6, { semPiloto: true, direcao: 1, cada: (k) => { if (k >= 12) { soma += j.giro; n++; angMax = Math.max(angMax, Math.abs(Math.atan2(j.vr, j.vf))); } } });
      solta('drift');
      dirige(c, 0.1, { semPiloto: true, direcao: 0 });                // soltou: o passo seguinte desliga a derrapagem
      return { w: soma / Math.max(1, n), ang: angMax };
    };
    zeraEventos(j);
    const normal = giro(false), derrapa = giro(true);
    mede('giro com a direcao toda a ~30 m/s (rad/s)', normal.w);
    mede('giro derrapando (rad/s)', derrapa.w);
    mede('angulo de derrapagem (graus)', derrapa.ang * 57.3);
    ok(derrapa.w > normal.w * 1.25, 'derrapando vira mais fechado que sem derrapar');
    ok(derrapa.ang > 0.25 && derrapa.ang < FISICA.DRIFT_ANGULO_MAX / 57.3 + 0.02, `derrapagem atravessa o carro (${(derrapa.ang * 57.3).toFixed(0)} graus) sem virar rodopio`);
    ok(ev.drift.includes(true) && ev.drift.includes(false), 'carro:drift liga e desliga');
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 2. curva exige estercar (pista de teste, curva a direita depois do salto)
  {
    const c = await nova(G, {});
    const j = c.jogador;
    j.colocaNaPista(0, 172, 0, 0, 30);
    dirige(c, 3, { semPiloto: true, direcao: 0, ate: () => ev.batidas.some((b) => b.tipo === 'muro') });
    const b = ev.batidas.find((x) => x.tipo === 'muro');
    ok(!!b, 'sem esterçar o carro sai reto e bate no muro de fora da curva');
    ok(b && j.d < 0, 'bateu no muro da ESQUERDA (a curva e para a direita)');
    zeraEventos(j);
    j.colocaNaPista(0, 172, 0, 0, 30);
    let maxD = 0;
    dirige(c, 3, { cada: () => { maxD = Math.max(maxD, Math.abs(j.d)); } });
    ok(ev.batidas.length === 0 && maxD < 4.5, `esterçando faz a curva sem encostar no muro (|d| max ${maxD.toFixed(1)} m)`);
    // a dica da projecao anda com o carro no chao (parada no ultimo teleporte, a decolagem projetava noutro trecho — bug achado na selva)
    ok(j.i === c.pista.principal.idx(Math.round(j.s / c.pista.principal.ds)), `carro.i acompanha o s no chao (i ${j.i}, s ${j.s.toFixed(1)})`);
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 3. muro devolve, perde um pouco e emite batida
  {
    const c = await nova(G, {});
    const j = c.jogador;
    j.colocaNaPista(0, 15, 0, 0.4, 25);
    const sup = c.pista.principal;
    dirige(c, 2, { semPiloto: true, direcao: 0, acel: 0, ate: () => ev.batidas.length > 0 });
    const b = ev.batidas[0];
    ok(!!b && b.tipo === 'muro', 'bater no muro emite carro:batida tipo muro');
    perto(b ? b.forca : 0, 25 * Math.sin(0.4), 2.5, 'forca da batida = velocidade contra o muro (m/s)');
    const VR = j.vf * Math.sin(j.psi) + j.vr * Math.cos(j.psi);
    const lim = sup.larguraEm(j.s) * 0.5 - j._meiaLarguraNaPista();
    ok(VR <= 0.01 && j.d <= lim + 1e-6, 'devolvido: indo para dentro da pista (ou ao longo do muro), nunca atravessando');
    ok(j.vf > 25 * 0.6, `perde so um pouco de velocidade (${j.vf.toFixed(1)} m/s de 25)`);
    dirige(c, 0.4, { semPiloto: true, direcao: 0, acel: 0 });
    ok(Math.abs(j.psi) < 0.12, `o rumo endireita ao longo do muro (psi ${(j.psi * 57.3).toFixed(1)} graus)`);
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 4. rampa: rapido passa o vao e pousa; lento cai e volta depois do buraco
  {
    const c = await nova(G, {});
    const j = c.jogador, P = c.pista.principal;
    let vaoFim = 0, vaoIni = -1;
    for (let i = 0; i < 300; i++) if (P.marcas[i] & MARCA.VAO) { if (vaoIni < 0) vaoIni = i * P.ds; vaoFim = i * P.ds; }
    j.colocaNaPista(0, 40, 0, 0, 30);
    dirige(c, 6, { ate: () => ev.pouso.length > 0 && j.noChao });
    const d0 = ev.decolou[0], p0 = ev.pouso[0];
    ok(!!d0 && Math.abs(d0.s - 118) < 3, 'a crista (lanca) lanca o carro');
    ok(!!p0 && p0.s > vaoFim, `rapido (${d0 ? d0.v.toFixed(0) : '?'} m/s) passa o vao e pousa depois dele (s ${p0 ? p0.s.toFixed(0) : '?'} > ${vaoFim.toFixed(0)})`);
    ok(ev.queda === 0, 'rapido nao cai');
    if (d0 && p0) { mede('salto: distancia (m)', p0.s - d0.s); mede('salto: tempo no ar (s)', p0.t - d0.t); mede('salto: impacto (m/s)', p0.forca); }
    // lento
    zeraEventos(j);
    j.colocaNaPista(0, 108, 0, 0, 12);
    dirige(c, 4, { acel: 0, ate: () => ev.volta > 0 });
    ok(ev.decolou.length > 0, 'lento tambem sai da crista');
    ok(ev.queda === 1 && ev.volta === 1, 'lento (<= 12 m/s) cai no vao: carro:queda e carro:volta_pista');
    ok(j.noChao && j.sup === 0 && Math.abs(j.d) < 1e-6 && Math.abs(j.vf - FISICA.VEL_RESPAWN) < 0.5, 'volta no chao, no centro da pista, a ~12 m/s');
    ok(j.s > vaoFim && j.s < vaoFim + 30, `volta DEPOIS do buraco (s ${j.s.toFixed(0)}), nao antes da rampa (laco de queda)`);
    ok(j.fantasma > 1.3, 'volta fantasma (1,5 s sem colisao)');
    const outro = c.carros.find((x) => x !== j);
    outro.fantasma = 0; outro.colocaNaPista(0, j.s, j.d, 0, 0);
    const dAntes = outro.d; colide(c);
    ok(outro.d === dAntes, 'fantasma atravessa os outros (colide ignora)');
    outro.fantasma = 1e9; outro.colocaNaPista(0, 700, 0, 0, 0);
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 5. loop: gruda o loop inteiro, de cabeca para baixo no topo, ate devagar
  {
    const c = await nova(G, {});
    const j = c.jogador, P = c.pista.principal;
    let magIni = -1, magFim = 0;
    for (let i = 0; i < P.n; i++) if (P.marcas[i] & MARCA.MAGNETICO) { if (magIni < 0) magIni = i * P.ds; magFim = i * P.ds; }
    for (const [v0, acel, nome] of [[30, 1, 'embalado'], [8, 0, 'devagar e sem acelerar']]) {
      zeraEventos(j);
      j.colocaNaPista(0, magIni - 12, 0, 0, v0);
      let noAr = 0, cimaMin = 1, vMin = 99, dentro = 0;
      dirige(c, 8, {
        acel,
        cada: () => { if (j.sup === 0 && j.s > magIni && j.s < magFim) { dentro++; if (!j.noChao || Math.abs(j.h) > 1e-6) noAr++; cimaMin = Math.min(cimaMin, j.cima.y); vMin = Math.min(vMin, j.vf); } },
        ate: () => j.s > magFim + 10 && j.s < magFim + 60,
      });
      ok(dentro > 60 && noAr === 0, `loop ${nome}: no chao (h = 0) o loop inteiro (${dentro} passos dentro)`);
      ok(cimaMin < -0.9, `loop ${nome}: no topo carro.cima.y = ${cimaMin.toFixed(2)} (< -0,9)`);
      ok(vMin >= FISICA.VEL_MIN_NO_LOOP - 1e-6, `loop ${nome}: velocidade minima garantida (${vMin.toFixed(1)} m/s)`);
      ok(ev.queda === 0 && j.s > magFim, `loop ${nome}: completa e sai do outro lado`);
    }
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 6. atalho: entra pela boca, terra segura, sai na principal
  {
    const c = await nova(G, {});
    const j = c.jogador, at = c.pista.atalhos[0];
    j.colocaNaPista(0, at.sEntrada - 15, 3, 0, 22);
    let entrou = false, saiu = false, sSaida = -1, maxTerra = 0, vMaxCarro = j.p.vMax;
    dirige(c, 20, {
      alvoD: () => (j.sup === 0 && !entrou ? 11 : 0),
      cada: () => {
        if (j.sup === at.sup.id) entrou = true;
        if (entrou && j.sup === 0 && !saiu) { saiu = true; sSaida = j.s; }
        if (j.sup === at.sup.id && (at.sup.marcasEm(j.s) & MARCA.TERRA) && j.s > at.sup.comprimento * 0.4) maxTerra = Math.max(maxTerra, j.vf);
      },
      ate: () => saiu && j.s > sSaida + 5,
    });
    ok(entrou, 'passando da borda na boca, o carro entra no atalho');
    ok(saiu && Math.abs(embrulhaS(c.pista.principal, sSaida - at.sSaida)) < 20, `sai na principal perto do fim do atalho (s ${sSaida.toFixed(0)} ~ ${at.sSaida.toFixed(0)})`);
    ok(maxTerra > 0 && maxTerra <= vMaxCarro * FISICA.TERRA_VEL + 0.5, `terra limita a velocidade (${maxTerra.toFixed(1)} <= ${(vMaxCarro * FISICA.TERRA_VEL).toFixed(1)} m/s)`);
    ok(ev.queda === 0, 'nao cai no atalho');
    // seguindo reto pelo meio do atalho (sem mirar a principal), o funil leva para a principal no fim
    zeraEventos(j);
    j.colocaNaPista(at.sup.id, at.sup.comprimento - 40, 0, 0, 18);
    let voltou = false;
    dirige(c, 4, { semPiloto: false, alvoD: 0, ate: () => (voltou = j.sup === 0) });
    ok(voltou && Math.abs(j.d) <= c.pista.principal.larguraEm(j.s) * 0.5, 'quem segue pelo meio do atalho tambem volta para a principal (funil)');
    // entrar embalado na terra segura forte (comeca na entrada da terra: em 1 s a ~30 m/s ainda esta dentro dela)
    let sTerra = 0;
    for (let s = 0; s < at.sup.comprimento; s += 1) if (at.sup.marcasEm(s) & MARCA.TERRA) { sTerra = s; break; }
    j.colocaNaPista(at.sup.id, sTerra + 1, 0, 0, vMaxCarro);
    dirige(c, 1.0);
    ok((at.sup.marcasEm(j.s) & MARCA.TERRA) && j.sup === at.sup.id, 'ainda na terra depois de 1 s');
    ok(Math.hypot(j.vf, j.vr) <= vMaxCarro * FISICA.TERRA_VEL + 0.5, `entrou na terra a ${vMaxCarro} m/s: em 1 s esta a ${Math.hypot(j.vf, j.vr).toFixed(1)}`);
    nans += j.nans;
  }

  // ------------------------------------------------------------------ 7. colisao: o mais leve vai mais longe
  {
    const c = await nova(G, { carro: 'tubarao', rivais: ['jatinho', 'dourado', 'lagartixa', 'picole', 'kombosa'] });
    const pesado = c.jogador, leve = c.carros.find((x) => x.cfg.id === 'jatinho');
    ok(!!leve && pesado.p.massa > leve.p.massa * 1.5, `tubarao (massa ${pesado.p.massa}) x jatinho (${leve && leve.p.massa})`);
    leve.fantasma = 0;
    // encaixados 30 cm um no outro pelas medidas do config (o tubarao e estreito e curto: 3,34 x 1,57 m)
    const lado = (pesado.p.largura + leve.p.largura) / 2 - 0.3, comp = (pesado.p.comprimento + leve.p.comprimento) / 2 - 0.3;
    pesado.colocaNaPista(0, 30, -lado / 2, 0, 20);
    leve.colocaNaPista(0, 30, lado / 2, 0, 20);
    let batida = null;
    const desliga = on('carro:batida', (e) => { if (e.carro === leve && e.tipo === 'carro') batida = e; });
    const dP = pesado.d, dL = leve.d;
    colide(c);
    const movP = Math.abs(pesado.d - dP), movL = Math.abs(leve.d - dL);
    ok(movL > movP * 1.5, `de lado: o leve e empurrado mais (${movL.toFixed(2)} m x ${movP.toFixed(2)} m)`);
    const vlP = pesado.vf * Math.sin(pesado.psi) + pesado.vr * Math.cos(pesado.psi), vlL = leve.vf * Math.sin(leve.psi) + leve.vr * Math.cos(leve.psi);
    ok(vlL > 0 && vlP < 0 && Math.abs(vlL) > Math.abs(vlP) * 1.5, `cada um para o seu lado, o leve mais rapido (${vlL.toFixed(1)} x ${vlP.toFixed(1)} m/s)`);
    // de traseira: o de tras (mais rapido) perde, o da frente ganha
    pesado.colocaNaPista(0, 60, 0, 0, 25);
    leve.colocaNaPista(0, 60 + comp, 0, 0, 15);
    colide(c);
    ok(leve.vf > 15 && pesado.vf < 25 && leve.s > 60 + comp, `de traseira: o da frente ganha (${leve.vf.toFixed(1)}), o de tras perde (${pesado.vf.toFixed(1)})`);
    // batida forte emite (a de lado acima foi de 0 m/s de aproximacao: so encostou). Antes, longe um do outro por 0,5 s: o mesmo par so
    // emite de novo depois de COLISAO_INTERVALO
    pesado.colocaNaPista(0, 300, 0, 0, 0); leve.colocaNaPista(0, 500, 0, 0, 0);
    quadros(30);
    batida = null;
    pesado.colocaNaPista(0, 100, -lado * 0.6, 0.3, 25);
    leve.colocaNaPista(0, 100.5, lado * 0.6, -0.3, 25);
    quadros(1);
    ok(!!batida && batida.outro === pesado && batida.forca > 3, `batida entre carros emite carro:batida tipo carro (${batida ? batida.forca.toFixed(1) : 0} m/s)`);
    desliga();
    // no ar: esfera no mundo
    leve.colocaNaPista(0, 140, 0, 0, 0); pesado.colocaNaPista(0, 140.5, 0.5, 0, 0);
    leve._decola(false);
    const posAntes = leve.pos.clone();
    colide(c);
    ok(leve.pos.distanceTo(posAntes) > 0.05, 'no ar (ou em tiras diferentes) a colisao e uma esfera no mundo');
    leve.fantasma = 1e9; leve.colocaNaPista(0, 700, 0, 0, 0);
    nans += pesado.nans + leve.nans;
  }

  // ------------------------------------------------------------------ 8. efeitos dos poderes
  {
    const c = await nova(G, {});
    const j = c.jogador;
    // rodopio: gira voltas inteiras, sem controle, perde velocidade
    j.colocaNaPista(0, 10, 0, 0, 25);
    const psi0 = j.psi;
    j.rodopia(1.4);
    let giro = 0, ant = j.psi, volMax = 0;
    let vFim = 0;
    dirige(c, 1.4, { semPiloto: true, direcao: 1, cada: () => { giro += Math.abs(embrulha(j.psi - ant)); ant = j.psi; volMax = Math.max(volMax, Math.abs(j.volante)); vFim = j.vf; } });
    ok(giro > FISICA.RODOPIO_VOLTAS * Math.PI * 2 * 0.9, `rodopio: ${(giro / (Math.PI * 2)).toFixed(1)} voltas`);
    ok(volMax < 0.05, 'rodopio: sem controle (a direcao apertada nao vale)');
    ok(vFim < 25 * 0.45, `rodopio: perde velocidade (${vFim.toFixed(1)} de 25 m/s)`);
    ok(Math.abs(embrulha(j.psi - psi0)) < 0.35 && j.efeitos.rodopio < 1e-9, 'rodopio: termina olhando para onde ia');
    // gelo: para forte, toques no PODER encurtam
    j.colocaNaPista(0, 40, 0, 0, 30);
    j.congela(1.5);
    dirige(c, 1.0, { semPiloto: true, direcao: 1 });
    ok(j.vf < 3 && j.efeitos.gelo > 0, `gelo: parado (${j.vf.toFixed(1)} m/s em 1 s) e ainda congelado`);
    j.congela(3);
    const g0 = j.efeitos.gelo;
    for (let k = 0; k < 4; k++) { aperta('poder'); quadros(1); }
    const esperado = g0 - 8 / 60 - 4 * FISICA.GELO_POR_TOQUE;
    perto(j.efeitos.gelo, esperado, 0.02, 'gelo: 4 toques no PODER tiram 4 x GELO_POR_TOQUE');
    j.quebraGelo(0.5); j.quebraGelo(0.5);
    perto(j.efeitos.gelo, esperado - 0.5, 0.02, 'quebraGelo vale uma vez por passo (fisica e poderes nao contam dobrado)');
    j.efeitos.gelo = 0;
    // tornado: sobe ~3 m girando e cai na pista
    zeraEventos(j);
    j.colocaNaPista(0, 30, 2, 0, 20);
    j.levanta(1.3);
    let hMax = 0, foraDoChao = 0;
    dirige(c, 1.6, { semPiloto: true, direcao: 0, cada: () => { hMax = Math.max(hMax, j.h); if (!j.noChao) foraDoChao++; }, ate: () => j.noChao && j.efeitos.levantado === 0 });
    perto(hMax, FISICA.TORNADO_ALTURA, 0.15, 'tornado: sobe ~3 m');
    ok(foraDoChao > 60 && j.noChao && ev.pouso.length === 1, 'tornado: fica no ar ~1,3 s e pousa (carro:pouso)');
    ok(Math.abs(j.d) < c.pista.principal.larguraEm(j.s) * 0.5, 'tornado: cai dentro da pista');
    // empurra
    j.colocaNaPista(0, 60, 0, 0, 10);
    j.empurra(5, 1);
    ok(Math.abs(j.vf - 15) < 1e-9 && Math.abs(j.vr - 1) < 1e-9, 'empurra(dvf, dvr) soma no referencial do carro');
    // Troca-Troca
    const o = c.carros.find((x) => x !== j);
    j.colocaNaPista(0, 200, -2, 0.1, 20); o.colocaNaPista(0, 260, 3, -0.1, 25);
    const eJ = j.estadoDePista(), eO = o.estadoDePista(), posJ = j.pos.clone(), posO = o.pos.clone();
    j.aplicaEstadoDePista(eO); o.aplicaEstadoDePista(eJ);
    ok(Math.abs(j.s - eO.s) < 1e-9 && j.d === eO.d && Math.abs(o.s - eJ.s) < 1e-9 && o.d === eJ.d, 'estadoDePista/aplicaEstadoDePista trocam os lugares');
    ok(j.pos.distanceTo(posO) < 1e-3 && o.pos.distanceTo(posJ) < 1e-3 && j.vf === 20 && o.vf === 25, 'cada um leva a propria velocidade para o lugar novo');
    nans += j.nans + o.nans;
  }

  // ------------------------------------------------------------------ 9. determinismo: mesmos comandos, mesma corrida (bit a bit)
  {
    const roda = async () => {
      const c = await nova(G, { isola: false, semente: 4242 });
      const j = c.jogador;
      for (let k = 0; k < 600; k++) {
        segura('acel', k % 97 < 80 ? 1 : 0);
        segura('direcao', piloto(j) + 0.3 * Math.sin(k * 0.05));
        segura('drift', k % 211 > 180 ? 1 : 0);
        segura('freio', k % 307 > 296 ? 1 : 0);
        quadros(1);
      }
      solta('drift'); solta('freio');
      return c.carros.map((x) => [x.sup, x.s, x.d, x.psi, x.vf, x.vr, x.h]);
    };
    const a = await roda(), b = await roda();
    const iguais = a.length === b.length && a.every((linha, i) => linha.every((v, k) => v === b[i][k]));
    ok(iguais, 'mesmos comandos por 600 passos, duas corridas: s/d/psi/vf de todos os carros iguais bit a bit');
    ok(a.every((l) => l.every(Number.isFinite)), 'nenhum numero invalido');
  }

  // ------------------------------------------------------------------ 10. corrida inteira no piloto automatico da fundacao (stub da IA)
  {
    G.sorteio.semente(99);
    const c = await corridaDeTeste({ pista: 'teste', voltas: 1, corredores: 6, auto: true, rivais: RIVAIS });
    largada();
    let fora = 0;
    const seg = simulaAte(() => {
      for (const x of c.carros) { if (!finito(x)) fora += 1000; if (x.noChao && Math.abs(x.d) > c.pista.sup(x.sup).larguraEm(x.s) * 0.5 + 0.01) fora++; }
      return c.estado === 'terminou';
    }, 300);
    ok(seg > 0, `corrida de 1 volta no piloto automatico da fundacao termina (${seg.toFixed(1)} s)`);
    ok(fora === 0, 'nenhum carro no chao fora da largura da pista, nenhum numero invalido');
    mede('corrida stub: tempo (s)', seg);
    mede('corrida stub: quedas (todos)', c.carros.reduce((a, x) => a + x.quedas, 0));
    nans += c.carros.reduce((a, x) => a + x.nans, 0);
    G.flags.auto = false;
  }

  ok(nans === 0, 'a guarda contra NaN nunca precisou agir');
  G.jogo.encerraCorrida();
});
