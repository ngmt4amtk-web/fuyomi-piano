import {midiToStaff,keySignature,noteLabel} from './theory.js';
import {CLEF_PATH,BASS_PATH,SHARP_PATH,NATURAL_PATH,NOTEHEAD_PATH} from './glyphs.js';
export {CLEF_PATH};
export function staffPosition(midi,key='C') {
  const note=midiToStaff(midi,key);
  const clef=midi<60?'bass':'treble';
  // ト音のE4=0、ヘ音のG2=0。両者は音階上12段ぶん離れている。
  const diatonic=note.diatonic+(clef==='bass'?12:0);
  return {...note,diatonic,clef,y:(clef==='bass'?232:120)-diatonic*6};
}
export function renderStaff({key='C',notes=[],theme='light'}={}) {
  const ink=theme==='dark'?'#edf1f5':'#26323a';const line=theme==='dark'?'#929da6':'#74828c';
  let content='';
  const path=(d,x,y,scale=12,color=ink,extra='')=>`<path ${extra} d="${d}" transform="translate(${x} ${y}) scale(${scale})" fill="${color}"/>`;
  for(const [clef,top] of [['treble',72],['bass',184]]) {
    for(let i=0;i<5;i++)content+=`<line data-role="staff-line" x1="24" x2="390" y1="${top+i*12}" y2="${top+i*12}" stroke="${line}"/>`;
    content+=path(clef==='treble'?CLEF_PATH:BASS_PATH,32,top+(clef==='treble'?36:12),12,ink,`data-role="clef" data-clef="${clef}"`);
    for(const [i,n] of keySignature(key).entries()) {
      const d=n.diatonic+(clef==='bass'?-2:0);
      content+=path(SHARP_PATH,72+i*13,top+48-d*6,10);
    }
  }
  content+='<path d="M21 72V232 M17 72Q6 100 15 148Q6 201 17 232" stroke="'+ink+'" stroke-width="1.5" fill="none"/>';
  notes.forEach((n,i)=>{
    const pos=staffPosition(n.midi,key);const x=130+i*78;const y=pos.y;const bottom=pos.clef==='bass'?232:120;
    const color=n.state==='done'?'#408f88':n.state==='miss'?'#c57480':ink;
    if(n.state==='current')content+=`<rect x="${x-22}" y="12" width="44" height="246" rx="12" fill="#83bdbd" opacity=".13"/>`;
    const ledgers=[];
    if(pos.diatonic<0)for(let d=-2;d>=pos.diatonic;d-=2)ledgers.push(d);
    if(pos.diatonic>8)for(let d=10;d<=pos.diatonic;d+=2)ledgers.push(d);
    for(const d of ledgers)content+=`<line data-role="ledger" x1="${x-12}" x2="${x+12}" y1="${bottom-d*6}" y2="${bottom-d*6}" stroke="${color}"/>`;
    const opacity=n.state==='todo'?.48:1;
    content+=`<g data-role="note" data-midi="${n.midi}" data-clef="${pos.clef}" data-y="${y}" opacity="${opacity}">`;
    if(pos.accidental!=='none')content+=path(pos.accidental==='sharp'?SHARP_PATH:NATURAL_PATH,x-26,y,10,color);
    content+=path(NOTEHEAD_PATH,x-7.08,y,12,color);
    const down=pos.diatonic>=4;const stemX=x+(down?-7.08:7.08);
    content+=`<line x1="${stemX}" x2="${stemX}" y1="${y+(down?2:-2)}" y2="${y+(down?42:-42)}" stroke="${color}" stroke-width="1.5"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 270" role="img" aria-label="ピアノの大譜表" style="display:block;width:100%;height:auto">${content}</svg>`;
}
export function renderKeyboard(midi) {
  const base=Math.floor(midi/12)*12;
  const whites=[0,2,4,5,7,9,11,12];let svg='';
  for(const [i,pc] of whites.entries())svg+=`<rect x="${i*36}" y="1" width="35" height="94" rx="3" fill="${base+pc===midi?'#73b7b2':'#fff'}" stroke="#66757c"/>`;
  for(const [pc,x] of [[1,25],[3,61],[6,133],[8,169],[10,205]])svg+=`<rect x="${x}" y="1" width="21" height="57" rx="2" fill="${base+pc===midi?'#73b7b2':'#28333d'}"/>`;
  return `<svg viewBox="0 0 288 112" role="img" aria-label="${noteLabel(midi)}の鍵盤位置">${svg}<text x="6" y="108" font-size="11" fill="currentColor">ド${Math.floor(base/12)-1}</text><text x="259" y="108" font-size="11" fill="currentColor">ド${Math.floor(base/12)}</text></svg>`;
}
