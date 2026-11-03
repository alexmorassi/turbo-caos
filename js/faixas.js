// FAIXAS DO SUNO (02/11/2026): a musica de verdade do menu, do podio e de cada pista — um MP3 com UM LOOP pronto por faixa
// (tools/musica/prepara.py: emenda alinhada no ritmo e misturada no fim, 1 compasso de folga de cada lado; os pontos do loop estao
// em config/musicas.js). Quem toca e o js/audio.js, num AudioBufferSourceNode com loopStart/loopEnd; este modulo so busca, decodifica
// e guarda. A musica sintetizada (js/musica.js) continua de reserva: pista sem faixa, arquivo que nao chegou a tempo ou nao
// decodificou, e `?musica=sintetizada`.
//
// DE ONDE VEM O ARQUIVO: os mesmos tres caminhos do carregaGLB (js/glb.js) — embutido em base64 no HTML unico (em file:// nao ha
// fetch), modulo `<arquivo>.js` no artefato (o servidor do claude.ai nao entrega .mp3; o tools/monta.js gera os modulos) e HTTP no
// desenvolvimento e no GitHub Pages.
//
// MEMORIA: o MP3 tem ~1,5 MB, mas decodificado vira float32 — 100 s x 48 kHz x 2 canais x 4 bytes = 38 MB. Ficam no maximo
// DECODIFICADAS_MAX na memoria (a que toca e a que sai no crossfade); a proxima derruba a usada ha mais tempo que nao esta tocando.
// Os bytes do MP3 ficam guardados (sao pouco) para decodificar de novo sem buscar outra vez.
//
// O AudioBuffer e de quem o decodificou so na taxa: decodeAudioData converte para a taxa do contexto. Por isso a decodificacao e
// feita pelo contexto que vai tocar (o js/audio.js so cria o dele no primeiro gesto); antes disso so os bytes sao buscados.
import { MUSICAS } from '../config/musicas.js';
import { embutido, base64ParaBuffer } from './glb.js';

/** Faixas decodificadas na memoria ao mesmo tempo (ver o cabecalho). */
export const DECODIFICADAS_MAX = 2;

const _bytes = new Map();       // id -> Promise<ArrayBuffer>
const _decodificadas = new Map(); // id -> { ctx, promessa, buffer, uso }
const _falsas = new Map();      // id -> () => Promise<ArrayBuffer> (so as suites: arquivo que falha sem erro de rede no console)
let _relogio = 0;

/** A faixa de um pedido de musica: 'menu', 'podio', o id de uma pista ou a propria pista/definicao ({ id }). null = nao ha faixa. */
export function idDaFaixa(tema) {
  const id = typeof tema === 'string' ? tema : tema && typeof tema.id === 'string' ? tema.id : null;
  return id && Object.prototype.hasOwnProperty.call(MUSICAS, id) ? id : null;
}

/** A linha de config/musicas.js da faixa (arquivo, inicio e fim do loop, ganho). */
export function dadosDaFaixa(id) { return MUSICAS[id] || null; }

/** Os bytes do MP3 (promessa guardada: pedir de novo nao busca de novo; se falhou, o proximo pedido tenta outra vez). */
export function buscaFaixa(id) {
  if (_bytes.has(id)) return _bytes.get(id);
  const m = MUSICAS[id];
  let p;
  if (!m) p = Promise.reject(new Error('faixa desconhecida: ' + id));
  else if (_falsas.has(id)) p = _falsas.get(id)();
  else {
    const el = embutido(m.arquivo);
    if (el) p = Promise.resolve().then(() => base64ParaBuffer(el.textContent));
    else if (typeof window !== 'undefined' && window.__glbComoModulo) {
      // caminho numa variavel (o esbuild do HTML unico nao tenta empacotar) e relativo a pagina, como no carregaGLB
      const url = new URL(m.arquivo + '.js', document.baseURI).href;
      p = import(url).then((mod) => base64ParaBuffer(mod.default));
    } else {
      p = fetch(m.arquivo).then((r) => {
        if (!r.ok) throw new Error(`faixa ${id}: HTTP ${r.status}`);
        return r.arrayBuffer();
      });
    }
  }
  _bytes.set(id, p);
  p.catch(() => _bytes.delete(id));
  return p;
}

/** decodeAudioData nas duas formas (o Safari antigo so tem a de callback). Recebe uma COPIA: a decodificacao toma posse do buffer. */
function decodifica(ctx, bytes) {
  return new Promise((ok, erro) => {
    let feito = false;
    const sim = (b) => { if (!feito) { feito = true; ok(b); } };
    const nao = (e) => { if (!feito) { feito = true; erro(e || new Error('decodeAudioData falhou')); } };
    try {
      const r = ctx.decodeAudioData(bytes.slice(0), sim, nao);
      if (r && typeof r.then === 'function') r.then(sim, nao);
    } catch (e) { nao(e); }
  });
}

/** A faixa decodificada por `ctx` (promessa). `tocando`: ids que nao podem sair da memoria agora. */
export function decodificaFaixa(ctx, id, tocando = []) {
  const d = _decodificadas.get(id);
  if (d && d.ctx === ctx) { d.uso = ++_relogio; return d.promessa; }
  const novo = { ctx, buffer: null, uso: ++_relogio, promessa: null };
  novo.promessa = buscaFaixa(id).then((b) => decodifica(ctx, b)).then((buf) => {
    novo.buffer = buf;
    return buf;
  });
  _decodificadas.set(id, novo);
  novo.promessa.catch(() => { if (_decodificadas.get(id) === novo) _decodificadas.delete(id); });
  // o teto: sai a usada ha mais tempo que nao esta tocando (a que acabou de entrar nunca)
  while (_decodificadas.size > DECODIFICADAS_MAX) {
    let velha = null;
    for (const [k, v] of _decodificadas) if (k !== id && !tocando.includes(k) && (!velha || v.uso < velha[1].uso)) velha = [k, v];
    if (!velha) break;
    _decodificadas.delete(velha[0]);
  }
  return novo.promessa;
}

/** A faixa ja decodificada por `ctx`, ou null (sem esperar). */
export function faixaPronta(ctx, id) {
  const d = _decodificadas.get(id);
  return d && d.ctx === ctx && d.buffer ? d.buffer : null;
}

/** Quantas faixas estao decodificadas agora (as suites conferem o teto). */
export function decodificadas() { return [..._decodificadas.keys()]; }

/** So as suites: troca o arquivo de uma faixa por uma funcao que devolve os bytes (null desfaz), e esquece tudo o que foi guardado. */
export function _falsificaFaixa(id, fn) {
  if (fn) _falsas.set(id, fn); else _falsas.delete(id);
  _bytes.delete(id);
  _decodificadas.delete(id);
}
export function _esqueceFaixas() { _bytes.clear(); _decodificadas.clear(); }
