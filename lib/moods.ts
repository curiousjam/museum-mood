import catalog from '@/data/catalog.json';
export const MOOD_IDS=['delighted','proud','suspicious','judging','confused','exhausted','panicking','unbothered'] as const;
export type MoodId=typeof MOOD_IDS[number];
export type MoodArtwork=Omit<typeof catalog[number],'id'> & {id:MoodId};
export const artworks=catalog as MoodArtwork[];
export const DEFAULT_MOOD: MoodId='judging';
export const SITE_ORIGIN='https://museum-mood.becoming.chatgpt.site';
export function resolveMood(value:unknown):MoodId{return MOOD_IDS.includes(value as MoodId)?value as MoodId:DEFAULT_MOOD}
export function resultUrl(id:MoodId){return `${SITE_ORIGIN}/?mood=${id}`}
export function shareText(id:MoodId){return `My reaction belongs in a museum.\n\nFind your Museum Mood: ${resultUrl(id)}`}
export function composeUrl(id:MoodId){return `https://x.com/intent/post?text=${encodeURIComponent(shareText(id))}`}
