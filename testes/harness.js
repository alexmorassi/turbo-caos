// HARNESS DAS SUITES (fase 1, fundacao). O mesmo do dinotrails-web (testes/harness.js de la), com uma diferenca que vale ouro:
// a suite MANDA no tempo. Com `?teste=<nome>` na URL o requestAnimationFrame de js/main.js nao chama `G.passo`; quem chama e
// `quadros(n)`. Uma corrida de 3 voltas inteira roda em segundos e da o mesmo resultado em qualquer maquina.
//
// FORMATO DA SAIDA (o mesmo dos outros jogos do Morassi):
//   [OK]   nome: mensagem
//   [ERRO] nome: mensagem
//   [MEDE] nome: medida = valor      <- medida, nunca reprova
//   FALHAS: n                        <- a ultima linha; e o que o runner le (window.__resultado)
//
// TRES COISAS QUE SEMPRE PEGAM:
//   1. espere o jogo estar pronto antes de tocar em G — `suite()` faz isso;
//   2. APAGUE O PROGRESSO (`apagaProgresso()`) no comeco: recorde/desbloqueio antigo muda o resultado;
//   3. corrida nova: `corridaDeTeste()` espera a carga e devolve a corrida ja na contagem; `largada()` pula a contagem.
import { limpaOuvintes } from '../js/eventos.js';

let nomeDaSuite = 'suite';
let falhas = 0;
const linhas = [];

function jogo() { return window.G; }

/** Uma assercao. Imprime e conta. */
export function ok(condicao, msg) {
  const linha = (condicao ? '[OK]   ' : '[ERRO] ') + nomeDaSuite + ': ' + msg;
  linhas.push(linha);
  if (condicao) console.log(linha); else { falhas++; console.error(linha); }
  return !!condicao;
}

/** Igualdade com folga (metro e segundo em float: `ok(a === b)` e armadilha). */
export function perto(a, b, tol, msg) { return ok(Math.abs(a - b) <= tol, `${msg} (${Number(a).toFixed(3)} ~ ${b} +-${tol})`); }

/** Uma MEDIDA: entra no relatorio e nunca reprova. */
export function mede(nome, valor) {
  const linha = `[MEDE] ${nomeDaSuite}: ${nome} = ${typeof valor === 'number' ? valor.toFixed(3) : valor}`;
  linhas.push(linha); console.log(linha);
  return valor;
}

/** Avanca `n` passos de simulacao (1/60 s cada). */
export function quadros(n) { const G = jogo(); for (let i = 0; i < n; i++) G.passo(G.PASSO); return G.relogio.t; }
/** Avanca `s` segundos de simulacao. */
export function segundos(s) { return quadros(Math.max(1, Math.round(s * 60))); }

/** Roda ate `cond()` ser verdade ou passar `maxSeg` de simulacao. Devolve os segundos simulados (ou -1 se estourou). A cada
 *  `desenhaACada` passos desenha um quadro (pega erro de shader/malha que so aparece desenhando) — 0 = nunca. */
export function simulaAte(cond, maxSeg, desenhaACada = 0) {
  const G = jogo(), max = Math.round(maxSeg * 60);
  for (let k = 0; k < max; k++) {
    if (cond()) return k / 60;
    G.passo(G.PASSO);
    if (desenhaACada && k % desenhaACada === 0) G.quadro(G.PASSO);
  }
  return cond() ? max / 60 : -1;
}

/** Segura uma acao (continua baixa ate `solta`). */
export function segura(acao, v = 1) { const e = jogo().entrada; e.simulada = true; e.estado[acao] = v; }
export function solta(acao) { const e = jogo().entrada; e.simulada = true; e.estado[acao] = 0; }
/** Um TOQUE: desce, um passo (e nele que `apertou()` e verdadeiro), sobe. */
export function aperta(acao) { segura(acao); quadros(1); solta(acao); }
/** Devolve o controle ao teclado/toque de verdade. */
export function entradaDeVolta() { const e = jogo().entrada; e.simulada = false; for (const k of Object.keys(e.estado)) e.estado[k] = 0; }

/** Apaga o progresso salvo. CHAME NO COMECO DE TODA SUITE. */
export function apagaProgresso() { jogo().save.apaga(); }

/** Corrida pronta para medir: { pista ('teste' padrao), carro, corredores, voltas, modo, auto (IA dirige o jogador) }.
 *  Devolve a corrida na contagem (use `largada()` para pular). `def` aceita uma definicao de pista feita na propria suite. */
export async function corridaDeTeste(op = {}) {
  const G = jogo();
  G.flags.auto = !!op.auto;
  const c = await G.jogo.iniciaCorrida({ pista: op.pista || 'teste', def: op.def, carro: op.carro, corredores: op.corredores || 6, voltas: op.voltas || 3, modo: op.modo || 'livre', rivais: op.rivais });
  return c;
}

/** Pula a contagem: roda os passos ate a largada. */
export function largada() {
  const G = jogo();
  return simulaAte(() => G.corrida && G.corrida.estado === 'correndo', 10);
}

/** Espera o boot terminar (`window.__pronto`). */
async function esperaPronto(limiteMs = 90000) {
  const t0 = Date.now();
  while (!window.__pronto || !window.G) {
    if (window.__erro) throw new Error('o jogo nao abriu: ' + window.__erro);
    if (Date.now() - t0 > limiteMs) throw new Error('o jogo nao ficou pronto em ' + limiteMs + ' ms');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Declara e roda uma suite. `corpo(G)` pode ser async. */
export function suite(nome, corpo) {
  nomeDaSuite = nome; falhas = 0; linhas.length = 0;
  const p = (async () => {
    try {
      await esperaPronto();
      console.log(`=== ${nome} ===`);
      await corpo(window.G);
    } catch (e) {
      falhas++;
      const linha = '[ERRO] ' + nome + ': explodiu — ' + (e && (e.stack || e.message || e));
      linhas.push(linha); console.error(linha);
    }
    try { entradaDeVolta(); } catch (e) { /* entrada ainda nao existe */ }
    console.log('FALHAS: ' + falhas);
    window.__resultado = { suite: nome, falhas, linhas: [...linhas] };
    return window.__resultado;
  })();
  window.__suite = p;
  return p;
}

/** Entre duas corridas na mesma suite: zera os ouvintes do mundo antigo. */
export function limpaTudo() { limpaOuvintes(); }
