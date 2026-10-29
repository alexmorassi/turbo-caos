// STUB DA FUNDACAO (fase 1) — a fase 2 substitui pela camera de perseguicao de verdade (docs/CONTRATOS.md secao 5).
import * as THREE from 'three';
const _alvo = new THREE.Vector3(), _olho = new THREE.Vector3();
export class CameraCorrida {
  constructor(G, corrida) { this.G = G; this.corrida = corrida; }
  inicia() {}
  passo() {
    const c = this.corrida.jogador; if (!c) return; const cam = this.G.camera;
    _olho.copy(c.pos).addScaledVector(c.frente, -9).addScaledVector(c.cima, 3.5);
    cam.position.lerp(_olho, 0.2); cam.up.copy(c.cima); _alvo.copy(c.pos).addScaledVector(c.frente, 6).addScaledVector(c.cima, 1); cam.lookAt(_alvo);
  }
  quadro() {} treme() {} fov() {} destroi() {}
}
