// SUITE DA DIFICULDADE (fase 5): js/dificuldade.js e config/dificuldade.js. Prova as tres camadas do pedido:
//   1. BASE GRADUAL: cada campo (ritmo, aceleracao, habilidade, agressividade, precisao, usoDePoder) cresce com a ordem da pista; numa
//      corrida de verdade os rivais da pista 10 sao melhores que os da pista 1; ha o rival FORTE (pole) e o FRACO (ultimo da grade);
//   2. DDA: o fator fica SEMPRE em [0,85; 1,15], a mudanca por corrida e limitada, 2 derrotas seguidas na MESMA pista aliviam (a primeira
//      nao), vitoria com folga aperta mais que vitoria apertada, registra() grava em G.save('dda') e a corrida seguinte rele, o fator
//      chega na IA (ritmo/habilidade), e a propria corrida chama registra() no fim;
//   3. ELASTICO: com o rival muito a frente o multiplicador cai ate o teto e nao passa; muito atras sobe ate o teto pequeno; a mudanca
//      por passo e suave; com o turbo ligado nao ha empurrao; o total nunca passa de TETO_TOTAL;
// e que save quebrado (texto, campos de outro tipo, le() que levanta, setItem que levanta) nunca derruba nada.
import { suite, ok, perto, mede, quadros, simulaAte, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { Dificuldade, leDDA, avaliaCorrida, fatorDaPista, CHAVE_DDA } from '../js/dificuldade.js';
import { DIFICULDADE as D, curvaDaBase } from '../config/dificuldade.js';
import { PISTAS } from '../config/pistas.js';

const CAMPOS = ['ritmo', 'aceleracao', 'habilidade', 'agressividade', 'precisao', 'usoDePoder'];

/** Resultado de mentira para o registra(): o jogador em `pos` de 8, com folga (s) para o 2o quando vence. */
function resultado(pista, pos, { folga = 0, batidas = 0, voltas = 3, melhor = 50, rivais = 50 } = {}) {
  const cl = [];
  for (let k = 1; k <= 8; k++) {
    const jog = k === pos;
    cl.push({ posicao: k, ehJogador: jog, tempo: 150 + (k - 1) * 2 + (k > 1 && pos === 1 ? folga : 0), melhorVolta: jog ? melhor : rivais, nome: jog ? 'Você' : 'R' + k, cfgId: 'x' });
  }
  const pj = cl[pos - 1];
  return { pista, modo: 'livre', voltas, tempoTotal: 150, classificacao: cl, jogador: { posicao: pos, tempo: pj.tempo, melhorVolta: melhor, batidas, vitoria: pos === 1, chegou: true } };
}

/** Uma Dificuldade solta (sem corrida) para exercitar registra(). */
function solta(G, pista = 'orla') { return new Dificuldade(G, { pista: { id: pista, def: { ordem: 1 } }, carros: [], jogador: null }); }

suite('dificuldade', async (G) => {
  apagaProgresso();

  // ------------------------------------------------------------------ 1. base gradual (a conta)
  {
    let cresce = true, lista = [];
    for (const campo of CAMPOS) {
      const v = PISTAS.map((p) => curvaDaBase(p.ordem, D.BASE[campo]));
      for (let k = 1; k < v.length; k++) if (!(v[k] > v[k - 1])) cresce = false;
      lista.push(`${campo} ${v[0].toFixed(2)} -> ${v[9].toFixed(2)}`);
    }
    ok(cresce, `base cresce pista a pista nos ${CAMPOS.length} campos (${lista.join('; ')})`);
    ok(PISTAS.every((p, k) => p.ordem === k + 1), 'a base e indexada pela ordem do campeonato (1..10)');
    perto(curvaDaBase(0, D.BASE.ritmo), D.BASE.ritmo[0], 1e-9, 'pista sem ordem (a de teste) usa a base da pista 1');
    mede('ritmo dos rivais por pista (x vMax)', PISTAS.map((p) => curvaDaBase(p.ordem, D.BASE.ritmo).toFixed(3)).join(' '));
  }

  // ------------------------------------------------------------------ 1b. base numa corrida de verdade + papeis
  const ias = {};
  for (const id of ['orla', 'maluca']) {
    G.save.remove(CHAVE_DDA);
    G.sorteio.semente(31);
    const c = await corridaDeTeste({ pista: id, carro: 'vulcao', corredores: 8, voltas: 1 });
    const rivais = c.carros.filter((x) => !x.ehJogador).sort((a, b) => a.indice - b.indice);
    ias[id] = rivais.map((x) => x.ia);
    const forte = rivais[0].ia, fraco = rivais[rivais.length - 1].ia, med = rivais.slice(1, -1).map((x) => x.ia);
    const media = (campo) => med.reduce((s, x) => s + x[campo], 0) / med.length;
    ok(forte.papel === 'forte' && fraco.papel === 'fraco' && med.every((x) => x.papel === 'mediano'), `${id}: papeis — o forte larga na pole, o fraco e o ultimo rival da grade`);
    ok(forte.habilidade > media('habilidade') && forte.ritmo > media('ritmo') && fraco.habilidade < media('habilidade') && fraco.ritmo < media('ritmo'),
      `${id}: forte acima da media dos medianos e fraco abaixo (habilidade ${forte.habilidade.toFixed(2)} / ${media('habilidade').toFixed(2)} / ${fraco.habilidade.toFixed(2)})`);
    ok(new Set(med.map((x) => x.habilidade.toFixed(4))).size > 1, `${id}: os medianos nao sao todos iguais (sorteio pequeno)`);
    ok(rivais.every((x) => CAMPOS.every((k) => Number.isFinite(x.ia[k])) && ['habilidade', 'agressividade', 'precisao', 'usoDePoder'].every((k) => x.ia[k] >= 0 && x.ia[k] <= 1)), `${id}: carro.ia completo, campos 0..1`);
    ok(c.jogador.ia && c.jogador.ia.papel === 'auto' && c.jogador.ia.habilidade === 1, `${id}: o jogador tem o perfil do piloto automatico (sem DDA)`);
    ok(c.dificuldade.ordem === (id === 'orla' ? 1 : 10) && Math.abs(c.dificuldade.fator - D.DDA.INICIAL) < 1e-9, `${id}: ordem ${c.dificuldade.ordem}, fator inicial ${c.dificuldade.fator}`);
    G.jogo.encerraCorrida();
  }
  const mediaDe = (lista, campo) => lista.reduce((s, x) => s + x[campo], 0) / lista.length;
  ok(CAMPOS.every((k) => mediaDe(ias.maluca, k) > mediaDe(ias.orla, k)), `os rivais da pista 10 sao melhores que os da 1 em todos os campos (ritmo ${mediaDe(ias.orla, 'ritmo').toFixed(3)} -> ${mediaDe(ias.maluca, 'ritmo').toFixed(3)}, habilidade ${mediaDe(ias.orla, 'habilidade').toFixed(2)} -> ${mediaDe(ias.maluca, 'habilidade').toFixed(2)})`);

  // ------------------------------------------------------------------ 2. DDA: regras do pedido
  {
    G.save.remove(CHAVE_DDA);
    const d = solta(G, 'orla');
    let r = d.registra(resultado('orla', 6));
    perto(fatorDaPista(leDDA(G), 'orla'), 1, 1e-9, '1 derrota: o fator NAO muda (a crianca pode so ter errado uma curva)');
    d._registrou = false;
    r = d.registra(resultado('orla', 6));
    perto(fatorDaPista(leDDA(G), 'orla'), 1 - D.DDA.ALIVIO, 1e-9, '2 derrotas seguidas na mesma pista: alivia');
    ok(r && r.delta < 0 && leDDA(G).pistas.orla.derrotasSeguidas === 2, `registra devolve o delta (${r && r.delta}) e conta as derrotas seguidas`);
    d._registrou = false; d.registra(resultado('orla', 8));
    perto(fatorDaPista(leDDA(G), 'orla'), 1 - D.DDA.ALIVIO - Math.min(D.DDA.PASSO_MAX, D.DDA.ALIVIO + D.DDA.ALIVIO_ULTIMO), 1e-9, '3a derrota seguida (em ultimo): alivia de novo, um pouco mais (no maximo o passo por corrida)');
    // derrotas em pistas DIFERENTES nao somam (o pedido e "na mesma pista")
    G.save.remove(CHAVE_DDA);
    const a = solta(G, 'orla'), b = solta(G, 'favela');
    a.registra(resultado('orla', 6)); b.registra(resultado('favela', 6));
    const dd = leDDA(G);
    ok(dd.pistas.orla.fator === 1 && dd.pistas.favela.fator === 1, 'uma derrota em cada pista: nenhuma das duas alivia');
    // podio interrompe a sequencia
    G.save.remove(CHAVE_DDA);
    const x = solta(G, 'orla');
    for (const pos of [6, 3, 6]) { x._registrou = false; x.registra(resultado('orla', pos)); }
    perto(fatorDaPista(leDDA(G), 'orla'), 1, 1e-9, 'derrota, podio, derrota: nao sao 2 seguidas');
    // vitoria
    G.save.remove(CHAVE_DDA);
    const v1 = solta(G, 'orla'); v1.registra(resultado('orla', 1, { folga: 6 }));
    perto(fatorDaPista(leDDA(G), 'orla'), 1 + D.DDA.APERTO_FOLGA, 1e-9, 'venceu com folga (6 s): aperta');
    G.save.remove(CHAVE_DDA);
    const v2 = solta(G, 'orla'); v2.registra(resultado('orla', 1, { folga: 0.5 }));
    perto(fatorDaPista(leDDA(G), 'orla'), 1 + D.DDA.APERTO_VITORIA, 1e-9, 'venceu apertado (0,5 s): aperta menos');
    ok(D.DDA.APERTO_FOLGA > D.DDA.APERTO_VITORIA, 'folga aperta mais que vitoria apertada');
    // global anda metade
    perto(leDDA(G).global.fator, 1 + D.DDA.APERTO_VITORIA * D.DDA.PESO_GLOBAL, 1e-9, 'o fator global anda a metade do passo da pista');
    perto(fatorDaPista(leDDA(G), 'gelo'), leDDA(G).global.fator, 1e-9, 'pista nunca corrida comeca no fator global');
  }

  // ------------------------------------------------------------------ 2b. limites: sempre em [0,85; 1,15] e passo por corrida limitado
  {
    G.save.remove(CHAVE_DDA);
    const d = solta(G, 'orla');
    let maxDelta = 0, min = 9, max = 0, ant = 1;
    const cenarios = [];
    for (let k = 0; k < 40; k++) cenarios.push(resultado('orla', 8, { batidas: 60, melhor: 70 }));
    for (let k = 0; k < 60; k++) cenarios.push(resultado('orla', 1, { folga: 30, melhor: 40, rivais: 50 }));
    for (let k = 0; k < 40; k++) cenarios.push(resultado('orla', 1 + (k * 5) % 8, { folga: k % 7, batidas: k % 11 }));
    for (const res of cenarios) {
      d._registrou = false;
      d.registra(res);
      const f = fatorDaPista(leDDA(G), 'orla');
      maxDelta = Math.max(maxDelta, Math.abs(f - ant)); ant = f;
      min = Math.min(min, f); max = Math.max(max, f);
    }
    ok(min >= D.DDA.MIN - 1e-12 && max <= D.DDA.MAX + 1e-12, `140 corridas extremas: o fator ficou em [${min.toFixed(3)}; ${max.toFixed(3)}] (pedido: 0,85..1,15)`);
    perto(min, D.DDA.MIN, 1e-9, '40 derrotas seguidas em ultimo chegam ao piso e param nele');
    perto(max, D.DDA.MAX, 1e-9, '60 vitorias com folga chegam ao teto e param nele');
    ok(maxDelta <= D.DDA.PASSO_MAX + 1e-12, `mudanca maxima numa corrida: ${maxDelta.toFixed(3)} (teto ${D.DDA.PASSO_MAX})`);
    // a conta pura tambem respeita o teto no pior caso (derrota em ultimo, batendo, devagar)
    const pior = avaliaCorrida(resultado('orla', 8, { batidas: 90, melhor: 80 }), { derrotasSeguidas: 5 });
    ok(Math.abs(pior.delta) <= D.DDA.PASSO_MAX + 1e-12 && pior.delta < 0, `pior corrida possivel: delta ${pior.delta.toFixed(3)} (limitado)`);
    ok(leDDA(G).pistas.orla.historico.length === D.DDA.HISTORICO, `historico guarda as ultimas ${D.DDA.HISTORICO} corridas`);
  }

  // ------------------------------------------------------------------ 2c. registra persiste e a corrida seguinte rele; o fator chega na IA
  {
    G.save.remove(CHAVE_DDA);
    const d = solta(G, 'orla');
    for (const pos of [7, 7, 7]) { d._registrou = false; d.registra(resultado('orla', pos)); }
    const salvo = G.save.le(CHAVE_DDA, null);
    ok(salvo && salvo.pistas && salvo.pistas.orla && salvo.pistas.orla.historico.length === 3, 'registra grava em G.save("dda") com historico');
    const fatorBaixo = salvo.pistas.orla.fator;
    G.sorteio.semente(31);
    const c = await corridaDeTeste({ pista: 'orla', carro: 'vulcao', corredores: 8, voltas: 1 });
    perto(c.dificuldade.fator, fatorBaixo, 1e-9, 'a corrida seguinte na mesma pista le o fator salvo');
    ok(c.dificuldade.historico.length === 3, 'historico da pista legivel em corrida.dificuldade.historico');
    const baixo = c.carros.filter((x) => !x.ehJogador).map((x) => x.ia);
    G.jogo.encerraCorrida();
    const dd = leDDA(G); dd.pistas.orla.fator = D.DDA.MAX; G.save.grava(CHAVE_DDA, dd);
    G.sorteio.semente(31);
    const c2 = await corridaDeTeste({ pista: 'orla', carro: 'vulcao', corredores: 8, voltas: 1 });
    const alto = c2.carros.filter((x) => !x.ehJogador).map((x) => x.ia);
    ok(alto.every((ia, k) => ia.ritmo > baixo[k].ritmo && ia.habilidade >= baixo[k].habilidade && ia.usoDePoder >= baixo[k].usoDePoder),
      `fator ${fatorBaixo.toFixed(2)} -> ${D.DDA.MAX}: cada rival fica mais rapido (ritmo ${baixo[1].ritmo.toFixed(3)} -> ${alto[1].ritmo.toFixed(3)}) e melhor`);
    G.jogo.encerraCorrida();
    // a corrida de verdade chama registra no fim (piloto automatico, pista de teste, 1 volta)
    G.save.remove(CHAVE_DDA);
    G.sorteio.semente(32);
    const c3 = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 1, auto: true });
    largada();
    const seg = simulaAte(() => c3.estado === 'terminou', 200);
    const reg = leDDA(G).pistas.teste;
    ok(seg > 0 && reg && reg.corridas === 1 && reg.historico.length === 1, `a corrida terminada registrou o DDA da pista (${seg.toFixed(1)} s, ${reg ? reg.historico[0].pos : '?'}º lugar)`);
    ok(c3.dificuldade.ultimoRegistro && Number.isFinite(c3.dificuldade.ultimoRegistro.fator), 'corrida.dificuldade.ultimoRegistro legivel depois do fim');
    G.jogo.encerraCorrida();
    G.flags.auto = false;
  }

  // ------------------------------------------------------------------ 3. elastico (rubber band)
  {
    G.save.remove(CHAVE_DDA);
    G.sorteio.semente(33);
    const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 3 });
    largada();
    const j = c.jogador, rivais = c.carros.filter((x) => !x.ehJogador);
    const frente = rivais[0], atras = rivais[1], turbo = rivais[2];
    const L = c.pista.comprimento;
    // ninguem anda: so o elastico. A fisica roda, mas os carros ficam parados (fantasmas, sem comando nenhum — freio parado vira re)
    // e longe da rampa da pista de teste (s 95-145: parado no vao o carro cai)
    for (const x of c.carros) x.fantasma = 1e9;
    const iaPasso = c.ia.passo.bind(c.ia);
    c.ia.passo = (dt) => { iaPasso(dt); for (const x of c.carros) { x.controle.acel = 0; x.controle.freio = 0; x.controle.direcao = 0; x.controle.drift = false; x.controle.turbo = false; x.controle.poder = false; } };
    const S0 = 20;
    j.colocaNaPista(0, S0, 0, 0, 0);
    frente.colocaNaPista(0, S0 + 500, 0, 0, 0);
    atras.colocaNaPista(0, S0 + L - 500, 0, 0, 0);   // 500 m atras (a corrida conta pelo progresso: uma volta a menos)
    turbo.colocaNaPista(0, S0 + L - 500, 3, 0, 0);
    // progresso forcado (as regras da corrida recalculam o progresso pelo s e pela volta)
    for (const x of c.carros) { x.volta = 1; x._sAnt = null; }
    atras.volta = 0; turbo.volta = 0;
    // mede o multiplicador que a dificuldade poe no mod (o passo dela roda depois do zeraMod e antes de turbo/poderes)
    const mult = new Map(), salto = new Map();
    const difPasso = c.dificuldade.passo.bind(c.dificuldade);
    c.dificuldade.passo = (dt) => {
      if (turbo.turbo) turbo.turbo.ativo = true;
      difPasso(dt);
      for (const x of rivais) { const m = x.mod.velMax; const a = mult.get(x); if (a !== undefined) salto.set(x, Math.max(salto.get(x) || 0, Math.abs(m - a))); mult.set(x, m); }
    };
    const E = D.ELASTICO;
    const amostras = [];
    for (let k = 0; k < 20; k++) { quadros(30); amostras.push(mult.get(frente)); }
    const base = (x) => x.ia.ritmo;
    const mf = mult.get(frente) / base(frente), ma = mult.get(atras) / base(atras), mt = mult.get(turbo) / base(turbo);
    mede('elastico: 500 m a frente (x ritmo)', mf);
    mede('elastico: 500 m atras (x ritmo)', ma);
    ok(mf < 1 && mf >= 1 - E.TETO_FREIA - 1e-6, `muito a frente do jogador perde um pouco, no maximo ${E.TETO_FREIA * 100}% (${((1 - mf) * 100).toFixed(1)}%)`);
    ok(ma > 1 && ma <= 1 + E.TETO_ACELERA + 1e-6 && mult.get(atras) <= E.TETO_TOTAL + 1e-9, `muito atras ganha um pouco, no maximo ${E.TETO_ACELERA * 100}% e nunca acima de ${E.TETO_TOTAL} no total (${((ma - 1) * 100).toFixed(1)}%)`);
    ok(Math.abs(mt - 1) < 1e-9, 'com o turbo ligado o rival de tras nao ganha empurrao (nunca mais rapido que o turbo deixaria)');
    const passoMax = Math.max(...[...salto.values()]);
    ok(passoMax < 0.002, `suave: o multiplicador muda no maximo ${passoMax.toFixed(5)} por passo (TAU ${E.TAU} s)`);
    ok(amostras.every((m, k) => k === 0 || m <= amostras[k - 1] + 1e-12), 'o efeito entra devagar e sempre no mesmo sentido (sem tremer)');
    // perto do jogador (zona morta) nao ha efeito
    frente.colocaNaPista(0, S0 + 20, 4, 0, 0);
    quadros(900);
    perto(mult.get(frente) / base(frente), 1, 0.002, `a ${E.ZONA_MORTA} m ou menos do jogador o elastico some (briga de perto e de verdade)`);
    G.jogo.encerraCorrida();
  }

  // ------------------------------------------------------------------ 4. save quebrado nao derruba
  {
    let caiu = null;
    const lixos = ['lixo', 42, [1, 2], { versao: 'x', global: 'nada', pistas: { orla: { fator: 'abc', historico: 5, derrotasSeguidas: -3 }, gelo: null } }, { global: { fator: 99 }, pistas: [] }];
    try {
      for (const lixo of lixos) {
        G.save.grava(CHAVE_DDA, lixo);
        const dd = leDDA(G);
        if (!(dd.global.fator >= D.DDA.MIN && dd.global.fator <= D.DDA.MAX)) throw new Error('fator global fora: ' + dd.global.fator);
        for (const r of Object.values(dd.pistas)) if (!(r.fator >= D.DDA.MIN && r.fator <= D.DDA.MAX) || !Array.isArray(r.historico) || r.derrotasSeguidas < 0) throw new Error('registro ruim');
        const d = solta(G, 'orla');
        d.registra(resultado('orla', 6));
      }
    } catch (e) { caiu = e; }
    ok(!caiu, `save com lixo (texto, numero, lista, campos de outro tipo): le, conserta e registra sem levantar${caiu ? ' — ' + caiu.message : ''}`);
    // le() que levanta e setItem que levanta (armazenamento cheio/quebrado)
    // (G.save e o modulo js/save.js, que nao se troca: um G de mentira com o save quebrado)
    const quebrado = { save: { le() { throw new Error('quebrado de proposito'); }, grava() { throw new Error('quebrado de proposito'); } } };
    let ok1 = true;
    try { const dd = leDDA(quebrado); ok1 = dd.global.fator === D.DDA.INICIAL; ok1 = ok1 && !!solta(quebrado).registra(resultado('orla', 1, { folga: 9 })); } catch (e) { ok1 = false; }
    ok(ok1, 'save.le e save.grava levantando excecao: DDA no padrao e registra nao derruba');
    const setOrig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('cheio (suite)', 'QuotaExceededError'); };
    let ok2 = true;
    try { G.save.remove(CHAVE_DDA); solta(G, 'neon').registra(resultado('neon', 1, { folga: 9 })); ok2 = fatorDaPista(leDDA(G), 'neon') > 1; } catch (e) { ok2 = false; }
    Storage.prototype.setItem = setOrig;
    ok(ok2, 'armazenamento cheio: registra nao levanta e a copia em memoria guarda o fator');
    // corrida com save quebrado monta e roda
    G.save.grava(CHAVE_DDA, { pistas: { teste: { fator: NaN, historico: 'x' } } });
    let ok3 = true;
    try { G.sorteio.semente(34); const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 1 }); largada(); quadros(120); ok3 = Math.abs(c.dificuldade.fator - D.DDA.INICIAL) < 1e-9; G.jogo.encerraCorrida(); } catch (e) { ok3 = false; }
    ok(ok3, 'corrida com DDA corrompido no save larga e corre com o fator padrao');
  }
  G.save.remove(CHAVE_DDA);
});
