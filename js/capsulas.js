// AS CAPSULAS DE TURBO (fase 4): espalhadas pela pista, recarregam a barra de quem passa por elas e reaparecem alguns segundos depois.
// Contrato: docs/CONTRATOS.md secao 8 — `corrida.capsulas.proximas(carro, alcance)` (a IA mira) e `atrai(pos, raio, carro)` (Ima);
// evento `capsula:pega { carro, dourada }`. Numeros em config/turbo.js (CAPSULAS).
//
// ONDE FICAM (geradas sozinhas de QUALQUER pista, principal e atalhos — `geraCapsulas` exportada, as suites conferem):
//   1. FILEIRAS ATRAVESSADAS na principal a cada ~125 m (+-20), 3 capsulas que cobrem a largura: todo mundo pega um pouco;
//   2. fileiras mais juntas nos ATALHOS (a cada 45 m): "mais nos atalhos";
//   3. RISCO/RECOMPENSA: uma linha colada na beira SEM MURO (a crianca passa com a roda perto do vazio), uma linha no meio da TERRA e
//      um par no POUSO de cada salto, fora do centro (quem caiu volta no centro da pista e nao ganha o premio de quem pulou);
//   4. as `capsulas`/`douradas` da definicao da pista (principal e atalhos, indice de ponto -> s por js/pistas/consulta.js); sem
//      nenhuma dourada na definicao, poe no meio de cada atalho e no pouso do primeiro salto. No maximo 3 douradas por volta (as do
//      atalho tem preferencia: e o lugar arriscado);
//   5. NUNCA dentro de loop/saca-rolha/paredao (magnetico), no vao, na crista, na boca de atalho nem em cima da linha de chegada: um
//      lugar ruim empurra a capsula para a frente (ate 30 m); nao achou chao bom, ela nao existe.
// PEGAR: distancia 3D do centro do carro ao centro da capsula (raio x mod.escala) — qualquer carro, IA tambem. Quem voa por cima nao
// pega. Encolhido que pega volta ao tamanho (o js/poderes.js ouve `capsula:pega`). Quem ja cruzou a chegada nao pega (nao rouba de
// quem ainda corre).
// VISUAL: um InstancedMesh por tipo (azul e dourada), girando e flutuando, halo aditivo (billboard reservado em js/efeitos.js),
// faisca ao pegar e "nasce crescendo" ao reaparecer. Nada criado no passo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARCA } from './pista.js';
import { sDoPontoNaSup } from './pistas/consulta.js';
import { CAPSULAS as K } from '../config/turbo.js';
import { emite } from './eventos.js';
import { efeitosDaCorrida, largaEfeitos, aleatorio } from './efeitos.js';

/** Marcas onde nao pode haver capsula (nem perto: FOLGA_FIGURA). */
const PROIBIDO = MARCA.MAGNETICO | MARCA.VAO | MARCA.LANCA | MARCA.ABRE_ESQ | MARCA.ABRE_DIR;
/** Meia largura de carro usada para manter a capsula dentro da faixa alcancavel (config/carros.js: todos cabem em 2,3 m). */
const MEIA_CARRO = 1.15;
/** Teto de capsulas por pista (instancias): a maior pista (2,2 km) gera ~70. */
const MAXIMO = 160;

// --- aparencia (nao e jogabilidade)
const COR_AZUL = { r: 0.12, g: 0.55, b: 1.0 }, COR_OURO = { r: 1.0, g: 0.72, b: 0.12 };
const GIRO = 2.4;               // rad/s
const INCLINA = 0.42;           // rad: a capsula gira inclinada (o anel aparece de frente para a camera)
const HALO = 4.4, HALO_OURO = 6.4;
const TAMANHO = 1.3, TAMANHO_OURO = 1.75;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _T = new THREE.Vector3(), _N = new THREE.Vector3(), _R = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _M = new THREE.Matrix4(), _S = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const EIXO_Y = new THREE.Vector3(0, 1, 0), EIXO_Z = new THREE.Vector3(0, 0, 1);

