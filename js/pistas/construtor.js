// CONSTRUTOR DE PISTAS (fase 3). Uma "tartaruga" que desenha o circuito por PEDACOS — reta, curva, rampa com vao, loop, saca-rolha,
// paredao — e devolve a definicao no formato do contrato (docs/CONTRATOS.md secao 4): pontos de controle da spline, trechos marcados
// por indice de ponto e atalhos. Devolve tambem o que o visual e os testes precisam saber e a spline nao conta: as FIGURAS (onde fica
// cada rampa, loop, saca-rolha e paredao) e os trechos ELEVADOS (o terreno nao sobe ate eles e o visual poe pilares embaixo).
//
// POR QUE UMA TARTARUGA (e nao pontos digitados a mao, como a pista de teste): dez pistas de 1,5 a 2,2 km com loops, rampas e
// atalhos sao centenas de pontos. Escrito como "reta 120, curva a direita de raio 45 por 90 graus, rampa, loop" o desenho fica
// legivel, a curva sai redonda (pontos sobre o arco de verdade, de 15 em 15 graus) e o FECHAMENTO do circuito e calculado, nao
// chutado: duas retas marcadas `elastica` absorvem o erro de posicao (sistema 2x2 EXATO — o rumo de cada pedaco nao depende do
// comprimento das retas, entao mexer numa reta so translada o que vem depois) e um pedaco com `sobe: 'resto'` absorve o erro de
// altura. A soma das curvas tem de dar 360 graus: isso o desenho garante e o construtor confere (erro com o numero, nao pista torta).
//
// RUMO: em graus, 0 = +Z, 90 = +X (a frente do carro e +Z e a direita do piloto e -X: virar a DIREITA diminui o rumo).
// INDICES: cada pedaco comeca no ultimo ponto do anterior (a "emenda") e acrescenta os seus; os trechos (`marca`) e os nomes
// (`nome`) usam esses indices — e o que o nucleo (js/pista.js) espera em `trechos[].de/ate` (fracao vale).
import * as THREE from 'three';
import { geraLoop, BOCA_DO_ATALHO } from '../pista.js';

/** Passo maximo entre pontos de controle numa reta (m). Com pontos alinhados a CatmullRom passa reta; 25 m deixa a lombada e o pe
 *  de subida suaves em ~1 trecho sem encher a pista de pontos (a tabela t -> s do nucleo custa 64 amostras por trecho). */
const PASSO_RETA = 25;
/** Passo maximo numa curva: 15 graus ou 20 m de arco. Com 15 graus a CatmullRom fica a menos de 2 cm do arco verdadeiro. */
const PASSO_CURVA_GRAUS = 15, PASSO_CURVA_M = 20;
/** Determinante minimo do sistema de fechamento: as duas retas elasticas precisam fazer pelo menos ~17 graus entre si, senao o
 *  fechamento "estica" uma reta de centenas de metros para corrigir um erro pequeno. */
const DET_MINIMO = 0.3;
/** Comprimento minimo de uma reta elastica depois do ajuste (m): menos que isso a reta some e a curva vizinha vira quina. */
const RETA_MINIMA = 12;

const GRAU = Math.PI / 180;
const suave = (t) => t * t * (3 - 2 * t);
const frente = (psi) => [Math.sin(psi), 0, Math.cos(psi)];
const direita = (psi) => [-Math.cos(psi), 0, Math.sin(psi)];
const igual = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;

/** Um tracado (principal ou atalho) desenhado por pedacos. Use `new Construtor({...})`, chame os pedacos e depois `compila()`. */
export class Construtor {
  /** inicio: [x, y, z] do ponto 0 (a largada); rumo em graus; largura padrao (m). */
  constructor({ inicio = [0, 0, 0], rumo = 0, largura = 14 } = {}) {
    this.inicio = inicio.slice();
    this.rumo0 = rumo * GRAU;
    this.larguraBase = largura;
    this.pedacos = [];
    this.atalhosPedidos = [];
    this._larguraAtual = largura;
  }

