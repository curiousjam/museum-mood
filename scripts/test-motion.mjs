import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { loadImage } from '@napi-rs/canvas';

await fs.mkdir('outputs/motion-test', { recursive: true });
await build({
  entryPoints: ['lib/motion.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'outputs/motion-test/model.mjs',
});
const {
  motionArtworks,
  moodDefinitions,
  enabledMoodIds,
  eyeCamera,
  fullCamera,
  boundCamera,
  nextArtwork,
  swipeDirection,
  reactionSpots,
  reactionCamera,
  spotsFor,
} = await import('../outputs/motion-test/model.mjs');
assert.equal(moodDefinitions.length, 8);
assert.equal(new Set(moodDefinitions.map((m) => m.id)).size, 8);
assert.deepEqual(enabledMoodIds, [
  'judging',
  'suspicious',
  'confused',
  'panicking',
]);
assert.equal(motionArtworks.length, 12);
assert.equal(new Set(motionArtworks.map((a) => a.objectId)).size, 12);
assert.equal(reactionSpots.length, 16);
assert.equal(new Set(reactionSpots.map((s) => s.id)).size, 16);
for (const id of enabledMoodIds) {
  const mood = moodDefinitions.find((m) => m.id === id);
  assert.equal(mood.artworkIds.length, 3);
  assert(mood.artworkIds.includes(mood.featuredArtworkId));
  for (const artId of mood.artworkIds)
    assert(motionArtworks.some((a) => a.objectId === artId));
}
for (const spot of reactionSpots) {
  const art = motionArtworks.find((a) => a.objectId === spot.objectId);
  assert(art);
  const camera = reactionCamera(art, spot);
  assert.deepEqual(boundCamera(camera, art), camera);
  assert(spot.label.length > 0);
}
assert.equal(
  spotsFor(motionArtworks.find((a) => a.objectId === 436838)).length,
  3,
);
for (const art of motionArtworks) {
  assert(art.isPublicDomain);
  assert.equal(art.classification, 'Paintings');
  assert.equal(
    art.source,
    `https://www.metmuseum.org/art/collection/search/${art.objectId}`,
  );
  const detail = await loadImage(`public${art.image}`),
    thumb = await loadImage(`public${art.thumbnail}`);
  assert.equal(detail.width, art.width);
  assert.equal(detail.height, art.height);
  assert(Math.max(thumb.width, thumb.height) <= 360);
  const eyes = eyeCamera(art);
  assert.deepEqual(boundCamera(eyes, art), eyes);
  assert(eyes.width < 0.4);
  assert(eyes.x > 0 && eyes.x < 1 && eyes.y > 0 && eyes.y < 1);
  assert.deepEqual(boundCamera(fullCamera(art), art), fullCamera(art));
  for (const width of [0.001, 0.1, 0.5, 1, 100]) {
    const camera = boundCamera({ x: -100, y: 100, width }, art);
    assert(camera.width >= 0.08 && camera.width <= fullCamera(art).width);
    assert(camera.x >= 0 && camera.x <= 1 && camera.y >= 0 && camera.y <= 1);
  }
}
const judging = moodDefinitions.find((m) => m.id === 'judging');
assert.equal(nextArtwork(judging, 437531, -1), 437397);
assert.equal(nextArtwork(judging, 437397, 1), 437531);
assert.equal(swipeDirection(-80, 0, 300), 1);
assert.equal(swipeDirection(80, 0, 300), -1);
assert.equal(swipeDirection(10, 3, 300), 0);
assert.equal(swipeDirection(-30, -0.8, 300), 1);
assert.equal(swipeDirection(30, 0, 300), 0);
for (const m of moodDefinitions) {
  const fixture = {
    ...m,
    artworkIds: [437531, 436120, 437397],
    featuredArtworkId: 437531,
  };
  assert.equal(nextArtwork(fixture, 437397, 1), 437531);
}
console.log(
  'PASS catalog, all eight mood definitions, crop geometry, zoom bounds, swipe thresholds, loop navigation, image sizes.',
);

await build({
  entryPoints: ['scripts/motion-fixture.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  outfile: 'outputs/motion-test/fixture.js',
  define: { 'process.env.NODE_ENV': '"development"' },
});
await fs.writeFile(
  'outputs/motion-test/index.html',
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>motion QA fixture</title><link rel="stylesheet" href="./fixture.css"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button{font:inherit}a,button{touch-action:manipulation}</style><div id="root"></div><script type="module" src="./fixture.js"></script></html>',
);
console.log(
  'Fixture generated. Run node scripts/serve-motion-fixture.mjs, then open http://127.0.0.1:3001/',
);
