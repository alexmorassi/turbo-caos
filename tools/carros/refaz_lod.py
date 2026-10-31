# REFAZ A VERSAO LEVE DE UM CARRO DO CIDADE ABERTA - a parte de numeros (numpy/scipy) do tools/carros/refaz_lod.mjs (leia la o porque).
# As funcoes de carta, empacotamento, rasterizacao e visibilidade sao as do cidadeaberta/tools/lodatlas.py (Morassi/Claude, Cidade
# Aberta), copiadas com o ATLAS de 2048 (aqui a faixa ja nasce no tamanho do jogo: 2048 x 256) e com duas coisas a mais:
#   * `pele`: a visibilidade marca TRIANGULOS da malha cheia (o lodatlas marca amostras so para pintar) e conta so a amostra VIRADA para
#     quem olha - e assim que a casca de dentro (o forro da porta do Fusca) sai antes da reducao;
#   * `faixa`: cada triangulo leve fica virado para FORA (o lado de onde a pele foi vista) antes das normais: no Meshy a ordem dos cantos
#     nao e confiavel (o jogo desenha os dois lados) e a normal contra o triangulo vira mancha escura (o lodnormals.py de la).
# uso: python3 refaz_lod.py pele <pasta>   |   python3 refaz_lod.py faixa <pasta>
import json, os, sys, time
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:5.1f}s]', *a, flush=True)
ATLAS = 2048          # o atlas de origem (KTX2 de 2048) e o jogo: a faixa sai em 2048 x FAIXA
FAIXA = 256           # 12,5 % de baixo (v de 0,875 a 1): a mesma faixa das *_lo do Cidade Aberta, que o otimiza.mjs recorta
PAD = 3           # px de folga entre cartas (o lodatlas usa 2 num atlas de 4096; aqui o mipmap de 2048 puxa a vizinha mais cedo)
AMOSTRA = 0.003       # m entre amostras na malha cheia (a celula do z-buffer de pontos e 4 mm: cada celula tem amostra)
CELULA, TOL = 0.004, 0.0025   # z-buffer de pontos do lodatlas.py visible()
VIRADO = 0.05         # a amostra so conta se o triangulo dela olha para a vista (cos > 0,05)
TAMPA = 0.6           # m: laco de borda da pele menor que isso e rachadura (os lacos grandes sao janela, roda, teto solar e a barra de baixo)

def le(pasta, nome, tipo, cols):
    return np.fromfile(os.path.join(pasta, nome), dtype=tipo).reshape(-1, cols)

def direcoes(embaixo=False):
    D = [np.array(v, float) for v in [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)] + [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]]
    if not embaixo: D = [d for d in D if d[1] >= 0]   # por baixo o modelo do Meshy e aberto: a casca de dentro vira "fora" (lodatlas.py)
    return [d / np.linalg.norm(d) for d in D]

def amostras(P, F, passo, semente=3):
    """Pontos espalhados em cada triangulo (pelo menos o centro), com o triangulo de cada um."""
    A, B, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    fn = np.cross(B - A, C - A); ar = np.linalg.norm(fn, axis=1); fn /= np.maximum(ar, 1e-15)[:, None]; ar /= 2
    cnt = np.maximum(1, np.round(ar / passo ** 2).astype(np.int64)); tri = np.repeat(np.arange(len(F)), cnt)
    rs = np.random.RandomState(semente); r1 = np.sqrt(rs.rand(len(tri))); r2 = rs.rand(len(tri))
    primeiro = np.concatenate([[0], np.cumsum(cnt)[:-1]]); r1[primeiro] = np.sqrt(2 / 3); r2[primeiro] = 0.5   # a primeira de cada um e o centro
    S = A[tri] * (1 - r1)[:, None] + B[tri] * (r1 * (1 - r2))[:, None] + C[tri] * (r1 * r2)[:, None]
    return S, tri, fn, ar

