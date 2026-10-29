// A FISICA DO CARRO (fase 2): o "carro de arcade feito a mao" do pedido, em COORDENADAS DA PISTA (js/pista.js), passo fixo de 1/60 s.
// O contrato (campos e metodos) esta em docs/CONTRATOS.md secao 5; os numeros, em config/fisica.js; as contas e as decisoes, em
// docs/fases/fase2_fisica.md.
//
// POR QUE UM MODELO HIBRIDO (e nao fisica de mundo, nem so (s, d)):
//   * NO CHAO o estado e (sup, s, d, psi, vf, vr) com h = 0. A velocidade mora no referencial DO CARRO (vf para a frente, vr para a
//     direita) e o rumo psi e relativo a frente da pista T. Assim o muro e um |d| > meia largura, a curva inclinada e o loop sao so o
//     quadro (T, N, R) da amostra, e o carro NUNCA atravessa o asfalto nem flutua — nao ha colisao de malha para errar.
//       V_T = vf cos psi - vr sen psi;  V_R = vf sen psi + vr cos psi;  s' = V_T / (1 - kh d);  d' = V_R;  psi' = w - kh s'.
//     O "- kh s'" e a pista curvando por baixo do carro: sem estercar, o carro sai reto e bate no muro de fora (pedido).
//   * O GIRO w do carro gira o referencial dele: (vf, vr) roda de -w dt (a velocidade do mundo nao muda so porque o carro virou);
//     depois o pneu puxa vr -> 0 (exp(-k dt)) e devolve para a frente o que tirou, menos PERDA_NA_CURVA — o carro "mantem o embalo"
//     na curva em vez de frear a cada toque. Derrapar = k menor e w maior: a traseira solta, o carro atravessa ~25-30 graus e faz a
//     curva mais fechada.
//   * NO AR (crista `lanca`, `vao`, beira sem muro) a posicao e a velocidade viram de MUNDO, com gravidade de arcade, e a cada passo o
//     carro e PROJETADO na pista (busca local pela dica `i`) so para saber s/d/h: e o s que conta a volta, e o h <= 0 que diz "pousou".
//   * LEVANTADO (Mini Tornado) e um "no ar" de mentirinha em coordenadas da pista: h segue uma parabola, o carro gira e nao sai da pista.
//
// O QUE A CORRIDA ESPERA (js/corrida.js): `zeraMod()` no comeco do passo, `controle` escrito pela entrada/IA, `passo(dt)` de todos e
// depois `colide` (js/colisoes.js). Os campos de mundo (pos, vel, quat, frente, cima, direita, velocidade) ficam prontos no fim de
// cada passo — a camera, o visual e as capsulas leem deles.
import * as THREE from 'three';
import { criaModeloCarro } from './modelo_carro.js';
import { VisualCarro } from './visual_carro.js';
import { MARCA, BOCA_DO_ATALHO } from './pista.js';
import { FISICA, indiceDoAtributo } from '../config/fisica.js';
import { emite } from './eventos.js';

const F = FISICA;
const GRAUS = Math.PI / 180;
const DUAS_PI = Math.PI * 2;
/** Modos internos da fisica (o contrato so expoe `noChao`). */
const CHAO = 0, AR = 1, LEVANTADO = 2;
/** atanh(0,95): com forca A (1 - u2) a velocidade e vMax tanh(A t / vMax); 95 % chega em t = atanh(0,95) vMax / A. */
const ATANH_95 = Math.atanh(0.95);
const TAN_DRIFT_MAX = Math.tan(F.DRIFT_ANGULO_MAX * GRAUS);
const COS_CONVERTE = Math.cos(F.CONVERTE_ATE_GRAUS * GRAUS);
const SEN_EXTRA = Math.sin(F.ANGULO_EXTRA_DA_RAMPA * GRAUS), COS_EXTRA = Math.cos(F.ANGULO_EXTRA_DA_RAMPA * GRAUS);
/** Valores neutros do `mod` (docs/CONTRATOS.md secao 5). Congelado: `zeraMod` copia daqui sem alocar. */
const MOD_PADRAO = Object.freeze({ velMax: 1, acel: 1, aderencia: 1, direcao: 1, massa: 1, escala: 1, empurrao: 0, semTurbo: false, visao: 0 });
/** Medidas de um carro sem `medidas` no config (fase 1 normaliza todos para caber em 4,2 x 2,3 x 2,6). */
const MEDIDAS_PADRAO = { comprimento: 4.2, largura: 2.3, altura: 1.5 };
const CIMA_DO_MUNDO = new THREE.Vector3(0, 1, 0);
/** Busca da principal quando o atalho acaba: a boca de saida tem 12 m, a janela cobre ela com folga. */
const JANELA_SAIDA_DO_ATALHO = Math.round(BOCA_DO_ATALHO * 2.5);

// temporarios do modulo (nada e alocado dentro de passo). Nenhum e passado para dentro de outro metodo deste modulo que tambem o use.
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
const _F = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3(), _A = new THREE.Vector3();
const _M = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _proj = { i: 0, s: 0, d: 0, h: 0, dist2: 0 };
const _trans = { sup: 0, i: 0, s: 0, d: 0, h: 0, dist2: 0 };

const limita = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Angulo em (-pi, pi]. */
function embrulha(a) { a = (a + Math.PI) % DUAS_PI; if (a < 0) a += DUAS_PI; return a - Math.PI; }
/** smoothstep 0..1 (o giro do rodopio e do tornado comeca e termina devagar). */
const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Atributos 1..5 do config/carros.js -> numeros da fisica (config/fisica.js). Exportado: a IA (fase 5) e as suites leem a vMax daqui. */
export function parametrosDoCarro(cfg) {
  const at = (cfg && cfg.atributos) || {}, tab = F.POR_ATRIBUTO, md = (cfg && cfg.medidas) || {};
  const vMax = tab.VEL_MAX[indiceDoAtributo(at.velocidade)];
  const t95 = tab.TEMPO_ATE_95[indiceDoAtributo(at.aceleracao)];
  const ic = indiceDoAtributo(at.controle);
  return {
    vMax,
    acel: (ATANH_95 * vMax) / t95,        // m/s2 do motor parado (A)
    tempoAte95: t95,
    raioRef: tab.RAIO_NA_REFERENCIA[ic],
    aderencia: tab.ADERENCIA[ic],
    massa: tab.MASSA[indiceDoAtributo(at.peso)],
    comprimento: md.comprimento || MEDIDAS_PADRAO.comprimento,
    largura: md.largura || MEDIDAS_PADRAO.largura,
    altura: md.altura || MEDIDAS_PADRAO.altura,
  };
}

