// SALVAMENTO (fase 1, fundacao; ampliado pela fase 6 sem mudar a API le/grava/apaga/falhou). localStorage com try/catch EM TUDO: em
// file:// e no modo privativo o simples acesso ao localStorage levanta SecurityError (armadilha do dinotrails-web), celular com
// armazenamento cheio levanta no setItem, e o artefato do claude.ai roda num iframe que pode nao ter armazenamento nenhum.
// Se falhar, a copia em memoria segura o jogo ate fechar a aba — o pedido: "se o salvamento falhar, o jogo continua funcionando".
//
// O QUE A FASE 6 ACRESCENTOU (e por que):
//   * SONDA no carregamento: antes, `falhou()` so virava true depois do primeiro grava() que quebrasse — e a tela de opcoes so podia
//     avisar "o progresso nao vai ficar guardado" depois que a crianca ja tinha perdido uma corrida. Agora a primeira leitura ja sabe.
//   * `?sem_armazenamento=1`: faz o localStorage levantar excecao no simples acesso, igual ao file:// e ao modo privativo. Existe para o
//     teste_save abrir o jogo INTEIRO (num iframe) com o armazenamento quebrado desde o primeiro modulo — e para o Morassi ver o aviso.
//   * OPCOES num lugar so (`opcoes()` / `mudaOpcoes()`): audio, vibracao, qualidade e as telas leem as mesmas opcoes com os mesmos
//     padroes; cada um com o seu `le('opcoes')` e o seu padrao era o caminho para o volume da tela mostrar um numero e tocar outro.
//
// Chaves usadas (todas com o prefixo `turbocaos.`): progresso (js/jogo.js), carro (js/jogo.js), opcoes (fase 6), qualidade_auto (fase 6,
// o nivel que o modo AUTO aprendeu neste aparelho), campeonato_fim (fase 6), dda (fase 5), recordes (dentro de progresso).
const PREFIXO = 'turbocaos.';
const memoria = new Map();
let quebrado = false;

/** Opcoes da tela de opcoes e os padroes de cada uma. `controle` e `acelAuto` sao os MESMOS campos que a entrada (fase 2, js/entrada.js)
 *  le e grava nesta chave; null quer dizer "o padrao da entrada" (botoes; aceleracao automatica LIGADA para crianca). */
export const OPCOES_PADRAO = {
  musica: 70,          // 0..100 — a musica mora abaixo dos efeitos (regra do Breno: MUSIC_VOL 0,18 contra SFX_VOL 0,5)
  efeitos: 90,         // 0..100
  vibracao: true,
  qualidade: 'auto',   // 'auto' | 'baixa' | 'media' | 'alta'
  controle: null,      // null | 'botoes' | 'joystick' | 'inclinacao' (campo da fase 2)
  acelAuto: null,      // null | true | false (campo da fase 2)
};

// ---------------------------------------------------------------- armazenamento quebrado de proposito (?sem_armazenamento=1)
if (typeof location !== 'undefined' && /[?&]sem_armazenamento=1(&|$)/.test(location.search)) {
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('armazenamento desligado por ?sem_armazenamento=1', 'SecurityError'); },
    });
  } catch (e) { /* navegador que nao deixa redefinir: segue com o armazenamento de verdade */ }
}

// ---------------------------------------------------------------- sonda (ver o cabecalho)
(function sonda() {
  try {
    const k = PREFIXO + '__sonda';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
  } catch (e) { quebrado = true; }
})();

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

/** Apaga UMA chave (o "apagar progresso" das opcoes tira o progresso e deixa as opcoes). */
export function remove(chave) {
  memoria.delete(chave);
  try { localStorage.removeItem(PREFIXO + chave); } catch (e) { quebrado = true; }
}

/** true se o armazenamento falhou alguma vez (a tela de opcoes avisa "o progresso nao sera salvo"). */
export function falhou() { return quebrado; }

/** As opcoes com os padroes preenchidos (campo novo de uma versao nova nasce com o padrao). */
export function opcoes() {
  const o = le('opcoes', null);
  return o && typeof o === 'object' ? { ...OPCOES_PADRAO, ...o } : { ...OPCOES_PADRAO };
}

/** Muda algumas opcoes e grava. Devolve as opcoes completas. */
export function mudaOpcoes(parcial) {
  const o = { ...opcoes(), ...parcial };
  grava('opcoes', o);
  return o;
}

function clona(v) { return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)); }
