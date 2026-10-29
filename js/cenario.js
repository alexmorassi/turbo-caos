// CENARIO DAS PISTAS (fase 3): o TERRENO que abraca a pista, a agua ou a lava, o chao ate o horizonte, as silhuetas de fundo (morros,
// serras, a cidade) e os objetos de cada tema (palmeiras, casinhas, cactos, pinheiros...) instanciados em blocos.
//
// O TERRENO E UMA GRADE DE 8 m "AJUSTADA" A PISTA. Cada tema da um relevo base B(x, z) (praia e mar, morro, dunas, serra nevada...)
// e a pista o corrige com dois envelopes, calculados das amostras da pista a cada 2 m:
//   * L (aterro): o chao nao fica mais baixo que (asfalto - inclinacao x distancia) — a pista que sobe ganha um morro por baixo, a
//     reta alta ganha um talude; trecho ELEVADO (ponte, rampa, loop) nao segura chao nenhum;
//   * U (corte): o chao nao passa do asfalto numa faixa de 10 m de cada lado (acostamento) e depois sobe no maximo na inclinacao —
//     a pista que entra no morro corta o morro. 10 m e MAIOR que a diagonal da celula (11,3 m): o triangulo do chao que toca a borda
//     nunca tem um vertice alto o bastante para furar o asfalto (o defeito classico de grade sob estrada).
// O chao fica 30 cm abaixo do asfalto; a fita da pista tem SAIA ate o chao (js/visual_pista.js usa `altura()`, que interpola os mesmos
// triangulos desenhados), entao nao sobra fresta. Debaixo de cada VAO o U cava um fosso: a agua/lava do tema enche o buraco.
//
// OS OBJETOS sao do jeito do Breno (js/models.js de la, a linguagem aprovada pelo Morassi): pecas simples (caixa, cilindro, cone,
// icosaedro) mescladas numa geometria so, com COR DE VERTICE e normais planas — low-poly "fofo", sem textura. Cada tipo vira um
// InstancedMesh POR BLOCO de 280 m (o InstancedMesh tem uma esfera de culling so: um por pista inteira nunca sairia da tela — armadilha
// do dinotrails-web), todos com o MESMO material (Lambert com cor de vertice): troca de estado zero entre eles.
// QUALIDADE: as instancias de cada bloco ficam em ordem sorteada; a densidade do nivel (0,4 / 0,7 / 1) vira `count` — a BAIXA desenha
// 40% de cada bloco sem refazer nada (o evento 'qualidade:muda' so mexe no count e na neblina).
// Nada de Math.random: cada pista tem o seu gerador com semente (o cenario sai igual sempre — a foto de hoje compara com a de ontem).
import * as THREE from 'three';

// ================================================================ sorteio, ruido e utilidades
/** mulberry32 com semente: o espalhamento do cenario. */
export function gerador(semente) {
  let a = semente >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.entre = (x, y) => x + (y - x) * f();
  f.escolhe = (l) => l[Math.floor(f() * l.length) % l.length];
  return f;
}
/** Semente de uma pista pelo id (o cenario de cada pista e sempre o mesmo, e diferente das outras). */
export function sementeDe(texto) { let h = 2166136261; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function hash2(i, j, s) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
/** Ruido de valor 2D em [0, 1). */
export function ruido(x, z, s = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
/** Soma de oitavas, em [-1, 1] mais ou menos. */
export function fbm(x, z, oitavas = 4, s = 0) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let k = 0; k < oitavas; k++) { v += (ruido(x * f, z * f, s + k * 17) * 2 - 1) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}
export const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
export const cor = (v, padrao = '#ffffff') => new THREE.Color(v ?? padrao);

// ================================================================ pecas low-poly (o Parts do Breno)
const BASES = new Map();
/** Geometrias base nao indexadas (as normais sao refeitas planas na mescla). Todas com a BASE em y = 0, salvo 'caixaC' e 'esfera'. */
function base(nome) {
  let g = BASES.get(nome);
  if (g) return g;
  switch (nome) {
    case 'caixa': g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); break;
    case 'caixaC': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cil4': g = new THREE.CylinderGeometry(1, 1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0); break;
    case 'cil5': g = new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0); break;
    case 'cil6': g = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0); break;
    case 'cil8': g = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0); break;
    case 'cil12': g = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0); break;
    case 'tronco6': g = new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0); break;
    case 'cone4': g = new THREE.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0); break;
    case 'cone5': g = new THREE.CylinderGeometry(0, 1, 1, 5).translate(0, 0.5, 0); break;
    case 'cone6': g = new THREE.CylinderGeometry(0, 1, 1, 6).translate(0, 0.5, 0); break;
    case 'cone8': g = new THREE.CylinderGeometry(0, 1, 1, 8).translate(0, 0.5, 0); break;
    case 'cone12': g = new THREE.CylinderGeometry(0, 1, 1, 12).translate(0, 0.5, 0); break;
    case 'esfera': g = new THREE.SphereGeometry(1, 8, 6); break;
    case 'esferaL': g = new THREE.SphereGeometry(1, 12, 8); break;
    case 'meiaEsfera': g = new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2); break;
    case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
    case 'ico1': g = new THREE.IcosahedronGeometry(1, 1); break;
    case 'dodeca': g = new THREE.DodecahedronGeometry(1, 0); break;
    case 'toro': g = new THREE.TorusGeometry(1, 0.08, 4, 24); break;
    case 'plano': g = new THREE.PlaneGeometry(1, 1); break;
    default: throw new Error('peca desconhecida: ' + nome);
  }
  g = g.index ? g.toNonIndexed() : g;
  BASES.set(nome, g);
  return g;
}

const _pe = new THREE.Euler(), _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
/** Monta um objeto por pecas e mescla tudo numa BufferGeometry com cor de vertice e normais planas. `cor` pode ser uma funcao
 *  (x, y, z) -> cor, avaliada no centro de cada triangulo (o listrado do tronco da palmeira, o degrade da rocha). */
