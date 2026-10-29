// VITRINE 3D (fase 6): a cena dos menus — o carro escolhido girando numa plataforma de exposicao (menu e selecao de carro) e o PODIO
// com os tres primeiros carros de verdade (resultado e fim de campeonato). Enquanto ativa, G.desenho = { cena, camera } dela; a
// corrida tem a sua (docs/CONTRATOS.md secao 1).
//
// DECISOES:
//   * os carros vem de criaModeloCarro (o mesmo GLB da corrida, ja no cache): a vitrine NUNCA da dispose em geometria ou material
//     deles — sao compartilhados com a corrida (aviso do js/modelo_carro.js). So o que a vitrine cria (plataforma, podio, confete,
//     ceu, texturas de canvas) e dela para destruir;
//   * um clone por carro, guardado num Map: deslizar para tras e para frente na selecao nao clona de novo;
//   * pedido com FICHA (`_pedido`): a crianca desliza tres carros num segundo e o GLB do primeiro chega por ultimo — so o ultimo pedido
//     aparece;
//   * o carro fica onde a tela manda (`alvoX`, fracao da largura): na selecao a ficha ocupa a direita, entao o carro vai para a
//     esquerda pelo setViewOffset — a camera nao gira, o carro nao entorta;
//   * nada de sombra de verdade (o mapa de sombra e o item mais caro do quadro no celular): uma mancha escura em textura de canvas
//     embaixo do carro basta para ele "pisar" na plataforma;
//   * fundo, chao e confete com toneMapped = false: a cor e a da paleta, nao a que o ACES do renderer inventaria.
import * as THREE from 'three';
import { criaModeloCarro } from './modelo_carro.js';
import { corCSS } from './minimapa.js';

/** Altura da plataforma giratoria (m) e raio. O carro normalizado tem ~4,2 m (fase 1): 3 m de raio sobra meio metro em volta. */
const ALTURA_DA_PLATAFORMA = 0.32;
const RAIO_DA_PLATAFORMA = 3.0;
/** Giro automatico (rad/s): uma volta a cada ~13 s — devagar o bastante para ler o carro, rapido o bastante para parecer vivo. */
const GIRO = 0.48;
/** Podio: [x, altura] de 1o, 2o, 3o — o classico, 1o no meio e mais alto. */
const DEGRAUS = [[0, 1.5], [-4.3, 1.0], [4.3, 0.62]];
const LARGURA_DO_DEGRAU = 4.1;
/** Confete: quantos papeizinhos (1 draw call so). */
const CONFETES = 260;
const CORES_DO_CONFETE = [0xff4f8b, 0xffd23a, 0x3fd7ff, 0x7cff6b, 0xb07cff, 0xff8a2a];
/** Lampadas em volta da plataforma (o letreiro de feira que pisca em sequencia). */
const LAMPADAS = 28;

/** Aspecto (largura/altura) para o qual o ENQUADRAMENTO foi ajustado: o celular deitado (Pixel 7 2,04; iPhone 14 1,70 sem as barras;
 *  Galaxy S8 2,06). Tela mais quadrada afasta a camera (ver _enquadra). */
const ASPECTO_DE_REFERENCIA = 2.05;
/** Enquadramento por modo: distancia e altura da camera, para onde ela olha, campo de visao e onde o assunto fica na tela. */
const ENQUADRAMENTO = {
  menu: { dist: 10.6, alt: 3.1, olhaY: 0.95, fov: 30, alvoX: 0.73, alvoY: 0.52 },
  selecao: { dist: 11.4, alt: 3.2, olhaY: 1.0, fov: 30, alvoX: 0.28, alvoY: 0.5 },
  podio: { dist: 22.5, alt: 5.4, olhaY: 2.0, fov: 30, alvoX: 0.28, alvoY: 0.62 },
};

