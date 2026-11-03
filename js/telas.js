// AS TELAS (fase 6; contrato em docs/CONTRATOS.md secao 10): menu, selecao de carro (vitrine 3D girando), selecao de pista, carga da
// corrida, corrida (o botao de pausa) e o menu de pausa, resultado com PODIO 3D, campeonato, opcoes e a confirmacao. Quem decide as
// regras (desbloqueio, pontos, recorde) e o js/jogo.js; aqui so se mostra e se chama.
//
// O JEITO DO BRENO (referencias/breno): cada tela e uma <section> que aparece e some (hidden), botoes redondos grandes com emoji/SVG,
// paineis creme de borda grossa, pouquissimo texto — o publico comeca nos 6 anos. Todo botao tem data-acao e UM ouvinte de clique no
// #ui resolve todos (a suite clica pelo DOM de verdade com `[data-acao=...]`).
//
// CORRIDAS QUE SAO DAS TELAS: as telas so reagem (HUD, controles, resultado, registraResultado) as corridas que ELAS comecaram (menu,
// reinicio ou `mostra('corrida_direta')`). Uma suite de outra fase que abre corrida direto por G.jogo.iniciaCorrida nao ganha podio nem
// registro de resultado sozinha — senao o registraResultado contaria duas vezes quando a suite tambem chama, e o podio trocaria o
// G.desenho no meio da medida dela.
//
// O FIM DA CORRIDA E PROCESSADO NO PROXIMO `passo` das telas, nao dentro do evento: `corrida:fim` e emitido de dentro do
// corrida.passo(); encerrar a corrida (destroi) ali dentro desmontaria os sistemas no meio do passo de quem ainda vai ouvir o evento.
//
// TELA CHEIA: no primeiro toque de verdade (click/pointerup/touchend: pointerdown de dedo nao conta como gesto para o navegador),
// requestFullscreen + screen.orientation.lock('landscape'), tudo em try/catch. No iPhone nao existe tela cheia para pagina: o layout
// ja ocupa 100dvh e o #gire do index.html pede para deitar. Nunca se pede "adicionar a tela inicial".
//
// FONTES: Baloo 2 + Bungee do Google Fonts (as dos jogos de referencia; mudanca de regra autorizada pelo maestro), com fallback de
// sistema. O <link> NAO e posto com ?teste=, ?foto= ou ?semente=: a bateria roda sem internet e um 'Failed to load resource' no
// console reprova a suite (e fonte que chega no meio muda a medida do texto entre duas rodadas).
import { on, emite } from './eventos.js';
import * as save from './save.js';
import { PISTAS } from '../config/pistas.js';
import { CARROS, CARRO_PADRAO } from '../config/carros.js';
import { PODERES } from '../config/poderes.js';
import { CORRIDA } from '../config/corrida.js';
import { Pista } from './pista.js';
import { Vitrine } from './vitrine.js';
import { corCSS } from './minimapa.js';
import { formataTempo } from './hud.js';
import { temaDaPista } from './musica.js';
import { ROTULOS, ehCelular } from './qualidade.js';

/** As fontes dos jogos de referencia (ver o cabecalho). */
const FONTES = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Bungee&display=swap';
/** Arrasto horizontal (px) que troca de carro na vitrine; menos que isso so gira o carro. */
const ARRASTO_TROCA = 48;
/** Folga (px) entre o nome do carro e o botao de voltar (e a mesma do outro lado: o nome e centralizado). */
const NOME_FOLGA = 8;
/** Espera maxima (ms) pelo carro do menu antes de esconder a tela de carga: o menu nao fica refem de um GLB lento. */
const ESPERA_DO_CARRO_DO_MENU = 5000;

/** Os 5 atributos (config/carros.js, 1 a 5): icone, rotulo e cor da barra. */
const ATRIBUTOS = [
  ['velocidade', '🏎️', 'Velocidade', '#ff5e57'],
  ['aceleracao', '🚀', 'Arrancada', '#ff9a1a'],
  ['controle', '🎯', 'Curva', '#3ad16a'],
  ['peso', '🏋️', 'Peso', '#3d9be8'],
  ['turbo', '🔥', 'Turbo', '#8a5cff'],
];
/** Emoji do tema musical da pista (js/musica.js temaDaPista): o cartao mostra o lugar sem precisar ler o nome. */
const ICONE_DO_TEMA = { praia: '🏖️', funk: '🎶', cidade: '🌃', selva: '🌴', gelo: '❄️', deserto: '🏜️', vulcao: '🌋', espaco: '🚀', doces: '🍭', porto: '⚓', montanha: '⛰️', maluca: '🤪', menu: '🏁', podio: '🏆' };
/** Cores do cartao quando o tema da pista nao traz (uma por tema musical). */
const CORES_DO_TEMA = { praia: ['#5ad1ff', '#1d86c9'], funk: ['#ffb35a', '#8fae4f'], porto: ['#7fb2e0', '#5a5a55'], cidade: ['#8a5cff', '#2a1f6b'], selva: ['#5ce08a', '#1f7a3e'], gelo: ['#bff0ff', '#4a9fd8'], deserto: ['#ffc46b', '#c8742a'],
  vulcao: ['#ff7a3a', '#8a1f12'], espaco: ['#5a6cff', '#140c3a'], doces: ['#ff9ad8', '#c04a9a'], montanha: ['#9ad86b', '#4a7a3a'], maluca: ['#ff5ad1', '#ff7a1a'] };
const MEDALHA = ['🥇', '🥈', '🥉'];
/** Dicas da tela de carga (giram: uma diferente a cada corrida). */
const DICAS = [
  ['🔥', 'Pegue as <b>cápsulas</b> da pista para encher o turbo!'],
  ['✨', 'A <b>cápsula dourada</b> enche o turbo inteiro!'],
  ['🛣️', 'Procure os <b>atalhos</b>: alguns caminhos são mais curtos.'],
  ['🏆', 'No campeonato, chegue em <b>1º, 2º ou 3º</b> para abrir a próxima pista.'],
];

