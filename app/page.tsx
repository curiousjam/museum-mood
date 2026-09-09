'use client';
import {useState,useEffect,useCallback,type CSSProperties} from 'react';
import {flushSync} from 'react-dom';
import {ArrowDownToLine,ArrowUpRight,Check,RotateCcw,Landmark} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {artworks,DEFAULT_MOOD,MOOD_IDS,resolveMood,shareText,composeUrl,type MoodId} from '@/lib/moods';
import {exportReaction,downloadBlob} from '@/lib/export';
import {copyPostText} from '@/lib/share';

export default function Home(){
 const [mood,setMood]=useState<MoodId>(DEFAULT_MOOD);
 const [captions,setCaptions]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failed,setFailed]=useState(false),[ready,setReady]=useState(false),[retry,setRetry]=useState(0),[copyFallback,setCopyFallback]=useState('');
 const art=artworks.find(a=>a.id===mood)!;
 const caption=captions[mood]??art.caption;
 const selectMood=useCallback((value:unknown,push=true)=>{const id=resolveMood(value);setMood(id);setNotice('');setCopyFallback('');if(push){const url=new URL(location.href);url.searchParams.set('mood',id);history.pushState(null,'',url)}},[]);
 useEffect(()=>{const sync=()=>selectMood(new URLSearchParams(location.search).get('mood'),false);sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[selectMood]);
 useEffect(()=>{let active=true;setReady(false);setFailed(false);const image=new Image();image.src=art.image;image.decode().then(()=>{if(active)setReady(true)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[art.image,retry]);
 useEffect(()=>{for(const a of artworks){const i=new Image();i.src=a.image}},[]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;const lifecycle=new AbortController();
  const tool={name:'configure_museum_reaction',description:'Select one of eight museum moods and optionally set its caption. Does not download or post.',inputSchema:{type:'object',properties:{mood:{type:'string',enum:MOOD_IDS},caption:{type:'string',maxLength:180}},required:['mood'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input:unknown){const x=input as {mood?:unknown,caption?:unknown};if(!x||!MOOD_IDS.includes(x.mood as MoodId)||Object.keys(x).some(k=>!['mood','caption'].includes(k))||('caption' in x&&(typeof x.caption!=='string'||x.caption.length>180)))throw Error('Expected a valid mood and optional caption of at most 180 characters.');const id=x.mood as MoodId;flushSync(()=>{selectMood(id);if(typeof x.caption==='string')setCaptions(c=>({...c,[id]:x.caption as string}))});return {mood:id,configured:true}}};
  try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}
  return()=>lifecycle.abort();
 },[selectMood]);
 async function handleExport(share=false){
  if(busy)return;setBusy(true);setNotice('Preparing your reaction…');setCopyFallback('');
  // Reserve a tab during the click so asynchronous image generation does not trigger popup blocking.
  const popup=share?window.open('about:blank','_blank'):null;if(popup)popup.opener=null;
  try{
   const blob=await exportReaction(art,caption);downloadBlob(blob,mood);
   if(share){const {copied,text}=await copyPostText(mood,navigator.clipboard);if(!copied)setCopyFallback(text);
    if(popup)popup.location.replace(composeUrl(mood));
    setNotice(`Image downloaded. ${copied?'Post text copied. ':''}Attach the downloaded image in X.${!popup?' Use the Open X compose link below.':''}`);
   }else setNotice('Your reaction is downloaded. A masterpiece, honestly.');
  }catch(error){popup?.close();setNotice(error instanceof Error?error.message:'Something went wrong. Please try again.')}finally{setBusy(false)}
 }
 return <main style={{'--accent':art.accent} as CSSProperties}>
  <header><a className="wordmark" href="/" aria-label="Museum Mood home"><Landmark size={21}/><b>MUSEUM MOOD</b></a><span>Old art. Current feelings.</span><a className="source-link" href="https://www.metmuseum.org/hubs/open-access" target="_blank" rel="noreferrer">Public art, for everyone <ArrowUpRight size={15}/></a></header>
  <div className="intro"><div><p className="eyebrow">THE OPEN ACCESS REACTION COLLECTION</p><h1>Your reaction belongs<br/>in a <em>museum.</em></h1></div><p className="intro-note">Pick a feeling. Add your words.<br/>Send a little fine art into the feed.</p></div>
  <section className="workspace">
   <aside><p className="eyebrow">01 / PICK A FEELING</p><h2>How are we feeling?</h2><RadioGroup value={mood} onValueChange={v=>selectMood(v)} className="moods" aria-label="Choose your mood">{artworks.map((a,i)=><label key={a.id} className={`mood ${mood===a.id?'selected':''}`}><RadioGroupItem value={a.id} className="mood-radio"/><span className="mood-number" aria-hidden="true">0{i+1}</span><span>{a.label}</span>{mood===a.id&&<Check size={14} className="mood-check" aria-hidden="true"/>}</label>)}</RadioGroup><p className="quiet">Eight very old paintings.<br/>Eight very current moods.</p><div className="collection-note"><span className="small-dot"/> FREE TO REMIX<p>Real paintings from The Met.<br/>Public domain. Yours to make personal.</p></div></aside>
   <article aria-label="Your reaction"><div className="frame-top"><span>REACTION NO. 0{artworks.indexOf(art)+1}</span><span className="mood-tag">{art.label}</span></div><div className="artframe" aria-busy={!ready&&!failed}>
    <div className="painting-area">{failed?<div role="alert" className="image-error">This painting couldn’t load.<Button onClick={()=>setRetry(r=>r+1)}>Try again</Button></div>:<><img key={art.image+retry} src={art.image} alt={art.alt} onLoad={()=>setReady(true)} onError={()=>{setFailed(true);setReady(false)}}/>{!ready&&<span className="image-loading" role="status">Hanging your painting…</span>}</>}</div>
    <p className="preview-caption" style={{fontSize:caption.length>100?'clamp(16px,2vw,23px)':undefined}}>{caption||'\u00a0'}</p><div className="card-footer"><span>{art.label.toUpperCase()}</span><span>MUSEUM MOOD</span></div></div>
    <div className="art-credit"><p><span>{art.title}</span> · {art.artist}, {art.date}</p><a href={art.source} target="_blank" rel="noreferrer">The Met <ArrowUpRight size={13}/></a></div>
    <div className="caption-heading"><label htmlFor="caption">02 / MAKE IT YOURS</label><Button variant="ghost" className="reset" onClick={()=>setCaptions(c=>({...c,[mood]:art.caption}))} disabled={caption===art.caption}><RotateCcw size={12}/>Reset caption</Button></div>
    <Textarea id="caption" className="caption-input" value={caption} maxLength={180} rows={2} onChange={e=>setCaptions(c=>({...c,[mood]:e.target.value}))} aria-describedby="caption-hint"/><p id="caption-hint" className="caption-hint"><span>Your words. Their brushwork.</span><span>{caption.length}/180</span></p>
    <div className="actions"><Button className="download" onClick={()=>handleExport()} disabled={busy||!ready||failed}><ArrowDownToLine size={18}/>{busy?'Preparing image…':'Download my reaction'}</Button><Button variant="outline" className="share" onClick={()=>handleExport(true)} disabled={busy||!ready||failed}>Share on X <ArrowUpRight size={18}/></Button></div>
    <p className="share-note">Free 1600 × 900 image. When sharing on X, attach your download.</p>
    <div className="notice" role="status" aria-live="polite">{notice}{notice.includes('Attach')&&<a href={composeUrl(mood)} target="_blank" rel="noreferrer">Open X compose ↗</a>}</div>{copyFallback&&<div className="copy-fallback"><label htmlFor="post-copy">Copy this post text manually:</label><Textarea id="post-copy" readOnly value={copyFallback} onFocus={e=>e.target.select()}/></div>}
   </article>
  </section><footer><span>Human feelings. Museum quality.</span><span>Artwork: The Metropolitan Museum of Art · Public domain · Independent project</span></footer>
 </main>
}
