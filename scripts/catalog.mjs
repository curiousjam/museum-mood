import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seeds=[
 ['delighted',436626,'When the plans get cancelled and you were hoping they would.','#ecc767','A smiling boy turns toward the viewer, holding a lute.'],
 ['proud',12127,'Me after sending one email.','#c8adf0','A woman in a black gown stands tall, her profile turned confidently away.'],
 ['suspicious',436838,'Interesting. That is not what you said yesterday.','#bad08b','A young man and several women exchange sideways glances around a fortune-teller.'],
 ['judging',436120,'I have thoughts. None of them are supportive.','#ee8b70','An older woman sits with a stern expression and a steady, assessing gaze.'],
 ['confused',10827,'I understood every word separately.','#a0c8dc','A man stands with his hands in his pockets, staring down in thought.'],
 ['exhausted',435773,"I've done enough existing for today.",'#d9b78e','Farm workers bend and crouch in a field as daylight fades.'],
 ['panicking',435997,'Just saw the “quick question” message.','#ef7064','Two young people run together beneath a billowing cloth as a storm approaches.'],
 ['unbothered',53422,'Respectfully, this is outside my emotional budget.','#a7c8ae','Hotei reclines with a rounded belly and a relaxed smile, painted in ink.'],
];
const api='https://collectionapi.metmuseum.org/public/collection';
const live=process.argv.includes('--live'), generate=process.argv.includes('--generate');
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json()}
const records=[];
if(generate||live){
 for(const [id,objectId,caption,accent,alt] of seeds){
  const obj=await json(`${api}/v1/objects/${objectId}`);
  if(!obj.isPublicDomain||!obj.primaryImage||!(/painting/i.test(obj.classification)||/painting/i.test(obj.objectName)))throw Error(`Ineligible artwork ${objectId}`);
  if(!obj.objectURL.startsWith('https://www.metmuseum.org/'))throw Error('Missing official source');
  const record={id,label:id[0].toUpperCase()+id.slice(1),objectId,caption,accent,alt,title:obj.title,artist:obj.artistDisplayName,date:obj.objectDate,department:obj.department,classification:obj.classification,isPublicDomain:obj.isPublicDomain,primaryImage:obj.primaryImage,source:obj.objectURL,credit:obj.creditLine,image:`/art/${id}.jpg`,verifiedAt:new Date().toISOString()};
  if(generate){
   const search=await json(`${api}/v1.1/search?hasImages=true&medium=Paintings&q=${encodeURIComponent(obj.title.split(':')[0])}&limit=100`);
   if(!search.objectIDs?.includes(objectId))console.warn(`Search did not rank ${objectId} on first page; object verified directly.`);
   const r=await fetch(obj.primaryImage,{signal:AbortSignal.timeout(60000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error(`Image unavailable: ${id}`);
   await fs.mkdir(path.join(root,'public/art'),{recursive:true});await fs.writeFile(path.join(root,'public',record.image),Buffer.from(await r.arrayBuffer()));
  }
  records.push(record);console.log(`Verified ${id}: ${obj.title}`);
 }
 if(generate){await fs.mkdir(path.join(root,'data'),{recursive:true});await fs.writeFile(path.join(root,'data/catalog.json'),JSON.stringify(records,null,2)+'\n')}
}
const catalog=JSON.parse(await fs.readFile(path.join(root,'data/catalog.json'),'utf8'));
if(catalog.length!==8||new Set(catalog.map(x=>x.id)).size!==8||new Set(catalog.map(x=>x.objectId)).size!==8||new Set(catalog.map(x=>x.artist)).size!==8||new Set(catalog.map(x=>x.department)).size<3)throw Error('Catalog uniqueness or department coverage failed');
for(const r of catalog){if(!r.isPublicDomain||!r.source||!(await fs.stat(path.join(root,'public',r.image))).size)throw Error(`Invalid ${r.id}`);if(live){const current=records.find(x=>x.id===r.id);if(current.primaryImage!==r.primaryImage)throw Error(`Image source changed: ${r.id}`)}}
console.log('PASS: eight public-domain paintings, eight artists, at least three departments, all local assets present.');
