// MODELO 3D DE UM CARRO (fase 1, fundacao). Clona o GLB normalizado pela fase 1 (tools/carros: frente +Z, chao em y = 0, ~4,2 m de
// comprimento) e acha a carroceria e as rodas. Usado pela corrida (js/visual_carro.js, fase 2) e pela vitrine e pelo podio (fase 6) —
// por isso mora fora dos dois.
//
// Hierarquia do GLB (fase 1): raiz `carro` -> `body` (no sem malha, a malha e filha) e `wheel1..wheel4` (no PIVO sem malha, no centro
// da roda, com extras { radius, front, side }; a malha e filha). O pivo separado existe porque a quantizacao do meshopt poe escala e
// deslocamento no no que carrega a malha: girar esse no giraria a roda em torno do ponto errado.
// O clone COMPARTILHA geometria e material com o GLB do cache (carregaGLB guarda um por arquivo): quem destruir um carro nao pode dar
// dispose nisso — a vitrine e a proxima corrida usam o mesmo.
import { carregaGLB } from './glb.js';

/** Promise<{ grupo, carroceria, rodas: [{ no, raio, frente, lado }], cfg }>. `rodas` vazio = carro sem roda (o Voador). */
export async function criaModeloCarro(G, cfg) {
  const gltf = await carregaGLB(cfg.modelo);
  const grupo = gltf.scene.clone(true);
  grupo.name = 'carro:' + cfg.id;
  let carroceria = null;
  const rodas = [];
  grupo.traverse((o) => {
    if (o.name === 'body' && !carroceria) carroceria = o;
    const m = /^wheel([1-4])$/.exec(o.name);
    if (m) {
      const u = o.userData || {};
      rodas.push({ no: o, raio: u.radius || (u.front ? cfg.rodas?.raioFrente : cfg.rodas?.raioTras) || 0.4, frente: !!u.front, lado: u.side || (o.position.x > 0 ? 1 : -1), n: Number(m[1]) });
    }
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } // sombra simples: a fase 2 decide (mancha embaixo / sombra real na ALTA)
  });
  // RESERVA DA TEXTURA: se o KTX2 falhou (celular que nao transcodifica, GLB sem textura), o carro sairia branco ou preto. Pinta com a
  // cor do carro (config/carros.js) — o jogo do Breno troca por um GLB *_web; aqui a cor basta para a crianca reconhecer o carro.
  if (cfg.cor) grupo.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.map) return;
    const chave = '_reserva_' + cfg.id;
    if (!o.material.userData[chave]) { const m = o.material.clone(); m.color.set(cfg.cor); o.material.userData[chave] = m; }
    o.material = o.material.userData[chave];
  });
  rodas.sort((a, b) => a.n - b.n);
  return { grupo, carroceria: carroceria || grupo, rodas, cfg };
}
