import test from 'node:test';
import assert from 'node:assert/strict';

import {createFuyomiApp} from '../js/app.js';
import {mtof} from '../js/theory.js';
import {companionStage, renderCompanion} from '../js/companion.js';

const ELEMENT_IDS = [
  'timer-select', 'timer-chip-off', 'timer-chip-on', 'practice-timer', 'result-time',
  'setup-screen', 'check-screen', 'practice-screen', 'result-screen', 'settings-form',
  'level-select', 'key-select', 'count-select', 'hint-select', 'sound-select',
  'marks-select', 'strings-field', 'strings-note', 'string-legend', 'string-chip-G',
  'string-chip-D', 'string-chip-A', 'string-chip-E',
  'tolerance-select', 'a4-select', 'level-description', 'teacher-notice', 'check-status',
  'check-guidance', 'without-mic-button', 'check-cancel-button', 'practice-count',
  'practice-key', 'manual-notice', 'staff-wrap', 'note-count', 'hold-track', 'hold-fill',
  'practice-status', 'hint-panel', 'hint-name', 'keyboard-hint', 'same-pitch-note',
  'fourth-finger-note', 'hint-button', 'example-button', 'manual-next-button', 'skip-button',
  'quit-button', 'result-summary', 'result-mode-note', 'trouble-list', 'next-suggestion',
  'record-list', 'retry-button', 'back-button', 'intro-dialog', 'intro-staff',
  'intro-close-button', 'companion', 'companion-art', 'companion-words',
  'companion-chip-fluffy', 'companion-chip-dino', 'companion-chip-dog'
];

const note = (midi, stringId, finger) => ({midi, stringId, finger});
const DEFAULT_PHRASES = [
  [note(60, 'A', 0), note(62, 'A', 1), note(64, 'A', 2), note(60, 'A', 0)],
  [note(62, 'A', 1), note(64, 'A', 2), note(65, 'A', 3), note(60, 'A', 0)],
  [note(64, 'A', 2), note(62, 'A', 1), note(60, 'A', 0), note(64, 'A', 2)]
];
const SILENT = Object.freeze({f:-1, conf:0, rms:0});

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(...values){ values.forEach(value => this.values.add(value)); }
  remove(...values){ values.forEach(value => this.values.delete(value)); }
  contains(value){ return this.values.has(value); }
}

class FakeElement {
  constructor(tagName = 'div', id = ''){
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.classList = new FakeClassList();
    this.style = {};
    this.clientWidth = 400;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.guideChildren = new Map();
  }

  addEventListener(type, listener){
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, values = {}){
    const event = {
      type,
      target:this,
      currentTarget:this,
      preventDefault(){},
      ...values
    };
    for(const listener of this.listeners.get(type) || []) listener(event);
  }

  click(){ this.dispatch('click'); }
  focus(){ this.focused = true; }
  setAttribute(name, value){ this.attributes.set(name, String(value)); }
  getAttribute(name){ return this.attributes.get(name) ?? null; }
  replaceChildren(...children){ this.children = children; }
  append(...children){ this.children.push(...children); }

  querySelectorAll(selector){
    if(selector === '[data-guide]') return [...this.guideChildren.values()];
    return [];
  }

  querySelector(selector){
    const match = /^\[data-guide="([^"]+)"\]$/.exec(selector);
    return match ? this.guideChildren.get(match[1]) || null : null;
  }
}

class FakeDocument {
  constructor(){
    this.elements = new Map(ELEMENT_IDS.map(id => [id, new FakeElement('div', id)]));
    this.body = new FakeElement('body', 'body');
    this.listeningMark = new FakeElement('div');
    const guidance = this.getElementById('check-guidance');
    for(const name of ['volume', 'permission', 'noise']){
      const guide = new FakeElement('li');
      guide.hidden = true;
      guidance.guideChildren.set(name, guide);
    }
  }

  getElementById(id){ return this.elements.get(id) || null; }
  querySelector(selector){ return selector === '.listening-mark' ? this.listeningMark : null; }
  createElement(tagName){ return new FakeElement(tagName); }
}

class FakeStorage {
  constructor(){ this.values = new Map([['fuyomi-piano', JSON.stringify({introSeen:true})]]); }
  getItem(key){ return this.values.get(key) ?? null; }
  setItem(key, value){ this.values.set(key, String(value)); }
}

