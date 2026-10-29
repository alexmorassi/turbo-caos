// CEU, LUZ E NEBLINA DAS PISTAS (fase 3). O ceu e o do Breno (js/core.js de la, a linguagem visual que o Morassi ja aprovou): uma
// ESFERA com degrade por COR DE VERTICE — sem textura e sem shader proprio, o pixel do ceu custa o mesmo que o de uma parede pintada.
// Em volta disso: o brilho do sol pintado nos mesmos vertices, o disco do sol (ou a lua), nuvens fofas instanciadas (uma malha so),
// estrelas na noite, a HemisphereLight + DirectionalLight do tema e a neblina com a cor do horizonte (o cenario some NO ceu, sem
// costura).
//
// TRES DECISOES QUE VEM DE ARMADILHA CONHECIDA:
//   1. renderOrder ALTO (o ultimo dos opacos), depthWrite desligado: no dinotrails-web o ceu com renderOrder -1 cobrava 8 a 17 ms porque
//      todo pixel da esfera era pintado e depois sobrescrito; desenhado por ultimo, o z-buffer dos solidos recusa os pixels tapados;
//   2. a esfera ACOMPANHA a camera e tem raio menor que o `far` dela (0,9 x far): esfera maior que o far e cortada pelo plano longe e o
//      ceu sai PRETO (a primeira foto da fase "vestir" do dinotrails-web);
//   3. o ceu e as estrelas nao passam pelo tone mapping (`toneMapped: false`): a cor do degrade e a cor da tela, e a neblina — que o
//      three aplica DEPOIS do tone mapping, na cor de saida — chega no horizonte com a mesma cor dele.
import * as THREE from 'three';

/** Fracao do `far` da camera usada como raio do ceu (ver o cabecalho, item 2). */
const FATOR_DO_FAR = 0.9;
/** Nuvens: quantas, em que faixa de altura e distancia (fracoes do raio do ceu). Poucas e grandes: de longe sao manchas, nao bolinhas. */
const NUVENS = 26, NUVEM_ALT = [0.1, 0.26], NUVEM_DIST = [0.45, 0.85];
/** Estrelas da noite (uma malha de pontos so). */
const ESTRELAS = 700;

const _v = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Cor do tema ('#rrggbb' ou numero) em THREE.Color (no espaco de trabalho, linear). */
export const cor = (v, padrao = '#ffffff') => new THREE.Color(v ?? padrao);

