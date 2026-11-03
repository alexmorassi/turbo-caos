#!/usr/bin/env python3
"""PREPARA AS MUSICAS DO SUNO (02/11/2026, plano "Turbo Caos — musicas do Suno"): das 12 faixas inteiras que o Morassi gerou
("Turbo Caos - Orla.wav"...) sai, para cada uma, um MP3 com UM LOOP SEM EMENDA e a linha dela em config/musicas.js.

  python3 tools/musica/prepara.py "<pasta com os WAV/MP3>"            # as 12
  python3 tools/musica/prepara.py "<pasta>" --so orla menu           # so essas
  python3 tools/musica/prepara.py "<pasta>" --previa /tmp/previa     # + emendas.mp3 (a emenda de cada loop) e relatorio.json

Precisa de: numpy, scipy, soundfile, librosa, pyloudnorm, ffmpeg (libmp3lame) e a biblioteca do Rubber Band 3 (estica.py).

COMO (e por que):
  1. BATIDAS: o Suno NAO gera em andamento fixo — medido: a Orla acelera de 130,2 para 133,7 BPM ao longo da musica (residuo de
     +-200 ms contra uma grade unica). Por isso nao ha grade global: o beat tracker do librosa (tightness alta, quadro de 5,8 ms) marca
     cada batida e um ajuste linear em +-6 batidas tira o tremido de quadro. O BPM do prompt so impede cair no dobro ou na metade.
  2. COMPASSO: o loop dura compassos inteiros de 4 batidas (multiplo de 4 compassos: a frase). O tempo 1 NAO e procurado: medido nas
     12, bumbo, caixa e troca de acorde nao concordam sobre onde ele cai (as mixagens do Suno sao densas). Nao precisa: com o fim a um
     numero inteiro de compassos do comeco, os dois lados da emenda estao na mesma posicao do compasso — e a nota da emenda (passo 3)
     ja escolhe, entre as 4 posicoes, a que casa melhor.
  3. O LOOP: dura o que o plano pede (pistas 90-120 s, menu 60-90 s, podio 45-60 s; um pouco fora disso com pena, se a emenda de
     dentro for ruim), fora da introducao e do final. Vence a EMENDA mais parecida: as 8 batidas antes do fim contra as 8 antes do
     comeco, e as 8 depois do fim (o que a musica tocaria) contra as 8 depois do comeco (para onde o loop pula) — em acorde (chroma),
     timbre de cada batida (MFCC) e textura (MFCC medio das 8) —, mais o ritmo (curva de ataques alinhada) e um empurrao pequeno para o
     trecho mais animado.
  4. ANDAMENTO NA EMENDA: como a musica acelera, o fim do loop costuma estar ~2 % mais rapido que o comeco, e voltar de repente para o
     andamento do comeco se sente (a bateria "arrasta" por umas batidas). As ultimas RAMPA_BATIDAS do loop sao esticadas pelo Rubber
     Band (R3) numa rampa que leva o andamento do fim ao do comeco — 2 % em 8 compassos ninguem percebe, e no pulo nao ha degrau.
  5. EMENDA NO TEMPO: o fim e alinhado ao comeco pela curva de ataques (precisao de ~2 ms: batida fora do lugar no pulo e o que mais
     se ouve). Os ultimos CROSSFADE + SEGURA s do loop viram o que toca logo ANTES do comeco — primeiro misturando (cosseno), depois
     puro: no instante do pulo a onda ja e a do comeco, sem estalo.
  6. FOLGA de 1 compasso antes e depois do loop no arquivo, e SEGURA maior que o atraso do MP3 (LAME: 1105 amostras = 23 ms): se um
     navegador nao tirar o atraso, o loop toca 23 ms adiantado — o pulo ainda cai dentro do trecho puro e a emenda continua perfeita.
  7. VOLUME: -16 LUFS no trecho do loop, pico verdadeiro (4x) ate -1,5 dBTP. O ganho fino de cada faixa no jogo fica em `ganho`.
  8. MP3 VBR LAME V6 (~115 kbps), estereo, na taxa do original (48 kHz: reamostrar para 44,1 so perderia; o navegador reamostra para
     a taxa do AudioContext ao decodificar). O MP3 pronto e decodificado de volta e a emenda medida nele.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

import numpy as np
import soundfile as sf
import librosa
import pyloudnorm as pyln
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estica import estica  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# id -> (BPM do prompt do Suno, loop minimo s, loop maximo s). BPM e duracoes do plano (os BPM sao os de hoje do js/musica.js).
FAIXAS = {
    'menu': (118, 60, 90), 'orla': (128, 90, 120), 'favela': (130, 90, 120), 'deserto': (120, 90, 120),
    'gelo': (132, 90, 120), 'vulcao': (150, 90, 120), 'selva': (124, 90, 120), 'neon': (140, 90, 120),
    'porto': (150, 90, 120), 'canyon': (134, 90, 120), 'maluca': (158, 90, 120), 'podio': (124, 45, 60),
}
ORDEM = list(FAIXAS.keys())

SR_ANALISE = 22050
HOP_FINO = 128              # 5,8 ms: batidas e alinhamento da emenda
HOP = 512                   # 23 ms: atributos por batida (chroma, MFCC, volume)
SUAVIZA = 6                 # batidas de cada lado no ajuste linear que tira o tremido do tracker
BATIDAS = 4                 # por compasso
FRASE = 4                   # compassos: o loop dura um multiplo disto (frase de 4/8/16 compassos do pop)
JANELA = 8                  # batidas de cada lado da emenda comparadas
INTRO = 4.0                 # s: o loop nunca comeca antes disto (entrada da musica)
FINAL_DB = 8.0              # dB abaixo da mediana: dali em diante e o final (fade, ultimo acorde)
ESTENDE = (0.85, 1.10)      # fora da faixa do plano so ate aqui (fracao do minimo e do maximo)...
MARGEM_FORA = 0.10          # ...e so se a emenda de fora ganhar da melhor de dentro por isto (o plano manda; fora e excecao)
PESO_ENERGIA = 0.08         # o empurrao para o trecho mais animado (a emenda continua mandando)
PESO_RITMO = 0.25           # curva de ataques alinhada na emenda
PESO_JUNCAO = 0.30          # a juncao (4 batidas antes do pulo x 4 depois) contra as transicoes da propria musica (percentil)
PENA_ANDAMENTO = 0.01       # por 1 % de diferenca de andamento (o passo 4 corrige; so desempata para esticar menos)
PRE_FINOS = 40              # candidatos que passam pelo alinhamento fino (o resto ja perdeu na nota grossa)
ALINHA = 0.12               # fracao de batida que o fim pode andar para casar o ritmo com o comeco
RAMPA_BATIDAS = 32          # batidas finais esticadas na rampa de andamento (8 compassos)
ANDAMENTO_TOLERADO = 0.004  # diferenca abaixo disto nao estica (0,4 %: o tremido do proprio Suno)
PAD_ESTICA = 0.5            # s antes da rampa processados com razao 1 (o comeco da saida do Rubber Band entra em fade)
EMENDA_ESTICA = (0.25, 0.10)  # s dentro do pad onde comeca a troca original -> esticado, e a duracao dela
CROSSFADE = 0.10            # s da mistura no fim do loop
SEGURA = 0.05               # s puros do pre-comeco no fim do loop (> 23 ms do atraso do MP3, ver o passo 6)
LUFS = -16.0
PICO_DBTP = -1.5
QUALIDADE_MP3 = '6'         # LAME V6 ~115 kbps


def id_do_arquivo(nome):
    """'Turbo Caos - Vulcão.wav' ou 'vulcao.mp3' -> 'vulcao' (None se nao for nenhuma das 12)."""
    base = os.path.splitext(os.path.basename(nome))[0]
    base = re.sub(r'^\s*turbo\s*caos\s*-\s*', '', base, flags=re.I)
    base = unicodedata.normalize('NFD', base).encode('ascii', 'ignore').decode().strip().lower()
    base = {'podium': 'podio'}.get(base, base)
    return base if base in FAIXAS else None


def para_analise(mono, sr):
    return librosa.resample(mono.astype(np.float32), orig_sr=sr, target_sr=SR_ANALISE).astype(np.float32)


def ataques(ya):
    return librosa.onset.onset_strength(y=ya, sr=SR_ANALISE, hop_length=HOP_FINO, n_fft=1024)


def ajuste_robusto(k, t):
    """Reta (periodo, fase) pelas batidas, descartando as que a virada de bateria tirou do lugar (residuo > 12 ms ou > 2,5 MAD)."""
    c = np.polyfit(k, t, 1)
    for _ in range(2):
        r = t - np.polyval(c, k)
        bom = np.abs(r) <= max(0.012, 2.5 * np.median(np.abs(r - np.median(r))) * 1.4826)
        if bom.sum() < max(4, len(k) // 2):
            break
        c = np.polyfit(k[bom], t[bom], 1)
    return c


def mapa_de_batidas(ya, bpm_prompt):
    """Batidas (s, suavizadas) e o periodo local de cada uma."""
    oenv = ataques(ya)
    fr = SR_ANALISE / HOP_FINO
    t0, _ = librosa.beat.beat_track(onset_envelope=oenv, sr=SR_ANALISE, hop_length=HOP_FINO, start_bpm=bpm_prompt)
    t0 = float(np.atleast_1d(t0)[0])
    while t0 > bpm_prompt * 1.4:
        t0 /= 2
    while t0 < bpm_prompt / 1.4:
        t0 *= 2
    _, quadros = librosa.beat.beat_track(onset_envelope=oenv, sr=SR_ANALISE, hop_length=HOP_FINO, bpm=t0, tightness=400)
    bt = quadros / fr
    n = len(bt)
    bs, per = np.empty(n), np.empty(n)
    for i in range(n):
        a, b = max(0, i - SUAVIZA), min(n, i + SUAVIZA + 1)
        c = ajuste_robusto(np.arange(a, b), bt[a:b])
        bs[i], per[i] = c[0] * i + c[1], c[0]
    return bs, per, t0


def por_batida(F, tq, bs):
    """Media das colunas de F (quadros em tq s) dentro de cada batida [bs[i], bs[i+1])."""
    nb = len(bs) - 1
    out = np.zeros((F.shape[0], nb))
    idx = np.searchsorted(tq, bs)
    for k in range(nb):
        a, b = idx[k], max(idx[k] + 1, idx[k + 1])
        out[:, k] = F[:, a:b].mean(1)
    return out


def normaliza_colunas(X):
    return X / np.maximum(np.linalg.norm(X, axis=0, keepdims=True), 1e-9)


def alinha_ritmo(mono, sr, i_s, i_e, per):
    """Quanto (amostras) o fim `i_e` precisa andar para o ritmo em volta dele casar com o do comeco `i_s`, e a correlacao ali.
    Janela: 2 batidas antes e 1 depois (o que se ouve dos dois lados do pulo), curva de ataques de 5,8 ms com parabola."""
    fr = SR_ANALISE / HOP_FINO
    L = int(np.ceil(ALINHA * per * fr))
    margem = int((3 * per + 0.5) * sr)
    def env(c):
        a, b = max(0, c - margem), min(len(mono), c + margem)
        return ataques(para_analise(mono[a:b], sr)), (c - a) / sr
    ea, ca = env(i_s)
    eb, cb = env(i_e)
    a0 = int(round((ca - 2 * per) * fr))
    A = ea[a0:a0 + int(round(3 * per * fr))].astype(np.float64)
    b0 = int(round((cb - 2 * per) * fr)) - L
    if a0 < 0 or b0 < 0 or b0 + len(A) + 2 * L > len(eb):
        return 0, -1.0
    A = A - A.mean()
    na = np.sqrt((A * A).sum())
    vals = np.empty(2 * L + 1)
    for j in range(2 * L + 1):
        b = eb[b0 + j:b0 + j + len(A)].astype(np.float64)
        b = b - b.mean()
        vals[j] = (A * b).sum() / max(na * np.sqrt((b * b).sum()), 1e-12)
    j = int(np.argmax(vals))
    d = 0.0
    if 0 < j < 2 * L:
        y0, y1, y2 = vals[j - 1], vals[j], vals[j + 1]
        den = y0 - 2 * y1 + y2
        d = 0.5 * (y0 - y2) / den if den != 0 else 0.0
    return int(round((j - L + d) / fr * sr)), float(vals[j])


def pico_verdadeiro(x):
    """Pico com 4x de sobreamostragem (dBTP), x = (amostras, canais)."""
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(max(1e-12, float(np.abs(up).max())))


def analisa(caminho, fid, avisos):
    bpm_prompt, dmin, dmax = FAIXAS[fid]
    y, sr = sf.read(caminho, always_2d=True, dtype='float32')
    if y.shape[1] == 1:
        y = np.repeat(y, 2, axis=1)
    y = y[:, :2]
    ya = para_analise(y.mean(1), sr)
    bs, per, t0 = mapa_de_batidas(ya, bpm_prompt)
    nb = len(bs) - 1
    S = np.abs(librosa.stft(ya, n_fft=2048, hop_length=HOP))
    P2 = S ** 2
    tq = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR_ANALISE, hop_length=HOP)
    C = normaliza_colunas(por_batida(librosa.feature.chroma_stft(S=P2, sr=SR_ANALISE), tq, bs))
    M = por_batida(librosa.feature.mfcc(S=librosa.power_to_db(librosa.feature.melspectrogram(S=P2, sr=SR_ANALISE)), n_mfcc=14)[1:], tq, bs)
    Mz = (M - M.mean(1, keepdims=True)) / np.maximum(M.std(1, keepdims=True), 1e-9)
    Mn = normaliza_colunas(Mz)
    R = por_batida(librosa.feature.rms(S=S), tq, bs)[0]
    del S, P2
    # JUNCAO: as 4 batidas que tocam antes do pulo contra as 4 depois, em acorde + timbre — e a mesma conta em cada batida da musica
    # original (as transicoes que ela mesma faz). O percentil diz se o pulo e mais liso que a musica costuma ser: a correspondencia
    # (abaixo) mede se a musica se repete em volta da emenda; a juncao mede o pulo em si, que e o que se ouve quando ela nao se repete
    Fj = np.vstack([C, Mn]) / np.sqrt(2)
    def bloco(a, b):
        return float((Fj[:, a:a + 4].T @ Fj[:, b:b + 4]).mean())
    naturais = np.sort([bloco(i - 4, i) for i in range(4, nb - 4)])
    rdb = 20 * np.log10(np.maximum(R, 1e-9))
    med = np.median(rdb[int(nb * 0.2):int(nb * 0.8)])
    vivas = np.where(rdb >= med - FINAL_DB)[0]
    ultima_viva = int(vivas.max()) if len(vivas) else nb - 1
    energia_ref = np.percentile(R, 90)
    lo, hi = dmin * ESTENDE[0], dmax * ESTENDE[1]
    def textura(a, b):
        u = Mz[:, a:b].mean(1)
        return u / max(np.linalg.norm(u), 1e-9)
    candidatos = []
    for ks in range(JANELA, nb - JANELA):
        if bs[ks] < INTRO:
            continue
        for n in range(FRASE, 400, FRASE):
            ke = ks + n * BATIDAS
            if ke + JANELA > nb or ke + BATIDAS > ultima_viva:
                break
            dlen = bs[ke] - bs[ks]
            if dlen < lo:
                continue
            if dlen > hi:
                break
            antes, depois = (slice(ks - JANELA, ks), slice(ke - JANELA, ke)), (slice(ks, ks + JANELA), slice(ke, ke + JANELA))
            ca = float((C[:, antes[0]] * C[:, antes[1]]).sum(0).mean())
            cd = float((C[:, depois[0]] * C[:, depois[1]]).sum(0).mean())
            ma = float((Mn[:, antes[0]] * Mn[:, antes[1]]).sum(0).mean())
            md = float((Mn[:, depois[0]] * Mn[:, depois[1]]).sum(0).mean())
            ta = float(textura(ks - JANELA, ks) @ textura(ke - JANELA, ke))
            td = float(textura(ks, ks + JANELA) @ textura(ke, ke + JANELA))
            dand = abs(per[ke] / per[ks] - 1) * 100
            energia = float(min(1.0, R[ks:ke].mean() / energia_ref))
            fora = max(0.0, dmin - dlen, dlen - dmax)
            juncao = float(np.searchsorted(naturais, bloco(ke - 4, ks)) / len(naturais))
            grossa = (0.25 * (ca + cd) + 0.125 * (ma + md) + 0.125 * (ta + td) + PESO_JUNCAO * juncao + PESO_ENERGIA * energia
                      - PENA_ANDAMENTO * dand)
            candidatos.append(dict(grossa=grossa, n=n, ks=ks, ke=ke, acorde=(ca, cd), timbre=(ma, md), textura=(ta, td), juncao=juncao,
                                   dand=dand, energia=energia, fora=fora))
    if not candidatos:
        raise SystemExit(f'{fid}: nenhum loop de {lo:.0f}-{hi:.0f} s entre {INTRO} s e o final ({bs[ultima_viva]:.1f} s)')
    candidatos.sort(key=lambda c: -c['grossa'])
    mono = y.mean(1)
    dentro = [c for c in candidatos if c['fora'] == 0][:PRE_FINOS]
    fora = [c for c in candidatos if c['fora'] > 0][:PRE_FINOS]
    for c in dentro + fora:
        desl, r = alinha_ritmo(mono, sr, int(round(bs[c['ks']] * sr)), int(round(bs[c['ke']] * sr)), per[c['ke']])
        c.update(desl=desl, ritmo=r, nota=c['grossa'] + PESO_RITMO * r)
    dentro.sort(key=lambda c: -c['nota'])
    fora.sort(key=lambda c: -c['nota'])
    if dentro and (not fora or fora[0]['nota'] < dentro[0]['nota'] + MARGEM_FORA):
        finos = dentro
    else:
        finos = fora + dentro
        finos.sort(key=lambda c: -c['nota'])
    v = finos[0]
    if v['fora'] > 0:
        avisos.append(f"{fid}: loop de {bs[v['ke']] - bs[v['ks']]:.1f} s, fora dos {dmin}-{dmax} s do plano: a emenda ali ganhou da melhor "
                      f"de dentro por {v['nota'] - (dentro[0]['nota'] if dentro else 0):.3f}")
    return dict(id=fid, y=y, sr=sr, bs=bs, per=per, bpm_tracker=t0, bpm_prompt=bpm_prompt, escolha=v,
                s=int(round(bs[v['ks']] * sr)), e=int(round(bs[v['ke']] * sr)) + v['desl'],
                outros=[(round(float(bs[c['ks']]), 2), c['n'], round(c['nota'], 3)) for c in finos[1:4]])


def corrige_andamento(a, avisos):
    """Passo 4: rampa de andamento nas ultimas RAMPA_BATIDAS do loop (Rubber Band), devolvendo o audio novo e o fim novo."""
    y, sr, bs, per, v = a['y'], a['sr'], a['bs'], a['per'], a['escolha']
    ks, ke, e = v['ks'], v['ke'], a['e']
    f = per[ks] / per[ke]          # >1: o fim esta mais rapido que o comeco, a rampa alonga
    a['estica_pct'] = (f - 1) * 100
    if abs(f - 1) < ANDAMENTO_TOLERADO:
        return y, e
    K = min(RAMPA_BATIDAS, (ke - ks) // 2)
    i_a = int(round(bs[ke - K] * sr))
    L = e - i_a
    def saida(u):                  # posicao na saida de uma amostra `u` (relativa a i_a) da entrada: razao em rampa de 1 a f
        if u <= 0:
            return float(u)
        if u <= L:
            return u + (f - 1) * u * u / (2 * L)
        return L + (f - 1) * L / 2 + (u - L)
    delta = int(round((f - 1) * L / 2))
    pad = int(PAD_ESTICA * sr)
    compasso = int(round(BATIDAS * per[ke] * sr))
    i0, i1 = i_a - pad, min(len(y), e + 2 * compasso + pad)
    n = i1 - i0
    passo = int(round(per[ke] * sr * 2))      # um quadro-chave a cada 2 batidas
    mapa = {pad + u: int(round(pad + saida(u))) for u in range(passo, L + 2 * compasso, passo)}
    mapa[pad] = pad                           # o pad fica com razao 1
    mapa[pad + L] = pad + L + delta
    z = estica(y[i0:i1], sr, n + delta, mapa)
    # troca original -> esticado dentro do pad (razao 1 ali: as duas ondas sao a mesma musica no mesmo lugar)
    c0, cx = int(EMENDA_ESTICA[0] * sr), int(EMENDA_ESTICA[1] * sr)
    ref = y[i0 + c0:i0 + c0 + cx, 0].astype(np.float64)
    melhor, lag = -2.0, 0
    for d in range(-64, 65):
        b = z[c0 + d:c0 + d + cx, 0].astype(np.float64)
        r = float(ref @ b / max(np.linalg.norm(ref) * np.linalg.norm(b), 1e-12))
        if r > melhor:
            melhor, lag = r, d
    if abs(lag) > 2 or melhor < 0.9:
        avisos.append(f"{a['id']}: a saida do Rubber Band no trecho de razao 1 deslocou {lag} amostras (correlacao {melhor:.3f})")
    w = (0.5 - 0.5 * np.cos(np.pi * (np.arange(cx) + 0.5) / cx))[:, None]
    meio = (1 - w) * y[i0 + c0:i0 + c0 + cx] + w * z[c0 + lag:c0 + lag + cx]
    novo = np.concatenate([y[:i0 + c0], meio, z[c0 + lag + cx:]]).astype(np.float32)
    a['correlacao_estica'] = melhor
    return novo, e + delta - lag              # o esticado entrou `lag` amostras deslocado (ver acima)


def prepara(a, avisos):
    sr, s = a['sr'], a['s']
    y, e = corrige_andamento(a, avisos)
    mono = y.mean(1)
    v, per = a['escolha'], a['per']
    # passo 5: alinhamento fino do fim (depois da rampa) e o andamento que ficou
    desl, ritmo = alinha_ritmo(mono, sr, s, e, per[v['ks']])
    e += desl
    a['ritmo_final'] = ritmo
    pcm = y.astype(np.float64)
    bar = int(round(BATIDAS * per[v['ks']] * sr))
    X, H = int(round(CROSSFADE * sr)), int(round(SEGURA * sr))
    w = 0.5 - 0.5 * np.cos(np.pi * (np.arange(X) + 0.5) / X)
    i0 = e - X - H
    pcm[i0:i0 + X] = (1 - w)[:, None] * pcm[i0:i0 + X] + w[:, None] * pcm[s - X - H:s - H]
    pcm[e - H:e] = pcm[s - H:s]
    trecho = pcm[s - bar:min(len(pcm), e + bar)]
    loop = pcm[s:e]
    medidor = pyln.Meter(sr)
    lufs0 = medidor.integrated_loudness(loop)
    trecho = trecho * 10 ** ((LUFS - lufs0) / 20)
    tp = pico_verdadeiro(trecho[bar:bar + (e - s)])
    if tp > PICO_DBTP:
        corte = 10 ** ((PICO_DBTP - tp) / 20)
        trecho = trecho * corte
        avisos.append(f"{a['id']}: pico {tp:.1f} dBTP a -16 LUFS; baixou {20 * np.log10(corte):.1f} dB para caber em {PICO_DBTP} dBTP")
        tp = pico_verdadeiro(trecho[bar:bar + (e - s)])
    compassos = v['n']
    a.update(trecho=trecho, inicio=bar / sr, fim=(bar + e - s) / sr, lufs_original=lufs0, pico_dbtp=tp, compassos=compassos,
             bpm=60 * BATIDAS * compassos / ((e - s) / sr), lufs=medidor.integrated_loudness(trecho[bar:bar + (e - s)]))
    return a


def codifica_mp3(trecho, sr, saida):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    try:
        sf.write(tmp, np.clip(trecho, -1, 1).astype(np.float32), sr, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-q:a', QUALIDADE_MP3, '-ar', str(sr), '-ac', '2', saida],
                       check=True)
    finally:
        os.unlink(tmp)


def decodifica(mp3, sr):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-f', 'f32le', '-ac', '2', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).reshape(-1, 2)


def confere_mp3(a, mp3, avisos):
    """Decodifica o MP3 (ffmpeg, que tira o atraso do LAME como o Chrome) e mede: deslocamento contra o original, e o salto na emenda
    do loop tocado em volta (o loop de verdade, do arquivo de verdade) contra o salto tipico de uma amostra para a outra."""
    sr = a['sr']
    dec = decodifica(mp3, sr)
    ref = a['trecho'][int(1.0 * sr):int(1.5 * sr), 0]
    melhor, desl = -1.0, 0
    for d in range(-2048, 2049):
        x = dec[int(1.0 * sr) + d:int(1.5 * sr) + d, 0]
        c = float(np.dot(x, ref))
        if c > melhor:
            melhor, desl = c, d
    i0, i1 = int(round(a['inicio'] * sr)), int(round(a['fim'] * sr))
    L = dec[i0:i1]
    salto = float(np.abs(L[0] - L[-1]).max())
    tipico = float(np.percentile(np.abs(np.diff(L[:, 0])), 99.9))
    # o ritmo na emenda, como a crianca ouve: batidas dos 10 s antes do pulo e dos 10 s depois, uma reta de cada lado; a diferenca de
    # andamento e onde a reta de antes poe a primeira batida depois do pulo contra onde ela cai
    T = int(10 * sr)
    dois = np.concatenate([L[-T:], L[:T]]).mean(1)
    oenv = ataques(para_analise(dois, sr))
    _, q = librosa.beat.beat_track(onset_envelope=oenv, sr=SR_ANALISE, hop_length=HOP_FINO, start_bpm=a['bpm'], tightness=400)
    t = q / (SR_ANALISE / HOP_FINO) - 10.0
    # 8 batidas de cada lado: a reta ja fica com ~0,1 % de erro, e janela maior pega virada de bateria longe do pulo
    antes, depois = t[t < -0.2][-8:], t[t >= -0.2][:8]
    ca = ajuste_robusto(np.arange(len(antes)), antes)
    cd = ajuste_robusto(np.arange(len(depois)), depois)
    a['andamento_emenda_pct'] = (cd[0] / ca[0] - 1) * 100
    prevista = np.polyval(ca, len(antes))          # a batida seguinte se a musica nao tivesse pulado
    a['erro_batida_ms'] = (cd[1] - prevista) * 1000
    if abs(a['erro_batida_ms']) > 12 or abs(a['andamento_emenda_pct']) > 0.8:
        avisos.append(f"{a['id']}: no pulo a batida cai {a['erro_batida_ms']:+.0f} ms fora e o andamento muda {a['andamento_emenda_pct']:+.2f} %")
    if desl != 0:
        avisos.append(f"{a['id']}: o MP3 decodificado sai {desl} amostras deslocado (a folga e o trecho puro cobrem ate {int(SEGURA * sr)})")
    if salto > 2 * tipico:
        avisos.append(f"{a['id']}: salto de {salto:.3f} na emenda do MP3 (tipico {tipico:.3f})")
    return desl, salto, tipico, dec


def escreve_config(itens):
    linhas = []
    for it in itens:
        linhas.append(f"  {it['id']}: {{ arquivo: 'assets/musica/{it['id']}.mp3', inicio: {it['inicio']:.6f}, fim: {it['fim']:.6f}, "
                      f"ganho: {it.get('ganho', 1)}, bpm: {it['bpm']:.2f}, compassos: {it['compassos']} }},")
    texto = f"""// AS MUSICAS DO SUNO (gerado por tools/musica/prepara.py — nao edite os numeros do loop a mao: rode o script de novo). Uma faixa