def visiveis(S, nS, dirs):
    """Para cada amostra: em que vista ela fica na frente E virada para quem olha (-1 = nenhuma). Z-buffer de pontos do lodatlas.py."""
    quem = np.full(len(S), -1, np.int64)
    for i, d in enumerate(dirs):
        e1 = np.cross(d, [0, 1, 0] if abs(d[1]) < 0.9 else [1, 0, 0]); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1)
        u = np.floor(S @ e1 / CELULA).astype(np.int64); v = np.floor(S @ e2 / CELULA).astype(np.int64); z = S @ d
        key = (u - u.min()) * (v.max() - v.min() + 1) + (v - v.min()); _, inv = np.unique(key, return_inverse=True); inv = inv.ravel()
        top = np.full(inv.max() + 1, -1e9); np.maximum.at(top, inv, z)
        ok = (z >= top[inv] - TOL) & (np.abs(nS @ d) > VIRADO) & (quem < 0)
        quem[ok] = i
    return quem

def solda_pos(P, F):
    """Solda por posicao (para as cartas enxergarem vizinhos numa malha 'sopa'): devolve os vertices soldados e os triangulos neles."""
    key = np.round(P * 1e5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return P[first], inv.ravel()[F]

def lacos_de_borda(P, F):
    """Arestas de borda (usadas por um triangulo so) agrupadas em lacos: (arestas, rotulo do laco de cada aresta, perimetro de cada laco)."""
    import scipy.sparse as sp, scipy.sparse.csgraph as cg
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), 1)
    u, c = np.unique(e, axis=0, return_counts=True); b = u[c == 1]
    if not len(b): return b, np.zeros(0, np.int64), np.zeros(0)
    _, lab = cg.connected_components(sp.coo_matrix((np.ones(len(b)), (b[:, 0], b[:, 1])), shape=(len(P), len(P))), directed=False)
    _, lb = np.unique(lab[b[:, 0]], return_inverse=True); lb = lb.ravel()
    per = np.bincount(lb, weights=np.linalg.norm(P[b[:, 0]] - P[b[:, 1]], axis=1))
    return b, lb, per

def cmd_pele(pasta):
    P = le(pasta, 'cheia_pos.f32', np.float32, 3).astype(np.float64); F = le(pasta, 'cheia_idx.u32', np.uint32, 3).astype(np.int64)
    S, tri, fn, ar = amostras(P, F, AMOSTRA); log('malha cheia:', len(F), 'triangulos,', len(S), 'amostras')
    dirs = direcoes()
    quem = visiveis(S, fn[tri], dirs)
    # o triangulo e PELE DE FORA se alguma amostra dele aparece. (Exigir metade das amostras vistas tirou os vidros, que ficam 2 mm para
    # dentro da moldura, e 36 % da area: furos. O pedaco da casca de dentro que so aparece pela fresta de uma rachadura fica na geometria,
    # mas nao empresta cor: a pintura usa so a AMOSTRA vista - cmd_faixa)
    fora = np.zeros(len(F), bool); fora[tri[quem >= 0]] = True
    lado = np.zeros((len(F), 3)); D = np.array(dirs)
    np.add.at(lado, tri[quem >= 0], D[quem[quem >= 0]])
    sinal = np.where((fn * lado).sum(1) >= 0, 1, -1)   # normal geometrica do triangulo apontando para o lado de onde ele foi visto
    log('pele de fora: %d de %d triangulos (%.1f %%, %.1f %% da area)' % (fora.sum(), len(F), 100 * fora.mean(), 100 * ar[fora].sum() / ar.sum()))
    np.where(fora)[0].astype(np.uint32).tofile(os.path.join(pasta, 'pele_tri.u32'))   # de onde vem a COR (so triangulo de origem tem UV)
    (sinal[fora]).astype(np.int8).tofile(os.path.join(pasta, 'pele_sinal.i8'))
    # A GEOMETRIA: a pele tem as RACHADURAS da lataria do Meshy (o Cidade Aberta tampou as de raio < 4 cm; as da porta sobraram finas) e,
    # vista por elas, a casca de dentro. Reduzida, cada rachadura virava um furo de 10 a 25 cm na porta (cacos escuros: o lado de dentro
    # aparecendo) e a casca de dentro furava a de fora. Tampa: todo laco de borda de perimetro < TAMPA vira um leque ate o centro dele;
    # depois a visibilidade roda de novo e o que a tampa escondeu (a casca de dentro) sai.
    WP, WF = solda_pos(P, F[fora])
    b, lb, per = lacos_de_borda(WP, WF)
    pequenos = per < TAMPA; arestas = b[pequenos[lb]]; laco = lb[pequenos[lb]]
    soma = np.zeros((len(per), 3)); n = np.zeros(len(per)); np.add.at(soma, lb, WP[b[:, 0]] + WP[b[:, 1]]); np.add.at(n, lb, 2)
    centros = soma / np.maximum(n, 1)[:, None]
    ids = np.full(len(per), -1, np.int64); usados = np.unique(laco); ids[usados] = len(WP) + np.arange(len(usados))
    P2 = np.concatenate([WP, centros[usados]]); F2 = np.concatenate([WF, np.stack([arestas[:, 0], arestas[:, 1], ids[laco]], 1)])
    log('tampas: %d lacos de borda, %d com perimetro < %.0f cm (%d triangulos novos)' % (len(per), len(usados), TAMPA * 100, len(arestas)))
    S2, tri2, fn2, ar2 = amostras(P2, F2, AMOSTRA)
    q2 = visiveis(S2, fn2[tri2], dirs); f2 = np.zeros(len(F2), bool); f2[tri2[q2 >= 0]] = True
    log('pele tampada: %d de %d triangulos ficam (%.1f %% da area)' % (f2.sum(), len(F2), 100 * ar2[f2].sum() / ar2.sum()))
    P2.astype(np.float32).tofile(os.path.join(pasta, 'pele_pos.f32')); F2[f2].astype(np.uint32).tofile(os.path.join(pasta, 'pele_idx.u32'))
    F2[len(WF):].astype(np.uint32).tofile(os.path.join(pasta, 'tampa_idx.u32'))   # as tampas sozinhas: tapam a fresta na hora de pintar

