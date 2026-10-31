// GERA config/carros.js (fase 1) juntando tools/carros/tabela.mjs (decisoes: nome, poder, atributos, cor, frase) com
// tools/carros/medidas.json (o que o otimiza.mjs MEDIU nos GLB: tris, KB, medidas, raio das rodas). Gerado para os numeros
// nunca desencontrarem do GLB: mudou um carro, roda `node tools/carros/otimiza.mjs <id>` e depois este.
//   node tools/carros/gera_config.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, AQUI } from './comum.mjs';
import { TABELA, CARRO_PADRAO, MESMO_NIVEL } from './tabela.mjs';

const medidas = JSON.parse(fs.readFileSync(path.join(AQUI, 'medidas.json'), 'utf8'));
const PODERES = ['oleo', 'emp', 'congelante', 'ima', 'trocatroca', 'encolhedor', 'fumaca', 'tornado', 'escudo', 'terremoto'];

// conferencias que reprovam a geracao (melhor falhar aqui do que o jogo abrir com carro torto)
const erros = [];
const poderes = TABELA.map((c) => c.poder);
// cada poder tem pelo menos um dono (eram 10 carros e 10 poderes, um de cada; com os carros do Cidade Aberta de 30/10/2026 o poder repete)
for (const p of PODERES) if (!poderes.includes(p)) erros.push(`poder ${p} sem nenhum carro`);
for (const c of TABELA) if (!PODERES.includes(c.poder)) erros.push(`${c.id}: poder ${c.poder} nao existe`);
// pops and bangs (js/pipoco.js): o tipo do Cidade Aberta e o escapamento dele
const POPS = ['turbo', 'esportivo'];   // (os Pro Stock, com o tipo 'prostock', sairam em 31/10/2026)
for (const c of TABELA) {
  if (c.pops && !POPS.includes(c.pops)) erros.push(`${c.id}: pops ${c.pops} desconhecido (${POPS.join(', ')})`);
  if (c.pops && !(c.escapamento && c.escapamento.canos && c.escapamento.canos.length)) erros.push(`${c.id}: pops sem escapamento`);
  if (c.pops && medidas[c.id] && !medidas[c.id].transforma) erros.push(`${c.id}: medidas sem 'transforma' (rode node tools/carros/otimiza.mjs ${c.id})`);
}
for (const c of TABELA) {
  const a = c.atributos, soma = a.velocidade + a.aceleracao + a.controle + a.peso + a.turbo;
  if (soma !== 16) erros.push(`${c.id}: soma dos atributos ${soma}, tem de ser 16`);
  // MESMO NIVEL (31/10/2026, tools/carros/tabela.mjs): carro com atributo diferente dos outros reprova — quem ganha e o turbo e o poder
  for (const k of Object.keys(MESMO_NIVEL)) if (a[k] !== MESMO_NIVEL[k]) erros.push(`${c.id}: ${k} = ${a[k]}, todos os carros tem o mesmo nivel (${MESMO_NIVEL[k]})`);
  for (const [k, v] of Object.entries(a)) if (!(v >= 1 && v <= 5 && Number.isInteger(v))) erros.push(`${c.id}: ${k} = ${v} fora de 1..5`);
  if (!medidas[c.id]) erros.push(`${c.id}: sem medidas (rode node tools/carros/otimiza.mjs ${c.id})`);
  if (!/^#[0-9a-f]{6}$/.test(c.cor)) erros.push(`${c.id}: cor ${c.cor} invalida`);
  if (!fs.existsSync(path.join(RAIZ, 'assets', 'cars', c.id + '.glb'))) erros.push(`${c.id}: falta assets/cars/${c.id}.glb`);
}
if (!TABELA.some((c) => c.id === CARRO_PADRAO)) erros.push(`CARRO_PADRAO ${CARRO_PADRAO} nao esta na tabela`);
if (erros.length) { console.error('NAO GEROU:\n  ' + erros.join('\n  ')); process.exit(1); }

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const n2 = (v) => +v.toFixed(2), n3 = (v) => +v.toFixed(3);
const quebra = (txt, largura = 120, prefixo = '  // ') => {   // comentario longo em varias linhas
  const linhas = []; let l = '';
  for (const p of txt.split(/\s+/)) { if ((prefixo + l + ' ' + p).length > largura && l) { linhas.push(prefixo + l); l = p; } else l = l ? l + ' ' + p : p; }
  if (l) linhas.push(prefixo + l); return linhas.join('\n');
};

// ESCAPAMENTO: os canos do Cidade Aberta (SPECS.<tipo>.exhaust, metros do GLB de origem: x = esquerda, y = cima, z = frente) vao para o
// carro daqui pela mesma conta da normalizacao (medidas.json 'transforma': p = (p_origem - origem) * escala). dir = exhaustDir (o x
// espelha pelo lado do cano: cano que sopra de lado sai para fora dos dois lados); sem dir, para tras.
function escapamento(c, m) {
  const t = m.transforma, canos = c.escapamento.canos.map((p) => p.map((v, k) => n3((v - t.origem[k]) * t.escala)));
  const dir = c.escapamento.dir ? (() => { const d = c.escapamento.dir, n = Math.hypot(...d); return d.map((v) => n3(v / n)); })() : [0, 0, -1];
  return `{ canos: ${JSON.stringify(canos).replace(/,/g, ', ')}, dir: ${JSON.stringify(dir).replace(/,/g, ', ')} }`;
}

const entradas = TABELA.map((c) => {
  const m = medidas[c.id], a = c.atributos;
  const rodas = m.rodas.tem ? `{ tem: true, raioFrente: ${n3(m.rodas.raioFrente)}, raioTras: ${n3(m.rodas.raioTras)} }`
    : `{ tem: false, flutua: ${n3(m.flutua || 0)}, pods: ${q(m.pods || 'recolhidos')} }`;
  return [
    quebra(`${c.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()}: ${c.porque}`),
    `  { id: ${q(c.id)}, nome: ${q(c.nome)}, modelo: ${q(`assets/cars/${c.id}.glb`)}, origem: ${q(`cidadeaberta/assets/${c.origem}`)},`,
    `    cor: ${q(c.cor)},            // ${c.porqueCor}`,
    `    atributos: { velocidade: ${a.velocidade}, aceleracao: ${a.aceleracao}, controle: ${a.controle}, peso: ${a.peso}, turbo: ${a.turbo} },`,
    `    poder: ${q(c.poder)},`,
    `    medidas: { comprimento: ${n2(m.medidas.comprimento)}, largura: ${n2(m.medidas.largura)}, altura: ${n2(m.medidas.altura)} },  // escala ${m.escala} (limitada ${m.limitadaPor === 'comprimento' ? 'pelo' : 'pela'} ${m.limitadaPor})`,
    `    rodas: ${rodas},`,
    ...(c.timbre ? [`    timbre: ${q(c.timbre)},   // som do motor (js/audio.js CAMADAS)`] : []),
    ...(c.pops ? [`    pops: ${q(c.pops)}, escapamento: ${escapamento(c, m)},`] : []),
    `    descricao: ${q(c.descricao)},`,
    `    kb: ${Math.round(m.kb)}, tris: ${m.tris} },`,
  ].join('\n');
});

const texto = `// CARROS DO TURBO CAOS (fase 1). ARQUIVO GERADO por tools/carros/gera_config.mjs a partir de tools/carros/tabela.mjs
// (decisoes) e tools/carros/medidas.json (medido nos GLB pelo tools/carros/otimiza.mjs): nao edite a mao, edite a tabela.
//
// DE ONDE VEM CADA MODELO: os GLB do Cidade Aberta (Meshy, 12-22 MB, feitos para PC) viraram assets/cars/<id>.glb de 0,4 a
// 0,85 MB: malha leve *_lo do proprio Cidade Aberta (o Tubarao, que nao tem, e a malha cheia simplificada com meshopt), textura
// recortada da faixa do LOD em KTX2 (cor ETC1S sRGB, metal/rugosidade UASTC linear), geometria EXT_meshopt_compression.
// Todos normalizados: frente +Z, cima +Y, metros, x e z no centro da caixa, y = 0 no ponto mais baixo das rodas, escala
// uniforme s = min(4,2/comprimento, 2,3/largura, 2,6/altura) - cabem todos na mesma caixa de 4,2 x 2,3 x 2,6 m, entao a
// largura da pista e a colisao valem para qualquer um. Detalhe e fotos: docs/fases/fase1_carros.md, docs/fotos/carros*.png.
//
// HIERARQUIA DO GLB (o js/modelo_carro.js le assim): carro -> body (sem malha) -> body_malha; carro -> wheel1..4 (pivo sem
// malha no EIXO da roda, extras { radius, front, side }; 1/2 frente, 3/4 tras, side 1 = +X) -> wheelN_malha. Girar
// wheelN.rotation.x gira a roda no proprio eixo. Voador: sem wheel; pod0..3 filhos do body (extras { side, slide, aberto }).
//
// ATRIBUTOS: 1 a 5 em velocidade, aceleracao, controle, peso e turbo — o MESMO NIVEL em todos desde 31/10/2026 (pedido: "deixe todos
// os carros com o mesmo nivel, a ideia e que ganhe quem utilizar melhor os turbos e os poderes"; antes cada um tinha os seus, com soma
// 16, e o Carro Dourado B7 de velocidade 5 era impossivel de alcancar). O carro escolhe a cara e o poder (tools/carros/tabela.mjs).
// Os 10 primeiros tem um poder cada (os 10 de config/poderes.js); os 9 do Cidade Aberta de 30/10/2026 (o Prius e os carros de rua com
// pops and bangs) repetem poder. nome = o do Cidade Aberta em todos (31/10/2026; o id continua o de antes: o save guarda o id).
// cor = destaque do carro na interface, minimapa e rastro, tirada da pintura.
// pops = pops and bangs do Cidade Aberta (js/pipoco.js): 'turbo' estoura em cada reducao, 'esportivo' (o Porsche) tambem quando tira
// o pe embalado. escapamento.canos = boca de cada cano NO CARRO DAQUI (m, x = esquerda, y = cima, z = frente), dir = para onde a
// labareda sai (o x espelha pelo lado do cano).
// rodas.raio* = raio de CONTATO (do eixo ao ponto mais baixo do pneu, media das duas rodas do eixo), em metros.
// rodas.tem false = o jogo so inclina a carroceria; flutua = quanto ele pairava no Cidade Aberta (ja na escala nova).

export const CARROS = [
${entradas.join('\n')}
];

export const CARRO_PADRAO = ${q(CARRO_PADRAO)};
`;
const destino = path.join(RAIZ, 'config', 'carros.js');
fs.writeFileSync(destino, texto);
console.log(`${destino}: ${TABELA.length} carros, padrao ${CARRO_PADRAO}`);