// ---------------------------------------------------------------- icones SVG (os do Breno: branco com contorno de tinta)
const SVG = {
  play: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M7 4.5l13 7.5-13 7.5z" fill="#fff" stroke="#10204a" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  ok: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M5 12.5l4.6 4.6L19.5 7" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nao: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>',
  esq: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M15.5 4.5L8 12l7.5 7.5" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dir: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M8.5 4.5L16 12l-7.5 7.5" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  volta: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M14.5 5L7.5 12l7 7" fill="none" stroke="#10204a" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pausa: '<svg class="tc-svg" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="#10204a"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="#10204a"/></svg>',
  cheia: '<svg class="tc-svg" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="#10204a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const $ = (raiz, sel) => raiz.querySelector(sel);
function cria(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
const escapa = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfgDe = (id) => CARROS.find((c) => c.id === id) || CARROS.find((c) => c.id === CARRO_PADRAO) || CARROS[0];

/** Rivais fixos de um campeonato: os carros na ordem da config, menos o do jogador — os MESMOS 7 em todas as corridas (os pontos
 *  da tabela so fazem sentido se os adversarios nao mudam de uma pista para outra). */
export function rivaisDoCampeonato(carroId, n = CORRIDA.CORREDORES - 1) {
  return CARROS.map((c) => c.id).filter((id) => id !== carroId).slice(0, n);
}

/** Desenho da pista vista de cima (SVG path), com a reta de largada para cima — a mesma orientacao do minimapa. */
function desenhoDaPista(def, lado = 100) {
  const p = new Pista(def), P = p.principal;
  const ang = -Math.PI / 2 - Math.atan2(P.T[2], P.T[0]), co = Math.cos(ang), se = Math.sin(ang);
  const sups = p.superficies;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const s of sups) for (let i = 0; i < s.n; i++) {
    const x = s.P[i * 3], z = s.P[i * 3 + 2], u = x * co - z * se, v = x * se + z * co;
    if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  const esc = (lado * 0.84) / Math.max(1, maxU - minU, maxV - minV), cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const caminho = (s) => {
    const passo = Math.max(1, Math.floor(s.n / 140));
    let d = '';
    for (let i = 0; i < s.n; i += passo) {
      const x = s.P[i * 3], z = s.P[i * 3 + 2], u = (x * co - z * se - cu) * esc + lado / 2, v = (x * se + z * co - cv) * esc + lado / 2;
      d += (d ? 'L' : 'M') + u.toFixed(1) + ' ' + v.toFixed(1);
    }
    return s.fechada ? d + 'Z' : d;
  };
  return { principal: caminho(P), atalhos: p.atalhos.map((a) => caminho(a.sup)), lado };
}

function svgDaPista(d, classe) {
  const atalhos = d.atalhos.map((a) => `<path d="${a}" stroke="#10204a" stroke-width="9"/><path d="${a}" stroke="#ffd23a" stroke-width="4.5" stroke-dasharray="6 5"/>`).join('');
  // fill/linejoin como ATRIBUTO (nao so no CSS): o mesmo desenho vai no cartao e no campeonato, e sem fill="none" o caminho fechado
  // vira uma mancha preta onde a regra do CSS nao alcanca
  return `<svg class="${classe}" viewBox="0 0 ${d.lado} ${d.lado}" preserveAspectRatio="xMidYMid meet" fill="none" stroke-linejoin="round" stroke-linecap="round">${atalhos}<path d="${d.principal}" stroke="#10204a" stroke-width="13"/><path d="${d.principal}" stroke="#fffaf0" stroke-width="7"/></svg>`;
}

export class Telas {
  constructor(G) {
    this.G = G;
    this.atual = null;
    this.sobre = null;        // overlay: 'pausa' | 'confirma'
    this.dados = {};
    this.modo = 'livre';      // 'livre' | 'campeonato' | 'campeonato_novo'
    this.vitrine = new Vitrine(G);
    this.corrida = null;      // a corrida que as telas comecaram
    this.resultado = null;    // ultimo { resultado, resumo } mostrado
    this._secoes = {};
    this._pedida = false;
    this._carregandoCorrida = false;
    this._fim = null;
    this._ultima = null;
    this._dica = 0;
    this._desenhos = new Map();
    this._confirma = null;
    this._primeiroGesto = false;
    this._pausaPorTecla = -1e9;
    this.indiceCarro = Math.max(0, CARROS.findIndex((c) => c.id === (G.jogo ? G.jogo.carroEscolhido : CARRO_PADRAO)));
    on('corrida:carregada', (e) => this._aoCarregar(e.corrida));
    on('corrida:fim', (e) => { if (this.corrida && this.G.corrida === this.corrida && !this._fim) this._fim = e.resultado; });
    on('corrida:pausa', (e) => { if (this.corrida && this.G.corrida === this.corrida) { if (e.pausada) this._abreSobre('pausa'); else if (this.sobre === 'pausa') this._fechaSobre(); } });
  }

  /** Boot: monta o DOM, liga os gestos, aplica as opcoes salvas e esconde a tela de carga. */
  async inicia(progresso) {
    const G = this.G, f = G.flags || {};
    if (!f.teste && !f.foto && f.semente == null) this._fontes();
    this._montaDOM();
    this._ligaGestos();
    this._aplicaOpcoesSalvas();
    if (progresso) progresso(0.6, 'Lavando os carros…');
    // o carro do menu: com ele pronto o menu ja abre com a vitrine girando (fora da bateria, que nao abre o menu sozinha)
    if (!f.teste) {
      const cfg = cfgDe(G.jogo.carroEscolhido);
      await Promise.race([this.vitrine.mostraCarro(cfg, 'menu').catch(() => null), new Promise((r) => setTimeout(r, ESPERA_DO_CARRO_DO_MENU))]);
    }
    if (progresso) progresso(0.95, 'Pronto!');
    const c = document.getElementById('carregando');
    if (c) c.style.display = 'none';
  }

  /** Troca de tela. Nomes: menu, selecao_carro, selecao_pista, carregando, carregando_corrida, corrida, pausa, resultado, campeonato,
   *  opcoes, corrida_direta ({ pista, carro }). */
  mostra(nome, dados = {}) {
    if (nome === 'corrida_direta') { this.modo = 'livre'; return this._iniciaCorrida({ pista: dados.pista, carro: dados.carro && CARROS.find((c) => c.id === dados.carro) ? dados.carro : this.G.jogo.carroEscolhido, modo: 'livre' }); }
    if (nome === 'carregando') { const c = document.getElementById('carregando'); if (c) c.style.display = 'flex'; return; }
    if (nome === 'pausa') return this.pausa();
    const sec = this._secoes[nome];
    if (!sec) { console.warn('[telas] tela desconhecida: ' + nome); return; }
    this._fechaSobre();
    for (const [n, s] of Object.entries(this._secoes)) if (n !== 'pausa' && n !== 'confirma') s.hidden = n !== nome;
    this.atual = nome;
    this.dados = dados || {};
    const entra = this['_entra_' + nome];
    if (entra) entra.call(this, this.dados);
    emite('jogo:tela', { nome });
  }

  /** Pausa a corrida das telas (botao do HUD, tecla, aba escondida via main.js). */
  pausa() {
    const c = this.G.corrida;
    if (c && c === this.corrida && c.estado !== 'terminou' && c.estado !== 'carregando') c.pausa(true);
  }

  /** Um passo de simulacao. */
  passo() {
    const G = this.G;
    if (this._fim) { const r = this._fim; this._fim = null; this._terminou(r); return; }
    // a acao 'pausa' da entrada (fase 2: tecla/botao de pausa), sem dobrar com a tecla que as telas ja ouviram
    const c = G.corrida;
    if (c && c === this.corrida && G.entrada && G.entrada.apertou && G.entrada.apertou('pausa') && performance.now() - this._pausaPorTecla > 300) {
      if (c.pausada) c.pausa(false); else this.pausa();
    }
  }

  /** Um quadro de tela: a vitrine anima (giro, confete, camera). */
  quadro(dt) { if (this.vitrine.ligada) this.vitrine.quadro(dt); }

  // ================================================================ montagem
  _fontes() {
    try {
      if (document.querySelector('link[data-fonte-turbocaos]')) return;
      for (const [rel, href, cross] of [['preconnect', 'https://fonts.googleapis.com', false], ['preconnect', 'https://fonts.gstatic.com', true], ['stylesheet', FONTES, false]]) {
        const l = document.createElement('link');
        l.rel = rel; l.href = href; if (cross) l.crossOrigin = 'anonymous';
        l.setAttribute('data-fonte-turbocaos', '1');
        document.head.appendChild(l);
      }
    } catch (e) { /* sem DOM de head: fica a fonte do sistema */ }
  }

  _montaDOM() {
    const ui = document.getElementById('ui');
    this.ui = ui;
    const s = this._secoes;
    s.menu = cria(`<section class="tc-tela" id="tela-menu" hidden>
      <div class="menu-esq">
        <h1 class="tc-logo"><b>TURBO</b><span>CAOS</span></h1>
        <button class="tc-pilula tc-ouro" data-acao="campeonato" aria-label="Campeonato"><i class="emo">🏆</i><span>CAMPEONATO</span></button>
        <button class="tc-pilula tc-verde" data-acao="livre" aria-label="Corrida livre"><i class="emo">🏁</i><span>CORRIDA LIVRE</span></button>
      </div>
      <div class="tc-cantos-dir">
        <button class="tc-redondo" data-acao="tela_cheia" aria-label="Tela cheia">${SVG.cheia}</button>
        <button class="tc-redondo emo" data-acao="opcoes" aria-label="Opções">⚙️</button>
      </div>
      <div class="menu-placar"><span><span class="emo">🏁</span> <b class="mp-pistas">1</b>/<span class="mp-total">10</span></span><span><span class="emo">🏆</span> <b class="mp-vitorias">0</b></span></div>
      <div class="menu-carro"></div>
    </section>`);
    s.selecao_carro = cria(`<section class="tc-tela" id="tela-selecao_carro" hidden>
      <button class="tc-redondo tc-voltar" data-acao="voltar" aria-label="Voltar">${SVG.volta}</button>
      <div class="sc-nome"><span></span></div>
      <div class="sc-arrasto"></div>
      <button class="tc-big tc-azul tc-seta esq" data-acao="carro_anterior" aria-label="Carro anterior">${SVG.esq}</button>
      <button class="tc-big tc-azul tc-seta dir" data-acao="carro_proximo" aria-label="Próximo carro">${SVG.dir}</button>
      <div class="tc-painel sc-painel com-botao">
        <div class="sc-desc"></div>
        <div class="sc-atributos">${ATRIBUTOS.map(([k, ic, rot, cor]) => `<div class="sc-attr" data-attr="${k}" style="--cor:${cor}"><i class="emo">${ic}</i><span>${rot}</span><div class="sc-barra">${'<b></b>'.repeat(5)}</div></div>`).join('')}</div>
        <div class="sc-poder"><div class="sc-poder-icone emo"></div><div><b class="sc-poder-nome"></b><p class="sc-poder-desc"></p><p class="sc-esquiva"></p></div></div>
      </div>
      <div class="sc-pontos">${CARROS.map((c, i) => `<i data-i="${i}" style="--cor:${corCSS(c.cor)}"></i>`).join('')}</div>
      <button class="tc-big tc-verde sc-escolhe" data-acao="escolhe_carro" aria-label="Escolher este carro">${SVG.ok}</button>
    </section>`);
    s.selecao_pista = cria(`<section class="tc-tela tc-fundo" id="tela-selecao_pista" hidden>
      <button class="tc-redondo tc-voltar" data-acao="voltar" aria-label="Voltar">${SVG.volta}</button>
      <div class="tc-titulo">ESCOLHA A PISTA</div>
      <div class="sp-rolo"><div class="sp-trilho"></div></div>
    </section>`);
    s.carregando_corrida = cria(`<section class="tc-tela tc-fundo tc-carga" id="tela-carregando_corrida" hidden>
      <div class="cc-carro emo">🏎️</div><div class="cc-pista"></div><div class="cc-barra"><i></i></div><div class="cc-dica"></div>
    </section>`);
    s.corrida = cria(`<section class="tc-tela" id="tela-corrida" hidden>
      <button class="tc-redondo hud-pausa" data-acao="pausar" aria-label="Pausa">${SVG.pausa}</button>
    </section>`);
    s.pausa = cria(`<section class="tc-tela tc-escuro" id="tela-pausa" hidden>
      <div class="tc-painel coluna"><div class="pz-titulo">PAUSA</div><div class="tc-linha">
        <button class="tc-big tc-verde" data-acao="continuar" aria-label="Continuar">${SVG.play}</button>
        <button class="tc-big tc-azul emo" data-acao="reiniciar" aria-label="Recomeçar">🔁</button>
        <button class="tc-big tc-ouro emo" data-acao="sair" aria-label="Sair para o menu">🏠</button>
      </div></div>
    </section>`);
    s.resultado = cria(`<section class="tc-tela" id="tela-resultado" hidden>
      <div class="rs-faixa"><span class="rs-titulo"></span><span class="rs-estrelas emo"></span></div>
      <div class="tc-painel rs-painel">
        <div class="rs-selos"></div>
        <table class="rs-tabela"><thead><tr><td></td><td></td><td class="tempo"><span class="emo">⏱️</span></td><td class="volta"><span class="emo">⚡</span> volta</td></tr></thead><tbody></tbody></table>
        <div class="tc-linha rs-botoes"></div>
      </div>
    </section>`);
    s.campeonato = cria(`<section class="tc-tela tc-fundo" id="tela-campeonato" hidden>
      <button class="tc-redondo tc-voltar" data-acao="menu" aria-label="Menu">${SVG.volta}</button>
      <div class="tc-titulo"><span class="emo">🏆</span> CAMPEONATO</div>
      <div class="cp-trilha"></div>
      <div class="cp-corpo">
        <div class="tc-painel cp-tabela"><table><tbody></tbody></table></div>
        <div class="cp-proxima"></div>
      </div>
      <div class="cp-rodape"><button class="tc-mini" data-acao="novo_campeonato">🔄 Novo campeonato</button></div>
    </section>`);
    s.opcoes = cria(`<section class="tc-tela tc-escuro" id="tela-opcoes" hidden>
      <button class="tc-redondo tc-voltar" data-acao="voltar" aria-label="Voltar">${SVG.volta}</button>
      <div class="tc-titulo"><span class="emo">⚙️</span> OPÇÕES</div>
      <div class="tc-painel op-painel">
        <div class="op-linha"><span class="op-rotulo"><i class="emo">🎮</i>Direção</span><div class="op-escolhas" data-grupo="direcao">
          <button data-acao="op_direcao" data-valor="joystick"><span class="emo">👆</span> Arrastar</button>
          <button data-acao="op_direcao" data-valor="botoes"><span class="emo">🔘</span> Setas</button>
          <button data-acao="op_direcao" data-valor="inclinacao" class="op-inclinar"><span class="emo">📱</span> Inclinar</button>
        </div></div>
        <div class="op-linha"><span class="op-rotulo"><i class="emo">🦶</i>Acelerar sozinho</span><button class="op-chave" data-acao="op_acel_auto" aria-pressed="false" aria-label="Acelerar sozinho"><i></i></button></div>
        <div class="op-linha"><span class="op-rotulo"><i class="emo">✨</i>Gráficos</span><div class="op-escolhas" data-grupo="qualidade">
          ${['auto', 'baixa', 'media', 'alta'].map((n) => `<button data-acao="op_qualidade" data-valor="${n}">${ROTULOS[n]}</button>`).join('')}
        </div></div>
        <div class="op-linha"><span class="op-rotulo"><i class="emo">🎵</i>Música</span><input type="range" min="0" max="100" step="5" data-op="musica" aria-label="Volume da música"></div>
        <div class="op-linha"><span class="op-rotulo"><i class="emo">🔊</i>Efeitos</span><input type="range" min="0" max="100" step="5" data-op="efeitos" aria-label="Volume dos efeitos"></div>
        <div class="op-linha op-vibracao"><span class="op-rotulo"><i class="emo">📳</i>Vibração</span><button class="op-chave" data-acao="op_vibracao" aria-pressed="true" aria-label="Vibração"><i></i></button></div>
        <div class="op-aviso" hidden>⚠️ Este navegador não está guardando o progresso: vale até fechar o jogo.</div>
      </div>
      <div class="tc-cantos-dir"><button class="tc-redondo emo" data-acao="apagar_progresso" aria-label="Apagar progresso">🗑️</button></div>
    </section>`);
    s.confirma = cria(`<section class="tc-tela tc-escuro" id="tela-confirma" hidden>
      <div class="tc-painel coluna"><div class="tc-pergunta"></div><div class="tc-linha">
        <button class="tc-big tc-coral" data-acao="confirma_sim" aria-label="Sim">${SVG.ok}</button>
        <button class="tc-big tc-verde" data-acao="confirma_nao" aria-label="Não">${SVG.nao}</button>
      </div></div>
    </section>`);
    for (const sec of Object.values(s)) ui.appendChild(sec);
    // um ouvinte para todos os botoes
    ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (!b || b.disabled || !ui.contains(b)) return;
      this._acao(b.dataset.acao, b, e);
    });
    ui.addEventListener('input', (e) => { const r = e.target.closest('[data-op]'); if (r) this._volume(r.dataset.op, Number(r.value), false); });
    ui.addEventListener('change', (e) => { const r = e.target.closest('[data-op]'); if (r) this._volume(r.dataset.op, Number(r.value), true); });
    this._ligaArrasto($(s.selecao_carro, '.sc-arrasto'));
    // o nome comprido se mede de novo quando a tela muda de tamanho (girou o celular) e quando a fonte do titulo chega da internet
    const refazNome = () => { if (this.atual === 'selecao_carro') this._cabeNome(s.selecao_carro, $(s.selecao_carro, '.sc-nome span')); };
    window.addEventListener('resize', refazNome);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refazNome);
    // o botao de tela cheia so existe onde a pagina pode pedir (no iPhone nao pode)
    const el = document.documentElement;
    if (!(el.requestFullscreen || el.webkitRequestFullscreen)) $(s.menu, '[data-acao=tela_cheia]').hidden = true;
    if (!ehCelular()) $(s.opcoes, '.op-inclinar').hidden = true;
    if (!this.G.vibracao || !this.G.vibracao.suportada) $(s.opcoes, '.op-vibracao').hidden = true;
  }

  _ligaGestos() {
    const G = this.G;
    const acorda = () => { if (G.audio) G.audio.desbloqueia(); };
    const ativa = (e) => {
      acorda();
      if (this._primeiroGesto || e.isTrusted === false) return;
      this._primeiroGesto = true;
      const f = G.flags || {};
      if (ehCelular() && !f.teste && !f.foto) this._telaCheia(true);
    };
    document.addEventListener('pointerdown', acorda, { capture: true, passive: true });
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, ativa, { capture: true, passive: true });
    document.addEventListener('keydown', (e) => this._tecla(e));
  }

  _aplicaOpcoesSalvas() {
    const G = this.G, o = save.opcoes();
    if (G.audio) G.audio.volume(1, o.musica / 100, o.efeitos / 100);
    if (G.vibracao) G.vibracao.liga(o.vibracao !== false);
    // controle/acelAuto: a entrada (fase 2) ja leu do mesmo 'opcoes' no construtor dela — configurar de novo aqui so duplicaria
  }

  // ================================================================ telas: o que cada uma faz ao entrar
  _entra_menu() {
    const G = this.G;
    this._saiDaCorrida();
    this.modo = 'livre';
    const p = G.jogo.progresso(), total = PISTAS.length;
    const m = this._secoes.menu;
    $(m, '.mp-pistas').textContent = String(Math.min(total, p.desbloqueadas || 1));
    $(m, '.mp-total').textContent = String(total);
    $(m, '.mp-vitorias').textContent = String(p.vitorias || 0);
    const cfg = cfgDe(G.jogo.carroEscolhido);
    $(m, '.menu-carro').textContent = cfg.nome;
    this.indiceCarro = Math.max(0, CARROS.indexOf(cfg));
    this.vitrine.ativa('menu');
    this.vitrine.mostraCarro(cfg, 'menu');
    if (G.audio) G.audio.musica('menu');
  }

  _entra_selecao_carro(d) {
    this.modo = d.modo || this.modo || 'livre';
    if (d.carro) this.indiceCarro = Math.max(0, CARROS.findIndex((c) => c.id === d.carro));
    this.vitrine.ativa('selecao');
    this._mostraCarro(false);
    if (this.G.audio) this.G.audio.musica('menu');
  }

  _entra_selecao_pista() {
    const G = this.G, trilho = $(this._secoes.selecao_pista, '.sp-trilho');
    this.vitrine.desativa();
    const p = G.jogo.progresso(), lista = G.jogo.pistas();
    trilho.textContent = '';
    let proxima = null;
    for (const { def, indice, desbloqueada } of lista) {
      const tema = temaDaPista(def), [c1, c2] = this._coresDaPista(def, tema);
      const rec = p.recordes && p.recordes[def.id];
      const b = cria(`<button class="sp-cartao${desbloqueada ? '' : ' bloqueada'}" data-acao="pista" data-pista="${escapa(def.id)}" style="--c1:${c1};--c2:${c2}" aria-label="${escapa(def.nome)}">
        <span class="sp-num">${indice + 1}</span><span class="sp-tema emo">${ICONE_DO_TEMA[tema] || '🏁'}</span>
        ${this._svgDaPista(def, 'sp-desenho')}
        <b class="sp-nome">${escapa(def.nome)}</b>
        <span class="sp-recorde">${rec ? '<span class="emo">⏱️</span> ' + formataTempo(rec) : ''}</span>
        ${desbloqueada ? '' : '<span class="sp-cadeado emo">🔒</span>'}
      </button>`);
      if (desbloqueada && !rec && !proxima) { proxima = b; b.classList.add('proxima'); }
      trilho.appendChild(b);
    }
    const rolo = $(this._secoes.selecao_pista, '.sp-rolo');
    const alvo = proxima || trilho.lastElementChild;
    requestAnimationFrame(() => { if (alvo && rolo) rolo.scrollLeft = Math.max(0, alvo.offsetLeft - rolo.clientWidth / 2 + alvo.offsetWidth / 2); });
    if (G.audio) G.audio.musica('menu');
  }

  _entra_carregando_corrida(op) {
    const s = this._secoes.carregando_corrida;
    const def = PISTAS.find((d) => d.id === op.pista);
    $(s, '.cc-pista').textContent = def ? def.nome : op.pista === 'teste' ? 'Pista de Teste' : String(op.pista || '');
    $(s, '.cc-carro').textContent = def ? ICONE_DO_TEMA[temaDaPista(def)] || '🏎️' : '🏎️';
    // dica: o poder do carro escolhido (como usar / como escapar) alternando com as dicas gerais
    const cfg = cfgDe(op.carro), pd = PODERES[cfg.poder];
    const lista = pd ? [[pd.icone, `<b>${escapa(pd.nome)}</b>: ${escapa(pd.descricao)}`], ...DICAS] : DICAS;
    const [ic, txt] = lista[this._dica++ % lista.length];
    $(s, '.cc-dica').innerHTML = `<span class="emo">${ic}</span> ${txt}`;
  }

  _entra_corrida() { this.vitrine.desativa(); }

  _entra_resultado({ resultado, resumo }) {
    const G = this.G, s = this._secoes.resultado;
    const pj = resultado.jogador, pos = pj.posicao, campeonato = resultado.modo === 'campeonato';
    const tit = $(s, '.rs-titulo');
    tit.textContent = pos === 1 ? 'VOCÊ VENCEU!' : pos <= 3 ? pos + 'º LUGAR!' : pos + 'º lugar';
    tit.className = 'rs-titulo' + (pos > 3 ? ' perdeu' : '');
    const estrelas = pos === 1 ? 3 : pos === 2 ? 2 : pos === 3 ? 1 : 0;
    $(s, '.rs-estrelas').innerHTML = [0, 1, 2].map((k) => `<span class="${k < estrelas ? '' : 'off'}">⭐</span>`).join('');
    // selos
    const selos = [];
    if (resumo && resumo.recorde) selos.push('<span class="tc-selo recorde"><span class="emo">⏱️</span> NOVO RECORDE!</span>');
    if (resumo && resumo.desbloqueou) { const d = PISTAS.find((x) => x.id === resumo.desbloqueou); selos.push(`<span class="tc-selo desbloqueio"><span class="emo">🔓</span> Nova pista: ${escapa(d ? d.nome : resumo.desbloqueou)}</span>`); }
    if (campeonato && pos > 3) selos.push('<span class="tc-selo"><span class="emo">🔁</span> Chegue no pódio para avançar!</span>');
    $(s, '.rs-selos').innerHTML = selos.join('');
    // tabela
    const linhas = resultado.classificacao.map((l) => {
      const cfg = cfgDe(l.cfgId);
      const nome = l.ehJogador ? 'Você' : (l.nome || cfg.nome);
      return `<tr class="${l.ehJogador ? 'eu' : ''}"><td class="pos">${l.posicao <= 3 ? '<span class="emo">' + MEDALHA[l.posicao - 1] + '</span>' : l.posicao + 'º'}</td>
        <td class="nome"><span class="tc-cor" style="--cor:${corCSS(cfg.cor)}"></span>${escapa(nome)}</td><td class="tempo">${formataTempo(l.tempo)}</td><td class="volta">${formataTempo(l.melhorVolta)}</td></tr>`;
    });
    $(s, '.rs-tabela tbody').innerHTML = linhas.join('');
    // botoes
    const bt = [];
    if (campeonato) bt.push(`<button class="tc-big tc-verde" data-acao="proxima" aria-label="Continuar o campeonato">${SVG.play}</button>`);
    else {
      if (this._proximaLivre(resultado.pista)) bt.push(`<button class="tc-big tc-verde" data-acao="proxima" aria-label="Próxima pista">${SVG.play}</button>`);
      bt.push('<button class="tc-big tc-azul emo" data-acao="de_novo" aria-label="Correr de novo">🔁</button>');
    }
    bt.push('<button class="tc-big tc-ouro emo" data-acao="menu" aria-label="Menu">🏠</button>');
    $(s, '.rs-botoes').innerHTML = bt.join('');
    // podio 3D com os tres primeiros de verdade
    const top = resultado.classificacao.slice(0, 3).map((l) => cfgDe(l.cfgId));
    this.vitrine.ativa('podio');
    this.vitrine.mostraPodio(top, true);
    if (G.audio) { G.audio.musica('podio'); G.audio.toca(pos <= 3 ? 'vitoria' : 'derrota'); if (resumo && (resumo.recorde || resumo.desbloqueou)) setTimeout(() => G.audio.toca(resumo.desbloqueou ? 'desbloqueio' : 'recorde'), 900); }
  }

  _entra_campeonato() {
    const G = this.G, s = this._secoes.campeonato;
    const c = G.jogo.campeonato();
    const meu = c.carro || G.jogo.carroEscolhido;
    const terminou = this._campeonatoTerminou(c);
    s.classList.toggle('terminou', terminou);
    // trilha das etapas
    $(s, '.cp-trilha').innerHTML = PISTAS.map((d, i) => `<span class="cp-etapa${i < c.indice || terminou ? ' feita' : i === c.indice ? ' atual' : ''}" title="${escapa(d.nome)}">${i + 1}</span>`).join('');
    // tabela de pontos: os participantes (jogador + rivais fixos) e quem mais tiver pontos
    const ids = [meu, ...rivaisDoCampeonato(meu)];
    for (const id of Object.keys(c.pontos || {})) if (!ids.includes(id)) ids.push(id);
    const tabela = ids.map((id) => ({ id, pts: (c.pontos && c.pontos[id]) || 0 })).sort((a, b) => b.pts - a.pts || (a.id === meu ? -1 : b.id === meu ? 1 : 0));
    $(s, '.cp-tabela tbody').innerHTML = tabela.slice(0, CORRIDA.CORREDORES).map((l, k) => {
      const cfg = cfgDe(l.id), eu = l.id === meu;
      // medalha so para quem ja pontuou: no comeco do campeonato todo mundo tem 0 e medalha de empate engana
      return `<tr class="${eu ? 'eu' : ''}"><td class="pos">${k < 3 && l.pts > 0 ? '<span class="emo">' + MEDALHA[k] + '</span>' : k + 1 + 'º'}</td><td><span class="tc-cor" style="--cor:${corCSS(cfg.cor)}"></span>${eu ? 'Você' : escapa(cfg.nome)}</td><td class="pts">${l.pts}</td></tr>`;
    }).join('');
    const prox = $(s, '.cp-proxima');
    if (terminou) {
      const minhaPos = tabela.findIndex((l) => l.id === meu) + 1;
      prox.innerHTML = `<div class="cp-campeao">${minhaPos === 1 ? 'CAMPEÃO!' : minhaPos + 'º lugar'}</div><div class="emo" style="font-size:clamp(48px,16vh,90px)">${minhaPos === 1 ? '🏆' : minhaPos <= 3 ? MEDALHA[minhaPos - 1] : '🏁'}</div>
        <button class="tc-pilula tc-verde" data-acao="novo_campeonato_ja"><i class="emo">🔄</i><span>DE NOVO</span></button>`;
      $(s, '.cp-rodape').hidden = true;
      if (G.audio) { G.audio.musica('podio'); if (minhaPos === 1) G.audio.toca('vitoria'); }
    } else {
      const def = PISTAS[Math.min(c.indice, PISTAS.length - 1)];
      prox.innerHTML = `<div class="cp-rotulo">Corrida ${c.indice + 1} de ${PISTAS.length}</div><div class="cp-nome">${escapa(def.nome)}</div>
        ${this._svgDaPista(def, 'cp-desenho')}
        <button class="tc-big tc-verde" data-acao="correr_campeonato" aria-label="Correr">${SVG.play}</button>
        ${c.derrotasSeguidas > 0 ? '<div class="cp-rotulo"><span class="emo">🔁</span> Chegue no pódio para avançar!</div>' : ''}`;
      $(s, '.cp-rodape').hidden = !(c.corridas > 0);
      if (G.audio) G.audio.musica('menu');
    }
    this.vitrine.desativa();
  }

  _entra_opcoes(d) {
    this._voltaDasOpcoes = d.volta || this._voltaDasOpcoes || 'menu';
    this._marcaOpcoes();
  }

  // ================================================================ acoes dos botoes
  _acao(nome, b) {
    const G = this.G, som = (n) => { if (G.audio) G.audio.toca(n); };
    switch (nome) {
      case 'campeonato': {
        som('clique');
        const c = G.jogo.progresso().campeonato;
        if (!c) { this.mostra('selecao_carro', { modo: 'campeonato_novo' }); return; }
        this.modo = 'campeonato';
        this.mostra('campeonato');
        return;
      }
      case 'livre': som('clique'); this.mostra('selecao_carro', { modo: 'livre' }); return;
      case 'opcoes': som('clique'); this.mostra('opcoes', { volta: this.atual }); return;
      case 'tela_cheia': som('clique'); this._telaCheia(false); return;
      case 'voltar': som('voltar'); this._volta(); return;
      case 'menu': som('voltar'); this.mostra('menu'); return;
      case 'carro_anterior': this._trocaCarro(-1); return;
      case 'carro_proximo': this._trocaCarro(1); return;
      case 'escolhe_carro': {
        som('confirmar');
        const cfg = CARROS[this.indiceCarro];
        G.jogo.escolheCarro(cfg.id);
        if (this.modo === 'campeonato_novo') { G.jogo.campeonato(true); save.remove('campeonato_fim'); this.modo = 'campeonato'; this.mostra('campeonato'); }
        else this.mostra('selecao_pista');
        return;
      }
      case 'pista': {
        const id = b.dataset.pista, info = G.jogo.pistas().find((p) => p.def.id === id);
        if (!info || !info.desbloqueada) {
          som('bloqueado');
          if (G.vibracao) G.vibracao.vibra(20);
          b.classList.remove('nao'); void b.offsetWidth; b.classList.add('nao');
          return;
        }
        som('confirmar');
        this.modo = 'livre';
        this._iniciaCorrida({ pista: id, carro: G.jogo.carroEscolhido, modo: 'livre' });
        return;
      }
      case 'pausar': som('clique'); this.pausa(); return;
      case 'continuar': som('clique'); if (G.corrida && G.corrida === this.corrida) G.corrida.pausa(false); else this._fechaSobre(); return;
      case 'reiniciar': som('clique'); if (this._ultima) this._iniciaCorrida(this._ultima); return;
      case 'sair': som('voltar'); this.mostra('menu'); return;
      case 'de_novo': som('clique'); if (this._ultima) this._iniciaCorrida(this._ultima); return;
      case 'proxima': {
        som('clique');
        if (this.resultado && this.resultado.resultado.modo === 'campeonato') { this.modo = 'campeonato'; this.mostra('campeonato'); return; }
        const prox = this.resultado && this._proximaLivre(this.resultado.resultado.pista);
        if (prox) this._iniciaCorrida({ pista: prox, carro: G.jogo.carroEscolhido, modo: 'livre' });
        else this.mostra('menu');
        return;
      }
      case 'correr_campeonato': {
        som('confirmar');
        const c = G.jogo.campeonato(), carro = c.carro || G.jogo.carroEscolhido;
        const def = PISTAS[Math.min(c.indice, PISTAS.length - 1)];
        this.modo = 'campeonato';
        this._iniciaCorrida({ pista: def.id, carro, modo: 'campeonato', rivais: rivaisDoCampeonato(carro) });
        return;
      }
      case 'novo_campeonato':
        som('clique');
        this._pergunta('Começar um campeonato novo?', 'Os pontos deste campeonato vão sumir.', () => this.mostra('selecao_carro', { modo: 'campeonato_novo', carro: G.jogo.carroEscolhido }));
        return;
      case 'novo_campeonato_ja': som('clique'); this.mostra('selecao_carro', { modo: 'campeonato_novo', carro: G.jogo.carroEscolhido }); return;
      case 'op_direcao': {
        som('clique');
        const modo = b.dataset.valor;
        save.mudaOpcoes({ controle: modo });
        if (G.entrada && G.entrada.configura) { try { G.entrada.configura({ modo }); } catch (e) { console.error('[telas] entrada.configura', e); } }
        this._marcaOpcoes();
        return;
      }
      case 'op_acel_auto': {
        som('clique');
        const v = !(this._opcoesAtuais().acelAuto === true);
        save.mudaOpcoes({ acelAuto: v });
        if (G.entrada && G.entrada.configura) { try { G.entrada.configura({ acelAuto: v }); } catch (e) { console.error('[telas] entrada.configura', e); } }
        this._marcaOpcoes();
        return;
      }
      case 'op_qualidade': som('clique'); if (G.qualidade) G.qualidade.define(b.dataset.valor); this._marcaOpcoes(); return;
      case 'op_vibracao': {
        som('clique');
        const v = !(save.opcoes().vibracao !== false);
        save.mudaOpcoes({ vibracao: v });
        if (G.vibracao) { G.vibracao.liga(v); if (v) G.vibracao.vibra(40); }
        this._marcaOpcoes();
        return;
      }
      case 'apagar_progresso':
        som('clique');
        this._pergunta('Apagar todo o progresso?', 'Pistas abertas, recordes e campeonato voltam ao começo.', () => {
          for (const k of ['progresso', 'carro', 'campeonato_fim', 'dda']) save.remove(k);
          G.jogo.carroEscolhido = CARRO_PADRAO;
          this._marcaOpcoes();
        });
        return;
      case 'confirma_sim': { som('confirmar'); const fn = this._confirma; this._confirma = null; this._fechaSobre(); if (fn) fn(); return; }
      case 'confirma_nao': som('voltar'); this._confirma = null; this._fechaSobre(); return;
      default: console.warn('[telas] acao desconhecida: ' + nome);
    }
  }

  _volta() {
    switch (this.atual) {
      case 'selecao_carro': this.mostra(this.modo === 'campeonato_novo' && this.G.jogo.progresso().campeonato ? 'campeonato' : 'menu'); return;
      case 'selecao_pista': this.mostra('selecao_carro', { modo: this.modo }); return;
      case 'opcoes': this.mostra(this._voltaDasOpcoes && this._secoes[this._voltaDasOpcoes] && this._voltaDasOpcoes !== 'opcoes' ? this._voltaDasOpcoes : 'menu'); return;
      default: this.mostra('menu');
    }
  }

  _tecla(e) {
    if (e.repeat) return;
    const G = this.G, k = e.code;
    const naCorrida = G.corrida && G.corrida === this.corrida && this.atual === 'corrida';
    if (naCorrida) {
      if (k === 'Escape' || k === 'KeyP') {
        this._pausaPorTecla = performance.now();
        if (G.corrida.pausada) G.corrida.pausa(false); else this.pausa();
        e.preventDefault();
      }
      return;
    }
    if (this.sobre === 'confirma') { if (k === 'Escape') this._acao('confirma_nao'); return; }
    if (k === 'Escape' && this.atual && this.atual !== 'menu') { this._acao(this.atual === 'campeonato' || this.atual === 'resultado' ? 'menu' : 'voltar'); e.preventDefault(); return; }
    if (this.atual === 'selecao_carro') {
      if (k === 'ArrowLeft' || k === 'KeyA') this._trocaCarro(-1);
      else if (k === 'ArrowRight' || k === 'KeyD') this._trocaCarro(1);
      else if (k === 'Enter' || k === 'Space') this._acao('escolhe_carro');
    }
  }

  // ================================================================ corrida
  async _iniciaCorrida(op) {
    const G = this.G;
    if (this._carregandoCorrida || !op || !op.pista) return null;
    this._carregandoCorrida = true;
    this._ultima = { pista: op.pista, carro: op.carro, modo: op.modo || 'livre', rivais: op.rivais || undefined };
    this._fim = null;
    this.vitrine.desativa();
    if (G.hud) G.hud.esconde();
    if (G.entrada && G.entrada.mostraControles) G.entrada.mostraControles(false);
    this.mostra('carregando_corrida', this._ultima);
    // a faixa da pista decodifica junto com a carga da corrida: quando a largada aparece ela ja entra (js/audio.js preparaMusica)
    if (G.audio && G.audio.preparaMusica) G.audio.preparaMusica(op.pista);
    this._pedida = true;
    let c = null;
    try {
      c = await G.jogo.iniciaCorrida({ ...this._ultima });
    } catch (e) {
      console.error('[telas] a corrida nao carregou', e);
      this._pedida = false;
      this._carregandoCorrida = false;
      // o jogo.js poe a corrida em G.corrida ANTES de carregar: a meio montada nao pode ficar pendurada no laco
      if (G.corrida && G.corrida.estado === 'carregando') { try { G.jogo.encerraCorrida(); } catch (e2) { G.corrida = null; } }
      this.mostra('menu');
      return null;
    }
    this._carregandoCorrida = false;
    // a corrida pode ter carregado sem o evento chegar aqui (ouvintes limpos por uma suite): adota do mesmo jeito
    if (this._pedida) this._aoCarregar(c);
    return c;
  }

  _aoCarregar(c) {
    if (!this._pedida || !c) return;
    const G = this.G;
    this._pedida = false;
    this.corrida = c;
    this.mostra('corrida');
    if (G.hud) G.hud.mostra(c);
    if (G.entrada && G.entrada.mostraControles) G.entrada.mostraControles(true);
    if (G.audio) G.audio.musica(c.pista);
  }

  /** O resultado chegou (no passo seguinte ao `corrida:fim`): registra, desmonta a corrida e mostra o podio. */
  _terminou(resultado) {
    const G = this.G;
    let resumo = null;
    try { resumo = G.jogo.registraResultado(resultado); } catch (e) { console.error('[telas] registraResultado', e); }
    if (resultado.modo === 'campeonato' && resumo && resumo.fimDoCampeonato) {
      const c = G.jogo.progresso().campeonato;
      if (c) save.grava('campeonato_fim', this._assinatura(c));
    }
    this.resultado = { resultado, resumo };
    // a corrida acabou: desmonta ja (o podio e outra cena; "correr de novo" usa as opcoes guardadas em _ultima)
    this._saiDaCorrida();
    this.mostra('resultado', this.resultado);
  }

  /** Sai da corrida das telas (menu, fim): desmonta e esconde HUD e controles. */
  _saiDaCorrida() {
    const G = this.G;
    if (G.hud) G.hud.esconde();
    if (G.entrada && G.entrada.mostraControles) G.entrada.mostraControles(false);
    if (G.audio) G.audio.motor(null);
    if (this.corrida && G.corrida === this.corrida) G.jogo.encerraCorrida();
    this.corrida = null;
    this._pedida = false;
  }

  // ================================================================ partes
  _mostraCarro(trocou) {
    const s = this._secoes.selecao_carro, cfg = CARROS[this.indiceCarro];
    const nome = $(s, '.sc-nome span');
    nome.textContent = cfg.nome;
    this._cabeNome(s, nome);
    if (trocou) { nome.style.animation = 'none'; void nome.offsetWidth; nome.style.animation = ''; }
    $(s, '.sc-desc').textContent = cfg.descricao || '';
    const at = cfg.atributos || {};
    for (const [k] of ATRIBUTOS) {
      const v = Math.max(0, Math.min(5, Math.round(at[k] || 0)));
      $(s, `.sc-attr[data-attr=${k}]`).querySelectorAll('.sc-barra b').forEach((b, i) => b.classList.toggle('on', i < v));
    }
    const pd = PODERES[cfg.poder] || { nome: '?', icone: '✨', cor: '#ffd23a', descricao: '', esquiva: '' };
    const ic = $(s, '.sc-poder-icone');
    ic.textContent = pd.icone;
    ic.style.setProperty('--cor', pd.cor);
    $(s, '.sc-poder-nome').textContent = pd.nome;
    $(s, '.sc-poder-desc').textContent = pd.descricao;
    $(s, '.sc-esquiva').innerHTML = `<span class="emo">🛡️</span> ${escapa(pd.esquiva)}`;
    s.querySelectorAll('.sc-pontos i').forEach((p, i) => p.classList.toggle('on', i === this.indiceCarro));
    this.vitrine.mostraCarro(cfg, 'selecao');
  }

  /** Nome comprido encolhe para caber entre o botao de voltar e o painel: "Toyota GR Yaris Voador" (o nome do Cidade Aberta, 31/10/2026)
   *  passava por baixo do botao no iPhone deitado. Mede o que o navegador desenhou (a fonte do titulo pode nao ter carregado). */
  _cabeNome(s, nome) {
    nome.style.fontSize = '';
    const caixa = nome.parentElement, voltar = $(s, '.tc-voltar');
    if (!caixa || !caixa.clientWidth) return;   // tela ainda escondida: mede de novo quando aparecer (_entra_selecao_carro)
    const cx = caixa.getBoundingClientRect(), vb = voltar ? voltar.getBoundingClientRect() : null;
    const margem = vb && vb.width ? Math.max(0, vb.right - cx.left) + NOME_FOLGA : NOME_FOLGA;
    const livre = cx.width - 2 * margem, w = nome.offsetWidth;   // centralizado: a mesma margem dos dois lados
    if (livre > 0 && w > livre) nome.style.fontSize = (parseFloat(getComputedStyle(nome).fontSize) * livre / w).toFixed(1) + 'px';
  }

  _trocaCarro(passo) {
    const n = CARROS.length;
    this.indiceCarro = (this.indiceCarro + passo + n) % n;
    if (this.G.audio) this.G.audio.toca('trocar');
    this._mostraCarro(true);
  }

  _ligaArrasto(area) {
    let id = null, x0 = 0, y0 = 0, xa = 0, trocou = false;
    area.addEventListener('pointerdown', (e) => { id = e.pointerId; x0 = xa = e.clientX; y0 = e.clientY; trocou = false; try { area.setPointerCapture(id); } catch (er) { /* sem captura */ } });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.vitrine.empurra(e.clientX - xa);
      xa = e.clientX;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!trocou && Math.abs(dx) > ARRASTO_TROCA && Math.abs(dx) > Math.abs(dy) * 1.2) { trocou = true; this._trocaCarro(dx < 0 ? 1 : -1); }
    });
    const fim = (e) => { if (e.pointerId === id) id = null; };
    area.addEventListener('pointerup', fim);
    area.addEventListener('pointercancel', fim);
  }

  _svgDaPista(def, classe) {
    let d = this._desenhos.get(def.id);
    if (!d) {
      try { d = desenhoDaPista(def); } catch (e) { console.error('[telas] desenho da pista ' + def.id, e); d = { principal: '', atalhos: [], lado: 100 }; }
      this._desenhos.set(def.id, d);
    }
    return svgDaPista(d, classe);
  }

  /** Cores do cartao: o ceu em cima e o chao embaixo, do tema da fase 3 (ceu pode ser texto ou { topo, meio, ... }; o chao e
   *  terreno.cor ou chao), e a paleta do tema musical se a pista nao trouxer. */
  _coresDaPista(def, tema) {
    const t = def.tema || {}, padrao = CORES_DO_TEMA[tema] || ['#5ac8ff', '#2a4fb8'];
    const texto = (v) => (typeof v === 'string' && v ? v : null);
    const ceu = t.ceu && typeof t.ceu === 'object' ? texto(t.ceu.topo) || texto(t.ceu.meio) : texto(t.ceu);
    const chao = (t.terreno && texto(t.terreno.cor)) || texto(t.chao) || (t.hemi && texto(t.hemi.chao));
    return [texto(t.cor) || ceu || padrao[0], chao || padrao[1]];
  }

  /** Proxima pista desbloqueada depois de `id` na ordem do campeonato (corrida livre). */
  _proximaLivre(id) {
    const lista = this.G.jogo.pistas(), i = lista.findIndex((p) => p.def.id === id);
    const prox = i >= 0 ? lista[i + 1] : null;
    return prox && prox.desbloqueada ? prox.def.id : null;
  }

  _assinatura(c) {
    const soma = Object.values(c.pontos || {}).reduce((a, b) => a + b, 0);
    return { corridas: c.corridas, soma };
  }

  _campeonatoTerminou(c) {
    const f = save.le('campeonato_fim', null);
    if (!f || !c) return false;
    const a = this._assinatura(c);
    return f.corridas === a.corridas && f.soma === a.soma;
  }

  _opcoesAtuais() {
    const o = save.opcoes(), e = this.G.entrada || {};
    // a entrada (fase 2) e a dona do controle: o que ela esta usando agora vale mais que o salvo (e o padrao dela e dela)
    const modo = typeof e.modo === 'string' ? e.modo : o.controle || 'joystick';   // 'joystick' = ARRASTAR, o padrao (js/entrada.js)
    const acel = typeof e.acelAuto === 'boolean' ? e.acelAuto : typeof o.acelAuto === 'boolean' ? o.acelAuto : false; // padrao igual ao da entrada
    return { ...o, controle: modo, acelAuto: acel };
  }

  _marcaOpcoes() {
    const s = this._secoes.opcoes, o = this._opcoesAtuais(), G = this.G;
    s.querySelectorAll('[data-grupo=direcao] button').forEach((b) => b.classList.toggle('on', b.dataset.valor === o.controle));
    const q = G.qualidade ? G.qualidade.escolha : o.qualidade;
    s.querySelectorAll('[data-grupo=qualidade] button').forEach((b) => b.classList.toggle('on', b.dataset.valor === q));
    $(s, '[data-acao=op_acel_auto]').setAttribute('aria-pressed', String(!!o.acelAuto));
    $(s, '[data-acao=op_vibracao]').setAttribute('aria-pressed', String(o.vibracao !== false));
    $(s, '[data-op=musica]').value = String(o.musica);
    $(s, '[data-op=efeitos]').value = String(o.efeitos);
    $(s, '.op-aviso').hidden = !save.falhou();
  }

  _volume(qual, v, grava) {
    const G = this.G, x = Math.max(0, Math.min(100, Math.round(v)));
    if (G.audio) { if (qual === 'musica') G.audio.volume(null, x / 100, null); else G.audio.volume(null, null, x / 100); }
    if (grava) { save.mudaOpcoes({ [qual]: x }); if (qual === 'efeitos' && G.audio) G.audio.toca('clique'); }
  }

  _pergunta(texto, detalhe, sim) {
    const s = this._secoes.confirma;
    $(s, '.tc-pergunta').innerHTML = `${escapa(texto)}<small>${escapa(detalhe)}</small>`;
    this._confirma = sim;
    this._abreSobre('confirma');
  }

  _abreSobre(nome) {
    const s = this._secoes[nome];
    if (!s) return;
    if (this.sobre && this.sobre !== nome) this._secoes[this.sobre].hidden = true;
    this.sobre = nome;
    s.hidden = false;
    if (nome === 'pausa') emite('jogo:tela', { nome: 'pausa' });
  }

  _fechaSobre() {
    if (!this.sobre) return;
    this._secoes[this.sobre].hidden = true;
    this.sobre = null;
  }

  _telaCheia(forca) {
    try {
      const d = document, el = d.documentElement;
      const dentro = d.fullscreenElement || d.webkitFullscreenElement;
      if (dentro) { if (!forca) (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
      const pede = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!pede) return;
      const trava = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* sem trava */ } };
      const p = pede.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(trava).catch(() => {}); else trava();
    } catch (e) { /* iframe do artefato, navegador sem tela cheia: o jogo segue */ }
  }
}
