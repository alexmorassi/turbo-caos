# Servidor local do TURBO CAOS (somente arquivos estaticos) — o mesmo do Cidade Aberta, com HTTP/1.1.
# HTTP/1.1 de proposito (armadilha do dinotrails-web): com HTTP/1.0 cada arquivo abre um socket, a bateria de testes deixa milhares em
# TIME_WAIT no Windows e um arquivo qualquer falha com ERR_NO_BUFFER_SPACE.
#   python server.py [porta] [--rede] [--pasta dir]   (--rede: escuta em 0.0.0.0 para abrir no celular pela rede Wi-Fi de casa;
#                                                      --pasta: serve outra pasta, ex. dist/artefato para conferir o artefato)
import http.server, socketserver, os, sys, functools
argv = sys.argv[1:]
PASTA = argv[argv.index('--pasta') + 1] if '--pasta' in argv and argv.index('--pasta') + 1 < len(argv) else None
args = [a for i, a in enumerate(argv) if not a.startswith('--') and (i == 0 or argv[i - 1] != '--pasta')]
PORT = int(args[0]) if args else 8125
HOST = '0.0.0.0' if '--rede' in argv else '127.0.0.1'
ROOT = os.path.abspath(PASTA) if PASTA else os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json',
        '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
if __name__ == '__main__':
    with S((HOST, PORT), functools.partial(H, directory=ROOT)) as httpd:
        print(f'Jogo rodando em http://localhost:{PORT}' + (' (e na rede local)' if HOST == '0.0.0.0' else ''), flush=True)
        httpd.serve_forever()
