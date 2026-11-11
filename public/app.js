import {CHAPTERS,QUESTIONS,QUESTION_BY_ID,GLOSSARY,CHECKLIST,CATALOG} from './course-data.js';
import {downloadPortfolio} from './pdf-export.js';

const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const validViews=new Set(['home','glossary','shop','teacher','account',...CHAPTERS.map(c=>c.id)]);
const defaultP=()=>({answers:{},outcomes:{},checklist:{},inventory:['avatar_fox'],equipped:{avatar:'avatar_fox',outfit:null,pet:null},spent:0,revision:0});
function getLocal(){try{const p=JSON.parse(localStorage.getItem('rq-guest-v1')||'null');return p&&typeof p==='object'?{...defaultP(),...p}:defaultP();}catch{return defaultP();}}
const state={view:validViews.has(location.hash.slice(1))?location.hash.slice(1):'home',p:getLocal(),user:null,token:localStorage.getItem('rq-session-v1')||null,pending:{answers:{},outcomes:{},checklist:{}},saveTimer:null,saving:false,solutionShown:new Set(),feedback:{},activeSolution:null,shopFilter:'all',pickedDrag:null,authRole:'student',authMode:'login',teacherRows:null,teacherDetail:null,teacherDetailName:null,teacherPassword:null,teacherAction:null,backendStatus:null};
const iconLabels={single:'Eine Antwort',multi:'Mehrfachauswahl',truefalse:'Richtig oder falsch',free:'Erklären und vergleichen',input:'Kurzantwort',match:'Zuordnung',drag:'Drag & Drop',order:'Reihenfolge'};
const achievements=[{name:'Erste Schritte',icon:'🌱',threshold:24},{name:'Fallspürnase',icon:'🕵️',threshold:230},{name:'Paragraphen-Profi',icon:'⚖️',threshold:650},{name:'Argumentationskunst',icon:'🧠',threshold:1250},{name:'RechtQuest-Champion',icon:'🏆',threshold:2200},{name:'Legendenstatus',icon:'🌟',threshold:3400}];
function metrics(){let total=0,done=0;for(const q of QUESTIONS)if(state.p.outcomes?.[q.id]?.complete){total+=q.xp;done++;}return {total,done,wallet:Math.max(0,total-(state.p.spent||0))};}
function chapterStats(chapterId){const qs=QUESTIONS.filter(q=>q.chapter===chapterId),completed=qs.filter(q=>state.p.outcomes?.[q.id]?.complete).length;return {total:qs.length,done:completed,pct:qs.length?Math.round(completed/qs.length*100):0};}
function currentAvatar(){const eq=state.p.equipped||{},ava=CATALOG.find(c=>c.id===eq.avatar)||CATALOG[0],pet=CATALOG.find(c=>c.id===eq.pet),outfit=CATALOG.find(c=>c.id===eq.outfit);return {ava,pet,outfit};}
function toast(message,type='good'){const el=document.createElement('div');el.className='toast '+(type==='warn'?'warn':'good');el.textContent=message;$('toastArea').append(el);setTimeout(()=>el.remove(),3800);}
function statusLabel(text,kind='good'){const el=$('saveState');el.replaceChildren();const dot=document.createElement('span');dot.className='signal';if(kind==='warn')dot.style.background='#efa63b';if(kind==='error')dot.style.background='#e85a65';el.append(dot,document.createTextNode(' '+text));}
function go(view){if(!validViews.has(view))return;state.view=view;history.replaceState(null,'','#'+view);state.pickedDrag=null;closeMenu();render();scrollTo({top:0,behavior:'smooth'});if(view==='teacher'&&state.user?.role==='teacher')loadTeacher();}
function closeMenu(){$('sidebar').classList.remove('open');$('overlay').classList.remove('visible');$('overlay').hidden=true;}
function renderNav(){
 $('navChapters').innerHTML=`<button class="nav-link ${state.view==='home'?'active':''}" data-nav="home"><span class="nav-icon">🏠</span><span class="nav-copy"><strong>Übersicht</strong><small>Ihr Startpunkt</small></span></button>`+CHAPTERS.map(c=>{const s=chapterStats(c.id);return `<button class="nav-link ${state.view===c.id?'active':''}" data-nav="${c.id}"><span class="nav-icon">${c.icon}</span><span class="nav-copy"><strong>${esc(c.name)}</strong><small>${s.done} / ${s.total} Aufgaben</small></span><span class="nav-check">${s.pct===100?'✓':''}</span></button>`;}).join('');
 const extra=[['glossary','📚','Begriffslexikon'],['shop','🛍️','XP-Shop & Avatar'],['account','👤','Mein Profil'],['teacher','👩‍🏫','Lehrerbereich']];
 $('navExtras').innerHTML=extra.map(([id,i,text])=>`<button data-nav="${id}" class="nav-link ${state.view===id?'active':''}"><span class="nav-icon">${i}</span><span class="nav-copy"><strong>${text}</strong></span></button>`).join('');
 $('sidebarCard').innerHTML=`<div class="mini-top">✦ IHR QUEST-STATUS</div><strong>${metrics().total} XP gesammelt</strong><div class="progress-track"><div class="progress-fill" id="sidebarFill"></div></div><p>${metrics().done} von ${QUESTIONS.length} Lernaufgaben abgeschlossen</p><button data-nav="shop">Belohnungen entdecken</button>`;
 const f=$('sidebarFill');f.style.width=Math.min(100,metrics().done/QUESTIONS.length*100)+'%';
}
function header(){const title=CHAPTERS.find(c=>c.id===state.view)?.name||{home:'Lernübersicht',shop:'XP-Shop & Avatar',teacher:'Lehrerbereich',account:'Mein Profil',glossary:'Begriffslexikon'}[state.view];$('breadcrumbs').textContent=title||'RechtQuest';$('totalXP').textContent=metrics().total.toLocaleString('de-DE');$('miniAvatar').textContent=currentAvatar().ava.icon;statusLabel(state.user?`Konto · ${state.user.className}`:'Gastmodus · lokal');}
function render(){renderNav();header();const container=$('mainContent');if(state.view==='home')container.innerHTML=homeHtml();else if(CHAPTERS.some(c=>c.id===state.view))container.innerHTML=chapterHtml(CHAPTERS.find(c=>c.id===state.view));else if(state.view==='glossary')container.innerHTML=glossaryHtml();else if(state.view==='shop')container.innerHTML=shopHtml();else if(state.view==='teacher')container.innerHTML=teacherHtml();else container.innerHTML=accountHtml();attachVisuals();}
function homeHtml(){const m=metrics();return `
 <section class="hero"><div class="hero-copy"><span class="hero-tag">✦ INTERAKTIVER RECHTSKURS</span><h1>Ein Vertrag.<br><em>Viele Möglichkeiten.</em></h1><p>Entscheiden Sie, ob ein Rechtsgeschäft wirksam, nichtig oder anfechtbar ist. Lösen Sie reale Fallkonstellationen, sammeln Sie XP und gestalten Sie Ihren eigenen Avatar.</p><div class="hero-actions"><button class="btn btn-primary" data-nav="start">Lernpfad beginnen →</button><button class="btn btn-outline" data-action="open-auth">${state.user?'Konto ansehen':'Mit Konto lernen'}</button></div></div><img class="hero-art" src="/assets/hero.svg" alt="Illustration eines Prüfungsbogens, einer Grafik, eines Häkchens und eines Fuchs-Avatars"></section>
 <div class="stats-grid"><div class="stat-card"><div class="stat-icon">🎯</div><div><strong>${m.done}/${QUESTIONS.length}</strong><small>Aufgaben abgeschlossen</small></div></div><div class="stat-card"><div class="stat-icon">⚡</div><div><strong>${m.total}</strong><small>Gesammelte XP</small></div></div><div class="stat-card"><div class="stat-icon">🛍️</div><div><strong>${m.wallet}</strong><small>Verfügbare XP</small></div></div></div>
 <div class="section-label"><h2>Ihre Kapitel</h2><small>Wählen Sie Ihren nächsten Schritt</small></div><div class="chapter-cards">${CHAPTERS.map(c=>{const s=chapterStats(c.id);return `<button class="chapter-card" data-nav="${c.id}"><div class="top"><span class="symbol">${c.icon}</span><span class="number">KAPITEL ${c.number}</span></div><h3>${c.name}</h3><p>${esc(c.subtitle)}</p><div class="progress-track"><div class="progress-fill" data-width="${s.pct}"></div></div><div class="pct">${s.pct}% abgeschlossen</div></button>`;}).join('')}</div>
 <div class="section-label"><h2>Ihr roter Faden</h2></div><section class="narrative"><div><div class="eyebrow">FALLAKTE 01 · CAFÉ NOVA</div><h3>Der gebrauchte Lieferroller</h3><p>Das Café Nova kauft für den Lieferdienst einen gebrauchten Roller. Die Verkäuferin versichert ausdrücklich, er sei unfallfrei. Später entdeckt die Werkstatt einen reparierten Unfallschaden. Die Verkäuferin wusste davon.</p><p>Ist der Vertrag nichtig? Kann Café Nova anfechten? Und welche Bedeutung hat ein versehentlich falsch eingetragener Preis? Dieselbe Fallakte begleitet Sie durch den Kurs.</p><button class="btn btn-outline btn-sm" data-nav="start">Mit dem Fall starten</button></div><div class="chat-thread"><div class="chat-bubble right">„Der Roller ist unfallfrei. Alles geprüft.“</div><div class="chat-bubble">„Unsere Werkstatt hat eine Unfallreparatur entdeckt. War Ihnen das bekannt?“</div><div class="chat-bubble right">„Das war nur ein kleiner Schaden ...“</div><div class="chat-bubble">„Dann prüfen wir die rechtliche Wirkung.“</div></div></section>
 <div class="quest-banner"><span class="big">📄</span><div><strong>Ihr persönliches Lernportfolio</strong><p>Alle bereits bearbeiteten Aufgaben mit Ihren eigenen Antworten als zusammenhängendes PDF.</p><button data-action="pdf" class="btn btn-sm btn-dark">PDF erstellen</button></div></div>`;}
