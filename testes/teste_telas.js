// SUITE DAS TELAS (fase 6): o fluxo inteiro CLICANDO no DOM de verdade — menu -> carro (seta e deslizar) -> pista -> carga -> corrida
// (HUD, contagem, pausa, avisos, fumaca, tremida, minimapa) -> fim com G.flags.auto e passos do harness -> resultado/podio 3D -> menu;
// o campeonato registra pontos e desbloqueia; as opcoes chegam a entrada, ao audio, a qualidade e ao save; a regra do AUTO da qualidade
// desce um nivel e depois trava em 30 fps; `mostra('corrida_direta')`, reiniciar e sair pela pausa. Erro no console reprova.
//
// TRES CUIDADOS:
//   * G.flags.voltas = 1 e 6 corredores: o fluxo e o assunto, nao a corrida de 3 voltas;
//   * no campeonato a suite FREIA os rivais (gancho no passo da dificuldade, que roda depois do zeraMod e antes da fisica) para o
//     jogador chegar no podio — e a regra "podio desbloqueia" que se mede, nao a IA;
//   * a pagina da bateria nao abre o menu sozinha (?teste= pula o mostra('menu') do main.js): a suite abre.
import { suite, ok, mede, quadros, simulaAte, apagaProgresso, corridaDeTeste, largada } from './harness.js';
import { on, emite } from '../js/eventos.js';
import { CARROS } from '../config/carros.js';
import { PISTAS } from '../config/pistas.js';
import { PODERES } from '../config/poderes.js';
import { CORRIDA } from '../config/corrida.js';
import { NIVEIS } from '../js/qualidade.js';
import { formataTempo } from '../js/hud.js';
import { rivaisDoCampeonato } from '../js/telas.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperaAte(cond, ms = 60000) {
  const t0 = performance.now();
  while (!cond()) { if (performance.now() - t0 > ms) return false; await espera(25); }
  return true;
}
const $ = (s) => document.querySelector(s);
const visivel = (sel) => { const e = typeof sel === 'string' ? $(sel) : sel; return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
function clica(sel) { const b = $(sel); if (!b) throw new Error('nao achei ' + sel); b.click(); }
function desliza(el, dx) {
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const ev = (tipo, cx) => el.dispatchEvent(new PointerEvent(tipo, { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: y, bubbles: true }));
  ev('pointerdown', x); for (let k = 1; k <= 6; k++) ev('pointermove', x + (dx * k) / 6); ev('pointerup', x + dx);
}

suite('telas', async (G) => {
  apagaProgresso();
  G.flags.voltas = 1; G.flags.corredores = 6; G.flags.auto = true;
  // espioes na entrada (fase 2) e no barramento
  const controles = [], configs = [], telas = [];
  const mostraOrig = G.entrada.mostraControles.bind(G.entrada), configOrig = G.entrada.configura.bind(G.entrada);
  G.entrada.mostraControles = (v) => { controles.push(!!v); return mostraOrig(v); };
  G.entrada.configura = (o) => { configs.push({ ...o }); return configOrig(o); };
  on('jogo:tela', (e) => telas.push(e.nome));

  // ------------------------------------------------------------ carga e menu
  ok(getComputedStyle($('#carregando')).display === 'none', 'a tela de carga some no fim do inicia()');
  G.telas.mostra('menu');
  ok(G.telas.atual === 'menu' && visivel('#tela-menu'), 'menu na tela');
  ok(await esperaAte(() => G.desenho && G.desenho.cena === G.telas.vitrine.cena), 'no menu o laço desenha a vitrine 3D');
  ok(await esperaAte(() => !G.telas.vitrine.carregando && G.telas.vitrine._atual), 'o carro escolhido aparece na plataforma giratória');
  const alturaDoBotao = $('[data-acao=livre]').getBoundingClientRect().height;
  ok(alturaDoBotao >= 44, `botões de modo grandes para o dedo (${alturaDoBotao.toFixed(0)} px)`);
  const g0 = G.telas.vitrine._prato.rotation.y; G.telas.quadro(0.5);
  ok(G.telas.vitrine._prato.rotation.y !== g0, 'a plataforma gira no quadro');

  // ------------------------------------------------------------ selecao de carro
  clica('[data-acao=livre]');
  ok(G.telas.atual === 'selecao_carro' && visivel('#tela-selecao_carro'), 'CORRIDA LIVRE abre a seleção de carro');
  const i0 = G.telas.indiceCarro, cfg0 = CARROS[i0];
  ok($('.sc-nome span').textContent === cfg0.nome, `ficha com o nome do carro (${cfg0.nome})`);
  ok(document.querySelectorAll('.sc-attr').length === 5, 'cinco barras de atributo');
  const barras = [...document.querySelectorAll('.sc-attr')].map((a) => a.querySelectorAll('b.on').length).join();
  ok(barras === ['velocidade', 'aceleracao', 'controle', 'peso', 'turbo'].map((k) => cfg0.atributos[k]).join(), `barras = atributos do config (${barras})`);
  const pd0 = PODERES[cfg0.poder];
  ok($('.sc-poder-nome').textContent === pd0.nome && $('.sc-poder-icone').textContent === pd0.icone, `poder com nome e ícone (${pd0.icone} ${pd0.nome})`);
  ok($('.sc-poder-desc').textContent === pd0.descricao && $('.sc-esquiva').textContent.includes(pd0.esquiva), 'descrição e esquiva do poder na ficha');
  clica('[data-acao=carro_proximo]');
  const i1 = (i0 + 1) % CARROS.length;
  ok(G.telas.indiceCarro === i1 && $('.sc-nome span').textContent === CARROS[i1].nome, 'a seta troca de carro');
  clica('[data-acao=carro_anterior]'); clica('[data-acao=carro_anterior]');
  ok(G.telas.indiceCarro === (i0 - 1 + CARROS.length) % CARROS.length, 'a seta da esquerda volta (e dá a volta na lista)');
  desliza($('.sc-arrasto'), -140);
  ok(G.telas.indiceCarro === i0, 'deslizar o dedo para a esquerda passa para o próximo');
  desliza($('.sc-arrasto'), 140);
  desliza($('.sc-arrasto'), -140);
  for (let k = 0; k < 3; k++) clica('[data-acao=carro_proximo]');
  const escolhido = CARROS[G.telas.indiceCarro];
  ok(await esperaAte(() => G.telas.vitrine._atual && G.telas.vitrine._atual.cfg.id === escolhido.id), `a vitrine mostra o carro da ficha (${escolhido.nome})`);
  clica('[data-acao=escolhe_carro]');
  ok(G.jogo.carroEscolhido === escolhido.id && G.save.le('carro') === escolhido.id, 'escolher grava o carro (G.jogo.escolheCarro)');

  // ------------------------------------------------------------ selecao de pista
  ok(G.telas.atual === 'selecao_pista', 'depois do carro vem a pista');
  const cartoes = document.querySelectorAll('.sp-cartao');
  ok(cartoes.length === PISTAS.length, `um cartão por pista (${PISTAS.length})`);
  ok(document.querySelectorAll('.sp-cartao.bloqueada').length === PISTAS.length - 1, 'progresso novo: só a primeira pista aberta (cadeado nas outras)');
  ok($('.sp-cartao .sp-desenho path') !== null, 'cartão com o desenho da pista');
  if (PISTAS.length > 1) {
    clica('.sp-cartao.bloqueada');
    ok(G.telas.atual === 'selecao_pista' && !G.corrida, 'pista trancada não larga');
  }

  // ------------------------------------------------------------ corrida
  clica('.sp-cartao:not(.bloqueada)');
  ok(G.telas.atual === 'carregando_corrida' && visivel('#tela-carregando_corrida'), 'tela de carga da corrida com a dica');
  ok(await esperaAte(() => G.corrida && G.corrida.estado === 'contagem' && G.telas.atual === 'corrida', 120000), 'a corrida carregou e está na contagem');
  const c = G.corrida, j = c.jogador;
  ok(c.opcoes.carro === escolhido.id && c.opcoes.modo === 'livre', 'corrida livre com o carro escolhido');
  ok(G.hud.visivel && G.hud.corrida === c && !G.hud.raiz.hidden, 'HUD ligado no corrida:carregada');
  ok(controles[controles.length - 1] === true, 'controles de toque ligados (entrada.mostraControles(true))');
  ok(G.desenho && G.desenho.cena === c.cena, 'na corrida o laço desenha a cena da corrida');
  ok($('.hud-contagem').textContent === '3' && !$('.hud-contagem').hidden, 'contagem enorme: 3');
  ok($('.hud-pos-de').textContent === '/' + c.carros.length, 'posição "/n" com o número de carros');
  // pausa e continuar
  clica('[data-acao=pausar]');
  ok(c.pausada && visivel('#tela-pausa'), 'botão de pausa: corrida parada e menu de pausa');
  const tc = c.tContagem; quadros(30);
  ok(c.tContagem === tc, 'pausada, a corrida não anda');
  clica('[data-acao=continuar]');
  ok(!c.pausada && !visivel('#tela-pausa'), 'continuar fecha a pausa');
  ok(largada() >= 0 && c.estado === 'correndo', 'largada');
  ok($('.hud-contagem').textContent === 'VAI!', 'VAI! na largada');
  quadros(150);
  ok($('.hud-contagem').hidden, 'o VAI! some sozinho (tempo de simulação)');
  ok($('.hud-pos-n').textContent === String(j.posicao), `posição do HUD = a do jogador (${j.posicao}º)`);
  ok($('.hud-tempo').textContent === formataTempo(c.t), `tempo da corrida no HUD (${$('.hud-tempo').textContent})`);
  ok($('.hud-volta b').textContent === Math.min(c.voltas, Math.max(1, j.volta)) + '/' + c.voltas, 'volta no HUD');
  const carga = j.turbo ? j.turbo.carga : 0;
  ok(Math.abs(parseFloat($('.hud-turbo-barra b').style.width) - Math.round(carga * 100)) <= 1, `barra de turbo = carro.turbo.carga (${Math.round(carga * 100)}%)`);
  const decoPoder = $('#btn-poder .deco');
  if (decoPoder) {
    ok(decoPoder.querySelector('.pd-icone') && decoPoder.querySelector('.pd-icone').textContent === PODERES[j.cfg.poder].icone, 'botão PODER da fase 2 decorado com o ícone do poder');
    ok(decoPoder.querySelector('.pd-anel') && decoPoder.style.getPropertyValue('--p') !== '', 'anel de recarga no botão PODER');
  }
  const decoTurbo = $('#btn-turbo .deco');
  if (decoTurbo) ok(decoTurbo.querySelector('.tb-carga') && Math.abs(parseFloat(decoTurbo.querySelector('.tb-carga').style.height) - Math.round(carga * 100)) <= 1, 'botão TURBO mostra a carga');
  const cv = $('.hud-mapa'), px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let pintados = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) pintados++;
  ok(pintados > cv.width * cv.height * 0.03, `minimapa desenhado (${(100 * pintados / (cv.width * cv.height)).toFixed(0)}% do canvas)`);
  // avisos e efeitos
  G.hud.aviso('Teste!', 'bom', '✅');
  ok([...document.querySelectorAll('.hud-aviso')].some((a) => a.textContent.includes('Teste!')), 'aviso aparece');
  quadros(130);
  ok(![...document.querySelectorAll('.hud-aviso')].some((a) => a.textContent.includes('Teste!')), 'aviso some sozinho em ~1,7 s de simulação');
  emite('poder:acerta', { de: c.carros.find((x) => x !== j), alvo: j, poder: 'congelante' });
  ok(G.hud.historico.some((a) => a.texto.startsWith('Congelou')), 'poder recebido vira aviso ("Congelou!")');
  emite('carro:batida', { carro: j, outro: null, forca: 14, tipo: 'muro' });
  ok(G.hud.raiz.classList.contains('tremendo') && G.hud.flash.classList.contains('on'), 'batida forte: HUD treme e acende o clarão');
  quadros(40);
  ok(!G.hud.raiz.classList.contains('tremendo'), 'a tremida passa');
  emite('corrida:ultima_volta', { carro: j });
  ok(!G.hud.faixa.hidden, 'faixa de ÚLTIMA VOLTA!');
  const passoDosPoderes = c.poderes.passo.bind(c.poderes);
  c.poderes.passo = (dt) => { passoDosPoderes(dt); j.mod.visao = 1; };
  quadros(2);
  ok(Number(G.hud.fumaca.style.opacity) > 0.8, 'mod.visao > 0 cobre a tela de fumaça');
  c.poderes.passo = passoDosPoderes;
  quadros(2);
  ok(Number(G.hud.fumaca.style.opacity) === 0, 'sem fumaça, a tela limpa');
  // fim
  const seg = simulaAte(() => G.telas.atual === 'resultado', 400);
  ok(seg > 0, `a corrida terminou e o resultado apareceu (${seg.toFixed(1)} s de simulação)`);
  ok(!G.corrida && !G.hud.visivel && controles[controles.length - 1] === false, 'fim: corrida encerrada, HUD e controles escondidos');
  const linhas = document.querySelectorAll('.rs-tabela tbody tr');
  ok(linhas.length === 6 && document.querySelectorAll('.rs-tabela tr.eu').length === 1, 'tabela com as 6 posições e o jogador destacado');
  ok(G.jogo.progresso().corridas === 1, 'registraResultado contou a corrida uma vez');
  const res = G.telas.resultado.resultado;
  ok(res.jogador.tempo > 0 ? !!$('.tc-selo.recorde') : true, 'primeira corrida na pista = selo de recorde');
  ok(await esperaAte(() => G.telas.vitrine._noPodio.filter(Boolean).length === 3), 'pódio 3D com os três primeiros carros');
  ok(G.desenho && G.desenho.cena === G.telas.vitrine.cena && G.telas.vitrine.modo === 'podio', 'o laço desenha o pódio');
  ok($('.rs-titulo').textContent.length > 0 && document.querySelectorAll('.rs-estrelas span').length === 3, 'título e estrelas do resultado');
  mede('posição do jogador na corrida livre', res.jogador.posicao);
  clica('[data-acao=menu]');
  ok(G.telas.atual === 'menu' && !G.corrida, 'MENU volta ao menu');

  // ------------------------------------------------------------ campeonato
  clica('[data-acao=campeonato]');
  ok(G.telas.atual === 'selecao_carro' && G.telas.modo === 'campeonato_novo', 'campeonato sem progresso começa escolhendo o carro');
  clica('[data-acao=escolhe_carro]');
  const camp = G.jogo.progresso().campeonato;
  ok(G.telas.atual === 'campeonato' && camp && camp.indice === 0, 'campeonato criado na corrida 1');
  ok(document.querySelectorAll('.cp-tabela tbody tr').length === Math.min(CORRIDA.CORREDORES, CARROS.length), 'tabela de pontos com os participantes');
  ok(document.querySelectorAll('.cp-etapa').length === PISTAS.length && !!$('.cp-etapa.atual'), 'trilha das etapas com a atual marcada');
  clica('[data-acao=correr_campeonato]');
  ok(await esperaAte(() => G.corrida && G.corrida.estado === 'contagem' && G.telas.atual === 'corrida', 120000), 'corrida do campeonato carregou');
  const c2 = G.corrida, meu = camp.carro;
  ok(c2.opcoes.modo === 'campeonato' && c2.pista.id === PISTAS[0].id, 'corre a pista do índice do campeonato');
  ok(JSON.stringify(c2.opcoes.rivais) === JSON.stringify(rivaisDoCampeonato(meu)), 'rivais fixos do campeonato');
  const passoDaDif = c2.dificuldade.passo.bind(c2.dificuldade);
  c2.dificuldade.passo = (dt) => { passoDaDif(dt); for (const r of c2.carros) if (!r.ehJogador) r.mod.velMax *= 0.35; };
  ok(simulaAte(() => G.telas.atual === 'resultado', 400) > 0, 'corrida do campeonato terminou');
  const r2 = G.telas.resultado;
  const p2 = G.jogo.progresso();
  const somaEsperada = CORRIDA.PONTOS.slice(0, c2.carros.length).reduce((a, b) => a + b, 0);
  const soma = Object.values(p2.campeonato.pontos).reduce((a, b) => a + b, 0);
  ok(p2.campeonato.corridas === 1 && soma === somaEsperada, `pontos registrados (${soma} = ${somaEsperada})`);
  ok(r2.resultado.jogador.posicao <= 3, `jogador no pódio (${r2.resultado.jogador.posicao}º; rivais freados pela suíte)`);
  if (PISTAS.length > 1) {
    ok(p2.desbloqueadas === 2 && r2.resumo.desbloqueou === PISTAS[1].id && !!$('.tc-selo.desbloqueio'), 'pódio no campeonato desbloqueia a pista 2 (e o resultado avisa)');
    ok(p2.campeonato.indice === 1, 'o campeonato avança para a pista 2');
  } else ok(r2.resumo.fimDoCampeonato, 'com uma pista só, o pódio fecha o campeonato');
  clica('[data-acao=proxima]');
  ok(G.telas.atual === 'campeonato', 'CONTINUAR volta para a tabela do campeonato');
  const minhaLinha = $('.cp-tabela tr.eu .pts');
  ok(minhaLinha && Number(minhaLinha.textContent) === p2.campeonato.pontos[meu], `a tabela mostra os pontos do jogador (${minhaLinha && minhaLinha.textContent})`);
  if (PISTAS.length === 1) ok(!!$('.cp-campeao'), 'campeonato terminado: cerimônia de campeão');
  clica('[data-acao=menu]');

  // ------------------------------------------------------------ opcoes
  clica('[data-acao=opcoes]');
  ok(G.telas.atual === 'opcoes' && visivel('#tela-opcoes'), 'opções abrem');
  clica('[data-acao=op_direcao][data-valor=joystick]');
  ok(configs.some((o) => o.modo === 'joystick') && G.entrada.modo === 'joystick' && G.save.le('opcoes').controle === 'joystick', 'direção: joystick vai para a entrada e para o save');
  ok($('[data-acao=op_direcao][data-valor=joystick]').classList.contains('on'), 'o botão escolhido fica marcado');
  const acel0 = G.entrada.acelAuto;
  clica('[data-acao=op_acel_auto]');
  ok(G.entrada.acelAuto === !acel0 && G.save.le('opcoes').acelAuto === !acel0, 'aceleração automática liga/desliga na entrada e no save');
  clica('[data-acao=op_acel_auto]');
  clica('[data-acao=op_qualidade][data-valor=baixa]');
  ok(G.qualidade.nivel === 'baixa' && !G.qualidade.auto && G.save.le('opcoes').qualidade === 'baixa', 'qualidade manual: Baixa (desliga o auto)');
  ok(G.renderer.getPixelRatio() <= NIVEIS.baixa.pixelRatio + 1e-6, `pixelRatio aplicado no renderer (${G.renderer.getPixelRatio()})`);
  clica('[data-acao=op_qualidade][data-valor=auto]');
  ok(G.qualidade.auto && G.save.le('opcoes').qualidade === 'auto', 'qualidade de volta ao Auto');
  const faixa = $('[data-op=musica]');
  faixa.value = '30'; faixa.dispatchEvent(new Event('input', { bubbles: true })); faixa.dispatchEvent(new Event('change', { bubbles: true }));
  ok(G.save.le('opcoes').musica === 30 && Math.abs(G.audio.volumes.musica - 0.3) < 1e-9, 'volume da música grava e aplica no áudio');
  const efe = $('[data-op=efeitos]');
  efe.value = '55'; efe.dispatchEvent(new Event('change', { bubbles: true }));
  ok(G.save.le('opcoes').efeitos === 55 && Math.abs(G.audio.volumes.efeitos - 0.55) < 1e-9, 'volume dos efeitos grava e aplica');
  if (visivel('.op-vibracao')) {
    clica('[data-acao=op_vibracao]');
    ok(G.save.le('opcoes').vibracao === false && !G.vibracao.ligada, 'vibração desliga');
    clica('[data-acao=op_vibracao]');
    ok(G.save.le('opcoes').vibracao === true && G.vibracao.ligada, 'vibração liga');
  }
  ok($('.op-aviso').hidden === !G.save.falhou(), 'aviso de armazenamento só quando o save falhou');
  clica('[data-acao=apagar_progresso]');
  ok(visivel('#tela-confirma'), 'apagar progresso pede confirmação');
  clica('[data-acao=confirma_sim]');
  ok(G.jogo.progresso().corridas === 0 && G.save.le('opcoes').controle === 'joystick', 'apagou o progresso e manteve as opções');
  clica('[data-acao=op_direcao][data-valor=botoes]');
  clica('[data-acao=voltar]');
  ok(G.telas.atual === 'menu', 'voltar das opções leva ao menu');

  // ------------------------------------------------------------ regra do AUTO da qualidade
  const q = G.qualidade, ignora = q.ignora;
  q.ignora = false;
  q.define('auto', false);
  const mudancas = [];
  const desliga = on('qualidade:muda', (e) => mudancas.push(e.nivel));
  const cq = await corridaDeTeste({ pista: 'teste', voltas: 1, corredores: 6, auto: true });
  largada();
  const nivel0 = q.nivel;
  for (let k = 0; k < 60; k++) q.mede(1 / 30); // carencia: o comeco da corrida nao conta
  ok(q.nivel === nivel0, 'auto: os primeiros segundos depois da largada não contam');
  for (let k = 0; k < 200; k++) q.mede(1 / 30);
  const esperado = nivel0 === 'alta' ? 'media' : 'baixa';
  ok(q.nivel === esperado && mudancas.includes(esperado), `auto: ~30 fps por 3 s baixa um nível (${nivel0} -> ${q.nivel})`);
  for (let k = 0; k < 600; k++) q.mede(1 / 60);
  ok(q.nivel === esperado, 'auto: com 60 fps não mexe (e nunca sobe sozinho)');
  if (q.nivel !== 'baixa') { for (let k = 0; k < 400; k++) q.mede(1 / 30); }
  ok(q.nivel === 'baixa', 'auto: continuando lento, chega na baixa');
  for (let k = 0; k < 400; k++) q.mede(1 / 40);
  ok(q.limiteFps === 30, 'auto: na baixa ainda abaixo de 45 fps, trava em 30 fps');
  ok(G.save.le('qualidade_auto').nivel === 'baixa', 'o nível aprendido fica guardado para a próxima vez');
  desliga();
  G.jogo.encerraCorrida();
  q.define('auto', false);
  q.ignora = ignora;
  ok(q.limiteFps === 60 && q.trocas.length >= 2, 'escolher Auto de novo esquece o aprendido');
  void cq;

  // ------------------------------------------------------------ corrida direta (?pista=), reiniciar e sair pela pausa
  const outro = CARROS.find((x) => x.id !== G.jogo.carroEscolhido) || CARROS[0];
  G.telas.mostra('corrida_direta', { pista: PISTAS[0].id, carro: outro.id });
  ok(await esperaAte(() => G.corrida && G.telas.atual === 'corrida', 120000), 'mostra("corrida_direta") larga sem passar pelos menus');
  const c3 = G.corrida;
  ok(c3.jogador.cfg.id === outro.id, `com o carro pedido (${outro.nome})`);
  clica('[data-acao=pausar]');
  clica('[data-acao=reiniciar]');
  ok(await esperaAte(() => G.corrida && G.corrida !== c3 && G.telas.atual === 'corrida', 120000), 'reiniciar pela pausa começa uma corrida nova');
  ok(G.corrida.jogador.cfg.id === outro.id && G.corrida.estado === 'contagem' && !G.corrida.pausada, 'mesmas opções, na contagem, sem pausa');
  clica('[data-acao=pausar]');
  clica('[data-acao=sair]');
  ok(G.telas.atual === 'menu' && !G.corrida && !G.hud.visivel, 'sair pela pausa volta ao menu e desmonta a corrida');
  ok(G.jogo.progresso().corridas === 0, 'corrida abandonada não conta resultado');

  // ------------------------------------------------------------ evento de cada tela
  for (const t of ['menu', 'selecao_carro', 'selecao_pista', 'carregando_corrida', 'corrida', 'pausa', 'resultado', 'campeonato', 'opcoes']) {
    if (!telas.includes(t)) ok(false, 'jogo:tela não saiu para ' + t);
  }
  ok(true, `jogo:tela emitido em ${new Set(telas).size} telas diferentes`);
  G.entrada.mostraControles = mostraOrig;
  G.entrada.configura = configOrig;
});
