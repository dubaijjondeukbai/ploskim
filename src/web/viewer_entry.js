
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

const Q = new URLSearchParams(location.search);
let VIEW = Q.get('view') || 'cut';
const SHOT = Q.get('shot') === '1';
const LABELS = Q.get('labels') === '1';

const canvas = document.getElementById('c');
const box = document.getElementById('viewer'); const VW = () => Math.max(320, box.clientWidth), VH = () => Math.max(220, box.clientHeight);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(VW(), VH());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture; } catch (e) { console.log('env fail', e); }
scene.environmentIntensity = 1.25;

const std = (o) => new THREE.MeshStandardMaterial(o);
function brushed() { const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d'); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) { const v = 96 + Math.random() * 70; g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.fillRect(Math.random() * 512 - 100, Math.random() * 512, 60 + Math.random() * 380, 1); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const BR = brushed();
const M = {
  steel: std({color: 0xe2e4e6, metalness: 0.92, roughness: 0.62, roughnessMap: BR, bumpMap: BR, bumpScale: 0.35}),
  steel2: std({color: 0xb9bcc0, metalness: 0.92, roughness: 0.75, roughnessMap: BR}),
  steelIn: std({color: 0xc4c7ca, metalness: 0.9, roughness: 0.8, roughnessMap: BR}),
  dark: std({color: 0x26292d, metalness: 0, roughness: 0.55}),
  dark2: std({color: 0x41464c, metalness: 0, roughness: 0.48}),
  drum: std({color: 0xe9e4d4, metalness: 0, roughness: 0.28}),
  rubber: std({color: 0x151515, metalness: 0, roughness: 0.85}),
  pc: std({color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false}),
  water: std({color: 0x86a7ad, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.5, depthWrite: false}),
  oil: std({color: 0xb26d0c, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.93}),
  bottle: std({color: 0xdfe8ee, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false}),
  hose: std({color: 0x8d9093, metalness: 0, roughness: 0.65}),
  pvc: std({color: 0x8f918f, metalness: 0, roughness: 0.55}),
  red: std({color: 0x9c2a22, metalness: 0, roughness: 0.6}),
  weight: std({color: 0x6f7377, metalness: 1, roughness: 0.55}),
};

function add(parent, mesh, shadow = true) { mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function B(parent, w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(parent, m, shadow);
}
function C(parent, r, len, mat, x, y, z, axis = 'y', seg = 48, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, open), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); return add(parent, m);
}
// (z, y) 단면을 x 방향으로 밀어 낸 기둥
function prismZY(parent, pts, lenX, mat, xc) {
  const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(-p[0], p[1]) : s.moveTo(-p[0], p[1])); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: lenX, bevelEnabled: false}); g.translate(0, 0, -lenX / 2);
  const m = new THREE.Mesh(g, mat); m.rotation.y = Math.PI / 2; m.position.x = xc; return add(parent, m);
}
// 위가 열린 통(벽 4장 + 바닥)
function openBox(parent, w, h, d, t, mat, x, y0, z, skipFront = false) {
  B(parent, w, t, d, mat, x, y0 + t / 2, z);
  B(parent, w, h, t, mat, x, y0 + h / 2, z - d / 2 + t / 2);
  if (!skipFront) B(parent, w, h, t, mat, x, y0 + h / 2, z + d / 2 - t / 2);
  B(parent, t, h, d, mat, x - w / 2 + t / 2, y0 + h / 2, z);
  B(parent, t, h, d, mat, x + w / 2 - t / 2, y0 + h / 2, z);
}
function textPlane(text, w, h, color = '#3a3d40', font = '700 64px Arial') {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
  const g = cv.getContext('2d'); g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, cv.height / 2);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tx, transparent: true, toneMapped: false}));
}

