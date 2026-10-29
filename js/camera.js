// A CAMERA DA CORRIDA (fase 2): perseguicao atras e acima do jogador, apresentacao girando em volta dele na contagem e festa girando
// depois da chegada. Contrato: docs/CONTRATOS.md secao 5 — `new CameraCorrida(G, corrida)`, `passo(dt)`, `quadro(dt)`,
// `treme(intensidade, seg)`, `fov(extra)`. Escreve na G.camera (a PerspectiveCamera de js/main.js).
//
// POR QUE A POSICAO E CALCULADA EM COORDENADAS DA PISTA (s, d, h) e nao "carro - frente x 7 m": no loop de 10 m de raio, 7 m para tras
// em linha reta poe a camera FORA do loop, atravessando o asfalto; 7 m para tras AO LONGO DA PISTA a poe dentro dele, acima do
// asfalto, de cabeca para baixo junto com o carro — a montanha-russa do pedido. Na curva, o mesmo truque deixa a camera sobre a pista
// atras do carro em vez de cortar por cima do muro de dentro.
// POR QUE O RUMO DA CAMERA SEGUE PARA ONDE O CARRO VAI (e nao para onde o bico aponta): derrapando o carro atravessa 30 graus e no
// rodopio gira duas voltas; uma camera presa no bico enjoa a crianca. Devagar ou de re, ai sim segue o bico.
// O "CIMA" da camera segue o cima do carro no chao (loop = de cabeca para baixo) e volta ao Y do mundo no ar (mantem o horizonte).
// Nada aqui e jogabilidade: o tremor usa senos do proprio relogio dele (deterministico), nunca G.sorteio nem Math.random.
import * as THREE from 'three';
import { on } from './eventos.js';
import { CORRIDA } from '../config/corrida.js';

// --- enquadramento (aparencia, nao jogabilidade)
const DISTANCIA = 6.0;          // m atras do carro, parado. Era 7,4: na tela de celular deitado o carro de 3,7 m ficava com ~8 % da
                                // largura da tela (foto docs/fotos/fase2_3_reta.png) — o carro e o personagem, tem de aparecer
const DISTANCIA_VEL = 1.8;      // m a mais a 40 m/s (a camera "fica para tras" com a velocidade: sensacao de velocidade)
const DISTANCIA_TURBO = 1.0;    // m a mais no turbo
const ALTURA = 2.25;            // m acima do asfalto
const OLHA_ALTURA = 1.0;        // m acima do carro: o ponto que a camera olha
const OLHA_FRENTE = 16;         // m a frente NA PISTA: o "olha um pouco a frente na curva" do pedido
const PESO_DA_FRENTE = 0.32;    // quanto o olhar puxa para esse ponto da pista (0 = so o carro)
const FOV_BASE = 62;            // graus, parado
const FOV_VEL = 9;              // graus a mais a 40 m/s
const FOV_TURBO = 9;            // graus a mais no turbo (carro.turbo.ativo, fase 4)
const SEGUE_RUMO = 5;           // 1/s
const SEGUE_CIMA = 8;           // 1/s: no loop (360 graus em ~2 s) o cima atrasa ~20 graus — no topo ainda esta de cabeca para baixo
const SEGUE_ALTURA = 6;         // 1/s
const SEGUE_POSICAO = 24;       // 1/s: suaviza degraus (batida, troca de tira); com 12 a camera ficava v/12 = 3 m mais para tras a 36 m/s
const SEGUE_FOV = 4;            // 1/s
const APRESENTA_GIRO = 2.7;     // rad (~155 graus): a contagem comeca de frente-lado e termina atras do carro
const APRESENTA_DIST = 11;      // m no comeco da apresentacao
const APRESENTA_ALTURA = 3.8;
const FESTA_GIRO = 0.55;        // rad/s em volta do carro depois da chegada
const FESTA_DIST = 9;
const FESTA_ALTURA = 3.3;
const TREMOR_METROS = 0.35;     // deslocamento de pico com intensidade 1

