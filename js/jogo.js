// A MAQUINA DO JOGO (fase 1, fundacao): quem comeca e termina corrida, e as regras do CAMPEONATO e do DESBLOQUEIO. As telas (fase 6)
// so mostram e chamam isto; a corrida (js/corrida.js) so corre. Assim a regra "terminou entre os 3 primeiros, a proxima pista abre"
// mora num lugar so e o teste mede sem tocar em DOM.
//
// Regras (pedido do Morassi):
//   * CAMPEONATO: as 10 pistas em sequencia (config/pistas.js, campo `ordem`). Chegou entre os 3 primeiros: a proxima pista desbloqueia
//     e o campeonato avanca; senao, corre a mesma de novo (e a dificuldade adaptativa alivia depois de 2 derrotas — fase 5). Pontos por
//     posicao (config/corrida.js), somados na tabela do campeonato.
//   * CORRIDA LIVRE: qualquer pista ja desbloqueada.
// O progresso fica em G.save ('progresso'); se o armazenamento falhar, vale ate fechar a aba (save.js guarda copia em memoria).
import { Corrida } from './corrida.js';
import { CORRIDA } from '../config/corrida.js';
import { PISTAS } from '../config/pistas.js';
import PISTA_DE_TESTE from './pistas/teste.js'; // fora do campeonato: so as suites usam (?pista=teste tambem abre)
import { CARROS, CARRO_PADRAO } from '../config/carros.js';
import { emite } from './eventos.js';

/** Quantas posicoes do topo desbloqueiam a proxima pista no campeonato. Pódio = 3: e o que a crianca entende como "ganhei". */
export const PODIO_DESBLOQUEIA = 3;

const PROGRESSO_INICIAL = () => ({ desbloqueadas: 1, recordes: {}, campeonato: null, corridas: 0, vitorias: 0 });

export class Jogo {
  constructor(G) {
    this.G = G;
    this.carroEscolhido = (G.save && G.save.le('carro', CARRO_PADRAO)) || CARRO_PADRAO;
  }

  /** Progresso salvo (sempre um objeto valido, mesmo com armazenamento quebrado). */
  progresso() {
    const p = this.G.save ? this.G.save.le('progresso', null) : null;
    return p && typeof p === 'object' ? { ...PROGRESSO_INICIAL(), ...p } : PROGRESSO_INICIAL();
  }
  _grava(p) { if (this.G.save) this.G.save.grava('progresso', p); }

  /** Pistas na ordem do campeonato, cada uma com `desbloqueada`. */
  pistas() {
    const n = this.progresso().desbloqueadas;
    return PISTAS.map((def, i) => ({ def, indice: i, desbloqueada: i < n }));
  }

  escolheCarro(id) {
    if (!CARROS.find((c) => c.id === id)) return;
    this.carroEscolhido = id;
    if (this.G.save) this.G.save.grava('carro', id);
  }

  /** Comeca (ou continua) o campeonato. Devolve o estado { indice, pontos: {cfgId: n}, corridas } */
  campeonato(novo = false) {
    const p = this.progresso();
    if (novo || !p.campeonato) {
      p.campeonato = { indice: 0, pontos: {}, corridas: 0, derrotasSeguidas: 0, carro: this.carroEscolhido };
      this._grava(p);
    }
    return p.campeonato;
  }

  /** Inicia uma corrida. opcoes: { pista (id), carro (id), modo 'livre'|'campeonato', corredores, voltas }. */
  async iniciaCorrida(opcoes) {
    const G = this.G;
    if (G.corrida) this.encerraCorrida();
    const pistaId = opcoes.pista || PISTAS[0].id;
    const def = opcoes.def || PISTAS.find((p) => p.id === pistaId) || (pistaId === PISTA_DE_TESTE.id ? PISTA_DE_TESTE : null);
    if (!def) throw new Error('pista desconhecida: ' + pistaId);
    const corrida = new Corrida(G, {
      def,
      carro: opcoes.carro || this.carroEscolhido,
      modo: opcoes.modo || 'livre',
      corredores: Math.max(CORRIDA.CORREDORES_MIN, Math.min(CORRIDA.CORREDORES, opcoes.corredores || G.flags.corredores || CORRIDA.CORREDORES)),
      voltas: opcoes.voltas || G.flags.voltas || CORRIDA.VOLTAS,
      rivais: opcoes.rivais || null,
    });
    G.corrida = corrida;
    await corrida.carrega();
    return corrida;
  }

  /** Desmonta a corrida atual (volta ao menu, reinicia). */
  encerraCorrida() {
    const G = this.G;
    if (!G.corrida) return;
    G.corrida.destroi();
    G.corrida = null;
    G.desenho = null;
  }

  /** Chamado pelas telas quando a corrida termina: aplica as regras de desbloqueio, recorde e campeonato. Devolve um resumo para a tela
   *  de resultado: { desbloqueou: id|null, recorde: bool, campeonato: {...}|null, avancou: bool, fimDoCampeonato: bool }. */
  registraResultado(res) {
    const p = this.progresso();
    const pj = res.jogador, idx = PISTAS.findIndex((d) => d.id === res.pista);
    const resumo = { desbloqueou: null, recorde: false, campeonato: null, avancou: false, fimDoCampeonato: false };
    p.corridas = (p.corridas || 0) + 1;
    if (pj.posicao === 1) p.vitorias = (p.vitorias || 0) + 1;
    // recorde da pista (melhor tempo total)
    const rec = p.recordes[res.pista];
    if (pj.tempo > 0 && (!rec || pj.tempo < rec)) { p.recordes[res.pista] = pj.tempo; resumo.recorde = true; }
    // desbloqueio: no campeonato, podio abre a proxima
    if (res.modo === 'campeonato' && pj.posicao <= PODIO_DESBLOQUEIA && idx >= 0 && idx + 1 < PISTAS.length && p.desbloqueadas < idx + 2) {
      p.desbloqueadas = idx + 2;
      resumo.desbloqueou = PISTAS[idx + 1].id;
    }
    if (res.modo === 'campeonato') {
      const c = p.campeonato || { indice: 0, pontos: {}, corridas: 0, derrotasSeguidas: 0 };
      for (const lin of res.classificacao) {
        const pts = CORRIDA.PONTOS[lin.posicao - 1] || 0;
        c.pontos[lin.cfgId] = (c.pontos[lin.cfgId] || 0) + pts;
      }
      c.corridas++;
      if (pj.posicao <= PODIO_DESBLOQUEIA) {
        c.derrotasSeguidas = 0;
        if (c.indice + 1 < PISTAS.length) { c.indice++; resumo.avancou = true; }
        else resumo.fimDoCampeonato = true;
      } else c.derrotasSeguidas = (c.derrotasSeguidas || 0) + 1;
      p.campeonato = c;
      resumo.campeonato = c;
    }
    this._grava(p);
    emite('jogo:progresso', { progresso: p, resumo });
    return resumo;
  }
}