// ------------------------------------------------------------------ 제품 (단위 mm)
const RIM = 300, WL = 215, AX = 285;           // 트랩 윗면, 수면, 축 높이
function buildProduct(o) {
  const root = new THREE.Group();
  const gTrap = new THREE.Group(), gCore = new THREE.Group(), gCover = new THREE.Group(), gDrawer = new THREE.Group(), gBottle = new THREE.Group();
  root.add(gTrap, gCore, gCover, gDrawer, gBottle);
  // --- 기존 그리스트랩
  openBox(gTrap, 600, RIM, 350, 2, M.steel, 0, 0, 0, o.cut);
  B(gTrap, 644, 3, 22, M.steel, 0, RIM - 1.5, -186); if (!o.cut) B(gTrap, 644, 3, 22, M.steel, 0, RIM - 1.5, 186);
  B(gTrap, 22, 3, 350, M.steel, -311, RIM - 1.5, 0); B(gTrap, 22, 3, 350, M.steel, 311, RIM - 1.5, 0);
  B(gTrap, 2, 162, 345, M.steelIn, -100, 181, 0); B(gTrap, 2, 162, 345, M.steelIn, 150, 181, 0);
  C(gTrap, 30, 46, M.steel, -322, 238, -60, 'x'); C(gTrap, 33, 14, M.dark, -350, 238, -60, 'x');
  C(gTrap, 30, 150, M.pvc, 374, 200, 0, 'x');
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(31, 32, 20), M.pvc); elbow.position.set(450, 200, 0); add(gTrap, elbow);
  C(gTrap, 30, 200, M.pvc, 450, 100, 0, 'y'); C(gTrap, 42, 6, M.steel2, 450, 3, 0, 'y');
  if (o.liquid) {
    B(gTrap, 595, WL - 3, 345, M.water, 0, 3 + (WL - 3) / 2, 0, false);
    B(gTrap, 447, 9, 345, M.oil, -74, WL + 4.5, 0, false);
  }
  // --- 본체(바닥판, 축, 물받이, 래칫, 드럼, 스크레이퍼)
  const py = RIM + 1.5;
  B(gCore, 600, 3, 45, M.steel2, 0, py, 152.5); B(gCore, 600, 3, 45, M.steel2, 0, py, -152.5);
  B(gCore, 13, 3, 260, M.steel2, -293.5, py, 0); B(gCore, 31, 3, 260, M.steel2, -97.5, py, 0); B(gCore, 182, 3, 260, M.steel2, 209, py, 0);
  C(gCore, 6, 424, M.steel, -80, AX, 0, 'x', 24);
  [-291, -97, 127].forEach(x => B(gCore, 4, 42, 30, M.steel2, x, AX + 3, 0));
  // 드럼
  C(gCore, 100, 180, M.drum, 20, AX, 0, 'x', 96);
  C(gCore, 103, 4, M.steel, -72, AX, 0, 'x', 96); C(gCore, 103, 4, M.steel, 112, AX, 0, 'x', 96);
  C(gCore, 16, 190, M.dark, 20, AX, 0, 'x', 32);
  // 래칫 휠(36칸)과 폴
  { const n = 36, ro = 74, ri = 65, pts = [];
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; pts.push([ro * Math.sin(a0), ro * Math.cos(a0)]); pts.push([ri * Math.sin(a1), ri * Math.cos(a1)]); }
    const w = prismZY(gCore, pts, 6, M.dark, -80); w.position.y = AX; }
  { const arm = new THREE.Group(); arm.position.set(-88, AX, 0); arm.rotation.x = -0.35; gCore.add(arm);
    B(arm, 5, 92, 16, M.steel, 0, 44, 0); const pw = B(arm, 12, 8, 26, M.dark, 5, 80, 10); pw.rotation.x = 0.5; C(arm, 4, 10, M.steel, 4, 88, 0, 'x', 16); }
  { const hp = B(gCore, 8, 8, 34, M.dark, -80, AX + 77, -22); hp.rotation.x = -0.45; B(gCore, 4, 22, 10, M.steel2, -90, AX + 90, -34); }
  // 전도 물받이(앞쪽) + 평형추(뒤쪽)
  { const bk = new THREE.Group(); bk.position.set(-200, AX, 0); bk.rotation.x = o.tipped ? 0.17 : -0.35; gCore.add(bk);
    B(bk, 150, 2, 112, M.dark2, 0, -34, 70); B(bk, 150, 46, 2, M.dark2, 0, -12, 14); B(bk, 150, 16, 2, M.dark2, 0, -27, 126);
    B(bk, 2, 46, 112, M.dark2, -75, -12, 70); B(bk, 2, 46, 112, M.dark2, 75, -12, 70);
    B(bk, 4, 30, 22, M.dark2, -77, -6, 6); B(bk, 4, 30, 22, M.dark2, 77, -6, 6);
    B(bk, 10, 6, 96, M.steel2, 0, 2, -46); C(bk, 19, 70, M.weight, 0, 2, -96, 'x', 32);
    if (o.liquid && !o.tipped) { const body = prismZY(gCore, [[25.5, -26], [74, -9], [19, -9]], 144, M.water, -200); body.position.y = AX; body.castShadow = false; }
  }
  // 스크레이퍼 겸 유도판 → 앞쪽 회수통
  prismZY(gCore, [[55, 369], [57, 371.5], [208, 304.5], [208, 301]], 180, M.steel, 20);
  { const a = Math.atan2(66, 151); [-71, 111].forEach(x => { const s = B(gCore, 2, 16, 166, M.steel, x, 343, 132); s.rotation.x = a; }); }
  prismZY(gCore, [[50, 366], [58, 372], [61, 369], [54, 363]], 178, M.rubber, 20);
  // --- 덮개
  const cy = RIM + 3 + 48.5, ch = 97;
  B(gCover, 600, ch, 1.5, M.steel, 0, cy, -174.2);
  B(gCover, 1.5, ch, 350, M.steel, -299.2, cy, 0); B(gCover, 1.5, ch, 350, M.steel, 299.2, cy, 0);
  B(gCover, 240, 1.5, 350, M.steel, -180, RIM + 100, 0); B(gCover, 180, 1.5, 350, M.steel, 210, RIM + 100, 0);
  B(gCover, 180, 1.5, 65, M.steel, 30, RIM + 100, 142.5); B(gCover, 180, 1.5, 65, M.steel, 30, RIM + 100, -142.5);
  B(gCover, 180, 2.5, 220, M.pc, 30, RIM + 100, 0, false);
  if (!o.cut) {
    B(gCover, 12, ch, 1.5, M.steel, -294, cy, 174.2); B(gCover, 37, ch, 1.5, M.steel, -93.5, cy, 174.2);
    B(gCover, 176, 34, 1.5, M.steel, -200, RIM + 20, 174.2);
    B(gCover, 190, 68, 1.5, M.steel, 20, RIM + 66, 174.2); B(gCover, 185, ch, 1.5, M.steel, 207.5, cy, 174.2);
    const logo = textPlane('FLOWSKIM', 168, 30, '#2f3236', '800 120px Arial'); logo.position.set(207, RIM + 62, 175.4); gCover.add(logo);
    const sub = textPlane('NO POWER  GREASE SKIMMER', 160, 13, '#565b60', '600 52px Arial'); sub.position.set(207, RIM + 38, 175.4); gCover.add(sub);
  }
  C(gCover, 29, 42, M.steel, -200, RIM + 121, 62, 'y'); C(gCover, 32, 12, M.steel2, -200, RIM + 136, 62, 'y');
  // --- 거름망 서랍(앞으로 뺌)
  openBox(gDrawer, 172, 50, 250, 1.5, M.steelIn, -200, RIM + 41, 46, true);
  B(gDrawer, 176, 58, 4, M.steel, -200, RIM + 68, 173.5 + (o.cut ? 0 : 3));
  C(gDrawer, 4.5, 96, M.dark, -200, RIM + 68, 196, 'x', 20); [-42, 42].forEach(dx => C(gDrawer, 3, 20, M.dark, -200 + dx, RIM + 68, 186, 'z', 16));
  if (o.cut) gDrawer.children[3] && (gDrawer.children[3].visible = true);
  // --- 회수통(트랩 앞에 건다)
  openBox(gBottle, 184, 172, 84, 3, M.bottle, 20, 118, 224);
  if (o.liquid || o.bottleOil) B(gBottle, 177, o.oilLevel || 70, 77, M.oil, 20, 121 + (o.oilLevel || 70) / 2, 224, false);
  B(gBottle, 70, 9, 12, M.dark, 20, 250, 270);
  [-60, 100].forEach(x => { B(gBottle, 14, 3, 40, M.steel2, x, RIM + 1.5 + 3.2, 196); B(gBottle, 14, 24, 3, M.steel2, x, RIM - 7, 181.5); });
  // 물줄기
  if (o.stream) C(gCore, 5, 150, M.water, -200, RIM + 30, 62, 'y', 16);
  if (o.explode) { gCore.position.y = 170; gCover.position.y = 390; gDrawer.position.y = 280; gDrawer.position.z = 190; gBottle.position.z = 170; gBottle.position.x = 0; }
  gCover.visible = !o.noCover; gDrawer.visible = !o.noDrawer;
  root.userData = {gTrap, gCore, gCover, gDrawer, gBottle};
  return root;
}

