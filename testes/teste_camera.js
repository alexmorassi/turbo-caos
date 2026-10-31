// SUITE DA CAMERA (fase 2): js/camera.js (CameraCorrida) medida na pista de teste sem desenhar — a camera anda no PASSO (deterministica),
// entao a suite le G.camera direto. Prova: apresentacao girando na contagem que termina atras do carro; perseguicao atras e acima o
// tempo todo, sem NaN numa volta inteira (salto, loop, atalho, queda); no topo do loop a camera fica de cabeca para baixo junto com o
// carro; no ar mantem o horizonte; na curva olha para dentro dela; FOV abre com a velocidade, com o turbo e com fov(extra); treme some
// sozinho; voltar da queda corta a camera para tras do carro; depois da chegada, festa girando.
import { suite, ok, perto, mede, quadros, segura, solta, apagaProgresso, corridaDeTeste, largada, entradaDeVolta } from './harness.js';
import { FISICA } from '../config/fisica.js';
import { MARCA } from '../js/pista.js';
import { on } from '../js/eventos.js';
import * as THREE from 'three';

const _v = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();

/** O mesmo piloto da suite de fisica (curvatura adiante + PD em d e rumo). */
function piloto(c, alvoD = 0) {
  const sup = c.corrida.pista.sup(c.sup), v = Math.max(2, Math.abs(c.vf));
  const kh = sup.khEm(c.s + v * 0.3);
  const q = v / FISICA.VEL_REFERENCIA, raio = FISICA.RAIO_MINIMO + (c.p.raioRef - FISICA.RAIO_MINIMO) * q * q;
  const psiDes = Math.max(-0.35, Math.min(0.35, -0.12 * (c.d - alvoD)));
  return Math.max(-1, Math.min(1, (kh * v + 3 * (psiDes - c.psi)) / (v / raio)));
}
function passoPilotado(j, n = 1) { for (let k = 0; k < n; k++) { segura('acel', 1); segura('direcao', piloto(j)); quadros(1); } }

/** Angulo da camera em volta do carro no plano do carro: 0 = bem atras, pi = bem na frente. */
function anguloEmVolta(cam, j) { _v.subVectors(cam.position, j.pos); return Math.atan2(_v.dot(j.direita), -_v.dot(j.frente)); }
const atras = (cam, j) => _v.subVectors(cam.position, j.pos).dot(j.frente);   // < 0: atras
const acima = (cam, j) => _v.subVectors(cam.position, j.pos).dot(j.cima);     // > 0: acima
const cimaDaCamera = (cam) => _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
const finita = (cam) => Number.isFinite(cam.position.x + cam.position.y + cam.position.z + cam.quaternion.x + cam.quaternion.y + cam.quaternion.z + cam.quaternion.w + cam.fov);

