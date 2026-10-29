// FOLHA DE CONTATO DOS CARROS (fase 1): desenha varios GLB lado a lado no Chromium (SwiftShader) e grava um PNG.
//   node tools/carros/folha.mjs                      -> docs/fotos/carros.png (3/4 da frente) e carros_lado.png (lateral)
//                                                       dos 10 carros de config/carros.js, na MESMA distancia de camera
//                                                       (os tamanhos ficam comparaveis: o kart parece kart, o monstro, monstro)
//   node tools/carros/folha.mjs --origem a b c ...   -> /tmp/fase1/origens_<vista>.png com os GLB de ORIGEM do Cidade Aberta
//                                                       (cada um enquadrado sozinho; esconde *_lo e volante para nao desenhar
//                                                       o carro duas vezes). Serve para escolher os carros.
//   opcoes: --vista 34|lado|tras  --colunas N  --saida arquivo.png
// Por que a foto e obrigatoria: textura preta/branca/rosa, frente invertida e carro afundado no chao nao dao erro em
// lugar nenhum - so aparecem olhando (regra herdada do DinoTrails: "OLHE antes de declarar vitoria").
import fs from 'node:fs';
import path from 'node:path';
import { servidor, navegador, abrePagina, RAIZ } from './comum.mjs';

const args = process.argv.slice(2);
const opc = (nome, padrao) => { const i = args.indexOf('--' + nome); return i >= 0 ? args.splice(i, 2)[1] : padrao; };
const origem = args.includes('--origem'); if (origem) args.splice(args.indexOf('--origem'), 1);
const vistaPedida = opc('vista', null), colunas = +opc('colunas', 5), saidaPedida = opc('saida', null), celula = opc('celula', '420x300').split('x').map(Number);

// os carros do jogo saem da tabela + medidas (as mesmas fontes do config/carros.js), na ordem da tabela
async function itensDoJogo() {
  const { TABELA } = await import('./tabela.mjs');
  const medidas = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'medidas.json'), 'utf8'));
  return TABELA.filter((c) => medidas[c.id]).map((c) => ({ url: `/assets/cars/${c.id}.glb`, rotulo: `${c.nome}  (${c.id}, ${Math.round(medidas[c.id].kb)} KB, ${medidas[c.id].tris} tris)` }));
}

const srv = await servidor(), { porta, fecha } = srv;
const nav = await navegador();
let falhou = false;
try {
  const { pagina, erros, avisos } = await abrePagina(nav, `http://127.0.0.1:${porta}/tools/carros/folha.html`, { servidor: srv });
  await pagina.waitForFunction('window.PRONTO === true', null, { timeout: 60000 });
  // --lo: mostra so as malhas leves (*_lo) da origem, para comparar com as altas
const soLo = args.includes('--lo'); if (soLo) args.splice(args.indexOf('--lo'), 1);
const esconder = soLo ? ['^(body|wheel[1-4]|pod[0-3]|volante)$', '^volante'] : ['_lo$', '^volante'];
const itens = origem ? args.map((n) => ({ url: `/_origem/${n}.glb`, rotulo: n + (soLo ? ' (_lo)' : ''), esconder })) : await itensDoJogo();
  const vistas = vistaPedida ? [vistaPedida] : (origem ? ['34'] : ['34', 'lado']);
  for (const vista of vistas) {
    const t0 = Date.now();
    // distancia fixa so para os carros do jogo (todos normalizados para ~4,2 m): 8 m enquadra o maior (Tubarao, 2,6 m de altura)
    const r = await pagina.evaluate((o) => window.desenhaFolha(o), { itens, colunas, vista, celula, distanciaFixa: origem ? 0 : 8 });
    const saida = saidaPedida || (origem ? `/tmp/fase1/origens_${vista}.png` : path.join(RAIZ, 'docs', 'fotos', vista === 'lado' ? 'carros_lado.png' : vista === 'tras' ? 'carros_tras.png' : 'carros.png'));
    fs.mkdirSync(path.dirname(saida), { recursive: true });
    fs.writeFileSync(saida, Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(`${saida}  (${itens.length} carros, vista ${vista}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const x of r.relatorio) {
      if (x.erro) { console.log('  ERRO', x.url, x.erro); falhou = true; continue; }
      const a = x.amostra, alerta = a.fracPreto > 0.35 || a.fracBranco > 0.35 || a.fracRosa > 0.02 ? '  <-- OLHAR (preto/branco/rosa)' : '';
      console.log(`  ${(x.rotulo || x.url).padEnd(48)} tris ${String(x.tris).padStart(7)}  caixa ${JSON.stringify(x.caixa.min)}..${JSON.stringify(x.caixa.max)}  media ${JSON.stringify(a.media)} preto ${a.fracPreto} branco ${a.fracBranco} rosa ${a.fracRosa}${alerta}`);
    }
  }
  if (erros.length) { console.log('ERROS DO CONSOLE:', erros.length); erros.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 300))); falhou = true; }
  else console.log('console sem erros' + (avisos.length ? ` (${avisos.length} aviso(s): ${avisos.join('; ')})` : ''));
} finally { await nav.close(); fecha(); }
process.exit(falhou ? 1 : 0);
