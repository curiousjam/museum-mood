import { SITE_ORIGIN, type MoodArtwork } from './moods';
export function wrapText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
 const lines:string[]=[];
 const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
 for(const paragraph of text.replace(/\r/g,'').split('\n')){
  let line='';
  for(const word of paragraph.split(/(\s+)/u)){
   if(ctx.measureText(line+word).width<=maxWidth){line+=word;continue}
   if(line.trim()){lines.push(line.trimEnd());line=''}
   for(const {segment} of segmenter.segment(word.trimStart())){
    if(ctx.measureText(line+segment).width>maxWidth&&line){lines.push(line);line=''}
    line+=segment;
   }
  }
  lines.push(line.trimEnd());
 }
 return lines;
}
export async function exportReaction(art:MoodArtwork,caption:string):Promise<Blob>{
 const img=new Image();img.src=art.image;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([img.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('The painting could not be loaded. Please retry.')),15000)})])}finally{clearTimeout(timer)}
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
 const c=canvas.getContext('2d');if(!c)throw Error('Image export is unavailable in this browser.');
 c.fillStyle='#eeeade';c.fillRect(0,0,1600,900);
 c.fillStyle='#24251f';c.fillRect(30,30,1540,560);
 const ratio=Math.min(1540/img.width,560/img.height),w=img.width*ratio,h=img.height*ratio;
 c.drawImage(img,30+(1540-w)/2,30+(560-h)/2,w,h);
 c.fillStyle='#20211c';c.textAlign='center';c.textBaseline='middle';
 let size=56,lines:string[]=[];
 do{c.font=`${size}px Georgia, serif`;lines=wrapText(c,caption,1460);if(lines.length*size*1.18<=174)break;size-=2}while(size>=16);
 if(lines.length*size*1.18>174)throw Error('This caption has too many lines. Shorten it before downloading.');
 lines.forEach((line,i)=>c.fillText(line,800,690+(i-(lines.length-1)/2)*size*1.18));
 c.strokeStyle='#bebbad';c.beginPath();c.moveTo(38,798);c.lineTo(1562,798);c.stroke();
 c.textAlign='left';c.font='bold 22px Arial';c.fillText(`MUSEUM MOOD / ${art.label.toUpperCase()}`,38,829);
 c.font='18px Arial';c.fillStyle='#53544a';c.fillText(`${art.title} · ${art.artist} · ${art.date} · The Met · Public domain`,38,866,1500);
 c.textAlign='right';c.font='20px Arial';c.fillText(new URL(SITE_ORIGIN).host,1562,829);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the image. Please try again.')),'image/jpeg',0.92));
}
export function downloadBlob(blob:Blob,id:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`museum-mood-${id}.jpg`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