function texturaDeCanvas(w, h, desenha) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  desenha(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Vitrine {
  constructor(G) {
    this.G = G;
    this.cena = null;
    this.camera = null;
    this.ligada = false;
    this.modo = 'menu';
    this.t = 0;
    /** cfg.id -> Promise<modelo> (um clone por carro) */
    this._modelos = new Map();
    this._pedido = 0;
    this._atual = null;     // modelo na plataforma
    this._noPodio = [];     // modelos no podio
    this._giro = 0;
    this._empurrao = 0;     // giro extra do dedo
    this.carregando = false;
  }

  /** Liga: o laco passa a desenhar a vitrine. */
  ativa(modo) {
    if (!this.cena) this._monta();
    if (modo) this._modo(modo);
    this.ligada = true;
    this.G.desenho = { cena: this.cena, camera: this.camera };
    this._enquadra(true);
  }

  /** Desliga (so solta o G.desenho se ainda for o dela: a corrida pode ja ter posto o seu). */
  desativa() {
    this.ligada = false;
    if (this.G.desenho && this.G.desenho.cena === this.cena) this.G.desenho = null;
  }

  /** Carro na plataforma ('menu' ou 'selecao'). Resolve quando o carro aparece (ou quando outro pedido o substituiu). */
  async mostraCarro(cfg, modo = 'selecao') {
    if (!this.cena) this._monta();
    this._modo(modo);
    const ficha = ++this._pedido;
    if (!cfg) return null;
    this.carregando = true;
    let m;
    try { m = await this._modelo(cfg); } catch (e) { this.carregando = false; console.error('[vitrine] carro nao carregou: ' + cfg.id, e); return null; }
    if (ficha !== this._pedido) return null; // outro carro foi pedido depois deste
    this.carregando = false;
    if (this._atual && this._atual !== m) this._prato.remove(this._atual.grupo);
    this._atual = m;
    m.grupo.position.set(0, ALTURA_DA_PLATAFORMA, 0);
    m.grupo.rotation.set(0, 0, 0);
    m.grupo.scale.setScalar(1);
    this._prato.add(m.grupo);
    this._mancha.visible = true;
    this._pulo = 0.35; // o carro "assenta" na plataforma ao trocar (desenho animado)
    return m;
  }

  /** Podio com ate 3 carros (cfgs na ordem 1o, 2o, 3o). `festa` = chuva de confete. */
  async mostraPodio(cfgs, festa = true) {
    if (!this.cena) this._monta();
    this._modo('podio');
    const ficha = ++this._pedido;
    this.carregando = true;
    const modelos = await Promise.all(cfgs.slice(0, 3).map((c) => (c ? this._modelo(c).catch((e) => { console.error('[vitrine] carro do podio nao carregou: ' + c.id, e); return null; }) : null)));
    if (ficha !== this._pedido) return null;
    this.carregando = false;
    for (const m of this._noPodio) if (m) this._podio.remove(m.grupo);
    this._noPodio = [];
    // o mesmo carro pode aparecer duas vezes no podio so se houver dois iguais na corrida — nao ha (um de cada); mesmo assim, clone
    const usados = new Set();
    modelos.forEach((m, k) => {
      if (!m) { this._noPodio.push(null); return; }
      let grupo = m.grupo;
      if (usados.has(grupo)) grupo = grupo.clone(true);
      usados.add(grupo);
      const [x, h] = DEGRAUS[k];
      grupo.position.set(x, h, 0.2);
      grupo.rotation.set(0, (k === 0 ? 0 : k === 1 ? 0.35 : -0.35), 0); // os de lado olham um pouco para o meio
      grupo.scale.setScalar(k === 0 ? 1 : 0.92);
      this._podio.add(grupo);
      this._noPodio.push({ grupo });
    });
    this._confete.visible = !!festa;
    if (festa) this._soltaConfete();
    return this._noPodio;
  }

  /** O dedo arrastando gira o carro (dx em pixels). */
  empurra(dx) { this._empurrao += dx * 0.012; }

  /** Um quadro de tela. */
  quadro(dt) {
    if (!this.ligada || !this.cena) return;
    const d = Math.min(0.1, Math.max(0, dt || 0));
    this.t += d;
    if (this.modo !== 'podio') {
      this._giro += GIRO * d + this._empurrao;
      this._empurrao *= 0.85;
      this._prato.rotation.y = this._giro;
      this._raios.rotation.z = this.t * 0.04;
      if (this._atual) {
        // assenta: cai 0,35 m com um quique curto
        if (this._pulo > 0) this._pulo = Math.max(0, this._pulo - d * 1.6);
        this._atual.grupo.position.y = ALTURA_DA_PLATAFORMA + Math.abs(Math.sin(this._pulo * 9)) * this._pulo * 0.9;
      }
    } else {
      // camera balanca devagar em volta do podio
      this._balanco = Math.sin(this.t * 0.45) * 0.22;
      this._atualizaConfete(d);
      if (this._facho) this._facho.material.opacity = 0.16 + 0.06 * Math.sin(this.t * 3);
    }
    this._piscaLampadas();
    this._enquadra(false);
  }

  /** Libera o que a vitrine criou (nunca a malha dos carros: e do cache). */
  destroi() {
    this.desativa();
    if (!this.cena) return;
    for (const o of this._seus) {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
    }
    this._seus.length = 0;
    this.cena = null;
  }

  // ------------------------------------------------------------ interno
  _modelo(cfg) {
    let p = this._modelos.get(cfg.id);
    if (!p) {
      p = criaModeloCarro(this.G, cfg);
      this._modelos.set(cfg.id, p);
      p.catch(() => this._modelos.delete(cfg.id));
    }
    return p;
  }

  _modo(modo) {
    this.modo = ENQUADRAMENTO[modo] ? modo : 'menu';
    if (!this.cena) return;
    const podio = this.modo === 'podio';
    this._palco.visible = !podio;
    this._podio.visible = podio;
    this._confete.visible = podio && this._confete.visible;
    this._enquadra(true);
  }

  /** Camera do modo + deslocamento lateral do assunto (setViewOffset) + aspecto da janela. */
  _enquadra(ja) {
    const cam = this.camera;
    if (!cam || typeof window === 'undefined') return;
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const e = ENQUADRAMENTO[this.modo];
    const aspecto = W / H;
    // tela mais estreita que o celular deitado (tablet 4:3, desktop 16:9): afasta na proporcao, para o assunto ocupar a MESMA fracao da
    // largura — a ficha e a tabela ocupam uma fracao fixa da tela, entao o palco tem de caber na fracao que sobra
    const longe = Math.max(1, ASPECTO_DE_REFERENCIA / aspecto);
    const ang = this.modo === 'podio' ? (this._balanco || 0) : 0.0;
    const dist = e.dist * longe;
    cam.fov = e.fov;
    cam.aspect = aspecto;
    cam.position.set(Math.sin(ang) * dist, e.alt * Math.min(longe, 1.3), Math.cos(ang) * dist);
    cam.lookAt(0, e.olhaY, 0);
    const dx = (0.5 - e.alvoX) * W, dy = (0.5 - e.alvoY) * H; // o assunto (centro da vista) aparece em alvoX/alvoY da tela
    const chave = W + 'x' + H + ':' + this.modo;
    if (ja || chave !== this._chave) {
      this._chave = chave;
      cam.setViewOffset(W, H, dx, dy, W, H);
    }
    cam.updateProjectionMatrix();
  }

  _monta() {
    const cena = new THREE.Scene();
    this.cena = cena;
    this._seus = [];
    const seu = (o) => { this._seus.push(o); return o; };
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);

    // ceu: esfera com degrade por cor de vertice (o setSky do Breno), sem textura e sem tonemapping
    const ceuG = new THREE.SphereGeometry(150, 32, 16);
    const cores = new Float32Array(ceuG.attributes.position.count * 3);
    const alto = new THREE.Color('#3a63d0'), meio = new THREE.Color('#2a4fb8'), baixo = new THREE.Color('#0b1630'), c = new THREE.Color();
    for (let i = 0; i < ceuG.attributes.position.count; i++) {
      const y = ceuG.attributes.position.getY(i) / 150;
      if (y > 0.05) c.copy(meio).lerp(alto, Math.min(1, (y - 0.05) * 2)); else c.copy(meio).lerp(baixo, Math.min(1, (0.05 - y) * 3.2));
      cores[i * 3] = c.r; cores[i * 3 + 1] = c.g; cores[i * 3 + 2] = c.b;
    }
    ceuG.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    const ceu = seu(new THREE.Mesh(ceuG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false })));
    ceu.renderOrder = -10;
    cena.add(ceu);

    // raios de luz atras (o "palco de TV" do menu): leque de triangulos claros, aditivo
    const raios = texturaDeCanvas(512, 512, (g, w, h) => {
      g.translate(w / 2, h / 2);
      for (let k = 0; k < 16; k++) {
        g.rotate((Math.PI * 2) / 16);
        const gr = g.createLinearGradient(0, 0, 0, -h / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.20)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -h / 2); g.lineTo(40, -h / 2); g.closePath(); g.fill();
      }
    });
    this._raios = seu(new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: raios, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, opacity: 0.55 })));
    this._raios.position.set(0, 4, -40);
    cena.add(this._raios);

    // luzes: ceu/chao + sol quente na frente + contraluz azul (recorta o carro do fundo)
    cena.add(new THREE.HemisphereLight(0xe8f2ff, 0x2a3a66, 1.5));
    const sol = new THREE.DirectionalLight(0xfff1dc, 3.1); sol.position.set(6, 9, 8); cena.add(sol);
    const contra = new THREE.DirectionalLight(0x8fb8ff, 2.2); contra.position.set(-7, 5, -8); cena.add(contra);
    const lado = new THREE.DirectionalLight(0xffd6a8, 0.9); lado.position.set(-9, 2, 4); cena.add(lado);

    // chao: disco com brilho no meio
    const chaoT = texturaDeCanvas(512, 512, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#3550a8'); gr.addColorStop(0.35, '#1d2f6e'); gr.addColorStop(1, 'rgba(11,22,48,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const chao = seu(new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ map: chaoT, transparent: true, depthWrite: false, toneMapped: false })));
    chao.rotation.x = -Math.PI / 2;
    cena.add(chao);

    // PALCO (menu/selecao): plataforma giratoria + lampadas + mancha
    this._palco = new THREE.Group();
    cena.add(this._palco);
    const pratoT = texturaDeCanvas(512, 512, (g, w, h) => {
      const r = w / 2;
      g.translate(r, r);
      for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? '#ffd23a' : '#ff7a1a'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (k / 24) * Math.PI * 2, ((k + 1) / 24) * Math.PI * 2); g.closePath(); g.fill(); }
      g.fillStyle = '#10204a'; g.beginPath(); g.arc(0, 0, r * 0.86, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b3478'; g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,250,240,.18)'; g.lineWidth = 6;
      for (const f of [0.6, 0.4]) { g.beginPath(); g.arc(0, 0, r * f, 0, Math.PI * 2); g.stroke(); }
    });
    const pratoMat = seu(new THREE.MeshStandardMaterial({ map: pratoT, roughness: 0.55, metalness: 0.1 }));
    const ladoMat = seu(new THREE.MeshStandardMaterial({ color: 0x10204a, roughness: 0.6, metalness: 0.2 }));
    const prato = seu(new THREE.Mesh(new THREE.CylinderGeometry(RAIO_DA_PLATAFORMA, RAIO_DA_PLATAFORMA * 1.06, ALTURA_DA_PLATAFORMA, 64), [ladoMat, pratoMat, ladoMat]));
    prato.position.y = ALTURA_DA_PLATAFORMA / 2;
    this._prato = new THREE.Group();
    this._prato.add(prato);
    this._palco.add(this._prato);
    // mancha embaixo do carro (sombra barata)
    const manchaT = texturaDeCanvas(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this._mancha = seu(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.6), new THREE.MeshBasicMaterial({ map: manchaT, transparent: true, depthWrite: false, toneMapped: false })));
    this._mancha.rotation.x = -Math.PI / 2;
    this._mancha.position.y = ALTURA_DA_PLATAFORMA + 0.01;
    this._mancha.visible = false;
    this._prato.add(this._mancha);
    // lampadas em volta (InstancedMesh: 1 draw call) — a cor de cada uma muda em sequencia
    const lampG = seu(new THREE.SphereGeometry(0.11, 10, 8));
    this._lampadas = seu(new THREE.InstancedMesh(lampG, new THREE.MeshBasicMaterial({ toneMapped: false }), LAMPADAS));
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < LAMPADAS; k++) {
      const a = (k / LAMPADAS) * Math.PI * 2;
      m4.makeTranslation(Math.cos(a) * RAIO_DA_PLATAFORMA * 1.07, ALTURA_DA_PLATAFORMA * 0.55, Math.sin(a) * RAIO_DA_PLATAFORMA * 1.07);
      this._lampadas.setMatrixAt(k, m4);
      this._lampadas.setColorAt(k, new THREE.Color(0xfff2b0));
    }
    this._palco.add(this._lampadas);
    this._corAcesa = new THREE.Color(0xfff2b0);
    this._corApagada = new THREE.Color(0x7a5a20);
    this._fase = -1;

    // PODIO: tres degraus com o numero na frente
    this._podio = new THREE.Group();
    this._podio.visible = false;
    cena.add(this._podio);
    const corDoDegrau = ['#ffd23a', '#cfd8e8', '#e39a5b'];
    DEGRAUS.forEach(([x, h], k) => {
      const frente = texturaDeCanvas(256, 256, (g, w, hh) => {
        g.fillStyle = corDoDegrau[k]; g.fillRect(0, 0, w, hh);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, hh * 0.86, w, hh * 0.14);
        g.font = '900 170px "Bungee", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 16; g.strokeStyle = '#10204a'; g.strokeText(String(k + 1), w / 2, hh * 0.5);
        g.fillStyle = '#fffaf0'; g.fillText(String(k + 1), w / 2, hh * 0.5);
      });
      const matF = seu(new THREE.MeshStandardMaterial({ map: frente, roughness: 0.5 }));
      const matL = seu(new THREE.MeshStandardMaterial({ color: new THREE.Color(corDoDegrau[k]).multiplyScalar(0.8), roughness: 0.5 }));
      const bloco = seu(new THREE.Mesh(new THREE.BoxGeometry(LARGURA_DO_DEGRAU, h, 4), [matL, matL, matL, matL, matF, matL]));
      bloco.position.set(x, h / 2, 0);
      this._podio.add(bloco);
    });
    // facho de luz sobre o 1o lugar (cone aberto, aditivo)
    const fachoG = seu(new THREE.CylinderGeometry(0.6, 3.2, 12, 32, 1, true));
    this._facho = seu(new THREE.Mesh(fachoG, new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })));
    this._facho.position.set(0, 1.5 + 6, 0.2);
    this._podio.add(this._facho);

    // CONFETE: Points com um quadradinho arredondado
    const papel = texturaDeCanvas(32, 32, (g) => { g.fillStyle = '#fff'; g.beginPath(); if (g.roundRect) g.roundRect(6, 9, 20, 14, 4); else g.rect(6, 9, 20, 14); g.fill(); });
    const pos = new Float32Array(CONFETES * 3), cor = new Float32Array(CONFETES * 3);
    this._velConfete = new Float32Array(CONFETES * 3);
    const cc = new THREE.Color();
    for (let k = 0; k < CONFETES; k++) { cc.set(CORES_DO_CONFETE[k % CORES_DO_CONFETE.length]); cor[k * 3] = cc.r; cor[k * 3 + 1] = cc.g; cor[k * 3 + 2] = cc.b; pos[k * 3 + 1] = -50; }
    const cg = seu(new THREE.BufferGeometry());
    cg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    cg.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    this._confete = seu(new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.42, map: papel, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false, toneMapped: false })));
    this._confete.frustumCulled = false;
    this._confete.visible = false;
    cena.add(this._confete);
    this._modo(this.modo);
  }

  _soltaConfete() {
    // sorteio de ENFEITE: gerador proprio (nao o Math.random semeado da bateria nem o G.sorteio da jogabilidade)
    let s = 0x51ed27 >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const p = this._confete.geometry.attributes.position.array, v = this._velConfete;
    for (let k = 0; k < CONFETES; k++) {
      p[k * 3] = (r() - 0.5) * 16; p[k * 3 + 1] = 6 + r() * 12; p[k * 3 + 2] = (r() - 0.5) * 6;
      v[k * 3] = (r() - 0.5) * 0.6; v[k * 3 + 1] = -(1.2 + r() * 1.6); v[k * 3 + 2] = r() * 6.28;
    }
    this._confete.geometry.attributes.position.needsUpdate = true;
  }

  _atualizaConfete(d) {
    if (!this._confete.visible) return;
    const p = this._confete.geometry.attributes.position.array, v = this._velConfete;
    for (let k = 0; k < CONFETES; k++) {
      const i = k * 3;
      v[i + 2] += d * 3;
      p[i] += (v[i] + Math.sin(v[i + 2]) * 0.8) * d;
      p[i + 1] += v[i + 1] * d;
      if (p[i + 1] < 0) p[i + 1] += 18; // recicla em cima: festa sem fim, sem alocar
    }
    this._confete.geometry.attributes.position.needsUpdate = true;
  }

  _piscaLampadas() {
    if (!this._lampadas || !this._palco.visible) return;
    const fase = Math.floor(this.t * 6) % 4;
    if (fase === this._fase) return;
    this._fase = fase;
    for (let k = 0; k < LAMPADAS; k++) this._lampadas.setColorAt(k, (k % 4) === fase ? this._corApagada : this._corAcesa);
    this._lampadas.instanceColor.needsUpdate = true;
  }
}

export { corCSS };
