// DIFICULDADE GRADUAL E ADAPTATIVA (fase 5; contrato em docs/CONTRATOS.md secao 9). Decide o QUANTO cada rival e bom — a IA (js/ia.js)
// decide o COMO. Tres camadas (os numeros e a explicacao de cada uma estao em config/dificuldade.js):
//   1. BASE GRADUAL pela ordem da pista (1..10, a curva do Breno): ritmo (vMax), aceleracao, habilidade, agressividade, precisao e uso
//      de poder sobem de pista em pista. Entre os rivais ha papeis: o FORTE (quem larga na pole), os MEDIANOS (com um sorteio pequeno,
//      para nao andarem em fila) e o FRACO (o ultimo rival da grade).
//   2. DDA: um FATOR por pista (0,85..1,15) em G.save('dda') que multiplica a base. Muda no maximo PASSO_MAX por corrida: perdeu 2 vezes
//      seguidas na mesma pista -> alivia; venceu com folga -> aperta; venceu apertado -> aperta pouco; muitas batidas sem vencer ->
//      alivia um pouco; melhor volta bem mais rapida que a dos rivais -> aperta um pouco. Pista nunca corrida comeca no fator GLOBAL (a
//      media do jeito de jogar da crianca, que anda a metade do passo).
//   3. ELASTICO leve dentro da corrida (via mod.velMax de cada rival, suavizado em ~3 s): muito a frente do jogador perde ate 6 %, muito
//      atras ganha ate 4 %, metade disso na ultima volta, nada com o turbo ligado (o rival nunca fica mais rapido do que o turbo dele
//      deixaria) e o multiplicador total preso em [PISO_TOTAL, TETO_TOTAL].
// O jogador nunca recebe nada daqui: no piloto automatico (testes, festa) ele tem o perfil fixo PILOTO_AUTO.
//
// LEITURA (HUD/teste): `fator` (desta corrida), `historico` (da pista), `estado` (o objeto salvo inteiro), `base` (a camada 1), `elastico`
// (multiplicador atual por carro, Float64Array pelo indice), `ultimoRegistro` ({ delta, fator, global } da ultima registra()).
// Save quebrado (armazenamento sem acesso, JSON velho, campo de outro tipo) nunca derruba: tudo e conferido e cai no padrao.
import { DIFICULDADE as D, PILOTO_AUTO, curvaDaBase } from '../config/dificuldade.js';

const limita = (v, a, b) => (v < a ? a : v > b ? b : v);
const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const num = (v, padrao) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const CAMPOS = ['habilidade', 'agressividade', 'precisao', 'usoDePoder'];
/** Chave do salvamento (docs/CONTRATOS.md secao 10). */
export const CHAVE_DDA = 'dda';
const VERSAO = 1;

/** Estado salvo novo. */
function ddaVazio() { return { versao: VERSAO, global: { fator: D.DDA.INICIAL, corridas: 0 }, pistas: {} }; }

/** Confere (e conserta) um registro de pista lido do save. */
function registroValido(r, fatorPadrao) {
  const o = r && typeof r === 'object' ? r : {};
  return {
    fator: limita(num(o.fator, fatorPadrao), D.DDA.MIN, D.DDA.MAX),
    corridas: Math.max(0, Math.floor(num(o.corridas, 0))),
    derrotasSeguidas: Math.max(0, Math.floor(num(o.derrotasSeguidas, 0))),
    vitoriasSeguidas: Math.max(0, Math.floor(num(o.vitoriasSeguidas, 0))),
    historico: Array.isArray(o.historico) ? o.historico.filter((h) => h && typeof h === 'object').slice(-D.DDA.HISTORICO) : [],
  };
}

/** Le G.save('dda') e devolve SEMPRE um objeto valido (exportado para as suites). */
export function leDDA(G) {
  let bruto = null;
  try { bruto = G && G.save ? G.save.le(CHAVE_DDA, null) : null; } catch (e) { bruto = null; }
  const dda = ddaVazio();
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return dda;
  const g = bruto.global && typeof bruto.global === 'object' ? bruto.global : {};
  dda.global.fator = limita(num(g.fator, D.DDA.INICIAL), D.DDA.MIN, D.DDA.MAX);
  dda.global.corridas = Math.max(0, Math.floor(num(g.corridas, 0)));
  if (bruto.pistas && typeof bruto.pistas === 'object' && !Array.isArray(bruto.pistas)) {
    for (const [id, r] of Object.entries(bruto.pistas)) dda.pistas[id] = registroValido(r, dda.global.fator);
  }
  return dda;
}

