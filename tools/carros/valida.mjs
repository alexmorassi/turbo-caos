// VALIDA OS GLB DOS CARROS com o validador oficial do Khronos (gltf-validator, npm). Nao e dependencia do projeto: instale com
//   npm install --no-save gltf-validator
// e rode node tools/carros/valida.mjs. Reprova com qualquer ERRO, ou com aviso que nao seja um destes (medidos, esperados):
//   - VALUE_NOT_IN_LIST no mimeType 'image/ktx2', IMAGE_UNRECOGNIZED_FORMAT e imagem "sem uso": o validador nao conhece o
//     KHR_texture_basisu (ele mesmo diz UNSUPPORTED_EXTENSION) e nao enxerga a textura que mora na extensao;
//   - MESH_PRIMITIVE_GENERATED_TANGENT_SPACE (so no Tubarao, o unico com mapa de normais): sem TANGENT o three.js monta o
//     espaco tangente por derivada de tela, como no GLB de origem do Cidade Aberta.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './comum.mjs';
import { TABELA } from './tabela.mjs';
const require = createRequire(import.meta.url);
let validator; try { validator = require('gltf-validator'); } catch { console.log('falta o gltf-validator: npm install --no-save gltf-validator'); process.exit(2); }
let ruim = 0;
for (const c of TABELA) {
  const arq = path.join(RAIZ, 'assets', 'cars', c.id + '.glb');
  const rel = await validator.validateBytes(new Uint8Array(fs.readFileSync(arq)), { maxIssues: 50 });
  const i = rel.issues;
  const esperado = (m) => (m.code === 'VALUE_NOT_IN_LIST' && /^\/images\/\d+\/mimeType$/.test(m.pointer) && /image\/ktx2/.test(m.message)) ||
    m.code === 'IMAGE_UNRECOGNIZED_FORMAT' || m.code === 'MESH_PRIMITIVE_GENERATED_TANGENT_SPACE';
  const problemas = i.messages.filter((m) => m.severity === 0 || (m.severity === 1 && !esperado(m)));
  const esperados = i.messages.filter((m) => m.severity === 1 && esperado(m));
  console.log(`${c.id.padEnd(10)} erros ${i.numErrors}  avisos ${i.numWarnings} (${esperados.length} esperados: ${[...new Set(esperados.map((m) => m.code))].join(', ')})`);
  for (const m of problemas) console.log(`   ${m.severity === 0 ? 'ERRO' : 'AVISO'} ${m.code} ${m.pointer || ''} ${m.message}`);
  if (problemas.length) ruim++;
}
console.log(`validador ${validator.version()}`);
console.log(ruim ? `\n${ruim} GLB com erro/aviso` : `\nVALIDOS: zero erro (e so os avisos esperados) nos ${TABELA.length}`);
process.exit(ruim ? 1 : 0);
