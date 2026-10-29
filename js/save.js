// SALVAMENTO (fase 1, fundacao; a fase 6 pode ampliar). localStorage com try/catch EM TUDO: em file:// e no modo privativo o simples
// acesso ao localStorage levanta SecurityError (armadilha do dinotrails-web), e celular com armazenamento cheio levanta no setItem.
// Se falhar, a copia em memoria segura o jogo ate fechar a aba — o pedido: "se o salvamento falhar, o jogo continua funcionando".
const PREFIXO = 'turbocaos.';
const memoria = new Map();
let quebrado = false;

/** Le um valor (JSON). Devolve `padrao` se nao houver ou se o armazenamento falhar. */
export function le(chave, padrao = null) {
  if (memoria.has(chave)) return clona(memoria.get(chave));
  try {
    const t = localStorage.getItem(PREFIXO + chave);
    if (t === null) return padrao;
    const v = JSON.parse(t);
    memoria.set(chave, v);
    return clona(v);
  } catch (e) { quebrado = true; return padrao; }
}

/** Grava um valor (JSON). Nunca levanta excecao; devolve true se chegou ao armazenamento de verdade. */
export function grava(chave, valor) {
  memoria.set(chave, clona(valor));
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); return true; } catch (e) { quebrado = true; return false; }
}

/** Apaga tudo do jogo (as suites chamam no comeco: conquista/recorde antigo infla o resultado). */
export function apaga() {
  memoria.clear();
  try {
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIXO)) chaves.push(k); }
    for (const k of chaves) localStorage.removeItem(k);
  } catch (e) { quebrado = true; }
}

/** true se o armazenamento falhou alguma vez (a tela de opcoes avisa "o progresso nao sera salvo"). */
export function falhou() { return quebrado; }

function clona(v) { return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)); }
