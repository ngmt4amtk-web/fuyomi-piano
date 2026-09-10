export const KEYS = {
  A: {jp: 'イ長調', de: 'A-dur', sharps: 3},
  D: {jp: 'ニ長調', de: 'D-dur', sharps: 2},
  G: {jp: 'ト長調', de: 'G-dur', sharps: 1},
  C: {jp: 'ハ長調', de: 'C-dur', sharps: 0},
  F: {jp: 'ヘ長調', de: 'F-dur', sharps: 0, flats: 1},
  Bb: {jp: '変ロ長調', de: 'B-dur', sharps: 0, flats: 2},
  Eb: {jp: '変ホ長調', de: 'Es-dur', sharps: 0, flats: 3}
};

const TONIC = {C: 0, G: 7, D: 2, A: 9, F: 5, Bb: 10, Eb: 3};
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A'];
const FLAT_LETTER_BY_PC = ['C','D','D','E','E','F','G','G','A','A','B','B'];
const NATURAL_PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
const LETTER_INDEX = {C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6};
const LETTER_BY_PC = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const NOTE_NAME_JA = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];

const pitchClass = midi => ((midi % 12) + 12) % 12;
const scalePcs = key => MAJOR.map(interval => (TONIC[key] + interval) % 12);

export function mtof(midi, a4 = 440) {
  return a4 * (2 ** ((midi - 69) / 12));
}

export function cents(freq, midi, a4 = 440) {
  return 1200 * Math.log2(freq / mtof(midi, a4));
}

export function noteNameJa(midi) {
  return NOTE_NAME_JA[pitchClass(midi)];
}

// 黒鍵の綴りを調に合わせ、調号と異なる自然音にはナチュラルを付ける。
export function midiToStaff(midi, key) {
  const pc = pitchClass(midi);
  const letter = (KEYS[key].flats ? FLAT_LETTER_BY_PC : LETTER_BY_PC)[pc];
  const octave = Math.floor(midi / 12) - 1;
  const naturalMidi = ((octave + 1) * 12) + NATURAL_PC[letter];
  const keyHasSharp = SHARP_ORDER.slice(0, KEYS[key].sharps).includes(letter);
  const keyHasFlat = FLAT_ORDER.slice(0, KEYS[key].flats || 0).includes(letter);
  const keyMidi = naturalMidi + (keyHasSharp ? 1 : keyHasFlat ? -1 : 0);

  let accidental;
  if (midi === keyMidi) {
    accidental = 'none';
  } else if ((keyHasSharp || keyHasFlat) && midi === naturalMidi) {
    accidental = 'natural';
  } else if (midi === naturalMidi + 1) {
    accidental = 'sharp';
  } else if (midi === naturalMidi - 1) {
    accidental = 'flat';
  } else {
    throw new RangeError('midi は整数の半音単位で指定する必要があります');
  }

  // E4の絶対7音階番号を引けば、E4=0かつ同じletterの1オクターブ差=7になる。
  const diatonic = (octave * 7) + LETTER_INDEX[letter] - ((4 * 7) + LETTER_INDEX.E);
  return {letter, octave, diatonic, accidental};
}

/*
 * ト音記号の♯は慣習的に F5, C5, G5, D5, A4, E5, B4 の順に置く。
 * Texas A&M OER「Steps to Music Theory」4.7の順序・F5起点と、VexFlow
 * src/tables.ts のト音記号配置 [0,1.5,-0.5,1,2.5,0.5,2] を照合した。
 * 第5線を0として下向きを正にした後者は、3番目のGが第5線直上のG5であることも示す。
 * これらをE4=0から上向きに数え直すと 8,5,9,6,3,7,4 になる。
 */
const TREBLE_SHARP_POSITIONS = [
  {letter: 'F', diatonic: 8, accidental: 'sharp'},
  {letter: 'C', diatonic: 5, accidental: 'sharp'},
  {letter: 'G', diatonic: 9, accidental: 'sharp'},
  {letter: 'D', diatonic: 6, accidental: 'sharp'},
  {letter: 'A', diatonic: 3, accidental: 'sharp'},
  {letter: 'E', diatonic: 7, accidental: 'sharp'},
  {letter: 'B', diatonic: 4, accidental: 'sharp'}
];

export function keySignature(key) {
  const positions = KEYS[key].flats ? [
    {letter:'B', diatonic:4, accidental:'flat'},
    {letter:'E', diatonic:7, accidental:'flat'},
    {letter:'A', diatonic:3, accidental:'flat'}
  ].slice(0, KEYS[key].flats) : TREBLE_SHARP_POSITIONS.slice(0, KEYS[key].sharps);
  return positions
    .map(position => ({...position}));
}
export function noteLabel(midi) { return `${midi<60?'低い':midi<72?'普通の':midi<84?'高い':'すごく高い'}${noteNameJa(midi)}`; }
export function scaleMidis(low, high, key='C') {
  const pcs=scalePcs(key);
  return Array.from({length:high-low+1},(_,i)=>low+i).filter(m=>pcs.includes(m%12));
}
