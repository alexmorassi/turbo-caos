// STUB DA FUNDACAO (fase 1) — a fase 6 substitui pelo HUD de verdade (docs/CONTRATOS.md secao 10).
export class HUD {
  constructor(G) { this.G = G; this.el = null; this.corrida = null; }
  mostra(corrida) {
    this.corrida = corrida;
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'hud-stub'; this.el.style.cssText = 'position:fixed;left:12px;top:10px;font:700 22px system-ui;color:#fff;text-shadow:0 2px 4px #000;pointer-events:none;z-index:5'; document.body.appendChild(this.el); }
    this.el.style.display = 'block';
  }
  esconde() { if (this.el) this.el.style.display = 'none'; this.corrida = null; }
  aviso() {}
  passo() {
    const c = this.corrida; if (!c || !this.el || !c.jogador) return; const j = c.jogador;
    this.el.textContent = c.estado === 'contagem' ? `Largada em ${c.contagem}…` : `${j.posicao}º/${c.carros.length} · volta ${Math.max(1, Math.min(c.voltas, j.volta))}/${c.voltas} · ${(j.velocidade * 3.6).toFixed(0)} km/h`;
  }
}
