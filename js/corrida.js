// A CORRIDA (fase 1, fundacao): monta a pista, a grade e os sistemas, roda a ordem do passo e aplica as regras (largada, voltas,
// posicoes, chegada, resultado). Nao sabe desenhar nem tocar som: cada sistema e de uma fase (docs/CONTRATOS.md secao 7) e a corrida so
// os chama na ordem certa. O resultado sai no evento `corrida:fim`; quem mostra o podio e a fase 6.
//
// ORDEM DO PASSO (e por que):
//   1. zeraMod de todos — cada sistema MULTIPLICA o seu efeito no `mod` do carro; zerar no comeco e o que deixa turbo + encolhedor +
//      rubber band conviverem sem um apagar o outro;
//   2. controles (entrada do jogador, IA dos outros) — o comando do passo vem antes de qualquer efeito;
//   3. dificuldade (fator da IA e rubber band) -> poderes (disparo e efeitos ativos) -> turbo (liga/desliga e consome);
//   4. fisica de cada carro -> colisoes entre carros -> capsulas (quem passou por cima pegou);
//   5. regras (voltas, posicoes, chegada) -> camera (enquadra onde o carro PAROU, nunca onde queria estar).
import * as THREE from 'three';
import { Pista } from './pista.js';
import { Carro } from './carro.js';
import { colide } from './colisoes.js';
import { CameraCorrida } from './camera.js';
import { montaVisualDaPista } from './visual_pista.js';
import { Turbo } from './turbo.js';
import { Capsulas } from './capsulas.js';
import { Poderes } from './poderes.js';
import { IA } from './ia.js';
import { Dificuldade } from './dificuldade.js';
import { CARROS } from '../config/carros.js';
import { CORRIDA } from '../config/corrida.js';
import { emite, on } from './eventos.js';

/** Lugar do jogador na grade (indice, 0 = pole). Penultimo: comeca atras e passa os outros — ultrapassar e a graca da corrida maluca,
 *  e a dificuldade adaptativa (fase 5) cuida de nao virar frustracao. */
const LUGAR_DO_JOGADOR = (n) => Math.max(0, n - 2);
/** Segundos de festa depois que o jogador cruza a chegada (o carro segue no piloto automatico) antes do resultado. */
const FESTA = 3;
/** Intensidade da luz de preenchimento presa a camera (ver carrega()). */
const LUZ_DA_CAMERA = 0.45;

export class Corrida {
  constructor(G, opcoes) {
    this.G = G;
    this.opcoes = opcoes;
    this.estado = 'carregando';
    this.t = 0;
    this.tContagem = 0;
    this.contagem = CORRIDA.CONTAGEM;
    this.voltas = opcoes.voltas;
    this.carros = [];
    this.ordem = [];
    this.jogador = null;
    this.resultado = null;
    this.pausada = false;
    this.fimEm = null;
    this.chegaram = 0;
    this._desligar = [];
  }

  /** Escolhe os rivais: os carros que nao sao o do jogador, numa ordem sorteada (semente da corrida), ou a lista do campeonato. */
  _rivais(n) {
    const G = this.G, meu = this.opcoes.carro;
    if (this.opcoes.rivais) return this.opcoes.rivais.filter((id) => id !== meu).slice(0, n);
    const outros = CARROS.map((c) => c.id).filter((id) => id !== meu);
    return G.sorteio.embaralha(outros).slice(0, n);
  }

