// STUB DA FUNDACAO (fase 1) — a fase 2 substitui este arquivo inteiro pela fisica de arcade (docs/CONTRATOS.md secao 5).
// Este carro so desliza pela pista em (s, d) com a velocidade pedida, para a corrida, a IA de mentira e os testes da fundacao rodarem.
import * as THREE from 'three';
import { criaModeloCarro } from './modelo_carro.js';

const _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3(), _F = new THREE.Vector3(), _M = new THREE.Matrix4(), _L = new THREE.Vector3();
const MOD_PADRAO = { velMax: 1, acel: 1, aderencia: 1, direcao: 1, massa: 1, escala: 1, empurrao: 0, semTurbo: false, visao: 0 };

export class Carro {
  constructor(G, corrida, { cfg, indice, ehJogador, nome }) {
    this.G = G; this.corrida = corrida; this.cfg = cfg; this.indice = indice; this.ehJogador = ehJogador; this.nome = nome;
    this.sup = 0; this.s = 0; this.d = 0; this.h = 0; this.psi = 0; this.vf = 0; this.vr = 0; this.noChao = true; this.i = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.frente = new THREE.Vector3(0, 0, 1); this.cima = new THREE.Vector3(0, 1, 0); this.direita = new THREE.Vector3(-1, 0, 0);
    this.velocidade = 0; this.fantasma = 0; this.sSeguro = 0;
    this.controle = { acel: 0, freio: 0, direcao: 0, drift: false, turbo: false, poder: false };
    this.mod = { ...MOD_PADRAO };
    this.efeitos = { rodopio: 0, gelo: 0, levantado: 0 };
    this.visual = null;
  }
  async carrega() {
    const m = await criaModeloCarro(this.G, this.cfg);
    this.modelo = m;
    this.visual = { grupo: m.grupo, quadro: () => { m.grupo.position.copy(this.pos); m.grupo.quaternion.copy(this.quat); } };
  }
  zeraMod() { Object.assign(this.mod, MOD_PADRAO); }
  colocaNaPista(sup, s, d, psi = 0, vf = 0) { this.sup = sup; this.s = s; this.d = d; this.psi = psi; this.vf = vf; this.vr = 0; this.h = 0; this.noChao = true; this._atualizaMundo(); }
  respawn() { this.colocaNaPista(0, this.sSeguro, 0, 0, 10); this.fantasma = 1.5; }
  rodopia() {} congela() {} quebraGelo() {} levanta() {} empurra(dvf) { this.vf += dvf; }
  estadoDePista() { return { sup: this.sup, s: this.s, d: this.d, h: this.h, psi: this.psi, i: this.i, noChao: this.noChao }; }
  aplicaEstadoDePista(e) { Object.assign(this, e); this._atualizaMundo(); }
  passo(dt) {
    const c = this.controle, sup = this.corrida.pista.sup(this.sup);
    const vmax = 30 * this.mod.velMax;
    this.vf += ((c.acel * 12 + this.mod.empurrao) - c.freio * 20 - this.vf * 0.05) * dt;
    this.vf = Math.max(0, Math.min(vmax, this.vf));
    this.d += c.direcao * 6 * dt * Math.min(1, this.vf / 10);
    const meia = sup.larguraEm(this.s) * 0.5 - 1.2; this.d = Math.max(-meia, Math.min(meia, this.d));
    this.s = sup.normaliza(this.s + this.vf * dt);
    if (this.sup === 0) this.sSeguro = this.s;
    this.velocidade = this.vf;
    this._atualizaMundo();
  }
  _atualizaMundo() {
    const sup = this.corrida.pista.sup(this.sup);
    sup.ponto(this.s, this.d, this.h, this.pos);
    sup.quadro(this.s, _T, _N, _R);
    _F.copy(_T).multiplyScalar(Math.cos(this.psi)).addScaledVector(_R, Math.sin(this.psi));
    _L.crossVectors(_N, _F);
    _M.makeBasis(_L, _N, _F); this.quat.setFromRotationMatrix(_M);
    this.frente.copy(_F); this.cima.copy(_N); this.direita.copy(_L).negate();
    this.vel.copy(_F).multiplyScalar(this.vf);
  }
  destroi() {}
}