  // ------------------------------------------------------------------------------------------------ pedacos (so registram)
  /** Muda a largura padrao dos proximos pedacos (m). */
  largura(l) { this.pedacos.push({ tipo: 'largura', l }); return this; }
  /** Reta de `comp` metros. op: { sobe (m, perfil suave), larg, elastica, marca, nome, elevado, ponte, perfil: 'linear' }.
   *  `elevado`: pilares e chao afastado onde a pista sobe acima do chao de antes/depois; `ponte`: sempre (o vale passa embaixo). */
  reta(comp, op = {}) { this.pedacos.push({ tipo: 'reta', comp, op }); return this; }
  /** Curva a direita de `raio` m por `graus`. op: { incl (graus, positivo = borda de dentro mais baixa), sobe, larg, marca, nome } */
  direita(raio, graus, op = {}) { this.pedacos.push({ tipo: 'curva', raio, graus, lado: 1, op }); return this; }
  esquerda(raio, graus, op = {}) { this.pedacos.push({ tipo: 'curva', raio, graus, lado: -1, op }); return this; }
  /** Rampa reta com salto: sobe `altura` em `comp` m (perfil de trampolim), crista com LANCA, VAO de `vao` m, pouso `queda` m abaixo
   *  da crista descendo ate o chao em `pouso` m. op: { comp, altura, vao, queda, pouso, larg, nome, perigo } */
  rampa(op = {}) { this.pedacos.push({ tipo: 'rampa', op }); return this; }
  /** Loop (js/pista.js geraLoop): op { raio, larg, desloca (padrao larg + 4), lado: 'dir'|'esq', nome } */
  loop(op = {}) { this.pedacos.push({ tipo: 'loop', op }); return this; }
  /** Saca-rolha: helice de `raio` m em volta de um eixo na direcao do rumo, uma volta inteira em `comp` m. op { raio, comp, lado, larg } */
  sacaRolha(op = {}) { this.pedacos.push({ tipo: 'saca', op }); return this; }
  /** Paredao: curva magnetica que deita ate `inclMax` graus (o carro anda na parede) e volta. op { inclMax, larg, nome } */
  paredao(raio, graus, lado, op = {}) { this.pedacos.push({ tipo: 'paredao', raio, graus, lado: lado === 'esq' ? -1 : 1, op }); return this; }
  /** Da nome ao ponto atual (o ultimo emitido): usado nas bocas dos atalhos e nas capsulas. */
  ponto(nome) { this.pedacos.push({ tipo: 'nome', nome }); return this; }
  /** Liga ao alvo { p: [x,y,z], rumo (rad) } por uma cubica de Bezier (usado no fim dos atalhos). op { alca } */
  conecta(alvo, op = {}) { this.pedacos.push({ tipo: 'conecta', alvo, op }); return this; }

  /** Atalho da principal (contrato secao 4): sai na boca do ponto `de` e volta no ponto `ate` (nomes dados por `ponto()`), pelo lado
   *  `lado`. `via(t)` desenha o caminho com os mesmos pedacos (t e um Construtor); o fim liga sozinho na boca de saida. As duas bocas
   *  precisam estar no MEIO de retas (12 m de reta depois de `de` e antes de `ate`): a boca corre colada na principal. */
  atalho({ de, ate, lado = 'dir', largura = 9, nome, via, muro = true, alca, douradas, capsulas }) {
    this.atalhosPedidos.push({ de, ate, lado, largura, nome, via, muro, alca, douradas, capsulas });
    return this;
  }

