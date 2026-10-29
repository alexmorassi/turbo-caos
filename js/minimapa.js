// MINIMAPA (fase 6): canvas 2D no canto do HUD com o contorno da pista vista de cima, os atalhos tracejados e um ponto por carro com a
// cor do carro (o jogador maior, com anel branco e um pulso — e o ponto que a crianca procura).
//
// POR QUE ASSIM:
//   * a pista e desenhada UMA vez num canvas de fundo (`monta`); a cada atualizacao so se copia o fundo e se pintam os 6-8 pontos —
//     redesenhar 1000 segmentos de spline 20 vezes por segundo no celular fraco custaria mais que o minimapa vale;
//   * a RETA DE LARGADA APONTA PARA CIMA: a crianca reconhece a pista pelo formato, e o formato so e o mesmo de uma corrida para a
//     outra se a orientacao for fixa. Girar com o carro (estilo GPS) confunde quem ainda nao le mapa;
//   * a vista e de cima com a mao certa: olhando de +Y com a frente para cima, curva para a direita do piloto vira curva para a direita
//     no desenho (a conta esta em `_base`);
//   * loop e rampa somem no desenho (a altura nao entra): o minimapa e para "onde estou e quem esta perto", nao para o relevo.
// Sem alocacao por quadro: o laco de pontos so le `carro.pos` e escreve no contexto 2D.

/** Folga entre a pista e a borda do canvas (fracao do lado). */
const MARGEM = 0.1;
/** Espessura do tracado em fracao do lado (o asfalto e a borda clara). */
const LARGURA_DA_PISTA = 0.075;
const LARGURA_DA_BORDA = 0.12;
/** Raio dos pontos em fracao do lado. */
const RAIO_RIVAL = 0.045;
const RAIO_JOGADOR = 0.065;

/** Qualquer cor da config (numero 0xRRGGBB, '#rgb', '#rrggbb', nome CSS) vira texto CSS. */
export function corCSS(c, padrao = '#ffffff') {
  if (typeof c === 'number' && Number.isFinite(c)) return '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
  if (typeof c === 'string' && c) return c;
  return padrao;
}