export class Carro {
  constructor(G, corrida, { cfg, indice, ehJogador, nome }) {
    this.G = G; this.corrida = corrida; this.cfg = cfg; this.indice = indice; this.ehJogador = !!ehJogador; this.nome = nome;
    /** numeros da fisica deste carro (parametrosDoCarro) */
    this.p = parametrosDoCarro(cfg);
    // --- estado na pista (docs/CONTRATOS.md secao 5)
    this.sup = 0; this.s = 0; this.d = 0; this.h = 0; this.psi = 0; this.vf = 0; this.vr = 0; this.noChao = true; this.i = 0;
    // --- mundo
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.frente = new THREE.Vector3(0, 0, 1); this.cima = new THREE.Vector3(0, 1, 0); this.direita = new THREE.Vector3(-1, 0, 0);
    this.velocidade = 0;
    // --- corrida (a corrida escreve)
    this.volta = 0; this.progresso = 0; this.posicao = 0; this.chegou = false; this.tempoChegada = 0;
    this.temposDeVolta = []; this.melhorVolta = 0; this.sSeguro = 0;
    // --- comandos e modificadores
    this.controle = { acel: 0, freio: 0, direcao: 0, drift: false, turbo: false, poder: false };
    this.mod = { ...MOD_PADRAO };
    this.efeitos = { rodopio: 0, gelo: 0, levantado: 0 };
    this.fantasma = 0;
    this.visual = null;
    // --- leitura para visual, camera e IA (nao e contrato: e o que a fisica sabe de graca)
    this.volante = 0;        // direcao suavizada -1..1 (as rodas da frente desenham isto)
    this.giro = 0;           // rad/s do carro no mundo neste passo (+ = para a direita): inclinacao da carroceria
    this.aceleracao = 0;     // m/s2 para a frente neste passo: arfagem da carroceria
    this.derrapando = false;
    this.tempoNoAr = 0;
    this.quedas = 0;         // quantas vezes caiu (relatorio/IA)
    this.nans = 0;           // quantas vezes a guarda contra NaN agiu (as suites exigem 0)
    // --- interno
    this._modo = CHAO;
    this._qAr = new THREE.Quaternion();
    this._t = 0;
    this._tMuro = -1e9;
    this._quebrouEm = -1;
    this._impulso = 0;
    this._rodDur = 0; this._rodAng = 0;
    this._levDur = 0; this._levT = 0; this._levAng = 0;
  }

