// SUITE DOS CARROS DO CIDADE ABERTA E DO POPS AND BANGS (30/10/2026, pedido do Morassi: "coloque o Toyota Prius e os carros com pops and
// bangs do jogo Cidade Aberta disponiveis para jogar"). Confere:
//   * a config: os 16 carros novos (o Prius + os 15 que estouram no Cidade Aberta; o Porsche ja era a Lagartixa), atributos com soma
//     16 e SEM aumentar o raio da curva para a crianca (a promessa da tarefa anterior: o carro mais rapido no fundo do acelerador faz
//     todas as curvas), escapamento dentro do carro (atras nos de rua, dos lados nos Pro Stock), timbre do motor, som do estouro;
//   * cada carro novo CORRE: carrega o GLB, acha as 4 rodas e anda no oval;
//   * o estouro (js/pipoco.js) segue a regra do Cidade Aberta: o de rua ('turbo') estoura na REDUCAO (soltou o acelerador e a marcha
//     caiu) e nunca acelerando; o Pro Stock estoura em cada marcha que sobe e numa rajada longa ao soltar; a Lagartixa (o Porsche)
//     estala ao tirar o pe embalado; carro sem pops nunca estoura; ligar o turbo de quem tem pops solta um BANG.
// Os rivais ficam parados fora da pista (chegou = true) e sao carros SEM pops: a contagem e so a do jogador.
import { suite, ok, mede, quadros, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { FISICA, indiceDoAtributo } from '../config/fisica.js';
import { CARROS } from '../config/carros.js';
import { PODERES } from '../config/poderes.js';
import { raioDaCrianca } from '../js/pistas/inspecao.js';
import { EFEITOS, timbreDoCarro } from '../js/audio.js';
import PISTA_TESTE from '../js/pistas/teste.js';

const NOVOS = ['prius', 'fusca_teto', 'voyage', 'gol_gti', 'hb20', 'monza', 'speedup', 'celta', 'furgao',
  'gol_prostock', 'mustang', 'camaro', 'mustang_laranja', 'camaro_rad', 'camaro_bandeira', 'camaro_hotwheels'];
const PROSTOCK = ['gol_prostock', 'mustang', 'camaro', 'mustang_laranja', 'camaro_rad', 'camaro_bandeira', 'camaro_hotwheels'];
const DE_RUA = ['fusca_teto', 'voyage', 'gol_gti', 'hb20', 'monza', 'speedup', 'celta', 'furgao'];
const RIVAIS = ['dourado', 'picole', 'kombosa', 'jatinho', 'tubarao'];   // nenhum estoura
/** O raio da crianca antes dos carros novos (js/pistas/inspecao.js; o Vulcao e o Dourado empatam em 40,1 m): carro novo nao pode subir. */
const RAIO_DA_CRIANCA_MAX = 40.2;

// oval de retas de 900 m (o do teste_turbo): da para acelerar ate a velocidade maxima e soltar sem curva no meio
const OVAL = {
  id: 'oval_pipoco', nome: 'Oval do pipoco', ordem: 0, largura: 14,
  pontos: [[0, 0, 0], [0, 0, 300], [0, 0, 600], [0, 0, 900], [60, 0, 1000], [160, 0, 1000], [220, 0, 900], [220, 0, 600], [220, 0, 300], [220, 0, 0], [160, 0, -100], [60, 0, -100]],
  trechos: [], tema: PISTA_TESTE.tema,
};

function lateral(x) {
  const sup = x.corrida.pista.sup(x.sup), v = Math.max(2, Math.abs(x.vf));
  const kh = sup.khEm(x.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (x.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * x.d));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - x.psi)) / (v / raio)));
}
/** O piloto da suite escreve o controle do jogador direto (G.flags.auto: a entrada nao sobrescreve), como a IA — e, com o pe fora, o
 *  freio de soltar o acelerador que a entrada do jogador poe (js/entrada.js aplicaNoCarro, config/fisica.js FREIO_AO_SOLTAR). */
