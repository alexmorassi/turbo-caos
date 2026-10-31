// OTIMIZA OS CARROS DO TURBO CAOS (fase 1): GLB do Cidade Aberta (12-22 MB, feitos para PC) -> assets/cars/<id>.glb
// (< 1,5 MB, para ir em base64 num HTML unico no celular).
//   node tools/carros/otimiza.mjs                 todos os carros da tabela
//   node tools/carros/otimiza.mjs vulcao picole   so esses (os outros ficam como estao em medidas.json)
// Depois: node tools/carros/gera_config.mjs (config/carros.js), node tools/carros/confere.mjs e node tools/carros/folha.mjs.
//
// O que sai (o CONTRATO com o jogo - detalhe no docs/fases/fase1_carros.md):
//   cena -> carro (extras: id, rodas, ...)
//             body          (sem malha, na origem; o jogo inclina ESTE no para a rolagem/arfagem)
//               body_malha  (a malha; a quantizacao do meshopt poe translation/scale AQUI, por isso o pivo e o pai)
//               pod0..pod3  (so no voador: turbinas paradas, filhas do body para inclinarem junto)
//             wheel1..4     (sem malha, translation = centro da roda; extras { radius, front, side })
//               wheelN_malha (malha centrada no pivo: o jogo gira wheelN.rotation.x e a roda gira no proprio eixo)
//   Frente = +Z, cima = +Y, metros; x e z no centro da caixa, y = 0 no ponto mais baixo das rodas.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ, ORIGEM, AQUI } from './comum.mjs';
import { TABELA, ALVO } from './tabela.mjs';
import { extrai, junta, solda, simplifica, caixa, normaliza, desloca, tris, eixoDaRoda } from './geometria.mjs';
import { decodificaKTX2, renormaliza, codificaKTX2, psnr, TF } from './texturas.mjs';
import { cobertura, blocoLivre } from './chapa.mjs';

const require = createRequire(import.meta.url);
const { Document, NodeIO, TextureInfo } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRTextureBasisu } = require('@gltf-transform/extensions');
const { meshopt } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const SAIDA = path.join(RAIZ, 'assets', 'cars');
const MEDIDAS = path.join(AQUI, 'medidas.json');
const LIMITE_KB = 1500;   // pedido da fase: cada GLB < 1,5 MB (os 10 vao em base64 num HTML so)

// FAIXA DO LOD: o lodatlas.py do Cidade Aberta empacota as cartas das *_lo em v de 0,875 a 1 (12,5 % de baixo do atlas;
// medido em todos os 9 carros 'lo': v minimo 0,8756). Recortar so essa faixa da textura de 2048 da 2048 x 256 texels na
// resolucao ORIGINAL do LOD (reduzir o atlas inteiro para 1024 deixaria o LOD com 1024 x 128: metade da nitidez).
const FAIXA_LO = [0.875, 1.0];
// ATLAS DA MALHA ALTA: as cartas da malha cheia vao de v = 0 a 0,873 (a faixa do LOD fica vazia nos carros sem *_lo);
// recortar [0, 0,875] e esticar para 1024 x 1024 ganha 14 % de texel na vertical sem custar um byte.
const FAIXA_ALTA = [0.0, 0.875];

// alvo de triangulos da malha alta simplificada (os carros 'lo' ja chegam com 15-24 mil na carroceria + ~1,5 mil por roda)
const ALVO_TRIS = { body: 18000, roda: 2200 };

// TEXTURAS (decididas medindo; numeros no docs/fases/fase1_carros.md). PSNR sempre contra a MESMA referencia cheia (o
// menor e ampliado de volta), senao resolucoes diferentes nao se comparam.
//  cor    ETC1S q200 na resolucao da faixa do LOD (2048 x 256) ou 1024 x 1024 na malha alta. UASTC 1024 custaria 1,1 MB
//         so a cor; ETC1S q200 = 237 KB com 30 dB no atlas inteiro (q255 compra +0,3 dB por +25 KB)
//  mr     UASTC + RDO 2 em 1/4 da resolucao linear da cor (faixa 512 x 64; atlas 256 x 256). No mesmo tamanho o ETC1S
//         em resolucao cheia empata ou perde (shark 34,7 x 35,3 dB; fusca_teto 21,7 x 25,0 dB: G e B do metal/rugosidade
//         mudam independentes e o ETC1S divide endpoints entre canais). UASTC cheio daria 41 dB por 125 KB a mais
//         em CADA carro: diferenca de brilho que o celular nao mostra
//  normal UASTC + RDO 2, 512, so na malha alta (a faixa do LOD no mapa de normais e plana: nao ha o que guardar)
const TEX = {
  cor: { modo: 'etc1s', tipo: 'cor', q: 200, nivel: 2 },
  mr: { modo: 'uastc', tipo: 'dado', rdo: 2 },
  normal: { modo: 'uastc', tipo: 'normal', rdo: 2 },
};
const FRACAO_MR = 0.25;   // lado do metal/rugosidade em relacao ao lado da cor