/** Fator de uma pista: o dela, ou o global se ela nunca foi corrida. */
export function fatorDaPista(dda, pistaId) { const r = dda.pistas[pistaId]; return r ? r.fator : dda.global.fator; }

/** A conta do DDA de uma corrida terminada (pura: as suites chamam direto). Devolve { delta, derrota, vitoria, folga, ritmo, batidasVolta }. */
export function avaliaCorrida(resultado, reg) {
  const C = D.DDA, pj = resultado.jogador, cl = resultado.classificacao || [];
  const n = Math.max(1, cl.length), pos = Math.max(1, Math.floor(num(pj.posicao, n)));
  const vitoria = pos === 1, derrota = pos > C.PODIO;
  let folga = 0;
  if (vitoria) { const seg = cl.find((l) => l && l.posicao === 2); folga = seg ? num(seg.tempo, 0) - num(pj.tempo, 0) : C.FOLGA_S; }
  const batidasVolta = num(pj.batidas, 0) / Math.max(1, num(resultado.voltas, 1));
  // ritmo: melhor volta do jogador contra a mediana das melhores voltas dos rivais (> 0 = jogador mais rapido)
  const voltas = cl.filter((l) => l && !l.ehJogador && num(l.melhorVolta, 0) > 0).map((l) => l.melhorVolta).sort((a, b) => a - b);
  const mv = num(pj.melhorVolta, 0), mediana = voltas.length ? voltas[Math.floor(voltas.length / 2)] : 0;
  // volta de mentira (menos da metade da mediana: o Troca-Troca na linha de chegada faz a corrida contar uma volta de 1 s) nao vale
  const ritmo = mediana > 0 && mv > mediana * 0.5 ? mediana / mv - 1 : 0;
  const derrotas = derrota ? reg.derrotasSeguidas + 1 : 0;
  let delta = 0;
  if (derrota && derrotas >= C.DERROTAS_PARA_ALIVIAR) delta -= C.ALIVIO + (pos >= n ? C.ALIVIO_ULTIMO : 0);
  if (vitoria) delta += folga >= C.FOLGA_S ? C.APERTO_FOLGA : C.APERTO_VITORIA;
  if (!vitoria && batidasVolta >= C.MUITAS_BATIDAS) delta -= C.ALIVIO_BATIDAS;
  if (ritmo >= C.RITMO_SOBRA) delta += C.APERTO_RITMO;
  delta = limita(delta, -C.PASSO_MAX, C.PASSO_MAX);
  return { delta, derrota, vitoria, folga, ritmo, batidasVolta, pos, n };
}

export class Dificuldade {
  constructor(G, corrida) {
    this.G = G;
    this.corrida = corrida;
    this.fator = D.DDA.INICIAL;
    this.ordem = 1;
    this.historico = [];
    this.estado = null;
    this.base = null;
    this.elastico = null;
    this.ultimoRegistro = null;
    this._registrou = false;
  }

  /** Base pela ordem da pista + papeis + fator do DDA -> carro.ia de cada rival. Chamado depois da grade montada (antes da IA). */
  inicia() {
    const G = this.G, corrida = this.corrida, def = corrida.pista.def;
    this.ordem = limita(Math.round(num(def.ordem, 1)) || 1, 1, 10);
    this.pistaId = corrida.pista.id;
    this.estado = leDDA(G);
    this.fator = fatorDaPista(this.estado, this.pistaId);
    const reg = this.estado.pistas[this.pistaId];
    this.historico = reg ? reg.historico.slice() : [];
    const b = {};
    for (const [k, faixa] of Object.entries(D.BASE)) b[k] = curvaDaBase(this.ordem, faixa);
    this.base = b;
    const f = this.fator, C = D.DDA, escala = (peso) => 1 + (f - 1) * peso;
    const pesos = { habilidade: C.PESO_HABILIDADE, agressividade: C.PESO_AGRESSIVIDADE, precisao: C.PESO_PRECISAO, usoDePoder: C.PESO_USO_DE_PODER };
    const rivais = corrida.carros.filter((c) => !c.ehJogador).sort((a, c2) => a.indice - c2.indice);
    rivais.forEach((c, k) => {
      const papel = k === 0 ? 'forte' : (k === rivais.length - 1 && rivais.length > 2 ? 'fraco' : 'mediano');
      const off = D.PAPEIS[papel], jit = papel === 'mediano' ? D.SORTEIO_MEDIANO : null;
      const sorteia = (campo) => (jit ? (G.sorteio.num() * 2 - 1) * jit[campo] : 0);
      const ia = { papel, fator: f };
      for (const campo of CAMPOS) ia[campo] = limita((b[campo] + off[campo] + sorteia(campo)) * escala(pesos[campo]), 0, 1);
      ia.ritmo = (b.ritmo + off.ritmo + sorteia('ritmo')) * escala(C.PESO_RITMO);
      ia.aceleracao = b.aceleracao * escala(C.PESO_ACELERACAO);
      c.ia = ia;
    });
    if (corrida.jogador) corrida.jogador.ia = { ...PILOTO_AUTO };
    this.elastico = new Float64Array(corrida.carros.length).fill(1);
  }