  // ------------------------------------------------------------------------------------------------ compilacao
  /** Fecha o circuito e devolve { pontos, trechos, atalhos, figuras, elevados, marcos, comprimentoNominal }. */
  compila(op = {}) {
    // MODO RASCUNHO (ferramenta de desenho no Node): com globalThis.TURBO_RASCUNHO o circuito NAO e fechado e volta aberto, com o
    // ponto e o rumo em que terminou — e o que se plota para acertar o desenho antes de o fechamento aceitar
    if (op.rascunho || globalThis.TURBO_RASCUNHO) { const r = this._emite(null, null, true); return { pontos: r.pts, trechos: r.trechos, figuras: r.figuras, elevados: r.elevados, marcos: r.marcos, atalhos: [], fim: r.fim, psiFim: r.psiFim, rascunho: true }; }
    const elasticas = this.pedacos.map((p, k) => (p.tipo === 'reta' && p.op.elastica ? k : -1)).filter((k) => k >= 0);
    // 1a passada: as elasticas como estao, para medir o erro de fechamento e a altura que sobra
    let r = this._emite(null, null, true);
    const ajuste = new Map();
    if (elasticas.length === 2) {
      const [a, b] = elasticas, da = r.direcoes.get(a), db = r.direcoes.get(b);
      const ex = r.fim[0] - this.inicio[0], ez = r.fim[2] - this.inicio[2];
      const det = da[0] * db[2] - db[0] * da[2];
      if (Math.abs(det) < DET_MINIMO) throw new Error(`fechamento mal condicionado: as retas elasticas sao quase paralelas (det ${det.toFixed(3)})`);
      // x*da + y*db = -e
      const x = (-ex * db[2] + ez * db[0]) / det, y = (-da[0] * ez + da[2] * ex) / det;
      ajuste.set(a, x); ajuste.set(b, y);
      for (const [k, v] of ajuste) {
        const L = this.pedacos[k].comp + v;
        if (L < RETA_MINIMA) throw new Error(`fechamento pede a reta elastica ${k} com ${L.toFixed(1)} m (minimo ${RETA_MINIMA}); erro ${ex.toFixed(1)}, ${ez.toFixed(1)}`);
      }
    } else if (elasticas.length !== 0) throw new Error('use exatamente 2 retas elasticas (ou nenhuma)');
    r = this._emite(ajuste, r.restoY, true);
    const erro = Math.hypot(r.fim[0] - this.inicio[0], r.fim[1] - this.inicio[1], r.fim[2] - this.inicio[2]);
    let giro = (r.psiFim - this.rumo0) / (2 * Math.PI);
    giro -= Math.round(giro);
    if (Math.abs(giro) > 1e-6) throw new Error(`o circuito nao fecha o rumo: sobram ${(giro * 360).toFixed(2)} graus de curva`);
    if (erro > 1e-3) throw new Error(`o circuito nao fecha: o fim ficou a ${erro.toFixed(2)} m da largada`);
    // o ultimo ponto e a largada de novo (a spline fechada liga sozinha): sai da lista. Indices que apontavam para ele (n) continuam
    // validos no nucleo: sCtrl(n) = comprimento total.
    const pts = r.pts;
    if (igual(pts[pts.length - 1].p, pts[0].p)) pts.pop();
    const out = { pontos: pts, trechos: r.trechos, figuras: r.figuras, elevados: r.elevados, marcos: r.marcos, comprimentoNominal: r.comp };
    out.atalhos = this.atalhosPedidos.map((a) => this._compilaAtalho(a, r));
    return out;
  }

  _compilaAtalho(a, r) {
    const A = r.marcos[a.de], B = r.marcos[a.ate];
    if (!A || !B) throw new Error(`atalho: ponto desconhecido ${!A ? a.de : a.ate}`);
    if (!(A.i < B.i)) throw new Error('atalho: `de` tem de vir antes de `ate` (atalho nunca cruza a largada)');
    const lado = a.lado === 'esq' ? -1 : 1;
    // as bocas (o nucleo faz a mesma conta em _montaAtalho): 12 m de reta colados na borda, a meia largura de cada um do centro
    const boca = (M, sentido) => {
      const h = frente(M.psi), R = direita(M.psi), off = (M.larg * 0.5 + a.largura * 0.5) * lado;
      return { p: [M.x + h[0] * BOCA_DO_ATALHO * sentido + R[0] * off, M.y, M.z + h[2] * BOCA_DO_ATALHO * sentido + R[2] * off], psi: M.psi };
    };
    const ini = boca(A, 1), fim = boca(B, -1);
    const t = new Construtor({ inicio: ini.p, rumo: ini.psi / GRAU, largura: a.largura });
    if (a.via) a.via(t);
    t.conecta({ p: fim.p, rumo: fim.psi }, { alca: a.alca });
    // o atalho nao fecha: a lista dele comeca DEPOIS da boca (indice -1 = fim da boca de entrada, que o nucleo poe sozinho)
    const sub = t._emite(null, null, false);
    const def = { de: A.i, ate: B.i, lado: a.lado, largura: a.largura, nome: a.nome, pontos: sub.pts, trechos: sub.trechos, figuras: sub.figuras, elevados: sub.elevados };
    if (a.muro === false) def.muro = false;
    if (a.douradas) def.douradas = a.douradas;
    if (a.capsulas) def.capsulas = a.capsulas;
    return def;
  }