const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...a);
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------------------------------- malhas de origem
function nosDeOrigem(doc) { return Object.fromEntries(doc.getRoot().listNodes().map((n) => [n.getName(), n])); }

function escolheMalhas(car, nos) {
  const lo = car.fonte === 'lo', suf = lo ? '_lo' : '';
  const corpoNomes = nos['body' + suf] ? ['body' + suf] : ['chassis', 'shell'];   // monster truck: chassi + carroceria
  for (const n of corpoNomes) if (!nos[n]?.getMesh()) throw new Error(`${car.origem}: falta o no ${n}`);
  const pecas = car.rodas === 'pods' ? [0, 1, 2, 3].map((i) => 'pod' + i) : [1, 2, 3, 4].map((i) => 'wheel' + i);
  return {
    corpo: corpoNomes.map((n) => nos[n]),
    pecas: pecas.map((nome) => {
      // espelha: { wheel3: 'wheel4' } = usa a malha da outra roda do eixo refletida em X (a *_lo do dourado cortou o topo
      // da wheel3, escondido no para-lama: girando, o buraco passa embaixo; a wheel4 e inteira)
      const fonteNome = car.espelha?.[nome] || nome;
      const malha = nos[fonteNome + suf] || nos[fonteNome];               // shark/redmonster nao tem wheelN_lo
      if (!malha?.getMesh()) throw new Error(`${car.origem}: falta ${nome + suf}`);
      return { nome, malha, espelhada: fonteNome !== nome, extras: (nos[nome] || malha).getExtras() || {} };   // extras (front, side, slide) moram no no alto
    }),
  };
}

// reflexo em X (posicao e normal) com a ordem dos cantos invertida, para a face continuar virada para fora
function espelhaX(p) {
  const pos = new Float32Array(p.pos), nor = new Float32Array(p.nor), idx = new Uint32Array(p.idx);
  for (let i = 0; i < pos.length; i += 3) { pos[i] = -pos[i]; nor[i] = -nor[i]; }
  for (let t = 0; t < idx.length; t += 3) { const b = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = b; }
  return { ...p, pos, nor, idx };
}

