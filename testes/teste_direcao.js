// SUITE DA AJUDA NA DIRECAO DO JOGADOR (js/assistencia.js, 30/10/2026). O Morassi: "o controle para virar o carro esta muito sensivel,
// o carro esta virando demais e o jogador fica andando em zigue-zague. Nem crianca nem adulto estao conseguindo se manter na pista."
// Mede o PROBLEMA e a CORRECAO no mesmo carro (o Vulcao, o padrao: controle 2, o que menos vira) com a ajuda desligada (a fisica crua
// de antes) e ligada:
//   1. SOLTO, UMA VOLTA: segurando o acelerador e sem tocar na direcao, em TODAS as pistas — quantas batidas no muro e quedas;
//   2. TROCA DE FAIXA: um toque para o lado e solta — o carro fica paralelo na faixa nova ou continua torto ate o muro;
//   3. A "CRIANCA": um piloto de gente (ve onde o carro esta com ATRASO DE REACAO e arrasta o polegar para o meio — mais longe, mais
//      arrasto —, sem olhar o rumo: ninguem le o angulo do carro numa tela de celular) numa reta comprida. E o zigue-zague do pedido;
//   4. o dedo continua mandando: devagar nao ha ajuda, virar tudo continua possivel, derrapando e atravessado a ajuda sai;
//   5. SOLTOU O ACELERADOR, PERDE VELOCIDADE (30/10/2026: o FREIO saiu da tela) — e parado nao vira re.
// Os rivais ficam parados longe (chegou = true) e sem capsulas: a medida e do carro do jogador. O jogador e dirigido pela ENTRADA
// (segura/solta), o mesmo caminho do dedo: js/entrada.js aplicaNoCarro -> direcaoAssistida / pedaisAssistidos.
import { suite, ok, mede, quadros, segura, solta, apagaProgresso, corridaDeTeste, largada, entradaDeVolta } from './harness.js';
import { FISICA } from '../config/fisica.js';
import { PISTAS } from '../config/pistas.js';
import { on } from '../js/eventos.js';
import { direcaoAssistida, tetoDaCurva } from '../js/assistencia.js';
import PISTA_TESTE from '../js/pistas/teste.js';
import { Entrada } from '../js/entrada.js';

const DT = 1 / 60;
const RIVAIS = ['dourado', 'lagartixa', 'picole', 'kombosa', 'jatinho'];
/** Oval de retas de 900 m (o mesmo da suite do turbo): a reta comprida da "crianca". */
const OVAL = {
  id: 'oval_direcao', nome: 'Oval da direção', ordem: 0, largura: 14,
  pontos: [[0, 0, 0], [0, 0, 300], [0, 0, 600], [0, 0, 900], [60, 0, 1000], [160, 0, 1000], [220, 0, 900], [220, 0, 600], [220, 0, 300], [220, 0, 0], [160, 0, -100], [60, 0, -100]],
  trechos: [], tema: PISTA_TESTE.tema,
};
/** No maximo isto de batidas no muro numa volta SOLTA com a ajuda (as que sobram sao pousos de salto em curva, de proposito). */
const BATIDAS_POR_VOLTA = 2;

let batidas = 0, quedas = 0, jogador = null;

async function nova(G, { pista, def } = {}) {
  G.sorteio.semente(17);
  const c = await corridaDeTeste({ pista, def, carro: 'vulcao', corredores: 6, voltas: 9, rivais: RIVAIS });
  largada();
  c.ia.passo = () => { for (const x of c.carros) if (x !== c.jogador) { x.controle.acel = 0; x.controle.freio = 1; x.controle.turbo = false; x.controle.poder = false; x.controle.direcao = 0; } };
  c.dificuldade.passo = () => {};
  c.carros.forEach((x, k) => { if (x !== c.jogador) { x.chegou = true; x.fantasma = 1e9; x.colocaNaPista(0, 900 + k * 25, 0, 0, 0); } });
  for (const x of c.capsulas.lista) { x.ativa = false; x.espera = 1e9; }   // sem turbo de capsula no meio da medida
  jogador = c.jogador; batidas = 0; quedas = 0;
  return c;
}

/** Folga ate o muro (m): meia largura da pista menos |d| menos a meia largura do carro atravessado. */
function folga(c, j) { return c.pista.sup(j.sup).larguraEm(j.s) * 0.5 - Math.abs(j.d) - j._meiaLarguraNaPista(); }

