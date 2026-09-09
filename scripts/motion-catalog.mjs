import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const selections = [
  {
    objectId: 437531,
    eyeCrop: { x: 0.39, y: 0.218, width: 0.29 },
    alt: 'A woman with arched brows looks directly at you, her expression quietly appraising.',
  },
  {
    objectId: 436120,
    eyeCrop: { x: 0.36, y: 0.132, width: 0.22 },
    alt: 'An older woman in a white head covering fixes the viewer with a stern, narrowed gaze.',
  },
  {
    objectId: 437397,
    eyeCrop: { x: 0.33, y: 0.292, width: 0.3 },
    alt: 'Rembrandt looks out beneath furrowed brows, with tired eyes and a skeptical expression.',
  },
  {
    objectId: 436838,
    eyeCrop: { x: 0.09, y: 0.09, width: 0.82 },
    alt: 'Five figures exchange sideways glances around a young man visiting a fortune-teller.',
  },
  {
    objectId: 12072,
    eyeCrop: { x: 0.34, y: 0.215, width: 0.31 },
    alt: 'An Egyptian woman in a dark head covering regards the viewer with a direct, sideways glance.',
  },
  {
    objectId: 438407,
    eyeCrop: { x: 0.405, y: 0.205, width: 0.31 },
    alt: 'A man in a brown cap pauses with a jug in his hands and glances sharply to one side.',
  },
  {
    objectId: 10827,
    eyeCrop: { x: 0.43, y: 0.145, width: 0.19 },
    alt: 'A man in a dark suit stands with his hands in his pockets, looking down through his glasses.',
  },
  {
    objectId: 436582,
    eyeCrop: { x: 0.35, y: 0.22, width: 0.42 },
    alt: 'A young woman tilts her head and looks upward, her wide eyes conveying uncertainty.',
  },
  {
    objectId: 437630,
    eyeCrop: { x: 0.17, y: 0.08, width: 0.5 },
    alt: 'Saint Matthew stops writing and looks upward toward an angel as if awaiting clarification.',
  },
  {
    objectId: 435997,
    eyeCrop: { x: 0.39, y: 0.325, width: 0.12 },
    alt: 'Two young people run beneath a billowing cloth; she looks back while he looks toward her.',
  },
  {
    objectId: 435807,
    eyeCrop: { x: 0.285, y: 0.17, width: 0.19 },
    alt: 'A startled man stares wide-eyed with his mouth open while four companions crowd around him.',
  },
  {
    objectId: 11137,
    eyeCrop: { x: 0.28, y: 0.29, width: 0.3 },
    alt: 'Three men brace themselves in a canoe as it plunges through foaming river rapids.',
  },
];
const verify = process.argv.includes('--verify');
const existing = verify
  ? JSON.parse(await fs.readFile('data/motion-catalog.json', 'utf8'))
  : [];
if (!verify) await fs.mkdir('public/art/motion', { recursive: true });
const records = [];
for (const selection of selections) {
  const response = await fetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/objects/${selection.objectId}`,
  );
  assert(response.ok, `Met API ${response.status}`);
  const art = await response.json();
  assert(
    art.isPublicDomain &&
      art.primaryImage &&
      (art.classification === 'Paintings' || art.objectName === 'Painting'),
  );
  assert.equal(
    art.objectURL,
    `https://www.metmuseum.org/art/collection/search/${selection.objectId}`,
  );
  if (verify) {
    const saved = existing.find((a) => a.objectId === selection.objectId);
    assert(
      saved &&
        saved.source === art.objectURL &&
        saved.title === art.title &&
        saved.artist === art.artistDisplayName,
    );
    for (const variant of ['thumbnail', 'image'])
      assert((await fs.stat(`public${saved[variant]}`)).size > 1000);
    console.log(
      `verified ${art.objectID}: public domain / painting / image / official source`,
    );
    continue;
  }
  const remote = await fetch(art.primaryImage);
  assert(remote.ok);
  const image = await loadImage(Buffer.from(await remote.arrayBuffer()));
  const variants = {};
  for (const [key, max] of [
    ['thumbnail', 360],
    ['image', 2400],
  ]) {
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = createCanvas(
      Math.round(image.width * scale),
      Math.round(image.height * scale),
    );
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const path = `/art/motion/${art.objectID}-${key}.jpg`;
    await fs.writeFile(
      `public${path}`,
      canvas.toBuffer('image/jpeg', key === 'thumbnail' ? 82 : 90),
    );
    variants[key] = path;
    if (key === 'image') {
      variants.width = canvas.width;
      variants.height = canvas.height;
    }
  }
  records.push({
    ...selection,
    ...variants,
    title: art.title,
    artist: art.artistDisplayName,
    date: art.objectDate,
    credit: art.creditLine,
    department: art.department,
    classification: art.classification || 'Paintings',
    isPublicDomain: art.isPublicDomain,
    primaryImage: art.primaryImage,
    source: art.objectURL,
    verifiedAt: new Date().toISOString(),
  });
  console.log(`prepared ${art.objectID}`);
}
if (!verify)
  await fs.writeFile(
    'data/motion-catalog.json',
    JSON.stringify(records, null, 2) + '\n',
  );
