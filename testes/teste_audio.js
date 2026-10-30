// SUITE DO AUDIO (fase 6): o grafo do WebAudio monta, todo nome de som toca sem erro e SOA (renderizado offline: tem energia e nao
// estoura), os 10 poderes tem som proprio, cada tema de musica soa, tres trocas de musica seguidas deixam so a ultima tocando (a
// armadilha do dinotrails-web), o motor segue a velocidade, o posicional cala longe, suspende/retoma, volumes — e sem AudioContext
// (navegador velho) tudo vira no-op sem erro.
//
// A bateria abre com ?mudo=1, entao o G.audio do jogo nao tem contexto: a suite cria instancias proprias (`new Audio(G, { mudo: false })`)
// e destroi no fim. O Chromium da bateria roda com --autoplay-policy=no-user-gesture-required: o contexto nasce rodando.
import { suite, ok, mede, quadros, corridaDeTeste, largada, apagaProgresso } from './harness.js';
import { Audio, NOMES_DOS_EFEITOS, renderizaOffline, FADE_DA_MUSICA, timbreDoCarro } from '../js/audio.js';
import { NOMES_DOS_TEMAS, TEMAS, temaDaPista, compoe } from '../js/musica.js';
import { ORDEM_DOS_PODERES } from '../config/poderes.js';
import { PISTAS } from '../config/pistas.js';
import { emite } from '../js/eventos.js';
import * as THREE from 'three';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperaAte(cond, ms = 5000) {
  const t0 = performance.now();
  while (!cond()) { if (performance.now() - t0 > ms) return false; await espera(20); }
  return true;
}

