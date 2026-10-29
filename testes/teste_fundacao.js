// SUITE DA FUNDACAO (fase 1): o laco, o passo fixo, a pista de teste (nucleo da spline), a corrida de ponta a ponta com os stubs/
// sistemas que existirem, o salvamento que falha sem derrubar o jogo e o determinismo (mesma semente = mesma corrida).
import { suite, ok, perto, mede, quadros, simulaAte, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { Pista, MARCA } from '../js/pista.js';
import def from '../js/pistas/teste.js';
import * as THREE from 'three';

suite('fundacao', async (G) => {
  apagaProgresso();
  // --- laco
  const t0 = G.relogio.t; quadros(60);
  perto(G.relogio.t - t0, 1, 1e-9, '60 passos = 1 s de simulacao');

  // --- nucleo da pista
  const p = new Pista(def), P = p.principal;
  ok(P.comprimento > 700 && P.comprimento < 1000, `pista de teste com ${P.comprimento.toFixed(0)} m`);
  let pior = 0; const T = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < P.n; i++) { T.fromArray(P.T, i * 3); N.fromArray(P.N, i * 3); pior = Math.max(pior, Math.abs(T.dot(N))); }
  ok(pior < 1e-4, 'quadros ortonormais em todas as amostras');
  let topo = 0; for (let i = 1; i < P.n; i++) if (P.P[i * 3 + 1] > P.P[topo * 3 + 1]) topo = i;
  ok(P.N[topo * 3 + 1] < -0.95, `no topo do loop o cima da pista aponta para baixo (N.y = ${P.N[topo * 3 + 1].toFixed(2)})`);
  ok((P.marcas[topo] & MARCA.MAGNETICO) !== 0, 'topo do loop e magnetico');
  const v = new THREE.Vector3(), o = {};
  let erro = 0;
  for (let s = 0; s < P.comprimento; s += 3.7) for (const d of [-5, 0, 5]) { P.ponto(s, d, 0.5, v); P.projeta(v, Math.round(s / P.ds), 6, o); erro = Math.max(erro, Math.abs(o.d - d), Math.abs(o.h - 0.5)); }
  ok(erro < 0.1, `projecao ida e volta com erro de ${(erro * 100).toFixed(1)} cm`);
  ok(p.atalhos.length === 1 && p.atalhos[0].sPulado > p.atalhos[0].sup.comprimento, 'o atalho e mais curto que o trecho que ele pula');
  const a = p.atalhos[0], sE = a.sEntrada + 5;
  P.ponto(sE, P.larguraEm(sE) / 2 + 1, 0.3, v);
  const tr = p.transicao(0, sE, P.larguraEm(sE) / 2 + 1, v, {});
  ok(tr && tr.sup === a.sup.id, 'passar da borda na boca do atalho troca para o atalho');

  // --- corrida de ponta a ponta (piloto automatico em todos)
  const c = await corridaDeTeste({ pista: 'teste', voltas: 1, corredores: 6, auto: true });
  ok(c.carros.length === 6 && c.estado === 'contagem', 'corrida montada com 6 carros, na contagem');
  ok(largada() >= 0 && c.estado === 'correndo', 'contagem de 3 s ate a largada');
  const seg = simulaAte(() => c.estado === 'terminou', 240, 600);
  ok(seg > 0, `corrida de 1 volta terminou em ${seg.toFixed(1)} s de simulacao`);
  const r = c.resultado;
  ok(r && r.classificacao.length === 6 && r.classificacao.every((l, k) => l.posicao === k + 1), 'classificacao com 6 posicoes em ordem');
  mede('tempo da corrida (s)', r ? r.tempoTotal : -1);

  // --- salvamento resiste a localStorage quebrado
  const orig = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
  Storage.prototype.setItem = function () { throw new Error('cheio'); };
  let caiu = false;
  try { G.save.grava('x', { a: 1 }); } catch (e) { caiu = true; }
  Storage.prototype.setItem = orig.value;
  ok(!caiu && G.save.le('x').a === 1, 'save.grava com armazenamento cheio nao levanta excecao e a copia em memoria responde');
  G.jogo.encerraCorrida();
});
