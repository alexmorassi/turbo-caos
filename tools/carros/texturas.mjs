// TEXTURAS DOS CARROS (fase 1): decodifica o KTX2 de origem e codifica o KTX2 do celular, tudo em Node.
// Por que assim: o toktx (o que o Cidade Aberta usa em tools/ktx2/ktx2.py) nao existe nesta maquina e baixar binario
// externo foi bloqueado. Sobram dois WASM do proprio Basis Universal:
//   * DECODIFICAR: o basis_transcoder de lib/addons/libs/basis (o MESMO que o jogo usa no navegador) roda em Node se for
//     avaliado num contexto `vm` (e um modulo Emscripten UMD). UASTC -> RGBA32 em ~0,1 s por 2048.
//   * CODIFICAR: o basis_encoder.wasm do pacote npm ktx2-encoder (Basis Universal v2.5). O wrapper do pacote nao expoe
//     setMipSRGB/setMipRenormalize, entao o BasisEncoder e chamado direto: mapa de DADO (metal/rugosidade, normal) nao
//     pode ter o mipmap filtrado como sRGB, senao a rugosidade dos mips distantes fica errada.
// Toda textura codificada e DECODIFICADA DE VOLTA pelo transcoder do jogo antes de ir para o GLB: isso prova que o
// arquivo do encoder v2.5 abre no transcoder do three r170 e mede a perda (PSNR) contra a imagem reduzida.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { RAIZ } from './comum.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const PASTA_TRANSCODER = path.join(RAIZ, 'lib', 'addons', 'libs', 'basis');
const ENCODER_JS = path.join(RAIZ, 'node_modules', 'ktx2-encoder', 'dist', 'basis', 'basis_encoder.js');

// formato de saida do transcoder (enum transcoder_texture_format do basisu): 13 = cTFRGBA32
const RGBA32 = 13;
// transfer function do DFD do KTX2 (KHR_DF_TRANSFER): 1 = linear, 2 = sRGB
export const TF = { LINEAR: 1, SRGB: 2 };

let _transcoder = null;
async function transcoder() {
  if (_transcoder) return _transcoder;
  const arq = path.join(PASTA_TRANSCODER, 'basis_transcoder.js');
  const ctx = { module: { exports: {} }, require, process, console, __filename: arq, __dirname: PASTA_TRANSCODER, WebAssembly, TextDecoder, setTimeout, clearTimeout, URL, performance, Buffer };
  ctx.exports = ctx.module.exports; vm.createContext(ctx); vm.runInContext(fs.readFileSync(arq, 'utf8'), ctx);
  const M = await ctx.module.exports({ wasmBinary: fs.readFileSync(path.join(PASTA_TRANSCODER, 'basis_transcoder.wasm')) });
  M.initializeBasis();
  return (_transcoder = M);
}

let _encoder = null;
async function encoder() {
  if (_encoder) return _encoder;
  const { default: BASIS } = await import(ENCODER_JS);
  const M = await BASIS(); M.initializeBasis();
  return (_encoder = M);
}

