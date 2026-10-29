// HUD DA CORRIDA (fase 6; contrato em docs/CONTRATOS.md secao 10): posicao enorme, volta, tempo, barra de turbo, minimapa, contagem
// 3-2-1-VAI, faixa de ULTIMA VOLTA, avisos curtos dos eventos, fumaca na tela (mod.visao), gelo na borda, tremida e clarão na batida —
// e a DECORACAO dos botoes de toque da fase 2 (#btn-turbo e #btn-poder trazem um filho .deco vazio: aqui ele ganha o icone do poder,
// o anel de recarga e a carga do turbo).
//
// COMO (e por que):
//   * DOM por cima do canvas, como no Cidade Aberta e no Breno: texto nitido em qualquer tela e nada de three.js aqui;
//   * o DOM so e escrito quando o valor MUDA (posicao, volta, decimo de segundo, 1% de turbo): escrever no DOM 60 vezes por segundo
//     derruba o celular fraco mais que o desenho 3D;
//   * TEMPO DE SIMULACAO para tudo que some sozinho (aviso, VAI!, faixa, tremida): com ?teste= o harness anda o tempo — um setTimeout
//     faria o aviso durar 1,7 s de relogio enquanto a suite simula 30 s numa piscada;
//   * os ouvintes dos eventos nascem no `mostra(corrida)` e morrem no `esconde()`: o HUD fala so da corrida que esta na tela;
//   * o botao de PAUSA nao mora aqui: fica no #ui (js/telas.js), a camada de cima — os controles de toque da fase 2 (#controles)
//     ficam entre o #hud e o #ui e uma zona de toque larga engoliria um botao do #hud.
// Pouco texto e muito icone: o publico comeca nos 6 anos. Cada aviso tem um emoji e no maximo tres palavras.
import { on } from './eventos.js';
import { PODERES, ORDEM_DOS_PODERES } from '../config/poderes.js';
import { Minimapa } from './minimapa.js';

/** Quanto um aviso fica na tela (s) — o mesmo da animacao CSS hud-aviso. */
const AVISO_DURA = 1.7;
/** No maximo tres avisos empilhados: o quarto empurra o mais velho (batida + poder + capsula no mesmo segundo). */
const MAX_AVISOS = 3;
/** O mesmo texto nao repete antes de (s): a crianca batendo no muro tres vezes nao ganha tres "PAM!". */
const AVISO_REPETE = 0.9;
/** O minimapa redesenha a cada N passos (20 Hz): os pontos andam liso e o celular nao paga 60 redesenhos. */
const MINIMAPA_A_CADA = 3;
/** Os icones de efeito ativo sao conferidos a cada N passos. */
const EFEITOS_A_CADA = 6;
/** O "VAI!" fica (s); a faixa de ultima volta fica (s) — o mesmo da animacao CSS. */
const VAI_DURA = 0.9;
const FAIXA_DURA = 2.6;
/** Batida que treme o HUD e acende o clarão vermelho (m/s, a forca de carro:batida). */
const BATIDA_TREME = 7;
const TREME_DURA = 0.36;
const TREME_INTERVALO = 0.8;
/** Intervalo minimo entre dois "subiu de posicao" (s): na largada a grade se embaralha e soaria como metralhadora. */
const ULTRAPASSAGEM_INTERVALO = 1.2;
/** Onomatopeias da batida forte, em rodizio (sem sorteio: o HUD nao mexe no Math.random da bateria). */
const PAM = ['PAM!', 'BUM!', 'CRASH!', 'POW!'];
/** Intervalo minimo entre duas onomatopeias de batida (s). */
const BATIDA_AVISO_INTERVALO = 1.5;

