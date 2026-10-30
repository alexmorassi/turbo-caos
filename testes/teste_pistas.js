// SUITE DAS PISTAS (fase 3). Para cada uma das 10 pistas do campeonato:
//   1. a GEOMETRIA (js/pistas/inspecao.js — as mesmas contas que rodam no Node enquanto a pista e desenhada): sem NaN, volta de 1,4 a
//      2,2 km, quadros ortonormais, topo de cada loop e saca-rolha de cabeca para baixo (N.y < -0,9) e magnetico, nenhuma pista
//      atravessando outra (salvo viaduto com 6 m de folga), atalhos que conectam nas duas bocas e encurtam, largada numa reta plana;
//   2. o VISUAL: montaVisualDaPista monta sem erro, as malhas nao tem NaN, e a medida de desenho de verdade em dois pontos (largada e
//      meio da volta, camera de corrida): chamadas de desenho e triangulos ([MEDE]; a meta e < 150 chamadas e < 300 mil triangulos
//      de cenario, sem os carros) e a montagem nas tres qualidades (a BAIXA corta o cenario);
//   3. uma CORRIDA de 1 volta com ?auto (o piloto automatico ainda e o stub da fundacao, js/ia.js — fase 5) tem de terminar.
import * as THREE from 'three';
import { suite, ok, mede, simulaAte, apagaProgresso, corridaDeTeste, largada, limpaTudo } from './harness.js';
import { Pista } from '../js/pista.js';
import { PISTAS, pistaPorId } from '../config/pistas.js';
import { inspeciona } from '../js/pistas/inspecao.js';
import { montaVisualDaPista } from '../js/visual_pista.js';

/** Metas de desempenho do pedido (sem os carros, qualidade alta). Viram [ERRO] so com folga: e medida em SwiftShader. */
const META_CHAMADAS = 150, META_TRIANGULOS = 300000;
/** Teto de simulacao da corrida de 1 volta (s): a volta e de 45 a 60 s a ~35 m/s; o stub anda a ~30 m/s e recupera de queda. */
const TETO_DA_VOLTA = 240;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _N = new THREE.Vector3();

/** Camera de corrida atras de (s, d) da principal, 10 m atras e 3,8 m acima, olhando 8 m a frente. */
function cameraDeCorrida(G, pista, s) {
  const S = pista.principal, cam = G.camera;
  S.ponto(S.normaliza(s - 10), 0, 3.8, _a); S.ponto(S.normaliza(s + 8), 0, 1, _b); S.quadro(S.normaliza(s), null, _N);
  cam.position.copy(_a); cam.up.copy(_N); cam.lookAt(_b); cam.updateMatrixWorld();
}

function semNaN(grupo) {
  let ruins = 0;
  grupo.traverse((o) => {
    const g = o.geometry; if (!g || !g.attributes || !g.attributes.position) return;
    const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { ruins++; break; }
  });
  return ruins;
}

