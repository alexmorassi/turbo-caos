// CONFERE OS GLB DOS CARROS (fase 1) no Chromium (SwiftShader), com o MESMO caminho de carga do jogo (GLTFLoader r170 +
// KTX2Loader com o transcoder de lib/, detectSupport antes do primeiro GLB, + MeshoptDecoder). Reprova (sai com 1) se:
//   - o console tiver qualquer erro, ou um pedido falhar (ERR_ABORTED depois de entregue inteiro e so aviso: comum.mjs);
//   - faltar no (carro, body, wheel1..4 / pod0..3), algum pivo carregar malha, ou extras faltarem/estiverem trocados;
//   - a caixa nao tiver y minimo 0, centro x/z 0, ou fugir da regra min(4,2/C, 2,3/L, 2,6/A);
//   - roda dianteira (front) nao estiver em +Z (frente = +Z);
//   - o circulo ajustado na banda de rodagem estiver a mais de 0,6 cm do pivo (a roda giraria torta), faltar pedaco do pneu
//     (setor de 15 graus com menos de 92 % do raio mediano), ou, girando wheelN.rotation.x em 12 angulos, o pe do pneu subir/
//     descer mais do que o proprio perfil explica + 1 cm (pneu do Meshy nao e redondo: cravo do monster truck varia 4 cm);
//   - o eixo de alguma roda ficar a mais de 1,5 cm de "raio" do chao (roda enterrada ou voando);
//   - a textura de cor nao vier comprimida, com mipmaps e em sRGB, ou os mapas de dado vierem marcados como sRGB;
//   - o GLB passar de 1,5 MB.
//   node tools/carros/confere.mjs [id ...]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, navegador, abrePagina, RAIZ, AQUI } from './comum.mjs';
import { TABELA } from './tabela.mjs';

const pedidos = process.argv.slice(2);
const lista = TABELA.filter((c) => !pedidos.length || pedidos.includes(c.id));
const srv = await servidor(); const nav = await navegador();
let reprovou = false; const relatorio = {};
try {
  const { pagina, erros, avisos } = await abrePagina(nav, `http://127.0.0.1:${srv.porta}/tools/carros/folha.html`, { servidor: srv });
  await pagina.waitForFunction('window.PRONTO === true', null, { timeout: 60000 });
  const suporte = await pagina.evaluate(() => window.suporteKTX2());
  console.log('KTX2 nesta placa (SwiftShader):', JSON.stringify(suporte));
  for (const c of lista) {
    const arq = path.join(RAIZ, 'assets', 'cars', c.id + '.glb');
    const kb = fs.existsSync(arq) ? fs.statSync(arq).size / 1024 : 0;
    const r = await pagina.evaluate((u) => window.confere(u), `/assets/cars/${c.id}.glb`);
    if (kb >= 1500) r.falhas.push(`${kb.toFixed(0)} KB passa de 1,5 MB`);
    r.kb = +kb.toFixed(1); relatorio[c.id] = r;
    const rodas = r.rodas?.map((w) => w.giroDesvioCm !== undefined ? `${w.nome} exc ${w.excentricidadeCm}cm oval ${w.ovalCm}cm pe ${w.chaoVariaCm}cm folga ${w.folgaChaoCm}cm` : `${w.nome} x=${w.pos[0]}`).join(' | ');
    console.log(`\n${c.id.padEnd(10)} ${r.falhas.length ? 'REPROVADO' : 'ok'}  ${r.kb} KB  ${r.tris} tris  ${r.malhas} malhas  caixa C ${r.caixa?.comprimento} L ${r.caixa?.largura} A ${r.caixa?.altura} (y min ${r.caixa?.min[1]})`);
    console.log(`   nos: ${r.nos?.join(' ')}`);
    console.log(`   texturas: ${Object.entries(r.texturas || {}).map(([k, t]) => `${k} ${t.w}x${t.h} ${t.comprimida ? 'comprimida' : 'CRUA'} ${t.colorSpace || 'sem-colorSpace'} ${t.mips} mips`).join(' | ')}`);
    console.log(`   ${rodas}`);
    for (const f of r.falhas) console.log('   FALHA', f);
    if (r.falhas.length) reprovou = true;
  }
  if (erros.length) { reprovou = true; console.log('\nERROS DE CONSOLE/REDE:'); for (const e of erros) console.log('  ', e.slice(0, 300)); }
  else console.log(`\nconsole e rede sem erro${avisos.length ? ` (${avisos.length} aviso(s) de ERR_ABORTED depois de entregue)` : ''}`);
  // integracao: o mesmo GLB pelo js/glb.js + js/modelo_carro.js da fundacao, com o config/carros.js gerado
  let integracao = null;
  if (!pedidos.length) {
    const p2 = await abrePagina(nav, `http://127.0.0.1:${srv.porta}/_folha_na_raiz.html`, { servidor: srv });
    await p2.pagina.waitForFunction('window.PRONTO === true', null, { timeout: 60000 });
    integracao = await p2.pagina.evaluate(() => window.integracao());
    console.log('\nINTEGRACAO (js/glb.js + js/modelo_carro.js + config/carros.js):');
    for (const r of integracao) { console.log(`  ${r.id.padEnd(10)} ${r.falhas.length ? 'REPROVADO ' + r.falhas.join('; ') : 'ok'}  carroceria ${r.carroceria}  rodas ${r.rodas?.map((w) => `${w.n}:${w.raio}${w.frente ? 'F' : 'T'}${w.lado > 0 ? '+' : '-'}`).join(' ') || '-'}`); if (r.falhas.length) reprovou = true; }
    if (p2.erros.length) { reprovou = true; console.log('  ERROS:', p2.erros.join(' | ').slice(0, 500)); }
  }
  fs.writeFileSync(path.join(AQUI, 'conferencia.json'), JSON.stringify({ suporte, erros, avisos, carros: relatorio, integracao }, null, 1) + '\n');
} finally { await nav.close(); srv.fecha(); }
console.log(reprovou ? '\nREPROVADO' : `\nAPROVADO: ${lista.length} carros`);
process.exit(reprovou ? 1 : 0);
