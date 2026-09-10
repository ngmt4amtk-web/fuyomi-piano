import {midiToStaff,keySignature,noteLabel} from './theory.js?v=20260910-flats1';
import {CLEF_PATH,FLAT_PATH,SHARP_PATH,NATURAL_PATH,NOTEHEAD_PATH} from './glyphs.js?v=20260910-flats1';
export {CLEF_PATH};
export function staffPosition(midi,key='C') {
  const note=midiToStaff(midi,key);
  return {...note,clef:'treble',y:120-note.diatonic*6};
}
export function renderStaff({key='C',notes=[],theme='light'}={}) {
  const ink=theme==='dark'?'#edf1f5':'#26323a';const line=theme==='dark'?'#929da6':'#74828c';
  let content='';
  const path=(d,x,y,scale=12,color=ink,extra='')=>`<path ${extra} d="${d}" transform="translate(${x} ${y}) scale(${scale})" fill="${color}"/>`;
  for(let i=0;i<5;i++)content+=`<line data-role="staff-line" x1="24" x2="390" y1="${72+i*12}" y2="${72+i*12}" stroke="${line}"/>`;
  content+=path(CLEF_PATH,32,108,12,ink,'data-role="clef" data-clef="treble"');
  for(const [i,n] of keySignature(key).entries())content+=path(n.accidental==='flat'?FLAT_PATH:SHARP_PATH,72+i*13,120-n.diatonic*6,10,ink,`data-role="key-signature" data-accidental="${n.accidental}"`);
  const previousPitches = new Map();
  notes.forEach((n,i)=>{
    const pos=staffPosition(n.midi,key);const x=130+i*78;const y=pos.y;const bottom=120;
    const pitchKey = `${pos.letter}${pos.octave}`;
    if(previousPitches.has(pitchKey) && previousPitches.get(pitchKey)!==n.midi && pos.accidental==='none') {
      pos.accidental=keySignature(key).find(item=>item.letter===pos.letter)?.accidental||'natural';
    }
    previousPitches.set(pitchKey,n.midi);
    const color=n.state==='done'?'#408f88':n.state==='miss'?'#c57480':ink;
    if(n.state==='current')content+=`<rect x="${x-22}" y="12" width="44" height="156" rx="12" fill="#83bdbd" opacity=".13"/>`;
    const ledgers=[];
    if(pos.diatonic<0)for(let d=-2;d>=pos.diatonic;d-=2)ledgers.push(d);
    if(pos.diatonic>8)for(let d=10;d<=pos.diatonic;d+=2)ledgers.push(d);
    for(const d of ledgers)content+=`<line data-role="ledger" x1="${x-12}" x2="${x+12}" y1="${bottom-d*6}" y2="${bottom-d*6}" stroke="${color}"/>`;
    const opacity=n.state==='todo'?.48:1;
    content+=`<g data-role="note" data-midi="${n.midi}" data-clef="${pos.clef}" data-y="${y}" opacity="${opacity}">`;
    if(pos.accidental!=='none')content+=path(pos.accidental==='sharp'?SHARP_PATH:pos.accidental==='flat'?FLAT_PATH:NATURAL_PATH,x-26,y,10,color,`data-role="note-accidental" data-accidental="${pos.accidental}"`);
    content+=path(NOTEHEAD_PATH,x-7.08,y,12,color);
    const down=pos.diatonic>=4;const stemX=x+(down?-7.08:7.08);
    content+=`<line x1="${stemX}" x2="${stemX}" y1="${y+(down?2:-2)}" y2="${y+(down?42:-42)}" stroke="${color}" stroke-width="1.5"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180" role="img" aria-label="ト音記号の譜面" style="display:block;width:100%;height:auto">${content}</svg>`;
}
export function renderKeyboard(midi,key='C') {
  const base=Math.floor(midi/12)*12;
  const label = ['F','Bb','Eb'].includes(key) ? noteLabel(midi).replace('ド♯','レ♭').replace('レ♯','ミ♭').replace('ファ♯','ソ♭').replace('ソ♯','ラ♭').replace('ラ♯','シ♭') : noteLabel(midi);
  const whites=[0,2,4,5,7,9,11,12];let svg='';
  for(const [i,pc] of whites.entries())svg+=`<rect x="${i*36}" y="1" width="35" height="94" rx="3" fill="${base+pc===midi?'#73b7b2':'#fff'}" stroke="#66757c"/>`;
  for(const [pc,x] of [[1,25],[3,61],[6,133],[8,169],[10,205]])svg+=`<rect x="${x}" y="1" width="21" height="57" rx="2" fill="${base+pc===midi?'#73b7b2':'#28333d'}"/>`;
  return `<svg viewBox="0 0 288 112" role="img" aria-label="${label}の鍵盤位置">${svg}<text x="6" y="108" font-size="11" fill="currentColor">${noteLabel(base)}</text><text x="280" text-anchor="end" y="108" font-size="11" fill="currentColor">ド</text></svg>`;
}