// =====================================================================================================  geracao (funcao pura da pista)
/** Lugar bom para capsula na tira `sup` em `s`? (sem figura perto, fora da boca, longe da linha de chegada, dentro de tira aberta). */
function lugarBom(pista, sup, s) {
  if (!sup.fechada && (s < K.BOCA_LIVRE || s > sup.comprimento - K.BOCA_LIVRE)) return false;
  if (sup.id === 0) {
    const L = sup.comprimento, x = ((s % L) + L) % L;
    if (x < K.FOLGA_LARGADA || x > L - K.FOLGA_LARGADA) return false;
  }
  for (let k = -K.FOLGA_FIGURA; k <= K.FOLGA_FIGURA; k += 1) if (sup.marcasEm(s + k) & PROIBIDO) return false;
  return true;
}
/** Anda para a frente ate ANDA_ATE procurando lugar bom. Devolve o s ou -1. */
function achaLugar(pista, sup, s) {
  for (let k = 0; k <= K.ANDA_ATE; k += 2) {
    const x = sup.fechada ? sup.normaliza(s + k) : s + k;
    if (!sup.fechada && x > sup.comprimento) return -1;
    if (lugarBom(pista, sup, x)) return x;
  }
  return -1;
}
/** Corridas (faixas de s) em que `teste(marca)` vale, com o comprimento minimo. [{ s0, s1 }] */
function corridas(sup, teste, minimo) {
  const out = [], n = sup.n;
  let ini = -1;
  for (let i = 0; i <= n; i++) {
    const vale = i < n && teste(sup.marcas[i]);
    if (vale && ini < 0) ini = i;
    if (!vale && ini >= 0) { const s0 = ini * sup.ds, s1 = (i - 1) * sup.ds; if (s1 - s0 >= minimo) out.push({ s0, s1 }); ini = -1; }
  }
  // na tira fechada uma corrida que atravessa a amostra 0 vem partida em duas: tudo bem (cada pedaco ganha a sua linha)
  return out;
}

