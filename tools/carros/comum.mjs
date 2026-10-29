// COMUM DAS FERRAMENTAS DOS CARROS (fase 1): servidor HTTP estatico e Chromium headless com WebGL por software.
// Por que um servidor proprio em vez do `python3 -m http.server`: ES modules nao abrem de file://, e aqui o mesmo
// servidor precisa entregar o projeto (lib/, assets/cars/) e, num prefixo separado, os GLB de ORIGEM do Cidade Aberta
// (so leitura) para a folha de comparacao. Porta 0 = o sistema escolhe uma livre: outro agente pode estar com um
// servidor aberto na mesma maquina e uma porta fixa daria conflito.
// Por que SwiftShader: a maquina das ferramentas nao tem placa de video; o ANGLE com SwiftShader desenha WebGL2 na CPU
// (lento, mas deterministico e suficiente para foto e conferencia).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');                       // /home/claude/turbo-caos
export const ORIGEM = path.resolve(RAIZ, '..', 'cidadeaberta', 'assets');  // GLB do Cidade Aberta (SOMENTE LEITURA)

// tipos que o navegador exige certos: modulo JS sem text/javascript nao roda; wasm sem application/wasm cai no caminho lento
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.ktx2': 'image/ktx2' };

// prefixo da URL -> pasta no disco. '/_origem/' entrega os GLB do Cidade Aberta sem copiar nada para o projeto.
export function servidor() {
  // '/_folha_na_raiz.html' = a pagina de ferramenta servida na RAIZ: caminhos relativos do jogo (o 'lib/addons/libs/basis/'
  // do js/glb.js) resolvem como no index.html. E so uma rota deste servidor; nada e escrito fora de tools/carros.
  const rotas = [['/_folha_na_raiz.html', path.join(AQUI, 'folha.html')], ['/_origem/', ORIGEM], ['/', RAIZ]];
  const entregues = new Set();   // caminhos cuja resposta saiu INTEIRA (evento finish): ver abrePagina
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    res.on('finish', () => entregues.add(url));
    const [prefixo, pasta] = rotas.find(([p]) => url.startsWith(p));
    const arq = pasta.endsWith('.html') ? pasta : path.normalize(path.join(pasta, url.slice(prefixo.length)));
    if (!arq.startsWith(pasta)) { res.writeHead(403); res.end(); return; }   // nada de ../ para fora da pasta
    fs.readFile(arq, (erro, dados) => {
      if (erro) { res.writeHead(404); res.end('404 ' + url); return; }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dados);
    });
  });
  // keep-alive longo: o SwiftShader leva segundos desenhando entre um GLB e outro; com os 5 s padrao do Node o servidor
  // fechava o socket ocioso no instante em que o Chromium o reusava, e o pedido saia como net::ERR_ABORTED (o navegador
  // repetia e o arquivo carregava, mas o erro sujava a conferencia - visto em 3 de 4 rodadas, sempre num arquivo diferente)
  srv.keepAliveTimeout = 10 * 60 * 1000; srv.headersTimeout = srv.keepAliveTimeout + 1000;
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, porta: srv.address().port, entregues, fecha: () => { srv.closeAllConnections?.(); srv.close(); } })));
}

// Chromium do Playwright (instalado globalmente). Os argumentos sao os que fazem o WebGL2 existir sem GPU.
export async function navegador() {
  const { chromium } = require('playwright');
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
}

// abre a pagina e junta TUDO o que for erro: erro de console reprova a conferencia (regra herdada do DinoTrails:
// um 404 de fallback derruba a suite mesmo sem falar do assunto dela).
// ERR_ABORTED com a resposta ENTREGUE inteira pelo servidor nao e erro: medido (26 rodadas de 10 GLB), o FileLoader do
// three le o corpo ate o fim, o arquivo abre perfeito, e o Chromium ainda marca o pedido como abortado de vez em quando
// (o renderer solta o pedido antes da mensagem de conclusao). Vai para `avisos`; qualquer outra falha continua erro.
export async function abrePagina(nav, url, { largura = 1600, altura = 900, servidor: srv = null } = {}) {
  const pagina = await nav.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
  const erros = [], avisos = [];
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pagina.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  pagina.on('requestfailed', (r) => {
    const txt = r.failure()?.errorText || '', caminho = decodeURIComponent(new URL(r.url()).pathname);
    if (txt === 'net::ERR_ABORTED' && srv && srv.entregues.has(caminho)) avisos.push(`ERR_ABORTED depois de entregue: ${caminho}`);
    else erros.push(`REQFAILED ${r.url()} ${txt}`);
  });
  pagina.on('response', (r) => { if (r.status() >= 400) erros.push(`HTTP ${r.status()} ${r.url()}`); });
  await pagina.goto(url);
  return { pagina, erros, avisos };
}