// por id: menu, podio e o id de cada pista (js/pistas/*.js). O arquivo tem o LOOP com 1 compasso de folga de cada lado; `inicio` e
// `fim` sao o loop em segundos DENTRO do arquivo (AudioBufferSourceNode.loopStart/loopEnd), ja com a emenda misturada no fim. Todas
// sairam em -16 LUFS; `ganho` e o ajuste fino de cada uma no jogo (1 = como saiu; o script preserva o que estiver escrito aqui). O
// volume da musica toda contra a sintetizada fica em MUSICA_ARQUIVO_VOL (js/audio.js). Pista sem linha aqui (a de teste, uma nova)
// toca a musica sintetizada do js/musica.js.
export const MUSICAS = {{
{chr(10).join(linhas)}
}};
"""
    with open(os.path.join(RAIZ, 'config', 'musicas.js'), 'w', encoding='utf-8') as f:
        f.write(texto)


def le_config():
    existentes = {}
    cfg = os.path.join(RAIZ, 'config', 'musicas.js')
    if os.path.exists(cfg):
        padrao = r"(\w+): \{ arquivo: '[^']+', inicio: ([\d.]+), fim: ([\d.]+), ganho: ([\d.]+), bpm: ([\d.]+), compassos: (\d+) \}"
        for m in re.finditer(padrao, open(cfg, encoding='utf-8').read()):
            existentes[m.group(1)] = dict(id=m.group(1), inicio=float(m.group(2)), fim=float(m.group(3)), ganho=float(m.group(4)),
                                          bpm=float(m.group(5)), compassos=int(m.group(6)))
    return existentes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pasta')
    ap.add_argument('--so', nargs='*')
    ap.add_argument('--previa', default=None, help='pasta onde gravar emendas.mp3 e relatorio.json')
    args = ap.parse_args()
    achados = {}
    for f in sorted(os.listdir(args.pasta)):
        fid = id_do_arquivo(f)
        if fid and f.lower().endswith(('.wav', '.mp3', '.flac')):
            achados[fid] = os.path.join(args.pasta, f)
    faltam = [i for i in ORDEM if i not in achados]
    if faltam:
        print('faltam:', ', '.join(faltam))
    alvo = [i for i in ORDEM if i in achados and (not args.so or i in args.so)]
    os.makedirs(os.path.join(RAIZ, 'assets', 'musica'), exist_ok=True)
    avisos, relatorio, previas = [], [], []
    existentes = le_config()   # o que ja esta no config fica (rodar --so orla nao apaga as outras; o ganho escrito a mao continua)
    for fid in alvo:
        a = prepara(analisa(achados[fid], fid, avisos), avisos)
        mp3 = os.path.join(RAIZ, 'assets', 'musica', fid + '.mp3')
        codifica_mp3(a['trecho'], a['sr'], mp3)
        desl, salto, tipico, dec = confere_mp3(a, mp3, avisos)
        kb = os.path.getsize(mp3) / 1024
        seg = len(a['trecho']) / a['sr']
        v = a['escolha']
        r = dict(id=fid, bpm=round(a['bpm'], 2), bpm_prompt=a['bpm_prompt'], compassos=a['compassos'], loop_s=round(a['fim'] - a['inicio'], 2),
                 comeco_na_musica=round(a['s'] / a['sr'], 2), nota=round(v['nota'], 3), acorde=[round(x, 2) for x in v['acorde']],
                 timbre=[round(x, 2) for x in v['timbre']], textura=[round(x, 2) for x in v['textura']], juncao_pct=round(100 * v['juncao']), ritmo=round(v['ritmo'], 2),
                 ritmo_final=round(a['ritmo_final'], 2), estica_pct=round(a['estica_pct'], 2), andamento_emenda_pct=round(a['andamento_emenda_pct'], 2),
                 erro_batida_ms=round(a['erro_batida_ms'], 1),
                 correlacao_estica=round(a.get('correlacao_estica', 1.0), 4), energia=round(v['energia'], 2),
                 lufs_original=round(a['lufs_original'], 1), lufs=round(a['lufs'], 2), pico_dbtp=round(a['pico_dbtp'], 2), kb=round(kb),
                 kbps=round(kb * 8 * 1.024 / seg), atraso_mp3=desl, salto=round(salto, 4), salto_tipico=round(tipico, 4), outros=a['outros'])
        relatorio.append(r)
        print(json.dumps(r, ensure_ascii=False), flush=True)
        ganho = existentes.get(fid, {}).get('ganho', 1)
        existentes[fid] = dict(id=fid, inicio=a['inicio'], fim=a['fim'], bpm=a['bpm'], compassos=a['compassos'], ganho=ganho)
        if args.previa:
            # a emenda como o jogo toca: os ultimos 8 s do loop e os primeiros 6 s, do MP3 decodificado
            sr = a['sr']
            i0, i1 = int(round(a['inicio'] * sr)), int(round(a['fim'] * sr))
            previas.append((fid, np.concatenate([dec[i1 - 8 * sr:i1], dec[i0:i0 + 6 * sr]]).astype(np.float64), sr))
        del a, dec
    escreve_config([existentes[i] for i in ORDEM if i in existentes])
    if args.previa:
        os.makedirs(args.previa, exist_ok=True)
        marcas = []
        if previas:
            sr = previas[0][2]
            pedacos, t = [], 0.0
            for fid, x, _ in previas:
                marcas.append((fid, round(t + 8.0, 1)))
                pedacos += [x, np.zeros((sr, 2))]
                t += len(x) / sr + 1.0
            codifica_mp3(np.concatenate(pedacos), sr, os.path.join(args.previa, 'emendas.mp3'))
        with open(os.path.join(args.previa, 'relatorio.json'), 'w', encoding='utf-8') as f:
            json.dump(dict(faixas=relatorio, emendas=marcas, avisos=avisos), f, ensure_ascii=False, indent=1)
    for a in avisos:
        print('AVISO:', a)


if __name__ == '__main__':
    main()