function chapterHtml(c){const stat=chapterStats(c.id);let number=0;const index=CHAPTERS.findIndex(x=>x.id===c.id);const next=CHAPTERS[index+1];return `<div class="eyebrow">KAPITEL ${c.number} · LERNQUEST</div><div class="chapter-head"><div><h1 class="page-title">${c.name}</h1><p class="lead">${esc(c.subtitle)}</p></div><div class="chapter-icon">${c.icon}</div></div><div class="summary-strip"><div class="summary-chip"><b>${stat.done}/${stat.total}</b>Aufgaben</div><div class="summary-chip"><b>${stat.pct}%</b>Fortschritt</div><div class="summary-chip"><b>${QUESTIONS.filter(q=>q.chapter===c.id&&q.bonus).length}</b>Bonusaufgaben</div></div>${c.id==='start'?`<div class="quest-banner"><span class="big">🛵</span><div><strong>Leitfall „Café Nova“</strong><p>Ein gebrauchter Lieferroller wird als unfallfrei verkauft. Während des Kurses prüfen Sie, wann Nichtigkeit oder Anfechtbarkeit vorliegt.</p></div></div>`:''}${c.id==='void'?`<div class="quest-banner"><span class="big">📨</span><div><strong>Wieder bei Café Nova</strong><p>Die Werkstatt meldet einen bekannten Unfallschaden. Entscheidend wird jetzt, ob eine arglistige Täuschung vorliegt und die Anfechtung erklärt wird.</p></div></div>`:''}${c.topics.map(topic=>{const qs=QUESTIONS.filter(q=>q.chapter===c.id&&q.topic===topic.id);return `<section class="topic" id="topic-${topic.id}"><div class="topic-top"><div class="topic-icon">${topic.icon}</div><h2>${esc(topic.title)}</h2></div><div class="lesson">${topic.body}</div>${visualHtml(topic.visual)}${qs.length?`<p class="question-count">📝 ${qs.length} Aufgaben · Antworten prüfen und XP sammeln</p><div class="question-list">${qs.map(q=>questionHtml(q,++number)).join('')}</div>`:''}${topic.id==='self'?checklistHtml():''}</section>`}).join('')}<div class="lesson-finish"><div><strong>${stat.pct===100?'Kapitel vollständig bearbeitet!':'Sie bestimmen Ihren Lernweg.'}</strong><p>Jede abgeschlossene Aufgabe bringt Ihnen XP. Nutzen Sie Lösungen bewusst zum Vergleichen.</p></div><button class="btn btn-primary" data-nav="${next?.id||'shop'}">${next?'Nächstes Kapitel →':'Zur Belohnungsgalerie →'}</button></div>`;}
function questionHtml(q,index){
 const p=state.p,answer=p.answers?.[q.id],done=p.outcomes?.[q.id]?.complete,feedback=state.feedback[q.id],revealed=state.solutionShown.has(q.id);
 const kind=iconLabels[q.type]||'Aufgabe';
 let input='';
 if(q.type==='single'||q.type==='multi'||q.type==='truefalse'){
  const opts=q.type==='truefalse'?['Richtig','Falsch']:q.options;
  input=`<div class="option-list">${opts.map((op,i)=>{const val=q.type==='truefalse'?i===0:i;const selected=q.type==='multi'?(Array.isArray(answer)&&answer.includes(i)):answer===val;return `<button type="button" class="option ${q.type} ${selected?'selected':''}" data-choice="${i}" data-q="${q.id}" aria-pressed="${selected?'true':'false'}"><span class="choice-icon">${selected?'✓':''}</span><span>${esc(op)}</span></button>`;}).join('')}</div>`;
 }else if(q.type==='free')input=`<textarea data-free="${q.id}" class="free-input" aria-label="Ihre Begründung zur Aufgabe" placeholder="Schreiben Sie hier Ihre eigene Erklärung oder rechtliche Beurteilung …">${esc(answer||'')}</textarea>`;
 else if(q.type==='input')input=`<input class="short-input" data-short="${q.id}" aria-label="Ihre Kurzantwort" type="text" value="${esc(answer||'')}" placeholder="Geben Sie Ihre Antwort ein">`;
 else if(q.type==='match')input=matchHtml(q,answer);
 else if(q.type==='drag')input=dragHtml(q,answer);
 else if(q.type==='order')input=orderHtml(q,answer);
 const checkButton=q.type==='free'?`<button class="btn btn-primary btn-sm" data-action="solution" data-q="${q.id}">Mit Musterlösung vergleichen</button>`:`<button class="btn btn-primary btn-sm" data-action="check" data-q="${q.id}">Antwort prüfen</button>`;
 return `<article id="q-${q.id}" data-number="${index}" class="question ${done?'completed':''} ${q.bonus?'bonus':''}"><div class="question-top"><div class="q-label"><span class="q-no">${index}</span>${esc(kind)}</div><div class="q-pills"><span class="q-pill">AFB ${q.afb}</span>${q.bonus?'<span class="q-pill bonus-tag">✦ Bonus</span>':''}${done?'<span class="q-pill done">✓ Erledigt</span>':''}</div></div><h3>${esc(q.prompt)}</h3>${input}<div class="question-actions">${checkButton}<span class="q-pill">+${q.xp} XP</span><button class="solution-link" data-action="solution" data-q="${q.id}">💡 Musterlösung</button></div>${feedback?`<div class="feedback ${feedback.kind}">${esc(feedback.text)}</div>`:''}${revealed?`<div class="solution-box"><strong>💡 Musterlösung und Begründung</strong>${esc(q.solution)}${q.type==='free'?`<div class="self-judge"><button class="btn btn-sm btn-mint" data-action="self-yes" data-q="${q.id}">✓ Meine Antwort stimmt</button><button class="btn btn-sm btn-outline" data-action="self-edit" data-q="${q.id}">Noch einmal überarbeiten</button></div>`:''}</div>`:''}</article>`;
}
function matchHtml(q,a){const answers=a&&typeof a==='object'?a:{};return `<div class="match-list">${q.items.map((item,i)=>{const id=item.id||item.label;return `<div class="match-line"><label for="match-${q.id}-${i}">${esc(item.label)}</label><select id="match-${q.id}-${i}" data-match="${q.id}" data-item="${esc(id)}"><option value="">Bitte zuordnen</option>${q.options.map(op=>`<option value="${esc(op)}" ${answers[id]===op?'selected':''}>${esc(op)}</option>`).join('')}</select></div>`;}).join('')}</div>`;}
function dragHtml(q,a){const assigned=a&&typeof a==='object'?a:{},itemHtml=item=>`<button type="button" draggable="true" data-draggable="${item.id}" data-q="${q.id}" class="draggable ${state.pickedDrag?.id===item.id&&state.pickedDrag?.qid===q.id?'picked':''}" title="Ziehen oder antippen">☰ ${esc(item.label)}</button>`;return `<div class="drop-layout"><div class="drag-pool" data-drop="" data-q="${q.id}" role="group" aria-label="Nicht zugeordnete Karten"><b>📦 Kartenstapel</b><div>${q.items.filter(item=>!assigned[item.id]).map(itemHtml).join('')||'<span class="muted">Alle Karten zugeordnet</span>'}</div></div><div class="drop-grid">${q.groups.map(group=>`<div class="drop-target" data-drop="${esc(group)}" data-q="${q.id}" role="group" tabindex="0" aria-label="Ablage: ${esc(group)}"><b>${esc(group)}</b><div>${q.items.filter(item=>assigned[item.id]===group).map(itemHtml).join('')||'<span class="muted">Hier ablegen</span>'}</div></div>`).join('')}</div><p class="drag-help">Ziehen Sie Karten in die Felder. Auf dem Handy: zuerst Karte antippen, dann Zielfeld antippen. Zum Zurücklegen den Kartenstapel wählen.</p></div>`;}
function orderHtml(q,a){const ids=Array.isArray(a)&&a.length===q.items.length?a:q.items.map(i=>i.id).reverse();return `<div class="order-list">${ids.map((id,i)=>{const item=q.items.find(x=>x.id===id);return `<div class="order-line" draggable="true" data-order-drag="${esc(id)}" data-q="${q.id}"><span class="seq">${i+1}.</span><span class="order-name">${esc(item?.label||id)}</span><span class="order-controls"><button type="button" data-order-up="${q.id}" data-index="${i}" aria-label="Nach oben">↑</button><button type="button" data-order-down="${q.id}" data-index="${i}" aria-label="Nach unten">↓</button></span></div>`;}).join('')}</div>`;}
function visualHtml(type){if(!type)return '';
 const wrap=content=>`<div class="visual-card"><div class="visual-title">Interaktives Schaubild / Überblick</div>${content}</div>`;
 if(type==='contract')return wrap(`<div class="flow-nodes"><div class="flow-node">🤝 Angebot</div><div class="flow-arrow">＋</div><div class="flow-node">✅ Annahme</div><div class="flow-arrow">→</div><div class="flow-node good">📄 Vertrag</div></div><p class="visual-note">Das Einverständnis muss grundsätzlich den wesentlichen Inhalt des Angebots treffen.</p>`);
 if(type==='decision')return wrap(`<div class="flow-nodes"><button class="flow-node" data-action="flow-tip" data-tip="1">1. Zustandekommen</button><div class="flow-arrow">→</div><button class="flow-node bad" data-action="flow-tip" data-tip="2">2. Nichtigkeit?</button><div class="flow-arrow">→</div><button class="flow-node good" data-action="flow-tip" data-tip="3">3. Anfechtbarkeit?</button></div><p class="visual-note" id="flowTip">Tippen Sie einen Prüfschritt an, um seine Bedeutung zu lesen.</p>`);
 if(type==='reasons')return wrap(`<div class="diagram-grid">${[['⛔','Gesetzliches Verbot','§ 134'],['⚖️','Sittenwidrigkeit','§ 138'],['🧒','Geschäftsunfähigkeit','§ 105'],['📝','Formmangel','§ 125'],['🎭','Scherzgeschäft','§ 118'],['🎟️','Scheingeschäft','§ 117']].map(([emoji,title,para])=>`<div class="diagram-pill"><i>${emoji}</i><span><strong>${title}</strong><br><small>${para} BGB</small></span></div>`).join('')}</div>`);
 if(type==='age')return wrap(`<div class="slider-head"><span>Lebensalter einstellen</span><strong><span id="age-number">16</span> Jahre</strong></div><input type="range" min="0" max="18" step="1" value="16" id="age-slider" class="slider-control" aria-label="Lebensalter einstellen"><div class="slider-result" id="age-result">🟠 Beschränkt geschäftsfähig (7–17)</div><p class="visual-note">Die Wirksamkeit eines konkreten Vertrags hängt zusätzlich unter anderem von seinem rechtlichen Vorteil und der Zustimmung gesetzlicher Vertreter ab (§§ 107–110 BGB). Mit 18 Jahren ist eine Person im Regelfall voll geschäftsfähig.</p>`);
 if(type==='balance')return wrap(`<div class="slider-head"><span>Vergleichspreis einer Leistung: 100 €</span><strong>Verlangter Preis: <span id="price-number">200</span> €</strong></div><input type="range" id="price-slider" class="slider-control" min="100" max="900" step="50" value="200" aria-label="Verlangten Preis verändern"><div class="slider-result" id="price-result">Verhältnis: 2,0-facher Preis</div><p class="visual-note"><strong>Keine automatische Wuchergrenze:</strong> Auch bei starkem Preisunterschied müssen unter anderem Marktvergleich, besondere Lage und Ausnutzung geprüft werden (§ 138 BGB).</p>`);
 if(type==='timeline')return wrap(`<div class="timeline-flow"><div>📝 <b>Vertrag</b>zunächst wirksam</div><span class="flow-arrow">→</span><div>🔎 <b>Grund</b>§ 119 / § 123 BGB</div><span class="flow-arrow">→</span><div>📨 <b>Anfechtung</b>erklären und Frist beachten</div><span class="flow-arrow">→</span><div>↩️ <b>Rechtsfolge</b>§ 142 BGB</div></div>`);
 if(type==='compare')return wrap(`<div class="compare-grid"><div class="compare-box"><strong>🔬 Sacheigenschaft</strong><p>Die Perlen sind anders beschaffen als beim Kauf angenommen. Ein Eigenschaftsirrtum kann vorliegen.</p></div><div class="compare-box"><strong>📈 Erwartung an die Zukunft</strong><p>Ein späterer Wertanstieg bleibt aus. Diese enttäuschte Hoffnung ist grundsätzlich Motivirrtum.</p></div></div>`);
 if(type==='paper')return wrap(`<div class="diagram-grid"><div class="diagram-pill"><i>🏠</i><span><strong>Grundstück</strong><br>Notarielle Beurkundung</span></div><div class="diagram-pill"><i>✍️</i><span><strong>Eigenhändiges Testament</strong><br>Handschrift + Unterschrift</span></div><div class="diagram-pill"><i>💻</i><span><strong>Normaler Laptopkauf</strong><br>Grundsätzlich formfrei</span></div><div class="diagram-pill"><i>⚠️</i><span><strong>Formmangel</strong><br>Grundsätzlich nichtig (§ 125)</span></div></div>`);
 const groups={masks:[['🎭','Scherzgeschäft','§ 118'],['🎟️','Scheingeschäft','§ 117']],message:[['⌨️','Selbst vertippt','§ 119 Abs. 1'],['📨','Durch Boten falsch übermittelt','§ 120']],fraud:[['💬','Wissentlich falsch','Täuschung'],['🕵️','Bewusst verschwiegen','Täuschung']],shield:[['🛡️','Zulässiges Mittel','Nicht automatisch widerrechtlich'],['⛔','Rechtswidriges Übel','§ 123']],mc:[['🎯','Entscheiden','Antwort auswählen'],['🔎','Prüfen','Ergebnis erklären']],test:[['🧠','Wissen anwenden','Selbstständig prüfen'],['🏆','XP verdienen','Kompetenz zeigen']]};
 return wrap(`<div class="diagram-grid">${(groups[type]||[['📚','Fachbegriff','Prüfen'],['✅','Rechtsfolge','Begründen']]).map(([i,t,b])=>`<div class="diagram-pill"><i>${i}</i><span><strong>${t}</strong><br><small>${b}</small></span></div>`).join('')}</div>`);
}
function glossaryHtml(){return `<div class="eyebrow">WISSEN NACH SCHLAGEN</div><h1 class="page-title">Begriffslexikon 📚</h1><p class="lead">Die wichtigsten Begriffe von Angebot und Annahme bis zur widerrechtlichen Drohung – verständlich und auf einen Blick.</p><input id="lexSearch" class="lex-search" type="search" placeholder="Begriff suchen …" aria-label="Glossar durchsuchen"><div class="lex-list" id="lexList">${GLOSSARY.map(([term,text])=>`<div class="lex-entry" data-term="${esc((term+' '+text).toLocaleLowerCase('de-DE'))}"><strong>${esc(term)}</strong><p>${esc(text)}</p></div>`).join('')}</div><div class="quest-banner"><span class="big">⚖️</span><div><strong>Gesetzestexte zum Nachschlagen</strong><p>Prüfen Sie einzelne Paragrafen direkt beim Bundesministerium der Justiz.</p><a href="https://www.gesetze-im-internet.de/bgb/" target="_blank" rel="noopener noreferrer">BGB öffnen</a></div></div>`;}
function shopHtml(){const m=metrics(),av=currentAvatar();return `<div class="eyebrow">✦ XP-BELOHNUNGEN</div><h1 class="page-title">Die Avatar-Galerie</h1><p class="lead">Investieren Sie gesammelte XP in Avatare, Outfits und Haustiere. Ihre Auswahl erscheint anschließend dauerhaft in Ihrem Profil. XP bleiben als Gesamterfahrung sichtbar; ausgegebene XP verringern nur das verfügbare Guthaben.</p><section class="shop-hero"><div><div class="summary-strip"><div class="summary-chip"><b>${m.wallet}</b>XP zum Ausgeben</div><div class="summary-chip"><b>${m.total}</b>XP insgesamt</div><div class="summary-chip"><b>${state.p.inventory?.length||1}</b>Freigeschaltet</div></div><div class="quest-banner"><span class="big">🦊</span><div><strong>Ihr persönlicher Quest-Begleiter</strong><p>Wählen Sie neue Looks und Haustiere aus der Galerie. Freigeschaltete Gegenstände können Sie kostenlos wechseln.</p></div></div></div><div class="avatar-showcase"><div class="name">Ihr Avatar</div><span class="character" aria-label="Ausgewählter Avatar">${av.ava.icon}</span>${av.outfit?`<span class="outfit">${av.outfit.icon}</span>`:''}${av.pet?`<span class="pet">${av.pet.icon}</span>`:''}<div><strong>${esc(av.ava.name)}</strong>${av.pet?` · mit ${esc(av.pet.name)}`:''}</div></div></section><div class="section-label"><h2>XP-Shop</h2><small>Freischalten, ansehen, ausrüsten</small></div><div class="shop-tabs">${[['all','Alle'],['avatar','Avatare'],['outfit','Outfits'],['pet','Haustiere']].map(([id,title])=>`<button class="shop-filter ${state.shopFilter===id?'active':''}" data-shop-filter="${id}">${title}</button>`).join('')}</div><div class="shop-grid">${CATALOG.filter(c=>state.shopFilter==='all'||state.shopFilter===c.type).map(c=>{
 const owned=state.p.inventory?.includes(c.id)||c.cost===0,equipped=state.p.equipped?.[c.type]===c.id,afford=m.wallet>=c.cost;
 return `<article class="shop-card"><span class="item-icon">${c.icon}</span><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><div class="cost">${c.cost===0?'Kostenlos':`✦ ${c.cost} XP`}</div>${equipped?`<button class="btn btn-mint btn-sm" disabled>✓ Ausgerüstet</button>`:owned?`<button class="btn btn-primary btn-sm" data-action="equip" data-item="${c.id}">Ausrüsten</button>`:`<button class="btn btn-outline btn-sm" data-action="buy" data-item="${c.id}" ${!afford?'disabled':''}>${afford?'Freischalten':'Noch XP sammeln'}</button>`}</article>`;}).join('')}</div><div class="section-label"><h2>Ihre Meilensteine</h2></div><div class="achievement-list">${achievements.map(a=>`<div class="achievement ${m.total>=a.threshold?'':'locked'}"><span class="icon">${a.icon}</span><strong>${a.name}</strong><small>${m.total>=a.threshold?'✓ Freigeschaltet':`${a.threshold} XP erforderlich`}</small></div>`).join('')}</div><div class="section-label"><h2>Ausrüstung ändern</h2></div><div class="summary-strip">${av.outfit?`<button class="btn btn-outline btn-sm" data-action="unequip" data-type="outfit">Outfit ablegen</button>`:''}${av.pet?`<button class="btn btn-outline btn-sm" data-action="unequip" data-type="pet">Haustier abwählen</button>`:''}</div>`;}