# ---------------------------------------------------------------- cartas e empacotamento (lodatlas.py, ATLAS 2048)
def charts(P, F):
    a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; fn = np.cross(b - a, c - a); ar = np.linalg.norm(fn, axis=1); fn /= np.maximum(ar, 1e-15)[:, None]; ar /= 2
    NF = len(F); e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); e.sort(axis=1); fid = np.tile(np.arange(NF), 3)
    o = np.lexsort((e[:, 1], e[:, 0])); e, fid = e[o], fid[o]; same = (e[1:] == e[:-1]).all(1); A, B = fid[:-1][same], fid[1:][same]
    AX = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], float); dots = fn @ AX.T; cls = dots.argmax(1)
    for it in range(8):
        votes = np.zeros((NF, 6)); np.add.at(votes, (A, cls[B]), ar[B] + 1e-9); np.add.at(votes, (B, cls[A]), ar[A] + 1e-9); votes[np.arange(NF), cls] += ar * 0.6
        votes[dots < 0.42] = -1; new = votes.argmax(1); ch = (new != cls).sum(); cls = new
        if ch < NF * 0.001: break
    lab = np.arange(NF); ok = cls[A] == cls[B]; A2, B2 = A[ok], B[ok]
    for it in range(2000):
        m = np.minimum(lab[A2], lab[B2]); new = lab.copy(); np.minimum.at(new, A2, m); np.minimum.at(new, B2, m); new = new[new]
        if np.array_equal(new, lab): break
        lab = new
    _, chart = np.unique(lab, return_inverse=True); chart = chart.ravel()
    UA = np.array([2, 2, 0, 0, 0, 0]); VA = np.array([1, 1, 2, 2, 1, 1]); corner = F.reshape(-1); ccl = np.repeat(cls, 3); P3 = P[corner]
    U = P3[np.arange(len(corner)), UA[ccl]]; V = P3[np.arange(len(corner)), VA[ccl]]
    GRID = 0.5; uc = U.reshape(-1, 3).mean(1); vc = V.reshape(-1, 3).mean(1); tile = np.stack([chart, np.floor(uc / GRID).astype(np.int64), np.floor(vc / GRID).astype(np.int64)], 1)
    _, chart = np.unique(tile, axis=0, return_inverse=True); return chart.ravel(), U, V

