import {CHAPTERS,QUESTIONS,QUESTION_BY_ID,XP_BY_ID,CATALOG,CHECKLIST,SOURCE_MC_NUMBERS} from '../public/course-data.js';
let errors=[];const ids=new Set();
for(const q of QUESTIONS){
 if(ids.has(q.id))errors.push(`Doppelte ID ${q.id}`);ids.add(q.id);
 if(!CHAPTERS.some(c=>c.id===q.chapter&&c.topics.some(t=>t.id===q.topic)))errors.push(`Kapitel/Unterkapitel fehlt: ${q.id}`);
 if(!q.prompt||!q.solution||!q.afb||!q.xp)errors.push(`Fehlende Aufgabe / Lösung: ${q.id}`);
 if(q.type==='single'&&(!Array.isArray(q.options)||!Number.isInteger(q.correct)||!q.options[q.correct]))errors.push(`Ungültige Einfachauswahl ${q.id}`);
 if(q.type==='multi'&&(!Array.isArray(q.options)||!Array.isArray(q.correct)||!q.correct.every(i=>q.options[i])))errors.push(`Ungültige Mehrfachauswahl ${q.id}`);
 if(q.type==='truefalse'&&typeof q.correct!=='boolean')errors.push(`Ungültige Wahr/Falsch-Aufgabe ${q.id}`);
 if(q.type==='input'&&(!Array.isArray(q.accepted)||!q.accepted.length))errors.push(`Fehlende Eingabevarianten ${q.id}`);
 if((q.type==='drag'||q.type==='match')&&(!q.items?.length||!q.items.every(item=>(q.type==='drag'?q.groups:q.options).includes(item.correct))))errors.push(`Ungültige Zuordnung ${q.id}`);
 if(q.type==='order'&&(!q.items?.length||q.correct?.length!==q.items.length))errors.push(`Ungültige Sortierung ${q.id}`);
 if(QUESTION_BY_ID[q.id]!==q||XP_BY_ID[q.id]!==q.xp)errors.push(`Fehler im Index: ${q.id}`);
}
for(const c of CHAPTERS)for(const t of c.topics){const list=QUESTIONS.filter(q=>q.chapter===c.id&&q.topic===t.id);if(!list.length)continue; if(![1,2,3].every(n=>list.some(q=>q.afb===n)))errors.push(`Nicht alle drei AFB in ${c.id}/${t.id}`);}
for(const num of SOURCE_MC_NUMBERS){if(!QUESTIONS.some(q=>q.id===`mc-${num}`))errors.push(`MC-Aufgabe ${num} fehlt`);}
if(CHECKLIST.length>10)errors.push('Zu viele Checklistenpunkte');
const counts=[1,2,3].map(n=>QUESTIONS.filter(q=>q.afb===n).length/QUESTIONS.length);
if(counts.some((x,i)=>Math.abs(x-[.25,.5,.25][i])>.05))errors.push('AFB-Verteilung zu weit vom Ziel entfernt');
if(!CATALOG.some(c=>c.id==='avatar_fox'&&c.cost===0))errors.push('Start-Avatar fehlt');
console.log(`Prüfung: ${QUESTIONS.length} Aufgaben / ${CHAPTERS.length} Kurskapitel / ${CHECKLIST.length} Kompetenzen / ${SOURCE_MC_NUMBERS.length} Aufgaben aus dem MC-Teil.`);
console.log(`AFB: ${counts.map(x=>(100*x).toFixed(1)+'%').join(' · ')}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('Datenprüfung bestanden.');