// ------------------------------------------------------------------ 주방
function tileTex(base, grout, n, vary = 10) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d'); const s = 512 / n;
  g.fillStyle = grout; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = Math.round((Math.random() - 0.5) * vary);
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function buildKitchen() {
  const g = new THREE.Group();
  const ft = tileTex([146, 141, 132], '#615d55', 4, 16); ft.repeat.set(5, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 4800), std({map: ft, roughness: 0.42, metalness: 0}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wt = tileTex([208, 208, 201], '#9f9c94', 4, 7); wt.repeat.set(7.5, 3);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6000, 2400), std({map: wt, roughness: 0.3, metalness: 0}));
  wall.position.set(0, 1200, -330); wall.receiveShadow = true; g.add(wall);
  // 2조 싱크대 1200 x 600 x 800
  const T = 850, sx = 60;
  [[-580, 270], [580, 270], [-580, -270], [580, -270]].forEach(p => C(g, 19, T - 20, M.steel, sx + p[0], (T - 20) / 2, p[1], 'y', 20));
  B(g, 1160, 22, 22, M.steel, sx, 160, -270); B(g, 22, 22, 540, M.steel, sx - 580, 160, 0); B(g, 22, 22, 540, M.steel, sx + 580, 160, 0);
  B(g, 1200, 28, 50, M.steel, sx, T - 14, 275); B(g, 1200, 28, 50, M.steel, sx, T - 14, -275);
  B(g, 50, 28, 500, M.steel, sx - 575, T - 14, 0); B(g, 50, 28, 500, M.steel, sx + 575, T - 14, 0); B(g, 60, 28, 500, M.steel, sx, T - 14, 0);
  B(g, 1200, 110, 14, M.steel, sx, T + 55, -293);
  [-290, 290].forEach(dx => { openBox(g, 520, 270, 500, 2, M.steel, sx + dx, T - 280, 0); C(g, 34, 60, M.steel2, sx + dx, T - 300, 0, 'y'); });
  C(g, 22, 600, M.pvc, sx, T - 330, 0, 'x', 24); [-290, 290].forEach(dx => C(g, 22, 40, M.pvc, sx + dx, T - 318, 0, 'y', 24));
  // 수전
  C(g, 14, 300, M.steel, sx, T + 330, -300, 'x', 20); C(g, 11, 220, M.steel, sx, T + 330, -190, 'z', 20); C(g, 11, 60, M.steel, sx, T + 302, -82, 'y', 20);
  // 싱크대에서 플로스킴으로 내려오는 호스
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-200, T - 345, 0), new THREE.Vector3(-200, T - 372, 6), new THREE.Vector3(-200, RIM + 168, 54), new THREE.Vector3(-200, RIM + 138, 62)]);
  add(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 27, 20), M.hose));
  // 소품: 고무 대야, 세제 통, 바닥 배수구
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(230, 180, 150, 48, 1, true), std({color: 0x8c2f27, roughness: 0.55, side: THREE.DoubleSide})); basin.position.set(900, 75, 250); add(g, basin);
  C(g, 180, 4, std({color: 0x7a2821, roughness: 0.6}), 900, 3, 250, 'y');
  B(g, 90, 230, 60, std({color: 0xe6e2d8, roughness: 0.45}), -760, 115, 120); C(g, 16, 30, std({color: 0x2f6fb5, roughness: 0.4}), -760, 245, 120, 'y', 20);
  B(g, 160, 4, 160, M.steel2, 640, 2, 330);
  return g;
}