const _olho = new THREE.Vector3(), _alvo = new THREE.Vector3(), _alvo2 = new THREE.Vector3(), _cimaAlvo = new THREE.Vector3();
const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _M = new THREE.Matrix4();
const CIMA_DO_MUNDO = new THREE.Vector3(0, 1, 0);
const DUAS_PI = Math.PI * 2;

function embrulha(a) { a = (a + Math.PI) % DUAS_PI; if (a < 0) a += DUAS_PI; return a - Math.PI; }
const segue = (k, dt) => 1 - Math.exp(-k * dt);

/** Ponto de uma tira em (s, d, h), estendendo em linha reta alem das pontas de uma tira aberta (atalho): a camera atras do carro que
 *  acabou de entrar no atalho fica 7 m para tras, nao presa no comeco da tira. */
function pontoNaTira(sup, s, d, h, out) {
  if (sup.fechada || (s >= 0 && s <= sup.comprimento)) return sup.ponto(s, d, h, out);
  const ponta = s < 0 ? 0 : sup.comprimento;
  sup.ponto(ponta, d, h, out);
  sup.quadro(ponta, _T, null, null);
  return out.addScaledVector(_T, s - ponta);
}

export class CameraCorrida {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    G.camera3p = this;
    this.psiC = 0;                       // rumo da camera relativo a frente da pista (rad)
    this.dist = DISTANCIA;
    this.hSuave = 0;
    this.cima = new THREE.Vector3(0, 1, 0);
    this.pos = new THREE.Vector3();
    this.olhar = new THREE.Vector3();
    this.fovAtual = FOV_BASE;
    this._extra = 0;
    this._tremAmp = 0; this._tremDur = 0; this._tremT = 0;
    this._corta = true;                  // proximo passo sem suavizar (largada, volta da queda)
    this._festa = null;                  // { ang, psi0 } depois da chegada
    this._xAnt = new THREE.Vector3(1, 0, 0);
    const j = () => this.corrida.jogador;
    this._desligar = [
      on('carro:batida', (e) => { if (e.carro === j()) this.treme(Math.min(1, (e.forca || 0) / 14) * 0.6, 0.25); }),
      on('carro:pouso', (e) => { if (e.carro === j() && e.forca > 4) this.treme(Math.min(0.6, e.forca / 20), 0.2); }),
      on('carro:volta_pista', (e) => { if (e.carro === j()) this._corta = true; }),
    ];
  }

  inicia() { this._corta = true; this._posiciona(0); }

  /** FOV extra em graus (soma com o da velocidade; o turbo do jogador ja abre FOV_TURBO sozinho — vale o maior dos dois). Chame a cada
   *  passo para segurar; sem chamar, some em ~0,3 s. */
  fov(extra) { const x = Number(extra) || 0; if (x > this._extra) this._extra = x; }

  /** Tremor: intensidade 0..1 (1 = pancada forte, ~0,35 m), some linearmente em `seg` s. O mais forte em curso vale. */
  treme(intensidade, seg) {
    const resto = this._tremDur > 0 ? this._tremAmp * Math.max(0, 1 - this._tremT / this._tremDur) : 0;
    const a = Math.max(0, Number(intensidade) || 0);
    if (a < resto) return;
    this._tremAmp = a; this._tremDur = Math.max(0.05, Number(seg) || 0.3); this._tremT = 0;
  }

  /** Chamado pela corrida no fim do passo: enquadra onde o carro PAROU. */
  passo(dt) { this._posiciona(dt); }

  quadro() { /* tudo acontece no passo (deterministico: as suites leem a camera sem desenhar) */ }

  _posiciona(dt) {
    const c = this.corrida, j = c.jogador, cam = this.G.camera;
    if (!j || !cam || !c.pista) return;
    const corta = this._corta || !(dt > 0);
    const sup = c.pista.sup(j.sup);
    const v = j.velocidade || 0;
    let psiC, dist, altura, pesoFrente = PESO_DA_FRENTE, suaviza = !corta;

    if (c.estado === 'contagem' || c.estado === 'carregando') {
      // apresentacao: de frente-lado ate atras do carro, no ritmo da contagem (3, 2, 1, VAI)
      const total = CORRIDA.CONTAGEM || 3;
      const p = Math.min(1, Math.max(0, (total - c.contagem + (c.tContagem || 0)) / total));
      const e = 1 - (1 - p) * (1 - p) * (1 - p);
      psiC = j.psi + APRESENTA_GIRO * (1 - e);
      dist = APRESENTA_DIST + (DISTANCIA - APRESENTA_DIST) * e;
      altura = APRESENTA_ALTURA + (ALTURA - APRESENTA_ALTURA) * e;
      pesoFrente = PESO_DA_FRENTE * e;
      suaviza = false;
      this.psiC = psiC; this.dist = dist; this.hSuave = 0; this._festa = null;
    } else if (j.chegou || c.estado === 'terminou') {
      // festa: gira em volta do carro (que segue no piloto automatico)
      if (!this._festa) this._festa = { ang: 0, psi0: this.psiC };
      this._festa.ang += FESTA_GIRO * (dt || 0);
      psiC = this._festa.psi0 + this._festa.ang;
      this.dist += (FESTA_DIST - this.dist) * segue(2, dt || 0);
      dist = this.dist;
      altura = FESTA_ALTURA;
      pesoFrente = 0;
    } else {
      // perseguicao: rumo de para onde o carro VAI (ver o cabecalho)
      let psiRef = j.psi;
      if (j.estaVoando) {
        sup.quadro(j.s, _T, _N, _R);
        const vT = j.vel.dot(_T), vR = j.vel.dot(_R);
        if (Math.hypot(vT, vR) > 4) psiRef = Math.atan2(vR, vT);
      } else if (j.vf > 4) {
        const cs = Math.cos(j.psi), sn = Math.sin(j.psi);
        psiRef = Math.atan2(j.vf * sn + j.vr * cs, j.vf * cs - j.vr * sn);
      }
      this.psiC = corta ? psiRef : embrulha(this.psiC + embrulha(psiRef - this.psiC) * segue(SEGUE_RUMO, dt));
      const turbo = !!(j.turbo && j.turbo.ativo);
      const distAlvo = DISTANCIA + DISTANCIA_VEL * Math.min(1.3, v / 40) + (turbo ? DISTANCIA_TURBO : 0);
      this.dist = corta ? distAlvo : this.dist + (distAlvo - this.dist) * segue(2, dt);
      psiC = this.psiC; dist = this.dist; altura = ALTURA;
      this._festa = null;
    }

    // altura do carro (suavizada; caindo no vao, a camera fica na beira olhando)
    const hAlvo = j.noChao ? 0 : Math.max(-1.5, j.h);
    this.hSuave = corta ? hAlvo : this.hSuave + (hAlvo - this.hSuave) * segue(SEGUE_ALTURA, dt);

    // olho em coordenadas da pista (na perseguicao, preso a 3 m da beira: atravessado, o carro nao joga a camera para o meio do mato;
    // na apresentacao e na festa a volta e inteira)
    const meia = sup.larguraEm(j.s) * 0.5 + 3;
    const sC = j.s - dist * Math.cos(psiC);
    let dC = j.d - dist * Math.sin(psiC);
    if (pesoFrente === PESO_DA_FRENTE) dC = Math.max(-meia, Math.min(meia, dC));
    pontoNaTira(sup, sC, dC, this.hSuave + altura, _olho);

    // cima: a pista no lugar da camera + o cima do carro; no ar, o Y do mundo
    if (j.estaVoando) _cimaAlvo.copy(CIMA_DO_MUNDO);
    else { sup.quadro(sup.fechada ? sC : Math.max(0, Math.min(sup.comprimento, sC)), _T, _N, _R); _cimaAlvo.copy(_N).add(j.cima).normalize(); }
    if (suaviza) this.cima.lerp(_cimaAlvo, segue(SEGUE_CIMA, dt)).normalize(); else this.cima.copy(_cimaAlvo);
    if (!(this.cima.lengthSq() > 0.5)) this.cima.copy(CIMA_DO_MUNDO);

    // alvo: o carro, puxado para a pista la na frente (olha para dentro da curva)
    _alvo.copy(j.pos).addScaledVector(this.cima, OLHA_ALTURA);
    if (pesoFrente > 0) {
      pontoNaTira(sup, j.s + OLHA_FRENTE * Math.cos(psiC), j.d * 0.5, this.hSuave + OLHA_ALTURA, _alvo2);
      _alvo.lerp(_alvo2, pesoFrente);
    }

    if (suaviza) { this.pos.lerp(_olho, segue(SEGUE_POSICAO, dt)); this.olhar.lerp(_alvo, segue(SEGUE_POSICAO, dt)); }
    else { this.pos.copy(_olho); this.olhar.copy(_alvo); }
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z + this.olhar.x + this.olhar.y + this.olhar.z)) {
      // nunca NaN: volta para um ponto atras do carro no mundo
      this.pos.copy(j.pos).addScaledVector(j.frente, -DISTANCIA).addScaledVector(CIMA_DO_MUNDO, ALTURA);
      this.olhar.copy(j.pos);
      this.cima.copy(CIMA_DO_MUNDO);
    }
    this._corta = false;

    // orientacao: base montada a mao (lookAt com o cima quase paralelo ao olhar vira roleta)
    _z.subVectors(this.pos, this.olhar);
    if (_z.lengthSq() < 1e-8) _z.set(0, 0, -1);
    _z.normalize();
    _x.crossVectors(this.cima, _z);
    if (_x.lengthSq() < 1e-8) _x.copy(this._xAnt); else { _x.normalize(); this._xAnt.copy(_x); }
    _y.crossVectors(_z, _x).normalize();
    _M.makeBasis(_x, _y, _z);
    cam.quaternion.setFromRotationMatrix(_M);
    cam.up.copy(_y);
    cam.position.copy(this.pos);

    // tremor: senos do PROPRIO relogio do tremor (deterministico, e comeca sempre do mesmo jeito: com o relogio do jogo a pancada podia
    // cair num instante em que os senos quase se anulam e "nao tremer")
    if (this._tremDur > 0 && this._tremT < this._tremDur) {
      const t = this._tremT + 0.37, k = this._tremAmp * TREMOR_METROS * (1 - this._tremT / this._tremDur);
      cam.position.addScaledVector(_x, (Math.sin(t * 47) + 0.6 * Math.sin(t * 29 + 1)) * k).addScaledVector(_y, (0.7 * Math.sin(t * 53 + 2) + 0.5 * Math.sin(t * 31)) * k);
      this._tremT += dt || 0;
    }

    // FOV: abre com a velocidade e no turbo
    const turbo = !!(j.turbo && j.turbo.ativo) && c.estado === 'correndo';
    const fovAlvo = FOV_BASE + FOV_VEL * Math.min(1.3, v / 40) + Math.max(turbo ? FOV_TURBO : 0, this._extra);
    this.fovAtual = corta ? fovAlvo : this.fovAtual + (fovAlvo - this.fovAtual) * segue(SEGUE_FOV, dt);
    this._extra *= Math.exp(-6 * (dt || 0));
    if (this._extra < 0.01) this._extra = 0;
    if (Math.abs(cam.fov - this.fovAtual) > 0.01 && Number.isFinite(this.fovAtual)) { cam.fov = this.fovAtual; cam.updateProjectionMatrix(); }
  }

  destroi() {
    for (const d of this._desligar) d();
    this._desligar.length = 0;
    if (this.G.camera3p === this) this.G.camera3p = null;
  }
}