export class Pecas {
  constructor() { this.lista = []; this.tf = null; }
  add(g, c, p = [0, 0, 0], s = 1, r = null) {
    _pe.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, (r && r[3]) || 'XYZ'); _pq.setFromEuler(_pe);
    if (typeof s === 'number') _ps.set(s, s, s); else _ps.set(s[0], s[1], s[2]);
    const m = new THREE.Matrix4().compose(_pp.set(p[0], p[1], p[2]), _pq, _ps);
    if (this.tf) m.premultiply(this.tf);
    this.lista.push({ g: typeof g === 'string' ? base(g) : g, c, m });
    return this;
  }
  /** cilindro/cone (base y=0) esticado de `a` ate `b` */
  seg(g, c, a, b, r, r2 = r) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(_UP, d.normalize());
    const m = new THREE.Matrix4().compose(A, q, new THREE.Vector3(r, L, r2));
    if (this.tf) m.premultiply(this.tf);
    this.lista.push({ g: typeof g === 'string' ? base(g) : g, c, m });
    return this;
  }
  /** aplica uma transformacao a tudo que `fn` acrescentar */
  em(p, r, s, fn) {
    _pe.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _pq.setFromEuler(_pe);
    if (typeof s === 'number') _ps.set(s, s, s); else _ps.set(s[0], s[1], s[2]);
    const m = new THREE.Matrix4().compose(_pp.set(p[0], p[1], p[2]), _pq, _ps), velho = this.tf;
    this.tf = velho ? velho.clone().multiply(m) : m;
    fn(this);
    this.tf = velho;
    return this;
  }
  geo() {
    let n = 0; for (const it of this.lista) n += it.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const c = new THREE.Color(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    let o = 0;
    for (const it of this.lista) {
      const P = it.g.attributes.position, cnt = P.count, fn = typeof it.c === 'function', inv = it.m.determinant() < 0;
      // cor nula: a geometria ja vem pintada (um objeto pronto da biblioteca reaproveitado como peca)
      const fonte = it.c == null ? it.g.attributes.color : null;
      if (!fn && !fonte) c.set(it.c);
      for (let t = 0; t + 2 < cnt; t += 3) {
        if (fn) c.set(it.c((P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3));
        const i0 = t, i1 = inv ? t + 2 : t + 1, i2 = inv ? t + 1 : t + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(it.m); b.fromBufferAttribute(P, i1).applyMatrix4(it.m); d.fromBufferAttribute(P, i2).applyMatrix4(it.m);
        e1.subVectors(b, a); e2.subVectors(d, a); e1.cross(e2).normalize();
        for (const [k, v] of [[0, a], [1, b], [2, d]]) {
          const j = (o + t + k) * 3;
          if (fonte) { const iv = k === 0 ? i0 : k === 1 ? i1 : i2; c.setRGB(fonte.getX(iv), fonte.getY(iv), fonte.getZ(iv)); }
          pos[j] = v.x; pos[j + 1] = v.y; pos[j + 2] = v.z; nor[j] = e1.x; nor[j + 1] = e1.y; nor[j + 2] = e1.z;
          col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b;
        }
      }
      o += cnt;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ================================================================ o relevo base de cada tema
/** Relevos base: cada um recebe os parametros de `tema.terreno` e devolve B(x, z). O relevo FORTE fica longe da pista (os envelopes
 *  da pista mandam perto dela); `borda(x, z)` (0 na borda da grade) achata tudo no nivel do chao do horizonte. */
const RELEVOS = {
  /** praia: terra a -X, areia de `areia` ate `agua` (em x), mar fundo depois */
  litoral(p) {
    const areia = p.areia ?? 9, agua = p.agua ?? 80, fundo = p.fundo ?? -7, amp = p.ruido ?? 3;
    const f = (x, z) => {
      const dx = x - areia;
      if (dx > 0) {
        const t = dx / (agua - areia);
        if (t <= 1) return -0.15 - 0.9 * suave(0, 1, t) + 0.15 * fbm(x / 30, z / 30, 2, 3);
        return Math.max(fundo, -1.05 - (dx - (agua - areia)) * 0.07);
      }
      // a cidade nunca desce abaixo do mar (senao a agua aparece em pocas na beira da pista)
      const dentro = suave(0, 220, -dx);
      return 0.25 + amp * (fbm(x / 170, z / 170, 4, 1) * 0.5 + 0.5) * dentro + 26 * suave(380, 700, -dx) * (0.6 + fbm(x / 260, z / 260, 3, 5));
    };
    // alem da grade: o fundo do mar do lado do mar, o chao do horizonte do lado da terra (nada de faixa de terra no meio do mar)
    f.longe = (x) => (x > areia ? fundo : null);
    f.planoLonge = { xMax: areia + 2 };
    return f;
  },
  /** chao quase plano com colinas suaves */
  colinas(p) {
    const amp = p.ruido ?? 6, esc = p.escala ?? 220, nivel = p.nivel ?? 0;
    return (x, z) => nivel + amp * fbm(x / esc, z / esc, 4, p.sem ?? 2);
  },
  plano(p) { const nivel = p.nivel ?? 0, amp = p.ruido ?? 0.4; return (x, z) => nivel + amp * fbm(x / 90, z / 90, 2, 4); },
  /** o MORRO da favela: um morrao em volta do ponto mais alto da pista (a pista sobe nele) e um vizinho menor */
  morro(p, { amostras }) {
    let topo = amostras[0];
    for (const a of amostras) if (a.y > topo.y) topo = a;
    const H = topo.y * 1.05 + 6, R = p.raio ?? 230, amp = p.ruido ?? 4;
    return (x, z) => {
      const d = Math.hypot(x - topo.x, z - topo.z);
      return amp * fbm(x / 60, z / 60, 3, 8) + H * Math.exp(-(d / R) * (d / R)) + 22 * Math.exp(-((x - topo.x - 380) ** 2 + (z - topo.z + 260) ** 2) / (200 * 200));
    };
  },
  /** dunas: cristas em diagonal, assimetricas (subida suave, descida mais forte), torcidas pelo ruido */
  dunas(p) {
    const amp = p.ruido ?? 9, nivel = p.nivel ?? 0;
    return (x, z) => {
      const u = (x * 0.8 + z * 0.6) / 70 + 1.6 * fbm(x / 240, z / 240, 2, 6), f = u - Math.floor(u);
      const crista = f < 0.72 ? suave(0, 0.72, f) : 1 - suave(0.72, 1, f);
      return nivel + amp * (0.35 + 0.65 * crista) * (0.6 + 0.4 * fbm(x / 300, z / 300, 2, 7)) - amp * 0.3;
    };
  },
  /** serra nevada: colinas perto, montanhas subindo longe da pista; lagos congelados (circulos) achatados abaixo do gelo */
  neve(p, { amostras }) {
    const amp = p.ruido ?? 7, lagos = p.lagos || [];
    const cx = amostras.reduce((a, b) => a + b.x, 0) / amostras.length, cz = amostras.reduce((a, b) => a + b.z, 0) / amostras.length;
    let R = 0; for (const a of amostras) R = Math.max(R, Math.hypot(a.x - cx, a.z - cz));
    return (x, z) => {
      for (const l of lagos) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r) return -1.6 + 0.6 * suave(l.r * 0.7, l.r, d); }
      const d = Math.hypot(x - cx, z - cz);
      return amp * (fbm(x / 140, z / 140, 4, 11) * 0.5 + 0.5) + 70 * suave(R + 60, R + 320, d) * (0.55 + 0.45 * fbm(x / 120, z / 120, 3, 12));
    };
  },
  /** rocha vulcanica: chao aspero; lagos e rios de lava cavados (abaixo do nivel da lava) */
  vulcanico(p) {
    const amp = p.ruido ?? 6, lagos = p.lagos || [], rios = p.rios || [];
    return (x, z) => {
      let h = amp * fbm(x / 70, z / 70, 4, 13) + 2;
      for (const l of lagos) { const d = Math.hypot(x - l.x, z - l.z); h = Math.min(h, lerp(-6, h, suave(l.r * 0.75, l.r + 8, d))); }
      for (const r of rios) { const d = distPolilinha(x, z, r.pontos); h = Math.min(h, lerp(-6, h, suave(r.larg * 0.5, r.larg * 0.5 + 10, d))); }
      return h;
    };
  },
  /** selva: morros cobertos de mata, um rio cavado */
  selva(p) {
    const amp = p.ruido ?? 8, rios = p.rios || [];
    return (x, z) => {
      let h = amp * (fbm(x / 110, z / 110, 4, 14) * 0.5 + 0.5) + 18 * suave(0.2, 0.9, fbm(x / 400, z / 400, 2, 15));
      for (const r of rios) { const d = distPolilinha(x, z, r.pontos); h = Math.min(h, lerp(-5, h, suave(r.larg * 0.5, r.larg * 0.5 + 14, d))); }
      return h;
    };
  },
  /** cais: terra do lado de dentro (z < costa), mar fundo do lado de fora */
  cais(p) {
    const costa = p.costa ?? 20, fundo = p.fundo ?? -8;
    const f = (x, z) => (z < costa ? 0.4 + (p.ruido ?? 0.2) * fbm(x / 80, z / 80, 2, 16) : lerp(0.4, fundo, suave(costa, costa + 6, z)));
    f.longe = (x, z) => (z > costa ? fundo : null);
    f.planoLonge = { zMax: costa };
    return f;
  },
  /** canyon: planalto alto com ravinas; os abismos de verdade sao cavados pelos vaos e pontes (fosso/fossoPonte do tema) */
  canyon(p) {
    const amp = p.ruido ?? 5;
    return (x, z) => {
      const r = fbm(x / 160, z / 160, 3, 17);
      const ravina = suave(0.18, 0.02, Math.abs(r)) * 26;
      return amp * (fbm(x / 60, z / 60, 2, 18) * 0.5 + 0.5) - ravina + 10 * suave(0.3, 0.7, fbm(x / 300, z / 300, 2, 19));
    };
  },
};
/** distancia de (x, z) a uma polilinha [[x, z], ...] */
function distPolilinha(x, z, pts) {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return m;
}

/** Cores do chao por tema: (altura, inclinacao 0..1+, distancia a borda da pista, x, z, base) -> THREE.Color (escreve em `out`). */
const CORES_DO_CHAO = {
  litoral(p) {
    const grama = cor(p.cor, '#7dbb4f'), grama2 = cor(p.cor2, '#5e9e3e'), areia = cor(p.corAreia, '#f2dca2'), molhada = cor(p.corMolhada, '#cdb27a'), rocha = cor(p.corRocha, '#8f8a7c'), calcada = cor(p.corPerto, '#c9c4b5');
    const xAreia = p.areia ?? 9;
    return (out, h, incl, perto, x, z) => {
      const n = fbm(x / 23, z / 23, 2, 9) * 0.5 + 0.5;
      if (x > xAreia - 2 && h < 0.4) { out.copy(areia).lerp(molhada, suave(-0.45, -1.0, h)); out.multiplyScalar(0.94 + 0.08 * n); return out; }
      out.copy(grama).lerp(grama2, n * 0.8);
      out.lerp(rocha, suave(0.55, 1.1, incl));
      void calcada; void perto;
      return out;
    };
  },
  /** canyon: camadas horizontais de vermelho/laranja/creme nas encostas (o que faz o canyon parecer canyon) */
  canyon(p) {
    const faixas = [cor('#c8703f'), cor('#b25a32'), cor('#d99a62'), cor('#9a4426'), cor('#e0b07a')], topo = cor(p.cor, '#c8703f'), topo2 = cor(p.corAlto, '#d68a52');
    return (out, h, incl, perto, x, z) => {
      const n = fbm(x / 25, z / 25, 2, 9) * 0.5 + 0.5;
      if (incl < 0.45) return out.copy(topo).lerp(topo2, n).multiplyScalar(0.95 + 0.1 * n);
      const k = Math.floor((h + 60 + fbm(x / 50, z / 50, 2, 3) * 2) / 3.2) % faixas.length;
      return out.copy(faixas[(k + faixas.length) % faixas.length]).multiplyScalar(0.9 + 0.15 * n);
    };
  },
  /** neve: branco com sombra azulada nas encostas, pedra escura onde e ingreme, gelo do lago */
  neve(p) {
    const neve = cor(p.cor, '#f4f8fc'), sombra = cor(p.cor2, '#dde8f2'), rocha = cor(p.corRocha, '#8e99a8'), gelo = cor('#bfe0f4');
    return (out, h, incl, perto, x, z) => {
      const n = fbm(x / 30, z / 30, 2, 9) * 0.5 + 0.5;
      if (h < -0.9) return out.copy(gelo);
      out.copy(neve).lerp(sombra, n * 0.7);
      return out.lerp(rocha, suave(0.7, 1.3, incl));
    };
  },
  generico(p) {
    const c1 = cor(p.cor, '#7dbb4f'), c2 = cor(p.cor2, '#5e9e3e'), rocha = cor(p.corRocha, '#8f8a7c'), perto = cor(p.corPerto, '#b8b09a'), alto = cor(p.corAlto ?? p.cor2, '#5e9e3e');
    const nA = p.nivelAlto ?? 30;
    return (out, h, incl, dPerto, x, z) => {
      const n = fbm(x / 25, z / 25, 2, 9) * 0.5 + 0.5;
      out.copy(c1).lerp(c2, n * 0.85);
      out.lerp(alto, suave(nA * 0.5, nA, h));
      void perto; void dPerto;
      out.lerp(rocha, suave(0.6, 1.2, incl));
      return out;
    };
  },
};

// ================================================================ o terreno
/** Celula da grade (m) e margem alem da pista (m). Ver o cabecalho para o 8 e o 10 do acostamento. */
const CEL = 8, MARGEM = 320, TILE = 56;
/** Influencia da pista no chao: raio de busca (m), profundidade do chao sob o asfalto (m), acostamento (m) e folga sob trecho elevado. */
const INFLUENCIA = 84, SOB_O_ASFALTO = 0.3, ACOSTAMENTO = 10, MARGEM_ATERRO = 1.5, ESPESSURA = 0.9, FOLGA_ELEVADO = 0.8;
/** Profundidade do fosso debaixo dos vaos (m): o carro que cai tem de SUMIR no buraco, nao pousar num gramado. */
const FOSSO = 7;
/** Celula da grade espacial das amostras (m). */
const CEL_HASH = 24;

/** Grade espacial das amostras da pista (x, z): perguntas "o que ha perto daqui" sem varrer a pista toda. */
export class GradeDeAmostras {
  constructor(lista) {
    this.mapa = new Map();
    for (const a of lista) { const k = this._k(Math.floor(a.x / CEL_HASH), Math.floor(a.z / CEL_HASH)); let l = this.mapa.get(k); if (!l) this.mapa.set(k, (l = [])); l.push(a); }
  }
  _k(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  /** chama fn(a) para toda amostra nas celulas que cobrem o circulo (x, z, r) */
  perto(x, z, r, fn) {
    const i0 = Math.floor((x - r) / CEL_HASH), i1 = Math.floor((x + r) / CEL_HASH), j0 = Math.floor((z - r) / CEL_HASH), j1 = Math.floor((z + r) / CEL_HASH);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = this.mapa.get(this._k(i, j)); if (l) for (const a of l) fn(a); }
  }
  /** distancia horizontal (m) do ponto ate a BORDA da pista mais perto (negativa dentro dela); `max` se nao houver pista ate la */
  borda(x, z, max = 80) {
    let m = max;
    this.perto(x, z, max, (a) => { const d = Math.hypot(x - a.x, z - a.z) - a.hw; if (d < m) m = d; });
    return m;
  }
}

export class Terreno {
  /** amostras: [{ x, y, z, tx, tz, rx, ry, rz, hw, ny, elev, vao }] (js/visual_pista.js coletaAmostras, a cada 2 m) */
  constructor(pista, amostras, tema) {
    const T = tema.terreno || {};
    this.tema = tema;
    this.parametros = T;
    this.relevo = (RELEVOS[T.tipo] || RELEVOS.colinas)(T, { amostras, pista });
    this.colore = (CORES_DO_CHAO[T.cores || T.tipo] || CORES_DO_CHAO.generico)(T);
    this.kL = T.aterro ?? 0.6;   // inclinacao maxima do talude (m por m)
    this.kU = T.corte ?? 0.75;   // inclinacao maxima do corte
    this.fosso = T.fosso ?? FOSSO;
    // ponte: quanto o chao fica abaixo da laje (6 m: a agua/lava cabe embaixo; no canyon e o abismo de 20+ m)
    this.fossoPonte = T.fossoPonte ?? 6;
    this.margemAterro = T.margemAterro ?? MARGEM_ATERRO;
    this.nivelFundo = T.nivelFundo ?? (T.nivel ?? 0) - 0.4;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const a of amostras) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); z0 = Math.min(z0, a.z); z1 = Math.max(z1, a.z); }
    this.x0 = Math.floor((x0 - MARGEM) / CEL) * CEL; this.z0 = Math.floor((z0 - MARGEM) / CEL) * CEL;
    this.nx = Math.ceil((x1 + MARGEM - this.x0) / CEL) + 1; this.nz = Math.ceil((z1 + MARGEM - this.z0) / CEL) + 1;
    this.x1 = this.x0 + (this.nx - 1) * CEL; this.z1 = this.z0 + (this.nz - 1) * CEL;
    this.grade = new GradeDeAmostras(amostras);
    this.H = new Float32Array(this.nx * this.nz);
    this.perto = new Float32Array(this.nx * this.nz);
    this._calcula();
  }

  /** relevo base achatado na borda da grade (encontra o chao do horizonte sem degrau) */
  base(x, z) {
    const b = Math.min(x - this.x0, this.x1 - x, z - this.z0, this.z1 - z);
    const k = suave(0, 90, b);
    const alvo = (this.relevo.longe && this.relevo.longe(x, z)) ?? this.nivelFundo;
    return alvo + (this.relevo(x, z) - alvo) * k;
  }

  _calcula() {
    const { nx, nz, kL, kU } = this;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = this.x0 + i * CEL, z = this.z0 + j * CEL;
        let L = -Infinity, U = Infinity, perto = INFLUENCIA;
        this.grade.perto(x, z, INFLUENCIA, (a) => {
          const dx = x - a.x, dz = z - a.z;
          if (a.elev || a.vao) {
            // trecho elevado: so EMPURRA o chao para baixo (a ponte nao segura morro); o vao cava o fosso, a ponte o vale
            const dist = Math.hypot(dx, dz), e = Math.max(0, dist - a.hwH - 2);
            const alvo = a.vao ? a.yMin - this.fosso : a.ponte ? a.yMin - this.fossoPonte : a.yMin - ESPESSURA - FOLGA_ELEVADO;
            const u = alvo + kU * e;
            if (u < U) U = u;
            const db = dist - a.hwH; if (db < perto) perto = db;
            return;
          }
          const lon = dx * a.tx + dz * a.tz, lat = dx * a.rhx + dz * a.rhz;
          const alat = Math.abs(lat);
          const fora = Math.max(0, Math.abs(lon) - 1.0);
          const latC = Math.max(-a.hwH, Math.min(a.hwH, lat));
          const alvo = a.y + a.ry * (latC / a.rh) - SOB_O_ASFALTO;
          const eL = Math.hypot(fora, Math.max(0, alat - a.hwH - this.margemAterro));
          const eU = Math.hypot(fora, Math.max(0, alat - a.hwH - ACOSTAMENTO));
          const l = alvo - kL * eL, u = alvo + kU * eU;
          if (l > L) L = l;
          if (u < U) U = u;
          const db = Math.hypot(fora, Math.max(0, alat - a.hwH)) * (alat > a.hwH || fora > 0 ? 1 : -1);
          if (db < perto) perto = db;
        });
        const B = this.base(x, z);
        let h = B;
        if (L > U) h = U; else { if (h < L) h = L; if (h > U) h = U; }
        this.H[j * nx + i] = h;
        this.perto[j * nx + i] = perto;
      }
    }
  }

  /** Altura do chao DESENHADO em (x, z): os mesmos triangulos da malha (diagonal de b para c). Fora da grade: o chao do horizonte. */
  altura(x, z) {
    const fx = (x - this.x0) / CEL, fz = (z - this.z0) / CEL;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return this.nivelFundo - 0.3;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, nx = this.nx, H = this.H;
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  /** Distancia a borda da pista mais perto (m) no vertice mais perto (barato, para o espalhamento). */
  pertoDaPista(x, z) {
    const i = Math.round((x - this.x0) / CEL), j = Math.round((z - this.z0) / CEL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return INFLUENCIA;
    return this.perto[j * this.nx + i];
  }
  inclinacao(x, z) { const e = 2; return Math.hypot(this.altura(x + e, z) - this.altura(x - e, z), this.altura(x, z + e) - this.altura(x, z - e)) / (2 * e); }

  /** As malhas do chao: TILE x TILE celulas cada (culling por pedaco), normais suaves da grade inteira (sem costura entre pedacos). */
  malhas(material) {
    const { nx, nz, H } = this, out = [];
    const N = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)], hd = H[Math.max(0, j - 1) * nx + i], hu = H[Math.min(nz - 1, j + 1) * nx + i];
      const ddx = (hr - hl) / (2 * CEL), ddz = (hu - hd) / (2 * CEL), inv = 1 / Math.hypot(ddx, 1, ddz);
      N[(j * nx + i) * 3] = -ddx * inv; N[(j * nx + i) * 3 + 1] = inv; N[(j * nx + i) * 3 + 2] = -ddz * inv;
    }
    const c = new THREE.Color();
    for (let tj = 0; tj < nz - 1; tj += TILE) for (let ti = 0; ti < nx - 1; ti += TILE) {
      const ni = Math.min(TILE, nx - 1 - ti) + 1, nj = Math.min(TILE, nz - 1 - tj) + 1;
      const pos = new Float32Array(ni * nj * 3), nor = new Float32Array(ni * nj * 3), col = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2);
      for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
        const gi = ti + i, gj = tj + j, k = j * ni + i, g = gj * nx + gi;
        const x = this.x0 + gi * CEL, z = this.z0 + gj * CEL, h = H[g];
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        nor[k * 3] = N[g * 3]; nor[k * 3 + 1] = N[g * 3 + 1]; nor[k * 3 + 2] = N[g * 3 + 2];
        const incl = Math.sqrt(Math.max(0, 1 / (N[g * 3 + 1] * N[g * 3 + 1]) - 1));
        this.colore(c, h, incl, this.perto[g], x, z, this);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        uv[k * 2] = x / 14; uv[k * 2 + 1] = z / 14;
      }
      const idx = [];
      for (let j = 0; j < nj - 1; j++) for (let i = 0; i < ni - 1; i++) {
        const a = j * ni + i, b = a + 1, cc = a + ni, d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.name = 'chao';
      m.matrixAutoUpdate = false;
      out.push(m);
    }
    return out;
  }
}

