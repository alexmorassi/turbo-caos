#!/usr/bin/env python3
"""FOTOS PARA O GIT (maestro): as ferramentas de foto (tools/foto_*.js, tools/carros/folha.mjs) gravam PNG, que sao 7x maiores que
JPEG em cena 3D (106 MB contra 16 MB na onda 2). Este script converte toda PNG de docs/fotos/ para JPEG qualidade 80 e apaga a PNG;
o .gitignore ignora PNG em docs/fotos. Uso: python3 tools/fotos_jpg.py"""
import os, glob
from PIL import Image
antes = depois = 0
for p in glob.glob(os.path.join(os.path.dirname(__file__), '..', 'docs', 'fotos', '**', '*.png'), recursive=True):
    antes += os.path.getsize(p)
    q = p[:-4] + '.jpg'
    Image.open(p).convert('RGB').save(q, 'JPEG', quality=80, optimize=True, progressive=True)
    depois += os.path.getsize(q)
    os.remove(p)
print('fotos: %.1f MB de PNG -> %.1f MB de JPEG' % (antes / 1e6, depois / 1e6))
