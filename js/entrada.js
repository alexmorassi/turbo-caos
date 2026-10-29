// STUB DA FUNDACAO (fase 1) — a fase 2 substitui pelos controles de toque, inclinacao e teclado (docs/CONTRATOS.md secao 6).
const ACOES = ['acel', 'freio', 'direcao', 'drift', 'turbo', 'poder', 'pausa'];
export class Entrada {
  constructor(G) {
    this.G = G; this.simulada = false; this.estado = {}; this._ultimo = {}; this._teclas = new Set();
    for (const a of ACOES) { this.estado[a] = 0; this._ultimo[a] = 0; }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this._teclas.add(e.code));
      window.addEventListener('keyup', (e) => this._teclas.delete(e.code));
    }
  }
  passo() {
    for (const a of ACOES) this._ultimo[a] = this._agora ? this._agora[a] : 0;
    if (!this.simulada) {
      const k = this._teclas, t = (c) => k.has(c) ? 1 : 0;
      this.estado.acel = Math.max(t('ArrowUp'), t('KeyW'));
      this.estado.freio = Math.max(t('ArrowDown'), t('KeyS'));
      this.estado.direcao = Math.max(t('ArrowRight'), t('KeyD')) - Math.max(t('ArrowLeft'), t('KeyA'));
      this.estado.turbo = t('Space'); this.estado.poder = Math.max(t('KeyE'), t('ShiftLeft')); this.estado.drift = t('ControlLeft');
    }
    this._agora = { ...this.estado };
  }
  apertou(a) { return !!this.estado[a] && !this._ultimo[a]; }
  aplicaNoCarro(c) { const e = this.estado; c.controle.acel = e.acel; c.controle.freio = e.freio; c.controle.direcao = e.direcao; c.controle.drift = !!e.drift; c.controle.turbo = !!e.turbo; c.controle.poder = this.apertou('poder'); }
  mostraControles() {} configura() {}
  esqueceTudo() { this._teclas.clear(); for (const a of ACOES) { this.estado[a] = 0; this._ultimo[a] = 0; } this._agora = null; }
}
