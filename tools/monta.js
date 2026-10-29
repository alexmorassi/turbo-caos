// MONTA O HTML UNICO (fase 1, fundacao): TurboCaos.html = o jogo inteiro num arquivo so, que abre com dois cliques (file://), no
// celular ou em qualquer hospedagem estatica, sem servidor e sem instalar nada. Pedido do Morassi: "o jogo abre direto no navegador
// por um arquivo HTML ... sem passo de build para JOGAR" — o build e so de quem desenvolve; o TurboCaos.html montado vai no git.
//
// O que entra no arquivo, nesta ordem (a ordem importa: o navegador desenha o HTML enquanto baixa):
//   1. o <head> do index.html (meta de tela cheia, estilo base) + css/jogo.css embutido;
//   2. o DOM do jogo com a TELA DE CARGA — aparece na hora, antes dos 10+ MB chegarem;
//   3. os blocos embutidos (GLB dos carros, transcodificador Basis) em base64, cada um seguido de um <script> minusculo que anda a
//      barra de carga: e a barra de progresso de verdade do download (o "primeiro carregamento com barra de progresso" do pedido);
//   4. o codigo do jogo (js/main.js e tudo o que ele importa, three.js r170 incluido) num <script> classico, empacotado pelo esbuild.
// Em file:// o navegador bloqueia ES modules e fetch de arquivo; por isso o codigo vira um script classico (IIFE) e os arquivos viram
// blocos que o js/glb.js le pelo id (`embutido:<caminho>`).
//
// E monta tambem a PASTA DO ARTEFATO (dist/artefato/), a entrega principal — o mesmo jeito do jogo do Breno: o artefato do claude.ai
// serve varios arquivos (index.html, js/, lib/ com o transcodificador) mas NAO serve .glb, entao cada GLB vira um modulo JS com o
// base64 (`assets/cars/<id>.glb.js`, `export default '...'`) e a pagina liga `window.__glbComoModulo` (js/glb.js le por import()).
// A pasta e publicada como artefato pelo maestro (ferramenta de artefatos do Claude) e o Morassi abre pelo link no celular.
//
//   node tools/monta.js            # gera TurboCaos.html na raiz e dist/artefato/
//   node tools/monta.js --sem-min  # sem minificar (para depurar)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(RAIZ, 'TurboCaos.html');
const LIMITE_MB = 25; // pedido: "acima de ~25 MB" e grande demais para celular — avisa (decisao em docs/PENDENCIAS.md)
const MINIFICA = !process.argv.includes('--sem-min');

/** Arquivos que o jogo le em tempo de execucao e que, no HTML unico, viram blocos embutidos. Caminho relativo a raiz (= o id). */
function arquivosEmbutidos() {
  const lista = ['lib/addons/libs/basis/basis_transcoder.js', 'lib/addons/libs/basis/basis_transcoder.wasm'];
  const pasta = path.join(RAIZ, 'assets', 'cars');
  if (fs.existsSync(pasta)) for (const f of fs.readdirSync(pasta).sort()) if (f.endsWith('.glb')) lista.push('assets/cars/' + f);
  return lista;
}

async function empacota() {
  const LIB = path.join(RAIZ, 'lib');
  const r = await esbuild.build({
    entryPoints: [path.join(RAIZ, 'js', 'main.js')],
    bundle: true, format: 'iife', minify: MINIFICA, write: false, target: ['es2020', 'safari15'], legalComments: 'none',
    logLevel: 'error',
    alias: { three: path.join(LIB, 'three.module.js') },
    plugins: [{
      name: 'three-addons',
      setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(LIB, 'addons', a.path.slice('three/addons/'.length)) })); },
    }],
  });
  return r.outputFiles[0].text;
}