def pack_strip(chart, U, V, y0, H):
    NC = chart.max() + 1; cch = np.repeat(chart, 3)
    umin = np.full(NC, 1e9); vmin = np.full(NC, 1e9); umax = np.full(NC, -1e9); vmax = np.full(NC, -1e9)
    np.minimum.at(umin, cch, U); np.minimum.at(vmin, cch, V); np.maximum.at(umax, cch, U); np.maximum.at(vmax, cch, V)
    rot = (vmax - vmin) > (umax - umin); U, V = np.where(rot[cch], V, U), np.where(rot[cch], U, V)
    umin, vmin, umax, vmax = np.where(rot, vmin, umin), np.where(rot, umin, vmin), np.where(rot, vmax, umax), np.where(rot, umax, vmax); cw0 = umax - umin; ch0 = vmax - vmin
    def pack(scale):
        w = np.ceil(cw0 * scale).astype(int) + 2 * PAD + 1; h = np.ceil(ch0 * scale).astype(int) + 2 * PAD + 1; order = np.argsort(-h, kind='stable'); X = np.zeros(NC, int); Y = np.zeros(NC, int); x = y = 0; rowh = 0
        for k in order:
            if w[k] > ATLAS: return None
            if x + w[k] > ATLAS: x = 0; y += rowh; rowh = 0
            if y + h[k] > H: return None
            X[k] = x; Y[k] = y; x += w[k]; rowh = max(rowh, h[k])
        return X, Y
    lo, hi = 1.0, 4000.0
    for it in range(24):
        mid = (lo + hi) / 2
        if pack(mid) is None: hi = mid
        else: lo = mid
    CX, CY = pack(lo); PX = (U - umin[cch]) * lo + CX[cch] + PAD + 0.5; PY = (V - vmin[cch]) * lo + CY[cch] + y0 + PAD + 0.5
    return PX, PY, lo

def raster(T, W, H0=0):
    """Texels (centros) dentro de cada triangulo (T: (F, 3, 2) em pixels), com 0,75 px de folga na borda. Devolve (y, x), triangulo, baricentricas."""
    tx, ty = T[:, :, 0], T[:, :, 1]; x0 = np.floor(tx.min(1) - 1).astype(int); y0 = np.floor(ty.min(1) - 1).astype(int)
    bw = np.ceil(tx.max(1) + 1).astype(int) - x0 + 1; bh = np.ceil(ty.max(1) + 1).astype(int) - y0 + 1; size = np.maximum(bw, bh)
    classes = [4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 2048]; PIX, TR, WB = [], [], []
    for ci, cs in enumerate(classes):
        sel = np.where((size <= cs) & (size > (classes[ci - 1] if ci else 0)))[0]
        if not len(sel): continue
        gy, gx = np.mgrid[0:cs, 0:cs]; gx = gx.ravel(); gy = gy.ravel(); step = max(1, int(2.5e6 // (cs * cs)))
        for s0 in range(0, len(sel), step):
            t = sel[s0:s0 + step]; X = x0[t][:, None] + gx[None] + 0.5; Y = y0[t][:, None] + gy[None] + 0.5
            ax, ay, bx, by, cx, cy = tx[t, 0][:, None], ty[t, 0][:, None], tx[t, 1][:, None], ty[t, 1][:, None], tx[t, 2][:, None], ty[t, 2][:, None]
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); den = np.where(np.abs(den) < 1e-9, 1e-9, den)
            w0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den; w1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den; w2 = 1 - w0 - w1
            a2 = np.abs(den); h0 = a2 / np.sqrt((bx - cx) ** 2 + (by - cy) ** 2 + 1e-12); h1 = a2 / np.sqrt((cx - ax) ** 2 + (cy - ay) ** 2 + 1e-12); h2 = a2 / np.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + 1e-12)
            ins = (w0 >= -0.75 / np.maximum(h0, 1e-6)) & (w1 >= -0.75 / np.maximum(h1, 1e-6)) & (w2 >= -0.75 / np.maximum(h2, 1e-6)) & (np.minimum(np.minimum(w0, w1), w2) > -3) & (X >= 0) & (X < W) & (Y >= H0) & (Y < W)
            r, q = np.where(ins); PIX.append(np.stack([Y[r, q].astype(int), X[r, q].astype(int)], 1)); TR.append(t[r]); WB.append(np.stack([w0[r, q], w1[r, q], w2[r, q]], 1))
    return np.concatenate(PIX), np.concatenate(TR), np.concatenate(WB)

