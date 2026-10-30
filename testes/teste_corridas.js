// SUITE DAS CORRIDAS COMPLETAS (fase 7). O pedido: "rodando uma corrida completa em cada pista, verificando fps, erros no console e a
// conclusao de cada corrida". Aqui a corrida e aberta PELAS TELAS (o mesmo caminho do botao da crianca: carga, HUD, controles, som,
// resultado e registro), com o jogador no piloto automatico, 8 carros e 3 voltas, nas 10 pistas — e cada pista com um carro
// diferente do jogador, para os 10 carros passarem pela bateria. Erro no console reprova sozinho (testes/rodar.js).
import { suite, ok, mede, simulaAte, apagaProgresso } from './harness.js';
import { on } from '../js/eventos.js';
import { PISTAS } from '../config/pistas.js';
import { CARROS } from '../config/carros.js';
import { CORRIDA } from '../config/corrida.js';

/** Teto de simulacao por corrida (s): 3 voltas de ~60 s com folga para a IA mais lenta. */
const TETO_DA_CORRIDA = 900;

suite('corridas', async (G) => {
  apagaProgresso();
  G.flags.auto = true;
  let tela = null, quedas = 0, batidas = 0;
  on('jogo:tela', (e) => { tela = e.nome; });
  on('carro:queda', () => { quedas++; });
  on('carro:batida', (e) => { if (e.carro && e.carro.ehJogador) batidas++; });
  const finito = (c) => Number.isFinite(c.pos.x + c.pos.y + c.pos.z + c.s + c.d + c.vf + c.vr + c.psi);

  for (const [k, def] of PISTAS.entries()) {
    const carro = CARROS[k % CARROS.length].id;
    quedas = 0; batidas = 0; tela = null;
    const t0 = performance.now();
    const c = await G.telas.mostra('corrida_direta', { pista: def.id, carro });
    ok(!!c && c === G.corrida, `${def.nome}: a corrida abriu pelas telas (jogador de ${carro})`);
    if (!c) continue;
    ok(c.carros.length === CORRIDA.CORREDORES && c.voltas === CORRIDA.VOLTAS, `${def.nome}: ${c.carros.length} carros e ${c.voltas} voltas`);
    let semNaN = true;
    const seg = simulaAte(() => { if (!c.carros.every(finito)) semNaN = false; return c.estado === 'terminou'; }, TETO_DA_CORRIDA, 1500);
    ok(seg > 0, `${def.nome}: corrida de 3 voltas terminou em ${seg.toFixed(1)} s de simulação`);
    ok(semNaN, `${def.nome}: nenhum NaN nos carros`);
    const r = c.resultado;
    ok(r && r.classificacao.length === c.carros.length && r.classificacao.every((l, i) => l.posicao === i + 1 && l.tempo > 0), `${def.nome}: classificação completa`);
    ok(r && r.jogador.chegou, `${def.nome}: o jogador cruzou a chegada (${r ? r.jogador.posicao : '?'}º)`);
    // as telas processam o fim no passo seguinte: o resultado tem de aparecer
    simulaAte(() => tela === 'resultado', 10);
    ok(tela === 'resultado', `${def.nome}: a tela de resultado apareceu`);
    mede(`${def.id} tempo total (s)`, r ? r.tempoTotal : -1);
    mede(`${def.id} posicao do jogador`, r ? r.jogador.posicao : -1);
    mede(`${def.id} quedas (todos os carros)`, quedas);
    mede(`${def.id} batidas do jogador`, batidas);
    mede(`${def.id} tempo real da corrida (s)`, (performance.now() - t0) / 1000);
    G.telas.mostra('menu');
  }
  G.flags.auto = false;
});
