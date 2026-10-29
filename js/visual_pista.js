// STUB DA FUNDACAO (fase 1) — a fase 3 substitui pelo visual completo (asfalto, zebras, muros, loops, cenario, ceu) — CONTRATOS secao 4.
// Aqui: uma fita cinza por superficie, um chao verde e duas luzes, so para a corrida aparecer.
import * as THREE from 'three';
export async function montaVisualDaPista(G, pista) {
  const grupo = new THREE.Group(), tema = pista.tema || {};
  const mat = new THREE.MeshLambertMaterial({ color: tema.asfalto || '#3b3f46', side: THREE.DoubleSide });
  const p = new THREE.Vector3();
  for (const sup of pista.superficies) {
    const n = sup.n + (sup.fechada ? 1 : 0), pos = new Float32Array(n * 6), idx = [];
    for (let k = 0; k < n; k++) {
      const s = Math.min(k * sup.ds, sup.comprimento - (sup.fechada ? 0 : 1e-3)), w = sup.larguraEm(s) / 2;
      sup.ponto(s, -w, 0.02, p); p.toArray(pos, k * 6); sup.ponto(s, w, 0.02, p); p.toArray(pos, k * 6 + 3);
      if (k < n - 1 && !(sup.marcasEm(s) & 4)) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    grupo.add(new THREE.Mesh(g, mat));
  }
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: tema.chao || '#5aa04a' }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = -0.5; grupo.add(chao);
  grupo.add(new THREE.HemisphereLight(0xdfefff, 0x4a6a3a, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(80, 140, 40); grupo.add(sol);
  G.cena.background = new THREE.Color(tema.ceu || '#7cc4ff');
  return { grupo, quadro() {}, destroi() { grupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); mat.dispose(); } };
}