// ================================================================ texturas de canvas do cenario
function canvas(w, h, desenha) { const c = document.createElement('canvas'); c.width = w; c.height = h; desenha(c.getContext('2d'), w, h); return c; }
/** Textura de detalhe do chao (cinza em volta de 1): multiplica a cor de vertice e quebra o liso das celulas de 8 m. */
function texturaDetalhe(semente) {
  const c = canvas(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      // ruido periodico (ladrilha): soma de senos com fase sorteada + ruido de valor em toro
      const n = 0.5 * ruido((i / w) * 8, (j / h) * 8, semente) + 0.3 * ruido((i / w) * 24, (j / h) * 24, semente + 1) + 0.2 * ruido((i / w) * 64, (j / h) * 64, semente + 2);
      const v = Math.round(255 * (0.82 + 0.3 * n));
      const o = (j * w + i) * 4; d[o] = d[o + 1] = d[o + 2] = Math.min(255, v); d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Ondinhas claras sobre a cor da agua/lava (o floorTexture do Breno). */
function texturaOndas(lava) {
  const c = canvas(256, 256, (g) => {
    g.fillStyle = lava ? '#ff7a18' : '#ffffff'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = lava ? '#ffe27a' : 'rgba(255,255,255,1)';
    g.fillStyle = lava ? '#c8400c' : '#dbe9f2';
    if (!lava) { g.fillRect(0, 0, 256, 256); }
    const r = gerador(lava ? 5 : 7);
    g.lineCap = 'round';
    for (let k = 0; k < (lava ? 26 : 40); k++) {
      const x = r() * 256, y = r() * 256, L = 18 + r() * 34;
      g.lineWidth = lava ? 4 + r() * 5 : 2 + r() * 2;
      g.strokeStyle = lava ? (r() < 0.5 ? '#ffd35a' : '#ff9a2a') : 'rgba(255,255,255,0.95)';
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + L / 2, y + oy - 5, x + ox + L, y + oy); g.stroke(); }
    }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ================================================================ montagem do cenario
/** Tamanho do bloco de instancias (m): ver o cabecalho. */
const BLOCO = 280;

/** Monta o cenario. `amostras` e `grade` vem de js/visual_pista.js. Devolve { grupo, terreno, quadro, aplicaQualidade, destroi, conta }. */
export function montaCenario(G, pista, amostras, opcoes = {}) {
  const tema = pista.tema || {};
  const grupo = new THREE.Group(); grupo.name = 'cenario';
  const descartaveis = [], animados = [], blocos = [];
  const guarda = (x) => { descartaveis.push(x); return x; };
  const rng = gerador(sementeDe(pista.id || 'pista'));

  // ---------------------------------------------------------------- chao
  const terreno = new Terreno(pista, amostras, tema);
  const texDet = guarda(texturaDetalhe(3));
  const matChao = guarda(new THREE.MeshLambertMaterial({ vertexColors: true, map: texDet }));
  for (const m of terreno.malhas(matChao)) { guarda(m.geometry); grupo.add(m); }

  // CHAO DO HORIZONTE: um anel de 4 retangulos em VOLTA da grade (nao um plano por baixo dela: plano inteiro na altura da borda tapava
  // tudo o que a grade tem abaixo disso — a lava do vulcao, o lago congelado, o rio da selva; a primeira foto do vulcao saiu sem lava).
  // A borda da grade desce suave ate a altura deste anel (Terreno.base), entao a emenda nao aparece. No litoral e no cais o anel so
  // existe do lado da terra (o resto e o plano da agua).
  const T0 = tema.terreno || {};
  const corLonge = T0.corLonge ? cor(T0.corLonge) : cor(T0.cor, '#7dbb4f').lerp(cor(T0.cor2 ?? T0.cor, '#7dbb4f'), 0.4);
  const mLonge = guarda(new THREE.MeshLambertMaterial({ color: corLonge, map: texDet }));
  if (!T0.semChaoLonge) {
    const pl = terreno.relevo.planoLonge || {}, RL = 4500, e = 4;
    const cxL = (terreno.x0 + terreno.x1) / 2, czL = (terreno.z0 + terreno.z1) / 2;
    const X0 = cxL - RL, X1 = Math.min(cxL + RL, pl.xMax ?? Infinity), Z0 = czL - RL, Z1 = Math.min(czL + RL, pl.zMax ?? Infinity);
    const gx0 = terreno.x0 + e, gx1 = terreno.x1 - e, gz0 = terreno.z0 + e, gz1 = terreno.z1 - e;
    const pos = [], uv = [], nor = [];
    const ret = (ax, az, bx, bz) => {
      bx = Math.min(bx, X1); bz = Math.min(bz, Z1);
      if (bx - ax < 1 || bz - az < 1) return;
      const y = terreno.nivelFundo - 0.12;
      for (const [x, z] of [[ax, az], [ax, bz], [bx, bz], [ax, az], [bx, bz], [bx, az]]) { pos.push(x, y, z); uv.push(x / 14, z / 14); nor.push(0, 1, 0); }
    };
    ret(X0, Z0, gx0, Z1);          // oeste
    ret(gx1, Z0, X1, Z1);          // leste
    ret(gx0, Z0, gx1, gz0);        // sul
    ret(gx0, gz1, gx1, Z1);        // norte
    if (pos.length) {
      const gLonge = guarda(new THREE.BufferGeometry());
      gLonge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gLonge.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      gLonge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      gLonge.computeBoundingSphere();
      const longe = new THREE.Mesh(gLonge, mLonge);
      longe.name = 'chao-longe'; longe.matrixAutoUpdate = false;
      grupo.add(longe);
    }
  }

  // ---------------------------------------------------------------- agua / lava
  for (const tipo of ['agua', 'lava']) {
    const A = tema[tipo];
    if (!A) continue;
    const lava = tipo === 'lava';
    const tex = guarda(texturaOndas(lava));
    tex.repeat.set(9000 / (lava ? 30 : 40), 9000 / (lava ? 30 : 40));
    const mat = guarda(lava ? new THREE.MeshBasicMaterial({ map: tex, color: cor(A.cor, '#ffffff'), toneMapped: false })
      : new THREE.MeshLambertMaterial({ map: tex, color: cor(A.cor, '#1f9fd6'), emissive: cor(A.cor, '#1f9fd6').multiplyScalar(0.22) }));
    const g = guarda(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2));
    const m = new THREE.Mesh(g, mat);
    m.position.set((terreno.x0 + terreno.x1) / 2, A.nivel ?? -0.7, (terreno.z0 + terreno.z1) / 2);
    m.name = tipo;
    grupo.add(m);
    const vel = A.correnteza ?? (lava ? 0.012 : 0.006);
    animados.push((dt, t) => { tex.offset.x = t * vel; tex.offset.y = Math.sin(t * 0.3) * 0.01; if (lava) mat.color.setScalar(0.85 + 0.15 * Math.sin(t * 1.7)); });
  }

  // ---------------------------------------------------------------- objetos
  const matObj = guarda(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const matBrilho = guarda(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  // silhuetas de fundo: com luz (o sol desenha as faces) e SEM neblina — a cor ja vem misturada com a do horizonte (perspectiva aerea)
  const matFundo = guarda(new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
  const ctx = {
    G, pista, tema, terreno, amostras, rng, grupo, guarda, animados,
    grade: terreno.grade,
    materiais: { objeto: matObj, brilho: matBrilho, fundo: matFundo },
    /** instancia `geo` nos `itens` [{ x, y, z, ry, s (numero ou [sx,sy,sz]), cor }] em blocos de BLOCO m */
    instancia(nome, geo, itens, op = {}) {
      if (!itens.length) return;
      guarda(geo);
      const porBloco = new Map(), B = op.bloco || BLOCO;
      for (const it of itens) { const k = Math.floor(it.x / B) * 1000 + Math.floor(it.z / B); let l = porBloco.get(k); if (!l) porBloco.set(k, (l = [])); l.push(it); }
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), eixo = new THREE.Vector3(0, 1, 0);
      for (const lista of porBloco.values()) {
        // ordem sorteada: a qualidade BAIXA corta um pedaco aleatorio de cada bloco, nao "a metade do fim da pista"
        for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
        const im = new THREE.InstancedMesh(geo, op.material || (op.brilho ? matBrilho : matObj), lista.length);
        im.name = nome;
        lista.forEach((it, k) => {
          p.set(it.x, it.y, it.z); q.setFromAxisAngle(eixo, it.ry || 0);
          if (it.q) q.copy(it.q);
          if (typeof it.s === 'number') s.setScalar(it.s); else if (it.s) s.set(it.s[0], it.s[1], it.s[2]); else s.setScalar(1);
          m4.compose(p, q, s); im.setMatrixAt(k, m4);
          if (it.cor !== undefined) im.setColorAt(k, c.set(it.cor));
        });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        im.userData.cheia = lista.length;
        im.userData.fixo = !!op.fixo; // objeto que nao some na BAIXA (a arquibancada da largada, o guindaste que e o tema)
        grupo.add(im);
        blocos.push(im);
      }
    },
    /** malha unica (nao instanciada) com o material de objetos */
    malha(nome, geo, op = {}) { guarda(geo); const m = new THREE.Mesh(geo, op.material || (op.brilho ? matBrilho : matObj)); m.name = nome; m.matrixAutoUpdate = false; m.updateMatrix(); grupo.add(m); return m; },
    /** posicoes ao longo da pista: a cada ~`passo` m, a `dmin..dmax` m alem da BORDA, do `lado` (-1 esq, 1 dir, 0 os dois) */
    aoLado({ passo = 20, dmin = 4, dmax = 30, lado = 0, sup = null, folga = 3, s0 = null, s1 = null, jitter = 0.5, max = Infinity, aceita = null }) {
      const out = [];
      for (const S of pista.superficies) {
        if (sup !== null && S.id !== sup) continue;
        const L = S.comprimento, ini = s0 ?? 0, fim = s1 ?? L;
        const _p = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
        for (let s = ini; s < fim && out.length < max; s += passo * (1 - jitter / 2 + rng() * jitter)) {
          const ss = S.normaliza(s);
          S.quadro(ss, _T, _N, _R);
          if (_N.y < 0.8) continue; // nada do lado de loop, paredao ou saca-rolha
          const l = lado === 0 ? (rng() < 0.5 ? -1 : 1) : lado;
          const hw = S.larguraEm(ss) * 0.5;
          const d = (hw + dmin + rng() * (dmax - dmin)) * l;
          S.ponto(ss, 0, 0, _p);
          const rh = Math.hypot(_R.x, _R.z) || 1;
          const x = _p.x + (_R.x / rh) * d, z = _p.z + (_R.z / rh) * d;
          if (terreno.grade.borda(x, z, dmin + folga + 2) < folga) continue;
          // `sPista` e nao `s`: `s` e a ESCALA da instancia (um quiosque herdou o s = 300 m da pista e virou um predio de 3 km)
          const it = { x, z, y: terreno.altura(x, z), ry: Math.atan2(_T.x, _T.z), sPista: s, sup: S.id, lado: l, d };
          if (aceita && !aceita(it)) continue;
          out.push(it);
        }
      }
      return out;
    },
    /** posicoes soltas na grade inteira, entre `dmin` e `dmax` m da borda da pista */
    area({ n = 100, dmin = 12, dmax = 200, aceita = null, tentativas = 8 }) {
      const out = [];
      for (let k = 0; k < n * tentativas && out.length < n; k++) {
        const x = lerp(terreno.x0 + 40, terreno.x1 - 40, rng()), z = lerp(terreno.z0 + 40, terreno.z1 - 40, rng());
        const dp = terreno.grade.borda(x, z, Math.max(dmax, dmin + 1));
        if (dp < dmin || dp > dmax) continue;
        const it = { x, z, y: terreno.altura(x, z), ry: rng() * Math.PI * 2, dp };
        if (aceita && !aceita(it)) continue;
        out.push(it);
      }
      return out;
    },
    /** fundo: posicoes num anel em volta do centro da pista (silhuetas distantes) */
    anel({ n, r0, r1, a0 = 0, a1 = Math.PI * 2 }) {
      const cx = (terreno.x0 + terreno.x1) / 2, cz = (terreno.z0 + terreno.z1) / 2, out = [];
      for (let k = 0; k < n; k++) { const a = lerp(a0, a1, (k + rng()) / n), r = lerp(r0, r1, rng()); out.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a }); }
      return out;
    },
  };

  const estilo = tema.estilo || 'orla';
  const receita = RECEITAS[estilo] || RECEITAS.generico;
  receita(ctx);

  // ---------------------------------------------------------------- qualidade, quadro, fim
  function aplicaQualidade(p) {
    const k = p && p.densidadeCenario !== undefined ? p.densidadeCenario : 1;
    for (const im of blocos) im.count = im.userData.fixo ? im.userData.cheia : Math.max(0, Math.round(im.userData.cheia * k));
    ctx.distancia = p && p.distancia ? p.distancia : 1000;
  }
  aplicaQualidade(G.qualidade && G.qualidade.p);

  let t = 0, tCorte = 0;
  const _cam = new THREE.Vector3();
  function quadro(dt, camera) {
    t += dt;
    for (const a of animados) a(dt, t);
    // corte por distancia (o cull.js do Cidade Aberta, em pequeno): bloco que a neblina ja apagou nao vai para a placa
    tCorte -= dt;
    if (camera && tCorte <= 0) {
      tCorte = 0.25;
      camera.getWorldPosition(_cam);
      const lim = (ctx.distancia || 1000) * 1.7;
      for (const im of blocos) { const e = im.boundingSphere; if (e) im.visible = e.center.distanceTo(_cam) - e.radius < lim; }
    }
  }
  function destroi() {
    for (const d of descartaveis) if (d && d.dispose) d.dispose();
    for (const im of blocos) im.dispose();
  }
  function conta() { let tri = 0, chamadas = 0; grupo.traverse((o) => { if (!o.isMesh || !o.visible) return; const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tri += o.isInstancedMesh ? n * o.count : n; chamadas++; }); return { tri, chamadas }; }
  return { grupo, terreno, quadro, aplicaQualidade, destroi, conta, ctx };
}

// ================================================================ os objetos (geometrias por pecas)
/** Biblioteca de objetos low-poly. Cada um devolve uma BufferGeometry (base no chao em y = 0, frente +Z, ~tamanho real em m). */
export const OBJETOS = {
  palmeira(r = gerador(1), alt = 9) {
    const P = new Pecas(), H = alt;
    // tronco curvo em gomos (listrado claro/escuro, como o do Breno)
    let x = 0, y = 0;
    for (let k = 0; k < 4; k++) {
      const y2 = y + H / 4, x2 = x + 0.32 * (k / 4) * (k / 4) * 6;
      P.seg('tronco6', k % 2 ? '#a7794a' : '#8d6238', [x, y, 0], [x2, y2 + 0.05, 0], 0.32 - k * 0.04, 0.32 - k * 0.04);
      x = x2; y = y2;
    }
    P.add('esfera', '#6b4a2a', [x + 0.25, y - 0.3, 0.2], 0.32);
    P.add('esfera', '#6b4a2a', [x - 0.2, y - 0.35, -0.15], 0.3);
    // folhas: 8 laminas caidas em volta
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3, L = 3.6 + (k % 3) * 0.4;
      P.em([x, y + 0.1, 0], [0, -a, 0], 1, (Q) => {
        Q.add('cone4', k % 2 ? '#4fb548' : '#3f9c3c', [L * 0.45, -0.35, 0], [L * 0.5, 0.12, 0.7], [0, 0, -Math.PI / 2 - 0.38]);
      });
    }
    return P.geo();
  },
  guardaSol(cores = ['#ff4f6d', '#ffd23a']) {
    const P = new Pecas();
    P.seg('cil5', '#eeeeee', [0, 0, 0], [0, 2.4, 0], 0.05);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      P.em([0, 2.25, 0], [0, a, 0], 1, (Q) => Q.add('cone4', k % 2 ? cores[0] : cores[1], [0.55, 0, 0], [0.8, 0.45, 0.42], [0, 0, Math.PI / 2 + 0.55]));
    }
    return P.geo();
  },
  quiosque() {
    const P = new Pecas();
    P.add('caixa', '#f7f3e6', [0, 0, 0], [3, 2.4, 2.2]);
    P.add('caixa', '#2d7fd6', [0, 1.0, 1.12], [3.02, 0.5, 0.02]);
    P.add('cone4', '#e8402e', [0, 2.4, 0], [2.7, 1.0, 2.2]);
    P.add('cil6', '#ffffff', [0, 3.3, 0], [0.12, 0.6, 0.12]);
    return P.geo();
  },
  predio(r = gerador(2), andares = 12, corBase = '#f2efe6', corJanela = '#7aa3c4') {
    const P = new Pecas(), w = 14, d = 12, alt = 3;
    P.add('caixa', corBase, [0, 0, 0], [w, 3.2, d]);
    for (let k = 0; k < andares; k++) {
      const y = 3.2 + k * alt;
      P.add('caixa', corBase, [0, y, 0], [w, alt * 0.55, d]);
      P.add('caixa', corJanela, [0, y + alt * 0.55, 0], [w * 0.96, alt * 0.45, d * 0.96]);
    }
    P.add('caixa', '#d9d4c8', [0, 3.2 + andares * alt, 0], [w + 0.4, 0.6, d + 0.4]);
    P.add('caixa', '#c9c3b5', [w * 0.2, 3.8 + andares * alt, 0], [3, 2, 3]);
    return P.geo();
  },
  arbusto(c1 = '#56c24a', c2 = '#6fd65a') {
    const P = new Pecas();
    P.add('ico', c1, [0, 0.9, 0], [1.4, 1.1, 1.3]);
    P.add('ico', c2, [1.0, 0.65, 0.2], [0.85, 0.75, 0.8], [0.4, 0.3, 0]);
    P.add('ico', c1, [-0.9, 0.6, -0.1], [0.9, 0.7, 0.85], [0, 0.7, 0.3]);
    return P.geo();
  },
  arvore(c1 = '#4cae45', c2 = '#68c95a', tronco = '#7a5532') {
    const P = new Pecas();
    P.seg('tronco6', tronco, [0, 0, 0], [0, 3.2, 0], 0.35, 0.28);
    P.add('ico1', c1, [0, 4.6, 0], [2.6, 2.2, 2.5]);
    P.add('ico', c2, [1.2, 4.0, 0.6], [1.5, 1.3, 1.4], [0.3, 0.2, 0]);
    P.add('ico', c2, [-1.1, 4.3, -0.5], [1.4, 1.3, 1.4], [0, 0.5, 0.2]);
    return P.geo();
  },
  pedra(c = '#a9a294') {
    const P = new Pecas();
    P.add('dodeca', c, [0, 0.55, 0], [1.3, 0.85, 1.1], [0.3, 0.5, 0.1]);
    P.add('ico', c, [0.9, 0.3, 0.3], [0.6, 0.5, 0.55], [0.2, 0.1, 0.4]);
    return P.geo();
  },
  /** casinha da favela: tijolo pintado (a cor vem da instancia), janelas escuras, laje cinza com vergalhao e, as vezes, caixa d'agua.
   *  A base desce 3 m abaixo do chao: no morro a casa nunca fica com um lado no ar. */
  casa(andares = 1, caixa = false, w = 6, d = 6) {
    const P = new Pecas(), H = 2.9 * andares;
    P.add('caixa', '#ffffff', [0, -3, 0], [w, H + 3, d]);
    // janelas e porta: quadros finos colados nas faces (2 triangulos cada; a casa repete 1.500 vezes no morro)
    for (let k = 0; k < andares; k++) {
      const y = 1.5 + k * 2.9;
      for (const sx of [-0.22, 0.22]) { P.add('plano', '#2a2a30', [w * sx, y, d / 2 + 0.03], [1.1, 1.1, 1]); P.add('plano', '#2a2a30', [w * sx, y, -d / 2 - 0.03], [1.1, 1.1, 1], [0, Math.PI, 0]); }
      P.add('plano', '#2a2a30', [w / 2 + 0.03, y, 0], [1.1, 1.1, 1], [0, Math.PI / 2, 0]);
      P.add('plano', '#2a2a30', [-w / 2 - 0.03, y, 0], [1.1, 1.1, 1], [0, -Math.PI / 2, 0]);
    }
    P.add('plano', '#5a3a28', [0, 1.0, d / 2 + 0.04], [1.0, 2.0, 1]);
    P.add('caixa', '#b8b4ac', [0, H, 0], [w + 0.5, 0.3, d + 0.5]);
    if (!caixa) P.add('cil4', '#6a4a3a', [w / 2 - 0.3, H + 0.3, d / 2 - 0.3], [0.06, 0.9, 0.06]);
    if (caixa) { P.add('cil8', '#2f6fd6', [w * 0.2, H + 0.3, -d * 0.15], [0.8, 1.1, 0.8]); P.add('cil8', '#3a80e8', [w * 0.2, H + 1.4, -d * 0.15], [0.84, 0.12, 0.84]); }
    return P.geo();
  },
  poste(alt = 8, corLuz = null) {
    const P = new Pecas();
    P.add('cil5', '#6a6a70', [0, 0, 0], [0.13, alt, 0.13]);
    P.add('caixa', '#5a5a60', [0, alt - 0.6, 0], [1.6, 0.12, 0.12]);
    if (corLuz) P.add('esfera', corLuz, [0.7, alt - 0.75, 0], 0.28);
    return P.geo();
  },
  cacto() {
    const P = new Pecas(), v = '#4f9a48', v2 = '#3f8a3c';
    P.add('cil8', v, [0, 0, 0], [0.45, 4.4, 0.45]); P.add('esfera', v, [0, 4.4, 0], [0.45, 0.4, 0.45]);
    P.add('cil8', v2, [0.75, 1.6, 0], [0.32, 0.4, 0.32], [0, 0, Math.PI / 2]); P.add('cil8', v2, [0.95, 1.55, 0], [0.32, 1.8, 0.32]); P.add('esfera', v2, [0.95, 3.35, 0], 0.32);
    P.add('cil8', v2, [-0.7, 2.3, 0], [0.3, 0.35, 0.3], [0, 0, -Math.PI / 2]); P.add('cil8', v2, [-0.9, 2.25, 0], [0.3, 1.3, 0.3]); P.add('esfera', v2, [-0.9, 3.55, 0], 0.3);
    return P.geo();
  },
  mesa(c1 = '#c8703f', c2 = '#e0a46a') {
    const P = new Pecas();
    P.add('tronco6', (x, y) => (Math.floor((y + 1) * 4) % 2 ? c1 : c2), [0, 0, 0], [1, 1, 0.8]);
    P.add('cil6', c2, [0, 1, 0], [0.72, 0.02, 0.58]);
    return P.geo();
  },
  pinheiro(neve = true) {
    const P = new Pecas(), v = '#2f6a4a', v2 = '#2a5a40', b = '#ffffff';
    P.add('cil5', '#6a4a32', [0, 0, 0], [0.3, 1.6, 0.3]);
    for (const [y, r, h] of [[1.2, 2.4, 3.0], [3.0, 1.9, 2.6], [4.6, 1.3, 2.3]]) {
      P.add('cone8', v, [0, y, 0], [r, h, r]);
      if (neve) P.add('cone8', b, [0, y + h * 0.55, 0], [r * 0.5, h * 0.45, r * 0.5]); else P.add('cone8', v2, [0, y + h * 0.55, 0], [r * 0.5, h * 0.45, r * 0.5]);
    }
    return P.geo();
  },
  blocoDeGelo() {
    const P = new Pecas();
    P.add('caixaC', '#bfe6ff', [0, 0.8, 0], [1.9, 1.6, 1.5], [0.1, 0.4, 0.05]);
    P.add('caixaC', '#9fd4f4', [1.1, 0.5, 0.4], [1.0, 1.0, 0.9], [0.2, 0.9, 0.3]);
    return P.geo();
  },
  bonecoDeNeve() {
    const P = new Pecas();
    P.add('esferaL', '#ffffff', [0, 0.85, 0], 0.95); P.add('esferaL', '#ffffff', [0, 2.1, 0], 0.68); P.add('esferaL', '#ffffff', [0, 3.05, 0], 0.48);
    P.add('cone8', '#ff7a1a', [0, 3.05, 0.45], [0.09, 0.5, 0.09], [Math.PI / 2, 0, 0]);
    P.add('esfera', '#1b1b1b', [-0.17, 3.18, 0.4], 0.06); P.add('esfera', '#1b1b1b', [0.17, 3.18, 0.4], 0.06);
    P.add('cil8', '#1b1b1b', [0, 3.42, 0], [0.48, 0.08, 0.48]); P.add('cil8', '#1b1b1b', [0, 3.5, 0], [0.32, 0.5, 0.32]);
    P.add('caixa', '#e8321a', [0, 2.62, 0], [0.9, 0.18, 0.9]);
    return P.geo();
  },
  rochaVulcanica(brilho = false) {
    const P = new Pecas();
    const c = brilho ? '#ff7a1a' : '#2e2626';
    P.add('dodeca', c, [0, 0.7, 0], [1.4, 1.0, 1.2], [0.4, 0.6, 0.2]);
    P.add('ico', brilho ? '#ffd23a' : '#3a3030', [0.9, 0.4, 0.4], [0.7, 0.6, 0.6], [0.2, 0.1, 0.5]);
    return P.geo();
  },
  arvoreSeca(c = '#2a201c') {
    const P = new Pecas();
    P.seg('tronco6', c, [0, 0, 0], [0.2, 4.5, 0], 0.32, 0.18);
    P.seg('cil5', c, [0.1, 2.6, 0], [1.4, 4.0, 0.3], 0.12);
    P.seg('cil5', c, [0.15, 3.3, 0], [-1.2, 4.6, -0.3], 0.1);
    P.seg('cil5', c, [0.2, 4.2, 0], [0.6, 5.6, 0.8], 0.08);
    return P.geo();
  },
  arvoreGigante() {
    const P = new Pecas(), t = '#6a4a2c', v1 = '#2f7a2c', v2 = '#3f9a35', v3 = '#56b844';
    P.seg('tronco6', t, [0, 0, 0], [0, 11, 0], 1.0, 0.6);
    for (const a of [0, 2.1, 4.2]) P.seg('cone5', t, [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], [Math.cos(a) * 2.2, 0.2, Math.sin(a) * 2.2], 0.5, 0.1);
    P.add('ico1', v1, [0, 12.5, 0], [6.5, 3.4, 6.0]);
    P.add('ico', v2, [2.8, 13.8, 1.0], [3.6, 2.4, 3.4], [0.3, 0.4, 0]);
    P.add('ico', v3, [-2.5, 14.2, -1.2], [3.2, 2.2, 3.0], [0.1, 1.1, 0.2]);
    P.add('ico', v2, [0.5, 15.4, 0.2], [3.0, 2.0, 2.8], [0.5, 0.2, 0.3]);
    // cipos pendurados
    for (const [x, z, L] of [[3.5, 2, 6], [-4, 1, 5], [1, -4.5, 7], [-1.5, 4.8, 4.5]]) { P.add('cil4', '#4a9a3a', [x, 12 - L, z], [0.07, L, 0.07]); P.add('esfera', '#ff6fa8', [x, 12 - L, z], 0.22); }
    return P.geo();
  },
  florGigante(c1 = '#ff6fa8', c2 = '#ffb3d1') {
    const P = new Pecas();
    P.seg('cil5', '#48a83e', [0, 0, 0], [0.1, 2.4, 0], 0.09);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.add('esfera', i % 2 ? c1 : c2, [Math.cos(a) * 0.55 + 0.1, 2.5, Math.sin(a) * 0.55], [0.45, 0.12, 0.3], [0, -a, 0]); }
    P.add('esfera', '#ffd23f', [0.1, 2.56, 0], [0.3, 0.18, 0.3]);
    return P.geo();
  },
  /** predio escuro (Neon): corpo + janelas (as janelas vao numa malha a parte, de brilho) */
  predioEscuro() { const P = new Pecas(); P.add('caixa', '#ffffff', [0, 0, 0], [1, 1, 1]); return P.geo(); },
  /** janelas de um predio unitario (1 x 1 x 1, escalado pela instancia): faixas acesas nas quatro faces + a faixa neon do topo */
  janelas(r = gerador(5), andares = 14, colunas = 6, cores = ['#ffe9a8', '#9fe8ff', '#ffd0f0', '#ffffff']) {
    const P = new Pecas();
    // um quadro por janela acesa (2 triangulos): o predio de 20 andares x 6 colunas x 4 faces sai com ~400 triangulos, nao 5 mil
    const faces = [[0, 0.502, 0], [0, -0.502, Math.PI], [0.502, 0, Math.PI / 2], [-0.502, 0, -Math.PI / 2]];
    for (let k = 0; k < andares; k++) {
      const y = (k + 0.5) / andares, h = 0.5 / andares;
      for (let c = 0; c < colunas; c++) {
        const u = -0.5 + (c + 0.5) / colunas, w = 0.55 / colunas;
        for (const [fx, fz, ry] of faces) {
          if (r() < 0.4) continue;
          const px = fx !== 0 ? fx : u, pz = fz !== 0 ? fz : u;
          P.add('plano', r.escolhe(cores), [px, y, pz], [w, h, 1], [0, ry, 0]);
        }
      }
    }
    P.add('caixaC', '#ff2bd6', [0, 0.985, 0.505], [1.0, 0.012, 0.012]); P.add('caixaC', '#22e6ff', [0, 0.985, -0.505], [1.0, 0.012, 0.012]);
    P.add('caixaC', '#22e6ff', [0.505, 0.985, 0], [0.012, 0.012, 1.0]); P.add('caixaC', '#ff2bd6', [-0.505, 0.985, 0], [0.012, 0.012, 1.0]);
    return P.geo();
  },
  conteiner() {
    const P = new Pecas(), L = 12, H = 2.6, Wd = 2.45;
    P.add('caixa', '#ffffff', [0, 0, 0], [L, H, Wd]);
    // nervuras: quadros finos (2 triangulos) — o porto empilha ~1.800 conteineres e com caixas eram 450 mil triangulos
    for (let k = 0; k < 6; k++) { const x = -L / 2 + 1 + k * (L - 2) / 5; P.add('plano', '#b4b4b4', [x, H / 2, Wd / 2 + 0.02], [0.35, H - 0.3, 1]); P.add('plano', '#b4b4b4', [x, H / 2, -Wd / 2 - 0.02], [0.35, H - 0.3, 1], [0, Math.PI, 0]); }
    P.add('plano', '#5a5a5a', [L / 2 + 0.02, H / 2, 0], [Wd - 0.3, H - 0.3, 1], [0, Math.PI / 2, 0]);
    return P.geo();
  },
  guindaste(c = '#ffb020') {
    const P = new Pecas(), H = 32, A = 14;
    for (const [x, z] of [[-A / 2, -5], [A / 2, -5], [-A / 2, 5], [A / 2, 5]]) P.add('caixa', c, [x, 0, z], [1.2, H, 1.2]);
    P.add('caixa', c, [0, H - 2, -5], [A + 1.2, 2, 1.2]); P.add('caixa', c, [0, H - 2, 5], [A + 1.2, 2, 1.2]);
    P.add('caixa', c, [0, H, 0], [3.5, 2.2, 52]);
    P.add('caixa', '#e8321a', [0, H - 1.5, -6], [3.2, 3, 3.6]);
    P.add('caixa', '#3a3a3a', [0, H - 9, 14], [0.12, 9, 0.12]); P.add('caixa', '#3a3a3a', [0, H - 10, 14], [2.4, 0.6, 1.0]);
    for (const [x, z] of [[-A / 2, 0], [A / 2, 0]]) P.add('caixa', c, [x, H * 0.45, z], [0.6, 0.6, 10]);
    return P.geo();
  },
  navio(casco = '#1f4f8a') {
    const P = new Pecas(), L = 70, Wd = 13;
    P.add('caixa', casco, [0, -4, 0], [L, 7, Wd]);
    P.add('cone4', casco, [L / 2 + 5, -4, 0], [Wd * 0.72, 7, Wd * 0.72], [0, 0, 0]);
    P.add('caixa', '#c0302a', [0, -4.2, 0], [L + 0.1, 1.2, Wd + 0.1]);
    P.add('caixa', '#f4f4f0', [-L / 2 + 8, 3, 0], [10, 9, Wd - 1]);
    P.add('caixa', '#2a3a4a', [-L / 2 + 8, 10.5, 0], [10.2, 1.2, Wd - 0.6]);
    P.add('cil8', '#1b1b1b', [-L / 2 + 6, 12, 0], [1.2, 5, 1.2]);
    const cores = ['#e8321a', '#2d7fd6', '#39b54a', '#ffb020', '#f2f2f2'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P.add('caixa', cores[(i * 3 + j) % 5], [-L / 2 + 22 + i * 11, 3, -Wd / 2 + 2.2 + j * 4.3], [10.5, 2.6 + (i % 2) * 2.6, 3.9]);
    return P.geo();
  },
  armazem() {
    const P = new Pecas();
    P.add('caixa', '#d8d0c0', [0, 0, 0], [40, 9, 22]);
    P.add('cil4', '#8a2a24', [0, 9, 0], [28.5, 22.2, 4], [Math.PI / 2, 0, 0]);
    P.add('caixa', '#5a5a5a', [0, 0, 11.05], [8, 6, 0.1]);
    return P.geo();
  },
  farol() {
    const P = new Pecas();
    P.add('tronco6', (x, y) => (Math.floor(y * 6) % 2 ? '#e8321a' : '#ffffff'), [0, 0, 0], [2.2, 18, 2.2]);
    P.add('cil8', '#2a2a2a', [0, 18, 0], [1.8, 0.4, 1.8]); P.add('cil8', '#ffe9a8', [0, 18.4, 0], [1.3, 2, 1.3]); P.add('cone8', '#e8321a', [0, 20.4, 0], [1.6, 1.6, 1.6]);
    return P.geo();
  },
  pinaculo(c1 = '#c8703f', c2 = '#e0a46a') {
    const P = new Pecas();
    P.add('tronco6', c1, [0, 0, 0], [2.4, 5, 2.4]); P.add('tronco6', c2, [0, 5, 0], [1.7, 4, 1.7]); P.add('tronco6', c1, [0, 9, 0], [1.2, 3.5, 1.2]); P.add('dodeca', '#9a4426', [0, 13.2, 0], [1.9, 1.0, 1.7]);
    return P.geo();
  },
  arquibancada(r = gerador(9), comp = 40) {
    const P = new Pecas();
    const pessoas = ['#ff4f8b', '#ffd23a', '#3fd7ff', '#7cff6b', '#b07cff', '#ff8a2a', '#ffffff', '#e8321a'];
    for (let k = 0; k < 6; k++) {
      P.add('caixa', k % 2 ? '#d8d8e0' : '#c0c0cc', [0, k * 0.9, -k * 1.2], [comp, 0.9, 1.2]);
      for (let i = 0; i < comp / 1.1; i++) if (r() < 0.8) P.add('caixa', r.escolhe(pessoas), [-comp / 2 + 0.6 + i * 1.1, k * 0.9 + 0.9, -k * 1.2], [0.5, 0.7, 0.5]);
    }
    P.add('caixa', '#3a3a50', [0, 0, -7.4], [comp, 6.5, 0.4]);
    for (const x of [-comp / 2, 0, comp / 2]) P.add('caixa', '#e8e8f0', [x, 0, -7.2], [0.4, 9, 0.4]);
    P.add('caixa', '#ff2b8a', [0, 9, -3.6], [comp + 2, 0.4, 8.5], [0.12, 0, 0]);
    return P.geo();
  },
  balao() {
    const P = new Pecas();
    P.add('esferaL', '#ffffff', [0, 0, 0], [1.6, 1.9, 1.6]);
    P.add('cone8', '#ffffff', [0, -2.3, 0], [0.35, 0.6, 0.35], [Math.PI, 0, 0]);
    P.add('cil4', '#f0f0f0', [0, -9, 0], [0.03, 7, 0.03]);
    return P.geo();
  },
  tenda(c1 = '#e8321a', c2 = '#ffffff') {
    const P = new Pecas();
    P.add('cil12', (x, y, z) => (Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 6)) % 2 ? c1 : c2), [0, 0, 0], [7, 4, 7]);
    P.add('cone12', (x, y, z) => (Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 6)) % 2 ? c1 : c2), [0, 4, 0], [7.6, 5, 7.6]);
    P.add('cil4', '#ffe14a', [0, 9, 0], [0.08, 2.5, 0.08]); P.add('caixa', '#ffe14a', [0.6, 10.6, 0], [1.2, 0.7, 0.05]);
    return P.geo();
  },
  /** Silhueta de morro arredondado (Pao de Acucar, morros da cidade): domo alto de icosaedro esticado, verde em cima e rocha cinza */
  morroPao(verde = '#4c8a4a', rocha = '#7d7f84') {
    const P = new Pecas();
    // verde no topo e na barra de baixo (a mata da encosta), pedra nua no meio — o Pao de Acucar e os morros do Rio
    const c = (x, y, z) => (y > 0.62 || y < -0.05 || (Math.abs(x) + Math.abs(z)) % 0.7 < 0.18 ? verde : rocha);
    P.add('ico1', c, [0, 0, 0], [1, 1, 0.9]);
    return P.geo();
  },
};

