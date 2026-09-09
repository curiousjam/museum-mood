import {shareText,type MoodId} from './moods';
export async function copyPostText(id:MoodId,clipboard?:Pick<Clipboard,'writeText'>){const text=shareText(id);try{if(!clipboard)throw Error('Clipboard unavailable');await clipboard.writeText(text);return {copied:true,text}}catch{return {copied:false,text}}}