/** Todas as capsulas de uma pista: [{ sup, s, d, dourada, origem }]. Funcao pura (as suites chamam com qualquer Pista). */
export function geraCapsulas(pista) {
  const lista = [];
  const poe = (sup, s, d, dourada, origem) => {
    const meia = sup.larguraEm(s) * 0.5 - MEIA_CARRO;
    lista.push({ sup: sup.id, s, d: Math.max(-meia, Math.min(meia, d)), dourada: !!dourada, origem });
  };
  const fileira = (sup, s, origem) => {
    const W = sup.larguraEm(s), n = W >= K.LARGURA_DE_3 ? K.NA_FILEIRA_LARGA : 2, f = K.FRACAO_DA_FILEIRA * W;
    if (n === 3) { poe(sup, s, -f, false, origem); poe(sup, s, 0, false, origem); poe(sup, s, f, false, origem); }
    else { poe(sup, s, -f, false, origem); poe(sup, s, f, false, origem); }
  };
  // 1. fileiras da principal
  const P = pista.principal;
  let alterna = 1;
  for (let s = K.PRIMEIRA_FILEIRA; s < P.comprimento - K.FOLGA_LARGADA; s += K.ESPACO_FILEIRAS + alterna * K.VARIA_FILEIRAS, alterna = -alterna) {
    const x = achaLugar(pista, P, s);
    if (x >= 0 && x < P.comprimento - K.FOLGA_LARGADA) fileira(P, x, 'fileira');
  }
  // 2. fileiras dos atalhos
  for (const a of pista.atalhos) {
    const S = a.sup;
    for (let s = K.BOCA_LIVRE + 2; s <= S.comprimento - K.BOCA_LIVRE; s += K.ESPACO_ATALHO) {
      const x = achaLugar(pista, S, s);
      if (x >= 0) fileira(S, x, 'atalho');
    }
  }
  // 3. risco: beira sem muro, terra, pouso de salto (em todas as tiras)
  for (const S of pista.superficies) {
    const linha = (faixa, dDe, origem) => {
      const comp = faixa.s1 - faixa.s0, n = Math.min(K.RISCO_MAXIMO, Math.max(1, Math.floor(comp / K.RISCO_ESPACO)));
      const passo = comp / n;
      for (let j = 0; j < n; j++) {
        const s = faixa.s0 + passo * (j + 0.5);
        if (lugarBom(pista, S, s)) poe(S, s, dDe(s, j), false, origem);
      }
    };
    const semMuro = (bitMuro, bitAbre) => (m) => !(m & bitMuro) && !(m & bitAbre) && !(m & (MARCA.VAO | MARCA.LANCA | MARCA.MAGNETICO));
    const dir = corridas(S, semMuro(MARCA.MURO_DIR, MARCA.ABRE_DIR), K.RISCO_MINIMO);
    const esq = corridas(S, semMuro(MARCA.MURO_ESQ, MARCA.ABRE_ESQ), K.RISCO_MINIMO);
    // sem muro dos dois lados (ponte): alterna as beiras, um colar so
    const ambos = (f) => esq.some((e) => e.s0 <= f.s1 && e.s1 >= f.s0);
    for (const f of dir) linha(f, (s, j) => (ambos(f) && j % 2 === 1 ? -1 : 1) * (S.larguraEm(s) * 0.5 - K.BEIRA), 'beira');
    for (const f of esq) if (!dir.some((x) => x.s0 <= f.s1 && x.s1 >= f.s0)) linha(f, (s) => -(S.larguraEm(s) * 0.5 - K.BEIRA), 'beira');
    for (const f of corridas(S, (m) => (m & MARCA.TERRA) !== 0, K.RISCO_MINIMO)) linha(f, () => 0, 'terra');
    for (const f of corridas(S, (m) => (m & MARCA.VAO) !== 0, 2)) {
      const x = achaLugar(pista, S, f.s1 + K.POUSO_DEPOIS);
      if (x >= 0) { const W = S.larguraEm(x) * K.POUSO_LADO; poe(S, x, -W, false, 'pouso'); poe(S, x, W, false, 'pouso'); }
    }
  }
  // 4. as da definicao (indice de ponto -> s; lugar ruim anda para a frente)
  const daDef = (supId, itens, dourada) => {
    for (const it of itens || []) {
      const S = pista.sup(supId);
      if (!S) continue;
      let s;
      try { s = sDoPontoNaSup(pista, supId, Number(it.em) || 0); } catch (e) { continue; }
      if (!Number.isFinite(s)) continue;
      const x = achaLugar(pista, S, s);
      if (x >= 0) poe(S, x, Number(it.d) || 0, dourada, 'definicao');
    }
  };
  const def = pista.def || {};
  daDef(0, def.capsulas, false);
  (def.atalhos || []).forEach((a, k) => daDef(k + 1, a.capsulas, false));
  const douradasAtalho = [], douradasPrincipal = [];
  const antes = lista.length;
  (def.atalhos || []).forEach((a, k) => daDef(k + 1, a.douradas, true));
  for (let i = antes; i < lista.length; i++) douradasAtalho.push(lista[i]);
  const antes2 = lista.length;
  daDef(0, def.douradas, true);
  for (let i = antes2; i < lista.length; i++) douradasPrincipal.push(lista[i]);
  lista.length = antes;
  // sem dourada na definicao: no meio de cada atalho e no pouso do primeiro salto da principal
  if (!douradasAtalho.length && !douradasPrincipal.length) {
    for (const a of pista.atalhos) {
      const x = achaLugar(pista, a.sup, a.sup.comprimento * 0.5);
      if (x >= 0) douradasAtalho.push({ sup: a.sup.id, s: x, d: 0, dourada: true, origem: 'auto' });
    }
    const vaos = corridas(P, (m) => (m & MARCA.VAO) !== 0, 2);
    if (vaos.length) {
      const x = achaLugar(pista, P, vaos[0].s1 + K.POUSO_DEPOIS + 6);
      if (x >= 0) douradasPrincipal.push({ sup: 0, s: x, d: P.larguraEm(x) * K.POUSO_LADO, dourada: true, origem: 'auto' });
    }
    if (!douradasAtalho.length && !douradasPrincipal.length) {
      const x = achaLugar(pista, P, P.comprimento * 0.5);
      if (x >= 0) douradasPrincipal.push({ sup: 0, s: x, d: 0, dourada: true, origem: 'auto' });
    }
  }
  const douradas = douradasAtalho.concat(douradasPrincipal).slice(0, K.MAX_DOURADAS);
  // 5. junta as muito proximas (a dourada fica)
  const final = [];
  const todas = douradas.concat(lista);
  for (const c of todas) {
    if (final.length >= MAXIMO) break;
    const S = pista.sup(c.sup);
    S.ponto(c.s, c.d, K.ALTURA, _a);
    let junto = false;
    for (const f of final) { if (f.pos.distanceToSquared(_a) < K.JUNTAS * K.JUNTAS) { junto = true; break; } }
    if (junto) continue;
    c.pos = _a.clone();
    final.push(c);
  }
  return final;
}

