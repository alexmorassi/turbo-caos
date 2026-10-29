// SORTEIO DA JOGABILIDADE (fase 1, fundacao). Gerador mulberry32 proprio, separado do Math.random.
// POR QUE (armadilha do dinotrails-web, custou uma suite que reprovava 1 vez em 3): o Math.random e compartilhado com o
// generateUUID do three.js, que o consome a cada textura que chega do disco — num momento que depende do disco. Com um gerador so
// da jogabilidade e semente fixa em ?teste=/?foto=/?semente=, a mesma suite mede a mesma corrida em qualquer maquina.
export class Sorteio {
  constructor(semente) { this.semente(semente); }
  semente(n) { this._s = (n >>> 0) || 1; return this; }
  /** [0, 1) */
  num() {
    this._s = (this._s + 0x6D2B79F5) >>> 0;
    let t = this._s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entre(a, b) { return a + (b - a) * this.num(); }
  inteiro(a, b) { return a + Math.floor(this.num() * (b - a + 1)); }
  escolhe(lista) { return lista[Math.floor(this.num() * lista.length)]; }
  embaralha(lista) { for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(this.num() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; } return lista; }
}