function checklistHtml(){const items=CHECKLIST.map((text,i)=>({text,i,status:state.p.checklist?.[i]||{rating:3,done:false}}));const outstanding=items.filter(x=>!x.status.done),done=items.filter(x=>x.status.done);const entry=x=>`<div class="check-entry" data-check-entry="${x.i}"><label for="rate-${x.i}">${esc(x.text)}</label><select id="rate-${x.i}" data-rating="${x.i}" aria-label="Selbsteinschätzung Kompetenz ${x.i+1}">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(x.status.rating)===n?'selected':''}>${n} – ${['noch unsicher','eher unsicher','teils sicher','sicher','sehr sicher'][n-1]}</option>`).join('')}</select><button class="check-toggle" data-check-toggle="${x.i}">${x.status.done?'↶ Zurücksetzen':'✓ Erledigt'}</button></div>`;
 return `<div id="checklistWrap"><div class="checklist-panel"><h3>Noch offen (${outstanding.length})</h3>${outstanding.length?outstanding.map(entry).join(''):'<p class="muted">Sie haben alle Kompetenzen markiert. Ihre Selbsteinschätzungen können jederzeit geändert werden.</p>'}</div><div class="checklist-panel done-items"><h3>Erledigt (${done.length})</h3>${done.length?done.map(entry).join(''):'<p class="muted">Abgehakte Kompetenzen erscheinen hier.</p>'}</div></div>`;}
function accountHtml(){return `<div class="eyebrow">KONTO & LERNPORTFOLIO</div><h1 class="page-title">Mein Profil 👤</h1><p class="lead">Arbeiten Sie ohne Anmeldung lokal oder melden Sie sich mit Nickname, Passwort und Klasse an. Mit einem Konto kann der Lernstand auf einem anderen Gerät fortgeführt werden.</p><div class="narrative"><div><h3>${state.user?`Angemeldet als ${esc(state.user.nickname)}`:'Gastmodus'}</h3><p>${state.user?`Klasse: <strong>${esc(state.user.className)}</strong><br>Rolle: <strong>${state.user.role==='teacher'?'Lehrkraft':'Lernende'}</strong>`:'Sie können alle Aufgaben auch ohne Konto bearbeiten. Ein Gast-Lernstand wird nur in diesem Browser gespeichert und nicht geräteübergreifend übertragen.'}</p><div class="summary-strip"><div class="summary-chip"><b>${metrics().done}</b>Erledigte Aufgaben</div><div class="summary-chip"><b>${metrics().total}</b>XP gesammelt</div></div>${state.user?`<button class="btn btn-outline" data-action="logout">Abmelden</button>`:`<button class="btn btn-primary" data-action="open-auth">Anmelden oder registrieren</button>`}</div><div><div class="avatar-showcase"><div class="name">Ihr Begleiter</div><span class="character">${currentAvatar().ava.icon}</span>${currentAvatar().pet?`<span class="pet">${currentAvatar().pet.icon}</span>`:''}</div><button class="btn btn-outline btn-sm btn-full" data-nav="shop">Galerie öffnen</button></div></div><div class="quest-banner"><span class="big">📄</span><div><strong>Alle Ihre bisher beantworteten Aufgaben als PDF</strong><p>Ihr Lernportfolio enthält die Fragen, Ihre ursprünglichen Antworten und den Bearbeitungsstand. Musterlösungen sind nicht Bestandteil des Lernportfolios.</p><button class="btn btn-dark" data-action="pdf">Lernportfolio als PDF erstellen</button></div></div>${state.user?`<section class="lesson"><h3>Passwort ändern</h3><p>Ihr neues Passwort gilt nach Änderung für Ihre zukünftigen Anmeldungen. Andere Geräte müssen sich erneut anmelden.</p><form id="changePasswordForm"><label for="oldPass">Aktuelles Passwort</label><input class="short-input" id="oldPass" type="password" autocomplete="current-password" required minlength="8"><div class="divider-space"></div><label for="newPass">Neues Passwort</label><input class="short-input" id="newPass" type="password" autocomplete="new-password" required minlength="8"><div class="divider-space"></div><button class="btn btn-primary" type="submit">Passwort ändern</button></form></section>`:''}<div class="quest-banner"><span class="big">🔒</span><div><strong>Datenschutz im Klassenraum</strong><p>Verwenden Sie einen nicht identifizierenden Nickname. Lehrkräfte sehen in ihrer Klasse Lernstände und selbst eingegebene Antworten. Vermeiden Sie in Freitextfeldern personenbezogene Angaben zu Dritten.</p></div></div>`;}
function teacherHtml(){if(state.user?.role!=='teacher')return `<div class="eyebrow">KURSVERWALTUNG</div><h1 class="page-title">Lehrerbereich 👩‍🏫</h1><p class="lead">Hier können Lehrkräfte den Lernfortschritt der eigenen Klasse einsehen, Passwörter von Lernenden zurücksetzen, Nutzer entfernen und die Fortschritte der gesamten Klasse löschen.</p><div class="quest-banner"><span class="big">🔐</span><div><strong>Geschützter Zugang</strong><p>Registrieren Sie ein Lehrkraftkonto mit dem Lehrer-Code aus den Netlify-Umgebungsvariablen. Bei jeder Anmeldung müssen Sie auch die Klasse angeben.</p><button class="btn btn-primary" data-action="teacher-auth">Zum Lehrer-Login</button></div></div>`;
 const rows=state.teacherRows;return `<div class="eyebrow">GESCHÜTZT · KLASSE ${esc(state.user.className)}</div><h1 class="page-title">Lehrer-Dashboard</h1><p class="lead">Lernende sind ausschließlich ihrer bei der Registrierung angegebenen Klasse zugeordnet. Die Übersicht zeigt Aufgabenfortschritt und XP. Detailansichten enthalten die eingegebenen Antworten.</p>${rows?`<div class="teacher-stats"><div class="summary-chip"><b>${rows.length}</b>Lernende</div><div class="summary-chip"><b>${rows.length?Math.round(rows.reduce((n,u)=>n+u.metrics.completed/QUESTIONS.length*100,0)/rows.length):0}%</b>Ø Fortschritt</div><div class="summary-chip"><b>${rows.reduce((n,u)=>n+u.metrics.totalXP,0)}</b>XP insgesamt</div></div>`:''}<div class="teacher-toolbar"><button class="btn btn-outline" data-action="teacher-reload">↻ Aktualisieren</button><button class="btn btn-outline" data-action="teacher-csv">CSV exportieren</button><button class="btn btn-danger" data-action="teacher-reset-all">Alle Lernstände löschen</button></div>${!rows?'<div class="empty"><span class="emoji">🔎</span>Klassenübersicht wird geladen ...</div>':rows.length===0?'<div class="empty"><span class="emoji">📚</span>In dieser Klasse sind noch keine Lernenden registriert.</div>':`<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr><th>Nickname</th><th>Fortschritt</th><th>Gesamt-XP</th><th>Aktionen</th></tr></thead><tbody>${rows.map(u=>`<tr><td><strong>${esc(u.nickname)}</strong></td><td>${u.metrics.completed}/${QUESTIONS.length} Aufgaben (${Math.round(u.metrics.completed/QUESTIONS.length*100)} %)</td><td>${u.metrics.totalXP}</td><td><button class="btn btn-outline btn-sm" data-action="teacher-detail" data-key="${esc(u.key)}">Details</button><button class="btn btn-outline btn-sm" data-action="teacher-password" data-key="${esc(u.key)}">Passwort</button><button class="btn btn-danger btn-sm" data-action="teacher-remove" data-key="${esc(u.key)}">Entfernen</button></td></tr>`).join('')}</tbody></table></div>`}${state.teacherPassword?`<div class="quest-banner" id="tempPassword"><span class="big">🔐</span><div><strong>Neues Passwort für ${esc(state.teacherPassword.nick)}</strong><p>Dieses Passwort wird nur hier angezeigt. Teilen Sie es der betreffenden Person sicher mit und lassen Sie es anschließend ändern.</p><code id="tempPassText">${esc(state.teacherPassword.password)}</code><div class="teacher-toolbar"><button class="btn btn-dark btn-sm" data-action="copy-password">Passwort kopieren</button><button class="btn btn-outline btn-sm" data-action="hide-password">Anzeige schließen</button></div></div></div>`:''}<div id="teacherDetailArea">${state.teacherDetail?teacherDetailHtml():''}</div><div class="quest-banner"><span class="big">🛡️</span><div><strong>Verwaltungsrechte gelten nur für Ihre Klasse.</strong><p>Das Löschen aller Lernstände ist unwiderruflich. Nutzerkonten bleiben bei der Komplettlöschung bestehen. Das Entfernen einer einzelnen Person löscht dagegen auch deren Konto.</p></div></div>`;}
function readableAnswer(q,ans){if(ans===undefined||ans===null)return '—';if(q.type==='single')return q.options?.[ans]||'—';if(q.type==='multi')return (ans||[]).map(i=>q.options?.[i]).join('; ');if(q.type==='truefalse')return ans?'Richtig':'Falsch';if(q.type==='order')return (ans||[]).map(id=>q.items.find(x=>x.id===id)?.label).join(' → ');if(q.type==='match'||q.type==='drag')return q.items.map(i=>`${i.label}: ${ans[i.id||i.label]||'offen'}`).join(' | ');return String(ans);}
function teacherDetailHtml(){const p=state.teacherDetail,m=metricsFor(p);const answered=QUESTIONS.filter(q=>p.answers?.[q.id]!==undefined||p.outcomes?.[q.id]?.complete);return `<div class="teacher-detail"><h3>Einzelansicht: ${esc(state.teacherDetailName)} (${m.completed}/${QUESTIONS.length} abgeschlossen)</h3><p class="muted">Eingegebene Antworten werden nur für Ihre Klasse angezeigt. Die Musterlösung ist über die Aufgabenkapitel zugänglich.</p>${answered.length?`<div class="teacher-table-wrap"><table><tbody>${answered.map(q=>`<tr><td><strong>${esc(q.prompt)}</strong><br><small>AFB ${q.afb} · ${p.outcomes?.[q.id]?.complete?'erledigt':'offen'}</small></td><td class="student-answer">${esc(readableAnswer(q,p.answers[q.id]))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Noch keine Antworten vorhanden.</div>'}</div>`;}
function metricsFor(p){let totalXP=0,completed=0;for(const q of QUESTIONS)if(p.outcomes?.[q.id]?.complete){totalXP+=q.xp;completed++;}return {totalXP,completed};}
function attachVisuals(){document.querySelectorAll('[data-width]').forEach(el=>el.style.width=el.dataset.width+'%');const age=$('age-slider'),price=$('price-slider');if(age){age.addEventListener('input',()=>{const n=Number(age.value);$('age-number').textContent=n;$('age-result').textContent=n<7?'🔴 Geschäftsunfähig (unter 7)':n<18?'🟠 Beschränkt geschäftsfähig (7–17)':'🟢 Im Regelfall voll geschäftsfähig (ab 18)';});}if(price){price.addEventListener('input',()=>{$('price-number').textContent=price.value;$('price-result').textContent=`Verhältnis: ${(Number(price.value)/100).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})}-facher Preis`;});}}
function localSave(){try{localStorage.setItem('rq-guest-v1',JSON.stringify(state.p));statusLabel('Lokal gespeichert');}catch{statusLabel('Lokale Speicherung nicht möglich','warn');toast('Browser-Speicher nicht verfügbar. Exportieren Sie Ihr Lernportfolio.', 'warn');}}
function queue(kind,id,value){
 if(!state.pending[kind])state.pending[kind]={};state.pending[kind][id]=value;
 if(!state.user){localSave();return;}
 statusLabel('Wird gespeichert …','warn');
 clearTimeout(state.saveTimer);state.saveTimer=setTimeout(syncProgress,950);
}
function setAnswer(q,value,{rerender=true}={}){
 state.p.answers[q.id]=value;
 if(state.p.outcomes?.[q.id]?.complete){delete state.p.outcomes[q.id];queue('outcomes',q.id,null);}
 delete state.feedback[q.id];
 queue('answers',q.id,value);
 if(rerender)rerenderQuestion(q.id);
 else updateStats();
}
function updateStats(){const m=metrics();$('totalXP').textContent=m.total.toLocaleString('de-DE');const f=$('sidebarFill');if(f)f.style.width=(m.done/QUESTIONS.length*100)+'%';}
function rerenderQuestion(id){const old=$('q-'+id);if(!old)return;const q=QUESTION_BY_ID[id],cards=[...old.parentElement.children],index=cards.indexOf(old)+1;old.outerHTML=questionHtml(q,index);updateStats();}
async function api(path,method='GET',payload){
 const res=await fetch('/api/'+path,{method,headers:{...(payload?{'Content-Type':'application/json'}:{}),...(state.token?{'Authorization':'Bearer '+state.token}:{})},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 let data;try{data=await res.json();}catch{throw new Error('Die Netlify-Schnittstelle ist nicht erreichbar. Im Gastmodus können Sie weiterarbeiten.');}
 if(!res.ok)throw new Error(data.error||'Die Aktion konnte nicht abgeschlossen werden.');
 return data;
}
async function syncProgress(){
 if(!state.user||state.saving)return;
 const patch=state.pending;
 if(Object.values(patch).every(o=>!o||Object.keys(o).length===0))return;
 state.pending={answers:{},outcomes:{},checklist:{}};
 state.saving=true;
 try{
  const result=await api('progress','POST',{patch});
  state.p.revision=result.progress?.revision||state.p.revision;
  statusLabel('Synchronisiert');
 }catch(error){
  for(const kind of Object.keys(patch))for(const [id,val] of Object.entries(patch[kind]||{})){
   if(!Object.hasOwn(state.pending[kind],id))state.pending[kind][id]=val;
  }
  statusLabel('Speicherung fehlgeschlagen','error');toast(error.message,'warn');
 }finally{state.saving=false;const hasPending=Object.values(state.pending).some(o=>Object.keys(o).length);if(hasPending)state.saveTimer=setTimeout(syncProgress,3000);}
}
function normalizeInput(s){return String(s??'').normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').replace(/[.,;:]$/,'').trim();}
function correct(q,a){
 if(q.type==='single'||q.type==='truefalse')return a===q.correct;
 if(q.type==='multi')return Array.isArray(a)&&a.length===q.correct.length&&q.correct.every(x=>a.includes(x));
 if(q.type==='input')return typeof a==='string'&&q.accepted.some(x=>normalizeInput(x)===normalizeInput(a));
 if(q.type==='drag'||q.type==='match')return a&&typeof a==='object'&&q.items.every(item=>a[item.id||item.label]===item.correct);
 if(q.type==='order')return Array.isArray(a)&&a.join('|')===q.correct.join('|');
 return false;
}
function checkQ(id){
 const q=QUESTION_BY_ID[id],ans=state.p.answers[id];if(!q)return;
 if(q.type==='free'){requestSolution(id);return;}
 if(ans===undefined||ans===null||ans===''||(Array.isArray(ans)&&!ans.length)||(typeof ans==='object'&&!Array.isArray(ans)&&!Object.keys(ans).length)){
  state.feedback[id]={kind:'error',text:'Bitte bearbeiten Sie zuerst die Aufgabe.'};rerenderQuestion(id);return;
 }
 const isCorrect=correct(q,ans),already=state.p.outcomes?.[id]?.complete;
 if(isCorrect){
  state.p.outcomes[id]={complete:true,method:'auto'};
  queue('outcomes',id,state.p.outcomes[id]);
  state.feedback[id]={kind:'good',text:already?'Weiterhin richtig. Ihre Antwort ist abgeschlossen.':`Richtig entschieden! Sie erhalten +${q.xp} XP. Die Begründung finden Sie auf Wunsch in der Musterlösung.`};
  if(!already)toast(`Ausgezeichnet! +${q.xp} XP ✦`);
 }else{
  state.feedback[id]={kind:'error',text:'Das Ergebnis ist noch nicht vollständig richtig. Prüfen Sie die Begriffe oder die Fallumstände und versuchen Sie es erneut. Sie können auch die Musterlösung anzeigen.'};
 }
 rerenderQuestion(id);
}
function requestSolution(id){state.activeSolution=id;$('solutionDialog').showModal();}
function showSolution(){const id=state.activeSolution;if(!id)return;$('solutionDialog').close();state.solutionShown.add(id);state.activeSolution=null;rerenderQuestion(id);const el=$('q-'+id);el?.querySelector('.solution-box')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
function selfJudge(id){
 const q=QUESTION_BY_ID[id],a=state.p.answers?.[id];
 if(!q||q.type!=='free'||!state.solutionShown.has(id))return;
 if(typeof a!=='string'||a.trim().length<12){state.feedback[id]={kind:'error',text:'Bitte formulieren Sie zuerst eine eigene, ausreichend ausführliche Antwort, bevor Sie sie als korrekt markieren.'};rerenderQuestion(id);return;}
 if(!state.p.outcomes[id]?.complete){state.p.outcomes[id]={complete:true,method:'self'};queue('outcomes',id,state.p.outcomes[id]);toast(`Selbstkontrolle abgeschlossen: +${q.xp} XP ✦`);}
 state.feedback[id]={kind:'good',text:'Sie haben Ihre Antwort mit der Musterlösung verglichen und eigenständig als korrekt bewertet.'};rerenderQuestion(id);
}
async function shopAction(action,idOrType){
 try{
  if(state.user){
   const result=await api(action,'POST',action==='unequip'?{type:idOrType}:{itemId:idOrType});
   state.p=result.progress;
  }else{
   if(action==='buy'){
    const item=CATALOG.find(c=>c.id===idOrType);if(!item||state.p.inventory.includes(item.id)||metrics().wallet<item.cost)return;
    state.p.inventory.push(item.id);state.p.spent+=item.cost;
   }else if(action==='equip'){
    const item=CATALOG.find(c=>c.id===idOrType);if(!item||!state.p.inventory.includes(item.id))return;
    state.p.equipped[item.type]=item.id;
   }else if(action==='unequip')state.p.equipped[idOrType]=null;
   localSave();
  }
  render();toast(action==='buy'?'Gegenstand freigeschaltet!':'Avatar-Galerie aktualisiert.');
 }catch(error){toast(error.message,'warn');}
}
function saveChecklist(i,change){
 const old=state.p.checklist?.[i]||{rating:3,done:false};
 const next={...old,...change};state.p.checklist[i]=next;queue('checklist',String(i),next);
 const wrap=$('checklistWrap');if(wrap)wrap.outerHTML=checklistHtml();
 if(change.done===true)toast('Kompetenz als erledigt markiert.');
}
function openAuth(role='student',mode='login'){state.authRole=role;state.authMode=mode;authDisplay();$('authError').hidden=true;$('authDialog').showModal();}
function authDisplay(){
 document.querySelectorAll('#authRoles [data-role]').forEach(b=>b.classList.toggle('selected',b.dataset.role===state.authRole));
 const recoverTab=document.querySelector('#authModes [data-mode="recover"]');recoverTab.hidden=state.authRole!=='teacher';
 if(state.authRole==='student'&&state.authMode==='recover')state.authMode='login';
 document.querySelectorAll('#authModes [data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===state.authMode));
 const recover=state.authMode==='recover',register=state.authMode==='register';
 $('authTitle').textContent=recover?'Lehrerpasswort neu setzen':state.authRole==='teacher'?'Lehrkraft-Zugang':'Mit Konto lernen';
 $('teacherCodeLabel').hidden=state.authRole!=='teacher'||!(register||recover);
 $('teacherCode').required=!$('teacherCodeLabel').hidden;
 $('authOldPasswordLabel').hidden=recover;$('authPassword').required=!recover;
 $('authNewPasswordLabel').hidden=!recover;$('authNewPassword').required=recover;
 $('authPassword').autocomplete=register?'new-password':'current-password';
 $('authSubmit').textContent=recover?'Lehrerpasswort ändern':register?'Konto erstellen':'Anmelden';
 $('authError').hidden=true;
}
async function submitAuth(e){
 e.preventDefault();const b=$('authSubmit');b.disabled=true;b.textContent='Bitte prüfen …';$('authError').hidden=true;
 const payload={nickname:$('authNick').value,className:$('authClass').value,role:state.authRole,password:$('authPassword').value};
 if(state.authRole==='teacher')payload.teacherCode=$('teacherCode').value;
 if(state.authMode==='recover')payload.newPassword=$('authNewPassword').value;
 try{
  const path=state.authMode==='recover'?'teacher-recover':state.authMode==='register'?'register':'login';
  const result=await api(path,'POST',payload);
  if(state.authMode==='recover'){toast('Lehrerpasswort geändert. Sie können sich jetzt anmelden.');state.authMode='login';authDisplay();return;}
  const guestSnapshot=getLocal();
  state.token=result.token;localStorage.setItem('rq-session-v1',state.token);
  state.user=result.user;state.p={...defaultP(),...result.progress};state.pending={answers:{},outcomes:{},checklist:{}};
  $('authDialog').close();toast(`Angemeldet: ${result.user.nickname} · ${result.user.className}`);
  // Nur bei leerem Konto mit Zustimmung lokale Gastdaten übernehmen.
  const hasGuest=Object.keys(guestSnapshot.answers||{}).length>0;
  const accountEmpty=Object.keys(state.p.answers||{}).length===0;
  if(hasGuest&&accountEmpty&&confirm('Es gibt einen lokalen Gast-Lernstand. Möchten Sie Ihre bisherigen Antworten auf dieses Konto übernehmen?')){
   state.p={...state.p,answers:{...guestSnapshot.answers},outcomes:{...guestSnapshot.outcomes},checklist:{...guestSnapshot.checklist}};
   state.pending={answers:{...state.p.answers},outcomes:{...state.p.outcomes},checklist:{...state.p.checklist}};
   await syncProgress();toast('Ihr lokaler Lernstand wurde übernommen.');
  }
  render();if(state.user.role==='teacher'&&state.view==='teacher')loadTeacher();
 }catch(error){$('authError').hidden=false;$('authError').textContent=error.message;}
 finally{b.disabled=false;authDisplay();}
}
function logout(){clearTimeout(state.saveTimer);state.token=null;state.user=null;state.p=getLocal();state.pending={answers:{},outcomes:{},checklist:{}};state.teacherRows=null;state.teacherDetail=null;state.teacherPassword=null;localStorage.removeItem('rq-session-v1');toast('Sie wurden abgemeldet. Der lokale Gastmodus ist aktiv.');go('home');}
async function bootstrap(){
 render();
 if(!state.token)return;
 try{
  const result=await api('me');state.user=result.user;state.p={...defaultP(),...result.progress};render();
  if(state.view==='teacher'&&state.user.role==='teacher')loadTeacher();
 }catch(error){state.token=null;localStorage.removeItem('rq-session-v1');statusLabel('Gastmodus');toast('Die Anmeldung ist abgelaufen. Sie können sich erneut anmelden.','warn');}
}
async function loadTeacher(){
 if(state.user?.role!=='teacher')return;
 try{const result=await api('teacher');state.teacherRows=result.students;state.teacherDetail=null;state.teacherDetailName=null;render();}
 catch(error){toast(error.message,'warn');$('mainContent').insertAdjacentHTML('afterbegin',`<div class="error-note">${esc(error.message)}</div>`);}
}
async function detailTeacher(key){
 try{const r=await api('teacher','POST',{action:'detail',key});state.teacherDetail=r.progress;state.teacherDetailName=r.nickname;const area=$('teacherDetailArea');if(area)area.innerHTML=teacherDetailHtml();area?.scrollIntoView({behavior:'smooth',block:'start'});}
 catch(e){toast(e.message,'warn');}
}
function confirmTeacher(action,key){
 const row=state.teacherRows?.find(r=>r.key===key),name=row?.nickname||'';
 const text={
  'reset-all':['Alle Lernstände löschen',`Die Fortschritte ALLER Lernenden der Klasse ${state.user?.className} werden unwiderruflich gelöscht. Die Nutzerkonten bleiben bestehen. Zur Bestätigung ist die Klasse erneut einzugeben.`],
  'remove':['Nutzer entfernen',`Das Konto von ${name} und dessen gesamter Lernstand werden unwiderruflich gelöscht.`],
  'reset-password':['Passwort zurücksetzen',`Das alte Passwort von ${name} verliert seine Gültigkeit. Das neue Passwort wird einmalig im Lehrerbereich angezeigt. Bestehende Sitzungen werden ungültig.`]
 }[action];if(!text)return;state.teacherAction={action,key,name};$('confirmActionTitle').textContent=text[0];$('confirmActionBody').textContent=text[1];$('teacherActionDialog').showModal();
}
async function executeTeacher(){
 const a=state.teacherAction;if(!a)return;$('teacherActionDialog').close();state.teacherAction=null;
 if(a.action==='reset-all'){const entry=prompt(`Zum endgültigen Löschen geben Sie die Klassenbezeichnung „${state.user.className}“ ein:`);if(entry?.trim().toLocaleLowerCase('de-DE')!==state.user.className.trim().toLocaleLowerCase('de-DE')){toast('Löschung abgebrochen.','warn');return;}}
 try{
  const r=await api('teacher','POST',{action:a.action,...(a.key?{key:a.key}:{})});
  if(a.action==='reset-password')state.teacherPassword={nick:a.name,password:r.newPassword};
  if(a.action==='reset-all'||a.action==='remove'){state.teacherDetail=null;state.teacherPassword=null;}
  await loadTeacher();toast(r.message||'Aktion ausgeführt.');
 }catch(e){toast(e.message,'warn');}
}
function downloadCsv(){if(!state.teacherRows)return;const rows=[['Klasse','Nickname','Erledigte Aufgaben','Aufgaben gesamt','Fortschritt Prozent','XP'],...state.teacherRows.map(u=>[state.user.className,u.nickname,u.metrics.completed,QUESTIONS.length,Math.round(u.metrics.completed/QUESTIONS.length*100),u.metrics.totalXP])];const data='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='RechtQuest-Klassenuebersicht.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),12000);}
function exportPdf(){const identity=state.user?`${state.user.nickname} | Klasse ${state.user.className}`:'Gastmodus (lokal)';downloadPortfolio(QUESTIONS,state.p,identity);toast('Ihr Lernportfolio wurde als PDF erstellt.');}
document.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-nav]');if(nav){go(nav.dataset.nav);return;}
 const filter=event.target.closest('[data-shop-filter]');if(filter){state.shopFilter=filter.dataset.shopFilter;render();return;}
 const choice=event.target.closest('[data-choice]');
 if(choice){const q=QUESTION_BY_ID[choice.dataset.q];if(!q)return;const index=Number(choice.dataset.choice);
  if(q.type==='single')setAnswer(q,index);
  else if(q.type==='truefalse')setAnswer(q,index===0);
  else if(q.type==='multi'){
   const old=Array.isArray(state.p.answers[q.id])?state.p.answers[q.id]:[];
   setAnswer(q,old.includes(index)?old.filter(x=>x!==index):[...old,index].sort((a,b)=>a-b));
  }return;
 }
 const drag=event.target.closest('[data-draggable]');
 if(drag){state.pickedDrag={qid:drag.dataset.q,id:drag.dataset.draggable};const q=QUESTION_BY_ID[drag.dataset.q];if(q)rerenderQuestion(q.id);return;}
 const drop=event.target.closest('[data-drop]');
 if(drop&&state.pickedDrag&&state.pickedDrag.qid===drop.dataset.q){assignDrag(drop.dataset.q,state.pickedDrag.id,drop.dataset.drop);return;}
 const up=event.target.closest('[data-order-up]'),down=event.target.closest('[data-order-down]');
 if(up||down){const control=up||down;moveOrder(control.dataset.orderUp||control.dataset.orderDown,Number(control.dataset.index),up?-1:1);return;}
 const target=event.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action,id=target.dataset.q;
 if(action==='check'){checkQ(id);return;}
 if(action==='solution'){requestSolution(id);return;}
 if(action==='self-yes'){selfJudge(id);return;}
 if(action==='self-edit'){state.solutionShown.delete(id);state.feedback[id]={kind:'',text:'Überarbeiten Sie Ihre Begründung und vergleichen Sie anschließend erneut.'};rerenderQuestion(id);$('q-'+id)?.querySelector('textarea')?.focus();return;}
 if(action==='flow-tip'){const step=target.dataset.tip;const tips={'1':'Prüfen Sie zunächst, ob wirksame Willenserklärungen vorliegen und ein Vertrag geschlossen wurde.','2':'Ermitteln Sie, ob Nichtigkeitsgründe vorliegen, etwa § 105 oder § 125 BGB.','3':'Prüfen Sie Irrtum, Täuschung oder Drohung und anschließend Anfechtungserklärung sowie Rechtswirkung.'};const el=$('flowTip');if(el)el.textContent=tips[step]||'';return;}
 if(action==='open-auth'){state.user?go('account'):openAuth();return;}
 if(action==='teacher-auth'){openAuth('teacher');return;}
 if(action==='logout'){logout();return;}
 if(action==='pdf'){exportPdf();return;}
 if(action==='buy'||action==='equip'){await shopAction(action,target.dataset.item);return;}
 if(action==='unequip'){await shopAction(action,target.dataset.type);return;}
 if(action==='teacher-reload'){await loadTeacher();return;}
 if(action==='teacher-csv'){downloadCsv();return;}
 if(action==='teacher-detail'){await detailTeacher(target.dataset.key);return;}
 if(action==='teacher-password'){confirmTeacher('reset-password',target.dataset.key);return;}
 if(action==='teacher-remove'){confirmTeacher('remove',target.dataset.key);return;}
 if(action==='teacher-reset-all'){confirmTeacher('reset-all',null);return;}
 if(action==='copy-password'){
  const value=state.teacherPassword?.password;
  if(value){try{await navigator.clipboard.writeText(value);toast('Passwort kopiert.');}catch{toast('Kopieren nicht möglich. Wählen Sie den Text manuell aus.','warn');}}return;
 }
 if(action==='hide-password'){state.teacherPassword=null;render();return;}
});
function assignDrag(qid,itemId,group){
 const q=QUESTION_BY_ID[qid];if(!q||q.type!=='drag'||!q.items.some(i=>i.id===itemId))return;
 const old=state.p.answers[qid]&&typeof state.p.answers[qid]==='object'?state.p.answers[qid]:{};
 const next={...old};if(!group)delete next[itemId];else if(q.groups.includes(group))next[itemId]=group;
 state.pickedDrag=null;setAnswer(q,next);
}
function moveOrder(qid,index,offset){
 const q=QUESTION_BY_ID[qid];if(!q||q.type!=='order')return;
 const ids=Array.isArray(state.p.answers[qid])?[...state.p.answers[qid]]:q.items.map(i=>i.id).reverse();
 const other=index+offset;if(other<0||other>=ids.length)return;
 [ids[index],ids[other]]=[ids[other],ids[index]];setAnswer(q,ids);
}
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.matches('[data-free]')){const q=QUESTION_BY_ID[el.dataset.free];if(q)setAnswer(q,el.value,{rerender:false});}
 else if(el.matches('[data-short]')){const q=QUESTION_BY_ID[el.dataset.short];if(q)setAnswer(q,el.value,{rerender:false});}
 else if(el.id==='lexSearch'){const value=el.value.toLocaleLowerCase('de-DE').trim();document.querySelectorAll('[data-term]').forEach(entry=>entry.hidden=!entry.dataset.term.includes(value));}
});
document.addEventListener('change',event=>{
 const el=event.target;
 if(el.matches('[data-match]')){
  const q=QUESTION_BY_ID[el.dataset.match],key=el.dataset.item;if(!q)return;
  const old=state.p.answers[q.id]&&typeof state.p.answers[q.id]==='object'?state.p.answers[q.id]:{};
  const next={...old};if(el.value)next[key]=el.value;else delete next[key];setAnswer(q,next,{rerender:false});
 }else if(el.matches('[data-rating]'))saveChecklist(Number(el.dataset.rating),{rating:Number(el.value)});
});
document.addEventListener('click',event=>{
 const toggle=event.target.closest('[data-check-toggle]');if(toggle){const i=Number(toggle.dataset.checkToggle),old=state.p.checklist?.[i]||{rating:3,done:false};saveChecklist(i,{done:!old.done});}
});
let dragInfo=null;
document.addEventListener('dragstart',event=>{
 const el=event.target.closest('[data-draggable]');
 if(el){dragInfo={type:'drag',qid:el.dataset.q,id:el.dataset.draggable};event.dataTransfer.setData('text/plain',el.dataset.draggable);event.dataTransfer.effectAllowed='move';return;}
 const order=event.target.closest('[data-order-drag]');
 if(order){dragInfo={type:'order',qid:order.dataset.q,id:order.dataset.orderDrag};event.dataTransfer.setData('text/plain',order.dataset.orderDrag);event.dataTransfer.effectAllowed='move';}
});
document.addEventListener('dragover',event=>{
 if(dragInfo?.type==='drag'){
  const target=event.target.closest('[data-drop]');if(target&&target.dataset.q===dragInfo.qid){event.preventDefault();target.classList.add('over');}
 }else if(dragInfo?.type==='order'){
  const target=event.target.closest('[data-order-drag]');if(target&&target.dataset.q===dragInfo.qid)event.preventDefault();
 }
});
document.addEventListener('dragleave',event=>{const t=event.target.closest('[data-drop]');if(t)t.classList.remove('over');});
document.addEventListener('drop',event=>{
 if(!dragInfo)return;const info=dragInfo;dragInfo=null;
 if(info.type==='drag'){
  const target=event.target.closest('[data-drop]');if(!target||target.dataset.q!==info.qid)return;
  event.preventDefault();target.classList.remove('over');assignDrag(info.qid,info.id,target.dataset.drop);
 }else if(info.type==='order'){
  const target=event.target.closest('[data-order-drag]');if(!target||target.dataset.q!==info.qid)return;
  event.preventDefault();const q=QUESTION_BY_ID[info.qid];const ids=Array.isArray(state.p.answers[q.id])?[...state.p.answers[q.id]]:q.items.map(x=>x.id).reverse();
  const from=ids.indexOf(info.id),to=ids.indexOf(target.dataset.orderDrag);if(from<0||to<0||from===to)return;
  ids.splice(to,0,...ids.splice(from,1));setAnswer(q,ids);
 }
});
document.addEventListener('dragend',()=>{dragInfo=null;document.querySelectorAll('.drop-target.over').forEach(el=>el.classList.remove('over'));});
$('menuToggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');const open=$('sidebar').classList.contains('open');$('overlay').classList.toggle('visible',open);$('overlay').hidden=!open;});
$('overlay').addEventListener('click',closeMenu);
$('openProfile').addEventListener('click',()=>go('shop'));
$('cancelSolution').addEventListener('click',()=>$('solutionDialog').close());
$('confirmSolution').addEventListener('click',showSolution);
$('solutionDialog').addEventListener('close',()=>{state.activeSolution=null;});
$('cancelAction').addEventListener('click',()=>$('teacherActionDialog').close());
$('confirmAction').addEventListener('click',executeTeacher);
$('closeAuth').addEventListener('click',()=>$('authDialog').close());
$('guestContinue').addEventListener('click',()=>$('authDialog').close());
$('authRoles').addEventListener('click',event=>{const b=event.target.closest('[data-role]');if(b){state.authRole=b.dataset.role;state.authMode='login';authDisplay();}});
$('authModes').addEventListener('click',event=>{const b=event.target.closest('[data-mode]');if(b){state.authMode=b.dataset.mode;authDisplay();}});
$('authForm').addEventListener('submit',submitAuth);
document.addEventListener('submit',async event=>{
 if(event.target.id!=='changePasswordForm')return;event.preventDefault();const old=$('oldPass').value,newPassword=$('newPass').value;
 try{const result=await api('change-password','POST',{oldPassword:old,newPassword});state.token=result.token;localStorage.setItem('rq-session-v1',result.token);event.target.reset();toast('Passwort wurde geändert.');}catch(err){toast(err.message,'warn');}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.user)syncProgress();});
window.addEventListener('hashchange',()=>{const view=location.hash.slice(1);if(validViews.has(view)&&view!==state.view)go(view);});
bootstrap();
