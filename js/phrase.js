import {scaleMidis, midiToStaff} from './theory.js?v=piano2';
export const LEVELS = {
  1:{label:'中央ド〜ソ',low:60,high:67},
  2:{label:'1オクターブ',low:60,high:72},
  3:{label:'高いソまで',low:60,high:79},
  4:{label:'低いソも加える',low:55,high:79},
  5:{label:'すごく高いドまで',low:55,high:84},
  6:{label:'低いソ〜すごく高いソ',low:55,high:91},
};
export function makePhrase({level,key='C',length=4,prev=null,rng=Math.random}) {
  const range=LEVELS[level];
  if(!range) throw new RangeError('未対応のレベル');
  if(!Number.isInteger(length)||length<2||length>8) throw new RangeError('音数は2〜8');
  const tones=scaleMidis(range.low,range.high,key);
  const random=n=>Math.min(n-1,Math.max(0,Math.floor(rng()*n)));
  // 音域全体から開始点を選び、順次進行を中心にする。単純な定型句の反復にしない。
  for(let attempt=0;attempt<80;attempt++) {
    let index=(random(tones.length)+attempt)%tones.length;
    const notes=[{midi:tones[index]}];let leaps=0;
    for(let i=1;i<length;i++) {
      const candidates=tones.map((midi,j)=>({midi,j,step:Math.abs(j-index)}))
        .filter(n=>n.step<=3 && (n.step<2||leaps===0)
          && !(notes.length>1&&n.midi===notes.at(-1).midi&&n.midi===notes.at(-2).midi));
      const weighted=candidates.flatMap(n=>Array(n.step===1?5:n.step===0?1:2).fill(n));
      const next=weighted[random(weighted.length)];
      if(next.step>=2)leaps++;index=next.j;notes.push({midi:next.midi});
    }
    if(new Set(notes.map(n=>n.midi)).size<2)continue;
    if(prev&&notes.every((n,i)=>n.midi===prev.notes[i]?.midi))continue;
    return {notes,key,level};
  }
  // 乱数が同じ値しか返さなくても、隣接音の往復で前回とは別の問題を保証する。
  for(let start=0;start<tones.length-1;start++) {
    const notes=Array.from({length},(_,i)=>({midi:tones[start+i%2]}));
    if(!prev||notes.some((n,i)=>n.midi!==prev.notes[i]?.midi))return {notes,key,level};
  }
  throw new Error('問題を生成できませんでした');
}