// ================================================================ as receitas de cada tema
const RECEITAS = {
  // ---------------------------------------------------------------- 2 FAVELA
  favela(ctx) {
    const { rng, terreno, tema } = ctx;
    const hz = (tema.neblina || {}).cor || '#f3dcb8';
    const cores = ['#ff6b5a', '#ffd23a', '#3fc6ff', '#7cd65a', '#ff8fd8', '#f2a04a', '#ffffff', '#b07cff', '#5ad6c0', '#ff4f6d', '#f7e08a'];
    const casas = ctx.area({ n: 1500, dmin: 6, dmax: 150, aceita: (it) => terreno.inclinacao(it.x, it.z) < 1.5 })
      .concat(ctx.aoLado({ passo: 9, dmin: 3, dmax: 12, folga: 2.5 }));
    const geos = [OBJETOS.casa(1, false), OBJETOS.casa(2, true), OBJETOS.casa(3, false, 6, 7), OBJETOS.casa(2, false, 7, 5), OBJETOS.casa(1, true, 5, 5)];
    geos.forEach((g, k) => ctx.instancia('casa', g, casas.filter((_, i) => i % geos.length === k).map((it) => ({
      ...it, ry: Math.round(it.ry / (Math.PI / 2)) * (Math.PI / 2) + rng.entre(-0.12, 0.12), s: rng.entre(0.85, 1.2), cor: rng.escolhe(cores) }))));
    const postes = ctx.aoLado({ passo: 26, dmin: 1.6, dmax: 2.2, lado: 1, folga: 1, jitter: 0.08 }).concat(ctx.aoLado({ passo: 26, dmin: 1.6, dmax: 2.2, lado: -1, folga: 1, jitter: 0.08 }));
    ctx.instancia('poste', OBJETOS.poste(8.5), postes.map((it) => ({ ...it, ry: it.ry + (it.lado > 0 ? 0 : Math.PI), s: 1 })), { fixo: true, bloco: 700 });
    montaFios(ctx, postes, 8.2);
    ctx.instancia('palmeira', OBJETOS.palmeira(gerador(4), 7), ctx.area({ n: 60, dmin: 8, dmax: 150 }).map((it) => ({ ...it, s: rng.entre(0.7, 1.1) })));
    ctx.instancia('arvore', OBJETOS.arvore('#4f9a3a', '#6ab84a'), ctx.area({ n: 90, dmin: 10, dmax: 230 }).map((it) => ({ ...it, s: rng.entre(0.8, 1.4) })));
    // fundo: outros morros cobertos de casinhas (pontinhos coloridos)
    // morros ao longe cobertos de casinhas: icosaedro fino (detalhe 3), cada triangulo uma casa colorida ou mato
    // (verde com 1 casinha em cada 4 triangulos: com mais que isso o morro virava uma bola de mosaico na foto)
    const corDe = (x, y, z) => { const h = hash2(Math.round(x * 90), Math.round(z * 90), Math.round(y * 90)); return y < 0.12 ? azulaCor('#5e8a3a', 0.45, hz) : h < 0.25 ? azulaCor(cores[Math.floor(h * 97) % cores.length], 0.5, hz) : azulaCor(h < 0.6 ? '#6a9a42' : '#7f8f4a', 0.45, hz); };
    const geoMorro = new THREE.IcosahedronGeometry(1, 3);
    fundoEmAnel(ctx, { n: 11, r0: 950, r1: 1350, geo: () => { const P = new Pecas(); P.add(geoMorro, corDe, [0, 0, 0], 1); return P.geo(); }, escala: () => [220 + rng() * 160, 90 + rng() * 120, 200 + rng() * 140] });
    geoMorro.dispose();
  },

  // ---------------------------------------------------------------- 3 DESERTO
  deserto(ctx) {
    const { rng, tema } = ctx;
    const hz = (tema.neblina || {}).cor || '#f6e2bd';
    ctx.instancia('cacto', OBJETOS.cacto(), ctx.area({ n: 280, dmin: 6, dmax: 240 }).concat(ctx.aoLado({ passo: 45, dmin: 4, dmax: 14 })).map((it) => ({ ...it, s: rng.entre(0.8, 1.5) })));
    ctx.instancia('pedra', OBJETOS.pedra('#c08a58'), ctx.area({ n: 200, dmin: 5, dmax: 240 }).map((it) => ({ ...it, s: rng.entre(0.6, 2.4) })));
    ctx.instancia('arbusto', OBJETOS.arbusto('#a89448', '#8f7e3a'), ctx.area({ n: 160, dmin: 4, dmax: 200 }).map((it) => ({ ...it, s: rng.entre(0.4, 0.8) })));
    fundoEmAnel(ctx, { n: 16, r0: 1000, r1: 1550, geo: () => OBJETOS.mesa(azulaCor('#c8703f', 0.4, hz), azulaCor('#e8b27a', 0.4, hz)), escala: () => [150 + rng() * 220, 50 + rng() * 110, 150 + rng() * 200] });
  },

  // ---------------------------------------------------------------- 4 GELO
  gelo(ctx) {
    const { rng, tema } = ctx;
    const hz = (tema.neblina || {}).cor || '#e8f0f8';
    ctx.instancia('pinheiro', OBJETOS.pinheiro(true), ctx.area({ n: 560, dmin: 6, dmax: 240 }).concat(ctx.aoLado({ passo: 14, dmin: 3, dmax: 18 })).map((it) => ({ ...it, s: rng.entre(0.8, 1.7) })));
    ctx.instancia('gelo', OBJETOS.blocoDeGelo(), ctx.aoLado({ passo: 40, dmin: 2, dmax: 10 }).concat(ctx.area({ n: 60, dmin: 5, dmax: 120 })).map((it) => ({ ...it, s: rng.entre(0.7, 1.8) })));
    ctx.instancia('boneco', OBJETOS.bonecoDeNeve(), ctx.aoLado({ passo: 170, dmin: 3, dmax: 6 }).map((it) => ({ ...it, ry: it.ry + (it.lado > 0 ? Math.PI / 2 : -Math.PI / 2), s: 1 })), { fixo: true });
    ctx.instancia('pedra', OBJETOS.pedra('#9aa4b0'), ctx.area({ n: 90, dmin: 6, dmax: 200 }).map((it) => ({ ...it, s: rng.entre(0.6, 2.0) })));
    const serra = (i) => { const P = new Pecas(); P.add('cone6', azulaCor('#7a8796', 0.45, hz), [0, 0, 0], [1, 1, 1]); P.add('cone6', azulaCor('#ffffff', 0.25, hz), [0, 0.52, 0], [0.5, 0.49, 0.5]); return P.geo(); };
    fundoEmAnel(ctx, { n: 18, r0: 1050, r1: 1600, geo: serra, escala: () => [160 + rng() * 180, 200 + rng() * 260, 160 + rng() * 180] });
  },

  // ---------------------------------------------------------------- 5 VULCAO
  vulcao(ctx) {
    const { rng, tema, terreno } = ctx;
    const hz = (tema.neblina || {}).cor || '#f0a070';
    ctx.instancia('rocha', OBJETOS.rochaVulcanica(false), ctx.area({ n: 320, dmin: 5, dmax: 240, aceita: (it) => it.y > -2 }).map((it) => ({ ...it, s: rng.entre(0.6, 2.6) })));
    ctx.instancia('brasa', OBJETOS.rochaVulcanica(true), ctx.area({ n: 90, dmin: 5, dmax: 160, aceita: (it) => it.y > -3 && it.y < 0.5 }).map((it) => ({ ...it, s: rng.entre(0.5, 1.3) })), { brilho: true });
    ctx.instancia('arvore-seca', OBJETOS.arvoreSeca(), ctx.area({ n: 90, dmin: 6, dmax: 200, aceita: (it) => it.y > -1 }).map((it) => ({ ...it, s: rng.entre(0.8, 1.5) })));
    // o VULCAO: cone grande fumegando, cratera em brasa, rios de lava descendo a encosta
    const cx = (terreno.x0 + terreno.x1) / 2, cz = (terreno.z0 + terreno.z1) / 2;
    const vx = cx - 1250, vz = cz - 950;
    const V = new Pecas(), B = new Pecas();
    V.add('tronco6', azulaCor('#4a3430', 0.4, hz), [vx, -6, vz], [520, 420, 480]);
    V.add('tronco6', azulaCor('#2e2222', 0.3, hz), [vx + 600, -6, vz + 250], [300, 220, 280]);
    V.add('tronco6', azulaCor('#3a2a28', 0.35, hz), [vx - 700, -6, vz + 150], [340, 260, 300]);
    B.add('cil12', '#ff8a1a', [vx, 413, vz], [300, 2, 280]);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.4; B.seg('caixa', '#ff5a10', [vx + Math.cos(a) * 300, 405, vz + Math.sin(a) * 280], [vx + Math.cos(a) * 480, 40, vz + Math.sin(a) * 450], 12, 12); }
    for (let k = 0; k < 9; k++) V.add('ico1', azulaCor(k % 2 ? '#6a5a5a' : '#8a7a78', 0.25, hz), [vx + (rng() - 0.5) * 140, 470 + k * 70, vz + (rng() - 0.5) * 140 - k * 20], 90 + k * 22);
    ctx.malha('vulcao', V.geo(), { material: ctx.materiais.fundo });
    ctx.malha('vulcao-brasa', B.geo(), { brilho: true });
    fundoEmAnel(ctx, { n: 12, r0: 1200, r1: 1650, a0: Math.PI * 0.2, a1: Math.PI * 1.1, geo: () => OBJETOS.mesa(azulaCor('#3a2a28', 0.4, hz), azulaCor('#2a2020', 0.4, hz)), escala: () => [160 + rng() * 200, 90 + rng() * 160, 160 + rng() * 200] });
  },

  // ---------------------------------------------------------------- 6 SELVA
  selva(ctx) {
    const { rng, tema, terreno } = ctx;
    const hz = (tema.neblina || {}).cor || '#cfe8c8';
    const seco = (it) => it.y > -1.8;
    ctx.instancia('arvore-gigante', OBJETOS.arvoreGigante(), ctx.area({ n: 300, dmin: 7, dmax: 240, aceita: seco }).concat(ctx.aoLado({ passo: 30, dmin: 5, dmax: 16, aceita: seco })).map((it) => ({ ...it, s: rng.entre(0.7, 1.4) })));
    ctx.instancia('palmeira', OBJETOS.palmeira(gerador(6), 8), ctx.area({ n: 90, dmin: 6, dmax: 200, aceita: seco }).map((it) => ({ ...it, s: rng.entre(0.8, 1.2) })));
    ctx.instancia('arbusto', OBJETOS.arbusto('#3f9a35', '#5ab844'), ctx.aoLado({ passo: 9, dmin: 1.5, dmax: 10, aceita: seco }).concat(ctx.area({ n: 200, dmin: 4, dmax: 200, aceita: seco })).map((it) => ({ ...it, ry: rng() * 6.28, s: rng.entre(0.7, 1.6) })));
    for (const [c1, c2] of [['#ff6fa8', '#ffb3d1'], ['#ffb020', '#ffe14d'], ['#a66bff', '#d3b4ff']]) ctx.instancia('flor', OBJETOS.florGigante(c1, c2), ctx.aoLado({ passo: 80, dmin: 2, dmax: 9, aceita: seco }).map((it) => ({ ...it, s: rng.entre(0.9, 1.5) })));
    // a CACHOEIRA: paredao de pedra no comeco do rio, com a agua caindo (textura correndo) e espuma embaixo
    const rios = (tema.terreno && tema.terreno.rios) || [];
    if (rios.length) {
      const [ax, az] = rios[0].pontos[0], [bx, bz] = rios[0].pontos[1], L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L;
      const qx = ax + ux * 60, qz = az + uz * 60, ang = Math.atan2(ux, uz);
      const y0 = (tema.agua && tema.agua.nivel) ?? -2.5;
      const P = new Pecas();
      P.em([qx, y0 - 2, qz], [0, ang, 0], 1, (Q) => {
        Q.add('caixa', '#6a6a5a', [0, 0, -6], [70, 34, 12]);
        Q.add('dodeca', '#5a5a4a', [-30, 30, -6], [14, 10, 10]); Q.add('dodeca', '#5a5a4a', [28, 31, -5], [12, 9, 10]);
        Q.add('ico1', '#3f8f35', [-22, 35, -8], [16, 7, 10]); Q.add('ico1', '#3f8f35', [20, 35, -8], [14, 6, 10]);
        for (let k = 0; k < 7; k++) Q.add('esfera', '#ffffff', [-10 + k * 3.3, 1.5, 1.5], 2.2 + (k % 3));
      });
      ctx.malha('cachoeira-pedra', P.geo());
      const tex = ctx.guarda(new THREE.CanvasTexture(canvas(64, 256, (g) => {
        g.fillStyle = '#9fd8ee'; g.fillRect(0, 0, 64, 256);
        for (let k = 0; k < 40; k++) { g.fillStyle = k % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(200,240,255,0.9)'; g.fillRect((k * 23) % 64, (k * 37) % 256, 3 + (k % 4), 30 + (k % 5) * 12); }
      })));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
      const ag = ctx.guarda(new THREE.PlaneGeometry(26, 32));
      const am = new THREE.Mesh(ag, ctx.guarda(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
      am.position.set(qx + Math.sin(ang) * 0.3, y0 + 14, qz + Math.cos(ang) * 0.3); am.rotation.y = ang; am.name = 'cachoeira';
      ctx.grupo.add(am);
      ctx.animados.push((dt, t) => { tex.offset.y = t * 1.4; });
    }
    fundoEmAnel(ctx, { n: 14, r0: 1000, r1: 1500, geo: () => { const P = new Pecas(); P.add('ico1', (x, y) => azulaCor(y > 0.3 ? '#2f7a2c' : '#3f8f35', 0.5, hz), [0, 0, 0], 1); return P.geo(); }, escala: () => [260 + rng() * 200, 120 + rng() * 140, 240 + rng() * 160] });
  },

  // ---------------------------------------------------------------- 7 NEON
  neon(ctx) {
    const { rng } = ctx;
    // "noite de cinema" (o noite.js do Cidade Aberta: as criancas achavam tudo escuro e nao queriam jogar): predios azul-arroxeados,
    // nao pretos — a silhueta aparece contra o ceu e as janelas acesas fazem o resto
    const escuros = ['#3a3f78', '#4a3a78', '#33507a', '#56457a', '#2f3a66'];
    const predios = ctx.aoLado({ passo: 26, dmin: 8, dmax: 30, folga: 6, jitter: 0.25 }).concat(ctx.area({ n: 180, dmin: 18, dmax: 260 }));
    for (let k = 0; k < 3; k++) {
      const lista = predios.filter((_, i) => i % 3 === k).map((it) => {
        const w = rng.entre(14, 26), d = rng.entre(14, 26), h = rng.entre(24, 80) * (1 + k * 0.35);
        return { ...it, ry: it.ry + (rng() < 0.5 ? 0 : Math.PI / 2), s: [w, h, d], cor: rng.escolhe(escuros) };
      });
      // blocos de 520 m: sao 3 tipos x (corpo + janelas) — com 280 m a largada da Neon desenhava 70 malhas so de predio
      ctx.instancia('predio', OBJETOS.predioEscuro(), lista, { bloco: 520 });
      ctx.instancia('janelas', OBJETOS.janelas(gerador(30 + k), 12 + k * 5, 5 + k), lista.map((it) => ({ ...it, cor: undefined })), { brilho: true, bloco: 520 });
    }
    const postes = ctx.aoLado({ passo: 34, dmin: 1.6, dmax: 2, folga: 1, jitter: 0.1 });
    // o braco do poste (+X local) aponta para a pista: do lado direito isso e o proprio rumo, do esquerdo o rumo + 180
    ctx.instancia('poste', OBJETOS.poste(9), postes.map((it) => ({ ...it, ry: it.ry + (it.lado > 0 ? 0 : Math.PI) })), { fixo: true, bloco: 700 });
    ctx.instancia('luz', (() => { const P = new Pecas(); P.add('esfera', '#bff6ff', [0.7, 8.25, 0], 0.32); return P.geo(); })(), postes.map((it) => ({ ...it, ry: it.ry + (it.lado > 0 ? 0 : Math.PI) })), { brilho: true, fixo: true, bloco: 700 });
    arcosSobreAPista(ctx, { passo: 120, cores: ['#ff2bd6', '#22e6ff', '#ffe14a'] });
    // skyline ao longe: torres escuras pontilhadas de janelas acesas (sem luz e sem neblina: a noite deixa so o brilho)
    const P = new Pecas();
    for (const p of ctx.anel({ n: 60, r0: 950, r1: 1500 })) {
      const w = 30 + rng() * 50, h = 80 + rng() * 260;
      P.add('caixa', (x, y, z) => (hash2(Math.round(x * 30), Math.round(y * 60), Math.round(z * 30)) < 0.2 ? '#ffd890' : '#1a1838'), [p.x, -2, p.z], [w, h, w * (0.7 + rng() * 0.6)], [0, rng() * 3, 0]);
    }
    ctx.malha('skyline', P.geo(), { material: ctx.guarda(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })) });
  },

  // ---------------------------------------------------------------- 8 PORTO
  porto(ctx) {
    const { rng, tema, terreno } = ctx;
    const hz = (tema.neblina || {}).cor || '#dde7ec';
    const costa = (tema.terreno && tema.terreno.costa) ?? 20, nAgua = (tema.agua && tema.agua.nivel) ?? -1.4;
    const naTerra = (it) => it.y > -0.2;
    const cores = ['#e8321a', '#2d7fd6', '#39b54a', '#ffb020', '#f2f2f2', '#8a3ab0', '#1fb5b0', '#e86a1a'];
    // patios de conteineres: blocos de fileiras e pilhas (o "labirinto" do porto)
    const itens = [];
    for (const c of ctx.area({ n: 60, dmin: 12, dmax: 160, aceita: naTerra })) {
      const filas = 2 + Math.floor(rng() * 3), colunas = 2 + Math.floor(rng() * 3), ang = Math.round(c.ry / (Math.PI / 2)) * (Math.PI / 2);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let f = 0; f < filas; f++) for (let k = 0; k < colunas; k++) {
        const lx = (k - colunas / 2) * 12.6, lz = (f - filas / 2) * 2.7, x = c.x + lx * ca + lz * sa, z = c.z - lx * sa + lz * ca;
        if (ctx.grade.borda(x, z, 12) < 6) continue;
        const alt = 1 + Math.floor(rng() * 4), y = terreno.altura(x, z);
        for (let a = 0; a < alt; a++) itens.push({ x, y: y + a * 2.6, z, ry: ang + Math.PI / 2, s: 1, cor: rng.escolhe(cores) });
      }
    }
    for (const it of ctx.aoLado({ passo: 15, dmin: 2.5, dmax: 4, folga: 1.5, aceita: naTerra })) {
      const alt = 1 + Math.floor(rng() * 3);
      for (let a = 0; a < alt; a++) itens.push({ x: it.x, y: it.y + a * 2.6, z: it.z, ry: it.ry, s: 1, cor: rng.escolhe(cores) });
    }
    ctx.instancia('conteiner', OBJETOS.conteiner(), itens);
    // guindastes na beira dos pieres e do cais
    ctx.instancia('guindaste', OBJETOS.guindaste(), ctx.aoLado({ passo: 110, dmin: 5, dmax: 7, aceita: (it) => naTerra(it) && it.z > costa - 30 }).map((it) => ({ ...it, s: 1 })), { fixo: true });
    // navios atracados na agua funda
    ctx.instancia('navio', OBJETOS.navio(), ctx.area({ n: 7, dmin: 22, dmax: 180, aceita: (it) => it.y < -5 }).map((it) => ({ ...it, y: nAgua, s: rng.entre(0.8, 1.2) })), { fixo: true });
    ctx.instancia('navio2', OBJETOS.navio('#8a2a24'), ctx.area({ n: 5, dmin: 22, dmax: 240, aceita: (it) => it.y < -5 }).map((it) => ({ ...it, y: nAgua, s: rng.entre(0.7, 1.1) })), { fixo: true });
    ctx.instancia('armazem', OBJETOS.armazem(), ctx.aoLado({ passo: 70, dmin: 14, dmax: 26, folga: 10, aceita: (it) => naTerra(it) && it.z < costa - 80 }).map((it) => ({ ...it, s: 1 })));
    ctx.instancia('farol', OBJETOS.farol(), ctx.area({ n: 1, dmin: 14, dmax: 40, aceita: (it) => naTerra(it) && it.z > costa + 60 }).map((it) => ({ ...it, s: 1.2 })), { fixo: true });
    const cidade = (i) => { const P = new Pecas(); P.add('caixa', azulaCor(['#8a8f9a', '#a0a4ac', '#7a808c'][i % 3], 0.4, hz), [0, 0, 0], [1, 1, 1]); return P.geo(); };
    fundoEmAnel(ctx, { n: 50, r0: 1000, r1: 1400, a0: Math.PI * 1.05, a1: Math.PI * 1.95, geo: cidade, escala: () => [40 + rng() * 60, 40 + rng() * 140, 40 + rng() * 60] });
  },

  // ---------------------------------------------------------------- 9 CANYON
  canyon(ctx) {
    const { rng, tema } = ctx;
    const hz = (tema.neblina || {}).cor || '#f0cfa8';
    const alto = (it) => it.y > -6;
    ctx.instancia('pedra', OBJETOS.pedra('#b25a32'), ctx.area({ n: 240, dmin: 5, dmax: 240, aceita: alto }).map((it) => ({ ...it, s: rng.entre(0.6, 3.0) })));
    ctx.instancia('pinaculo', OBJETOS.pinaculo(), ctx.area({ n: 60, dmin: 16, dmax: 250, aceita: alto }).map((it) => ({ ...it, s: rng.entre(0.8, 1.8) })));
    ctx.instancia('cacto', OBJETOS.cacto(), ctx.area({ n: 70, dmin: 6, dmax: 220, aceita: alto }).map((it) => ({ ...it, s: rng.entre(0.7, 1.2) })));
    ctx.instancia('arbusto', OBJETOS.arbusto('#9a8a4a', '#7a6a3a'), ctx.aoLado({ passo: 20, dmin: 2, dmax: 12, aceita: alto }).map((it) => ({ ...it, s: rng.entre(0.4, 0.8) })));
    fundoEmAnel(ctx, { n: 18, r0: 1000, r1: 1550, geo: () => OBJETOS.mesa(azulaCor('#b25a32', 0.4, hz), azulaCor('#e0a46a', 0.4, hz)), escala: () => [140 + rng() * 240, 70 + rng() * 140, 140 + rng() * 220] });
  },

  // ---------------------------------------------------------------- 10 PISTA MALUCA
  maluca(ctx) {
    const { rng, pista, terreno } = ctx;
    const vivas = ['#ff2b8a', '#ffe14a', '#22c6ff', '#7cff6b', '#b07cff', '#ff8a2a', '#ff4f4f', '#ffffff'];
    // arquibancadas cheias na reta da largada (dos dois lados) e nas outras retas
    const S = pista.principal;
    const arq = ctx.aoLado({ passo: 48, dmin: 4, dmax: 4.5, folga: 2.5, jitter: 0, s0: S.comprimento - 160, s1: S.comprimento - 20 })
      .concat(ctx.aoLado({ passo: 48, dmin: 4, dmax: 4.5, folga: 2.5, jitter: 0, s0: 10, s1: 100 }))
      .concat(ctx.aoLado({ passo: 260, dmin: 4, dmax: 5, folga: 2.5, jitter: 0.1 }));
    // a frente da arquibancada (+Z local) olha para a pista: do lado direito (+R) isso e o rumo + 90 graus
    ctx.instancia('arquibancada', OBJETOS.arquibancada(gerador(3)), arq.map((it) => ({ ...it, ry: it.ry + (it.lado > 0 ? Math.PI / 2 : -Math.PI / 2), s: 1 })), { fixo: true });
    // baloes soltos no ceu do parque e amarrados na beira da pista
    const bal = ctx.area({ n: 200, dmin: 6, dmax: 240 }).map((it) => ({ ...it, y: it.y + 10 + rng() * 30, s: rng.entre(0.9, 1.6), cor: rng.escolhe(vivas) }))
      .concat(ctx.aoLado({ passo: 30, dmin: 2, dmax: 6 }).map((it) => ({ ...it, y: it.y + 9, s: 1, cor: rng.escolhe(vivas) })));
    ctx.instancia('balao', OBJETOS.balao(), bal);
    for (const [c1, c2] of [['#e8321a', '#ffffff'], ['#2d7fd6', '#ffe14a'], ['#8a3ab0', '#ffffff']]) ctx.instancia('tenda', OBJETOS.tenda(c1, c2), ctx.area({ n: 10, dmin: 14, dmax: 160 }).map((it) => ({ ...it, s: rng.entre(0.8, 1.4) })));
    ctx.instancia('arvore', OBJETOS.arvore('#ff7ac8', '#ffb3e0', '#7a5532'), ctx.area({ n: 60, dmin: 8, dmax: 220 }).map((it) => ({ ...it, s: rng.entre(0.8, 1.3) })));
    ctx.instancia('arvore2', OBJETOS.arvore('#5ac84a', '#7ae05a'), ctx.area({ n: 80, dmin: 8, dmax: 220 }).map((it) => ({ ...it, s: rng.entre(0.8, 1.3) })));
    arcosSobreAPista(ctx, { passo: 170, cores: ['#ff2b8a', '#ffe14a', '#22c6ff'] });
    // a RODA-GIGANTE (gira devagar) e dois "loops" de montanha-russa de enfeite
    const lugar = ctx.area({ n: 3, dmin: 45, dmax: 160 });
    if (lugar[0]) {
      const L = lugar[0], R = 26;
      const base = new Pecas(), roda = new Pecas();
      for (const z of [-4, 4]) { base.seg('cil6', '#e8e8f0', [-14, 0, z], [0, R + 4, z], 0.7); base.seg('cil6', '#e8e8f0', [14, 0, z], [0, R + 4, z], 0.7); }
      roda.add(new THREE.TorusGeometry(R, 0.6, 5, 40).toNonIndexed(), '#ff2b8a', [0, 0, -3.5]); roda.add(new THREE.TorusGeometry(R, 0.6, 5, 40).toNonIndexed(), '#ff2b8a', [0, 0, 3.5]);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
        roda.seg('cil4', '#ffe14a', [0, 0, -3.5], [x, y, -3.5], 0.25); roda.seg('cil4', '#ffe14a', [0, 0, 3.5], [x, y, 3.5], 0.25);
        roda.add('caixaC', vivas[k % vivas.length], [x, y - 2.2, 0], [2.6, 2.4, 3.2]);
      }
      const mb = ctx.malha('roda-base', base.geo());
      mb.position.set(L.x, L.y, L.z); mb.rotation.y = L.ry; mb.updateMatrix();
      const mr = ctx.malha('roda-gigante', roda.geo());
      mr.matrixAutoUpdate = true; mr.position.set(L.x, L.y + R + 4, L.z); mr.rotation.y = L.ry;
      ctx.animados.push((dt, t) => { mr.rotation.z = t * 0.12; });
    }
    for (const L of lugar.slice(1)) {
      const P = new Pecas();
      P.add(new THREE.TorusGeometry(16, 1.1, 6, 36).toNonIndexed(), (x, y) => (y > 0 ? '#22c6ff' : '#7cff6b'), [0, 18, 0]);
      for (const x of [-9, 9]) P.add('cil6', '#e8e8f0', [x, 0, 0], [0.8, 8, 0.8]);
      const m = ctx.malha('montanha-russa', P.geo()); m.position.set(L.x, L.y, L.z); m.rotation.y = L.ry; m.updateMatrix();
    }
    void terreno;
  },

  generico(ctx) {
    const { rng } = ctx;
    ctx.instancia('arvore', OBJETOS.arvore(), ctx.area({ n: 260, dmin: 10, dmax: 220 }).map((it) => ({ ...it, s: 0.8 + rng() * 0.7 })));
    ctx.instancia('arbusto', OBJETOS.arbusto(), ctx.aoLado({ passo: 18, dmin: 3, dmax: 16 }).map((it) => ({ ...it, s: 0.7 + rng() * 0.6, ry: rng() * 6 })));
  },

  // ---------------------------------------------------------------- 1 ORLA DO RIO
  orla(ctx) {
    const { rng, terreno, tema, pista } = ctx;
    const T = tema.terreno || {}, xAreia = T.areia ?? 9, xAgua = T.agua ?? 78;
    const naPraia = (it) => it.x > xAreia + 2 && it.x < xAgua - 6 && it.y > -0.6;
    const naCidade = (it) => it.x < xAreia - 6 && it.y > -0.2;
    // CALCADAO de Copacabana: faixa de ondas pretas e brancas colada no asfalto, ao longo da praia (lado do mar)
    montaCalcadao(ctx, xAreia);
    // palmeiras na beira do calcadao e soltas na areia
    const geoPalma = OBJETOS.palmeira(gerador(11));
    const palmas = ctx.aoLado({ passo: 16, dmin: 2, dmax: 5, lado: -1, folga: 1.5, aceita: (it) => it.x > xAreia - 1 && it.x < xAreia + 9 })
      .concat(ctx.area({ n: 70, dmin: 8, dmax: 70, aceita: naPraia }))
      .concat(ctx.area({ n: 90, dmin: 10, dmax: 160, aceita: naCidade }));
    ctx.instancia('palmeira', geoPalma, palmas.map((it) => ({ ...it, ry: rng() * 6.28, s: 0.85 + rng() * 0.35 })));
    // guarda-sois coloridos e quiosques na areia
    const pares = [['#ff4f6d', '#ffffff'], ['#ffd23a', '#2d7fd6'], ['#3fd7ff', '#ffffff'], ['#7cff6b', '#ff8a2a']];
    pares.forEach((par, k) => ctx.instancia('guarda-sol', OBJETOS.guardaSol(par), ctx.area({ n: 26, dmin: 14, dmax: 75, aceita: naPraia }).map((it) => ({ ...it, s: 0.9 + rng() * 0.3 }))));
    ctx.instancia('quiosque', OBJETOS.quiosque(), ctx.aoLado({ passo: 70, dmin: 8, dmax: 14, lado: -1, aceita: naPraia }).map((it) => ({ ...it, ry: it.ry + Math.PI / 2 })));
    // os predios de Copacabana: do lado da cidade, alinhados com a avenida, de alturas variadas
    const cores = ['#f4efe2', '#efe2c8', '#e6eef2', '#f6dcc8', '#dfe8dc', '#f2e6ee'];
    const predios = ctx.aoLado({ passo: 26, dmin: 14, dmax: 30, folga: 10, jitter: 0.2, aceita: (it) => naCidade(it) && it.x > -260 })
      .concat(ctx.area({ n: 70, dmin: 26, dmax: 120, aceita: (it) => naCidade(it) && it.x > -420 }));
    for (const [k, andares] of [[0, 8], [1, 13], [2, 18]]) {
      ctx.instancia('predio', OBJETOS.predio(gerador(k), andares, '#ffffff', '#86a9c6'), predios.filter((_, i) => i % 3 === k).map((it) => ({ ...it, ry: it.ry + (rng() < 0.5 ? 0 : Math.PI / 2), s: [0.8 + rng() * 0.4, 0.85 + rng() * 0.3, 0.8 + rng() * 0.4], cor: rng.escolhe(cores) })));
    }
    // arvores e arbustos no meio do circuito (o parque) e na cidade
    ctx.instancia('arvore', OBJETOS.arvore(), ctx.area({ n: 160, dmin: 9, dmax: 90, aceita: naCidade }).map((it) => ({ ...it, s: 0.8 + rng() * 0.6 })));
    ctx.instancia('arbusto', OBJETOS.arbusto(), ctx.aoLado({ passo: 14, dmin: 2.5, dmax: 9, lado: 0, aceita: naCidade }).map((it) => ({ ...it, ry: rng() * 6, s: 0.6 + rng() * 0.5 })));
    // FUNDO: Pao de Acucar e Urca no mar, morros verdes atras da cidade (silhuetas sem neblina, ja "azuladas" pela distancia)
    const cx = (terreno.x0 + terreno.x1) / 2, cz = (terreno.z0 + terreno.z1) / 2;
    const fundo = new Pecas();
    const azula = (c, k) => '#' + cor(c).lerp(cor((tema.neblina || {}).cor || '#d4ecff'), k).getHexString();
    fundo.add(OBJETOS.morroPao(azula('#4f8f4a', 0.35), azula('#8a8c90', 0.35)), null, [xAgua + 420, -2, terreno.z0 - 380], [150, 330, 130]);
    fundo.add(OBJETOS.morroPao(azula('#4f8f4a', 0.4), azula('#8a8c90', 0.4)), null, [xAgua + 210, -2, terreno.z0 - 300], [120, 170, 110]);
    fundo.add(OBJETOS.morroPao(azula('#4f8f4a', 0.45), azula('#8a8c90', 0.45)), null, [xAgua + 640, -2, terreno.z0 - 260], [90, 110, 80]);
    for (const p of ctx.anel({ n: 14, r0: 1150, r1: 1500, a0: Math.PI * 0.55, a1: Math.PI * 1.45 })) {
      fundo.add(OBJETOS.morroPao(azula('#3f7f42', 0.45), azula('#6f7a6c', 0.45)), null, [p.x, -4, p.z], [180 + rng() * 160, 140 + rng() * 220, 150 + rng() * 120], [0, rng() * 6, 0]);
    }
    // o Corcovado com o Cristo (o detalhe que a crianca do Rio procura), atras da cidade
    const xC = terreno.x0 - 700, zC = cz + 250;
    fundo.add(OBJETOS.morroPao(azula('#3f7f42', 0.35), azula('#6f7a6c', 0.35)), null, [xC, -4, zC], [210, 520, 190]);
    fundo.add('caixa', azula('#f4f4f0', 0.25), [xC, 512, zC], [9, 34, 9]);
    fundo.add('caixa', azula('#f4f4f0', 0.25), [xC, 536, zC], [44, 6, 7]);
    ctx.malha('fundo', fundo.geo(), { material: ctx.materiais.fundo });
    void pista;
  },
};

