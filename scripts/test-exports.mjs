import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {createCanvas,Image as NativeImage,loadImage} from '@napi-rs/canvas';
await fs.mkdir('outputs',{recursive:true});
await build({entryPoints:['lib/export.ts','lib/moods.ts','lib/share.ts'],bundle:true,platform:'node',format:'esm',outdir:'outputs/test-modules'});
const {exportReaction}=await import('../outputs/test-modules/export.js');
const {artworks,resolveMood,DEFAULT_MOOD,composeUrl,shareText}=await import('../outputs/test-modules/moods.js');
let calls=[];
globalThis.Image=class extends NativeImage {set src(value){this.path=value}get src(){return this.path}async decode(){const bytes=await fs.readFile('public'+this.path);await new Promise((resolve,reject)=>{this.onload=resolve;this.onerror=reject;super.src=bytes})}};
globalThis.document={createElement(tag){assert.equal(tag,'canvas');const canvas=createCanvas(1600,900),ctx=canvas.getContext('2d');const fill=ctx.fillText.bind(ctx);ctx.fillText=(text,...args)=>{calls.push(text);fill(text,...args)};canvas.toBlob=(callback,type,quality)=>{assert.equal(type,'image/jpeg');const pixels=ctx.getImageData(650,200,300,200).data;assert(new Set(pixels).size>20,'Painting must be rendered, not an empty rectangle');callback(new Blob([canvas.toBuffer('image/jpeg',Math.round(quality*100))],{type}))};return canvas}};
for(const art of artworks){calls=[];const blob=await exportReaction(art,art.caption);const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);const image=await loadImage(bytes);assert.equal(image.width,1600);assert.equal(image.height,900);assert(calls.some(t=>t.includes(art.artist)));assert(calls.some(t=>t.includes('museum-mood.becoming.chatgpt.site')));assert(calls.includes(`MUSEUM MOOD / ${art.label.toUpperCase()}`));await fs.writeFile(`outputs/${art.id}.jpg`,bytes);console.log(`PASS export: ${art.id}`)}
for(const text of ['', 'Long caption '.repeat(13), 'First line\nSecond line', '世界が静かになる。🎨✨ أهلاً بالعالم', 'a'.repeat(180)]){const blob=await exportReaction(artworks[0],text);assert(blob.size>1000);console.log(`PASS caption: ${JSON.stringify(text.slice(0,32))}`)}
await assert.rejects(exportReaction({...artworks[0],image:'/art/missing.jpg'},'test'));
await assert.rejects(exportReaction(artworks[0],'\n'.repeat(100)),/too many lines/);
assert.equal(resolveMood('invalid'),DEFAULT_MOOD);assert.equal(resolveMood(null),DEFAULT_MOOD);
for(const a of artworks){assert.equal(resolveMood(a.id),a.id);const url=new URL(composeUrl(a.id));assert.equal(url.origin,'https://x.com');assert.equal(url.searchParams.get('text'),shareText(a.id));assert(shareText(a.id).includes(`/?mood=${a.id}`))}
console.log('PASS: 8 real JPEGs, caption edge cases, missing-image error, excessive-line error, mood fallback and X URL encoding.');
const {copyPostText}=await import('../outputs/test-modules/share.js');
assert.equal((await copyPostText('judging',{async writeText(text){assert.equal(text,shareText('judging'))}})).copied,true);
assert.equal((await copyPostText('judging',{async writeText(){throw Error('denied')}})).copied,false);
assert.deepEqual(await copyPostText('judging'),{copied:false,text:shareText('judging')});
console.log('PASS: clipboard success, permission failure, and unavailable-clipboard fallback.');
