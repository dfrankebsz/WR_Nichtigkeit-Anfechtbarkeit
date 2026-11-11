import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,SOURCE_MC_NUMBERS,CHECKLIST,CATALOG,CHAPTERS,QUESTION_BY_ID} from '../public/course-data.js';
import {buildPdfBytes} from '../public/pdf-export.js';
test('alle originalen MC-Nummern von Seite 3 bis 7 vorhanden',()=>{
 assert.deepEqual(SOURCE_MC_NUMBERS, [20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,58,59,60,61,62]);
 for(const n of SOURCE_MC_NUMBERS)assert.ok(QUESTION_BY_ID[`mc-${n}`]);
});
test('Aufgabenformate, Lehrkapitel, Übungen',()=>{
 assert.ok(QUESTIONS.length>=90);assert.ok(CHECKLIST.length<=10);assert.equal(CHAPTERS.length,5);
 for(const type of ['single','multi','truefalse','match','drag','input','order','free'])assert.ok(QUESTIONS.some(q=>q.type===type),type);
 for(const chapter of CHAPTERS)assert.ok(QUESTIONS.some(q=>q.chapter===chapter.id));
 assert.ok(QUESTIONS.some(q=>q.bonus));assert.ok(CATALOG.length>=8);
});
test('AFB-Verteilung annähernd 25/50/25',()=>{
 for(const [n,target] of [[1,.25],[2,.5],[3,.25]]){const x=QUESTIONS.filter(q=>q.afb===n).length/QUESTIONS.length;assert.ok(Math.abs(x-target)<.05,`${n}: ${x}`);}
});
test('PDF-Export erzeugt gültigen PDF-Header mit Schülerantworten',()=>{
 const answer=QUESTIONS.find(q=>q.type==='free');
 const bytes=buildPdfBytes(QUESTIONS,{answers:{[answer.id]:'Meine ausführliche Erklärung: Bei 50 € liegt ein gültiger Vertrag vor.'},outcomes:{[answer.id]:{complete:true}}},'Klasse FOS12');
 assert.ok(bytes.length>1500);assert.equal(Buffer.from(bytes.slice(0,8)).toString('ascii'),'%PDF-1.4');
 assert.ok(Buffer.from(bytes).toString('latin1').includes('startxref'));
});
