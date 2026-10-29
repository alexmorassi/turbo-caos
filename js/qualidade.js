// QUALIDADE GRAFICA (fase 6): tres niveis (baixa/media/alta) e o modo AUTO, que escolhe sozinho pelo fps medido. O contrato e o da
// secao 10 (nivel, auto, p, limiteFps, mede, define; emite 'qualidade:muda'). Quem le `p`: o laco (pixelRatio, js/main.js), a pista
// (densidadeCenario, distancia — fase 3), os carros (sombras — fase 2) e os efeitos (particulas — fase 4).
//
// POR QUE AUTO E O PADRAO: o jogo roda do celular de R$ 600 ao PC do Morassi, e crianca de 6 anos nao vai achar a tela de opcoes.
// O jeito do Breno (core.js adaptResolution) mexe so no pixelRatio; aqui o nivel inteiro desce, porque no celular fraco o que pesa e o
// cenario instanciado e as particulas, nao so a resolucao.
//
// A REGRA DO AUTO (pedido da fase 6):
//   * comeca na MEDIA em celular e na ALTA no desktop (ou no que este aparelho ja aprendeu — `qualidade_auto` no save: sem isso a
//     crianca do celular fraco engasgaria 3 s no comeco de TODA sessao ate o auto descer de novo);
//   * so mede com a corrida CORRENDO (menu nao conta: a vitrine e leve e mediria um celular bom demais), e ignora os primeiros
//     CARENCIA segundos depois da largada ou de uma troca (o primeiro desenho compila programas e sobe texturas: e engasgo de carga,
//     nao de desenho — armadilha do dinotrails-web: "o primeiro render paga a compilacao de todos os programas");
//   * abaixo de FPS_ALVO por TEMPO_ABAIXO seguidos: desce um nivel; ja na BAIXA e ainda abaixo de FPS_MINIMO: limiteFps = 30 (o laco
//     desenha um quadro a cada 2 passos — 30 fps lisos sao melhores que 40 aos trancos);
//   * nunca sobe sozinho: subir e descer em sequencia faz a imagem piscar de qualidade, e a crianca percebe mais isso que o fps;
//   * a opcao MANUAL (tela de opcoes ou ?qualidade=) desliga o auto. Escolher "Auto" de novo esquece o que foi aprendido.
//   * com ?teste= ou ?foto= nao mede (a bateria e a foto falam de um nivel fixo; o SwiftShader daria 5 fps e tudo desceria).
import * as save from './save.js';
import { emite } from './eventos.js';

/** Os tres niveis. Numeros da fundacao (stub) — as outras fases ja leem estes; o pixelRatio e TETO (o laco usa min(dpr, teto)). */
export const NIVEIS = {
  baixa: { pixelRatio: 1, sombras: false, densidadeCenario: 0.4, distancia: 450, particulas: 0.4 },
  media: { pixelRatio: 1.5, sombras: false, densidadeCenario: 0.7, distancia: 700, particulas: 0.7 },
  alta: { pixelRatio: 2, sombras: true, densidadeCenario: 1, distancia: 1000, particulas: 1 },
};
export const ORDEM = ['baixa', 'media', 'alta'];
/** Nomes para a tela de opcoes. */
export const ROTULOS = { auto: 'Auto', baixa: 'Baixa', media: 'Média', alta: 'Alta' };

/** fps abaixo do qual o auto desce um nivel (pedido: "< ~50 fps por ~3 s"). */
const FPS_ALVO = 50;
/** fps abaixo do qual, ja na baixa, o auto trava em 30 (pedido: "< ~45 fps"). */
const FPS_MINIMO = 45;
/** segundos seguidos abaixo do alvo antes de agir (pedido: "~3 s"). */
const TEMPO_ABAIXO = 3;
/** janela de medida (s): o fps e a media dela — um quadro lento isolado (coleta de lixo) nao derruba a qualidade. */
const JANELA = 0.5;
/** segundos ignorados depois da largada e depois de cada troca (ver o cabecalho). */
const CARENCIA = 2.5;

/** Celular/tablet: dedo como ponteiro principal ou userAgent de aparelho movel. */
export function ehCelular() {
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) return true;
  } catch (e) { /* navegador sem matchMedia */ }
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