/** Classe da barra de turbo por bits (1 cheio, 2 ativo, 4 vazio): pronta de antemao, o passo so indexa (nada alocado no passo). */
const CLASSES_DO_TURBO = Array.from({ length: 8 }, (_, b) => (b & 1 ? ' cheio' : '') + (b & 2 ? ' ativo' : '') + (b & 4 ? ' vazio' : ''));
/** Icones dos efeitos sobre o jogador, na ordem dos bits da mascara (os 5 da fisica/mod e depois um por poder). */
const ICONES_DOS_EFEITOS = ['❄️', '🌀', '🌪️', '⚡', '🔻', ...ORDEM_DOS_PODERES.map((id) => PODERES[id].icone)];

/** Aviso quando o JOGADOR e o alvo de um poder: [icone, texto]. */
const RECEBEU = {
  oleo: ['🛢️', 'Óleo! Segura!'], emp: ['⚡', 'Turbo desligado!'], congelante: ['❄️', 'Congelou! Toque PODER!'],
  ima: ['🧲', 'Ímã te puxando!'], trocatroca: ['🔄', 'Trocaram com você!'], encolhedor: ['🔻', 'Você encolheu!'],
  fumaca: ['💨', 'Fumaça!'], tornado: ['🌪️', 'Tornado!'], escudo: ['🛡️', 'Escudo!'], terremoto: ['🌋', 'Terremoto!'],
};

/** "1:23.4" (m:ss.d). Sem tempo valido: "-:--.-". */
export function formataTempo(s) {
  if (!(s > 0) || !Number.isFinite(s)) return '-:--.-';
  const d = Math.floor(s * 10 + 1e-6), m = Math.floor(d / 600), seg = Math.floor((d % 600) / 10), dec = d % 10;
  return m + ':' + String(seg).padStart(2, '0') + '.' + dec;
}

const el = (tag, classe, texto) => { const e = document.createElement(tag); if (classe) e.className = classe; if (texto != null) e.textContent = texto; return e; };

export class HUD {
  constructor(G) {
    this.G = G;
    this.corrida = null;
    this.visivel = false;
    /** avisos mostrados nesta corrida: [{ texto, tipo }] (as suites conferem) */
    this.historico = [];
    this._desligar = [];
    this._avisos = [];
    this._ultimo = {};
    this._passos = 0;
    this._pam = 0;
    this._monta();
  }

  /** Mostra o HUD de uma corrida (as telas chamam no `corrida:carregada`). */
  mostra(corrida) {
    if (this.corrida) this.esconde();
    this.corrida = corrida;
    this.visivel = true;
    this.historico.length = 0;
    this._ultimo = { pos: -1, volta: -1, voltas: -1, dec: -1, turbo: -1, turboBits: -1, poder: -1, efeitos: -1, visao: -1, gelo: -1, de: -1 };
    this._ultimaPosicao = null;
    this._ultimaSubida = -1e9;
    this._turboCheioAvisado = true;   // so avisa depois que o turbo baixar de cheio uma vez
    this._poderProntoAvisado = true;
    this._tContagem = 0; this._tFaixa = 0; this._tTreme = 0; this._ultimaBatida = -1e9; this._ultimoTreme = -1e9;
    this._decoTurbo = this._decoPoder = null;
    this.raiz.hidden = false;
    this.contagem.hidden = true;
    this.faixa.hidden = true;
    this.fumaca.style.opacity = '0';
    this.gelo.style.opacity = '0';
    for (const a of this._avisos) a.el.remove();
    this._avisos.length = 0;
    // o minimapa mede o canvas: so depois de visivel
    try { this.minimapa.monta(corrida.pista); } catch (e) { console.error('[hud] minimapa', e); }
    this._ouve(corrida);
    this.passo(0);
  }