class FakeClock {
  constructor(){
    this.time = 0;
    this.nextId = 1;
    this.timers = new Map();
    this.frames = new Map();
  }

  now(){ return this.time; }

  setTimeout(callback, delay = 0){
    const id = this.nextId++;
    this.timers.set(id, {at:this.time + Math.max(0, delay), callback});
    return id;
  }

  clearTimeout(id){ this.timers.delete(id); }

  requestAnimationFrame(callback){
    const id = this.nextId++;
    this.frames.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id){ this.frames.delete(id); }

  advance(milliseconds){
    const target = this.time + milliseconds;
    while(true){
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if(!due) break;
      const [id, timer] = due;
      this.timers.delete(id);
      this.time = timer.at;
      timer.callback();
    }
    this.time = target;
  }

  frame(milliseconds = 50){
    this.advance(milliseconds);
    const frames = [...this.frames.values()];
    this.frames.clear();
    frames.forEach(callback => callback(this.time));
  }

  get pendingTimers(){ return this.timers.size; }
  get pendingFrames(){ return this.frames.size; }
}

class FakeToneContext {
  constructor(clock){
    this.clock = clock;
    this.state = 'running';
    this.sampleRate = 48000;
    this.destination = {};
  }

  get currentTime(){ return this.clock.now() / 1000; }
  async resume(){ this.state = 'running'; }
  async close(){ this.state = 'closed'; }
  createOscillator(){
    let stopped = false;
    return {
      type:'sine',
      frequency:{setValueAtTime(){}},
      connect(){},
      start(){},
      stop(){
        if(stopped) throw new Error('oscillator already stopped');
        stopped = true;
      },
      addEventListener(){}
    };
  }
  createGain(){
    return {
      gain:{setValueAtTime(){}, exponentialRampToValueAtTime(){}},
      connect(){}
    };
  }
}

class FakeResizeObserver {
  observe(){}
  disconnect(){}
}

function deferred(){
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {promise, resolve, reject};
}

async function flushAsync(){
  for(let index = 0; index < 6; index++) await Promise.resolve();
}

function createHarness({
  phrases = DEFAULT_PHRASES,
  createMicrophone,
  judgeNote,
  storedSettings,
} = {}){
  const clock = new FakeClock();
  const document = new FakeDocument();
  const storage = new FakeStorage();
  if (storedSettings) storage.setItem('fuyomi-piano', JSON.stringify({settings:storedSettings}));
  const toneContext = new FakeToneContext(clock);
  let detection = SILENT;
  let microphoneClosed = false;
  let phraseCalls = 0;
  const phraseArgs = [];
  const mic = {
    read:() => detection,
    sampleRate:48000,
    ctx:toneContext,
    close(){
      microphoneClosed = true;
      void toneContext.close();
    }
  };
  const navigator = {mediaDevices:{getUserMedia(){}}};
  const window = {
    location:{search:''},
    localStorage:storage,
    navigator,
    performance:{now:() => clock.now()},
    setTimeout:(callback, delay) => clock.setTimeout(callback, delay),
    clearTimeout:(timer) => clock.clearTimeout(timer),
    requestAnimationFrame:(callback) => clock.requestAnimationFrame(callback),
    cancelAnimationFrame:(frame) => clock.cancelAnimationFrame(frame),
    scrollTo(){},
    addEventListener(){},
    matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}),
    ResizeObserver:FakeResizeObserver,
  };
  window.AudioContext = class extends FakeToneContext {
    constructor(){ super(clock); }
  };

  const app = createFuyomiApp({
    window,
    document,
    clock,
    storage,
    navigator,
    ResizeObserver:FakeResizeObserver,
    microphone:{
      create:createMicrophone || (async () => mic),
      detect:(sample) => sample,
    },
    makePhrase({level, key, strings}){
      const source = phrases[Math.min(phraseCalls, phrases.length - 1)];
      phraseCalls += 1;
      phraseArgs.push({level, key, strings});
      return {level, key, strings, notes:source.map(value => ({...value}))};
    },
    ...(judgeNote ? {judgeNote} : {}),
  });

  return {
    app,
    clock,
    document,
    mic,
    storage,
    setDetection(value){ detection = value; },
    get microphoneClosed(){ return microphoneClosed; },
    get phraseCalls(){ return phraseCalls; },
    get phraseArgs(){ return phraseArgs; },
  };
}