suite('camera', async (G) => {
  apagaProgresso();
  // o piloto desta suite JA e um controlador (le psi, d e a curva): sem a ajuda na direcao por cima (js/assistencia.js) e sem o freio
  // ao soltar o acelerador (js/entrada.js) — a fisica crua
  G.entrada.ajuda = false; G.entrada.freioAoSoltar = false;
  entradaDeVolta();
  G.sorteio.semente(5);
  const c = await corridaDeTeste({ pista: 'teste', carro: 'vulcao', corredores: 6, voltas: 3 });
  const cam = G.camera, j = c.jogador, cc = c.camera;
  ok(G.camera3p === cc && typeof cc.treme === 'function' && typeof cc.fov === 'function', 'CameraCorrida no contrato (G.camera3p, treme, fov)');
  for (const x of c.carros) if (x !== j) x.fantasma = 1e9;

  // ------------------------------------------------------------------ contagem: apresentacao girando, termina atras
  const angs = [];
  for (let k = 0; k < 400 && c.estado !== 'correndo'; k++) { quadros(1); angs.push(anguloEmVolta(cam, j)); }
  ok(Math.abs(angs[0]) > 2.0, `na contagem a camera comeca de frente-lado do carro (${(angs[0] * 57.3).toFixed(0)} graus em volta)`);
  // o angulo COM SINAL anda num sentido so (na curva da largada ele passa uns 5 graus do zero: atras do carro AO LONGO DA PISTA)
  const sentido = Math.sign(angs[angs.length - 1] - angs[0]);
  let volta = 0; for (let k = 1; k < angs.length; k++) if ((angs[k] - angs[k - 1]) * sentido < -0.005) volta++;
  ok(volta === 0, 'e gira sempre no mesmo sentido ate ficar atras, sem voltar');
  ok(c.estado === 'correndo' && Math.abs(angs[angs.length - 1]) < 0.15 && atras(cam, j) < -4 && acima(cam, j) > 1, 'no VAI esta atras e acima do carro');

  // ------------------------------------------------------------------ perseguicao numa volta inteira: atras, acima, sem NaN
  let ruins = 0, nan = 0, passos = 0, minAtras = 0, maxAtras = -1e9, loopCimaY = 1, noArCimaY = 1, noArVisto = false, dentroDaCurva = 0, curvaVista = 0;
  const P = c.pista.principal;
  const s0 = j.s;
  let voltas = j.volta;
  for (let k = 0; k < 60 * 40 && j.volta < voltas + 1 + 1; k++) {
    passoPilotado(j);
    passos++;
    if (!finita(cam)) nan++;
    const a = atras(cam, j), h = acima(cam, j);
    if (j.noChao && !(a < -2 && h > 0.5)) ruins++;
    minAtras = Math.min(minAtras, a); maxAtras = Math.max(maxAtras, a);
    if (j.noChao && j.sup === 0 && (P.marcasEm(j.s) & MARCA.MAGNETICO) && j.cima.y < -0.9) loopCimaY = Math.min(loopCimaY, cimaDaCamera(cam).y);
    if (j.estaVoando) { noArVisto = true; noArCimaY = Math.min(noArCimaY, cimaDaCamera(cam).y); }
    // curva para a direita depois do salto: o olhar puxa para dentro (direita do caminho camera -> carro)
    if (j.sup === 0 && j.s > 195 && j.s < 225 && j.noChao) {
      curvaVista++;
      _c.subVectors(j.pos, cam.position).setY(0);
      cam.getWorldDirection(_f).setY(0);
      if (_c.cross(_f).y < 0) dentroDaCurva++;
    }
    if (j.volta >= 2 && j.s > s0 - 30 && j.s < s0) break;
  }
  ok(nan === 0, `nenhum NaN na camera em ${passos} passos (salto, loop, atalho)`);
  ok(ruins === 0, 'no chao a camera fica sempre atras e acima do carro');
  mede('camera: distancia atras (m) min/max', `${(-maxAtras).toFixed(1)} / ${(-minAtras).toFixed(1)}`);
  ok(loopCimaY < 0, `no topo do loop a camera fica de cabeca para baixo (cima da camera y = ${loopCimaY.toFixed(2)})`);
  ok(noArVisto && noArCimaY > 0.9, `no ar a camera mantem o horizonte (cima y >= ${noArCimaY.toFixed(2)})`);
  ok(curvaVista > 10 && dentroDaCurva / curvaVista > 0.8, `na curva para a direita o olhar puxa para dentro dela (${dentroDaCurva}/${curvaVista})`);

  // ------------------------------------------------------------------ FOV: velocidade, turbo, fov(extra)
  j.colocaNaPista(0, 20, 0, 0, 0);
  for (let k = 0; k < 90; k++) cc.passo(1 / 60);
  const fovParado = cam.fov;
  j.colocaNaPista(0, 20, 0, 0, 36);
  for (let k = 0; k < 90; k++) cc.passo(1 / 60);
  const fovRapido = cam.fov;
  ok(fovRapido > fovParado + 5, `FOV abre com a velocidade (${fovParado.toFixed(1)} -> ${fovRapido.toFixed(1)} graus a 36 m/s)`);
  const turboAntes = j.turbo;
  j.turbo = { carga: 1, capacidade: 4, ativo: true };
  for (let k = 0; k < 90; k++) cc.passo(1 / 60);
  const fovTurbo = cam.fov;
  ok(fovTurbo > fovRapido + 5, `FOV abre mais no turbo (${fovTurbo.toFixed(1)} graus)`);
  j.turbo.ativo = false;
  for (let k = 0; k < 90; k++) { cc.fov(12); cc.passo(1 / 60); }
  ok(cam.fov > fovRapido + 8, `fov(extra) chamado a cada passo segura o FOV aberto (${cam.fov.toFixed(1)})`);
  for (let k = 0; k < 120; k++) cc.passo(1 / 60);
  perto(cam.fov, fovRapido, 0.6, 'sem chamar fov(extra), volta sozinho');
  j.turbo = turboAntes;
  const m = cam.projectionMatrix.elements;
  ok(m.every(Number.isFinite), 'matriz de projecao valida');

  // ------------------------------------------------------------------ tremor
  for (let k = 0; k < 30; k++) cc.passo(1 / 60);
  const base = cam.position.clone();
  cc.treme(1, 0.5);
  let tremeu = 0;
  for (let k = 0; k < 8; k++) { cc.passo(1 / 60); tremeu = Math.max(tremeu, cam.position.distanceTo(base)); }
  for (let k = 0; k < 40; k++) cc.passo(1 / 60);
  const parou = cam.position.distanceTo(base);
  ok(tremeu > 0.05 && parou < 0.01, `treme(1, 0,5 s) sacode ${tremeu.toFixed(2)} m e para sozinho`);

  // ------------------------------------------------------------------ queda: a camera corta para tras do carro que voltou
  let voltou = false;
  const desliga = on('carro:volta_pista', (e) => { if (e.carro === j) voltou = true; });
  j.colocaNaPista(0, 108, 0, 0, 12);
  for (let k = 0; k < 300 && !voltou; k++) { segura('acel', 0); segura('direcao', 0); quadros(1); }
  quadros(1);
  desliga();
  ok(voltou && cam.position.distanceTo(j.pos) < 12 && atras(cam, j) < -3, 'voltou da queda: a camera ja esta atras do carro (sem viagem pelo cenario)');

  // ------------------------------------------------------------------ festa depois da chegada
  j.colocaNaPista(0, 30, 0, 0, 0);
  j.chegou = true;
  const a0 = anguloEmVolta(cam, j);
  for (let k = 0; k < 90; k++) cc.passo(1 / 60);
  const a1 = anguloEmVolta(cam, j);
  let giro = a1 - a0; giro = Math.atan2(Math.sin(giro), Math.cos(giro));
  ok(Math.abs(giro) > 0.5 && finita(cam), `depois da chegada a camera gira em volta do carro (${(giro * 57.3).toFixed(0)} graus em 1,5 s)`);
  j.chegou = false;
  solta('acel'); solta('direcao');
  G.jogo.encerraCorrida();
});