  /** Carrega o modelo e monta o visual. GLB que falhou nao derruba a corrida: vira uma caixa da cor do carro (aviso no console). */
  async carrega() {
    let modelo;
    try { modelo = await criaModeloCarro(this.G, this.cfg); }
    catch (e) {
      console.warn('carro ' + (this.cfg && this.cfg.id) + ': modelo nao carregou, usando caixa', e);
      const g = new THREE.Group(), p = this.p;
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(p.largura, p.altura * 0.7, p.comprimento), new THREE.MeshLambertMaterial({ color: (this.cfg && this.cfg.cor) || '#ff5533' }));
      caixa.position.y = p.altura * 0.35 + 0.15; g.add(caixa);
      modelo = { grupo: g, carroceria: caixa, rodas: [], cfg: this.cfg, caixa: true };
    }
    this.modelo = modelo;
    this.visual = new VisualCarro(this.G, this, modelo);
    return this;
  }

  zeraMod() { Object.assign(this.mod, MOD_PADRAO); }

  // =====================================================================================================================  passo
  passo(dt) {
    this._t += dt;
    if (this.fantasma > 0) this.fantasma = Math.max(0, this.fantasma - dt);
    if (this._impulso > 0) this._impulso = Math.max(0, this._impulso - dt);
    const ef = this.efeitos;
    // o PODER apertado congelado quebra o gelo (pedido: "toques no PODER encurtam"). quebraGelo e idempotente no passo: se os poderes
    // (fase 4) tambem chamarem, o toque conta uma vez so
    if (ef.gelo > 0 && this.controle.poder) this.quebraGelo(F.GELO_POR_TOQUE);
    if (this._modo === CHAO) this._passoNoChao(dt);
    else if (this._modo === AR) this._passoNoAr(dt);
    else this._passoLevantado(dt);
    if (ef.rodopio > 0) ef.rodopio = Math.max(0, ef.rodopio - dt);
    if (ef.gelo > 0) ef.gelo = Math.max(0, ef.gelo - dt);
    if (ef.levantado > 0 && this._modo !== LEVANTADO) ef.levantado = Math.max(0, ef.levantado - dt);
    this._atualizaMundo();
  }

  /** Volante suavizado: rampa para virar, volta rapida (config/fisica.js VOLANTE_*). */
  _volante(dir, dt) {
    const volta = Math.abs(dir) < Math.abs(this.volante) || dir * this.volante < 0;
    this.volante += (dir - this.volante) * (1 - Math.exp(-(volta ? F.VOLANTE_VOLTA : F.VOLANTE_IDA) * dt));
  }

  _ligaDrift(sim) {
    if (this.derrapando === sim) return;
    this.derrapando = sim;
    emite('carro:drift', { carro: this, ligado: sim });
  }

  /** Gira o carro por `dth` no mundo: o referencial dele roda, a velocidade do mundo fica (vf, vr rodam de -dth). */
  _gira(dth) {
    if (dth === 0) return;
    const c = Math.cos(dth), s = Math.sin(dth), vf = this.vf, vr = this.vr;
    this.vf = vf * c + vr * s;
    this.vr = -vf * s + vr * c;
    this.psi += dth;
  }

  /** O pneu puxa vr -> 0 e devolve o embalo para a frente (ver o cabecalho). `perda` = fracao do tirado que vira freio. */
  _aderencia(k, perda, dt) {
    const vf = this.vf, vr = this.vr, rapidez = Math.hypot(vf, vr);
    if (rapidez < 1e-6) return;
    const vrN = vr * Math.exp(-k * dt);
    const tirado = Math.abs(vr) - Math.abs(vrN);
    // de lado (|vf| pequeno perto da rapidez) o pneu so freia: "converte" vai de 1 (alinhado) a 0 (de lado), ver CONVERTE_ATE_GRAUS
    const converte = Math.min(1, Math.abs(vf) / rapidez / COS_CONVERTE);
    const nova = Math.max(Math.abs(vrN), rapidez - tirado * (1 - converte * (1 - perda)));
    this.vr = vrN;
    this.vf = (vf >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, nova * nova - vrN * vrN));
  }

  /** Meia largura que o carro ocupa ATRAVESSADA na pista (rodado de psi): o canto do carro derrapando encosta no muro antes. */
  _meiaLarguraNaPista() {
    const e = this.mod.escala || 1, L = this.p.comprimento * 0.5 * e, W = this.p.largura * 0.5 * e;
    return Math.min(L, L * Math.abs(Math.sin(this.psi)) + W * Math.abs(Math.cos(this.psi)));
  }

  /** Giro do rodopio neste passo (rad/s): voltas inteiras num smoothstep, termina olhando para onde ia. */
  _giroDoRodopio(dt) {
    if (!(this._rodDur > 0)) return 0;
    const decorrido = this._rodDur - this.efeitos.rodopio + dt;
    const ang = F.RODOPIO_VOLTAS * DUAS_PI * suave(decorrido / this._rodDur);
    const d = ang - this._rodAng;
    this._rodAng = ang;
    return d / dt;
  }

  // -----------------------------------------------------------------------------------------------------------------  no chao
  _passoNoChao(dt) {
    const pista = this.corrida.pista, sup = pista.sup(this.sup), c = this.controle, m = this.mod, p = this.p, ef = this.efeitos;
    const mk0 = sup.marcasEm(this.s);
    const mag = (mk0 & MARCA.MAGNETICO) !== 0, terra = (mk0 & MARCA.TERRA) !== 0;
    if (mk0 & MARCA.IMPULSO) this._impulso = F.IMPULSO_TEMPO;
    const rodando = ef.rodopio > 0, gelado = ef.gelo > 0, semControle = rodando || gelado;

    // --- comandos (rodopio e gelo tiram o controle)
    const dir = semControle ? 0 : limita(c.direcao || 0, -1, 1);
    const acel = semControle ? 0 : limita(c.acel || 0, 0, 1);
    let freio = semControle ? 0 : limita(c.freio || 0, 0, 1);
    this._volante(dir, dt);

    // --- derrapagem: o botao FREIO/DRIFT andando e virando derrapa; parado ou reto, freia (o mesmo botao no toque)
    if (!this.derrapando) {
      if (!semControle && c.drift && this.vf > F.DRIFT_VEL_ENTRA && Math.abs(this.volante) > F.DRIFT_DIRECAO_MIN) this._ligaDrift(true);
    } else if (semControle || !c.drift || this.vf < F.DRIFT_VEL_SAI) this._ligaDrift(false);
    if (this.derrapando) freio = 0;

    // --- giro: raio(v) cresce com v2 (config/fisica.js) — devagar vira fechado, embalado precisa de espaco
    const v = Math.abs(this.vf);
    const q = v / F.VEL_REFERENCIA;
    const raio = F.RAIO_MINIMO + (p.raioRef - F.RAIO_MINIMO) * q * q;
    let w = this.volante * (v / raio) * m.direcao * (this.vf >= 0 ? 1 : -1);
    // quase parado: vira patinando (ver GIRO_PARADO); de re ou freando parado, vira ao contrario, como carro de re
    if (v < F.GIRO_PARADO_ATE && (acel > 0.01 || freio > 0.05)) {
      const re = this.vf < -0.1 || (freio > 0.05 && this.vf <= 0.5);
      const wp = this.volante * F.GIRO_PARADO * m.direcao * (1 - v / F.GIRO_PARADO_ATE) * (re ? -1 : 1);
      if (Math.abs(wp) > Math.abs(w)) w = wp;
    }
    if (this.derrapando) w *= F.DRIFT_GIRO;
    if (gelado) w = 0;
    if (rodando) w = this._giroDoRodopio(dt);
    this.giro = w;
    this._gira(w * dt);

    // --- longitudinal
    sup.quadro(this.s, _T, _N, _R);
    const frenteY = _T.y * Math.cos(this.psi) + _R.y * Math.sin(this.psi);
    const vMax = p.vMax * m.velMax * (terra ? F.TERRA_VEL : 1);
    const vImpulso = this._impulso > 0 ? p.vMax * m.velMax * F.IMPULSO_VEL : 0;
    const teto = Math.max(vMax, vImpulso);
    const rapidez = Math.hypot(this.vf, this.vr);
    let a = 0;
    const semAcelerar = acel <= 0.01 || freio > 0.05;
    if (freio > 0.05) {
      if (this.vf > 0.5) a -= F.FREIO * freio;
      else if (this.vf > -F.RE_VEL) a -= F.RE_ACEL * freio;          // parado e freando: re lenta (sair de um encosto)
    } else if (acel > 0.01) {
      if (this.vf < -0.5) a += F.FREIO * acel;                         // de re e acelerando: primeiro para
      else {
        const u = rapidez / vMax;                                        // a rapidez inteira: derrapar nao passa da vMax
        if (u < 1) a += p.acel * m.acel * acel * (1 - u * u) * (this.derrapando ? F.DRIFT_MOTOR : 1);
      }
    }
    if (vImpulso > 0 && this.vf < vImpulso) a += F.IMPULSO_ACEL;
    // turbo/poderes: m/s2 extra para a frente; perto do teto some (senao o empurrao segura o carro acima da vMax do turbo)
    if (m.empurrao > 0) { if (this.vf < teto) a += m.empurrao * Math.min(1, (teto - this.vf) / 3); }
    else if (m.empurrao < 0) a += m.empurrao;
    if (!mag) a -= F.G_RAMPA * frenteY;                                  // subir freia, descer embala; no loop nao (pedido)
    const vfAntes = this.vf;
    this.vf += a * dt;
    if (semAcelerar) {                                                   // rolando: atrito + ar, que so freiam (nunca invertem)
      const r = (F.ROLAMENTO + F.ARRASTO * this.vf * this.vf) * dt;
      this.vf = Math.abs(this.vf) <= r ? 0 : this.vf - Math.sign(this.vf) * r;
    }
    if (gelado) { const k = Math.exp(-F.GELO_FREIO * dt); this.vf *= k; this.vr *= k; }
    if (rodando) this.vf *= Math.exp(-F.RODOPIO_FREIO * dt);

    // --- aderencia lateral
    let k = p.aderencia * m.aderencia * (terra ? F.TERRA_ADERENCIA : 1);
    if (this.derrapando) k *= F.DRIFT_ADERENCIA;
    if (rodando) k *= F.RODOPIO_ADERENCIA;
    this._aderencia(k, this.derrapando ? F.DRIFT_PERDA : F.PERDA_NA_CURVA, dt);
    if (this.derrapando) { const lim = TAN_DRIFT_MAX * Math.abs(this.vf); if (Math.abs(this.vr) > lim) this.vr = Math.sign(this.vr) * lim; }
    // acima do teto (o turbo acabou, entrou embalado na terra, descida): corta a velocidade INTEIRA — cortar so vf deixava o pneu
    // devolver o escorregamento para a frente e o carro ficava acima do limite da terra enquanto fazia curva
    const rap2 = Math.hypot(this.vf, this.vr);
    if (rap2 > teto) {
      const corte = Math.min((rap2 - teto) * (1 - Math.exp(-(terra ? F.TERRA_TAXA : F.ACIMA_TAXA) * dt)), (terra ? F.TERRA_DESACEL : F.DESACEL_ACIMA) * dt);
      const k2 = (rap2 - corte) / rap2;
      this.vf *= k2; this.vr *= k2;
    }

    // --- fim de atalho: puxao de leve para a borda aberta (FUNIL_ATALHO)
    if (this.sup !== 0) {
      const at = pista.atalhos[this.sup - 1], falta = sup.comprimento - this.s;
      if (at && falta < F.FUNIL_ATALHO) {
        const dVR = -at.lado * F.ACEL_FUNIL * (1 - falta / F.FUNIL_ATALHO) * dt; // a borda de dentro e o lado oposto ao do atalho
        this.vf += dVR * Math.sin(this.psi); this.vr += dVR * Math.cos(this.psi);
      }
    }
    if (mag && this.vf < F.VEL_MIN_NO_LOOP) this.vf = F.VEL_MIN_NO_LOOP; // crianca sempre completa o loop
    this.vf = limita(this.vf, -F.VEL_TETO, F.VEL_TETO);
    this.aceleracao = (this.vf - vfAntes) / dt;

    // --- anda
    if (this._anda(sup, dt)) return;                                     // trocou de superficie no fim do atalho

    // --- o que ha no chao novo
    const sup2 = pista.sup(this.sup), mk = sup2.marcasEm(this.s);
    const mag2 = (mk & MARCA.MAGNETICO) !== 0;
    // no trecho magnetico (loop) o carro NUNCA decola (pedido): nem vao, nem crista, nem beira sem muro o tiram do asfalto
    if ((mk & MARCA.VAO) && !mag2) { this._decola(false); return; }
    if ((mk & MARCA.LANCA) && !mag2 && Math.abs(this.vf) > 0.5) { this._decola(true); return; }
    // --- bordas: muro, boca de atalho ou o vazio
    const meia = sup2.larguraEm(this.s) * 0.5;
    const lim = Math.max(0.2, meia - this._meiaLarguraNaPista());
    if (this.d > lim || this.d < -lim) {
      const lado = this.d > 0 ? 1 : -1;
      const abre = (mk & (lado > 0 ? MARCA.ABRE_DIR : MARCA.ABRE_ESQ)) !== 0;
      const muro = (mk & (lado > 0 ? MARCA.MURO_DIR : MARCA.MURO_ESQ)) !== 0;
      if (abre) {
        // boca de atalho: o carro passa por cima da emenda; troca de tira quando o MEIO dele cruza a borda
        if (Math.abs(this.d) > meia && !this._trocaDeSuperficie()) this._bateNoMuro(lado, lim, dt);
      } else if (muro || mag2) this._bateNoMuro(lado, lim, dt);       // loop sem muro desenhado: a beira segura do mesmo jeito
      else if (Math.abs(this.d) > meia) { this._decola(false); return; } // trecho sem muro: o meio do carro saiu do asfalto, cai
    }
    // --- ponto seguro: chao da principal fora de rampa e vao (respawn() decide se volta antes ou depois do buraco)
    if (this.sup === 0 && !(mk & (MARCA.VAO | MARCA.LANCA))) this.sSeguro = this.s;
  }

  /** Integra s, d e psi no chao (e no tornado). Trata as pontas da tira aberta. Devolve true se trocou de superficie. */
  _anda(sup, dt) {
    const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
    const VT = this.vf * cs - this.vr * sn, VR = this.vf * sn + this.vr * cs;
    const kh = sup.khEm(this.s);
    const sPonto = VT / Math.max(0.3, 1 - kh * this.d);                 // por dentro da curva o caminho e mais curto
    this.s += sPonto * dt;
    this.d += VR * dt;
    this.psi = embrulha(this.psi - kh * sPonto * dt);
    // a dica da projecao (contrato: `i`) anda junto: e dela que a busca local parte quando o carro decola. Parada, ela ficava na amostra do
    // ultimo teleporte e, na decolagem, a projecao achava outro trecho da pista (selva: decolou em s = 550 e "pousou" em 578 num passo)
    this.i = sup.idx(Math.round(sup.normaliza(this.s) / sup.ds));
    if (sup.fechada) { this.s = sup.normaliza(this.s); return false; }
    if (this.s < 0) {                                                    // de re no comeco do atalho: e parede
      this.s = 0;
      if (VT < 0) { const c2 = Math.cos(this.psi), s2 = Math.sin(this.psi); this.vf = VR * s2; this.vr = VR * c2; }
      return false;
    }
    if (this.s >= sup.comprimento - 1) { this._saiDoAtalho(); return true; }
    return false;
  }

  /** Bateu no muro do lado `lado` (+1 direita): prende d, devolve V_R com restituicao baixa, perde um pouco de embalo e endireita o rumo
   *  para a parede (desliza ao longo dela). Emite `carro:batida` se a pancada passou de raspada. */
  _bateNoMuro(lado, lim, dt) {
    const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
    let VT = this.vf * cs - this.vr * sn, VR = this.vf * sn + this.vr * cs;
    this.d = lado * lim;
    const contra = VR * lado;
    if (contra > 0) {
      VR = -lado * contra * F.MURO_RESTITUICAO;
      const perda = Math.min(Math.abs(VT), (contra * F.MURO_PERDA) / Math.sqrt(this.p.massa * (this.mod.massa || 1)));
      VT -= Math.sign(VT) * perda;
      if (this.psi * lado > 0) this.psi *= Math.max(0.15, 1 - contra * F.MURO_ENDIREITA_POR_MS); // a pancada ja vira o carro para a parede
      if (contra > F.MURO_FORCA_EVENTO && this._t - this._tMuro > F.MURO_INTERVALO) {
        this._tMuro = this._t;
        emite('carro:batida', { carro: this, outro: null, forca: contra, tipo: 'muro' });
      }
    }
    if (this.psi * lado > 0) this.psi *= Math.exp(-F.MURO_ENDIREITA * dt);
    const c2 = Math.cos(this.psi), s2 = Math.sin(this.psi);
    this.vf = VT * c2 + VR * s2;
    this.vr = -VT * s2 + VR * c2;
  }

  /** Empurrado por outro carro (js/colisoes.js): o muro nao se mexe — prende d na linha do muro, tira a velocidade que entra nele. Sem
   *  muro (beira de risco) ou na boca do atalho, deixa: o proximo passo cai pela beira ou troca de tira. */
  _prendeNoMuro() {
    if (this._modo === AR) return;
    const sup = this.corrida.pista.sup(this.sup), mk = sup.marcasEm(this.s);
    const lim = Math.max(0.2, sup.larguraEm(this.s) * 0.5 - this._meiaLarguraNaPista());
    if (this.d <= lim && this.d >= -lim) return;
    const lado = this.d > 0 ? 1 : -1;
    if (!(mk & (lado > 0 ? MARCA.MURO_DIR : MARCA.MURO_ESQ)) || (mk & (lado > 0 ? MARCA.ABRE_DIR : MARCA.ABRE_ESQ))) return;
    this.d = lado * lim;
    const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
    const VT = this.vf * cs - this.vr * sn;
    let VR = this.vf * sn + this.vr * cs;
    if (VR * lado > 0) VR = 0;
    this.vf = VT * cs + VR * sn; this.vr = -VT * sn + VR * cs;
  }

  /** Boca de atalho: pede a outra tira para a pista (js/pista.js transicao). O carro nao gira no mundo: so o psi muda de referencia. */
  _trocaDeSuperficie() {
    const pista = this.corrida.pista, sup = pista.sup(this.sup);
    sup.quadro(this.s, _T, _N, _R);
    _F.copy(_T).multiplyScalar(Math.cos(this.psi)).addScaledVector(_R, Math.sin(this.psi));
    sup.ponto(this.s, this.d, 0, _P);
    const r = pista.transicao(this.sup, this.s, this.d, _P, _trans);
    if (!r) return false;
    const nova = pista.sup(r.sup);
    nova.quadro(r.s, _T, _N, _R);
    this.psi = Math.atan2(_F.dot(_R), _F.dot(_T));
    this.sup = r.sup; this.s = r.s; this.d = r.d; this.i = r.i; this.h = 0;
    return true;
  }

  /** O atalho acabou (s >= comprimento - 1) sem o carro ter cruzado a boca: projeta na principal e prende dentro da largura. */
  _saiDoAtalho() {
    const pista = this.corrida.pista, sup = pista.sup(this.sup), P = pista.principal, at = pista.atalhos[this.sup - 1];
    this.s = Math.min(this.s, sup.comprimento);
    sup.quadro(this.s, _T, _N, _R);
    _F.copy(_T).multiplyScalar(Math.cos(this.psi)).addScaledVector(_R, Math.sin(this.psi));
    sup.ponto(this.s, this.d, 0, _P);
    P.projeta(_P, Math.round(at.sSaida / P.ds), JANELA_SAIDA_DO_ATALHO, _proj);
    this.sup = 0; this.s = _proj.s; this.i = _proj.i; this.h = 0;
    P.quadro(this.s, _T, _N, _R);
    this.psi = Math.atan2(_F.dot(_R), _F.dot(_T));
    const meia = Math.max(0.2, P.larguraEm(this.s) * 0.5 - this._meiaLarguraNaPista());
    this.d = limita(_proj.d, -meia, meia);
  }

  // -----------------------------------------------------------------------------------------------------------------  no ar
  /** Sai do chao com a velocidade de mundo que tem. `lanca` (crista de rampa): ANGULO_EXTRA_DA_RAMPA mais para cima. */
  _decola(lanca) {
    const sup = this.corrida.pista.sup(this.sup);
    sup.quadro(this.s, _T, _N, _R);
    const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
    const VT = this.vf * cs - this.vr * sn, VR = this.vf * sn + this.vr * cs;
    this.vel.copy(_T).multiplyScalar(VT).addScaledVector(_R, VR);
    if (lanca) { const r = this.vel.length(); this.vel.multiplyScalar(COS_EXTRA).addScaledVector(_N, r * SEN_EXTRA); }
    sup.ponto(this.s, this.d, 0, this.pos);
    _F.copy(_T).multiplyScalar(cs).addScaledVector(_R, sn);
    _E.crossVectors(_N, _F);
    _M.makeBasis(_E, _N, _F);
    this._qAr.setFromRotationMatrix(_M);
    this._modo = AR; this.noChao = false; this.tempoNoAr = 0; this.h = 0;
    this.i = sup.idx(Math.round(sup.normaliza(this.s) / sup.ds));       // a busca local no ar parte daqui (ver _anda)
    this._ligaDrift(false);
    emite('carro:decolou', { carro: this, forca: Math.max(0, this.vel.dot(_N)) });
  }

  _passoNoAr(dt) {
    const pista = this.corrida.pista, c = this.controle, ef = this.efeitos;
    let sup = pista.sup(this.sup);
    this.tempoNoAr += dt;
    const semControle = ef.rodopio > 0 || ef.gelo > 0;
    this._volante(semControle ? 0 : limita(c.direcao || 0, -1, 1), dt);
    this.vel.y -= F.G_AR * dt;
    // giro no ar em torno do Y do mundo (direita = angulo negativo: o carro olha para +Z e a direita dele e -X)
    let w = this.volante * F.GIRO_NO_AR;
    if (ef.rodopio > 0) w = this._giroDoRodopio(dt);
    if (ef.gelo > 0) w = 0;
    this.giro = w;
    if (w !== 0) {
      _q.setFromAxisAngle(CIMA_DO_MUNDO, -w * dt);
      this._qAr.premultiply(_q);
      const ang = -w * dt * F.CONTROLE_NO_AR, ca = Math.cos(ang), sa = Math.sin(ang), vx = this.vel.x, vz = this.vel.z;
      this.vel.x = vx * ca + vz * sa; this.vel.z = -vx * sa + vz * ca;
    }
    this.aceleracao = 0;
    this.pos.addScaledVector(this.vel, dt);
    sup.projeta(this.pos, this.i, F.JANELA_DE_BUSCA, _proj);
    this.i = _proj.i; this.s = _proj.s; this.d = _proj.d; this.h = _proj.h;
    let mk = sup.marcasEm(this.s), meia = sup.larguraEm(this.s) * 0.5;
    // muros no ar: baixo, o muro de verdade segura e devolve; mais alto, a parede invisivel do corredor (PAREDE_NO_AR) so tira a
    // velocidade para fora. Na boca do atalho, baixo, troca de tira no ar
    if (this.h < F.PAREDE_NO_AR && this.h > -F.TOLERANCIA_DE_POUSO) {
      const lim = Math.max(0.2, meia - this._meiaLarguraNaPista());
      if (this.d > lim || this.d < -lim) {
        const lado = this.d > 0 ? 1 : -1;
        if (mk & (lado > 0 ? MARCA.ABRE_DIR : MARCA.ABRE_ESQ)) {
          if (Math.abs(this.d) > meia && this.h < F.ALTURA_DO_MURO) {
            const r = pista.transicao(this.sup, this.s, this.d, this.pos, _trans);
            if (r) { this.sup = r.sup; this.s = r.s; this.d = r.d; this.h = r.h; this.i = r.i; sup = pista.sup(this.sup); mk = sup.marcasEm(this.s); meia = sup.larguraEm(this.s) * 0.5; }
          }
        } else if (mk & (lado > 0 ? MARCA.MURO_DIR : MARCA.MURO_ESQ)) {
          sup.quadro(this.s, _T, _N, _R);
          this.pos.addScaledVector(_R, lado * lim - this.d);
          this.d = lado * lim;
          const vR = this.vel.dot(_R);
          if (vR * lado > 0) this.vel.addScaledVector(_R, -vR * (this.h < F.ALTURA_DO_MURO ? 1 + F.MURO_RESTITUICAO : 1));
        }
      }
    }
    // pouso: chegou ao asfalto (ate TOLERANCIA abaixo), dentro da largura e fora do vao. Mais fundo que isso ja passou da borda: cai
    if (this.h <= 0 && this.h >= -F.TOLERANCIA_DE_POUSO && Math.abs(this.d) <= meia + 0.3 && !(mk & MARCA.VAO)) { this._pousa(); return; }
    if (this.h < -F.QUEDA_ABAIXO || this.tempoNoAr > F.TEMPO_MAX_NO_AR) { this._queda(); return; }
    this._alinhaNoAr(dt);
  }

  /** A carroceria aponta para onde o carro voa (bico desce na queda) e nivela o rolamento. */
  _alinhaNoAr(dt) {
    _F.set(0, 0, 1).applyQuaternion(this._qAr);
    _A.set(_F.x, 0, _F.z);
    if (_A.lengthSq() < 1e-6) _A.set(this.vel.x, 0, this.vel.z);
    if (_A.lengthSq() < 1e-6) return;
    _A.normalize();
    const vh = Math.hypot(this.vel.x, this.vel.z);
    const arfa = limita(Math.atan2(this.vel.y, Math.max(1, vh)), -F.INCLINA_MAX_NO_AR, F.INCLINA_MAX_NO_AR);
    _F.copy(_A).multiplyScalar(Math.cos(arfa)).addScaledVector(CIMA_DO_MUNDO, Math.sin(arfa));
    _N.copy(CIMA_DO_MUNDO).addScaledVector(_F, -_F.y).normalize();
    _E.crossVectors(_N, _F);
    _M.makeBasis(_E, _N, _F);
    _q.setFromRotationMatrix(_M);
    this._qAr.slerp(_q, 1 - Math.exp(-F.ALINHA_NO_AR * dt));
  }

  /** Pousou: a velocidade volta para (vf, vr, psi) no quadro da pista; a componente normal e o impacto (descartada). */
  _pousa() {
    const sup = this.corrida.pista.sup(this.sup);
    sup.quadro(this.s, _T, _N, _R);
    const impacto = Math.max(0, -this.vel.dot(_N));
    const VT = this.vel.dot(_T), VR = this.vel.dot(_R);
    _F.set(0, 0, 1).applyQuaternion(this._qAr);
    let psi = Math.atan2(_F.dot(_R), _F.dot(_T));
    if (Math.hypot(VT, VR) > 2) {                                        // pousa no maximo RUMO_MAX torto em relacao a para onde vai
      const beta = Math.atan2(VR, VT);
      psi = beta + limita(embrulha(psi - beta), -F.RUMO_MAX_NO_POUSO, F.RUMO_MAX_NO_POUSO);
    }
    this.psi = embrulha(psi);
    const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
    this.vf = VT * cs + VR * sn;
    this.vr = -VT * sn + VR * cs;
    this.h = 0; this._modo = CHAO; this.noChao = true; this.tempoNoAr = 0;
    emite('carro:pouso', { carro: this, forca: impacto });
  }

  _queda() {
    this.quedas++;
    emite('carro:queda', { carro: this });
    this.respawn();
  }

  // -----------------------------------------------------------------------------------------------------------------  tornado
  _passoLevantado(dt) {
    const pista = this.corrida.pista, sup = pista.sup(this.sup);
    this._levT += dt;
    const prog = Math.min(1, this._levT / this._levDur);
    this.h = F.TORNADO_ALTURA * 4 * prog * (1 - prog);
    const ang = F.TORNADO_VOLTAS * DUAS_PI * suave(prog);
    const dth = ang - this._levAng;
    this._levAng = ang;
    this._gira(dth);                                                      // sem pneu no chao: a velocidade do mundo se conserva
    this.giro = dth / dt;
    const k = Math.exp(-F.TORNADO_FREIO * dt);
    this.vf *= k; this.vr *= k;
    this.aceleracao = 0;
    this._volante(0, dt);
    if (this._anda(sup, dt)) { this.h = 0; }
    const sup2 = pista.sup(this.sup);
    const lim = Math.max(0.2, sup2.larguraEm(this.s) * 0.5 - this._meiaLarguraNaPista());
    if (this.d > lim) this.d = lim; else if (this.d < -lim) this.d = -lim; // o tornado nao joga ninguem para fora da pista
    this.efeitos.levantado = Math.max(0, this._levDur - this._levT);
    if (prog >= 1) {
      this.h = 0; this._modo = CHAO; this.noChao = true; this.efeitos.levantado = 0;
      emite('carro:pouso', { carro: this, forca: 2 * F.TORNADO_ALTURA });
    }
  }

  // =====================================================================================================================  mundo
  /** pos, vel, quat, frente, cima, direita e velocidade a partir do estado (chao/tornado) ou do proprio estado de mundo (ar). */
  _atualizaMundo() {
    if (this._modo === AR) {
      this.quat.copy(this._qAr);
      this.frente.set(0, 0, 1).applyQuaternion(this.quat);
      this.cima.set(0, 1, 0).applyQuaternion(this.quat);
      this.direita.set(-1, 0, 0).applyQuaternion(this.quat);
    } else {
      const sup = this.corrida.pista.sup(this.sup);
      sup.quadro(this.s, _T, _N, _R);
      sup.ponto(this.s, this.d, this.h, this.pos);
      const cs = Math.cos(this.psi), sn = Math.sin(this.psi);
      _F.copy(_T).multiplyScalar(cs).addScaledVector(_R, sn);
      _E.crossVectors(_N, _F);
      _M.makeBasis(_E, _N, _F);
      this.quat.setFromRotationMatrix(_M);
      this.frente.copy(_F); this.cima.copy(_N); this.direita.copy(_E).negate();
      const VT = this.vf * cs - this.vr * sn, VR = this.vf * sn + this.vr * cs;
      this.vel.copy(_T).multiplyScalar(VT).addScaledVector(_R, VR);
    }
    this.velocidade = this.vel.length();
    // guarda: NaN aqui viraria tela preta e camera perdida para sempre. Volta para o ultimo ponto seguro e conta (as suites exigem 0)
    if (!this._recuperando && !Number.isFinite(this.pos.x + this.pos.y + this.pos.z + this.vel.x + this.vel.y + this.vel.z + this.s + this.d + this.psi + this.vf + this.vr)) {
      this.nans++;
      console.warn('carro ' + this.indice + ': estado invalido, recolocado na pista');
      this._recuperando = true;
      this.colocaNaPista(0, Number.isFinite(this.sSeguro) ? this.sSeguro : 0, 0, 0, 0);
      this._recuperando = false;
    }
  }

  // =====================================================================================================================  contrato
  /** Teleporte no chao. */
  colocaNaPista(sup, s, d, psi = 0, vf = 0) {
    const S = this.corrida.pista.sup(sup);
    this.sup = sup; this.s = S.normaliza(s); this.d = d; this.psi = psi; this.vf = vf; this.vr = 0; this.h = 0;
    this.i = S.idx(Math.round(this.s / S.ds));
    this._modo = CHAO; this.noChao = true; this.tempoNoAr = 0; this.volante = 0; this.giro = 0; this.aceleracao = 0;
    this._ligaDrift(false);
    this._atualizaMundo();
  }

  /** Volta para a pista (queda): no ponto seguro, no centro, a VEL_RESPAWN, fantasma por FANTASMA s. Se ha rampa ou vao logo a frente do
   *  ponto seguro, volta DEPOIS do buraco (12 m/s antes da rampa e cair de novo — o laco de queda que a crianca nao entenderia). */
  respawn() {
    const s = this._pontoDeRespawn();
    this.colocaNaPista(0, s, 0, 0, F.VEL_RESPAWN);
    this.sSeguro = s;
    this.fantasma = F.FANTASMA;
    this.efeitos.rodopio = 0; this.efeitos.gelo = 0; this.efeitos.levantado = 0;
    emite('carro:volta_pista', { carro: this });
  }

  _pontoDeRespawn() {
    const P = this.corrida.pista.principal, perigo = MARCA.VAO | MARCA.LANCA;
    const s0 = P.normaliza(Number.isFinite(this.sSeguro) ? this.sSeguro : 0);
    let achou = -1;
    for (let k = 0; k <= F.RESPAWN_OLHA_FRENTE; k++) if (P.marcasEm(s0 + k) & perigo) { achou = k; break; }
    if (achou < 0) return s0;
    let x = s0 + achou, livre = 0;
    for (let k = 0; k < P.n && livre < F.RESPAWN_DEPOIS; k++) { if (P.marcasEm(x) & perigo) livre = 0; else livre++; x += 1; }
    return P.normaliza(x);
  }

  /** Mancha de Oleo e companhia: gira `seg` segundos (voltas inteiras), perde velocidade, sem controle. */
  rodopia(seg) {
    if (!(seg > 0)) return;
    this.efeitos.rodopio = seg; this._rodDur = seg; this._rodAng = 0;
    this._ligaDrift(false);
  }

  /** Raio Congelante: parado no gelo `seg` segundos (sem controle, desacelera forte). */
  congela(seg) {
    if (!(seg > 0)) return;
    this.efeitos.gelo = Math.max(this.efeitos.gelo, seg);
    this._ligaDrift(false);
  }

  /** Um toque no PODER congelado: tira `seg` do gelo. Vale UMA vez por passo (G.relogio.quadros): a fisica chama sozinha quando o
   *  controle.poder chega congelado, e os poderes podem chamar tambem sem contar dobrado. */
  quebraGelo(seg = F.GELO_POR_TOQUE) {
    const q = this.G && this.G.relogio ? this.G.relogio.quadros : -2;
    if (q === this._quebrouEm) return;
    this._quebrouEm = q;
    this.efeitos.gelo = Math.max(0, this.efeitos.gelo - (seg > 0 ? seg : F.GELO_POR_TOQUE));
  }

  /** Mini Tornado: sobe ~TORNADO_ALTURA girando e cai em `seg` segundos. No loop o carro esta grudado: so gira. No ar: sobe mais e gira. */
  levanta(seg) {
    if (!(seg > 0)) return;
    if (this._modo === AR) { this.vel.y = Math.max(this.vel.y, 8); this.rodopia(seg); this.efeitos.levantado = seg; return; }
    const mk = this.corrida.pista.sup(this.sup).marcasEm(this.s);
    if (mk & MARCA.MAGNETICO) { this.rodopia(seg); return; }
    this._modo = LEVANTADO; this.noChao = false;
    this._levT = 0; this._levDur = seg; this._levAng = 0; this.efeitos.levantado = seg;
    this._ligaDrift(false);
    emite('carro:decolou', { carro: this, forca: 0 });
  }

  /** Impulso no referencial do carro (m/s). */
  empurra(dvf, dvr) {
    if (this._modo === AR) { this.vel.addScaledVector(this.frente, dvf || 0).addScaledVector(this.direita, dvr || 0); return; }
    this.vf += dvf || 0; this.vr += dvr || 0;
  }

  /** Para o Troca-Troca: onde o carro esta na pista. */
  estadoDePista() { return { sup: this.sup, s: this.s, d: this.d, h: this.h, psi: this.psi, i: this.i, noChao: this.noChao }; }

  /** O Troca-Troca poe o carro no lugar do outro. Cada um leva a PROPRIA velocidade (no rumo novo). No ar: continua voando dali. */
  aplicaEstadoDePista(e) {
    const pista = this.corrida.pista, sup = pista.sup(e.sup || 0);
    this.sup = e.sup || 0; this.s = sup.normaliza(e.s); this.d = e.d; this.psi = e.psi || 0;
    this.i = Number.isFinite(e.i) ? e.i : sup.idx(Math.round(this.s / sup.ds));
    if (e.noChao !== false || !(e.h > 0)) {
      this.h = 0; this._modo = CHAO; this.noChao = true; this.tempoNoAr = 0;
    } else {
      const rap = Math.max(this.velocidade, Math.abs(this.vf));
      this.h = e.h; this._modo = AR; this.noChao = false; this.tempoNoAr = 0;
      sup.quadro(this.s, _T, _N, _R);
      sup.ponto(this.s, this.d, this.h, this.pos);
      _F.copy(_T).multiplyScalar(Math.cos(this.psi)).addScaledVector(_R, Math.sin(this.psi));
      _E.crossVectors(_N, _F);
      _M.makeBasis(_E, _N, _F);
      this._qAr.setFromRotationMatrix(_M);
      this.vel.copy(_F).multiplyScalar(rap);
    }
    this._ligaDrift(false);
    this._atualizaMundo();
  }

  /** Para a IA/HUD: velocidade maxima de agora (com os modificadores do passo). */
  get velMaxAgora() { return this.p.vMax * (this.mod.velMax || 1); }

  /** true enquanto o estado mora no MUNDO (voando de rampa, caindo); no chao e no tornado o estado e (s, d, h). js/colisoes.js le. */
  get estaVoando() { return this._modo === AR; }

  destroi() {
    if (this.visual && this.visual.destroi) this.visual.destroi();
    this.visual = null;
  }
}
