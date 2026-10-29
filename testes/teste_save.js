// SUITE DO SALVAMENTO (fase 6): com o localStorage levantando excecao EM TUDO (o simples acesso, como em file:// e no modo privativo),
// o jogo ABRE, CORRE e MOSTRA O RESULTADO — o pedido: "se o salvamento falhar, o jogo continua funcionando".
//
// DUAS PARTES:
//   1. unidade, nesta pagina: o getter de window.localStorage levanta SecurityError; le/grava/remove/apaga/opcoes nao levantam e a copia
//      em memoria responde; depois, so o setItem levanta (cota cheia do celular);
//   2. o JOGO INTEIRO num iframe aberto com ?sem_armazenamento=1 (o js/save.js quebra o localStorage antes de qualquer modulo tocar
//      nele): o boot de verdade, o menu, um clique ate a pista, a corrida no piloto automatico, o resultado e o aviso nas opcoes. O
//      console do iframe chega ao runner: qualquer erro la dentro tambem reprova.
import { suite, ok, apagaProgresso } from './harness.js';
import * as save from '../js/save.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperaAte(cond, ms = 60000) {
  const t0 = performance.now();
  while (!cond()) { if (performance.now() - t0 > ms) return false; await espera(30); }
  return true;
}

suite('save', async (G) => {
  apagaProgresso();

  // ------------------------------------------------------------ 1a. o simples acesso levanta
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('armazenamento negado (suite)', 'SecurityError'); } });
  let caiu = null;
  try {
    let lancou = false; try { void window.localStorage.length; } catch (e) { lancou = true; }
    ok(lancou, 'localStorage levanta SecurityError no acesso (como em file:// e no privativo)');
    save.apaga();
    ok(save.le('nada', 7) === 7, 'le() devolve o padrão');
    ok(save.grava('x', { a: 1 }) === false, 'grava() devolve false sem levantar');
    ok(save.le('x').a === 1, 'a cópia em memória responde');
    const v = save.le('x'); v.a = 99;
    ok(save.le('x').a === 1, 'le() devolve cópia (quem mexe no objeto não estraga o salvo)');
    save.remove('x');
    ok(save.le('x', null) === null, 'remove() tira da memória');
    ok(save.falhou(), 'falhou() avisa a tela de opções');
    const o = save.mudaOpcoes({ musica: 40 });
    ok(o.musica === 40 && save.opcoes().musica === 40 && save.opcoes().efeitos === save.OPCOES_PADRAO.efeitos, 'opções com os padrões preenchidos, sem armazenamento');
    const p = G.jogo.progresso();
    ok(p.desbloqueadas === 1 && p.corridas === 0, 'progresso inicial válido sem armazenamento');
    G.jogo.escolheCarro(G.jogo.carroEscolhido);
    ok(save.le('carro') === G.jogo.carroEscolhido, 'escolher carro vale na memória');
  } catch (e) { caiu = e; }
  if (original) Object.defineProperty(window, 'localStorage', original); else delete window.localStorage;
  ok(!caiu, 'nenhuma função do save levantou exceção' + (caiu ? ': ' + caiu : ''));

  // ------------------------------------------------------------ 1b. so o setItem levanta (cota cheia)
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { throw new DOMException('cota cheia (suite)', 'QuotaExceededError'); };
  let caiu2 = null;
  try {
    ok(save.grava('cheio', [1, 2, 3]) === false && save.le('cheio')[2] === 3, 'cota cheia: grava() falha calado e a memória segura');
  } catch (e) { caiu2 = e; }
  Storage.prototype.setItem = setItem;
  ok(!caiu2, 'cota cheia não levanta exceção');
  save.apaga();

  // ------------------------------------------------------------ 2. o jogo inteiro com o armazenamento quebrado desde o boot
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;left:0;top:0;width:720px;height:405px;border:0;z-index:999;background:#000';
  fr.src = 'index.html?mudo=1&semente=11&voltas=1&corredores=6&auto=1&sem_armazenamento=1';
  document.body.appendChild(fr);
  const W = () => fr.contentWindow;
  const abriu = await esperaAte(() => W() && (W().__pronto === true || W().__erro), 120000);
  ok(abriu && !W().__erro, 'o jogo ABRE com o localStorage quebrado' + (W() && W().__erro ? ': ' + W().__erro : ''));
  if (!abriu || W().__erro) { fr.remove(); return; }
  const F = W().G, D = W().document;
  let lancou = false; try { void W().localStorage; } catch (e) { lancou = true; }
  ok(lancou, 'dentro do iframe o localStorage levanta no acesso (?sem_armazenamento=1)');
  ok(F.save.falhou(), 'a sonda do boot já sabe que o armazenamento falhou');
  ok(await esperaAte(() => F.telas.atual === 'menu', 30000), 'menu na tela');
  const clica = (sel) => { const b = D.querySelector(sel); if (!b) throw new Error('nao achei ' + sel); b.click(); };
  clica('[data-acao=livre]');
  clica('[data-acao=escolhe_carro]');
  clica('.sp-cartao:not(.bloqueada)');
  ok(await esperaAte(() => F.corrida && F.telas.atual === 'corrida', 120000), 'a corrida carrega');
  const c = F.corrida;
  for (let k = 0; k < 60 * 400 && F.telas.atual !== 'resultado'; k++) F.passo(F.PASSO);
  ok(F.telas.atual === 'resultado' && c.estado === 'terminou', 'CORRE até o fim e MOSTRA O RESULTADO');
  ok(D.querySelectorAll('.rs-tabela tbody tr').length === 6, 'tabela do resultado com os 6 carros');
  ok(F.jogo.progresso().corridas === 1, 'o progresso da corrida vale na memória');
  clica('[data-acao=menu]');
  clica('[data-acao=opcoes]');
  ok(!D.querySelector('.op-aviso').hidden, 'as opções avisam, discretas, que o progresso não fica guardado');
  clica('[data-acao=op_qualidade][data-valor=baixa]');
  ok(F.qualidade.nivel === 'baixa', 'e as opções continuam funcionando');
  fr.remove();
  await espera(100);
});
