import test from 'node:test';import assert from 'node:assert/strict';
import {LEVELS,makePhrase} from '../js/phrase.js';
import {mtof,scaleMidis,KEYS,noteLabel} from '../js/theory.js';
import {detect,judgeNote,TOL,createHolder} from '../js/pitch.js';
import {renderStaff,staffPosition,renderKeyboard} from '../js/staff.js';
const rngFor=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
test('音域は中央ド〜ソからG3〜G6へ6段階で拡張する',()=>{
 assert.deepEqual(Object.values(LEVELS).map(r=>[r.low,r.high]),[[60,67],[60,72],[60,79],[55,79],[55,84],[55,91]]);
});
for(const level of Object.keys(LEVELS).map(Number))test(`レベル${level}の全調で範囲・変化・音域全体の出題を守る`,()=>{
 for(const key of Object.keys(KEYS)){
  const range=LEVELS[level],tones=scaleMidis(range.low,range.high,key),seen=new Set();let prev=null;
  const rng=rngFor(level*100+key.charCodeAt(0));
  for(let i=0;i<300;i++){
   const p=makePhrase({level,key,rng,prev});assert.equal(p.notes.length,4);
   assert.ok(new Set(p.notes.map(n=>n.midi)).size>=2);let leaps=0;
   p.notes.forEach((n,j)=>{assert.ok(tones.includes(n.midi));seen.add(n.midi);if(j){const step=Math.abs(tones.indexOf(n.midi)-tones.indexOf(p.notes[j-1].midi));assert.ok(step<=3);if(step>=2)leaps++;}});
   assert.ok(leaps<=1);if(prev)assert.notDeepEqual(p.notes,prev.notes);prev=p;
  }
  assert.deepEqual([...seen].sort((a,b)=>a-b),tones);
 }
});
test('固定乱数でも同じ問題を繰り返さない',()=>{for(const level of [1,6]){const p=makePhrase({level,rng:()=>0});assert.notDeepEqual(makePhrase({level,prev:p,rng:()=>0}).notes,p.notes);}});
test('G3〜G6の全半音を44.1/48kHzの減衰音から検出する',()=>{
 for(const sr of [44100,48000])for(let midi=55;midi<=91;midi++){
  const f=mtof(midi);const x=Float32Array.from({length:2048},(_,i)=>.25*Math.exp(-i/sr*5)*(Math.sin(2*Math.PI*f*i/sr)+.3*Math.sin(4*Math.PI*f*i/sr)+.12*Math.sin(6*Math.PI*f*i/sr)));
  const d=detect(x,sr);assert.ok(d.conf>.8);assert.ok(Math.abs(1200*Math.log2(d.f/f))<12,`${sr}/${midi}`);
 }
});
test('半音・オクターブの違いは全設定で通さない',()=>{
 for(const cfg of Object.values(TOL))for(let midi=55;midi<=91;midi++){
  const judge=delta=>judgeNote({freq:mtof(midi+delta),targetMidi:midi,candidates:[],cfg,a4:440});
  assert.equal(judge(0).ok,true);for(const delta of [-12,-1,1,12])assert.equal(judge(delta).ok,false);
 }
});
test('保持後の同じ残響は再合格せず、無声後は再判定する',()=>{
 const h=createHolder(TOL.loose),tone={f:440,conf:1,rms:.2};let found;
 for(let t=0;t<=200;t+=20)found=h.feed(t,tone)||found;assert.ok(found);h.reset();
 for(let t=220;t<1000;t+=20)assert.equal(h.feed(t,tone),null);
 h.feed(1000,{f:-1,conf:0,rms:0});found=null;for(let t=1020;t<1240;t+=20)found=h.feed(t,tone)||found;assert.ok(found);
});
test('ト音記号だけで中央ド・G3・G6を正しい位置に置く',()=>{
 assert.deepEqual([55,60,91].map(m=>{const p=staffPosition(m);return[p.clef,p.diatonic,p.y]}),[['treble',-5,150],['treble',-2,132],['treble',16,24]]);
 const svg=renderStaff({notes:[55,60,84,91].map(midi=>({midi,state:'current'}))});
 assert.equal((svg.match(/data-role="staff-line"/g)||[]).length,5);
 assert.equal((svg.match(/data-role="note"/g)||[]).length,4);
 assert.ok(!svg.includes('undefined'));assert.doesNotMatch(svg,/data-clef="bass"/);assert.match(svg,/data-midi="91"/);
});
test('鍵盤ヒントはオクターブと黒鍵を区別する',()=>{
 for(const midi of [55,60,61,72,91])assert.match(renderKeyboard(midi),/role="img"/);
 assert.notEqual(renderKeyboard(60),renderKeyboard(72));assert.match(renderKeyboard(61),/普通のド♯/);
});
test('ピアノの余韻中でも別音と同音の再打鍵を受け付ける',()=>{
 for(const changed of [true,false]) {
  const h=createHolder(TOL.loose);let result;
  for(let t=0;t<=200;t+=20)result=h.feed(t,{f:440,conf:1,rms:.2})||result;
  assert.ok(result);h.reset();
  for(let t=220;t<=460;t+=20)assert.equal(h.feed(t,{f:440,conf:1,rms:.04}),null);
  result=null;
  for(let t=480;t<=700;t+=20)result=h.feed(t,{f:changed?493.88:440,conf:1,rms:.2})||result;
  assert.ok(result);assert.ok(Math.abs(result.freq-(changed?493.88:440))<1);
 }
});
test('短い保持でも20/30/60fpsで同じ音が確定する',()=>{
 for(const fps of [20,30,60])for(const cfg of Object.values(TOL)){
  const h=createHolder(cfg);let result;
  for(let t=0;t<=cfg.hold+100;t+=1000/fps)result=h.feed(t,{f:261.63,conf:1,rms:.2})||result;
  assert.ok(result,`${fps}/${cfg.hold}`);
 }
});
test('無音とランダムノイズを高い確信度の音と扱わない',()=>{
 assert.equal(detect(new Float32Array(2048),48000).f,-1);
 const rng=rngFor(91);
 for(let i=0;i<30;i++)assert.ok(detect(Float32Array.from({length:2048},()=>rng()*.3-.15),48000).conf<TOL.loose.conf);
});

test('音域の呼び名は数字を使わず境界で切り替わる',()=>{
 assert.deepEqual([55,60,71,72,83,84,91].map(noteLabel),['低いソ','普通のド','普通のシ','高いド','高いシ','すごく高いド','すごく高いソ']);
 for(let midi=55;midi<=91;midi++) {
  assert.doesNotMatch(noteLabel(midi),/[0-9]/);
  const pos=staffPosition(midi);assert.equal(pos.clef,'treble');assert.ok(pos.y>=24&&pos.y<=150);
 }
});