  /** Percorre os pedacos e emite os pontos. `ajuste` = metros a somar em cada reta elastica; `restoY` = subida do pedaco 'resto';
   *  `incluiInicio` = o ponto 0 e o inicio (principal) ou fica de fora (atalho: o inicio e a boca do nucleo). */
  _emite(ajuste, restoY, incluiInicio) {
    const pts = [], trechos = [], figuras = [], elevados = [], marcos = {}, direcoes = new Map();
    let x = this.inicio[0], y = this.inicio[1], z = this.inicio[2], psi = this.rumo0, larg = this.larguraBase, comp = 0;
    let somaY = 0, temResto = false;
    // indice do ponto atual (a emenda): no atalho o inicio nao entra na lista e vale -1
    const atual = () => pts.length - 1;
    const poe = (px, py, pz, extra = {}) => { const c = { p: [px, py, pz], larg: extra.larg ?? larg }; if (extra.incl) c.incl = extra.incl; if (extra.cima) c.cima = extra.cima; pts.push(c); };
    if (incluiInicio) poe(x, y, z);
    const marca = (op, i0, i1) => {
      if (!op.marca) return;
      const lista = Array.isArray(op.marca) ? op.marca : [op.marca];
      for (const m of lista) {
        const tipo = typeof m === 'string' ? m : m.tipo, f0 = typeof m === 'string' ? 0 : (m.de ?? 0), f1 = typeof m === 'string' ? 1 : (m.ate ?? 1);
        trechos.push({ de: i0 + (i1 - i0) * f0, ate: i0 + (i1 - i0) * f1, tipo });
      }
    };
    const fecha = (op, i0, tipoFig) => {
      const i1 = atual();
      marca(op, i0, i1);
      // ponte: elevado mesmo sem subir (o chao embaixo e que desce: vale, rio de lava, canyon)
      if (op.elevado || op.ponte) elevados.push(op.ponte ? { de: i0, ate: i1, ponte: true } : { de: i0, ate: i1 });
      if (op.nome) marcos[op.nome] = { i: i1, i0, x, y, z, psi, larg: pts[i1] ? pts[i1].larg : larg };
      return i1;
    };
    /** troca o ultimo ponto (a emenda) por um ponto com `cima` explicito, para a figura magnetica comecar nele */
    const trocaEmenda = (c) => {
      if (pts.length === 0) throw new Error('figura magnetica precisa de um pedaco antes dela');
      const u = pts[pts.length - 1];
      if (!igual(u.p, c.p)) throw new Error('emenda fora do lugar');
      pts[pts.length - 1] = { ...u, ...c, larg: c.larg ?? u.larg };
    };

    for (let k = 0; k < this.pedacos.length; k++) {
      const pc = this.pedacos[k], op = pc.op || {};
      const i0 = atual();
      if (pc.tipo === 'largura') { larg = pc.l; continue; }
      if (pc.tipo === 'nome') { marcos[pc.nome] = { i: i0, x, y, z, psi, larg: pts[i0] ? pts[i0].larg : larg }; continue; }
      const lp = op.larg ?? larg;
      if (pc.tipo === 'reta') {
        const L = pc.comp + ((ajuste && ajuste.get(k)) || 0);
        let dy = op.sobe || 0;
        if (dy === 'resto') { temResto = true; dy = restoY ?? 0; } else somaY += dy;
        const n = Math.max(1, Math.ceil(L / PASSO_RETA)), h = frente(psi), x0 = x, y0 = y, z0 = z;
        direcoes.set(k, h);
        for (let j = 1; j <= n; j++) {
          const t = j / n, f = op.perfil === 'linear' ? t : suave(t);
          poe(x0 + h[0] * L * t, y0 + dy * f, z0 + h[2] * L * t, { larg: lp, incl: op.incl });
        }
        x = x0 + h[0] * L; y = y0 + dy; z = z0 + h[2] * L; comp += L;
        fecha(op, i0);
      } else if (pc.tipo === 'curva') {
        const s = pc.lado, ang = pc.graus * GRAU, R = pc.raio;
        let dy = op.sobe || 0;
        if (dy === 'resto') { temResto = true; dy = restoY ?? 0; } else somaY += dy;
        const n = Math.max(2, Math.ceil(pc.graus / PASSO_CURVA_GRAUS), Math.ceil((R * ang) / PASSO_CURVA_M));
        const h0 = frente(psi), r0 = direita(psi), cx = x + s * r0[0] * R, cz = z + s * r0[2] * R, y0 = y;
        const incl = (op.incl || 0) * s;
        for (let j = 1; j <= n; j++) {
          const d = (ang * j) / n, t = j / n;
          poe(cx - s * r0[0] * R * Math.cos(d) + h0[0] * R * Math.sin(d), y0 + dy * suave(t), cz - s * r0[2] * R * Math.cos(d) + h0[2] * R * Math.sin(d), { larg: lp, incl });
        }
        const u = pts[pts.length - 1].p;
        x = u[0]; y = y0 + dy; z = u[2]; psi -= s * ang; comp += R * ang;
        fecha(op, i0);
      } else if (pc.tipo === 'rampa') {
        const C = op.comp ?? 30, H = op.altura ?? 4, V = op.vao ?? 16, Q = op.queda ?? 1.5, Po = op.pouso ?? 36;
        const h = frente(psi), x0 = x, y0 = y, z0 = z;
        const em = (sx, sy) => [x0 + h[0] * sx, y0 + sy, z0 + h[2] * sx];
        // perfil de trampolim: concavo (o fim e o mais inclinado). O ponto "fantasma" 3 m depois da crista continua subindo dentro do
        // vao: sem ele a CatmullRom achata a tangente da crista (o proximo ponto e o pouso, mais baixo) e o carro sairia quase reto.
        const incl = Math.atan2(0.75 * H, 0.5 * C);
        const lista = [[0.5 * C, 0.25 * H], [C, H], [C + 3, H + 3 * Math.tan(incl) * 0.7], [C + V, H - Q], [C + V + Po * 0.5, (H - Q) * 0.3], [C + V + Po, 0]];
        const idx = [];
        for (const [sx, sy] of lista) { const p = em(sx, sy); poe(p[0], p[1], p[2], { larg: lp }); idx.push(atual()); }
        const iC = idx[1], iP = idx[3];
        trechos.push({ de: iC - 0.12, ate: iC, tipo: 'lanca' });
        trechos.push({ de: iC, ate: iP - 0.02, tipo: 'vao' });
        x = x0 + h[0] * (C + V + Po); z = z0 + h[2] * (C + V + Po); comp += C + V + Po;
        elevados.push({ de: i0, ate: atual() });
        figuras.push({ tipo: 'rampa', de: i0, ate: atual(), crista: iC, pouso: iP, altura: H, vao: V, perigo: op.perigo || null });
        fecha({ ...op, elevado: false }, i0);
      } else if (pc.tipo === 'loop') {
        const lL = op.larg ?? Math.min(lp, 12), lado = op.lado === 'esq' ? -1 : 1;
        const desloca = (op.desloca ?? lL + 4) * lado, h = frente(psi);
        const lp2 = geraLoop({ inicio: [x, y, z], direcao: h, raio: op.raio ?? 11, desloca, passoGraus: op.passoGraus ?? 30, largura: lL });
        trocaEmenda(lp2[0]);
        for (let j = 1; j < lp2.length; j++) pts.push(lp2[j]);
        const i1 = atual();
        trechos.push({ de: i0, ate: i1, tipo: 'magnetico' });
        const u = pts[i1].p; x = u[0]; y = u[1]; z = u[2];
        comp += 2 * Math.PI * (op.raio ?? 11);
        elevados.push({ de: i0, ate: i1 });
        figuras.push({ tipo: 'loop', de: i0, ate: i1, raio: op.raio ?? 11 });
        fecha({ ...op, elevado: false }, i0);
      } else if (pc.tipo === 'saca') {
        const r = op.raio ?? 8, L = op.comp ?? 96, n = op.passos ?? 16, lado = op.lado === 'esq' ? -1 : 1, lS = op.larg ?? Math.min(lp, 12);
        const h = frente(psi), R = direita(psi), x0 = x, y0 = y, z0 = z;
        const P = (u) => {
          const th = 2 * Math.PI * suave(u), c = Math.cos(th), sn = Math.sin(th);
          const off = [R[0] * lado * sn * r, r - c * r, R[2] * lado * sn * r];
          return { p: [x0 + h[0] * L * u + off[0], y0 + off[1], z0 + h[2] * L * u + off[2]], cima: [-R[0] * lado * sn, c, -R[2] * lado * sn], larg: lS };
        };
        trocaEmenda(P(0));
        for (let j = 1; j <= n; j++) pts.push(P(j / n));
        const i1 = atual();
        trechos.push({ de: i0, ate: i1, tipo: 'magnetico' });
        x = x0 + h[0] * L; z = z0 + h[2] * L; comp += Math.hypot(L, 2 * Math.PI * r);
        elevados.push({ de: i0, ate: i1 });
        figuras.push({ tipo: 'saca_rolha', de: i0, ate: i1, raio: r });
        fecha({ ...op, elevado: false }, i0);
      } else if (pc.tipo === 'paredao') {
        const s = pc.lado, ang = pc.graus * GRAU, R = pc.raio, bmax = (op.inclMax ?? 65) * GRAU, lW = op.larg ?? lp;
        const n = Math.max(6, Math.ceil(pc.graus / 10));
        const h0 = frente(psi), r0 = direita(psi), cx = x + s * r0[0] * R, cz = z + s * r0[2] * R, y0 = y;
        const Pd = (j) => {
          const d = (ang * j) / n, b = bmax * Math.sin((Math.PI * j) / n) ** 2;
          const ps = psi - s * d, rk = direita(ps);
          // o centro SOBE junto com a inclinacao: a borda de dentro fica sempre 20 cm acima do chao (deitada a 65 graus, a meia largura
          // de 7 m desceria 6 m para dentro da terra)
          const yc = y0 + (lW * 0.5) * Math.sin(b) + 0.2 * Math.sin((Math.PI * j) / n);
          return { p: [cx - s * r0[0] * R * Math.cos(d) + h0[0] * R * Math.sin(d), yc, cz - s * r0[2] * R * Math.cos(d) + h0[2] * R * Math.sin(d)],
            cima: [s * rk[0] * Math.sin(b), Math.cos(b), s * rk[2] * Math.sin(b)], larg: lW };
        };
        trocaEmenda({ ...Pd(0), p: pts[pts.length - 1].p });
        for (let j = 1; j <= n; j++) pts.push(Pd(j));
        const i1 = atual();
        trechos.push({ de: i0, ate: i1, tipo: 'magnetico' });
        const u = pts[i1].p; x = u[0]; y = y0; z = u[2]; psi -= s * ang; comp += R * ang;
        pts[i1].p[1] = y0;
        elevados.push({ de: i0, ate: i1 });
        figuras.push({ tipo: 'paredao', de: i0, ate: i1, inclMax: op.inclMax ?? 65 });
        fecha({ ...op, elevado: false }, i0);
      } else if (pc.tipo === 'conecta') {
        const P0 = [x, y, z], P3 = pc.alvo.p, h0 = frente(psi), h3 = frente(pc.alvo.rumo);
        const d = Math.hypot(P3[0] - P0[0], P3[2] - P0[2]), a = op.alca ?? 0.38 * d;
        const P1 = [P0[0] + h0[0] * a, P0[1], P0[2] + h0[2] * a], P2 = [P3[0] - h3[0] * a, P3[1], P3[2] - h3[2] * a];
        const B = (t) => { const u = 1 - t; return [0, 1, 2].map((c) => u * u * u * P0[c] + 3 * u * u * t * P1[c] + 3 * u * t * t * P2[c] + t * t * t * P3[c]); };
        let Lb = 0, ant = P0; for (let j = 1; j <= 64; j++) { const q = B(j / 64); Lb += Math.hypot(q[0] - ant[0], q[1] - ant[1], q[2] - ant[2]); ant = q; }
        const n = Math.max(2, Math.ceil(Lb / 22));
        for (let j = 1; j < n; j++) { const q = B(j / n); poe(q[0], q[1], q[2], { larg: lp }); }
        x = P3[0]; y = P3[1]; z = P3[2]; psi = pc.alvo.rumo; comp += Lb;
        fecha(op, i0);
      } else throw new Error('pedaco desconhecido: ' + pc.tipo);
    }
    // altura que sobrou (so a principal fecha): o pedaco 'resto' a absorve na segunda passada
    const restoCalc = temResto ? -somaY : 0;
    return { pts, trechos, figuras, elevados, marcos, direcoes, fim: [x, y, z], psiFim: psi, restoY: restoCalc, comp };
  }
}