suite('pistas', async (G) => {
  apagaProgresso();

  // ---------------------------------------------------------------- a lista
  ok(PISTAS.length === 10 && PISTAS.every((p, k) => p.ordem === k + 1), `10 pistas, em ordem 1..10 (${PISTAS.map((p) => p.id).join(', ')})`);
  ok(new Set(PISTAS.map((p) => p.id)).size === 10, 'ids distintos');
  ok(pistaPorId('neon') && pistaPorId('neon').id === 'neon' && pistaPorId('nao-existe') === null, 'pistaPorId acha e devolve null para id desconhecido');
  ok(PISTAS.every((p) => (p.atalhos || []).length >= 1 && (p.atalhos || []).length <= 2), 'toda pista tem 1 ou 2 atalhos');

  // ---------------------------------------------------------------- geometria e visual de cada pista
  const camOrig = { far: G.camera.far, pos: G.camera.position.clone(), quat: G.camera.quaternion.clone(), up: G.camera.up.clone() };
  for (const def of PISTAS) {
    const pista = new Pista(def);
    const r = inspeciona(pista);
    for (const l of r.linhas) ok(l.ok, l.msg);
    for (const [k, v] of Object.entries(r.medidas)) mede(`${def.id} ${k}`, v);
    ok(r.medidas.saltos >= 1, `${def.id}: tem salto (${r.medidas.saltos})`);
    if (def.ordem >= 5) ok(r.medidas.loops >= 1, `${def.id}: tem loop a partir da pista 5 (${r.medidas.loops})`);
    if (def.ordem === 10) ok(r.medidas.loops >= 2, `${def.id}: a final tem varios loops (${r.medidas.loops})`);

    const cenaVelha = G.cena;
    G.cena = new THREE.Scene();
    const t0 = performance.now();
    let vis = null;
    try { vis = await montaVisualDaPista(G, pista); } catch (e) { ok(false, `${def.id}: montaVisualDaPista explodiu — ${e && e.message}`); }
    if (vis) {
      const ms = performance.now() - t0;
      G.cena.add(vis.grupo);
      ok(vis.grupo && typeof vis.quadro === 'function' && typeof vis.destroi === 'function', `${def.id}: visual com grupo, quadro e destroi (contrato secao 4)`);
      ok(semNaN(vis.grupo) === 0, `${def.id}: nenhuma malha do visual com NaN`);
      mede(`${def.id} montagem do visual (ms, SwiftShader)`, ms);
      const tot = vis.conta();
      mede(`${def.id} malhas na cena (todas)`, tot.chamadas);
      mede(`${def.id} triangulos na cena (todos)`, tot.triangulos);
      for (const [nome, s] of [['largada', 15], ['meio da volta', pista.comprimento * 0.5]]) {
        cameraDeCorrida(G, pista, s);
        vis.quadro(1 / 60);
        G.renderer.render(G.cena, G.camera);
        const info = G.renderer.info.render;
        mede(`${def.id} desenho na ${nome}: chamadas`, info.calls);
        mede(`${def.id} desenho na ${nome}: triangulos`, info.triangles);
        ok(info.calls < META_CHAMADAS && info.triangles < META_TRIANGULOS, `${def.id}: ${nome} desenha ${info.calls} chamadas e ${(info.triangles / 1000).toFixed(0)} mil triangulos (meta < ${META_CHAMADAS} e < ${META_TRIANGULOS / 1000} mil, sem carros)`);
      }
      // qualidade: a BAIXA tem de cortar cenario (contrato secao 10: metade do cenario e neblina mais perto)
      // parte da ALTA de proposito (maestro, fase 7): no celular emulado a qualidade ja nasce MEDIA, e o corte media -> baixa e de so
      // ~10 % — a assercao reprovava com --mobile sem nada errado no cenario
      vis.aplicaQualidade({ densidadeCenario: 1, distancia: 1000 });
      const alta = vis.conta().triangulos, longeAlta = G.cena.fog ? G.cena.fog.far : 0;
      vis.aplicaQualidade({ densidadeCenario: 0.4, distancia: 450 });
      const baixa = vis.conta().triangulos, longeBaixa = G.cena.fog ? G.cena.fog.far : 0;
      ok(baixa < alta * 0.85 && longeBaixa < longeAlta, `${def.id}: qualidade BAIXA corta o cenario (${(alta / 1000).toFixed(0)} -> ${(baixa / 1000).toFixed(0)} mil triangulos) e aproxima a neblina (${longeAlta.toFixed(0)} -> ${longeBaixa.toFixed(0)} m)`);
      vis.aplicaQualidade(G.qualidade.p);
      vis.destroi();
      ok(vis.grupo.parent === null, `${def.id}: destroi tira o visual da cena`);
    }
    G.cena = cenaVelha;
  }
  G.camera.far = camOrig.far; G.camera.position.copy(camOrig.pos); G.camera.quaternion.copy(camOrig.quat); G.camera.up.copy(camOrig.up); G.camera.updateProjectionMatrix();

  // ---------------------------------------------------------------- 1 volta com o piloto automatico em cada pista
  // O que esta fase garante e que a PISTA SE COMPLETA: o jogador passa por todo o circuito sem empacar (curva impossivel, buraco sem
  // saida, atalho que nao devolve). Que a corrida FECHE depende tambem da fisica (fase 2) e do piloto automatico (stub da fase 5): se a
  // pista se completou e a corrida nao fechou, sai uma medida "NAO FECHOU" com o diagnostico, para o relatorio (o pedido: "se o stub for
  // burro demais, registre e nao mude js/ia.js").
  for (const def of PISTAS) {
    limpaTudo();
    const c = await corridaDeTeste({ pista: def.id, voltas: 1, corredores: 6, auto: true });
    ok(c && c.pista && c.pista.id === def.id && c.visual && c.visual.grupo.parent === c.cena, `${def.id}: corrida montada com o visual na cena`);
    largada();
    const L = c.pista.comprimento, j = c.jogador;
    // cobertura: quais trechos de 20 m da volta o jogador pisou (na principal ou no atalho, pelo progresso equivalente)
    const trechos = new Uint8Array(Math.ceil(L / 20));
    let teleportes = 0, sAnt = null;
    const seg = simulaAte(() => {
      const sp = c.pista.sPrincipal(j.sup, j.s);
      trechos[Math.min(trechos.length - 1, Math.floor(sp / 20))] = 1;
      if (sAnt !== null) { let ds = sp - sAnt; if (ds > L / 2) ds -= L; if (ds < -L / 2) ds += L; if (Math.abs(ds) > 60) teleportes++; }
      sAnt = sp;
      return c.estado === 'terminou';
    }, TETO_DA_VOLTA, 0);
    const cobertura = trechos.reduce((a, b) => a + b, 0) / trechos.length;
    // fechar a corrida ja prova que a pista se completa; sem fechar, o jogador tem de ter passado por 97% dela (o resto pode ser um
    // teleporte da fisica: com cobertura baixa e corrida fechada, e o carro que pulou trecho — fica na medida)
    ok(seg > 0 || cobertura >= 0.97, `${def.id}: a pista se completa — ${seg > 0 ? 'a corrida fechou' : 'nao fechou'}, o jogador passou por ${(cobertura * 100).toFixed(0)}% da volta`);
    mede(`${def.id} cobertura da volta pelo jogador`, cobertura);
    if (seg > 0) {
      ok(true, `${def.id}: corrida de 1 volta com ?auto terminou em ${seg.toFixed(1)} s de simulacao`);
      mede(`${def.id} tempo da volta do jogador (s)`, c.resultado.jogador.tempo);
    } else {
      mede(`${def.id} NAO FECHOU a corrida de 1 volta em ${TETO_DA_VOLTA} s`, `jogador na volta ${j.volta}, s = ${j.s.toFixed(0)}, ${j.quedas || 0} quedas, ${teleportes} pulos de mais de 60 m num passo (teleporte da fisica: ver docs/fases/fase3_pistas.md)`);
    }
    mede(`${def.id} quedas do jogador`, j.quedas || 0);
    mede(`${def.id} teleportes do jogador (pulo de mais de 60 m num passo)`, teleportes);
    // e desenha um quadro da corrida (pega erro de shader/malha que so aparece com os carros na cena)
    G.quadro(1 / 60);
    G.jogo.encerraCorrida();
  }
});