  async carrega() {
    const G = this.G;
    this.pista = new Pista(this.opcoes.def);
    G.pista = this.pista;
    this.cena = new THREE.Scene();
    G.cena = this.cena;
    this.visual = await montaVisualDaPista(G, this.pista);
    this.cena.add(this.visual.grupo);
    // LUZ DE PREENCHIMENTO presa a camera (sugestao da fase 2): no topo do loop o sol bate nas costas do carro e ele vira um vulto
    // preto. Fraca (0,45) para nao achatar o volume nas retas; o alvo e filho da camera, senao a luz apontaria para a origem do mundo.
    this.cena.add(G.camera);
    const luz = new THREE.DirectionalLight(0xffffff, LUZ_DA_CAMERA);
    luz.position.set(0, 0, 0); luz.target.position.set(0, -0.35, -1);
    G.camera.add(luz); G.camera.add(luz.target);
    this._luzDaCamera = luz;

    // carros: jogador + rivais, na grade
    const n = this.opcoes.corredores;
    const ids = this._rivais(n - 1);
    const lugarJogador = LUGAR_DO_JOGADOR(n);
    const grade = this.pista.grade(n);
    const cfgDe = (id) => CARROS.find((c) => c.id === id) || CARROS[0];
    let r = 0;
    for (let k = 0; k < n; k++) {
      const ehJogador = k === lugarJogador;
      const cfg = ehJogador ? cfgDe(this.opcoes.carro) : cfgDe(ids[r++ % ids.length]);
      const carro = new Carro(G, this, { cfg, indice: k, ehJogador, nome: ehJogador ? 'Você' : cfg.nome });
      carro.volta = 0; carro.progresso = 0; carro.posicao = k + 1; carro.chegou = false; carro.tempoChegada = 0;
      carro.temposDeVolta = []; carro.melhorVolta = 0; carro.batidas = 0; carro._sAnt = null; carro._inicioVolta = 0; carro._voltasTiradas = 0;
      this.carros.push(carro);
      if (ehJogador) this.jogador = carro;
    }
    await Promise.all(this.carros.map((c) => c.carrega()));
    for (const [k, c] of this.carros.entries()) {
      c.colocaNaPista(0, grade[k].s, grade[k].d, 0, 0);
      c.sSeguro = grade[k].s;
      if (c.visual && c.visual.grupo) this.cena.add(c.visual.grupo);
    }
    this.ordem = this.carros.slice().sort((a, b) => a.posicao - b.posicao);

    // sistemas (cada um de uma fase)
    this.turbo = new Turbo(G, this);
    this.capsulas = new Capsulas(G, this);
    this.poderes = new Poderes(G, this);
    this.dificuldade = new Dificuldade(G, this);
    this.ia = new IA(G, this);
    this.camera = new CameraCorrida(G, this);
    for (const s of this._sistemas()) if (s.inicia) s.inicia();
    this._desligar.push(on('carro:batida', (e) => { if (e.carro) e.carro.batidas = (e.carro.batidas || 0) + 1; }));

    G.desenho = { cena: this.cena, camera: G.camera };
    this.estado = 'contagem';
    this.tContagem = 0;
    this.contagem = CORRIDA.CONTAGEM;
    emite('corrida:carregada', { corrida: this });
    emite('corrida:contagem', { n: this.contagem });
    return this;
  }

  _sistemas() { return [this.turbo, this.capsulas, this.poderes, this.dificuldade, this.ia, this.camera].filter(Boolean); }

  pausa(sim) {
    if (this.estado === 'terminou' || this.pausada === !!sim) return;
    this.pausada = !!sim;
    emite('corrida:pausa', { pausada: this.pausada });
  }

  passo(dt) {
    if (this.pausada || this.estado === 'carregando' || this.estado === 'terminou') return;
    const G = this.G;
    // `modAnterior` = o mod que valeu no passo anterior (encolhido, EMP, terremoto...): a IA roda antes dos poderes e so enxerga o
    // efeito por ele (pendencia da fase 5). Copia campo a campo num objeto fixo: nada alocado no passo.
    for (const c of this.carros) { if (!c.modAnterior) c.modAnterior = { ...c.mod }; else Object.assign(c.modAnterior, c.mod); c.zeraMod(); }

    if (this.estado === 'contagem') {
      // a largada: 1 s por numero; os carros ficam parados (comando zero) mas a fisica roda (assentam na pista)
      this.tContagem += dt;
      for (const c of this.carros) c.controle.acel = c.controle.freio = c.controle.direcao = 0, c.controle.turbo = c.controle.poder = c.controle.drift = false;
      if (this.tContagem >= 1) {
        this.tContagem -= 1;
        this.contagem--;
        emite('corrida:contagem', { n: this.contagem });
        if (this.contagem <= 0) { this.estado = 'correndo'; this.t = 0; emite('corrida:largada', {}); }
      }
    } else {
      this.t += dt;
      const j = this.jogador;
      if (j && !j.chegou && !G.flags.auto) G.entrada.aplicaNoCarro(j);
    }
    if (this.estado === 'correndo') {
      this.ia.passo(dt);
      this.dificuldade.passo(dt);
      this.poderes.passo(dt);
      this.turbo.passo(dt);
    }
    for (const c of this.carros) c.passo(dt);
    colide(this);
    if (this.estado === 'correndo') { this.capsulas.passo(dt); this._regras(); }
    this.camera.passo(dt);
    if (this.fimEm !== null && this.t >= this.fimEm) this._termina();
    if (this.estado === 'correndo' && this.t >= CORRIDA.TETO_DA_CORRIDA) this._termina();
  }

