// SUITE DO AUDIO (fase 6): o grafo do WebAudio monta, todo nome de som toca sem erro e SOA (renderizado offline: tem energia e nao
// estoura), os 10 poderes tem som proprio, cada tema de musica soa, tres trocas de musica seguidas deixam so a ultima tocando (a
// armadilha do dinotrails-web), o motor segue a velocidade, o posicional cala longe, suspende/retoma, volumes — e sem AudioContext
// (navegador velho) tudo vira no-op sem erro.
// AS FAIXAS DO SUNO (02/11/2026): as 12 decodificam, o loop cabe no arquivo e a emenda nao estala (renderizada offline atravessando o
// pulo), toda pista tem a sua, tres trocas seguidas com uma faixa ainda decodificando acabam na ultima, no maximo 2 decodificadas na
// memoria, faixa que falha toca a sintetizada, faixa lenta deixa a sintetizada entrar em 1,5 s e entra por cima quando chega, e
// ?mudo=1 nao busca nada.
//
// A bateria abre com ?mudo=1, entao o G.audio do jogo nao tem contexto: a suite cria instancias proprias (`new Audio(G, { mudo: false })`)
// e destroi no fim. O Chromium da bateria roda com --autoplay-policy=no-user-gesture-required: o contexto nasce rodando.
import { suite, ok, mede, quadros, corridaDeTeste, largada, apagaProgresso } from './harness.js';
import { Audio, NOMES_DOS_EFEITOS, renderizaOffline, FADE_DA_MUSICA, timbreDoCarro } from '../js/audio.js';
import { NOMES_DOS_TEMAS, TEMAS, temaDaPista, compoe } from '../js/musica.js';
import { buscaFaixa, decodificadas, DECODIFICADAS_MAX, _falsificaFaixa } from '../js/faixas.js';
import { MUSICAS } from '../config/musicas.js';
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
  G.audio.musica('menu'); G.audio.preparaMusica('orla');
  await espera(100);
  ok(!G.flags.mudo || performance.getEntriesByType('resource').every((e) => !/assets\/musica\//.test(e.name)), '?mudo=1: o áudio do jogo não busca nenhuma faixa');

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

  ok(temaDaPista('neon') === 'cidade' && temaDaPista('orla') === 'praia', 'id de pista em texto acha o mesmo tema da definição (neon = cidade)');

  // ------------------------------------------------------------ a armadilha das duas trocas seguidas (sintetizada: temas sem faixa)
  a.musica('praia');
  await espera(150);
  a.musica('funk');
  a.musica('cidade');
  await espera((FADE_DA_MUSICA + 0.45) * 1000);
  const vivos = a._tocadores.map((t) => t.nome);
  ok(vivos.length === 1 && vivos[0] === 'cidade', `três trocas seguidas: só a última fica (${vivos.join(',')})`);
  ok(vivos.length === 1 && a._tocadores[0].g.gain.value > 0.5, `e ela toca no volume cheio (ganho ${vivos.length ? a._tocadores[0].g.gain.value.toFixed(2) : '-'}): o fade anterior não a calou`);
  ok(a.temaAtual === 'cidade', 'temaAtual = cidade');
  a.musica(null);
  await espera((FADE_DA_MUSICA + 0.35) * 1000);
  ok(a._tocadores.length === 0, 'musica(null) silencia');

  // ------------------------------------------------------------ as faixas do Suno: cada uma decodifica e a emenda nao estala
  const ids = Object.keys(MUSICAS);
  const pedidas = ['menu', 'podio', ...PISTAS.map((d) => d.id)];
  ok(pedidas.every((id) => ids.includes(id)), `menu, pódio e as ${PISTAS.length} pistas têm faixa (${ids.join(', ')})`);
  const ruins = [];
  for (const id of ids) {
    const m = MUSICAS[id], SR = 48000;
    const oc = new OfflineAudioContext(2, SR * 3, SR);
    let buf = null;
    try { buf = await oc.decodeAudioData((await buscaFaixa(id)).slice(0)); } catch (e) { ruins.push(id + ': não decodificou (' + e + ')'); continue; }
    if (!(m.inicio > 0.5 && m.fim < buf.duration - 0.5 && m.fim - m.inicio >= 45 && buf.numberOfChannels === 2)) {
      ruins.push(`${id}: loop ${m.inicio.toFixed(2)}-${m.fim.toFixed(2)} s num arquivo de ${buf.duration.toFixed(2)} s`); continue;
    }
    // toca do fim do loop - 1,5 s: o pulo cai no meio dos 3 s renderizados
    const f = oc.createBufferSource();
    f.buffer = buf; f.loop = true; f.loopStart = m.inicio; f.loopEnd = m.fim;
    f.connect(oc.destination); f.start(0, m.fim - 1.5);
    const d = (await oc.startRendering()).getChannelData(0);
    const k = Math.round(1.5 * SR), dif = new Float32Array(d.length - 1);
    let soma = 0, salto = 0;
    for (let i = 0; i < d.length - 1; i++) { dif[i] = Math.abs(d[i + 1] - d[i]); soma += d[i] * d[i]; }
    for (let i = k - 48; i < k + 48; i++) salto = Math.max(salto, dif[i]);
    const tipico = Float32Array.from(dif).sort()[Math.floor(dif.length * 0.999)];
    const rms = Math.sqrt(soma / d.length);
    if (salto > 2 * tipico || rms < 0.02) ruins.push(`${id}: salto ${salto.toFixed(3)} na emenda (típico ${tipico.toFixed(3)}), rms ${rms.toFixed(3)}`);
    mede('faixa ' + id, `loop ${(m.fim - m.inicio).toFixed(1)} s, ${m.compassos} compassos a ${m.bpm} BPM; emenda ${salto.toFixed(3)} (típico ${tipico.toFixed(3)})`);
  }
  ok(ruins.length === 0, `as ${ids.length} faixas decodificam, o loop cabe no arquivo e a emenda não estala` + (ruins.length ? ': ' + ruins.join('; ') : ''));

  // ------------------------------------------------------------ as faixas tocando: trocas seguidas, teto de memoria e as reservas
  const b = new Audio(G, { mudo: false, ouve: false });
  b.desbloqueia();
  await esperaAte(() => b.ctx.state === 'running');
  const tocando = () => { const t = b._tocadores.find((x) => x.ate === Infinity); return t ? t.chave : null; };
  // os prazos das esperas que dependem de DECODIFICAR sao largos: com 3 baterias em paralelo (SwiftShader ocupa a CPU) uma faixa de
  // 100 s levou mais de 4 s e a reserva sintetizada entrou antes dela — o certo, mas a suite mede o estado final, nao o relogio
  b.musica('menu');
  ok(await esperaAte(() => b.faixaTocando === 'menu', 12000), `a faixa do menu toca (${tocando()})`);
  const t0 = b._tocadores.find((x) => x.ate === Infinity);
  ok(t0 && t0.fonte.loop && Math.abs(t0.fonte.loopStart - MUSICAS.menu.inicio) < 1e-6 && Math.abs(t0.fonte.loopEnd - MUSICAS.menu.fim) < 1e-6,
    'em loop, com loopStart/loopEnd do config/musicas.js');
  b.musica('orla');      // ainda decodificando...
  b.musica('canyon');    // ...e ja trocou de novo
  ok(await esperaAte(() => b.faixaTocando === 'canyon', 12000), `três trocas seguidas com a do meio decodificando: fica a última (${tocando()})`);
  await espera((FADE_DA_MUSICA + 1.5) * 1000);   // e a da orla, se terminar agora, teria entrado
  const vivas = b._tocadores.map((t) => t.chave);
  ok(vivas.length === 1 && vivas[0] === 'faixa:canyon' && b.temaAtual === 'canyon', `a orla que decodificou depois não entrou por cima (${vivas.join(',')})`);
  ok(decodificadas().length <= DECODIFICADAS_MAX, `no máximo ${DECODIFICADAS_MAX} faixas decodificadas na memória (${decodificadas().join(', ')})`);
  b.musica({ id: 'teste', nome: 'Pista de Teste' });
  ok(await esperaAte(() => tocando() === 'tema:' + temaDaPista({ id: 'teste', nome: 'Pista de Teste' }), 2000), `pista sem faixa (a de teste) toca a sintetizada (${tocando()})`);
  _falsificaFaixa('gelo', () => Promise.reject(new Error('arquivo de teste que falha')));
  b.musica('gelo');
  ok(await esperaAte(() => tocando() === 'tema:gelo', 3000), `faixa que não carrega: toca a sintetizada da pista (${tocando()})`);
  _falsificaFaixa('gelo', null);
  const bytesNeon = await buscaFaixa('neon');
  _falsificaFaixa('neon', () => new Promise((r) => setTimeout(() => r(bytesNeon), 2600)));
  b.musica('neon');
  await espera(900);
  ok(tocando() === 'tema:gelo', `faixa lenta: até ${1.5} s o que já tocava continua (${tocando()})`);
  ok(await esperaAte(() => tocando() === 'tema:cidade', 2000), `faixa lenta: passou de 1,5 s entra a sintetizada da pista (${tocando()})`);
  ok(await esperaAte(() => b.faixaTocando === 'neon', 12000), `e quando a faixa chega ela entra por cima (${tocando()})`);
  _falsificaFaixa('neon', null);
  const s = new Audio(G, { mudo: false, ouve: false, sintetizada: true });
  ok(s.musica('orla') === 'praia', '?musica=sintetizada: a Orla toca o tema sintetizado da praia');
  s.destroi();
  b.destroi();

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