// ---------------------------------------------------------------- ajudantes das receitas
const azulaCor = (c, k, horizonte) => '#' + cor(c).lerp(cor(horizonte), k).getHexString();
/** silhuetas de fundo num anel: `geo(i)` devolve a geometria (ja pintada) de cada uma, com escala [sx, sy, sz] */
function fundoEmAnel(ctx, { n, r0, r1, a0 = 0, a1 = Math.PI * 2, geo, escala, y = -4 }) {
  const P = new Pecas();
  ctx.anel({ n, r0, r1, a0, a1 }).forEach((p, i) => P.add(geo(i), null, [p.x, y, p.z], escala(i), [0, ctx.rng() * 6.28, 0]));
  ctx.malha('fundo', P.geo(), { material: ctx.materiais.fundo });
}
/** fios entre postes vizinhos (mesmo lado, mesma superficie, ate 45 m): uma malha de linhas so, com barriga */
function montaFios(ctx, postes, alt) {
  const lados = new Map();
  for (const p of postes) { const k = p.sup + ':' + p.lado; let l = lados.get(k); if (!l) lados.set(k, (l = [])); l.push(p); }
  const pos = [];
  for (const l of lados.values()) {
    l.sort((a, b) => a.sPista - b.sPista);
    for (let i = 0; i + 1 < l.length; i++) {
      const a = l[i], b = l[i + 1], d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 45) continue;
      for (const off of [0, -0.5]) {
        const ya = a.y + alt + off, yb = b.y + alt + off, N = 4;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N, b0 = Math.sin(Math.PI * t0) * 1.1, b1 = Math.sin(Math.PI * t1) * 1.1;
          pos.push(a.x + (b.x - a.x) * t0, ya + (yb - ya) * t0 - b0, a.z + (b.z - a.z) * t0, a.x + (b.x - a.x) * t1, ya + (yb - ya) * t1 - b1, a.z + (b.z - a.z) * t1);
        }
      }
    }
  }
  if (!pos.length) return;
  const g = ctx.guarda(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, ctx.guarda(new THREE.LineBasicMaterial({ color: '#1e1e22' })));
  m.name = 'fios'; m.matrixAutoUpdate = false; ctx.grupo.add(m);
}
/** arcos de luz por cima da pista (Neon, Maluca): meio toro de brilho, a cada `passo` m nas retas da principal */
function arcosSobreAPista(ctx, { passo = 140, cores = ['#ff2bd6', '#22e6ff'], s0 = 60 }) {
  const S = ctx.pista.principal, P = new Pecas();
  const _p = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
  let k = 0;
  for (let s = s0; s < S.comprimento - 40; s += passo) {
    S.quadro(s, _T, _N, _R);
    if (Math.abs(S.khEm(s)) > 0.004 || _N.y < 0.97 || (S.marcasEm(s) & 28)) continue; // reta plana, sem vao/crista/loop (4|8|16)
    S.ponto(s, 0, 0, _p);
    // girar o rumo leva o +X local para -R: o meio toro (no plano XY) fica ATRAVESSANDO a pista (com +90 graus ele corria ao longo
    // dela e, visto de tras, era um poste no meio da pista — a primeira foto mostrou)
    const hw = S.larguraEm(s) * 0.5 + 1.4, ang = Math.atan2(_T.x, _T.z);
    P.em([_p.x, _p.y, _p.z], [0, ang, 0], 1, (Q) => {
      Q.add(new THREE.TorusGeometry(hw, 0.32, 5, 20, Math.PI).toNonIndexed(), cores[k % cores.length], [0, 0.3, 0], [1, 1.05, 1]);
      Q.add(new THREE.TorusGeometry(hw - 0.9, 0.18, 4, 20, Math.PI).toNonIndexed(), cores[(k + 1) % cores.length], [0, 0.3, 0], [1, 1.05, 1]);
    });
    k++;
  }
  if (k) ctx.malha('arcos', P.geo(), { brilho: true });
}