function pilota(G, j, seg, { acel = 1, turbo = false } = {}) {
  const auto = G.flags.auto; G.flags.auto = true;
  const n = Math.round(seg * 60);
  for (let k = 0; k < n; k++) {
    const ct = j.controle;
    ct.acel = acel; ct.freio = acel <= 0.05 && j.vf > FISICA.FREIO_AO_SOLTAR_ACIMA ? FISICA.FREIO_AO_SOLTAR : 0;
    ct.drift = false; ct.poder = false; ct.turbo = !!turbo && k === 0; ct.direcao = lateral(j);
    quadros(1);
  }
  G.flags.auto = auto;
}
async function nova(G, carro) {
  G.sorteio.semente(21);
  const c = await corridaDeTeste({ def: OVAL, carro, corredores: 6, voltas: 9, rivais: RIVAIS });
  largada();
  c.ia.passo = () => {};   // com G.flags.auto a IA dirigiria o jogador por cima do piloto da suite (js/ia.js); os rivais estao parados
  c.carros.forEach((x, k) => { if (x !== c.jogador) { x.chegou = true; x.fantasma = 1e9; x.colocaNaPista(0, 1500 + k * 25, 0, 0, 0); } });
  if (c.jogador.turbo) c.jogador.turbo.carga = 0;   // o turbo so liga quando a suite pedir (e ai a carga vem de volta)
  return c;
}
const estourosDo = (c) => c.pipoco.e[c.jogador.indice].n;