// ------------------------------------------------------------------ 장면 구성
const cam = new THREE.PerspectiveCamera(30, VW() / VH(), 10, 20000);
const ctl = new OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.enableZoom = false; canvas.style.touchAction = 'pan-y';
window.FS_ZOOM = f => { const v = cam.position.clone().sub(ctl.target).multiplyScalar(f); cam.position.copy(ctl.target).add(v); };
try { new ResizeObserver(() => { renderer.setSize(VW(), VH()); cam.aspect = VW() / VH(); cam.updateProjectionMatrix(); }).observe(box); } catch (e) {}
let content = null, labels = [];
function lights(kind) {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa9a59b, kind === 'kitchen' ? 0.5 : 0.55); g.add(hemi);
  const d = new THREE.DirectionalLight(0xfff4e6, kind === 'kitchen' ? 3.0 : 2.9); d.position.set(kind === 'kitchen' ? -350 : -700, kind === 'kitchen' ? 2100 : 1500, kind === 'kitchen' ? 800 : 1300); d.castShadow = true;
  d.shadow.mapSize.set(4096, 4096); const sc = d.shadow.camera; sc.left = -1600; sc.right = 1600; sc.top = 1600; sc.bottom = -1200; sc.near = 100; sc.far = 5000; d.shadow.bias = -0.0006; d.shadow.radius = 5; g.add(d);
  const f = new THREE.DirectionalLight(0xeaf0ff, kind === 'kitchen' ? 0.75 : 0.6); f.position.set(900, 350, 1500); g.add(f);
  return g;
}
const VIEWS = {
  studio: {o: {liquid: true, oilLevel: 62}, pos: [1010, 800, 1230], tgt: [20, 215, 20]},
  cut: {o: {cut: true, liquid: true, stream: true, oilLevel: 78, noCover: true, noDrawer: true}, pos: [-500, 760, 1130], tgt: [-10, 222, 30],
    labels: [
      {p: [-200, 420, 62], n: '1', d: [-105, -78], t: '유입구', s: '싱크대 배수가 들어오는 곳'}, {p: [-200, 292, 118], n: '3', d: [-170, 60], t: '전도 물받이', s: '물이 고이면 무게로 넘어감'},
      {p: [-200, 288, -96], n: '4', d: [-185, -34], t: '평형추', s: '빈 물받이를 제자리로 되돌림'}, {p: [-80, 357, 0], n: '6', d: [-30, -150], t: '래칫', s: '축이 한쪽으로만 돌게 함'},
      {p: [30, 385, -20], n: '7', d: [90, -130], t: '드럼', s: '기름층에서 기름을 묻혀 올림'}, {p: [70, 340, 122], n: '8', d: [230, -90], t: '스크레이퍼', s: '기름을 긁어 앞으로 흘림'},
      {p: [80, 200, 266], n: '9', d: [240, 60], t: '회수통', s: '걷은 기름이 모이는 통(약 2 L)'},
    ]},
  explode: {o: {liquid: false, explode: true, bottleOil: true, oilLevel: 55}, pos: [1250, 1180, 1500], tgt: [20, 400, 40],
    labels: [
      {p: [200, 790, 60], n: '10', d: [150, -80], t: '덮개', s: '스테인리스, 투명 점검창'}, {p: [-200, 650, 330], n: '2', d: [-170, -30], t: '거름망 서랍', s: '찌꺼기를 거르고 앞으로 빼서 비움'},
      {p: [-200, 455, 60], n: '3', d: [-200, 40], t: '전도 물받이', s: '물이 고이면 무게로 넘어감'}, {p: [-80, 530, 0], n: '6', d: [-40, -150], t: '래칫', s: '축이 한쪽으로만 돌게 함'},
      {p: [60, 560, -20], n: '7', d: [200, -60], t: '드럼', s: '기름층에서 기름을 묻혀 올림'}, {p: [100, 300, 394], n: '9', d: [190, 30], t: '회수통', s: '걷은 기름이 모이는 통(약 2 L)'},
      {p: [-250, 200, 175], n: '12', d: [-150, 90], t: '기존 그리스트랩', s: '바꾸지 않고 그대로 사용'},
    ]},
  kitchen: {o: {liquid: true, oilLevel: 96}, kitchen: true, pos: [1500, 900, 2350], tgt: [120, 420, 0], fov: 30},
  close: {o: {liquid: true, oilLevel: 96}, kitchen: true, pos: [900, 640, 1480], tgt: [40, 360, 40], fov: 30},
  top: {o: {liquid: true}, pos: [0.1, 2400, 1], tgt: [0, 300, 0], fov: 22},
};
function setView(name) {
  VIEW = name; const v = VIEWS[name];
  if (content) scene.remove(content);
  content = new THREE.Group(); scene.add(content);
  content.add(lights(v.kitchen ? 'kitchen' : 'studio'));
  const prod = buildProduct(v.o); content.add(prod); window.PROD = prod;
  if (v.kitchen) content.add(buildKitchen());
  else { const sh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({opacity: 0.2})); sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true; content.add(sh); }
  renderer.toneMappingExposure = v.kitchen ? 0.78 : 1.05;
  cam.fov = v.fov || 30; cam.position.set(...v.pos); ctl.target.set(...v.tgt); cam.updateProjectionMatrix(); ctl.update();
  labels = (LABELS || !SHOT) && v.labels ? v.labels : [];
  document.querySelectorAll('#ui button').forEach(b => b.classList.toggle('on', b.dataset.v === name));
}
function drawLabels(force) {
  const svg = document.getElementById('lab');
  if (!force && !labels.length && !svg.childNodes.length) return;
  let h = ''; const W = VW(), H = VH();
  labels.forEach(L => { const v = new THREE.Vector3(...L.p).project(cam); const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
    const k = Math.max(0.55, Math.min(1, W / 1500)); const small = W < 640, fs = Math.round(23 * Math.max(0.74, Math.min(1, W / 1050))); const bx = px + L.d[0] * k * (small ? 0.62 : 1), by = py + L.d[1] * k * (small ? 0.62 : 1), r = (13 + 8 * k) * (small ? 0.74 : 1), dx = px - bx, dy = py - by, len = Math.hypot(dx, dy) || 1;
    h += `<line x1="${bx + dx / len * r}" y1="${by + dy / len * r}" x2="${px}" y2="${py}" stroke="#111" stroke-width="1.6"/><circle cx="${px}" cy="${py}" r="4.2" fill="#111"/>`
      + (L.t && !small ? `<text x="${bx + (L.d[0] < 0 ? -r - 9 : r + 9)}" y="${by + 8}" text-anchor="${L.d[0] < 0 ? 'end' : 'start'}" font-size="${fs}" font-weight="700" fill="#111" paint-order="stroke" stroke="#eceae6" stroke-width="6" font-family="'Noto Sans CJK KR','Malgun Gothic',sans-serif">${L.t}</text>` : '')
      + `<circle cx="${bx}" cy="${by}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.8"/><text x="${bx}" y="${by + (small ? 6 : 8.5)}" text-anchor="middle" font-size="${(L.n.length > 1 ? 20 : 24) * (small ? 0.72 : 1)}" font-weight="700" fill="#111" font-family="Arial">${L.n}</text>`; });
  svg.innerHTML = h;
  const lg = document.getElementById('legend'); if (lg) { lg.style.display = (!SHOT && labels.length) ? 'block' : 'none'; const key = VIEW + labels.length; if (lg.dataset.k !== key) { lg.dataset.k = key; lg.innerHTML = '<b>번호 설명</b><br>' + labels.map(L => `<b>${L.n}</b>&nbsp; ${L.t} — ${L.s}`).join('<br>'); } }
}
function frame() { ctl.update(); renderer.render(scene, cam); if (!SHOT) { drawLabels(); requestAnimationFrame(frame); } }
addEventListener('resize', () => { renderer.setSize(VW(), VH()); cam.aspect = VW() / VH(); cam.updateProjectionMatrix(); });

if (!SHOT) {
  const ui = document.getElementById('ui'); ui.style.display = 'flex'; 
  [['studio', '제품'], ['cut', '단면'], ['explode', '분해'], ['close', '주방(가까이)'], ['kitchen', '주방(전체)']].forEach(([v, n]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.v = v; b.onclick = () => setView(v); ui.appendChild(b); });
}
setView(VIEW);
window.shoot = () => { ctl.enableDamping = false; ctl.update(); renderer.render(scene, cam); renderer.render(scene, cam); drawLabels(true); return true; };
window.exportGLB = () => new Promise((res, rej) => { const p = buildProduct({liquid: true, oilLevel: 70});
  p.scale.setScalar(0.001); p.updateMatrixWorld(true);
  new GLTFExporter().parse(p, r => { let b = ''; const u = new Uint8Array(r); for (let i = 0; i < u.length; i += 32768) b += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); res(btoa(b)); }, e => rej(String(e)), {binary: true}); });
frame();
window.READY = true;