  esconde() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    this.corrida = null;
    this.visivel = false;
    if (this.raiz) this.raiz.hidden = true;
    for (const a of this._avisos) a.el.remove();
    this._avisos.length = 0;
    this._decoTurbo = this._decoPoder = null;
  }

  /** Aviso curto no meio-alto da tela. tipo: 'info' | 'bom' | 'ruim' | 'poder' | 'turbo' | 'ouro'. */
  aviso(texto, tipo = 'info', icone = null) {
    if (!this.visivel || !texto) return;
    const agora = this.G.relogio ? this.G.relogio.t : 0;
    const chave = (icone || '') + texto;
    if (this._ultimo.aviso === chave && agora - this._ultimo.avisoEm < AVISO_REPETE) return;
    this._ultimo.aviso = chave; this._ultimo.avisoEm = agora;
    while (this._avisos.length >= MAX_AVISOS) this._avisos.shift().el.remove();
    const a = el('div', 'hud-aviso ' + tipo);
    if (icone) a.appendChild(el('span', 'emo', icone));
    a.appendChild(el('span', null, texto));
    this.avisos.appendChild(a);
    this._avisos.push({ el: a, resta: AVISO_DURA });
    this.historico.push({ texto, tipo });
  }

  /** Um passo de simulacao. */
  passo(dt) {
    const c = this.corrida;
    if (!c || !this.visivel) return;
    if (c !== this.G.corrida) { this.esconde(); return; } // a corrida foi encerrada por fora (suite, reinicio)
    this._passos++;
    const j = c.jogador;
    // temporizadores em tempo de simulacao (ver o cabecalho)
    if (dt > 0) this._tempos(dt);
    if (!j) return;
    const U = this._ultimo;
    // posicao
    const pos = j.posicao || 1;
    if (pos !== U.pos) {
      const subiu = U.pos > 0 && pos < U.pos && c.estado === 'correndo';
      U.pos = pos;
      this.posN.textContent = String(pos);
      this.pos.classList.toggle('primeiro', pos === 1);
      const agora = this.G.relogio.t;
      if (subiu && agora - this._ultimaSubida > ULTRAPASSAGEM_INTERVALO) {
        this._ultimaSubida = agora;
        this.pos.classList.remove('subiu'); void this.pos.offsetWidth; this.pos.classList.add('subiu');
        if (this.G.audio) this.G.audio.toca('ultrapassou');
      }
    }
    if (U.de !== c.carros.length) { U.de = c.carros.length; this.posDe.textContent = '/' + c.carros.length; }
    // volta e tempo: compara NUMEROS (o decimo de segundo inteiro) e so monta texto quando muda
    const volta = j.chegou ? c.voltas : Math.min(c.voltas, Math.max(1, j.volta || 0));
    if (volta !== U.volta || c.voltas !== U.voltas) { U.volta = volta; U.voltas = c.voltas; this.voltaN.textContent = volta + '/' + c.voltas; }
    const t = j.chegou ? j.tempoChegada : (c.estado === 'correndo' ? c.t : 0);
    const dec = t > 0 ? Math.floor(t * 10 + 1e-6) : 0;
    if (dec !== U.dec) { U.dec = dec; this.tempo.textContent = dec > 0 ? formataTempo(t) : '0:00.0'; }
    // turbo (barra do HUD e a carga no botao)
    const tb = j.turbo;
    const carga = tb ? Math.max(0, Math.min(1, tb.carga || 0)) : 0;
    const pct = Math.round(carga * 100);
    const cheio = carga >= 0.999, ativo = !!(tb && tb.ativo), vazio = carga <= 0.001;
    const bits = (cheio ? 1 : 0) | (ativo ? 2 : 0) | (vazio ? 4 : 0);
    if (pct !== U.turbo) { U.turbo = pct; this.turboBarra.style.width = pct + '%'; if (this._decoTurbo) this._decoTurbo.carga.style.height = pct + '%'; }
    if (bits !== U.turboBits) {
      U.turboBits = bits;
      this.turbo.className = 'hud-turbo' + CLASSES_DO_TURBO[bits];
      if (this._decoTurbo) this._decoTurbo.el.className = 'deco' + CLASSES_DO_TURBO[bits];
    }
    if (cheio && !this._turboCheioAvisado && c.estado === 'correndo') {
      this._turboCheioAvisado = true;
      this.aviso('Turbo cheio!', 'turbo', '🔥');
      if (this.G.audio) this.G.audio.toca('turbo_cheio');
    } else if (carga < 0.95) this._turboCheioAvisado = false;
    // poder (anel de recarga)
    this._atualizaPoder(c, j);
    // efeitos sobre o jogador
    if (this._passos % EFEITOS_A_CADA === 0) this._atualizaEfeitos(c, j);
    // fumaca (mod.visao 0..1, escrita pela fase 4 neste mesmo passo)
    const visao = Math.round(Math.max(0, Math.min(1, (j.mod && j.mod.visao) || 0)) * 20) / 20;
    if (visao !== U.visao) { U.visao = visao; this.fumaca.style.opacity = String(visao * 0.92); }
    const gelo = j.efeitos && j.efeitos.gelo > 0 ? 1 : 0;
    if (gelo !== U.gelo) { U.gelo = gelo; this.gelo.style.opacity = String(gelo); }
    // minimapa
    if (this._passos % MINIMAPA_A_CADA === 0) this.minimapa.desenha(c.carros, j, (dt || 1 / 60) * MINIMAPA_A_CADA);
    // botoes da fase 2: podem nascer depois do mostra (mostraControles vem logo em seguida)
    if ((!this._decoTurbo || !this._decoPoder) && this._passos % 30 === 1) this._decora(j);
  }

  // ------------------------------------------------------------ interno
  _monta() {
    const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null;
    const raiz = el('div', 'hud');
    raiz.hidden = true;
    this.raiz = raiz;
    // esquerda: posicao / volta + tempo / turbo / efeitos
    const esq = el('div', 'hud-esq');
    this.pos = el('div', 'hud-pos');
    this.posN = el('span', 'hud-pos-n', '1');
    this.pos.append(this.posN, el('span', 'hud-pos-o', 'º'));
    this.posDe = el('span', 'hud-pos-de', '/8');
    this.pos.appendChild(this.posDe);
    const linha = el('div', 'hud-pilula');
    const volta = el('span', 'hud-volta');
    volta.append(el('span', 'emo', '🏁 '));
    this.voltaN = el('b', null, '1/3');
    volta.appendChild(this.voltaN);
    this.tempo = el('span', 'hud-tempo', '0:00.0');
    linha.append(volta, this.tempo);
    this.turbo = el('div', 'hud-turbo');
    const barra = el('div', 'hud-turbo-barra');
    this.turboBarra = el('b');
    barra.appendChild(this.turboBarra);
    this.turbo.append(el('span', 'emo', '🔥'), barra);
    this.efeitos = el('div', 'hud-efeitos');
    esq.append(this.pos, linha, this.turbo, this.efeitos);
    // minimapa (direita, abaixo do botao de pausa do #ui)
    const mapa = el('canvas', 'hud-mapa');
    this.minimapa = new Minimapa(mapa);
    // centro: avisos, contagem, faixa
    this.avisos = el('div', 'hud-avisos');
    this.contagem = el('div', 'hud-contagem');
    this.contagem.hidden = true;
    this.faixa = el('div', 'hud-faixa', 'ÚLTIMA VOLTA!');
    this.faixa.hidden = true;
    // tela inteira: fumaca, gelo, clarão
    this.fumaca = el('div', 'hud-fumaca');
    this.gelo = el('div', 'hud-gelo');
    this.flash = el('div', 'hud-flash');
    // a faixa ANTES dos avisos: aviso que chega durante a ULTIMA VOLTA fica por cima dela, legivel
    raiz.append(this.fumaca, this.gelo, this.flash, esq, mapa, this.faixa, this.avisos, this.contagem);
    if (hud) hud.appendChild(raiz);
  }

  _tempos(dt) {
    for (let k = this._avisos.length - 1; k >= 0; k--) {
      const a = this._avisos[k];
      a.resta -= dt;
      if (a.resta <= 0) { a.el.remove(); this._avisos.splice(k, 1); }
    }
    if (this._tContagem > 0) { this._tContagem -= dt; if (this._tContagem <= 0) this.contagem.hidden = true; }
    if (this._tFaixa > 0) { this._tFaixa -= dt; if (this._tFaixa <= 0) this.faixa.hidden = true; }
    if (this._tTreme > 0) { this._tTreme -= dt; if (this._tTreme <= 0) this.raiz.classList.remove('tremendo'); }
  }

  _mostraContagem(n) {
    const e = this.contagem;
    e.hidden = false;
    e.textContent = n > 0 ? String(n) : 'VAI!';
    e.className = 'hud-contagem ' + (n > 0 ? 'n' + n : 'vai');
    void e.offsetWidth; // reinicia a animacao a cada numero
    e.classList.add('bate');
    this._tContagem = n > 0 ? 1.2 : VAI_DURA;
  }

  _treme() {
    // no maximo um clarão a cada 0,8 s: encostado no rival a crianca levaria um pisca-pisca vermelho
    const agora = this.G.relogio.t;
    if (agora - this._ultimoTreme < TREME_INTERVALO) return;
    this._ultimoTreme = agora;
    this._tTreme = TREME_DURA;
    this.raiz.classList.add('tremendo');
    this.flash.classList.remove('on'); void this.flash.offsetWidth; this.flash.classList.add('on');
  }

  _atualizaPoder(c, j) {
    const d = this._decoPoder;
    if (!d) return;
    let r = 1;
    try { r = c.poderes && c.poderes.recarga ? c.poderes.recarga(j) : 1; } catch (e) { r = 1; }
    r = Math.max(0, Math.min(1, Number.isFinite(r) ? r : 1));
    const p = Math.round(r * 100);
    if (p === this._ultimo.poder) return;
    const antes = this._ultimo.poder;
    this._ultimo.poder = p;
    d.el.style.setProperty('--p', String(p / 100));
    const pronto = p >= 100;
    d.el.className = 'deco ' + (pronto ? 'pronto' : 'carregando');
    if (pronto && antes >= 0 && antes < 100 && c.estado === 'correndo' && !this._poderProntoAvisado) {
      this._poderProntoAvisado = true;
      const pd = PODERES[j.cfg && j.cfg.poder];
      this.aviso('Poder pronto!', 'poder', pd ? pd.icone : '✨');
    }
    if (!pronto) this._poderProntoAvisado = false;
  }

  _atualizaEfeitos(c, j) {
    // MASCARA de bits (nada alocado no passo): 1 gelo, 2 rodopio, 4 levantado, 8 sem turbo (EMP), 16 encolhido, 32<<k o poder k ativo
    let m = 0;
    const ef = j.efeitos, mod = j.mod;
    if (ef) { if (ef.gelo > 0) m |= 1; if (ef.rodopio > 0) m |= 2; if (ef.levantado > 0) m |= 4; }
    if (mod) { if (mod.semTurbo) m |= 8; if (mod.escala < 0.9) m |= 16; }
    try {
      const at = c.poderes && c.poderes.ativosEm ? c.poderes.ativosEm(j) : null;
      if (at && at.length) for (let k = 0; k < at.length; k++) {
        const a = at[k], id = typeof a === 'string' ? a : a && (a.poder || a.id);
        const i = ORDEM_DOS_PODERES.indexOf(id);
        if (i >= 0) m |= 32 << i;
      }
    } catch (e) { /* poderes ainda stub */ }
    if (m === this._ultimo.efeitos) return;
    this._ultimo.efeitos = m;
    this.efeitos.textContent = '';
    for (let b = 0; b < ICONES_DOS_EFEITOS.length; b++) {
      if (!(m & (1 << b))) continue;
      const ic = ICONES_DOS_EFEITOS[b];
      if (b >= 5 && (ic === '⚡' && m & 8)) continue; // o EMP ja aparece como "sem turbo"
      this.efeitos.appendChild(el('span', 'emo', ic));
    }
  }

  /** Enfeita os botoes da fase 2 (uma vez por elemento). */
  _decora(j) {
    if (typeof document === 'undefined') return;
    const bt = document.querySelector('#btn-turbo .deco'), bp = document.querySelector('#btn-poder .deco');
    if (bt && !this._decoTurbo) {
      bt.textContent = '';
      const carga = el('i', 'tb-carga');
      bt.append(carga, el('span', 'tb-icone emo', '🔥'));
      this._decoTurbo = { el: bt, carga };
      this._ultimo.turbo = -1; this._ultimo.turboBits = -1;
    }
    if (bp && !this._decoPoder) {
      const pd = PODERES[j.cfg && j.cfg.poder] || { icone: '✨', cor: '#ffd23a' };
      bp.textContent = '';
      bp.style.setProperty('--cor', pd.cor);
      bp.append(el('i', 'pd-anel'), el('span', 'pd-icone emo', pd.icone));
      this._decoPoder = { el: bp };
      this._ultimo.poder = -1;
    }
  }

  _ouve(c) {
    const d = this._desligar;
    const ouve = (nome, fn) => d.push(on(nome, fn));
    const jog = (x) => !!(x && x.ehJogador);
    ouve('corrida:contagem', (e) => this._mostraContagem(e.n));
    ouve('corrida:volta', (e) => { if (jog(e.carro) && e.volta >= 2 && e.volta < c.voltas) this.aviso('Volta ' + e.volta + '!', 'info', '🏁'); });
    ouve('corrida:ultima_volta', (e) => { if (!jog(e.carro)) return; this.faixa.hidden = false; this.faixa.style.animation = 'none'; void this.faixa.offsetWidth; this.faixa.style.animation = ''; this._tFaixa = FAIXA_DURA; });
    ouve('corrida:chegada', (e) => {
      if (!jog(e.carro)) return;
      if (e.posicao === 1) this.aviso('VOCÊ VENCEU!', 'ouro', '🏆');
      else this.aviso('Chegou em ' + e.posicao + 'º!', e.posicao <= 3 ? 'bom' : 'info', '🏁');
    });
    ouve('carro:batida', (e) => {
      if (!(jog(e.carro) || jog(e.outro))) return;
      if ((e.forca || 0) < BATIDA_TREME) return;
      this._treme();
      // a onomatopeia no maximo a cada 1,5 s: na largada a grade se esbarra e "PAM! BUM! CRASH!" empilhados viram ruido
      const agora = this.G.relogio.t;
      if (agora - this._ultimaBatida < BATIDA_AVISO_INTERVALO) return;
      this._ultimaBatida = agora;
      this.aviso(PAM[this._pam++ % PAM.length], 'ruim', '💥');
    });
    ouve('carro:queda', (e) => { if (jog(e.carro)) this.aviso('Ops! Caiu!', 'ruim', '😵'); });
    ouve('turbo:vazio', (e) => { if (jog(e.carro)) this.aviso('Turbo vazio!', 'info', '🪫'); });
    ouve('capsula:pega', (e) => { if (jog(e.carro) && e.dourada) this.aviso('Cápsula dourada!', 'ouro', '✨'); });
    ouve('poder:usa', (e) => {
      if (!jog(e.carro)) return;
      const pd = PODERES[e.poder];
      if (pd) this.aviso(pd.nome + '!', 'poder', pd.icone);
    });
    ouve('poder:acerta', (e) => {
      if (jog(e.alvo)) { const r = RECEBEU[e.poder] || ['💥', 'Acertaram você!']; this.aviso(r[1], 'ruim', r[0]); }
      else if (jog(e.de)) this.aviso('Acertou!', 'bom', '🎯');
    });
    ouve('poder:bloqueado', (e) => {
      if (jog(e.alvo)) this.aviso('Bloqueou!', 'bom', '🛡️');
      else if (jog(e.de)) this.aviso('Bloqueado!', 'ruim', '🛡️');
    });
    ouve('poder:esquivou', (e) => {
      if (jog(e.alvo)) this.aviso('Escapou!', 'bom', '😎');
      else if (jog(e.de)) this.aviso('Errou!', 'info', '💨');
    });
  }
}