function pressedStrings(document){
  return ['G', 'D', 'A', 'E'].filter(id =>
    document.getElementById(`string-chip-${id}`).getAttribute('aria-pressed') === 'true');
}

function configure(harness, {level = 1, sound = 'off'} = {}){
  harness.document.getElementById('level-select').value = String(level);
  harness.document.getElementById('key-select').value = 'A';
  harness.document.getElementById('count-select').value = '3';
  harness.document.getElementById('hint-select').value = 'off';
  harness.document.getElementById('sound-select').value = sound;
  harness.document.getElementById('tolerance-select').value = 'loose';
  harness.document.getElementById('a4-select').value = '442';
}

function submit(harness){
  harness.document.getElementById('settings-form').dispatch('submit');
}

function voiced(midi){
  return {f:mtof(midi, 440), conf:1, rms:0.2};
}

function armWithSilence(harness){
  harness.setDetection(SILENT);
  harness.clock.frame(20);
}

function holdMidi(harness, midi){
  harness.setDetection(voiced(midi));
  for(let frame = 0; frame < 6; frame++) harness.clock.frame(50);
}

async function startMicPractice(harness, options = {}){
  configure(harness, options);
  submit(harness);
  await flushAsync();

  assert.equal(harness.document.getElementById('practice-screen').hidden, false);
  armWithSilence(harness);
}

async function startManualPractice(harness, options = {}){
  configure(harness, options);
  submit(harness);
  harness.document.getElementById('without-mic-button').click();
  await flushAsync();
  assert.equal(harness.document.getElementById('practice-screen').hidden, false);
}

function skipWholeSession(harness){
  const skip = harness.document.getElementById('skip-button');
  for(let phraseIndex = 0; phraseIndex < 3; phraseIndex++){
    for(let noteIndex = 0; noteIndex < 4; noteIndex++){
      skip.click();
      harness.clock.advance(noteIndex < 3 ? 280 : 520);
    }
  }
}

async function passWholeSession(harness, phrases, misses = new Set()){
  for(let phraseIndex = 0; phraseIndex < 3; phraseIndex++){
    for(let noteIndex = 0; noteIndex < 4; noteIndex++){
      const target = phrases[phraseIndex][noteIndex].midi;
      if(misses.has(`${phraseIndex}:${noteIndex}`)){
        holdMidi(harness, target === 62 ? 64 : 62);
        harness.clock.advance(620);
        armWithSilence(harness);
      }
      holdMidi(harness, target);
      if(noteIndex < 3){
        harness.clock.advance(300);
        armWithSilence(harness);
      } else {
        // 4音そろうと完了の和音が鳴る。和音の予約はawaitの先なので、
        // 時計を進める前にマイクロタスクを流して次フレーズのタイマーを登録させる。
        await flushAsync();
        harness.clock.advance(1000);
        if(phraseIndex < 2) armWithSilence(harness);
      }
    }
  }
}