export class Minimapa {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fundo = document.createElement('canvas');
    this.pista = null;
    this.lado = 0;
    this._cores = new Map();
    this._t = 0;
  }

  /** Prepara para uma pista: transformacao (rotacao + escala) e o desenho do fundo. Chame de novo se o tamanho do canvas mudar. */
  monta(pista) {
    this.pista = pista;
    this._cores.clear();
    const css = Math.max(40, Math.round(this.canvas.clientWidth || 120));
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.lado = Math.round(css * dpr);
    this.canvas.width = this.canvas.height = this.lado;
    this.fundo.width = this.fundo.height = this.lado;
    this._base(pista);
    this._desenhaFundo(pista);
  }

  /** Redesenha os pontos. `dt` anima o pulso do jogador. */
  desenha(carros, jogador, dt = 0) {
    if (!this.pista || !this.lado) return;
    const L = this.lado, g = this.ctx;
    this._t += dt;
    g.clearRect(0, 0, L, L);
    g.drawImage(this.fundo, 0, 0);
    for (let k = carros.length - 1; k >= 0; k--) {
      const c = carros[k];
      if (c === jogador || !c.pos) continue;
      this._ponto(g, c, RAIO_RIVAL * L, false);
    }
    if (jogador && jogador.pos) {
      const pulso = 1 + 0.18 * Math.sin(this._t * 7);
      this._ponto(g, jogador, RAIO_JOGADOR * L * pulso, true);
    }
  }

  /** Coordenada de tela (0..lado) de um ponto do mundo — as suites usam para conferir a orientacao. */
  projeta(x, z, out) {
    const u = x - this._cx, v = z - this._cz;
    out.x = this.lado / 2 + (u * this._cos - v * this._sen) * this._escala;
    out.y = this.lado / 2 + (u * this._sen + v * this._cos) * this._escala;
    return out;
  }

  // ------------------------------------------------------------ interno
  _base(pista) {
    // direcao da largada (T na amostra 0) vista de cima: tela = (x, z) com y para baixo (ver o cabecalho); gira para ela apontar para cima
    const P = pista.principal, T = P.T;
    const ang = -Math.PI / 2 - Math.atan2(T[2], T[0]);
    this._cos = Math.cos(ang); this._sen = Math.sin(ang);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const gira = (x, z) => {
      const u = x * this._cos - z * this._sen, v = x * this._sen + z * this._cos;
      if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
    };
    for (const sup of pista.superficies) for (let i = 0; i < sup.n; i++) gira(sup.P[i * 3], sup.P[i * 3 + 2]);
    const largura = Math.max(1, maxU - minU), altura = Math.max(1, maxV - minV);
    this._escala = (this.lado * (1 - 2 * MARGEM)) / Math.max(largura, altura);
    // centro da caixa, desfeito o giro (projeta subtrai o centro ANTES de girar)
    const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    this._cx = cu * this._cos + cv * this._sen;
    this._cz = -cu * this._sen + cv * this._cos;
  }

  _caminho(g, sup) {
    const o = { x: 0, y: 0 };
    g.beginPath();
    for (let i = 0; i < sup.n; i++) {
      this.projeta(sup.P[i * 3], sup.P[i * 3 + 2], o);
      if (i === 0) g.moveTo(o.x, o.y); else g.lineTo(o.x, o.y);
    }
    if (sup.fechada) g.closePath();
  }

  _desenhaFundo(pista) {
    const L = this.lado, g = this.fundo.getContext('2d');
    g.clearRect(0, 0, L, L);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // atalhos por baixo (a principal passa por cima nas bocas)
    for (const a of pista.atalhos) {
      this._caminho(g, a.sup);
      g.strokeStyle = 'rgba(16,32,74,.85)'; g.lineWidth = LARGURA_DA_BORDA * L * 0.8; g.stroke();
      g.setLineDash([L * 0.03, L * 0.025]);
      g.strokeStyle = '#ffd23a'; g.lineWidth = LARGURA_DA_PISTA * L * 0.6; g.stroke();
      g.setLineDash([]);
    }
    this._caminho(g, pista.principal);
    g.strokeStyle = 'rgba(16,32,74,.9)'; g.lineWidth = LARGURA_DA_BORDA * L; g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = LARGURA_DA_PISTA * L; g.stroke();
    // a largada: um tracinho xadrez atravessado na amostra 0
    const P = pista.principal, o = { x: 0, y: 0 }, o2 = { x: 0, y: 0 };
    this.projeta(P.P[0], P.P[2], o);
    this.projeta(P.P[0] + P.R[0] * 6, P.P[2] + P.R[2] * 6, o2);
    const dx = o2.x - o.x, dy = o2.y - o.y, n = Math.hypot(dx, dy) || 1, k = (LARGURA_DA_BORDA * L * 0.55) / n;
    g.strokeStyle = '#10204a'; g.lineWidth = L * 0.035; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(o.x - dx * k, o.y - dy * k); g.lineTo(o.x + dx * k, o.y + dy * k); g.stroke();
    g.strokeStyle = '#fffaf0'; g.lineWidth = L * 0.035; g.setLineDash([L * 0.018, L * 0.018]);
    g.beginPath(); g.moveTo(o.x - dx * k, o.y - dy * k); g.lineTo(o.x + dx * k, o.y + dy * k); g.stroke();
    g.setLineDash([]); g.lineCap = 'round';
  }

  _ponto(g, carro, r, ehJogador) {
    const o = this._o || (this._o = { x: 0, y: 0 });
    this.projeta(carro.pos.x, carro.pos.z, o);
    let cor = this._cores.get(carro);
    if (!cor) { cor = corCSS(carro.cfg && carro.cfg.cor, '#ff7a1a'); this._cores.set(carro, cor); }
    g.beginPath();
    g.arc(o.x, o.y, r, 0, Math.PI * 2);
    g.fillStyle = cor; g.fill();
    g.lineWidth = ehJogador ? r * 0.42 : r * 0.35;
    g.strokeStyle = ehJogador ? '#ffffff' : '#10204a';
    g.stroke();
    if (ehJogador) { g.lineWidth = r * 0.16; g.strokeStyle = '#10204a'; g.beginPath(); g.arc(o.x, o.y, r * 1.24, 0, Math.PI * 2); g.stroke(); }
  }
}