  /** O elastico (ver o cabecalho) e a camada 1+2 no mod de cada rival. Roda depois do zeraMod e da IA, antes de poderes/turbo/fisica. */
  passo(dt) {
    const corrida = this.corrida, j = corrida.jogador, E = D.ELASTICO;
    if (!this.elastico) return;
    const k = 1 - Math.exp(-dt / E.TAU);
    const ultima = j && j.volta >= corrida.voltas, carros = corrida.carros;
    for (let n = 0; n < carros.length; n++) {
      const c = carros[n];
      if (c.ehJogador || !c.ia) continue;
      let alvo = 1;
      if (j && !j.chegou && !c.chegou && corrida.estado === 'correndo') {
        const dist = c.progresso - j.progresso;
        if (dist > E.ZONA_MORTA) alvo = 1 - E.TETO_FREIA * suave((dist - E.ZONA_MORTA) / (E.PLENO - E.ZONA_MORTA));
        else if (dist < -E.ZONA_MORTA) alvo = 1 + E.TETO_ACELERA * suave((-dist - E.ZONA_MORTA) / (E.PLENO - E.ZONA_MORTA));
        if (ultima) alvo = 1 + (alvo - 1) * E.ULTIMA_VOLTA;
      }
      if (alvo > 1 && c.turbo && c.turbo.ativo) alvo = 1;
      const e = this.elastico[c.indice] + (alvo - this.elastico[c.indice]) * k;
      this.elastico[c.indice] = e;
      c.mod.velMax *= limita(c.ia.ritmo * e, E.PISO_TOTAL, E.TETO_TOTAL);
      c.mod.acel *= c.ia.aceleracao;
    }
  }

  /** Fim da corrida (a corrida chama uma vez): o DDA desta pista anda um passo e vai para o save. Devolve o resumo. */
  registra(resultado) {
    if (this._registrou || !resultado || !resultado.jogador) return null;
    this._registrou = true;
    const dda = leDDA(this.G), id = resultado.pista || this.pistaId, C = D.DDA;
    const reg = dda.pistas[id] || registroValido(null, dda.global.fator);
    const av = avaliaCorrida(resultado, reg);
    reg.derrotasSeguidas = av.derrota ? reg.derrotasSeguidas + 1 : 0;
    reg.vitoriasSeguidas = av.vitoria ? reg.vitoriasSeguidas + 1 : 0;
    reg.corridas++;
    reg.fator = limita(reg.fator + av.delta, C.MIN, C.MAX);
    reg.historico.push({ pos: av.pos, n: av.n, vitoria: av.vitoria, folga: +av.folga.toFixed(2), ritmo: +av.ritmo.toFixed(3), batidas: num(resultado.jogador.batidas, 0), fator: +reg.fator.toFixed(3), delta: +av.delta.toFixed(3) });
    while (reg.historico.length > C.HISTORICO) reg.historico.shift();
    dda.pistas[id] = reg;
    dda.global.fator = limita(dda.global.fator + av.delta * C.PESO_GLOBAL, C.MIN, C.MAX);
    dda.global.corridas++;
    try { if (this.G && this.G.save) this.G.save.grava(CHAVE_DDA, dda); } catch (e) { /* save quebrado: vale ate fechar a aba (save.js) */ }
    this.estado = dda;
    this.historico = reg.historico.slice();
    this.ultimoRegistro = { delta: av.delta, fator: reg.fator, global: dda.global.fator, avaliacao: av };
    return this.ultimoRegistro;
  }

  quadro() {}
  destroi() {}
}