// =====================================================================================================  geometria (uma por tipo)
/** A capsula: pilula com faixa clara no meio e um anel em volta (o anel girando inclinado e o que diz "power-up" de longe). */
function geometriaDaCapsula(escala, corPonta, corMeio, corAnel) {
  const pilula = new THREE.CapsuleGeometry(0.36 * escala, 0.62 * escala, 6, 14);
  const anel = new THREE.TorusGeometry(0.78 * escala, 0.075 * escala, 6, 28).rotateX(Math.PI / 2);
  const pinta = (g, cor) => {
    const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3), meio = new THREE.Color(corMeio), ponta = new THREE.Color(corPonta), x = new THREE.Color();
    const h = 0.67 * escala;
    for (let i = 0; i < n; i++) {
      if (cor) x.set(cor);
      else { const u = Math.min(1, Math.abs(p.getY(i)) / h); x.copy(meio).lerp(ponta, Math.pow(u, 1.6)); }
      c[i * 3] = x.r; c[i * 3 + 1] = x.g; c[i * 3 + 2] = x.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  };
  pinta(pilula, null); pinta(anel, corAnel);
  const g = mergeGeometries([pilula.toNonIndexed(), anel.toNonIndexed()]);
  pilula.dispose(); anel.dispose();
  return g;
}

// =====================================================================================================  o sistema
export class Capsulas {
  constructor(G, corrida) {
    this.G = G; this.corrida = corrida;
    this.efeitos = efeitosDaCorrida(G, corrida);
    const pista = corrida.pista;
    const L = pista.comprimento;
    this.lista = geraCapsulas(pista).map((c, i) => {
      const S = pista.sup(c.sup);
      S.quadro(c.s, _T, _N, _R);
      return {
        id: i, sup: c.sup, s: c.s, d: c.d, dourada: c.dourada, origem: c.origem,
        pos: c.pos, atual: c.pos.clone(), cima: _N.clone(),
        progresso: ((pista.sPrincipal(c.sup, c.s) % L) + L) % L,
        ativa: true, espera: 0, voando: false, alvo: null, cresce: 1, fase: aleatorio() * 6.283, slot: -1, halo: -1,
      };
    });
    this.normais = this.lista.filter((c) => !c.dourada);
    this.douradas = this.lista.filter((c) => c.dourada);
    // malhas
    this._geo = [geometriaDaCapsula(TAMANHO, '#0a2cff', '#5fd4ff', '#bdf4ff'), geometriaDaCapsula(TAMANHO_OURO, '#e86a00', '#ffd23a', '#ffe68a')];
    this._mat = [
      new THREE.MeshPhongMaterial({ vertexColors: true, emissive: '#0b5cff', emissiveIntensity: 0.85, shininess: 110, specular: '#ffffff' }),
      new THREE.MeshPhongMaterial({ vertexColors: true, emissive: '#ff8c00', emissiveIntensity: 0.55, shininess: 120, specular: '#ffffff' }),
    ];
    this.malhas = [this._instanciada(this._geo[0], this._mat[0], this.normais, 'capsulas'), this._instanciada(this._geo[1], this._mat[1], this.douradas, 'capsulas-douradas')];
    this.grupo = new THREE.Group();
    this.grupo.name = 'capsulas';
    for (const m of this.malhas) if (m) this.grupo.add(m);
    if (corrida.cena) corrida.cena.add(this.grupo);
    const h0 = this.efeitos.brilhos.reserva(this.lista.length);
    this.lista.forEach((c, i) => { c.halo = h0 >= 0 ? h0 + i : -1; });
    this._saida = [];       // por carro: o array devolvido por proximas (reaproveitado)
    this._t = 0;
    this._brilhoOuro = 0;
    this.pegas = 0;         // contagem (relatorio/suite)
  }