def cmd_faixa(pasta):
    y0 = ATLAS - FAIXA
    meta = json.load(open(os.path.join(pasta, 'pecas.json')))
    # a pele de fora da malha cheia (de onde vem a cor da carroceria) e a malha leve ja reduzida (soldada por posicao)
    HP = le(pasta, 'cheia_pos.f32', np.float32, 3).astype(np.float64); HF = le(pasta, 'cheia_idx.u32', np.uint32, 3).astype(np.int64)
    HUV = le(pasta, 'cheia_uv.f32', np.float32, 2).astype(np.float64)
    pele = np.fromfile(os.path.join(pasta, 'pele_tri.u32'), np.uint32).astype(np.int64); sinal = np.fromfile(os.path.join(pasta, 'pele_sinal.i8'), np.int8).astype(np.float64)
    HF = HF[pele]
    P = le(pasta, 'leve_pos.f32', np.float32, 3).astype(np.float64); F = le(pasta, 'leve_idx.u32', np.uint32, 3).astype(np.int64)
    S, tri, hfn, _ = amostras(HP, HF, 0.002)    # mais fino que o texel da faixa (~1,5 cm)
    # so a AMOSTRA que aparece de fora empresta cor (o lodatlas.py: "so a pele de fora"): o triangulo da casca de dentro que entrou na pele
    # por uma fresta tem quase todas as amostras escondidas - e a cor dele (forro claro, sombra escura) fazia cacos na porta
    # (com as TAMPAS na frente: pela rachadura aparecia a casca de dentro, pintada de sombra no Meshy, e o triangulo leve que passava
    # alguns mm para dentro da lataria pegava essa cor - 174 cacos escuros na porta)
    TP = le(pasta, 'pele_pos.f32', np.float32, 3).astype(np.float64); TF = le(pasta, 'tampa_idx.u32', np.uint32, 3).astype(np.int64)
    St, _, ft, _ = amostras(TP, TF, 0.002) if len(TF) else (np.zeros((0, 3)), None, np.zeros((0, 3)), None)
    trt = np.zeros(0, np.int64)
    if len(TF): St, trt, ft, _ = amostras(TP, TF, 0.002)
    quem = visiveis(np.concatenate([S, St]), np.concatenate([hfn[tri], ft[trt]]), direcoes())[:len(S)]; vis = quem >= 0
    hfn = hfn * sinal[:, None]                  # normal da pele apontando para FORA
    S, tri = S[vis], tri[vis]
    arvore = cKDTree(S); log('pele de fora: %d triangulos, %d amostras vistas (%.0f %%)' % (len(HF), len(S), 100 * vis.mean()))
    # 1) a malha leve vista de fora, ela mesma (as mesmas 9 vistas): o triangulo que nenhuma vista alcanca e camada que sobrou por dentro
    #    (dupla com a de fora: cacos escuros brigando com a lataria) e sai; o que aparece fica virado para o lado de onde foi visto (a
    #    normal da pele mais perto so desempata quem nao foi visto - a casca dupla dava normais dos dois lados ali)
    A, B, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; fn = np.cross(B - A, C - A); fn /= np.maximum(np.linalg.norm(fn, axis=1), 1e-15)[:, None]
    S2, tri2, _, _ = amostras(P, F, AMOSTRA); dirs = direcoes(); D = np.array(dirs)
    q2 = visiveis(S2, fn[tri2], dirs); lado = np.zeros((len(F), 3)); np.add.at(lado, tri2[q2 >= 0], D[q2[q2 >= 0]])
    visto = np.abs(lado).sum(1) > 0
    _, nn = arvore.query((A + B + C) / 3, k=6, workers=-1); fora = np.where(visto[:, None], lado, hfn[tri[nn]].mean(1))
    vira = (fn * fora).sum(1) < 0; F[vira] = F[vira][:, [0, 2, 1]]; fn[vira] *= -1
    F, fn = F[visto], fn[visto]
    log('malha leve: %d triangulos vistos de fora (%d escondidos sairam, %d virados para fora)' % (len(F), (~visto).sum(), vira[visto].sum()))
    # a reducao tambem abre furo (o colapso que atravessa uma camada que sobrou, o triangulo escondido que saiu): o laco de borda pequeno
    # da malha leve ganha a mesma tampa em leque (furo na porta = o lado de dentro escuro aparecendo, em forma de triangulo)
    b, lb, per = lacos_de_borda(P, F)
    pequenos = per < TAMPA; arestas = b[pequenos[lb]]; laco = lb[pequenos[lb]]
    if len(arestas):
        soma = np.zeros((len(per), 3)); nn2 = np.zeros(len(per)); np.add.at(soma, lb, P[b[:, 0]] + P[b[:, 1]]); np.add.at(nn2, lb, 2)
        usados = np.unique(laco); ids = np.full(len(per), -1, np.int64); ids[usados] = len(P) + np.arange(len(usados))
        P = np.concatenate([P, (soma / np.maximum(nn2, 1)[:, None])[usados]])
        Fn = np.stack([arestas[:, 0], arestas[:, 1], ids[laco]], 1)
        A, B, C = P[Fn[:, 0]], P[Fn[:, 1]], P[Fn[:, 2]]; fnn = np.cross(B - A, C - A); fnn /= np.maximum(np.linalg.norm(fnn, axis=1), 1e-15)[:, None]
        _, nn3 = arvore.query((A + B + C) / 3, k=6, workers=-1); vf = (fnn * hfn[tri[nn3]].mean(1)).sum(1) < 0
        Fn[vf] = Fn[vf][:, [0, 2, 1]]; fnn[vf] *= -1
        F = np.concatenate([F, Fn]); fn = np.concatenate([fn, fnn])
        log('furos da malha leve: %d lacos, %d tampados (%d triangulos)' % (len(per), len(usados), len(Fn)))
    A, B, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; fa = np.cross(B - A, C - A)
    VN = np.zeros_like(P); np.add.at(VN, F[:, 0], fa); np.add.at(VN, F[:, 1], fa); np.add.at(VN, F[:, 2], fa); VN /= np.maximum(np.linalg.norm(VN, axis=1), 1e-15)[:, None]
    # 2) as PECAS que dividem a faixa: a carroceria nova e as quatro rodas leves de origem (as rodas estao boas, mas a UV delas aponta para a
    #    faixa de origem, que e trocada inteira: elas ganham cartas novas e a cor vem da propria faixa de origem pela UV antiga)
    # normal por CANTO que concorda com o triangulo (o lodatlas.py faz igual): a media do vertice soldado, onde a pele dobra ou junta duas
    # camadas, apontava para DENTRO em 7 % dos triangulos (manchas escuras na porta); ai o canto fica com a normal do proprio triangulo
    VNsuave = VN[F.reshape(-1)].copy()
    NC = VN[F.reshape(-1)].reshape(-1, 3, 3); contra = (NC * fn[:, None, :]).sum(2) < 0.5
    NC[contra] = np.repeat(fn[:, None, :], 3, 1)[contra]; log('cantos com a normal do triangulo: %d de %d' % (contra.sum(), contra.size))
    pecas = [{ 'nome': 'body_lo', 'pos': P[F.reshape(-1)], 'nor': NC.reshape(-1, 3), 'uvVelha': None, 'fn': fn }]
    for r in meta['rodas']:
        rp = le(pasta, r + '_pos.f32', np.float32, 3).astype(np.float64); ru = le(pasta, r + '_uv.f32', np.float32, 2).astype(np.float64)
        rn = le(pasta, r + '_nor.f32', np.float32, 3).astype(np.float64); ri = le(pasta, r + '_idx.u32', np.uint32, 3).astype(np.int64)
        pecas.append({ 'nome': r, 'pos': rp[ri.reshape(-1)], 'nor': rn[ri.reshape(-1)], 'uvVelha': ru[ri.reshape(-1)] })
    # cartas por peca (soldada por posicao so para achar vizinhos), empacotadas juntas; os vertices saem por canto (sopa: o otimiza solda)
    CH, UU, VV, base = [], [], [], 0
    for pc in pecas:
        WP, WF = solda_pos(pc['pos'], np.arange(len(pc['pos'])).reshape(-1, 3))
        ch, U, V = charts(WP, WF); CH.append(ch + base); UU.append(U); VV.append(V); base += ch.max() + 1; pc['ntri'] = len(WF)
    chart = np.concatenate(CH); U = np.concatenate(UU); V = np.concatenate(VV); log('cartas:', chart.max() + 1, '(%s)' % ', '.join('%s %d tri' % (p['nome'], p['ntri']) for p in pecas))
    PX, PY, esc = pack_strip(chart, U, V, y0, FAIXA); log('escala da faixa: %.0f px por metro (texel de %.1f mm)' % (esc, 1000 / esc))
    UVN = np.stack([PX / ATLAS, PY / ATLAS], 1)   # UV nova de cada canto, na ordem das pecas
    TODOS = np.concatenate([pc['pos'] for pc in pecas]); NT = len(TODOS) // 3
    peca_do_tri = np.concatenate([np.full(pc['ntri'], k) for k, pc in enumerate(pecas)])
    # 3) cada texel da faixa: na carroceria, o ponto da pele de fora mais perto olhando para o mesmo lado -> UV da malha cheia; na roda,
    #    a UV antiga do proprio triangulo (a cor e a da faixa de origem)
    PIX, TR, WB = raster((UVN * ATLAS).reshape(-1, 3, 2), ATLAS, y0); pts = (TODOS.reshape(-1, 3, 3)[TR] * WB[:, :, None]).sum(1); log('texels da faixa:', len(PIX))
    UVH = np.zeros((len(PIX), 2)); HA, HB, HC = HP[HF[:, 0]], HP[HF[:, 1]], HP[HF[:, 2]]
    corpo = np.where(peca_do_tri[TR] == 0)[0]
    # a normal de cada texel e a INTERPOLADA dos cantos (a da superficie suave), nao a do triangulo: o triangulo leve torto (dobra da
    # reducao) discordava de todas as 8 amostras mais perto e pegava a mais perto de qualquer jeito - um caco escuro do tamanho dele
    # (a SUAVE, de antes de cada canto ganhar a normal do proprio triangulo: o triangulo dobrado da reducao tem a normal torta e, com ela,
    # concordava com a fresta da porta e a moldura da janela - pegava cor de sombra)
    NCT = VNsuave.reshape(-1, 3, 3); sem = 0
    for s0 in range(0, len(corpo), 500000):
        q = corpo[s0:s0 + 500000]; nq = (NCT[TR[q]] * WB[q][:, :, None]).sum(1); nq /= np.maximum(np.linalg.norm(nq, axis=1), 1e-15)[:, None]
        # entre as 16 amostras mais perto que concordam na normal, a MAIS DE FORA (a casca de dentro que ficou a menos de 2,5 mm da de
        # fora passa no z-buffer como "vista" e tem a cor de sombra do Meshy: era o caco escuro na porta): nota = quanto a amostra esta
        # para fora do texel na normal dele - metade do quanto ela esta de lado
        dist, nn_ = arvore.query(pts[q], k=16, workers=-1); tt = tri[nn_]
        concorda = np.abs((hfn[tt] * nq[:, None, :]).sum(2)) > 0.3   # abs: a lataria tem os dois lados (o lodatlas.py tambem)
        dv = S[nn_] - pts[q][:, None, :]; fora_ = (dv * nq[:, None, :]).sum(2); lado_ = np.linalg.norm(dv - fora_[:, :, None] * nq[:, None, :], axis=2)
        nota = fora_ - 0.5 * lado_ - np.where(concorda, 0, 1e3)
        nenhum = ~concorda.any(1); sem += nenhum.sum()
        if nenhum.any():   # ninguem concorda entre as 16: procura entre 64 (a mais perto que concorda)
            d2, n2 = arvore.query(pts[q[nenhum]], k=64, workers=-1); t2 = tri[n2]; c2 = np.abs((hfn[t2] * nq[nenhum][:, None, :]).sum(2)) > 0.3
            k2 = (d2 + np.where(c2, 0, 1e3)).argmin(1); tt[nenhum, 0] = t2[np.arange(len(k2)), k2]; nota[nenhum, 0] = 1e9
        t = tt[np.arange(len(q)), nota.argmax(1)]
        a, b, c = HA[t], HB[t], HC[t]; v0 = b - a; v1 = c - a; v2 = pts[q] - a; d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1); d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1)
        den = np.where(np.abs(d00 * d11 - d01 * d01) < 1e-30, 1e-30, d00 * d11 - d01 * d01); wb = np.clip((d11 * d20 - d01 * d21) / den, 0, 1); wc = np.clip((d00 * d21 - d01 * d20) / den, 0, 1); s_ = np.maximum(wb + wc, 1); wb /= s_; wc /= s_; wa = 1 - wb - wc
        UVH[q] = HUV[HF[t, 0]] * wa[:, None] + HUV[HF[t, 1]] * wb[:, None] + HUV[HF[t, 2]] * wc[:, None]
    log('texels da carroceria sem amostra concordando entre as 8 mais perto: %d (%.1f %%)' % (sem, 100 * sem / max(1, len(corpo))))
    VELHA = np.concatenate([pc['uvVelha'] if pc['uvVelha'] is not None else np.zeros((len(pc['pos']), 2)) for pc in pecas]).reshape(-1, 3, 2)
    roda = np.where(peca_do_tri[TR] > 0)[0]
    UVH[roda] = (VELHA[TR[roda]] * np.clip(WB[roda], 0, 1)[:, :, None]).sum(1) / np.maximum(np.clip(WB[roda], 0, 1).sum(1), 1e-9)[:, None]
    for nome in ('cor', 'mr'):
        T = np.asarray(Image.open(os.path.join(pasta, nome + '.png')).convert('RGBA'), np.float32); H, W = T.shape[:2]
        fx = np.clip(UVH[:, 0] * W - 0.5, 0, W - 1.001); fy = np.clip(UVH[:, 1] * H - 0.5, 0, H - 1.001); ix = fx.astype(int); iy = fy.astype(int); dx = (fx - ix)[:, None]; dy = (fy - iy)[:, None]
        col = T[iy, ix] * (1 - dx) * (1 - dy) + T[iy, ix + 1] * dx * (1 - dy) + T[iy + 1, ix] * (1 - dx) * dy + T[iy + 1, ix + 1] * dx * dy
        faixa = np.zeros((FAIXA, ATLAS, 4), np.float32); tem = np.zeros((FAIXA, ATLAS), bool)
        faixa[PIX[:, 0] - y0, PIX[:, 1]] = col; tem[PIX[:, 0] - y0, PIX[:, 1]] = True
        # borda: o texel vazio pega a media dos vizinhos pintados (8 passadas: o filtro e o mipmap nao puxam preto para dentro da carta)
        for it in range(8):
            soma = np.zeros_like(faixa); n = np.zeros(tem.shape, np.float32)
            for dy_, dx_ in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                sf = np.roll(np.roll(faixa * tem[..., None], dy_, 0), dx_, 1); st = np.roll(np.roll(tem, dy_, 0), dx_, 1); soma += sf; n += st
            novo = ~tem & (n > 0); faixa[novo] = soma[novo] / n[novo][:, None]; tem |= novo
        Image.fromarray(np.clip(faixa + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(pasta, nome + '_faixa.png'))
    # 4) cada peca em sopa (3 vertices por triangulo: posicao, normal e a UV nova do canto)
    o = 0
    for pc in pecas:
        n = len(pc['pos']); nome = pc['nome']
        pc['pos'].astype(np.float32).tofile(os.path.join(pasta, 'refeita_%s_pos.f32' % nome)); pc['nor'].astype(np.float32).tofile(os.path.join(pasta, 'refeita_%s_nor.f32' % nome))
        UVN[o:o + n].astype(np.float32).tofile(os.path.join(pasta, 'refeita_%s_uv.f32' % nome)); o += n
    json.dump({ 'pecas': [p['nome'] for p in pecas], 'cartas': int(chart.max() + 1), 'pxPorMetro': float(esc), 'texels': int(len(PIX)) }, open(os.path.join(pasta, 'refeita.json'), 'w'))
    log('refeita: %s' % ', '.join('%s %d tri' % (p['nome'], p['ntri']) for p in pecas))


if __name__ == '__main__':
    cmd, pasta = sys.argv[1], sys.argv[2]
    {'pele': cmd_pele, 'faixa': cmd_faixa}[cmd](pasta)
