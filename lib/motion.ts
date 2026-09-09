import catalog from '@/data/motion-catalog.json';
import { MOOD_IDS, type MoodId } from './moods';

export type ArtworkRecord = (typeof catalog)[number];
export type MoodDefinition = {
  id: MoodId;
  label: string;
  emoji: string;
  artworkIds: number[];
  featuredArtworkId: number | null;
};
export type Camera = { x: number; y: number; width: number };
export type Phase =
  | 'cluster'
  | 'opening'
  | 'browsing'
  | 'exploring'
  | 'closing';
const emojis = ['😂', '😌', '🤨', '😒', '😵‍💫', '🫠', '😱', '😎'];
const moodArt: Partial<Record<MoodId, number[]>> = {
  judging: [437531, 436120, 437397],
  suspicious: [436838],
  confused: [10827],
  panicking: [435997],
};
export const motionArtworks: ArtworkRecord[] = catalog;
export const moodDefinitions: MoodDefinition[] = MOOD_IDS.map((id, i) => ({
  id,
  label: id,
  emoji: emojis[i],
  artworkIds: moodArt[id] ?? [],
  featuredArtworkId: moodArt[id]?.[0] ?? null,
}));
export const enabledMoodIds: MoodId[] = [
  'judging',
  'suspicious',
  'confused',
  'panicking',
];
export const enabledMoods = enabledMoodIds.map((id) =>
  moodDefinitions.find((m) => m.id === id)!,
);
export type ReactionSpot = {
  id: string;
  objectId: number;
  label: string;
  crop?: { x: number; y: number; width: number };
  full?: boolean;
};
export const reactionSpots: ReactionSpot[] = [
  { id: 'oh-really', objectId: 437531, label: 'oh, really?' },
  { id: 'heard-enough', objectId: 436120, label: 'i’ve heard enough' },
  { id: 'be-serious', objectId: 437397, label: 'you cannot be serious' },
  {
    id: 'heard-that',
    objectId: 436838,
    label: 'i heard that',
    crop: { x: 0.545, y: 0.165, width: 0.12 },
  },
  {
    id: 'not-adding-up',
    objectId: 436838,
    label: 'something isn’t adding up',
    crop: { x: 0.335, y: 0.15, width: 0.12 },
  },
  {
    id: 'checking-context',
    objectId: 436838,
    label: 'checking the context',
    crop: { x: 0.14, y: 0.175, width: 0.095 },
  },
  { id: 'processing', objectId: 10827, label: 'processing…' },
  {
    id: 'one-email',
    objectId: 10827,
    label: 'that meeting could’ve been an email',
    full: true,
  },
  {
    id: 'wait-what',
    objectId: 435997,
    label: 'wait what',
    crop: { x: 0.39, y: 0.325, width: 0.12 },
  },
  {
    id: 'we-should-leave',
    objectId: 435997,
    label: 'we should leave',
    crop: { x: 0.245, y: 0.27, width: 0.3 },
  },
];
export function spotsFor(art: ArtworkRecord) {
  return reactionSpots.filter((spot) => spot.objectId === art.objectId);
}
export function reactionCamera(art: ArtworkRecord, spot: ReactionSpot): Camera {
  return spot.full
    ? fullCamera(art)
    : eyeCamera(spot.crop ? { ...art, eyeCrop: spot.crop } : art);
}
export function getArtwork(id: number) {
  const art = motionArtworks.find((a) => a.objectId === id);
  if (!art) throw Error(`Unknown artwork ${id}`);
  return art;
}
export function nextArtwork(
  mood: MoodDefinition,
  id: number,
  direction: number,
) {
  const i = mood.artworkIds.indexOf(id);
  return mood.artworkIds[
    (i + direction + mood.artworkIds.length) % mood.artworkIds.length
  ];
}
export function eyeCamera(art: ArtworkRecord): Camera {
  const c = art.eyeCrop;
  return {
    x: c.x + c.width / 2,
    y: c.y + (((c.width * art.width) / art.height) * 9) / 32,
    width: c.width,
  };
}
export function fullCamera(art: ArtworkRecord): Camera {
  return {
    x: 0.5,
    y: 0.5,
    width: Math.max(1, ((art.height / art.width) * 16) / 9),
  };
}
export function boundCamera(camera: Camera, art: ArtworkRecord): Camera {
  const width = Math.max(0.08, Math.min(fullCamera(art).width, camera.width));
  const height = (((width * art.width) / art.height) * 9) / 16;
  const bound = (v: number, extent: number) =>
    extent >= 1 ? 0.5 : Math.max(extent / 2, Math.min(1 - extent / 2, v));
  return { width, x: bound(camera.x, width), y: bound(camera.y, height) };
}
export function swipeDirection(
  distance: number,
  velocity: number,
  height: number,
) {
  return Math.abs(distance) > height * 0.2 ||
    (Math.abs(distance) > 20 && Math.abs(velocity) > 0.5)
    ? distance < 0
      ? 1
      : -1
    : 0;
}