  /** Voltas, progresso e posicoes. A volta conta ao cruzar s = 0 da principal para a frente (pista.sPrincipal converte atalho). */
  _regras() {
    const L = this.pista.comprimento;
    for (const c of this.carros) {
      const s = this.pista.sPrincipal(c.sup, c.s);
      if (c._sAnt !== null && !c.chegou) {
        if (c._sAnt > L * 0.75 && s < L * 0.25) {
          // cruzar de novo depois de ter voltado de re pela linha so DEVOLVE a volta tirada: nao e volta nova nem tem tempo de volta
          // (fase 5: o Troca-Troca logo depois da chegada jogava o carro para tras dela e a volta seguinte saia com 1,4 s)
          if (c._voltasTiradas > 0) { c._voltasTiradas--; c.volta++; } else this._cruzou(c);
        } else if (c._sAnt < L * 0.25 && s > L * 0.75 && c.volta > 0) { c.volta--; c._voltasTiradas = (c._voltasTiradas || 0) + 1; } // de re pela linha: nao vale
      }
      c._sAnt = s;
      c.progresso = c.chegou ? this.voltas * L : (c.volta <= 0 ? s - L : (c.volta - 1) * L + s);
    }
    // posicao: quem chegou, pela ordem de chegada; os outros pelo progresso
    this.ordem.sort((a, b) => {
      if (a.chegou !== b.chegou) return a.chegou ? -1 : 1;
      if (a.chegou) return a.tempoChegada - b.tempoChegada;
      return b.progresso - a.progresso;
    });
    for (let k = 0; k < this.ordem.length; k++) this.ordem[k].posicao = k + 1;
  }

  _cruzou(c) {
    c.volta++;
    if (c.volta >= 2) {
      const tv = this.t - c._inicioVolta;
      c.temposDeVolta.push(tv);
      if (!c.melhorVolta || tv < c.melhorVolta) c.melhorVolta = tv;
    }
    c._inicioVolta = this.t;
    if (c.volta > this.voltas) {
      c.chegou = true;
      c.tempoChegada = this.t;
      this.chegaram++;
      emite('corrida:chegada', { carro: c, posicao: this.chegaram, tempo: this.t });
      if (c.ehJogador && this.fimEm === null) this.fimEm = this.t + FESTA;
      return;
    }
    emite('corrida:volta', { carro: c, volta: c.volta, tempo: c.temposDeVolta[c.temposDeVolta.length - 1] || 0 });
    if (c.volta === this.voltas) emite('corrida:ultima_volta', { carro: c });
  }

  /** Fecha a corrida: quem nao chegou recebe tempo ESTIMADO pela velocidade media (crianca nao espera o ultimo). */
  _termina() {
    if (this.estado === 'terminou') return;
    this._regras();
    const L = this.pista.comprimento, total = this.voltas * L;
    const linhas = this.ordem.map((c) => {
      let tempo = c.tempoChegada;
      if (!c.chegou) {
        const vm = Math.max(5, c.progresso / Math.max(1, this.t));
        tempo = this.t + Math.max(0, total - c.progresso) / vm;
      }
      return { carro: c, indice: c.indice, nome: c.nome, cfgId: c.cfg.id, posicao: 0, tempo, melhorVolta: c.melhorVolta, ehJogador: c.ehJogador, chegou: c.chegou };
    });
    // os que nao chegaram entram pela estimativa, depois de todos os que chegaram
    linhas.sort((a, b) => (a.chegou !== b.chegou ? (a.chegou ? -1 : 1) : a.tempo - b.tempo));
    linhas.forEach((l, k) => { l.posicao = k + 1; l.carro.posicao = k + 1; });
    const lj = linhas.find((l) => l.ehJogador) || linhas[0];
    this.resultado = {
      pista: this.pista.id, modo: this.opcoes.modo, voltas: this.voltas, tempoTotal: this.t,
      classificacao: linhas,
      jogador: { posicao: lj.posicao, tempo: lj.tempo, melhorVolta: lj.melhorVolta, batidas: this.jogador ? this.jogador.batidas : 0, vitoria: lj.posicao === 1, chegou: lj.chegou },
    };
    this.estado = 'terminou';
    if (this.dificuldade && this.dificuldade.registra) this.dificuldade.registra(this.resultado);
    emite('corrida:fim', { resultado: this.resultado });
  }

  quadro(dt) {
    if (this.estado === 'carregando') return;
    for (const c of this.carros) if (c.visual) c.visual.quadro(dt);
    if (this.visual && this.visual.quadro) this.visual.quadro(dt);
    for (const s of this._sistemas()) if (s.quadro) s.quadro(dt);
  }

  /** As mesmas opcoes de novo (botao "correr de novo"). */
  reinicia() {
    const o = this.opcoes;
    return this.G.jogo.iniciaCorrida({ pista: o.def.id, def: o.def, carro: o.carro, modo: o.modo, corredores: o.corredores, voltas: o.voltas, rivais: o.rivais });
  }

  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    for (const s of this._sistemas()) if (s.destroi) s.destroi();
    for (const c of this.carros) if (c.destroi) c.destroi();
    if (this.visual && this.visual.destroi) this.visual.destroi();
    if (this.G.pista === this.pista) this.G.pista = null;
    if (this._luzDaCamera) { this.G.camera.remove(this._luzDaCamera.target); this.G.camera.remove(this._luzDaCamera); this._luzDaCamera.dispose(); this._luzDaCamera = null; }
    this.estado = 'terminou';
  }
}