test('ピアノ版はハ長調440Hzで、確認音なしで開始する', async()=>{
 const h=createHarness();assert.equal(h.document.getElementById('key-select').value,'C');
 assert.equal(h.document.getElementById('a4-select').value,'440');
 submit(h);await flushAsync();assert.equal(h.document.getElementById('practice-screen').hidden,false);
 holdMidi(h,60);assert.equal(h.document.getElementById('companion').getAttribute('data-reaction'),'happy');h.app.destroy();
});
test('違うオクターブのドは不正解で、ド5と表示する',async()=>{
 const h=createHarness();await startMicPractice(h);holdMidi(h,72);
 assert.equal(h.document.getElementById('companion').getAttribute('data-reaction'),'miss');
 assert.match(h.document.getElementById('companion-words').textContent,/ド5/);h.app.destroy();
});
test('正解の持続音は次へ二重に進まず、不正解も弾き直すまで残る',async()=>{
 const h=createHarness();await startMicPractice(h);holdMidi(h,60);h.clock.advance(400);holdMidi(h,60);
 assert.equal(h.document.getElementById('note-count').textContent,'2 / 4音');
 armWithSilence(h);holdMidi(h,61);h.clock.advance(20000);
 assert.equal(h.document.getElementById('companion').getAttribute('data-reaction'),'miss');
 armWithSilence(h);h.setDetection(voiced(62));h.clock.frame(20);
 assert.equal(h.document.getElementById('companion').getAttribute('data-reaction'),'idle');h.app.destroy();
});
test('ヒントは音名の次に鍵盤位置を示す',async()=>{
 const h=createHarness();await startManualPractice(h);
 h.document.getElementById('hint-button').click();assert.match(h.document.getElementById('hint-name').textContent,/ド4/);
 h.document.getElementById('hint-button').click();assert.match(h.document.getElementById('keyboard-hint').innerHTML,/ド4の鍵盤位置/);h.app.destroy();
});
test('全12音のマイク正解後に結果へ進み資源を解放する',async()=>{
 const h=createHarness();await startMicPractice(h);await passWholeSession(h,DEFAULT_PHRASES);
 assert.equal(h.document.getElementById('result-screen').hidden,false);
 assert.equal(h.microphoneClosed,true);assert.equal(h.clock.pendingTimers,0);assert.equal(h.clock.pendingFrames,0);h.app.destroy();
});
test('マイク待ちのキャンセル後に届いた成功は解放する',async()=>{
 const pending=deferred();const h=createHarness({createMicrophone:()=>pending.promise});submit(h);
 h.document.getElementById('check-cancel-button').click();pending.resolve(h.mic);await flushAsync();
 assert.equal(h.microphoneClosed,true);assert.equal(h.document.getElementById('setup-screen').hidden,false);h.app.destroy();
});
test('手動へ進んだ後のマイク失敗は現在の問題を壊さない',async()=>{
 const pending=deferred();const h=createHarness({createMicrophone:()=>pending.promise});await startManualPractice(h);
 pending.reject(new Error('late'));await flushAsync();h.clock.advance(3000);
 assert.equal(h.phraseCalls,1);assert.equal(h.document.getElementById('practice-screen').hidden,false);h.app.destroy();
});
test('タイマーは準備を除き最後の音で止まる。再挑戦はゼロから',async()=>{
 const pending=deferred();const h=createHarness({storedSettings:{timer:'on'},createMicrophone:()=>pending.promise});
 submit(h);h.clock.advance(5000);h.document.getElementById('without-mic-button').click();
 assert.equal(h.document.getElementById('practice-timer').textContent,'経過 0:00.0');
 for(let i=0;i<12;i++){
  h.document.getElementById('manual-next-button').click();const shown=h.document.getElementById('practice-timer').textContent;
  await flushAsync();h.clock.advance(i%4===3?1000:300);
  if(i===11)assert.equal(h.document.getElementById('result-time').textContent,shown.replace('経過','クリアタイム'));
 }
 assert.equal(h.clock.pendingTimers,0);h.document.getElementById('retry-button').click();h.document.getElementById('without-mic-button').click();
 assert.equal(h.document.getElementById('practice-timer').textContent,'経過 0:00.0');h.app.destroy();
});
test('タイマーオフ・とばす・相棒選択の保存',async()=>{
 const h=createHarness();h.document.getElementById('companion-chip-dog').click();
 assert.equal(JSON.parse(h.storage.getItem('fuyomi-piano')).settings.companion,'dog');
 await startManualPractice(h);assert.equal(h.document.getElementById('practice-timer').hidden,true);
 skipWholeSession(h);assert.equal(h.document.getElementById('result-time').hidden,true);h.app.destroy();
});
test('マイク拒否は手動へ移り、タイマー途中終了は資源を残さない',async()=>{
 const h=createHarness({storedSettings:{timer:'on'},createMicrophone:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}});
 submit(h);await flushAsync();h.clock.advance(1600);
 assert.equal(h.document.getElementById('practice-screen').hidden,false);
 assert.equal(h.document.getElementById('manual-notice').hidden,false);
 h.document.getElementById('quit-button').click();assert.equal(h.clock.pendingTimers,0);h.app.destroy();
});