/** Gerador com semente (mulberry32): o ceu sai igual sempre — nada de Math.random no cenario (a foto compara com a anterior). */
function gerador(semente) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Disco do sol/lua: gradiente radial num canvas pequeno. */
function texturaDisco(lua) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (lua) {
    gr.addColorStop(0, 'rgba(255,255,248,1)'); gr.addColorStop(0.34, 'rgba(240,244,255,1)'); gr.addColorStop(0.4, 'rgba(200,215,255,0.35)'); gr.addColorStop(1, 'rgba(160,180,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    // crateras: manchas suaves, o rosto da lua que a crianca reconhece
    g.fillStyle = 'rgba(170,175,200,0.45)';
    for (const [x, y, r] of [[52, 50, 9], [74, 62, 7], [60, 78, 6], [46, 70, 4], [78, 44, 4]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  } else {
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,253,240,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,0.5)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Nuvem fofa low-poly: 5 a 7 bolas achatadas mescladas, branca em cima e cinza-azulada embaixo (cor de vertice: ja sai "iluminada"). */
function geometriaNuvem(corTopo, corBaixo) {
  const partes = [], r = gerador(77);
  const bolas = [[0, 0, 0, 1], [0.9, -0.1, 0.2, 0.75], [-0.95, -0.12, -0.1, 0.8], [0.35, 0.35, -0.3, 0.7], [-0.4, 0.3, 0.35, 0.65], [1.6, -0.25, -0.1, 0.5], [-1.7, -0.3, 0.15, 0.45]];
  for (const [x, y, z, s] of bolas) {
    const g = new THREE.IcosahedronGeometry(s, 1);
    g.scale(1, 0.62, 0.85); g.translate(x, y * 0.6, z);
    partes.push(g.index ? g.toNonIndexed() : g);
  }
  let n = 0; for (const g of partes) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of partes) {
    const p = g.attributes.position;
    // (as partes sao temporarias: descartadas no fim)
    for (let i = 0; i < p.count; i++) {
      pos[(o + i) * 3] = p.getX(i); pos[(o + i) * 3 + 1] = p.getY(i); pos[(o + i) * 3 + 2] = p.getZ(i);
      const t = suave(-0.45, 0.5, p.getY(i)) * (0.9 + 0.1 * r());
      _c.copy(corBaixo).lerp(corTopo, t);
      col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b;
    }
    o += p.count;
  }
  for (const g of partes) g.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Monta o ceu, a luz e a neblina do tema. Devolve { grupo (vai na cena), luzes, quadro(dt, camera), aplicaQualidade(p), destroi() }. */
export function montaCeu(G, tema, opcoes = {}) {
  const C = tema.ceu || {};
  const topo = cor(C.topo, '#3d8fe0'), meio = cor(C.meio, '#8cc4f0'), horizonte = cor(C.horizonte, '#d8efff'), baixo = cor(C.baixo ?? C.horizonte, '#d8efff');
  const sol = tema.sol || {}, noite = !!tema.noite;
  const dirSol = new THREE.Vector3(...(sol.dir || [0.4, 0.7, -0.5])).normalize();
  const corSol = cor(sol.brilho ?? sol.cor, '#fff2d0');
  const descartaveis = [];
  const guarda = (x) => { descartaveis.push(x); return x; };

  // ---------------------------------------------------------------- a esfera
  const geo = guarda(new THREE.SphereGeometry(1, 48, 24));
  const P = geo.attributes.position, cols = new Float32Array(P.count * 3);
  const brilho = sol.halo ?? (noite ? 0.12 : 0.45);
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i).normalize();
    const e = _v.y;
    if (e < 0) _c.copy(horizonte).lerp(baixo, suave(0, -0.12, e));
    else if (e < 0.32) _c.copy(horizonte).lerp(meio, suave(0.0, 0.32, e));
    else _c.copy(meio).lerp(topo, suave(0.32, 0.95, e));
    // brilho em volta do sol (ou da lua): largo e fraco + estreito e forte
    const d = Math.max(0, _v.dot(dirSol));
    const k = (Math.pow(d, 6) * 0.35 + Math.pow(d, 48) * 0.65) * brilho;
    if (k > 0) _c.lerp(_c2.copy(corSol), Math.min(1, k));
    cols[i * 3] = _c.r; cols[i * 3 + 1] = _c.g; cols[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const matCeu = guarda(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  const esfera = new THREE.Mesh(geo, matCeu);
  esfera.name = 'ceu';
  esfera.renderOrder = 1000;
  esfera.frustumCulled = false;
  const grupo = new THREE.Group(); grupo.name = 'ceu+luz';
  const ceu = new THREE.Group(); ceu.name = 'ceu';
  ceu.add(esfera);
  grupo.add(ceu);

  // ---------------------------------------------------------------- sol ou lua (disco), nuvens e estrelas — filhos do ceu (seguem a camera)
  const texDisco = guarda(texturaDisco(noite));
  const matDisco = guarda(new THREE.SpriteMaterial({ map: texDisco, color: noite ? 0xffffff : cor(sol.disco, '#fffbe8'), transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: noite ? THREE.NormalBlending : THREE.AdditiveBlending }));
  const disco = new THREE.Sprite(matDisco);
  disco.renderOrder = 1001;
  disco.position.copy(dirSol).multiplyScalar(0.8);
  const tam = sol.tamanho ?? (noite ? 0.09 : 0.16);
  disco.scale.set(tam, tam, 1);
  ceu.add(disco);

  let nuvens = null;
  const nNuvens = Math.round((tema.nuvens ?? 1) * NUVENS);
  if (nNuvens > 0) {
    const gN = guarda(geometriaNuvem(cor(C.nuvem, noite ? '#5a6488' : '#ffffff'), cor(C.nuvemBaixo, noite ? '#2c3352' : '#c9d6e6')));
    const mN = guarda(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false, depthWrite: false }));
    nuvens = new THREE.InstancedMesh(gN, mN, nNuvens);
    nuvens.name = 'nuvens';
    nuvens.frustumCulled = false;
    // DEPOIS do ceu: a nuvem nao escreve profundidade, entao desenhada antes o ceu (que pinta onde o z-buffer esta vazio) a apagaria;
    // os solidos da frente ja escreveram profundidade e a tapam como devem
    nuvens.renderOrder = 1002;
    const r = gerador(opcoes.semente ?? 1234);
    for (let k = 0; k < nNuvens; k++) {
      const a = r() * Math.PI * 2, dist = NUVEM_DIST[0] + r() * (NUVEM_DIST[1] - NUVEM_DIST[0]), alt = NUVEM_ALT[0] + r() * (NUVEM_ALT[1] - NUVEM_ALT[0]);
      _v.set(Math.cos(a) * dist, alt, Math.sin(a) * dist);
      const esc = (0.035 + r() * 0.05) * (1 + dist * 0.4);
      _s.set(esc * (1.4 + r()), esc, esc * (1 + r() * 0.6));
      _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r() * Math.PI * 2);
      _m.compose(_v, _q, _s);
      nuvens.setMatrixAt(k, _m);
    }
    ceu.add(nuvens);
  }

  let estrelas = null;
  if (noite) {
    const r = gerador(99), pos = new Float32Array(ESTRELAS * 3), cE = new Float32Array(ESTRELAS * 3);
    for (let k = 0; k < ESTRELAS; k++) {
      const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92);
      pos[k * 3] = Math.cos(a) * Math.cos(e) * 0.97; pos[k * 3 + 1] = Math.sin(e) * 0.97; pos[k * 3 + 2] = Math.sin(a) * Math.cos(e) * 0.97;
      const b = 0.55 + r() * 0.45; cE[k * 3] = b; cE[k * 3 + 1] = b; cE[k * 3 + 2] = Math.min(1, b * 1.1);
    }
    const gE = guarda(new THREE.BufferGeometry());
    gE.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    gE.setAttribute('color', new THREE.BufferAttribute(cE, 3));
    const mE = guarda(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false, depthWrite: false }));
    estrelas = new THREE.Points(gE, mE);
    estrelas.frustumCulled = false;
    estrelas.renderOrder = 1001;
    ceu.add(estrelas);
  }

  // ---------------------------------------------------------------- luzes
  const H = tema.hemi || {};
  const hemi = new THREE.HemisphereLight(cor(H.ceu, '#dfefff'), cor(H.chao, '#6a7a5a'), H.forca ?? 1.4);
  const direcional = new THREE.DirectionalLight(cor(sol.cor, '#fff4dc'), sol.forca ?? 2.6);
  direcional.position.copy(dirSol).multiplyScalar(600);
  direcional.target.position.set(0, 0, 0);
  grupo.add(hemi, direcional, direcional.target);

  // ---------------------------------------------------------------- neblina
  const N = tema.neblina || {};
  const neblina = new THREE.Fog(cor(N.cor ?? C.horizonte, '#d8efff'), N.perto ?? 200, N.longe ?? 1400);
  const longeTema = N.longe ?? 1400, pertoTema = N.perto ?? 200;
  G.cena.fog = neblina;
  G.cena.background = cor(N.cor ?? C.horizonte, '#d8efff');

  /** Neblina pela qualidade: a `distancia` do nivel (450/700/1000 m) vira o "longe" com folga de 1,6x (na BAIXA o cenario some
   *  mais cedo e a placa desenha menos), sem nunca passar do longe do tema. */
  function aplicaQualidade(p) {
    const lim = p && p.distancia ? p.distancia * 1.6 : longeTema;
    neblina.far = Math.min(longeTema, lim);
    neblina.near = Math.min(pertoTema, neblina.far * 0.3);
  }
  aplicaQualidade(G.qualidade && G.qualidade.p);

  let t = 0;
  function quadro(dt, camera) {
    t += dt;
    if (!camera) return;
    const R = (camera.far || 2500) * FATOR_DO_FAR;
    ceu.position.copy(camera.position);
    ceu.scale.setScalar(R);
    // as nuvens andam devagar em volta (o ceu parado parece pintura)
    if (nuvens) nuvens.rotation.y = t * 0.004;
  }

  function destroi() {
    for (const d of descartaveis) d.dispose();
    if (nuvens) nuvens.dispose();
    if (G.cena && G.cena.fog === neblina) G.cena.fog = null;
  }

  return { grupo, hemi, sol: direcional, neblina, quadro, aplicaQualidade, destroi, dirSol };
}