async function main() {
  const t0 = Date.now();
  const index = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const css = fs.existsSync(path.join(RAIZ, 'css', 'jogo.css')) ? fs.readFileSync(path.join(RAIZ, 'css', 'jogo.css'), 'utf8') : '';
  const js = await empacota();

  // head: o do index.html sem o link do css, sem o importmap e sem o script de modulo
  let html = index
    .replace(/<link rel="stylesheet" href="css\/jogo\.css">\s*/i, () => `<style>\n${css}\n</style>\n`)
    .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/i, '')
    .replace(/<script type="module" src="js\/main\.js"><\/script>\s*/i, '');
  const arquivos = arquivosEmbutidos();
  const blocos = [];
  blocos.push('<script>window.__embutido=true;window.__carga=function(f){var b=document.getElementById("carga-barra"),t=document.getElementById("carga-texto");if(b)b.style.width=Math.round(f*85)+"%";if(t)t.textContent="Baixando o jogo… "+Math.round(f*100)+"%";};</script>');
  let bytes = 0;
  arquivos.forEach((rel, k) => {
    const buf = fs.readFileSync(path.join(RAIZ, rel));
    bytes += buf.length;
    blocos.push(`<script type="application/octet-stream" id="embutido:${rel}">${buf.toString('base64')}</script><script>__carga(${((k + 1) / arquivos.length).toFixed(3)})</script>`);
  });
  // o codigo por ultimo; "</script" dentro de string do codigo fecharia a tag antes da hora
  blocos.push(`<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  // FUNCAO como substituto, nunca texto: o codigo minificado tem `$&` (ex.: `a=$&&b`), que no replace com texto vira "o trecho
  // casado" — e o </body> aparecia no meio do three.js (custou um SyntaxError "Unexpected token '<'" na primeira montagem)
  html = html.replace(/<\/body>/i, () => blocos.join('\n') + '\n</body>');
  fs.writeFileSync(SAIDA, html);
  const mb = fs.statSync(SAIDA).size / 1e6;
  console.log(`TurboCaos.html: ${mb.toFixed(2)} MB (codigo ${(js.length / 1e6).toFixed(2)} MB, ${arquivos.length} arquivos embutidos com ${(bytes / 1e6).toFixed(2)} MB antes do base64) em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (mb > LIMITE_MB) console.log(`AVISO: passou de ${LIMITE_MB} MB — ver docs/PENDENCIAS.md (carregar os carros sob demanda)`);
  montaArtefato(index);
}

/** Pastas e arquivos que vao para o artefato, como estao (ES modules: o navegador do celular le direto, igual ao desenvolvimento). */
const PARA_O_ARTEFATO = ['css', 'js', 'config', 'lib'];
function copiaPasta(de, para, lista) {
  fs.mkdirSync(para, { recursive: true });
  for (const f of fs.readdirSync(de)) {
    const a = path.join(de, f), b = path.join(para, f);
    if (fs.statSync(a).isDirectory()) copiaPasta(a, b, lista);
    else if (/\.(js|css|wasm)$/.test(f)) { fs.copyFileSync(a, b); lista.push(path.relative(path.join(RAIZ, 'dist', 'artefato'), b)); }
  }
}
function montaArtefato(index) {
  const DEST = path.join(RAIZ, 'dist', 'artefato');
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });
  const lista = [];
  for (const p of PARA_O_ARTEFATO) if (fs.existsSync(path.join(RAIZ, p))) copiaPasta(path.join(RAIZ, p), path.join(DEST, p), lista);
  // GLB -> modulo JS com o base64 (o artefato nao serve .glb)
  const pasta = path.join(RAIZ, 'assets', 'cars');
  if (fs.existsSync(pasta)) {
    fs.mkdirSync(path.join(DEST, 'assets', 'cars'), { recursive: true });
    for (const f of fs.readdirSync(pasta).sort()) if (f.endsWith('.glb')) {
      const rel = 'assets/cars/' + f + '.js';
      fs.writeFileSync(path.join(DEST, rel), `export default '${fs.readFileSync(path.join(pasta, f)).toString('base64')}';\n`);
      lista.push(rel);
    }
  }
  // a pagina: a mesma do desenvolvimento + o aviso para o js/glb.js ler os .glb.js
  const html = index.replace(/<script type="module" src="js\/main\.js"><\/script>/i, () => '<script>window.__glbComoModulo = true;</script>\n<script type="module" src="js/main.js"></script>');
  fs.writeFileSync(path.join(DEST, 'index.html'), html);
  lista.unshift('index.html');
  fs.writeFileSync(path.join(DEST, 'arquivos.json'), JSON.stringify(lista.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b))), null, 1));
  let total = 0; for (const r of lista) total += fs.statSync(path.join(DEST, r)).size;
  console.log(`dist/artefato/: ${lista.length} arquivos, ${(total / 1e6).toFixed(2)} MB (lista em dist/artefato/arquivos.json)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