suite('pipoco', async (G) => {
  apagaProgresso();
  const porId = (id) => CARROS.find((c) => c.id === id);

  // ---------------------------------------------------------------- 1) a config
  ok(CARROS.length === 26 && NOVOS.every((id) => porId(id)), `26 carros, com os 16 do Cidade Aberta (${CARROS.length})`);
  ok(porId('prius') && porId('prius').nome === 'Prius' && !porId('prius').pops, 'o Prius esta la, sem pops (e hibrido)');
  ok(CARROS.every((c) => { const a = c.atributos; return a.velocidade + a.aceleracao + a.controle + a.peso + a.turbo === 16; }), 'todo carro com soma 16 nos atributos');
  const raio = raioDaCrianca();
  mede('raio da crianca com os 26 carros (m)', raio);
  ok(raio <= RAIO_DA_CRIANCA_MAX, `os carros novos nao apertam a curva da crianca (${raio.toFixed(1)} m; era 40,1)`);
  ok(Object.keys(PODERES).every((p) => CARROS.some((c) => c.poder === p)) && CARROS.every((c) => PODERES[c.poder]), 'todo poder tem dono e todo carro tem um poder que existe');
  const comPops = CARROS.filter((c) => c.pops).map((c) => c.id).sort();
  ok(JSON.stringify(comPops) === JSON.stringify([...PROSTOCK, ...DE_RUA, 'lagartixa'].sort()), `estouram os 15 do Cidade Aberta + a Lagartixa (o Porsche): ${comPops.length}`);
  ok(PROSTOCK.every((id) => porId(id).pops === 'prostock') && DE_RUA.every((id) => porId(id).pops === 'turbo') && porId('lagartixa').pops === 'esportivo', 'o tipo de cada um e o do Cidade Aberta (proStock, turbo, pops)');
  const foraDoCarro = [];
  for (const c of CARROS.filter((x) => x.pops)) {
    const m = c.medidas, e = c.escapamento;
    for (const [x, y, z] of e.canos) {
      const dentro = Math.abs(x) <= m.largura / 2 + 0.05 && y >= 0 && y <= m.altura && Math.abs(z) <= m.comprimento / 2 + 0.05;
      const lugar = c.pops === 'prostock' ? Math.abs(x) > m.largura * 0.3 && z > -m.comprimento * 0.3 : z < -m.comprimento * 0.4;
      if (!dentro || !lugar) foraDoCarro.push(`${c.id} [${x}, ${y}, ${z}]`);
    }
    if (c.pops === 'prostock' && !(e.dir[0] > 0.5 && e.dir[2] < 0)) foraDoCarro.push(`${c.id} dir ${e.dir}`);
  }
  ok(foraDoCarro.length === 0, `escapamento na carroceria: atras nos de rua, dos lados (soprando para fora e para tras) nos Pro Stock ${foraDoCarro.join('; ')}`);
  ok(timbreDoCarro(porId('prius')) === 'eletrico' && PROSTOCK.every((id) => timbreDoCarro(porId(id)) === 'grave') && timbreDoCarro(porId('voyage')) === 'motor', 'motor: o Prius zune, o Pro Stock ronca grave, o de rua e o motor comum');
  ok(typeof EFEITOS.estouro === 'function', 'o som do estouro existe');
  const naoAcha = [];
  for (const id of NOVOS) { try { const r = await fetch(porId(id).modelo, { method: 'HEAD' }); if (!r.ok) naoAcha.push(id); } catch (e) { naoAcha.push(id); } }
  ok(naoAcha.length === 0, `o GLB de cada carro novo esta no lugar ${naoAcha.join(', ')}`);

  // ---------------------------------------------------------------- 2) cada carro novo corre
  const tropeco = [];
  for (const id of [...NOVOS, 'lagartixa']) {
    const c = await nova(G, id), j = c.jogador;
    pilota(G, j, 4);
    const rodas = j.visual && j.visual.rodas ? j.visual.rodas.length : 0;
    if (!(j.vf > 12) || rodas !== 4 || !Number.isFinite(j.pos.x)) tropeco.push(`${id} (vf ${j.vf.toFixed(1)}, rodas ${rodas})`);
  }
  ok(tropeco.length === 0, `os 17 carros que estouram (e o Prius) carregam, acham as 4 rodas e andam ${tropeco.join(', ')}`);

  // ---------------------------------------------------------------- 3) quando estoura
  // de rua: acelerando nunca; soltando, a rajada da reducao; pisou de novo, para
  {
    const c = await nova(G, 'celta'), j = c.jogador;
    pilota(G, j, 8);
    const acelerando = estourosDo(c), vel = j.vf;
    pilota(G, j, 3, { acel: 0 });
    const soltando = estourosDo(c) - acelerando;
    pilota(G, j, 0.6);
    const n0 = estourosDo(c); pilota(G, j, 3);
    const depois = estourosDo(c) - n0;
    mede('celta: estouros acelerando / soltando 3 s / acelerando de novo', acelerando * 10000 + soltando * 100 + depois);
    ok(acelerando === 0, `de rua (Celta) nao estoura acelerando (${acelerando} em 8 s, ${vel.toFixed(1)} m/s)`);
    ok(soltando >= 2 && soltando <= 12, `soltou o acelerador: a reducao estoura (${soltando} em 3 s; 2 a 4 por marcha que cai)`);
    ok(depois === 0, `pisou de novo: parou de estourar (${depois})`);
  }
  // Pro Stock: cada marcha que sobe estoura; soltar solta rajada longa
  {
    const c = await nova(G, 'mustang'), j = c.jogador;
    pilota(G, j, 8);
    const subindo = estourosDo(c);
    pilota(G, j, 2.5, { acel: 0 });
    const soltando = estourosDo(c) - subindo;
    ok(subindo >= 2 && subindo <= 6, `Pro Stock (Mustang) estoura nas marchas que sobem (${subindo} em 8 s; 4 trocas)`);
    ok(soltando >= 5, `Pro Stock soltando: estalo + rajada de 5 a 8 na reducao (${soltando} em 2,5 s)`);
  }
  // o Porsche (Lagartixa): estala logo que tira o pe embalado
  {
    const c = await nova(G, 'lagartixa'), j = c.jogador;
    pilota(G, j, 4);
    const n0 = estourosDo(c);
    pilota(G, j, 0.5, { acel: 0 });
    const meioSegundo = estourosDo(c) - n0;
    ok(meioSegundo >= 1, `Lagartixa (Porsche GT3 RS): tirou o pe embalado, estala na hora (${meioSegundo} em 0,5 s)`);
  }
  // sem pops: nunca
  {
    const c = await nova(G, 'vulcao'), j = c.jogador;
    pilota(G, j, 6); pilota(G, j, 3, { acel: 0 }); pilota(G, j, 1, { turbo: true });
    ok(estourosDo(c) === 0 && c.pipoco.estouros === 0, `carro sem pops (Vulcao) nunca estoura (${c.pipoco.estouros})`);
  }
  // o turbo de quem estoura solta um BANG no passo em que liga, com fogo no escapamento
  {
    const c = await nova(G, 'gol_gti'), j = c.jogador;
    pilota(G, j, 3);
    j.turbo.carga = 1;
    const n0 = estourosDo(c), vivas0 = c.pipoco.efeitos.faiscas.vivas;
    pilota(G, j, 1 / 60, { turbo: true });
    ok(j.turbo.ativo && estourosDo(c) === n0 + 1, `ligou o turbo do Gol GTI: um BANG no mesmo passo (${estourosDo(c) - n0})`);
    ok(c.pipoco.efeitos.faiscas.vivas > 0 || vivas0 > 0, 'o estouro solta fogo no escapamento');
  }
});