// -------------------------------------------------------------------------------------------------- janela de textura
// CHAPA = triangulo com os 3 cantos na MESMA UV (cor unica). O assoalho.py do Cidade Aberta fecha o fundo dos carros
// com uma chapa escura assim, apontando para 1 texel do atlas cheio (fusca_teto: 1.108 triangulos, 5,5 m2, todos em
// u 0,982 v 0,084). Ela nao conta para escolher a janela; ganha um bloco proprio da cor dela dentro da faixa.
const ehChapa = (p, t) => { const a = p.idx[t], b = p.idx[t + 1], c = p.idx[t + 2]; return Math.abs(p.uv[2 * a] - p.uv[2 * b]) + Math.abs(p.uv[2 * a] - p.uv[2 * c]) + Math.abs(p.uv[2 * a + 1] - p.uv[2 * b + 1]) + Math.abs(p.uv[2 * a + 1] - p.uv[2 * c + 1]) < 1e-6; };
function faixaUsada(partes) {
  let vmin = Infinity, vmax = -Infinity; const chapas = new Map();
  for (const p of partes) for (let t = 0; t < p.idx.length; t += 3) {
    if (ehChapa(p, t)) { const i = p.idx[t], ch = `${p.uv[2 * i].toFixed(5)},${p.uv[2 * i + 1].toFixed(5)}`; chapas.set(ch, [p.uv[2 * i], p.uv[2 * i + 1]]); continue; }
    for (let k = 0; k < 3; k++) { const v = p.uv[2 * p.idx[t + k] + 1]; if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
  }
  return { vmin, vmax, chapas: [...chapas.values()] };
}

// v' = (v - v0) / (v1 - v0): a janela recortada vira a textura inteira
function remapeiaV(p, [v0, v1]) {
  const uv = new Float32Array(p.uv); const k = 1 / (v1 - v0);
  for (let i = 1; i < uv.length; i += 2) uv[i] = Math.min(1, Math.max(0, (uv[i] - v0) * k));
  for (let i = 0; i < uv.length; i += 2) uv[i] = Math.min(1, Math.max(0, uv[i]));
  return { ...p, uv };
}

async function recorta(img, [v0, v1], larguraSaida, alturaSaida, opcoes = {}) {
  const y0 = Math.round(v0 * img.altura), y1 = Math.round(v1 * img.altura);
  let rgba = new Uint8Array(await sharp(Buffer.from(img.rgba), { raw: { width: img.largura, height: img.altura, channels: 4 } })
    .extract({ left: 0, top: y0, width: img.largura, height: y1 - y0 }).raw().toBuffer());
  const w = img.largura, h = y1 - y0;
  if (w !== larguraSaida || h !== alturaSaida) rgba = new Uint8Array(await sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).resize(larguraSaida, alturaSaida, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer());
  return opcoes.normal ? renormaliza(rgba) : rgba;
}

// ------------------------------------------------------------------------------------------- cor de destaque (paleta)
// Amostra a textura no centro de cada triangulo, pesando pela AREA real (m2): o que manda e o que aparece no carro,
// nao o que ocupa mais pixel no atlas. Grade de 4 bits por canal; devolve as cores mais presentes e as mais vivas (a cor de
// destaque de cada carro, em tabela.mjs, foi escolhida olhando esta lista).
function paleta(partes, rgba, w, h) {
  const peso = new Map(), soma = new Map();
  for (const p of partes) for (let t = 0; t < p.idx.length; t += 3) {
    const a = p.idx[t], b = p.idx[t + 1], c = p.idx[t + 2], P = p.pos;
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    const u = (p.uv[2 * a] + p.uv[2 * b] + p.uv[2 * c]) / 3, v = (p.uv[2 * a + 1] + p.uv[2 * b + 1] + p.uv[2 * c + 1]) / 3;
    const x = Math.min(w - 1, Math.max(0, Math.floor(u * w))), y = Math.min(h - 1, Math.max(0, Math.floor(v * h))), i = 4 * (y * w + x);
    const ch = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    peso.set(ch, (peso.get(ch) || 0) + area);
    const s = soma.get(ch) || [0, 0, 0]; s[0] += rgba[i] * area; s[1] += rgba[i + 1] * area; s[2] += rgba[i + 2] * area; soma.set(ch, s);
  }
  const total = [...peso.values()].reduce((a, b) => a + b, 0);
  const cores = [...peso.entries()].map(([ch, wv]) => { const s = soma.get(ch); const rgb = s.map((x) => Math.round(x / wv)); const mx = Math.max(...rgb), mn = Math.min(...rgb); return { hex: '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join(''), fracao: wv / total, saturacao: mx ? (mx - mn) / mx : 0, valor: mx / 255 }; }).sort((a, b) => b.fracao - a.fracao);
  // vivas: saturacao x brilho, entre as que cobrem >= 0,3 % da area (a lava do vulcao e o rosa do picole sao detalhe pequeno,
  // mas sao a cara do carro; preto de pneu/vidro ganha de tudo em area e nao serve de cor de destaque)
  const vivas = cores.filter((c) => c.fracao >= 0.003).sort((a, b) => b.saturacao * b.valor - a.saturacao * a.valor).slice(0, 5);
  const fmt = (c) => ({ hex: c.hex, pct: +(100 * c.fracao).toFixed(1) });
  return { principais: cores.slice(0, 6).map(fmt), vivas: vivas.map(fmt) };
}

// -------------------------------------------------------------------------------------------------- GLB de saida
function acessor(doc, buf, tipo, array) { return doc.createAccessor().setType(tipo).setArray(array).setBuffer(buf); }

function malhaGLTF(doc, buf, nome, p, material) {
  const nv = p.pos.length / 3;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acessor(doc, buf, 'VEC3', p.pos))
    .setAttribute('NORMAL', acessor(doc, buf, 'VEC3', p.nor))
    .setAttribute('TEXCOORD_0', acessor(doc, buf, 'VEC2', p.uv))
    .setIndices(acessor(doc, buf, 'SCALAR', nv < 65536 ? new Uint16Array(p.idx) : new Uint32Array(p.idx)))
    .setMaterial(material);
  return doc.createMesh(nome).addPrimitive(prim);
}

// a textura de origem e KTX2 (Cidade Aberta) ou PNG (a copia do refaz_lod.mjs): { largura, altura, rgba } nos dois casos
async function decodificaImagem(t) {
  if (t.getMimeType() !== 'image/png') return decodificaKTX2(t.getImage());
  const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { largura: info.width, altura: info.height, rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info: { png: true } };
}

function infoTextura(ti) {
  // CLAMP: a textura recortada vai de borda a borda; com REPEAT o filtro linear puxaria a borda oposta para a primeira
  // e a ultima linha de texel (a UV nunca sai de 0..1, entao clamp nao muda mais nada)
  ti.setWrapS(TextureInfo.WrapMode.CLAMP_TO_EDGE).setWrapT(TextureInfo.WrapMode.CLAMP_TO_EDGE)
    .setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR).setMagFilter(TextureInfo.MagFilter.LINEAR);
}

// ---------------------------------------------------------------------------------------------------------- um carro
async function processa(car) {
  log(`== ${car.id} (${car.origem}, fonte ${car.fonte})`);
  // refeita: a *_lo de origem tinha defeito e o tools/carros/refaz_lod.mjs fez outra numa copia do GLB (o fusca_teto, 30/10/2026)
  const arqOrigem = car.refeita ? path.join(AQUI, 'cache', car.origem.replace(/\.glb$/, '_lo.glb')) : path.join(ORIGEM, car.origem);
  if (!fs.existsSync(arqOrigem)) throw new Error(`${car.id}: falta ${arqOrigem} - rode node tools/carros/refaz_lod.mjs ${car.id}`);
  const src = await io.read(arqOrigem);
  const nos = nosDeOrigem(src), escolha = escolheMalhas(car, nos);
  const matSrc = escolha.corpo[0].getMesh().listPrimitives()[0].getMaterial();

  const ehVoadorTab = car.rodas === 'pods';
  // 1) malhas em espaco de mundo, soldadas (e simplificadas, na fonte alta)
  let corpo = solda(junta('body', escolha.corpo.map(extrai)));
  let pecas = escolha.pecas.map((q) => ({ ...q, parte: solda({ ...(q.espelhada ? espelhaX(extrai(q.malha)) : extrai(q.malha)), nome: q.nome }) }));
  const trisOrigem = tris(corpo) + pecas.reduce((s, q) => s + tris(q.parte), 0);
  const simplificacao = {};
  if (car.fonte === 'alta') {
    // CARROCERIA com Permissive: nos GLB do Meshy as cartas de UV sao miudas (1,4 a 1,7 vertice por posicao) e sem esta
    // opcao o meshopt TRAVA nas costuras. Com ela o colapso pode atravessar costura e sujar a textura - medido e fotografado:
    // no shark (128 mil -> 18 mil, 14 %) ficou limpo; no fusca_teto (171 mil -> 17 mil, 10 %) virou mosaico de cartas
    // erradas, por isso o fusca_teto saiu do jogo. Carro novo na fonte 'alta': OLHE a foto de perto antes de aceitar.
    const antes = tris(corpo); corpo = await simplifica(corpo, ALVO_TRIS.body, { erro: 0.05, flags: ['Permissive'] });
    simplificacao.body = { de: antes, para: tris(corpo), erro_m: r3(corpo.erro) };
    // roda SEM Permissive: com ele o pneu do shark (78 mil -> 2,2 mil) ganhou pintas azuis da carroceria (colapso
    // atravessando costura de UV). Sem ele o meshopt para quando a costura trava (~4,5 mil por roda): mais triangulo,
    // textura certa.
    for (const q of pecas) { const a = tris(q.parte); q.parte = await simplifica(q.parte, ALVO_TRIS.roda, { erro: 0.05 }); simplificacao[q.nome] = { de: a, para: tris(q.parte), erro_m: r3(q.parte.erro) }; }
  }

  // 2) pods do voador: o GLB guarda as turbinas ABERTAS (modo voo do Cidade Aberta); 'recolhidos' as poe para dentro
  // pelo 'slide' de cada uma (o mesmo calculo do vehicles.js: x - side * slide), que e o modo rua.
  if (car.rodas === 'pods' && car.pods === 'recolhidos') pecas = pecas.map((q) => ({ ...q, parte: desloca(q.parte, [q.extras.side * q.extras.slide, 0, 0]) }));

  // 3) janela de textura que as malhas usam (sem contar as chapas de cor unica)
  const uso = faixaUsada([corpo, ...pecas.map((q) => q.parte)]);
  const janela = uso.vmin >= FAIXA_LO[0] - 1e-3 ? FAIXA_LO : uso.vmax <= FAIXA_ALTA[1] + 1e-3 ? FAIXA_ALTA : [0, 1];
  const lo = janela === FAIXA_LO;
  log(`   uv usada v=[${uso.vmin.toFixed(4)}, ${uso.vmax.toFixed(4)}] -> janela ${JSON.stringify(janela)}${uso.chapas.length ? ` (${uso.chapas.length} chapa(s) de cor unica)` : ''}`);

  // 4) texturas da origem, recortadas na janela, na resolucao da ORIGEM (o bloco da chapa e pintado nela; reduz depois)
  const fontes = { cor: matSrc.getBaseColorTexture(), mr: matSrc.getMetallicRoughnessTexture(), normal: matSrc.getNormalTexture() };
  const origemTex = {}, janelaTex = {};
  for (const papel of ['cor', 'mr', 'normal']) {
    if (!fontes[papel]) continue;
    if (papel === 'normal' && lo) continue;
    const img = await decodificaImagem(fontes[papel]); origemTex[papel] = img;
    const w = img.largura, h = Math.round(img.altura * (janela[1] - janela[0]));
    janelaTex[papel] = { rgba: await recorta(img, janela, w, h), w, h };
  }
  // chapas de cor unica: cada uma ganha um bloco 8x8 livre da faixa pintado com a cor (e o metal/rugosidade) dela
  const chapasFeitas = [];
  // (so as que apontam para FORA da janela: chapa cujo texel ja esta na faixa nao precisa de nada - o buggy tem 8 assim)
  const chapasFora = uso.chapas.filter(([, v]) => v < janela[0] - 1e-4 || v > janela[1] + 1e-4);
  if (chapasFora.length) {
    const ocup = cobertura([corpo, ...pecas.map((q) => q.parte)], janela, janelaTex.cor.w, janelaTex.cor.h);
    for (const [u, v] of chapasFora) {
      const bl = blocoLivre(ocup, janelaTex.cor.w, janelaTex.cor.h, 8); if (!bl) throw new Error(`${car.id}: sem bloco livre na faixa para a chapa`);
      for (let j = -2; j < bl.lado + 2; j++) for (let i = -2; i < bl.lado + 2; i++) { const x = bl.x + i, y = bl.y + j; if (x >= 0 && y >= 0 && x < janelaTex.cor.w && y < janelaTex.cor.h) ocup[y * janelaTex.cor.w + x] = 1; }
      for (const papel of ['cor', 'mr']) {
        const o = origemTex[papel], J = janelaTex[papel], k = 4 * (Math.min(o.altura - 1, Math.floor(v * o.altura)) * o.largura + Math.min(o.largura - 1, Math.floor(u * o.largura)));
        const f = J.w / janelaTex.cor.w, x0 = Math.floor(bl.x * f), y0 = Math.floor(bl.y * f), lado = Math.max(2, Math.round(bl.lado * f));
        for (let y = y0; y < y0 + lado; y++) for (let x = x0; x < x0 + lado; x++) J.rgba.set(o.rgba.subarray(k, k + 4), 4 * (y * J.w + x));
      }
      const nu = (bl.x + bl.lado / 2) / janelaTex.cor.w, nv = janela[0] + ((bl.y + bl.lado / 2) / janelaTex.cor.h) * (janela[1] - janela[0]);
      for (const p of [corpo, ...pecas.map((q) => q.parte)]) for (let i = 0; i < p.uv.length; i += 2) if (Math.abs(p.uv[i] - u) < 1e-5 && Math.abs(p.uv[i + 1] - v) < 1e-5) { p.uv[i] = nu; p.uv[i + 1] = nv; }
      chapasFeitas.push({ de: [+u.toFixed(4), +v.toFixed(4)], bloco: [bl.x, bl.y, bl.lado] });
      log(`   chapa de cor unica uv(${u.toFixed(3)}, ${v.toFixed(3)}) -> bloco ${bl.lado}x${bl.lado} em (${bl.x}, ${bl.y}) da faixa`);
    }
  }

  // 5) normalizacao: s = min(4,2/C, 2,3/L, 2,6/A) sobre a caixa do carro INTEIRO; x,z no centro; y = 0 no pe da roda
  const cx = caixa([corpo, ...pecas.map((q) => q.parte)]);
  const s = Math.min(ALVO.comprimento / cx.tam[2], ALVO.largura / cx.tam[0], ALVO.altura / cx.tam[1]);
  const limita = s === ALVO.comprimento / cx.tam[2] ? 'comprimento' : s === ALVO.largura / cx.tam[0] ? 'largura' : 'altura';
  const chaoY = car.rodas === 'pods' ? cx.min[1] : caixa(pecas.map((q) => q.parte)).min[1];   // voador: o ponto mais baixo de tudo
  const origem = [cx.centro[0], chaoY, cx.centro[2]];
  corpo = remapeiaV(normaliza(corpo, s, origem), janela);
  pecas = pecas.map((q) => ({ ...q, parte: remapeiaV(normaliza(q.parte, s, origem), janela) }));

  // 6) pivo de cada roda = EIXO ajustado na banda de rodagem (eixoDaRoda: a caixa erra com pneu cortado ou com cravo);
  // pod do voador nao gira: pivo no centro da caixa. A malha fica centrada no pivo.
  const pivos = pecas.map((q) => {
    const tOrig = q.malha.getWorldTranslation(); if (q.espelhada) tOrig[0] = -tOrig[0];
    const pivoOrigem = tOrig.map((v, k) => s * (v - origem[k]));   // o eixo que o Cidade Aberta ajustou
    const ex = ehVoadorTab ? null : eixoDaRoda(q.parte), c = caixa([q.parte]);
    const centro = ex ? ex.centro : c.centro, raio = ex ? ex.raio : (c.tam[1] + c.tam[2]) / 4;
    return { ...q, centro, raio, tam: c.tam, ajuste: ex, difPivo: Math.hypot(...centro.map((v, k) => v - pivoOrigem[k])),
      difCaixa: ex ? Math.hypot(...centro.map((v, k) => v - c.centro[k])) : 0, parte: desloca(q.parte, centro) };
  });

  // 7) texturas finais: tamanho de saida, codifica e DECODIFICA DE VOLTA pelo transcoder do jogo (prova que abre e mede)
  const texturas = {};
  if (fontes.normal && lo) texturas.normal = { descartada: 'faixa do LOD plana no mapa de normais' };
  let corDecod = null;
  for (const papel of ['cor', 'mr', 'normal']) {
    const J = janelaTex[papel]; if (!J) continue;
    // cor da faixa do LOD na resolucao da origem (2048 x 256); cor da malha alta 1024 x 1024; mr = 1/4 do lado da cor;
    // normal 512
    const corBase = lo ? [janelaTex.cor.w, janelaTex.cor.h] : [1024, 1024];
    const [w, h] = papel === 'cor' ? corBase : papel === 'mr' ? corBase.map((v) => Math.round(v * FRACAO_MR)) : [512, 512];
    let rgba = J.rgba;
    if (J.w !== w || J.h !== h) rgba = new Uint8Array(await sharp(Buffer.from(J.rgba), { raw: { width: J.w, height: J.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer());
    if (papel === 'normal') rgba = renormaliza(rgba);
    if (papel === 'cor') corDecod = { rgba, w, h };
    const bytes = await codificaKTX2(rgba, w, h, TEX[papel]);
    const volta = await decodificaKTX2(bytes);
    const tfEsperado = papel === 'cor' ? TF.SRGB : TF.LINEAR;
    if (volta.info.tf !== tfEsperado) throw new Error(`${car.id} ${papel}: OETF ${volta.info.tf}, esperado ${tfEsperado}`);
    const img = origemTex[papel];
    texturas[papel] = { bytes, w, h, kb: +(bytes.length / 1024).toFixed(1), modo: TEX[papel].modo, oetf: papel === 'cor' ? 'srgb' : 'linear', niveis: volta.info.niveis,
      psnr: +psnr(rgba, volta.rgba, papel === 'cor' ? [0, 1, 2] : papel === 'mr' ? [1, 2] : [0, 1]).toFixed(2), origem: `${img.largura}x${img.altura} ${img.info.png ? 'PNG (refaz_lod)' : img.info.uastc ? 'UASTC' : 'ETC1S'}` };
    log(`   ${papel.padEnd(6)} ${img.largura}x${img.altura} -> ${w}x${h} ${TEX[papel].modo} ${texturas[papel].kb} KB  psnr ${texturas[papel].psnr} dB  (${volta.info.niveis} mips, oetf ${texturas[papel].oetf})`);
  }
  const pal = paleta([corpo, ...pivos.map((q) => q.parte)], corDecod.rgba, corDecod.w, corDecod.h);

  // 8) documento de saida
  const doc = new Document(); const buf = doc.createBuffer('dados');
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  const tex = {}; for (const papel of ['cor', 'mr', 'normal']) if (texturas[papel]?.bytes) tex[papel] = doc.createTexture(`${car.id}_${papel}`).setImage(texturas[papel].bytes).setMimeType('image/ktx2');
  const mat = doc.createMaterial(car.id).setDoubleSided(true)          // como na origem: as cascas do Meshy nao sao fechadas
    .setBaseColorTexture(tex.cor).setMetallicRoughnessTexture(tex.mr || null).setMetallicFactor(1).setRoughnessFactor(1);
  if (tex.normal) mat.setNormalTexture(tex.normal);
  for (const ti of [mat.getBaseColorTextureInfo(), mat.getMetallicRoughnessTextureInfo(), mat.getNormalTextureInfo()]) if (ti) infoTextura(ti);

  const medidasFinais = caixa([corpo, ...pivos.map((q) => desloca(q.parte, q.centro.map((v) => -v)))]);
  const ehVoador = car.rodas === 'pods';
  const extrasRaiz = { id: car.id, nome: car.nome, origem: `cidadeaberta/assets/${car.origem}`, rodas: !ehVoador, escala: r3(s), limitadaPor: limita,
    medidas: { comprimento: r3(medidasFinais.tam[2]), largura: r3(medidasFinais.tam[0]), altura: r3(medidasFinais.tam[1]) } };
  // flutua: quanto o voador pairava acima do chao no Cidade Aberta (o ponto mais baixo dele na origem), ja na escala nova.
  // O GLB sai com y = 0 no ponto mais baixo; a altura de voo e decisao do jogo, este numero e so a referencia.
  if (ehVoador) { extrasRaiz.flutua = r3(Math.max(0, cx.min[1]) * s); extrasRaiz.pods = car.pods || 'abertos'; }
  const cena = doc.createScene('cena'); doc.getRoot().setDefaultScene(cena);
  const raiz = doc.createNode('carro').setExtras(extrasRaiz); cena.addChild(raiz);
  const body = doc.createNode('body'); raiz.addChild(body);
  body.addChild(doc.createNode('body_malha').setMesh(malhaGLTF(doc, buf, 'body', corpo, mat)));
  for (const q of pivos) {
    const ex = ehVoador ? { side: q.extras.side, slide: r3((q.extras.slide || 0) * s), aberto: car.pods !== 'recolhidos' }
      : { radius: r3(q.raio), front: !!q.extras.front, side: q.extras.side };
    const pivo = doc.createNode(q.nome).setTranslation(q.centro.map(r3)).setExtras(ex);
    (ehVoador ? body : raiz).addChild(pivo);          // pod e da carroceria (inclina junto); roda e do carro (fica no chao)
    pivo.addChild(doc.createNode(q.nome + '_malha').setMesh(malhaGLTF(doc, buf, q.nome, q.parte, mat)));
  }

  // 9) geometria: reorder + quantizacao (posicao 14 bits, UV 14) + EXT_meshopt_compression com filtro (normal em 8 bits
  // octaedrica). UV em 14 e nao 12: o lodatlas deixa so 2 texels de margem entre cartas (1 texel na textura de 2048);
  // com 12 bits o arredondamento chegava a 1/4 de texel nessa margem.
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 14, quantizeTexcoord: 14 }));
  const glb = await io.writeBinary(doc);
  fs.mkdirSync(SAIDA, { recursive: true });
  const arq = path.join(SAIDA, `${car.id}.glb`); fs.writeFileSync(arq, glb);
  const kb = +(glb.length / 1024).toFixed(1);
  const trisFinal = tris(corpo) + pivos.reduce((a, q) => a + tris(q.parte), 0);
  const vertsFinal = corpo.pos.length / 3 + pivos.reduce((a, q) => a + q.parte.pos.length / 3, 0);
  const kbTex = Object.values(texturas).reduce((a, t) => a + (t.kb || 0), 0);
  log(`   ${car.id}.glb ${kb} KB (texturas ${kbTex.toFixed(0)} KB, geometria ~${(kb - kbTex).toFixed(0)} KB) tris ${trisOrigem} -> ${trisFinal}, verts ${vertsFinal}  escala ${s.toFixed(3)} (${limita})  ${JSON.stringify(extrasRaiz.medidas)}`);
  for (const q of pivos) log(`   ${q.nome} centro ${JSON.stringify(q.centro.map(r3))} raio ${r3(q.raio)}${q.ajuste ? ` (circulo ${r3(q.ajuste.raioAjuste)}; caixa diria centro a ${(q.difCaixa * 100).toFixed(1)} cm e raio ${r3(q.ajuste.caixa.raio)})` : ''} | eixo de origem a ${(q.difPivo * 100).toFixed(1)} cm | tam ${JSON.stringify(q.tam.map(r3))}`);
  if (kb >= LIMITE_KB) throw new Error(`${car.id}: ${kb} KB passa do limite de ${LIMITE_KB} KB`);

  return {
    id: car.id, arquivo: `assets/cars/${car.id}.glb`, kb, tris: trisFinal, verts: vertsFinal, trisOrigem, escala: r3(s), limitadaPor: limita,
    medidas: extrasRaiz.medidas, janelaUV: janela, simplificacao, chapas: chapasFeitas,
    rodas: ehVoador ? { tem: false } : (() => { const fr = pivos.filter((q) => q.extras.front), tr = pivos.filter((q) => !q.extras.front); const m = (l) => r3(l.reduce((a, q) => a + q.raio, 0) / l.length); return { tem: true, raioFrente: m(fr), raioTras: m(tr) }; })(),
    pecas: pivos.map((q) => ({ nome: q.nome, centro: q.centro.map(r3), raio: r3(q.raio), difEixoOrigemCm: +(q.difPivo * 100).toFixed(1), difCaixaCm: +(q.difCaixa * 100).toFixed(1) })),
    flutua: extrasRaiz.flutua, pods: extrasRaiz.pods,
    // p_jogo = (p_origem - origem) * escala: com isto o gera_config.mjs leva um ponto medido no GLB de origem (o escapamento do
    // Cidade Aberta, tabela.mjs) para o carro daqui sem reprocessar nada
    transforma: { origem: origem.map((v) => +v.toFixed(5)), escala: +s.toFixed(6) },
    texturas: Object.fromEntries(Object.entries(texturas).map(([k, t]) => [k, t.bytes ? { w: t.w, h: t.h, kb: t.kb, modo: t.modo, oetf: t.oetf, niveis: t.niveis, psnr: t.psnr, origem: t.origem } : t])),
    paleta: pal,
  };
}

// ---------------------------------------------------------------------------------------------------------- principal
const pedidos = process.argv.slice(2);
const lista = pedidos.length ? TABELA.filter((c) => pedidos.includes(c.id)) : TABELA;
if (pedidos.length && lista.length !== pedidos.length) throw new Error('id desconhecido: ' + pedidos.filter((p) => !TABELA.some((c) => c.id === p)).join(', '));
const medidas = fs.existsSync(MEDIDAS) ? JSON.parse(fs.readFileSync(MEDIDAS, 'utf8')) : {};
for (const car of lista) { medidas[car.id] = await processa(car); fs.writeFileSync(MEDIDAS, JSON.stringify(medidas, null, 1) + '\n'); }

console.log('\n id          tris    verts     KB  texturas');
for (const c of TABELA) { const m = medidas[c.id]; if (!m) continue;
  const tx = Object.entries(m.texturas).map(([k, t]) => t.w ? `${k} ${t.w}x${t.h} ${t.modo} ${t.kb}KB` : `${k} -`).join(' | ');
  console.log(` ${c.id.padEnd(10)} ${String(m.tris).padStart(6)} ${String(m.verts).padStart(8)} ${String(m.kb).padStart(7)}  ${tx}`); }
const total = TABELA.reduce((a, c) => a + (medidas[c.id]?.kb || 0), 0);
console.log(` total ${total.toFixed(0)} KB (base64: ~${(total * 4 / 3 / 1024).toFixed(1)} MB no HTML)`);