  _instanciada(geo, mat, lista, nome) {
    if (!lista.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, lista.length);
    m.name = nome;
    m.frustumCulled = false;  // UMA esfera de culling para a pista inteira: sempre visivel de qualquer jeito
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    lista.forEach((c, i) => { c.slot = i; m.setMatrixAt(i, _zero); });
    return m;
  }

  inicia() {}

  /** Raio de pegar de um carro (encolhido pega com menos). */
  _raio(c) { return K.RAIO_PEGA * ((c.mod && c.mod.escala) || 1); }
  /** Centro do carro (m acima do asfalto pelo `cima`). */
  _centro(c, out) { return out.copy(c.pos).addScaledVector(c.cima, K.CENTRO_DO_CARRO * ((c.mod && c.mod.escala) || 1)); }

  passo(dt) {
    const cs = this.corrida.carros;
    for (const cap of this.lista) {
      if (!cap.ativa) {
        cap.espera -= dt;
        if (cap.espera <= 0) { cap.ativa = true; cap.espera = 0; cap.cresce = 0; cap.voando = false; cap.alvo = null; cap.atual.copy(cap.pos); }
        continue;
      }
      if (cap.voando) {
        const a = cap.alvo;
        if (!a || a.chegou) { cap.voando = false; cap.alvo = null; cap.atual.copy(cap.pos); }
        else {
          this._centro(a, _b);
          _c.subVectors(_b, cap.atual);
          const dist = _c.length(), passo = Math.max(K.IMA_VEL_MIN, (a.velocidade || 0) + K.IMA_VEL) * dt;
          if (dist <= passo) cap.atual.copy(_b); else cap.atual.addScaledVector(_c, passo / dist);
        }
      }
      // quem pegou (o primeiro da lista que encosta: no mesmo passo dois carros nao pegam a mesma)
      for (const c of cs) {
        if (c.chegou) continue;
        const r = this._raio(c);
        this._centro(c, _b);
        if (_b.distanceToSquared(cap.atual) <= r * r) { this._pega(cap, c); break; }
      }
    }
  }

  _pega(cap, c) {
    cap.ativa = false; cap.voando = false; cap.alvo = null;
    cap.espera = cap.dourada ? K.REAPARECE_DOURADA : K.REAPARECE;
    const t = c.turbo;
    if (t) t.carga = Math.min(1, (t.carga || 0) + (cap.dourada ? K.RECARGA_DOURADA : K.RECARGA));
    this.pegas++;
    // faisca e clarao onde estava (o desenho le no proximo quadro)
    const E = this.efeitos, cor = cap.dourada ? COR_OURO : COR_AZUL;
    E.explosao(cap.atual, cap.dourada ? 34 : 18, cor, { vel: cap.dourada ? 8 : 6, sobe: 2.5, tam: cap.dourada ? 0.6 : 0.45, vida: 0.6, grav: 4 });
    E.clarao(cap.atual, cap.dourada ? 6 : 3.6, cor, 0.3, 0.9);
    emite('capsula:pega', { carro: c, dourada: cap.dourada });
    cap.atual.copy(cap.pos);
  }

  /** Capsulas ATIVAS a frente de `carro` (ate `alcance` m de progresso), da mais perto para a mais longe: [{ sup, s, d, dourada, pos }].
   *  O array e REAPROVEITADO (um por carro): use antes de chamar de novo para o mesmo carro. */
  proximas(carro, alcance = 120) {
    const k = carro.indice | 0;
    const out = this._saida[k] || (this._saida[k] = []);
    out.length = 0;
    const pista = this.corrida.pista, L = pista.comprimento;
    const p0 = pista.sPrincipal(carro.sup, carro.s);
    for (const cap of this.lista) {
      if (!cap.ativa || cap.voando) continue;
      let ds = cap.progresso - p0;
      ds = ((ds % L) + L) % L;
      if (ds > alcance) continue;
      cap._frente = ds;
      out.push(cap);
    }
    out.sort(porFrente);
    return out;
  }