/** Dirige `n` passos com o DEDO em `piloto(k)` (-1..1) e o acelerador em `acel`. */
function dirige(n, piloto, acel = 1) {
  for (let k = 0; k < n; k++) { segura('acel', acel); segura('direcao', piloto(k)); quadros(1); }
}

suite('direcao', async (G) => {
  apagaProgresso();
  on('carro:batida', (e) => { if (e.carro === jogador && e.tipo === 'muro') batidas++; });
  on('carro:queda', (e) => { if (e.carro === jogador) quedas++; });
  const e = G.entrada;

  // ============================================================================ 1. SOLTO, UMA VOLTA, em todas as pistas
  {
    const ruins = [];
    let semAjuda = 0;
    for (const def of PISTAS) {
      const medida = {};
      // sem a ajuda so em duas (o "antes": a conta e cara e o resultado e sempre o mesmo — bate em toda curva)
      for (const ajuda of def === PISTAS[0] || def === PISTAS[5] ? [false, true] : [true]) {
        const c = await nova(G, { pista: def.id });
        e.ajuda = ajuda;
        const j = c.jogador, L = c.pista.principal.comprimento, p0 = j.progresso;
        let t = 0;
        while (t < 90 && j.progresso - p0 < L) { dirige(1, () => 0); t += DT; }
        medida[ajuda] = { batidas, quedas, t, volta: (j.progresso - p0) / L };
        if (!ajuda) semAjuda += batidas;
      }
      const m = medida.true;
      mede(`${def.id}: uma volta SOLTA (só o acelerador)`, `com a ajuda ${m.batidas} batidas e ${m.quedas} quedas em ${m.t.toFixed(0)} s` +
        (medida.false ? ` | sem a ajuda ${medida.false.batidas} batidas e ${medida.false.quedas} quedas em ${medida.false.t.toFixed(0)} s` : ''));
      if (!(m.volta >= 0.999 && m.batidas <= BATIDAS_POR_VOLTA && m.quedas === 0)) ruins.push(`${def.id} (${m.batidas} batidas, ${m.quedas} quedas)`);
    }
    ok(ruins.length === 0, `SOLTO, O CARRO SEGUE A ESTRADA: a volta inteira em todas as pistas com no máximo ${BATIDAS_POR_VOLTA} batidas e nenhuma queda` + (ruins.length ? ' — falhou: ' + ruins.join(', ') : ''));
    ok(semAjuda >= 8, `sem a ajuda (o de antes) o carro solto batia em toda curva (${semAjuda} batidas em 2 voltas)`);
  }

  // ============================================================================ 2. TROCA DE FAIXA: um toque e solta
  {
    const r = {};
    for (const ajuda of [false, true]) {
      const c = await nova(G, { def: OVAL });
      e.ajuda = ajuda;
      const j = c.jogador;
      j.colocaNaPista(0, 100, -2, 0, 30); quadros(1);        // embalado a 30 m/s, 2 m a esquerda do meio, reto
      const d0 = j.d;
      dirige(Math.round(0.35 / DT), () => 0.6);            // o toque para a direita
      dirige(Math.round(1.2 / DT), () => 0);               // solta
      const psi1 = j.psi, d1 = j.d;
      dirige(Math.round(1.0 / DT), () => 0);
      r[ajuda] = { mudou: d1 - d0, psi: psi1 * 180 / Math.PI, deriva: j.d - d1, bateu: batidas > 0 || folga(c, j) < 0.05 };
      mede(`troca de faixa ${ajuda ? 'COM' : 'sem'} ajuda`, `mudou ${r[ajuda].mudou.toFixed(1)} m, rumo depois de soltar ${r[ajuda].psi.toFixed(1)} graus, deriva no segundo seguinte ${r[ajuda].deriva.toFixed(1)} m${r[ajuda].bateu ? ', BATEU' : ''}`);
    }
    ok(r.true.mudou > 0.8 && Math.abs(r.true.psi) < 3 && Math.abs(r.true.deriva) < 1 && !r.true.bateu,
      `um toque e solta: o carro muda de faixa (${r.true.mudou.toFixed(1)} m) e fica PARALELO (${r.true.psi.toFixed(1)} graus, deriva ${r.true.deriva.toFixed(1)} m em 1 s)`);
    ok(Math.abs(r.false.psi) > 3 * Math.max(0.5, Math.abs(r.true.psi)), `sem a ajuda o rumo ficava torto (${r.false.psi.toFixed(1)} graus): era o contra-toque que virava zigue-zague`);
  }

  // ============================================================================ 3. A "CRIANCA" numa reta comprida
  {
    const REACAO = 0.3, GANHO = 0.3;        // s de atraso; fracao do ARRASTO por metro fora do meio (3 m fora = 90 % do curso)
    const r = {};
    for (const ajuda of [false, true]) {
      const c = await nova(G, { def: OVAL });
      e.ajuda = ajuda;
      const j = c.jogador;
      j.colocaNaPista(0, 60, 3, 0, 30); quadros(1);         // 3 m fora do meio, embalada: a crianca quer voltar para o meio
      const visto = [], ds = [];
      dirige(Math.round(9 / DT), (k) => { visto.push(j.d); ds.push(j.d); const dv = visto[Math.max(0, k - Math.round(REACAO / DT))]; const m = Math.max(-1, Math.min(1, -GANHO * dv)); return Math.sign(m) * Entrada.curvaDoArrasto(m); });
      // passou do meio para o outro lado (o tamanho do zigue) e o que sobra balancando nos ultimos 3 s
      const passou = Math.max(0, -Math.min(...ds));
      const fim = ds.slice(-Math.round(3 / DT)), sobra = Math.max(...fim.map(Math.abs));
      r[ajuda] = { passou, sobra, batidas };
      mede(`criança (reação ${REACAO} s) ${ajuda ? 'COM' : 'sem'} ajuda`, `saiu de 3 m, passou do meio ${passou.toFixed(1)} m, ainda balança ${sobra.toFixed(1)} m nos últimos 3 s, ${batidas} batidas`);
    }
    ok(r.true.passou < 3 && r.true.sobra < 1 && r.true.batidas === 0, `COM a ajuda a criança volta para o meio, passa um pouco e ASSENTA (passou ${r.true.passou.toFixed(1)} m do meio, balança ${r.true.sobra.toFixed(1)} m no fim, sem bater)`);
    ok(r.false.sobra > 2 * Math.max(0.3, r.true.sobra) || r.false.batidas > 0, `sem a ajuda ela ficava em zigue-zague (balança ${r.false.sobra.toFixed(1)} m no fim, ${r.false.batidas} batidas)`);
  }

  // ============================================================================ 4. o dedo continua mandando
  {
    const c = await nova(G, { def: OVAL });
    const j = c.jogador;
    e.ajuda = true;
    // devagar: nenhuma ajuda (manobra, saida do muro)
    j.colocaNaPista(0, 100, 0, 0.3, 3);
    ok(direcaoAssistida(j, 0.4) === 0.4 && direcaoAssistida(j, 0) === 0, `devagar (${j.vf.toFixed(0)} m/s, abaixo de ${FISICA.AJUDA.VEL_MIN}): o dedo vale exatamente o que pediu`);
    // embalado numa reta: o dedo todo vira forte (ate chegar no angulo); solto e reto, nada; sem curva a frente, sem teto
    j.colocaNaPista(0, 100, 0, 0, 36);
    const tudo = direcaoAssistida(j, 1), nada = direcaoAssistida(j, 0);
    ok(tudo > 0.4 && Math.abs(nada) < 0.05, `embalado na reta: o dedo todo vira firme (${tudo.toFixed(2)}) até o ângulo máximo; solto e reto ${nada.toFixed(2)}`);
    ok(tetoDaCurva(j) > 100, 'na reta comprida não há teto: o pé fica no fundo');
    // torto e solto: a ajuda endireita para o lado certo; pedindo MAIS angulo para o mesmo lado, o carro vira mais
    j.colocaNaPista(0, 100, 0, 0.1, 30);
    ok(direcaoAssistida(j, 0) < -0.1, 'torto para a direita e solto: a ajuda vira para a esquerda (endireita)');
    ok(direcaoAssistida(j, 1) > 0.2, 'torto para a direita e pedindo mais para a direita: o carro vira mais');
    // o dedo pede um ANGULO: segurando tudo, o carro fica torto no angulo maximo e PARA de girar (nao da a volta)
    j.colocaNaPista(0, 100, -6, 0, 30); quadros(1);
    dirige(Math.round(0.6 / DT), () => 1);
    const chi = Math.atan2(j.vf * Math.sin(j.psi) + j.vr * Math.cos(j.psi), j.vf * Math.cos(j.psi) - j.vr * Math.sin(j.psi)) * 180 / Math.PI;
    const angMax = Math.asin(FISICA.AJUDA.LATERAL_MAX / j.vf) * 180 / Math.PI;
    ok(Math.abs(chi - angMax) < 5 && Math.abs(j.giro) < 0.35,
      `o dedo todo segurado: o carro anda torto a ${chi.toFixed(0)} graus da estrada (máximo ${angMax.toFixed(0)} a ${j.vf.toFixed(0)} m/s) e para de girar (${j.giro.toFixed(2)} rad/s)`);
    // atravessado (rodou): quem endireita e a crianca
    j.colocaNaPista(0, 100, 0, 1.4, 20);
    ok(direcaoAssistida(j, 0.3) === 0.3, 'atravessado (mais de 57 graus): sem ajuda, o dedo manda');
    // derrapando: sem ajuda (o drift e de proposito)
    j.colocaNaPista(0, 100, 0, 0.1, 30); j.derrapando = true;
    ok(direcaoAssistida(j, 0.7) === 0.7, 'derrapando: sem ajuda');
    j.derrapando = false;
    // chegando rapido numa curva que nao da (a primeira da Orla, raio ~21 m): o pe sai sozinho
    const c2 = await nova(G, { pista: 'orla' });
    const j2 = c2.jogador, S = c2.pista.principal;
    let sCurva = 0; for (let s = 0; s < S.comprimento; s += 2) if (Math.abs(S.khEm(s)) > Math.abs(S.khEm(sCurva))) sCurva = s;
    j2.colocaNaPista(0, sCurva - 30, 0, 0, 40);
    segura('acel', 1); segura('direcao', 0); quadros(1);
    ok(j2.controle.acel === 0 && j2.controle.freio > 0, `a 40 m/s chegando na curva mais fechada da Orla (raio ${(1 / Math.abs(S.khEm(sCurva))).toFixed(0)} m, teto ${tetoDaCurva(j2).toFixed(0)} m/s): o pé sai do acelerador e freia de leve (${j2.controle.freio.toFixed(2)})`);
    // a ajuda pode ser desligada (as suites de fisica medem a fisica crua; e o gancho para uma opcao)
    e.ajuda = false; j2.colocaNaPista(0, sCurva - 30, 0, 0, 40); segura('direcao', 0.4); quadros(1);
    ok(j2.controle.direcao === 0.4 && j2.controle.acel === 1, 'ajuda desligada: o carro recebe o dedo cru (e o pé fica no fundo)');
    e.ajuda = true;
  }

  // ============================================================================ 5. SOLTOU O ACELERADOR
  {
    const r = {};
    for (const freia of [false, true]) {
      const c = await nova(G, { def: OVAL });
      e.freioAoSoltar = freia;
      const j = c.jogador;
      j.colocaNaPista(0, 100, 0, 0, 36); quadros(1);
      dirige(Math.round(2 / DT), () => 0, 0);
      r[freia] = j.vf;
    }
    e.freioAoSoltar = true;
    mede('2 s depois de soltar o acelerador a 36 m/s', `${r.true.toFixed(1)} m/s (só deslizando, como antes: ${r.false.toFixed(1)} m/s)`);
    ok(r.true < 28 && r.false > 29, `soltou o acelerador: o carro perde velocidade (36 -> ${r.true.toFixed(0)} m/s em 2 s; deslizando era ${r.false.toFixed(0)})`);
    const c = await nova(G, { def: OVAL });
    const j = c.jogador;
    j.colocaNaPista(0, 100, 0, 0, 4); quadros(1);
    let menor = 0;
    for (let k = 0; k < Math.round(4 / DT); k++) { dirige(1, () => 0, 0); menor = Math.min(menor, j.vf); }
    ok(menor > -0.05 && Math.abs(j.vf) < 0.05, `soltou devagar: o carro para e NÃO vira ré (menor velocidade ${menor.toFixed(2)} m/s)`);
  }

  solta('acel'); solta('direcao'); entradaDeVolta();
  G.jogo.encerraCorrida();
});