suite('audio', async (G) => {
  apagaProgresso();

  // ------------------------------------------------------------ ?mudo=1
  G.audio.desbloqueia();
  ok(!G.flags.mudo || !G.audio.ctx, '?mudo=1: o áudio do jogo não cria AudioContext');

  // ------------------------------------------------------------ sem WebAudio
  const AC = window.AudioContext, WAC = window.webkitAudioContext;
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  let caiu = null;
  try {
    const a0 = new Audio(G, { mudo: false, ouve: false });
    ok(a0.desbloqueia() === false && !a0.ctx, 'sem AudioContext: desbloqueia() devolve false');
    for (const n of NOMES_DOS_EFEITOS) a0.toca(n);
    a0.musica('menu'); a0.musica({ id: 'orla', nome: 'Orla do Rio' }); a0.motor(null); a0.passo(1 / 60); a0.suspende(); a0.retoma(); a0.volume(1, 0.5, 0.5); a0.destroi();
  } catch (e) { caiu = e; }
  window.AudioContext = AC; window.webkitAudioContext = WAC;
  ok(!caiu, 'sem AudioContext tudo vira no-op sem erro' + (caiu ? ': ' + caiu : ''));

  // ------------------------------------------------------------ o grafo
  const a = new Audio(G, { mudo: false });
  ok(a.desbloqueia() && !!a.ctx, 'desbloqueia() cria o AudioContext');
  ok(await esperaAte(() => a.ctx.state === 'running'), 'o contexto está rodando');
  const n = a.no;
  ok(n && n.geral instanceof GainNode && n.compressor instanceof DynamicsCompressorNode && n.musica instanceof GainNode && n.efeitos instanceof GainNode && n.motores instanceof GainNode,
    'grafo: música/efeitos -> geral -> compressor -> saída (+ motores dentro dos efeitos)');
  ok(a._lacos && a._lacos.turbo.s instanceof AudioBufferSourceNode && a._lacos.drift.s instanceof AudioBufferSourceNode, 'laços contínuos do turbo e da derrapagem montados');
  ok(a._rivais.length === 2, 'duas vozes de motor para os rivais mais perto');

  // ------------------------------------------------------------ todos os nomes tocam
  const naoTocou = [];
  for (const nome of NOMES_DOS_EFEITOS) if (!a.toca(nome)) naoTocou.push(nome);
  ok(naoTocou.length === 0, `os ${NOMES_DOS_EFEITOS.length} sons tocam sem erro` + (naoTocou.length ? ' (falhou: ' + naoTocou.join(', ') + ')' : ''));
  ok(ORDEM_DOS_PODERES.every((p) => NOMES_DOS_EFEITOS.includes(p)), 'cada um dos 10 poderes tem som próprio (toca(id do poder))');
  // dois pedidos seguidos (e nao "o clique do laco acima": com a maquina carregada o laco dos 44 sons passa dos 60 ms e o teste
  // media o relogio, nao a regra — reprovou uma vez assim no iPhone com duas baterias em paralelo, 30/10/2026)
  a.toca('clique');
  ok(a.toca('clique') === false, 'o mesmo som não toca duas vezes em 60 ms (anti-metralhadora)');
  ok(a.toca('isto_nao_existe') === false && a.desconhecidos.has('isto_nao_existe'), 'nome desconhecido: ignorado sem erro');
  mede('efeitos tocados', a.tocados);
  ok(a._vozes.length <= 14, `teto de vozes respeitado (${a._vozes.length})`);

  // ------------------------------------------------------------ cada efeito SOA (offline)
  const mudos = [], estouram = [];
  let piorPico = 0;
  for (const nome of NOMES_DOS_EFEITOS) {
    const r = await renderizaOffline('efeito', nome, 2.6);
    // "tem som" pelo PICO: a media de energia numa janela de 2,6 s pune o efeito curto (o raspao dura 0,2 s) sem ele ser baixo
    if (!r || !(r.pico > 0.03)) mudos.push(nome + (r ? ' pico=' + r.pico.toFixed(3) : ''));
    if (r && r.pico >= 0.999) estouram.push(nome);
    if (r) piorPico = Math.max(piorPico, r.pico);
  }
  ok(mudos.length === 0, 'todo efeito tem som de verdade (pico > 0,03)' + (mudos.length ? ': ' + mudos.join(', ') : ''));
  ok(estouram.length === 0, 'nenhum efeito estoura (pico < 1)' + (estouram.length ? ': ' + estouram.join(', ') : ''));
  mede('pior pico dos efeitos', piorPico);
  const temasMudos = [];
  for (const t of NOMES_DOS_TEMAS) { const r = await renderizaOffline('musica', t, 3); if (!r || !(r.rms > 0.003) || r.pico >= 0.999) temasMudos.push(t + (r ? ` rms=${r.rms.toFixed(4)} pico=${r.pico.toFixed(2)}` : '')); }
  ok(temasMudos.length === 0, `os ${NOMES_DOS_TEMAS.length} temas de música soam sem estourar` + (temasMudos.length ? ': ' + temasMudos.join(', ') : ''));
  const melodia = (t) => compoe(t).passos.map((l) => l.filter((e) => e.i === 'lead').map((e) => e.m).join('.')).join('|');
  ok(melodia('praia') !== melodia('gelo') && melodia('praia') === melodia('praia'), 'cada tema tem a sua melodia, sempre a mesma');

  // ------------------------------------------------------------ musica por pista
  ok(temaDaPista({ id: 'orla', nome: 'Orla do Rio', ordem: 1 }) === 'praia', 'a Orla do Rio toca o tema da praia');
  ok(temaDaPista({ id: 'maluca', nome: 'Pista Maluca', ordem: 10 }) === 'maluca', 'a Pista Maluca toca o tema maluco');
  ok(temaDaPista({ id: 'x', nome: 'Qualquer', ordem: 3, tema: { musica: 'gelo' } }) === 'gelo', 'tema.musica da pista (fase 3) manda');
  ok(PISTAS.every((d) => !!TEMAS[temaDaPista(d)]), `toda pista do config ganha um tema (${PISTAS.map((d) => d.id + '=' + temaDaPista(d)).join(', ')})`);

  // ------------------------------------------------------------ a armadilha das duas trocas seguidas
  a.musica('menu');
  await espera(150);
  a.musica('praia');
  a.musica('gelo');
  await espera((FADE_DA_MUSICA + 0.45) * 1000);
  const vivos = a._tocadores.map((t) => t.nome);
  ok(vivos.length === 1 && vivos[0] === 'gelo', `três trocas seguidas: só a última fica (${vivos.join(',')})`);
  ok(vivos.length === 1 && a._tocadores[0].g.gain.value > 0.5, `e ela toca no volume cheio (ganho ${vivos.length ? a._tocadores[0].g.gain.value.toFixed(2) : '-'}): o fade anterior não a calou`);
  ok(a.temaAtual === 'gelo', 'temaAtual = gelo');
  a.musica(null);
  await espera((FADE_DA_MUSICA + 0.35) * 1000);
  ok(a._tocadores.length === 0, 'musica(null) silencia');

  // ------------------------------------------------------------ motor e eventos numa corrida
  const c = await corridaDeTeste({ pista: 'teste', voltas: 1, corredores: 6, auto: true });
  ok(a._motorCarro === c.jogador && !!a._motor, 'corrida:carregada liga o motor do jogador');
  ok(a._motor.timbre === timbreDoCarro(c.jogador.cfg), `timbre do motor pelo carro (${c.jogador.cfg.id}: ${a._motor.timbre})`);
  largada();
  a.passo(); a.passo();
  const f0 = a._motor.freq, v0 = c.jogador.velocidade;
  for (let k = 0; k < 300; k++) { G.passo(G.PASSO); a.passo(); }
  const f1 = a._motor.freq, v1 = c.jogador.velocidade;
  mede('motor: velocidade (m/s) parado -> andando', `${v0.toFixed(1)} -> ${v1.toFixed(1)}`);
  mede('motor: tom (Hz) parado -> andando', `${f0.toFixed(0)} -> ${f1.toFixed(0)}`);
  ok(v1 > v0 + 3 && Math.abs(f1 - f0) > 5, 'o tom do motor muda com a velocidade');
  const antes = a.tocados;
  emite('capsula:pega', { carro: c.jogador, dourada: true });
  ok(a.ultimo === 'capsula_dourada' && a.tocados === antes + 1, 'capsula:pega (dourada) toca a cápsula dourada');
  emite('poder:usa', { carro: c.jogador, poder: 'terremoto' });
  ok(a.ultimo === 'terremoto', 'poder:usa toca o som do poder');
  const longe = G.camera.position.clone().add(new THREE.Vector3(0, 0, 500));
  ok(a.toca('raspao', { pos: longe }) === false, 'som posicional muito longe não toca');
  ok(a.toca('pouso', { pos: c.jogador.pos }) === true, 'som posicional perto toca');
  emite('corrida:pausa', { pausada: true });
  ok(a._pausaDaCorrida, 'pausa abaixa a música');
  emite('corrida:pausa', { pausada: false });
  G.jogo.encerraCorrida();
  a.passo(); a.passo();
  ok(true, 'sem corrida o passo cala os motores sem erro');

  // ------------------------------------------------------------ suspende / retoma / volume
  a.suspende();
  ok(await esperaAte(() => a.ctx.state === 'suspended'), 'suspende() (aba escondida) suspende o contexto');
  ok(a.toca('estrela') === false, 'suspenso de propósito não empilha efeito para tocar tudo junto na volta');
  a.retoma();
  ok(await esperaAte(() => a.ctx.state === 'running'), 'retoma() volta a tocar');
  a.volume(null, 0.2, 0.8);
  ok(Math.abs(a.volumes.musica - 0.2) < 1e-9 && Math.abs(a.volumes.efeitos - 0.8) < 1e-9 && a.volumes.geral === 1, 'volume(geral, musica, efeitos) com null mantendo');
  a.destroi();
  ok(!a.ctx, 'destroi() fecha o contexto');
});