export class Qualidade {
  constructor(G) {
    this.G = G;
    const f = G.flags || {};
    /** sem medida automatica na bateria e na foto (ver o cabecalho); as suites podem desligar isto para testar a regra */
    this.ignora = !!(f.teste || f.foto);
    this.palpite = ehCelular() ? 'media' : 'alta';
    this.limiteFps = 60;
    this.fps = 0;
    /** trocas feitas pelo auto nesta sessao: [{ de, para, fps }] (para as suites e para o relatorio) */
    this.trocas = [];
    this._zeraMedida();
    const escolha = save.opcoes().qualidade;
    if (escolha && NIVEIS[escolha]) { this.auto = false; this.nivel = escolha; }
    else {
      this.auto = true;
      const aprendido = save.le('qualidade_auto', null);
      this.nivel = aprendido && NIVEIS[aprendido.nivel] ? aprendido.nivel : this.palpite;
      if (aprendido && aprendido.limiteFps === 30) this.limiteFps = 30;
    }
  }

  /** Os parametros do nivel atual: uma COPIA por nivel, guardada (quem le nao estraga a tabela, e o ajusta() do laco le a cada quadro
   *  sem alocar nada). */
  get p() {
    if (!this._p || this._pNivel !== this.nivel) { this._p = { ...NIVEIS[this.nivel] }; this._pNivel = this.nivel; }
    return this._p;
  }

  /** O que a tela de opcoes mostra: 'auto' ou o nivel manual. */
  get escolha() { return this.auto ? 'auto' : this.nivel; }

  /** Troca o nivel. `nivel` = 'auto' | 'baixa' | 'media' | 'alta'. `persiste` = grava nas opcoes (o ?qualidade= da URL nao grava). */
  define(nivel, persiste = true) {
    if (nivel === 'auto') {
      this.auto = true;
      this.limiteFps = 60;
      save.remove('qualidade_auto');
      this._troca(this.palpite);
      if (persiste) save.mudaOpcoes({ qualidade: 'auto' });
      return this.nivel;
    }
    if (!NIVEIS[nivel]) return this.nivel;
    this.auto = false;
    this.limiteFps = 60;
    this._troca(nivel);
    if (persiste) save.mudaOpcoes({ qualidade: nivel });
    return this.nivel;
  }

  /** Chamado pelo laco a cada quadro com o dt REAL (s). Barato: soma e compara. */
  mede(dtReal) {
    if (this.ignora || !this.auto || !(dtReal > 0)) return;
    const c = this.G.corrida;
    if (!c || c.estado !== 'correndo' || c.pausada) { this._zeraMedida(); return; }
    if (c !== this._corrida) { this._corrida = c; this._zeraMedida(); }
    if (this._carencia > 0) { this._carencia -= dtReal; return; }
    this._soma += dtReal;
    this._n++;
    if (this._soma < JANELA) return;
    this.fps = this._n / this._soma;
    const janela = this._soma;
    this._soma = 0; this._n = 0;
    const limite = this.nivel === 'baixa' ? FPS_MINIMO : FPS_ALVO;
    if (this.limiteFps === 30) return; // ja no fundo: nada mais a cortar
    if (this.fps < limite) this._abaixo += janela; else this._abaixo = 0;
    if (this._abaixo < TEMPO_ABAIXO) return;
    const de = this.nivel;
    if (de === 'baixa') this.limiteFps = 30;
    else this._troca(ORDEM[ORDEM.indexOf(de) - 1]);
    this.trocas.push({ de, para: this.nivel, limiteFps: this.limiteFps, fps: Math.round(this.fps) });
    save.grava('qualidade_auto', { nivel: this.nivel, limiteFps: this.limiteFps });
    this._zeraMedida();
    if (de === 'baixa') emite('qualidade:muda', { nivel: this.nivel, limiteFps: this.limiteFps });
  }

  // ------------------------------------------------------------ interno
  _zeraMedida() { this._soma = 0; this._n = 0; this._abaixo = 0; this._carencia = CARENCIA; }

  _troca(nivel) {
    const mudou = nivel !== this.nivel;
    this.nivel = nivel;
    this._aplica();
    this._zeraMedida();
    if (mudou) emite('qualidade:muda', { nivel, limiteFps: this.limiteFps });
  }

  /** Aplica o teto de pixelRatio no renderer ja (o ajusta() do laco confirma no proximo quadro, porque olha o ratio tambem). */
  _aplica() {
    const r = this.G.renderer;
    if (!r || typeof window === 'undefined') return;
    const pr = Math.min(window.devicePixelRatio || 1, NIVEIS[this.nivel].pixelRatio);
    if (Math.abs(r.getPixelRatio() - pr) > 1e-3) r.setPixelRatio(pr);
  }
}
