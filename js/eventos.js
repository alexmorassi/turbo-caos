// BARRAMENTO DE EVENTOS (fase 1, fundacao). O mesmo do dinotrails-web: quem faz uma coisa EMITE, quem reage OUVE — a fisica nao
// precisa saber que existe som, vibracao ou HUD para que a batida vibre o celular e mostre "PAM!". A lista dos eventos e os dados de
// cada um estao em docs/CONTRATOS.md secao 3.
const ouvintes = new Map();

/** Ouve um evento. Devolve a funcao que desliga (use no destroi() de quem ouviu: a corrida acaba e o sistema dela tem de calar). */
export function on(nome, fn) {
  let lista = ouvintes.get(nome);
  if (!lista) { lista = []; ouvintes.set(nome, lista); }
  lista.push(fn);
  return () => { const i = lista.indexOf(fn); if (i >= 0) lista.splice(i, 1); };
}

/** Avisa todo mundo. Erro num ouvinte nao derruba o jogo nem os outros ouvintes (vai para o console, que reprova o teste). */
export function emite(nome, dados) {
  const lista = ouvintes.get(nome);
  if (!lista || !lista.length) return;
  for (const fn of lista.slice()) {
    try { fn(dados || {}); } catch (e) { console.error('evento ' + nome + ':', e); }
  }
}

/** Entre duas suites de teste: ninguem do mundo antigo responde pelo novo. */
export function limpaOuvintes() { ouvintes.clear(); }
