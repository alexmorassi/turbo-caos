"""ESTICA (02/11/2026): time-stretch com mapa de quadros-chave do Rubber Band 3 (motor R3, "finer"), pela API C da biblioteca do sistema
(ctypes). Por que nao o pylibrb: na 0.1.2 o set_keyframe_map nao aceita o dict (o conversor de std::map nao foi compilado), e sem o
mapa so da para esticar com uma razao constante — e o que o prepara.py precisa e uma RAMPA (o andamento do fim do loop voltando
devagar para o do comeco). No Windows: o mesmo codigo com o rubberband.dll do pacote oficial ao lado (ou no PATH).
"""
import ctypes
import ctypes.util
import numpy as np

OPCAO_OFFLINE = 0x00000000
OPCAO_CANAIS_JUNTOS = 0x10000000   # R3: preserva a imagem estereo
OPCAO_MOTOR_FINO = 0x20000000      # R3 (o R2 espalha mais os ataques)
BLOCO = 32768


def _lib():
    nome = ctypes.util.find_library('rubberband') or 'librubberband.so.2'
    lib = ctypes.CDLL(nome)
    P = ctypes.c_void_p
    PPF = ctypes.POINTER(ctypes.POINTER(ctypes.c_float))
    PU = ctypes.POINTER(ctypes.c_uint)
    lib.rubberband_new.restype = P
    lib.rubberband_new.argtypes = [ctypes.c_uint, ctypes.c_uint, ctypes.c_int, ctypes.c_double, ctypes.c_double]
    lib.rubberband_delete.argtypes = [P]
    lib.rubberband_set_max_process_size.argtypes = [P, ctypes.c_uint]
    lib.rubberband_set_expected_input_duration.argtypes = [P, ctypes.c_uint]
    lib.rubberband_set_key_frame_map.argtypes = [P, ctypes.c_uint, PU, PU]
    lib.rubberband_study.argtypes = [P, PPF, ctypes.c_uint, ctypes.c_int]
    lib.rubberband_process.argtypes = [P, PPF, ctypes.c_uint, ctypes.c_int]
    lib.rubberband_available.restype = ctypes.c_int
    lib.rubberband_available.argtypes = [P]
    lib.rubberband_retrieve.restype = ctypes.c_uint
    lib.rubberband_retrieve.argtypes = [P, PPF, ctypes.c_uint]
    lib.rubberband_get_engine_version.restype = ctypes.c_int
    lib.rubberband_get_engine_version.argtypes = [P]
    return lib


def _ponteiros(bloco):
    """bloco (canais, n) float32 C-contiguo -> float** para a API C."""
    linhas = [bloco[c].ctypes.data_as(ctypes.POINTER(ctypes.c_float)) for c in range(bloco.shape[0])]
    return (ctypes.POINTER(ctypes.c_float) * len(linhas))(*linhas)


def estica(x, sr, saida_n, mapa):
    """x (n, canais) -> (saida_n, canais), com cada amostra de entrada `k` do `mapa` caindo na amostra `mapa[k]` da saida."""
    lib = _lib()
    n, canais = x.shape
    dados = np.ascontiguousarray(x.T.astype(np.float32))
    st = lib.rubberband_new(sr, canais, OPCAO_OFFLINE | OPCAO_MOTOR_FINO | OPCAO_CANAIS_JUNTOS, saida_n / n, 1.0)
    try:
        if lib.rubberband_get_engine_version(st) != 3:
            raise RuntimeError('o Rubber Band desta maquina nao tem o motor R3')
        lib.rubberband_set_max_process_size(st, BLOCO)
        lib.rubberband_set_expected_input_duration(st, n)
        for i in range(0, n, BLOCO):
            b = np.ascontiguousarray(dados[:, i:i + BLOCO])
            lib.rubberband_study(st, _ponteiros(b), b.shape[1], int(i + BLOCO >= n))
        chaves = sorted((int(k), int(v)) for k, v in mapa.items() if 0 < k < n)
        de = (ctypes.c_uint * len(chaves))(*[k for k, _ in chaves])
        para = (ctypes.c_uint * len(chaves))(*[v for _, v in chaves])
        lib.rubberband_set_key_frame_map(st, len(chaves), de, para)
        saida = []
        def colhe():
            while True:
                av = lib.rubberband_available(st)
                if av <= 0:
                    return
                o = np.zeros((canais, av), np.float32)
                got = lib.rubberband_retrieve(st, _ponteiros(o), av)
                saida.append(o[:, :got])
        for i in range(0, n, BLOCO):
            b = np.ascontiguousarray(dados[:, i:i + BLOCO])
            lib.rubberband_process(st, _ponteiros(b), b.shape[1], int(i + BLOCO >= n))
            colhe()
        colhe()
    finally:
        lib.rubberband_delete(st)
    y = np.concatenate(saida, axis=1).T
    if len(y) < saida_n:
        y = np.vstack([y, np.zeros((saida_n - len(y), canais), np.float32)])
    return y[:saida_n]