/** Uma linha (x, z) que ATRAVESSA a pista no meio de um pedaco nomeado — o rio de lava debaixo da ponte, o rio da selva debaixo do
 *  salto, o lago dentro de um bojo. Se o pedaco e uma rampa, o meio e o meio do VAO. Devolve { pontos: [[x, z], [x, z]], larg }. */
export function travessia(tracado, nome, { comp = 500, larg = 22, desvio = 0, curva = 40, ondas = 2.2, fase = 0.7 } = {}) {
  const m = tracado.marcos[nome];
  if (!m) throw new Error('travessia: pedaco sem nome ' + nome);
  const P = (k) => tracado.pontos[Math.round(k)].p;
  const f = (tracado.figuras || []).find((g) => g.ate === m.i && g.tipo === 'rampa');
  const a = f ? P(f.crista) : P(m.i0), b = f ? P(f.pouso) : P(m.i);
  const cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
  const px = -dz / L, pz = dx / L, tx = dx / L, tz = dz / L;
  const ox = cx + tx * desvio, oz = cz + tz * desvio;
  // o rio serpenteia (`curva` m para os lados, `ondas` meandros no comprimento todo) e so fica reto perto da pista (60 m de cada lado):
  // e ali que o vao/a ponte tem de cair em cima dele
  const pontos = [];
  for (let k = 0; k <= 24; k++) {
    const u = k / 24 - 0.5, dist = Math.abs(u * comp), reto = Math.min(1, Math.max(0, (dist - 60) / 90));
    const lat = curva * Math.sin(u * Math.PI * 2 * ondas + fase) * reto * reto;
    pontos.push([ox + px * u * comp + tx * lat, oz + pz * u * comp + tz * lat]);
  }
  return { pontos, larg };
}

/** O lago de dentro de um bojo (o trecho da principal entre dois nomes): centro no meio dos pontos do bojo, raio que nao encosta na
 *  pista (folga em m). Devolve { x, z, r }. */
export function lagoNoBojo(tracado, de, ate, folga = 16) {
  const A = tracado.marcos[de], B = tracado.marcos[ate];
  const pts = tracado.pontos.slice(A.i, B.i + 1).map((c) => c.p);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  let r = Infinity; for (const p of pts) r = Math.min(r, Math.hypot(p[0] - cx, p[2] - cz));
  return { x: cx, z: cz, r: Math.max(10, r - folga) };
}