/** O calcadao de Copacabana: uma fita na altura do chao, colada na borda esquerda (lado do mar) das amostras da principal que estao na
 *  beira da praia, com a textura das ondas pretas e brancas (desenhada em canvas: a onda e um seno grosso). */
function montaCalcadao(ctx, xAreia) {
  const { pista, terreno } = ctx;
  const S = pista.principal, LARG = 7, pos = [], uv = [], nor = [];
  const _p = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
  let ant = null;
  const corta = () => { ant = null; };
  for (let s = 0; s <= S.comprimento; s += 2) {
    const ss = S.normaliza(s);
    S.quadro(ss, _T, _N, _R);
    S.ponto(ss, 0, 0, _p);
    const hw = S.larguraEm(ss) * 0.5;
    // so na beira da praia: borda esquerda (lado -R) perto de x = xAreia e a pista andando no eixo Z
    const ex = _p.x - _R.x * hw, ez = _p.z - _R.z * hw;
    if (Math.abs(ex - xAreia) > 2.5 || Math.abs(_T.z) < 0.95 || (S.marcasEm(ss) & 96)) { corta(); continue; }
    const fx = ex - _R.x * LARG, fz = ez - _R.z * LARG;
    const y0 = _p.y - 0.12, y1 = terreno.altura(fx, fz) + 0.08;
    const cur = { a: [ex, y0, ez], b: [fx, Math.max(y1, y0 - 0.6), fz], v: s / 7 };
    if (ant) {
      for (const [p, u, v] of [[ant.a, 0, ant.v], [ant.b, 1, ant.v], [cur.b, 1, cur.v], [ant.a, 0, ant.v], [cur.b, 1, cur.v], [cur.a, 0, cur.v]]) { pos.push(...p); uv.push(u, v); nor.push(0, 1, 0); }
    }
    ant = cur;
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  // garante a face para cima (a ordem dos vertices depende do sentido da pista)
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i += 3) {
    const ax = P.getX(i), az = P.getZ(i), bx = P.getX(i + 1), bz = P.getZ(i + 1), cx = P.getX(i + 2), cz = P.getZ(i + 2);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) { for (let c = 0; c < 3; c++) { const t = P.getComponent(i + 1, c); P.setComponent(i + 1, c, P.getComponent(i + 2, c)); P.setComponent(i + 2, c, t); } const U = g.attributes.uv; for (let c = 0; c < 2; c++) { const t = U.getComponent(i + 1, c); U.setComponent(i + 1, c, U.getComponent(i + 2, c)); U.setComponent(i + 2, c, t); } }
  }
  const tex = ctx.guarda(new THREE.CanvasTexture(canvas(128, 128, (c) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#26262a';
    c.beginPath();
    for (let y = 0; y <= 128; y++) { const x = 64 + 34 * Math.sin((y / 128) * Math.PI * 2); if (y === 0) c.moveTo(x - 16, y); else c.lineTo(x - 16, y); }
    for (let y = 128; y >= 0; y--) { const x = 64 + 34 * Math.sin((y / 128) * Math.PI * 2); c.lineTo(x + 16, y); }
    c.closePath(); c.fill();
  })));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(g, ctx.guarda(new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })));
  m.name = 'calcadao';
  ctx.guarda(g);
  ctx.grupo.add(m);
}
