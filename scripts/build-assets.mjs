// Обработка скачанных ресурсов: объединение, сжатие Draco, упрощение, webp
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco, simplify, weld, textureCompress, mergeDocuments, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [DL, OUT] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
await MeshoptSimplifier.ready;
const kb = (p) => Math.round(fs.statSync(p).size / 1024) + ' KB';

// Убрать unlit и сделать материалы матовыми PBR
function toPBR(doc) {
  doc.getRoot().listExtensionsUsed().filter((e) => e.extensionName === 'KHR_materials_unlit').forEach((e) => e.dispose());
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.85);
}

// Собрать несколько GLB в один файл, каждая модель — узел с именем файла
async function pack(dir, names, outFile) {
  const target = await io.read(path.join(dir, names[0] + '.glb'));
  const wrap = (doc, name) => {
    const scene = doc.getRoot().listScenes()[0];
    const root = doc.createNode(name);
    for (const n of scene.listChildren()) { scene.removeChild(n); root.addChild(n); }
    scene.addChild(root);
  };
  wrap(target, names[0]);
  for (const name of names.slice(1)) {
    const src = await io.read(path.join(dir, name + '.glb'));
    wrap(src, name);
    mergeDocuments(target, src);
  }
  const [main, ...rest] = target.getRoot().listScenes();
  for (const s of rest) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  toPBR(target);
  await target.transform(unpartition(), dedup(), prune(), draco());
  await io.write(outFile, target);
  console.log('pack', path.basename(outFile), names.length, 'моделей', kb(outFile));
}

// Машина Kenney: встроить текстуру, сжать
async function car(src, outFile) {
  const doc = await io.read(src);
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.6);
  await doc.transform(dedup(), prune(), draco());
  await io.write(outFile, doc);
  console.log('car', path.basename(outFile), kb(outFile));
}

// Камень Poly Haven: упростить сетку, текстуры в webp 1024, Draco
async function rock(src, outFile, ratio) {
  const doc = await io.read(src);
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }),
    dedup(), prune(), unpartition(), draco(),
  );
  await io.write(outFile, doc);
  const tris = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0), 0);
  console.log('rock', path.basename(outFile), tris, 'треугольников', kb(outFile));
}

const CARKIT = path.join(DL, 'car-kit/Models/GLB format');
await car(path.join(CARKIT, 'suv.glb'), path.join(OUT, 'models/cars/kenney_suv.glb'));
await car(path.join(CARKIT, 'sedan.glb'), path.join(OUT, 'models/cars/kenney_sedan.glb'));
await car(path.join(CARKIT, 'truck.glb'), path.join(OUT, 'models/cars/kenney_pickup.glb'));
fs.copyFileSync(path.join(DL, 'ferrari/ferrari.glb'), path.join(OUT, 'models/cars/ferrari.glb'));
fs.copyFileSync(path.join(DL, 'ferrari/ferrari_ao.png'), path.join(OUT, 'models/cars/ferrari_ao.png'));

await pack(path.join(DL, 'nature-kit/Models/GLTF format'), [
  'tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_pineDefaultA', 'tree_pineRoundA', 'tree_pineSmallA',
  'tree_default', 'tree_oak', 'tree_detailed', 'tree_fat',
  'cactus_short', 'cactus_tall', 'plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'grass_large',
  'rock_largeA', 'rock_largeB', 'rock_tallA', 'stone_largeA', 'stone_tallA',
], path.join(OUT, 'models/environment/nature_kit.glb'));

await pack(path.join(DL, 'racing-kit/Models/GLTF format'), [
  'grandStand', 'grandStandCovered', 'grandStandAwning', 'overhead', 'overheadLights', 'flagCheckers', 'flagRed',
  'barrierRed', 'barrierWhite', 'barrierWall', 'fenceStraight', 'rail', 'railDouble', 'pitsGarage', 'pitsOffice',
  'tent', 'tentLong', 'lightPostLarge', 'billboard', 'billboardLow', 'bannerTowerRed', 'pylon', 'radarEquipment',
], path.join(OUT, 'models/track/racing_kit.glb'));

const PH = path.join(DL, 'polyhaven');
await rock(path.join(PH, 'models/rock_moss_set_01/rock_moss_set_01_1k.gltf'), path.join(OUT, 'models/environment/rock_moss_set_01.glb'), 0.05);
await rock(path.join(PH, 'models/namaqualand_boulder_02/namaqualand_boulder_02_1k.gltf'), path.join(OUT, 'models/environment/namaqualand_boulder_02.glb'), 0.02);

// Текстуры PBR: jpg → webp
for (const name of fs.readdirSync(path.join(PH, 'textures'))) {
  const dir = path.join(PH, 'textures', name);
  fs.mkdirSync(path.join(OUT, 'textures', name), { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    const out = path.join(OUT, 'textures', name, f.replace('.jpg', '.webp'));
    await sharp(path.join(dir, f)).webp({ quality: f.includes('nor_gl') ? 90 : 82 }).toFile(out);
  }
  console.log('tex', name);
}
// HDRI — без изменений (1k/2k уже в нужном размере)
for (const f of fs.readdirSync(path.join(PH, 'hdri'))) fs.copyFileSync(path.join(PH, 'hdri', f), path.join(OUT, 'hdri', f));
console.log('hdri скопированы');
