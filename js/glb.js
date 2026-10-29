// CARREGADOR DOS GLB (fase 1). O mesmo desenho do js/glb.js do Cidade Aberta: UM GLTFLoader para o jogo inteiro, com o KTX2Loader
// (textura comprimida que a placa de video le direto: ETC2/ASTC no celular, BC7 no PC — 4x menos memoria de video que JPEG) e o
// MeshoptDecoder (geometria comprimida e quantizada: o carro de 15 MB do Meshy vira menos de 1,5 MB) pendurados nele.
//
// A DIFERENCA para o Cidade Aberta: o Turbo Caos tambem roda como HTML UNICO aberto direto do disco ou do celular (TurboCaos.html,
// montado por tools/monta.js). Em file:// o navegador bloqueia ES modules e fetch de arquivo, entao no HTML unico:
//   * cada GLB vem embutido em base64 num <script type="application/octet-stream" id="embutido:<caminho>"> e e decodificado SO quando
//     o jogo pede aquele carro (o "carregado sob demanda" do pedido: os 10 carros ficam no arquivo, mas so viram malha quando usados);
//   * o transcodificador Basis (basis_transcoder.js + .wasm) tambem vem embutido; o KTX2Loader pede os dois pelo FileLoader e o
//     `setURLModifier` do LoadingManager troca o caminho por uma data: URL (fetch de data: funciona ate em file://).
// No ARTEFATO do claude.ai (a entrega principal, o mesmo jeito do jogo do Breno) o servidor nao entrega .glb: cada GLB vai tambem
// como modulo JS com o GLB em base64 (`assets/cars/x.glb.js`, `export default '...'`, gerado pelo tools/monta.js) e e importado sob
// demanda — a pagina do artefato liga `window.__glbComoModulo`.
// No desenvolvimento (index.html + server.py) nada disso existe e tudo chega por HTTP, como no Cidade Aberta.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Pasta do transcodificador, relativa a pagina (index.html e TurboCaos.html ficam na raiz do projeto). */
const CAMINHO_BASIS = 'lib/addons/libs/basis/';

/** O bloco embutido pelo tools/monta.js, ou null no desenvolvimento. */
export function embutido(caminho) {
  return typeof document !== 'undefined' ? document.getElementById('embutido:' + caminho) : null;
}

/** base64 -> ArrayBuffer. atob devolve uma string binaria; o laco e o jeito sem copia extra que funciona em todo navegador. */
export function base64ParaBuffer(b64) {
  const bin = atob(b64.trim());
  const n = bin.length, bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// O LoadingManager e de todos os loaders: o KTX2Loader pede o transcodificador por ele e o GLTFLoader pede as texturas por ele.
// Caminho que nao esta embutido passa reto (blob: das texturas de dentro do GLB, http no desenvolvimento).
const gerente = new THREE.LoadingManager();
gerente.setURLModifier((url) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const i = url.indexOf(CAMINHO_BASIS);
  if (i >= 0) {
    const el = embutido(url.slice(i));
    if (el) return 'data:application/octet-stream;base64,' + el.textContent.trim();
  }
  return url;
});

let ktx2 = null;

/** Uma vez, logo depois de criar o renderer: descobre que formato comprimido a placa aceita. Tem de vir ANTES do primeiro GLB, senao
 *  a textura sai preta (armadilha anotada no dinotrails-web). */
export function iniciaGLB(renderer) {
  if (ktx2) return ktx2;
  // workers: um a menos que os nucleos (o laco do jogo fica com um), no maximo 4 e no minimo 1 — mesmo teto do Cidade Aberta
  const nucleos = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  ktx2 = new KTX2Loader(gerente).setTranscoderPath(CAMINHO_BASIS).setWorkerLimit(Math.max(1, Math.min(4, nucleos - 1)));
  try { ktx2.detectSupport(renderer); } catch (e) { console.warn('KTX2 sem suporte', e); ktx2 = null; }
  return ktx2;
}

/** GLTFLoader pronto para GLB com textura KTX2 e geometria meshopt. */
export function carregadorGLB() {
  const L = new GLTFLoader(gerente);
  if (ktx2) L.setKTX2Loader(ktx2);
  L.setMeshoptDecoder(MeshoptDecoder);
  return L;
}

const _cache = new Map();

/** Carrega um GLB pelo caminho do projeto (ex.: 'assets/cars/vulcao.glb'). Embutido no HTML unico: decodifica o base64 e faz parse;
 *  no desenvolvimento: HTTP. Guarda a promessa (o mesmo carro pedido pela selecao e pela corrida e lido uma vez so). Devolve o gltf. */
export function carregaGLB(caminho) {
  if (_cache.has(caminho)) return _cache.get(caminho);
  const L = carregadorGLB();
  const el = embutido(caminho);
  let p;
  if (el) p = L.parseAsync(base64ParaBuffer(el.textContent), '');
  else if (typeof window !== 'undefined' && window.__glbComoModulo) {
    // caminho numa variavel (o esbuild do HTML unico nao tenta empacotar) e relativo a pagina, nao a este modulo
    const url = new URL(caminho + '.js', document.baseURI).href;
    p = import(url).then((m) => L.parseAsync(base64ParaBuffer(m.default), ''));
  } else p = L.loadAsync(caminho);
  _cache.set(caminho, p);
  p.catch(() => _cache.delete(caminho)); // falhou: deixa tentar de novo (rede do celular que caiu no meio)
  return p;
}