// KTX2 (bytes) -> { largura, altura, rgba (nivel 0), info }. info diz o que o jogo vai receber: UASTC ou ETC1S, OETF, mips.
export async function decodificaKTX2(bytes) {
  const M = await transcoder();
  const k = new M.KTX2File(new Uint8Array(bytes));
  try {
    if (!k.isValid()) throw new Error('KTX2 invalido para o transcoder do jogo');
    const info = { largura: k.getWidth(), altura: k.getHeight(), niveis: k.getLevels(), uastc: !!k.isUASTC(), etc1s: !!k.isETC1S(), alfa: !!k.getHasAlpha(), tf: k.getDFDTransferFunc() };
    if (!k.startTranscoding()) throw new Error('startTranscoding falhou');
    const rgba = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
    if (!k.transcodeImage(rgba, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error('transcodeImage falhou');
    return { largura: info.largura, altura: info.altura, rgba, info };
  } finally { k.close(); k.delete(); }
}

// reduz com Lanczos (sharp). Mapa de normais: o filtro encurta os vetores (media de direcoes diferentes); renormaliza.
export async function reduz(rgba, w, h, lado, { normal = false } = {}) {
  let out = rgba;
  if (w !== lado || h !== lado) out = new Uint8Array(await sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).resize(lado, lado, { kernel: 'lanczos3' }).raw().toBuffer());
  return normal ? renormaliza(out) : out;
}

// vetor do mapa de normais de volta ao comprimento 1 (reduzir faz media de direcoes e encurta o vetor)
export function renormaliza(rgba) {
  const out = new Uint8Array(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const x = out[i] / 127.5 - 1, y = out[i + 1] / 127.5 - 1, z = out[i + 2] / 127.5 - 1, n = Math.hypot(x, y, z) || 1;
    out[i] = Math.round((x / n + 1) * 127.5); out[i + 1] = Math.round((y / n + 1) * 127.5); out[i + 2] = Math.round((z / n + 1) * 127.5); out[i + 3] = 255;
  }
  return out;
}

// PSNR (dB) so dos canais que importam: cor = RGB; metal/rugosidade = G (rugosidade) e B (metal) do glTF; normal = RG(B).
export function psnr(a, b, canais = [0, 1, 2]) {
  let soma = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) for (const c of canais) { const d = a[i + c] - b[i + c]; soma += d * d; n++; }
  return soma === 0 ? 99 : 10 * Math.log10((255 * 255) / (soma / n));
}

// codifica RGBA -> KTX2. modo: 'etc1s' (BasisLZ; q = qualidade 1..255) ou 'uastc' (rdo = escala do RDO, 0 = sem RDO;
// zstd sempre: o KTX2Loader do three ja traz o zstddec). tipo: 'cor' (sRGB, OETF sRGB no DFD, mip filtrado em linear-
// de-luz), 'dado' (linear: metal/rugosidade) ou 'normal' (linear + mips renormalizados).
export async function codificaKTX2(rgba, largura, altura, { modo, tipo, q = 128, nivel = 2, rdo = 0 }) {
  const M = await encoder();
  const enc = new M.BasisEncoder();
  try {
    enc.setCreateKTX2File(true);
    enc.setTexType(0);                                   // cBASISTexType2D
    enc.setDebug(false); enc.setStatusOutput(false); enc.setPrintStats(false);   // o v2.5 imprime cada fatia sem isso
    if (!enc.setSliceSourceImage(0, new Uint8Array(rgba), largura, altura, 0)) throw new Error('setSliceSourceImage falhou');
    enc.setMipGen(true);                                 // mipmaps sempre: carro visto de longe cintila sem eles
    const srgb = tipo === 'cor';
    if (tipo === 'normal') enc.setNormalMapPreset();     // ajusta o codec para vetores (sem RDO de seletor etc.)
    enc.setPerceptual(srgb);                             // erro medido em espaco perceptual so na COR
    enc.setMipSRGB(srgb);                                // mip da cor filtrado em linear; dado/normal filtrados como estao
    enc.setKTX2AndBasisSRGBTransferFunc(srgb);           // o DFD diz sRGB so na cor: o KTX2Loader poe colorSpace por ele
    if (tipo === 'normal') enc.setMipRenormalize(true);
    enc.setCheckForAlpha(false); enc.setForceAlpha(false); // nenhuma textura dos carros tem alfa (getHasAlpha = 0 na origem)
    if (modo === 'uastc') {
      enc.setUASTC(true);
      enc.setPackUASTCFlags(2);                          // nivel 2 de 0..4: mais lento, menos erro de bloco
      if (rdo > 0) { enc.setRDOUASTC(true); enc.setRDOUASTCQualityScalar(rdo); }
      enc.setKTX2UASTCSupercompression(true);            // Zstandard
    } else {
      enc.setUASTC(false);
      enc.setQualityLevel(q);
      enc.setETC1SCompressionLevel(nivel);
    }
    const saida = new Uint8Array(largura * altura * 8 + 65536);
    const n = enc.encode(saida);
    if (!n) throw new Error('encode devolveu 0 bytes');
    return saida.slice(0, n);
  } finally { enc.delete(); }
}

// grava RGBA como PNG (para olhar a textura e para a folha de revisao)
export function gravaPNG(rgba, w, h, arq) {
  return sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).png().toFile(arq);
}
