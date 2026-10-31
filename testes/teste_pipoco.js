// SUITE DOS CARROS DO CIDADE ABERTA E DO POPS AND BANGS (30/10/2026, pedido do Morassi: "coloque o Toyota Prius e os carros com pops and
// bangs do jogo Cidade Aberta disponiveis para jogar"; 31/10/2026: "remover os carros pro stock" e "usar o mesmo nome do Cidade Aberta
// em todos os carros"). Confere:
//   * a config: 19 carros, os 9 novos (o Toyota Prius + os 8 de rua que estouram no Cidade Aberta; o Porsche ja estava, id lagartixa),
//     nenhum Pro Stock, TODO nome igual ao do Cidade Aberta, atributos com soma 16 e SEM aumentar o raio da curva para a crianca (o
//     carro mais rapido no fundo do acelerador faz todas as curvas), escapamento atras, timbre do motor, som do estouro;
//   * cada carro novo CORRE: carrega o GLB, acha as 4 rodas e anda no oval;
//   * o estouro (js/pipoco.js) segue a regra do Cidade Aberta: o de rua ('turbo') estoura na REDUCAO (soltou o acelerador e a marcha
//     caiu) e nunca acelerando; o Porsche estala ao tirar o pe embalado; carro sem pops nunca estoura; ligar o turbo de quem tem pops
//     solta um BANG.
// Os rivais ficam parados fora da pista (chegou = true) e sao carros SEM pops: a contagem e so a do jogador.
import { suite, ok, mede, quadros, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { FISICA, indiceDoAtributo } from '../config/fisica.js';
import { CARROS } from '../config/carros.js';
import { PODERES } from '../config/poderes.js';
import { raioDaCrianca } from '../js/pistas/inspecao.js';
import { EFEITOS, timbreDoCarro } from '../js/audio.js';
import PISTA_TESTE from '../js/pistas/teste.js';

const NOVOS = ['prius', 'fusca_teto', 'voyage', 'gol_gti', 'hb20', 'monza', 'speedup', 'celta', 'furgao'];
const DE_RUA = ['fusca_teto', 'voyage', 'gol_gti', 'hb20', 'monza', 'speedup', 'celta', 'furgao'];
/** O `name` de cada SPECS do cidadeaberta/js/carmodels.js (sem o emoji), pelo id daqui (31/10/2026: todos com o nome de la). */
const NOME_NO_CIDADE_ABERTA = {
  vulcao: 'Carro Vulcão', dourado: 'Carro Dourado B7', lagartixa: 'Porsche 911 GT3 RS', picole: 'Carro de Sorvete', buguinho: 'Buggy',
  kombosa: 'Kombi', tubarao: 'Monster Truck Tubarão', voador: 'Toyota GR Yaris Voador', faisca: 'BYD Seal', jatinho: 'Kart a Jato',
  prius: 'Toyota Prius', fusca_teto: 'Fusca Teto Solar', voyage: 'VW Voyage', gol_gti: 'VW Gol GTI', hb20: 'Hyundai HB20 Turbo',
  monza: 'Chevrolet Monza SL/E', speedup: 'VW speed up! TSI', celta: 'Chevrolet Celta', furgao: 'Furgão',
};
const RIVAIS = ['dourado', 'picole', 'kombosa', 'jatinho', 'tubarao'];   // nenhum estoura
/** O raio da crianca antes dos carros novos (js/pistas/inspecao.js; o Carro Vulcao e o Dourado B7 empatam em 40,1 m): carro novo nao pode subir. */
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
  ok(CARROS.length === 19 && NOVOS.every((id) => porId(id)), `19 carros, com os 9 novos do Cidade Aberta (${CARROS.length})`);
  ok(!CARROS.some((c) => /prostock|mustang|camaro/.test(c.id) || /pro stock/i.test(c.nome)), 'nenhum Pro Stock (sairam em 31/10/2026)');
  const nomeErrado = CARROS.filter((c) => c.nome !== NOME_NO_CIDADE_ABERTA[c.id]).map((c) => `${c.id} = "${c.nome}"`);
  ok(nomeErrado.length === 0, `todo carro com o nome do Cidade Aberta ${nomeErrado.join(', ')}`);
  ok(porId('prius') && !porId('prius').pops, 'o Toyota Prius esta la, sem pops (e hibrido)');
  ok(CARROS.every((c) => { const a = c.atributos; return a.velocidade + a.aceleracao + a.controle + a.peso + a.turbo === 16; }), 'todo carro com soma 16 nos atributos');
  const raio = raioDaCrianca();
  mede('raio da crianca com os 19 carros (m)', raio);
  ok(raio <= RAIO_DA_CRIANCA_MAX, `os carros novos nao apertam a curva da crianca (${raio.toFixed(1)} m; era 40,1)`);
  ok(Object.keys(PODERES).every((p) => CARROS.some((c) => c.poder === p)) && CARROS.every((c) => PODERES[c.poder]), 'todo poder tem dono e todo carro tem um poder que existe');
  const comPops = CARROS.filter((c) => c.pops).map((c) => c.id).sort();
  ok(JSON.stringify(comPops) === JSON.stringify([...DE_RUA, 'lagartixa'].sort()), `estouram os 8 de rua + o Porsche: ${comPops.length}`);
  ok(DE_RUA.every((id) => porId(id).pops === 'turbo') && porId('lagartixa').pops === 'esportivo', 'o tipo de cada um e o do Cidade Aberta (turbo, pops)');
  const foraDoCarro = [];
  for (const c of CARROS.filter((x) => x.pops)) {
    const m = c.medidas, e = c.escapamento;
    for (const [x, y, z] of e.canos) {
      const dentro = Math.abs(x) <= m.largura / 2 + 0.05 && y >= 0 && y <= m.altura && Math.abs(z) <= m.comprimento / 2 + 0.05;
      if (!dentro || !(z < -m.comprimento * 0.4)) foraDoCarro.push(`${c.id} [${x}, ${y}, ${z}]`);
    }
    if (!(e.dir[2] < -0.9)) foraDoCarro.push(`${c.id} dir ${e.dir}`);
  }
  ok(foraDoCarro.length === 0, `escapamento atras, na carroceria, soprando para tras ${foraDoCarro.join('; ')}`);
  ok(timbreDoCarro(porId('prius')) === 'eletrico' && timbreDoCarro(porId('furgao')) === 'grave' && timbreDoCarro(porId('voyage')) === 'motor', 'motor: o Prius zune, o Furgao ronca grave, o de rua e o motor comum');
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
  ok(tropeco.length === 0, `os 9 carros que estouram e o Prius carregam, acham as 4 rodas e andam ${tropeco.join(', ')}`);

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
    ok(acelerando === 0, `de rua (Chevrolet Celta) nao estoura acelerando (${acelerando} em 8 s, ${vel.toFixed(1)} m/s)`);
    ok(soltando >= 2 && soltando <= 12, `soltou o acelerador: a reducao estoura (${soltando} em 3 s; 2 a 4 por marcha que cai)`);
    ok(depois === 0, `pisou de novo: parou de estourar (${depois})`);
  }
  // o Porsche (id lagartixa): estala logo que tira o pe embalado
  {
    const c = await nova(G, 'lagartixa'), j = c.jogador;
    pilota(G, j, 4);
    const n0 = estourosDo(c);
    pilota(G, j, 0.5, { acel: 0 });
    const meioSegundo = estourosDo(c) - n0;
    ok(meioSegundo >= 1, `Porsche 911 GT3 RS: tirou o pe embalado, estala na hora (${meioSegundo} em 0,5 s)`);
  }
  // sem pops: nunca
  {
    const c = await nova(G, 'vulcao'), j = c.jogador;
    pilota(G, j, 6); pilota(G, j, 3, { acel: 0 }); pilota(G, j, 1, { turbo: true });
    ok(estourosDo(c) === 0 && c.pipoco.estouros === 0, `carro sem pops (Carro Vulcao) nunca estoura (${c.pipoco.estouros})`);
  }
  // o turbo de quem estoura solta um BANG no passo em que liga, com fogo no escapamento
  {
    const c = await nova(G, 'gol_gti'), j = c.jogador;
    pilota(G, j, 3);
    j.turbo.carga = 1;
    const n0 = estourosDo(c), vivas0 = c.pipoco.efeitos.faiscas.vivas;
    pilota(G, j, 1 / 60, { turbo: true });
    ok(j.turbo.ativo && estourosDo(c) === n0 + 1, `ligou o turbo do VW Gol GTI: um BANG no mesmo passo (${estourosDo(c) - n0})`);
    ok(c.pipoco.efeitos.faiscas.vivas > 0 || vivas0 > 0, 'o estouro solta fogo no escapamento');
  }
});
