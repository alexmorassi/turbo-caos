// STUB DA FUNDACAO (fase 1) — a fase 6 substitui por todas as telas (docs/CONTRATOS.md secao 10). Aqui: um menu de um botao.
import { on } from './eventos.js';
import { PISTAS } from '../config/pistas.js';
export class Telas {
  constructor(G) { this.G = G; this.el = null; }
  async inicia(progresso) { const c = document.getElementById('carregando'); if (c) c.style.display = 'none'; on('corrida:fim', () => setTimeout(() => { this.G.jogo.encerraCorrida(); this.G.hud.esconde(); this.mostra('menu'); }, 1500)); }
  mostra(nome, dados) {
    const G = this.G;
    if (nome === 'menu') {
      if (!this.el) { this.el = document.createElement('div'); this.el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9'; document.body.appendChild(this.el); }
      this.el.innerHTML = '<button style="font:800 32px system-ui;padding:18px 40px;border-radius:18px">CORRER</button>'; this.el.style.display = 'flex';
      this.el.querySelector('button').onclick = () => { this.el.style.display = 'none'; this.mostra('corrida_direta', { pista: PISTAS[0].id }); };
    } else if (nome === 'corrida_direta') {
      G.jogo.iniciaCorrida({ pista: dados.pista, carro: dados.carro || undefined, modo: 'livre' }).then((c) => { G.hud.mostra(c); G.entrada.mostraControles(true); });
    }
  }
  passo() {} quadro() {}
}
