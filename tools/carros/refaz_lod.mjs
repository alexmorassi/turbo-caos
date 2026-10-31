// REFAZ A VERSAO LEVE (*_lo) DE UM CARRO DO CIDADE ABERTA (30/10/2026). Nasceu para o FUSCA TETO SOLAR: o Morassi pediu "os carros com
// pops and bangs do Cidade Aberta" e o Fusca turbo e um deles, mas a body_lo dele veio com defeito de GEOMETRIA (docs/fases/fase1_carros.md;
// docs/fotos/carros_fusca_descartado.jpg): a lataria do Meshy e uma CASCA DUPLA e o mklod.py do Cidade Aberta reduziu as duas cascas
// juntas - o forro de dentro da porta atravessa a de fora (manchas claras) e a de fora some em pedacos (furos escuros no pe da porta).
// Repintar a faixa nao cura (a fase 1 tentou: o defeito e da malha) e a malha cheia nao reduz sem estragar a textura (costuras de UV).
//
// COMO (o tools/lodatlas.py do Cidade Aberta + um passo antes):
//   1) extrai  a malha CHEIA (body, 171 mil triangulos) e as texturas de origem (KTX2 -> PNG) para tools/carros/cache/<id>/;
//   2) pele    (refaz_lod.py) z-buffer de pontos em 9 vistas (nenhuma por baixo: o Meshy e aberto embaixo): fica so o triangulo que
//              aparece de fora E esta virado para quem olha - a casca de dentro (o forro) sai ANTES de reduzir; as rachaduras da
//              lataria (lacos de borda pequenos) ganham tampa e a visibilidade roda de novo;
//   3) reduz   a pele com o meshopt, soldada so por posicao (a UV vai ser refeita: costura nao prende mais nada). LIMITE CONHECIDO: na
//              porta do Fusca a pele e uma colcha de pedacos de camadas a menos de 2,5 mm uma da outra (casca dupla + tampas + remendos do
//              Cidade Aberta) e a reducao deixa frestas pequenas entre eles - de perto, pontinhos escuros na porta (de longe, na corrida,
//              nao aparecem). Tentado em 30/10/2026 e descartado: refazer a lataria por VOXEL + marching cubes fechava as frestas mas a
//              casca saia dos dois lados da lataria (o Fusca e aberto embaixo e no teto solar) e, reduzida, ficava facetada e manchada;
//   4) faixa   (refaz_lod.py) cartas novas na faixa de baixo do atlas (v 0,875..1, 2048 x 256 - o mesmo lugar das *_lo do Cidade
//              Aberta) e cada texel PINTADO pelo ponto mais perto da pele de fora, olhando para o mesmo lado;
//   5) monta   uma copia do GLB de origem com a body_lo nova e as texturas com a faixa nova (PNG) em tools/carros/cache/<origem>_lo.glb.
// O otimiza.mjs le essa copia quando a tabela diz `refeita: true` (rodas, extras e o resto vem iguais da origem).
//   node tools/carros/refaz_lod.mjs fusca_teto [triangulos=16000]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ORIGEM, AQUI } from './comum.mjs';
import { TABELA } from './tabela.mjs';
import { extrai, solda, simplifica, tris } from './geometria.mjs';
import { decodificaKTX2 } from './texturas.mjs';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const [id, alvoArg] = process.argv.slice(2);
const car = TABELA.find((c) => c.id === id);
if (!car) throw new Error('id desconhecido: ' + id);
const ALVO = Number(alvoArg) || 16000;   // a body_lo do Cidade Aberta tem 16-17 mil (mklod.py TGT 16000)
const PASTA = path.join(AQUI, 'cache', id);
fs.mkdirSync(PASTA, { recursive: true });
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);
const grava = (nome, arr) => fs.writeFileSync(path.join(PASTA, nome), Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
const le = (nome, Tipo) => { const b = fs.readFileSync(path.join(PASTA, nome)); return new Tipo(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
function python(cmd) {
  const r = spawnSync('python3', [path.join(AQUI, 'refaz_lod.py'), cmd, PASTA], { stdio: 'inherit', env: { ...process.env, OPENBLAS_NUM_THREADS: '1' } });
  if (r.status !== 0) throw new Error(`refaz_lod.py ${cmd} falhou`);
}

// 1) extrai
const doc = await io.read(path.join(ORIGEM, car.origem));
const nos = Object.fromEntries(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
if (!nos.body || !nos.body_lo) throw new Error(`${car.origem}: precisa de body e body_lo`);
const cheia = extrai(nos.body);
grava('cheia_pos.f32', cheia.pos); grava('cheia_uv.f32', cheia.uv); grava('cheia_idx.u32', cheia.idx);
// as rodas leves de origem estao boas, mas a UV delas aponta para a MESMA faixa que vai ser trocada: entram nas cartas novas e levam a
// propria cor junto (refaz_lod.py faixa)
const RODAS = [1, 2, 3, 4].map((i) => `wheel${i}_lo`).filter((r) => nos[r] && nos[r].getMesh());
for (const r of RODAS) { const p = extrai(nos[r]); grava(r + '_pos.f32', p.pos); grava(r + '_nor.f32', p.nor); grava(r + '_uv.f32', p.uv); grava(r + '_idx.u32', p.idx); }
fs.writeFileSync(path.join(PASTA, 'pecas.json'), JSON.stringify({ rodas: RODAS }));
const mat = nos.body_lo.getMesh().listPrimitives()[0].getMaterial();
const texs = { cor: mat.getBaseColorTexture(), mr: mat.getMetallicRoughnessTexture() };
const atlas = {};
for (const [nome, t] of Object.entries(texs)) {
  const img = await decodificaKTX2(t.getImage());
  atlas[nome] = img;
  await sharp(Buffer.from(img.rgba), { raw: { width: img.largura, height: img.altura, channels: 4 } }).png().toFile(path.join(PASTA, nome + '.png'));
}
if (atlas.cor.largura !== 2048 || atlas.cor.altura !== 2048) throw new Error('o refaz_lod.py conta com o atlas de cor de 2048: ' + atlas.cor.largura);
log(`extraiu ${car.origem}: body ${tris(cheia)} triangulos, texturas ${Object.keys(atlas).join(' e ')} ${atlas.cor.largura}`);

// 2) pele de fora (e as tampas das rachaduras)
python('pele');

// 3) reduz a pele tampada (ja soldada por posicao no refaz_lod.py: a normal e a UV entram como iguais em todo canto)
const pelePos = le('pele_pos.f32', Float32Array), idx = le('pele_idx.u32', Uint32Array);
const n = pelePos.length / 3, nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
for (let i = 0; i < n; i++) nor[3 * i + 1] = 1;
let leve = solda({ nome: 'body_lo', pos: pelePos, nor, uv, idx }, { tolPos: 1e-5, tolUv: 1, angulo: 180 });
const antes = tris(leve);
leve = await simplifica(leve, ALVO, { erro: 0.05, pesoNormal: 0, pesoUv: 0 });
if (tris(leve) > ALVO * 1.1) leve = await simplifica(leve, ALVO, { erro: 0.05, pesoNormal: 0, pesoUv: 0, flags: ['Permissive'] });
log(`pele: ${antes} -> ${tris(leve)} triangulos (erro ${(leve.erro * 1000).toFixed(1)} mm)`);
grava('leve_pos.f32', leve.pos); grava('leve_idx.u32', leve.idx);

// 4) faixa: cartas, normais e a pintura
python('faixa');

// 5) monta a copia do GLB de origem: cada peca em sopa (3 vertices por triangulo; o otimiza.mjs solda), de volta ao espaco do no
const buf = doc.getRoot().listBuffers()[0];
const acessor = (tipo, arr) => doc.createAccessor().setType(tipo).setArray(arr).setBuffer(buf);
let trisNovos = 0;
for (const nome of ['body_lo', ...RODAS]) {
  const no = nos[nome], M = no.getWorldMatrix();
  // so translacao (os GLB do Cidade Aberta: rodas com t e o resto identidade); outra coisa precisaria da inversa inteira
  if ([0, 1, 2, 4, 5, 6, 8, 9, 10].some((k) => Math.abs(M[k] - (k % 5 === 0 ? 1 : 0)) > 1e-6)) throw new Error(`${nome}: no com rotacao/escala`);
  if (nome !== 'body_lo' && nos.body.getMesh() === no.getMesh()) throw new Error(`${nome} divide o mesh com a body`);
  const pos = le(`refeita_${nome}_pos.f32`, Float32Array), nr = le(`refeita_${nome}_nor.f32`, Float32Array), uvs = le(`refeita_${nome}_uv.f32`, Float32Array);
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= M[12]; pos[i + 1] -= M[13]; pos[i + 2] -= M[14]; }
  const nv = pos.length / 3, ix = nv < 65536 ? new Uint16Array(nv) : new Uint32Array(nv); for (let i = 0; i < nv; i++) ix[i] = i;
  const prims = no.getMesh().listPrimitives();
  if (prims.length !== 1) throw new Error(`${nome}: ${prims.length} primitivas (esperava 1)`);
  const prim = prims[0];
  prim.setAttribute('POSITION', acessor('VEC3', pos)).setAttribute('NORMAL', acessor('VEC3', nr)).setAttribute('TEXCOORD_0', acessor('VEC2', uvs)).setIndices(acessor('SCALAR', ix));
  for (const a of ['TANGENT', 'COLOR_0', 'TEXCOORD_1']) if (prim.getAttribute(a)) prim.setAttribute(a, null);
  trisNovos += nv / 3;
}
// a body_lo e uma malha so dela (o mesh nao e dividido com a body cheia): conferido porque a troca mexe no mesh inteiro
if (nos.body.getMesh() === nos.body_lo.getMesh()) throw new Error('body e body_lo dividem o mesmo mesh');
// as texturas: o atlas de origem com a faixa de baixo trocada pela pintada (PNG: o otimiza.mjs le PNG ou KTX2)
// (o metal/rugosidade do Fusca e de 1024: a faixa pintada em 2048 x 256 desce para 1024 x 128 - a mesma fracao do atlas)
for (const [nome, t] of Object.entries(texs)) {
  const A = atlas[nome], hf = A.altura / 8;
  const f = await sharp(path.join(PASTA, nome + '_faixa.png')).resize(A.largura, hf, { kernel: 'lanczos3', fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const rgba = Buffer.from(A.rgba); f.copy(rgba, A.largura * (A.altura - hf) * 4);
  t.setImage(await sharp(rgba, { raw: { width: A.largura, height: A.altura, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
}
const saida = path.join(AQUI, 'cache', car.origem.replace(/\.glb$/, '_lo.glb'));
await io.write(saida, doc);
log(`gravou ${path.relative(path.join(AQUI, '..', '..'), saida)} (${(fs.statSync(saida).size / 1e6).toFixed(1)} MB): ${trisNovos} triangulos leves (carroceria nova + ${RODAS.length} rodas)`);