  /** Ima: toda capsula ativa a menos de `raio` m de `pos` voa para `carro` (e e pega por quem encostar primeiro). Devolve quantas. */
  atrai(pos, raio, carro) {
    if (!pos || !carro) return 0;
    const r2 = raio * raio;
    let n = 0;
    for (const cap of this.lista) {
      if (!cap.ativa || cap.voando) continue;
      if (cap.atual.distanceToSquared(pos) <= r2) { cap.voando = true; cap.alvo = carro; n++; }
    }
    return n;
  }

  /** Quantas capsulas ativas a menos de `raio` m de `pos` (heuristica do Ima para a IA). */
  contaPerto(pos, raio) {
    const r2 = raio * raio;
    let n = 0;
    for (const cap of this.lista) if (cap.ativa && !cap.voando && cap.atual.distanceToSquared(pos) <= r2) n++;
    return n;
  }

  quadro(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this._t += dt;
    const t = this._t, E = this.efeitos;
    this._brilhoOuro += dt;
    const soltaBrilho = this._brilhoOuro > 0.12;
    if (soltaBrilho) this._brilhoOuro = 0;
    for (const cap of this.lista) {
      const malha = this.malhas[cap.dourada ? 1 : 0];
      if (!malha) continue;
      if (!cap.ativa) {
        malha.setMatrixAt(cap.slot, _zero);
        E.brilhos.poe(cap.halo, 0, 0, 0, 0, 0, 0, 0, 0);
        continue;
      }
      if (cap.cresce < 1) cap.cresce = Math.min(1, cap.cresce + dt / K.CRESCE);
      // "nasce crescendo" com um pulinho de mola no fim
      const u = cap.cresce, esc = u < 1 ? Math.sin(u * Math.PI * 0.5) * (1 + 0.25 * Math.sin(u * Math.PI)) : 1;
      const bob = Math.sin(t * 2.2 + cap.fase) * K.FLUTUA;
      if (cap.voando) _a.copy(cap.atual); else _a.copy(cap.pos).addScaledVector(cap.cima, bob);
      // orientacao: o Y da capsula no "cima" da pista, girando nele, inclinada
      _q.setFromUnitVectors(EIXO_Y, cap.cima);
      _q2.setFromAxisAngle(EIXO_Y, t * GIRO + cap.fase);
      _q.multiply(_q2);
      _q2.setFromAxisAngle(EIXO_Z, INCLINA);
      _q.multiply(_q2);
      _S.setScalar(esc * (cap.voando ? 0.75 : 1));
      _M.compose(_a, _q, _S);
      malha.setMatrixAt(cap.slot, _M);
      const cor = cap.dourada ? COR_OURO : COR_AZUL, pulsa = 0.85 + 0.15 * Math.sin(t * 5 + cap.fase);
      E.brilhos.poe(cap.halo, _a.x, _a.y, _a.z, (cap.dourada ? HALO_OURO : HALO) * esc * pulsa, cor.r, cor.g, cor.b, (cap.dourada ? 0.95 : 0.8) * esc);
      // a dourada solta brilhinhos (de perto: longe ninguem ve e o pool e pequeno)
      if (cap.dourada && soltaBrilho && this.G.camera && this.G.camera.position.distanceToSquared(_a) < 90 * 90 && aleatorio() < E.q(1)) {
        const ang = aleatorio() * 6.283;
        E.faiscas.solta(_a.x + Math.cos(ang) * 0.9, _a.y + (aleatorio() - 0.3) * 1.2, _a.z + Math.sin(ang) * 0.9, 0, 0.8 + aleatorio(), 0, 1.0, 0.85, 0.4, 0.42, 0.05, 1, 0.7, -0.4, 1);
      }
    }
    for (const m of this.malhas) if (m) m.instanceMatrix.needsUpdate = true;
  }

  destroi() {
    if (this.grupo.parent) this.grupo.parent.remove(this.grupo);
    for (const m of this.malhas) if (m) m.dispose();
    for (const g of this._geo) g.dispose();
    for (const m of this._mat) m.dispose();
    largaEfeitos(this.corrida);
  }
}

function porFrente(a, b) { return a._frente - b._frente; }
