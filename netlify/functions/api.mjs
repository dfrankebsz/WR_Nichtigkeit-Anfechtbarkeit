import { getStore } from '@netlify/blobs';
import { randomBytes, randomUUID, createHmac, createHash, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { QUESTION_BY_ID, XP_BY_ID, CATALOG, CHECKLIST } from '../../public/course-data.js';

const scrypt=promisify(scryptCallback);
const USERS='rechtskurs-nutzer-v1';
const PROGRESS='rechtskurs-fortschritt-v1';
const TEACHER_ENV='LEHRER_CODE';
const TOKEN_LIFETIME=60*60*24*14;
const MAX_BODY=250000;
const allowedRoles=new Set(['student','teacher']);
const forbiddenObjKeys=new Set(['__proto__','constructor','prototype']);
// Ablage in einer europäischen Region; Netlify-Verarbeitung bleibt separat datenschutzrechtlich zu prüfen.
const storeU=()=>getStore({name:USERS,region:'eu-central-1'});
const storeP=()=>getStore({name:PROGRESS,region:'eu-central-1'});

export const config={path:'/api/*',rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:180}};

function res(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function problem(message,status=400){return res({ok:false,error:message},status);}
function teacherSecret(){return (process.env.LEHRER_CODE||'').trim();}
function validSecret(){return teacherSecret().length>=16;}
function safeEqual(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());}
function tidy(s){return String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ');}
function readIdentity(raw,kind){
 const s=tidy(raw);
 const valid=kind==='nickname'?/^[\p{L}\p{N}_-]{3,24}$/u.test(s):/^[\p{L}\p{N} _-]{2,36}$/u.test(s);
 if(!valid)throw new HttpError(kind==='nickname'?'Nickname: 3–24 Zeichen, nur Buchstaben, Zahlen, _ und -.':'Klasse: 2–36 Zeichen, Buchstaben, Zahlen, Leerzeichen, _ und -.',400);
 return {display:s,key:Buffer.from(s.toLocaleLowerCase('de-DE')).toString('base64url')};
}
function accountKey(classKey,nickKey){return `u/${classKey}/${nickKey}`;}
function progressKey(a){return `p/${a.classKey}/${a.nickKey}`;}
function errText(error){return error instanceof HttpError?error.message:'Interner Serverfehler. Bitte erneut versuchen.';}
class HttpError extends Error {constructor(msg,status=400){super(msg);this.status=status;}}
async function body(req){
 const declared=Number(req.headers.get('content-length')||0);
 if(declared>MAX_BODY)throw new HttpError('Die Eingabe ist zu groß.',413);
 const raw=await req.text();
 if(raw.length>MAX_BODY)throw new HttpError('Die Eingabe ist zu groß.',413);
 try{return JSON.parse(raw);}catch{throw new HttpError('Ungültige JSON-Anfrage.',400);}
}
function checkPassword(p){if(typeof p!=='string'||p.length<8||p.length>100)throw new HttpError('Passwort: 8–100 Zeichen erforderlich.',400);return p;}
async function hashPassword(password,salt=randomBytes(16).toString('hex')){
 const result=await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return `${salt}:${result.toString('hex')}`;
}
async function verifyPassword(password,stored){
 const [salt,digest]=String(stored||'').split(':');
 if(!/^[a-f\d]{32}$/.test(salt||'')||!/^[a-f\d]{128}$/.test(digest||''))return false;
 const other=await hashPassword(password,salt);
 return safeEqual(other,stored);
}
function tokenKey(){return createHash('sha256').update('rechtskurs-session-v1:').update(teacherSecret()).digest();}
function sign(payload){
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const content=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const signature=createHmac('sha256',tokenKey()).update(`${head}.${content}`).digest('base64url');
 return `${head}.${content}.${signature}`;
}
function makeToken(user){return sign({sub:user.key,id:user.id,role:user.role,sv:user.sessionVersion||0,exp:Math.floor(Date.now()/1000)+TOKEN_LIFETIME});}
function verifyToken(token){
 if(!validSecret())throw new HttpError('Die Serverkonfiguration fehlt. Der Lehrer-Code muss in Netlify hinterlegt sein.',503);
 const parts=String(token||'').split('.');
 if(parts.length!==3||parts.some(x=>x.length>3000))throw new HttpError('Bitte melden Sie sich erneut an.',401);
 const sig=createHmac('sha256',tokenKey()).update(`${parts[0]}.${parts[1]}`).digest('base64url');
 if(!safeEqual(parts[2],sig))throw new HttpError('Sitzung nicht gültig.',401);
 try{
  const p=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(typeof p.exp!=='number'||p.exp<Math.floor(Date.now()/1000)||typeof p.sub!=='string'||!allowedRoles.has(p.role))throw Error('invalid');
  return p;
 }catch{throw new HttpError('Sitzung abgelaufen. Bitte erneut anmelden.',401);}
}
async function userFor(req,role=null){
 const bearer=req.headers.get('authorization')||'';
 const session=verifyToken(bearer.startsWith('Bearer ')?bearer.slice(7):'');
 const a=await storeU().get(session.sub,{type:'json',consistency:'strong'});
 if(!a||a.id!==session.id||a.role!==session.role||(a.sessionVersion||0)!==session.sv)throw new HttpError('Sitzung ungültig oder Konto entfernt.',401);
 if(role&&a.role!==role)throw new HttpError('Zugriff nur für den Lehrerbereich.',403);
 return a;
}
function publicUser(a){return {nickname:a.nickname,className:a.className,role:a.role};}
function freshProgress(){return {answers:{},outcomes:{},checklist:{},inventory:['avatar_fox'],equipped:{avatar:'avatar_fox',outfit:null,pet:null},spent:0,revision:0};}
function safeProgress(p){
 const s={...freshProgress(),...(p&&typeof p==='object'?p:{})};
 if(!s.answers||typeof s.answers!=='object')s.answers={};
 if(!s.outcomes||typeof s.outcomes!=='object')s.outcomes={};
 if(!s.checklist||typeof s.checklist!=='object')s.checklist={};
 if(!Array.isArray(s.inventory))s.inventory=['avatar_fox'];
 if(!s.inventory.includes('avatar_fox'))s.inventory.unshift('avatar_fox');
 if(!s.equipped||typeof s.equipped!=='object')s.equipped=freshProgress().equipped;
 if(!Number.isFinite(s.spent)||s.spent<0)s.spent=0;
 return s;
}
function metrics(p){
 let totalXP=0,completed=0;
 for(const [id,outcome] of Object.entries(p.outcomes||{})){
  if(Object.hasOwn(XP_BY_ID,id)&&outcome&&outcome.complete===true){totalXP+=XP_BY_ID[id];completed++;}
 }
 return {totalXP,walletXP:Math.max(0,totalXP-(p.spent||0)),completed};
}
async function userProgress(a){return safeProgress(await storeP().get(progressKey(a),{type:'json',consistency:'strong'}));}
function isConflict(e){const s=e?.status||e?.statusCode;return s===409||s===412||/condition|precondition|conflict/i.test(String(e?.message||''));}
async function mutateProgress(a,fn){
 const store=storeP(),key=progressKey(a);
 for(let attempt=0;attempt<6;attempt++){
  const old=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  const next=await fn(safeProgress(old?.data));
  if(!next)return safeProgress(old?.data);
  next.revision=(old?.data?.revision||0)+1;
  try{
   const result=await store.setJSON(key,next,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
   if(result.modified)return next;
  }catch(e){if(!isConflict(e))throw e;}
 }
 throw new HttpError('Gleichzeitige Änderungen. Bitte erneut speichern.',409);
}
function sanitizedAnswer(q,value){
 if(q.type==='free'||q.type==='input'){
  if(typeof value!=='string'||value.length>6000)return undefined;
  return value;
 }
 if(q.type==='single')return Number.isInteger(value)&&value>=0&&value<(q.options?.length||0)?value:undefined;
 if(q.type==='truefalse')return typeof value==='boolean'?value:undefined;
 if(q.type==='multi')return Array.isArray(value)&&value.length<=q.options.length&&value.every(v=>Number.isInteger(v)&&v>=0&&v<q.options.length)?[...new Set(value)]:undefined;
 if(q.type==='drag'||q.type==='match'){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>30)return undefined;
  const ids=new Set(q.items.map(i=>i.id||i.label));
  const allowed=q.type==='drag'?new Set(q.groups):new Set(q.options);
  const o={};for(const [key,group] of Object.entries(value)){if(ids.has(key)&&allowed.has(group))o[key]=group;}
  return o;
 }
 if(q.type==='order'){
  const ids=q.items.map(i=>i.id);
  return Array.isArray(value)&&value.length===ids.length&&new Set(value).size===ids.length&&value.every(x=>ids.includes(x))?value:undefined;
 }
 return undefined;
}
function normalizeInput(s){
 return String(s??'').normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').replace(/[.,;:]$/,'').trim();
}
function correctAnswer(q,a){
 if(q.type==='single'||q.type==='truefalse')return a===q.correct;
 if(q.type==='multi')return Array.isArray(a)&&a.length===q.correct.length&&q.correct.every(x=>a.includes(x));
 if(q.type==='input')return typeof a==='string'&&q.accepted.some(x=>normalizeInput(x)===normalizeInput(a));
 if(q.type==='drag'||q.type==='match')return a&&typeof a==='object'&&!Array.isArray(a)&&q.items.every(item=>a[item.id||item.label]===item.correct);
 if(q.type==='order')return Array.isArray(a)&&a.join('|')===q.correct.join('|');
 return false;
}
function allowedCompletion(q,answer,outcome){
 if(!outcome?.complete)return true;
 if(q.type==='free')return outcome.method==='self'&&typeof answer==='string'&&answer.trim().length>=12;
 return outcome.method==='auto'&&correctAnswer(q,answer);
}
function applyPatch(p,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new HttpError('Ungültige Fortschrittsdaten.');
 const allowed=new Set(['answers','outcomes','checklist']);
 if(Object.keys(patch).some(k=>!allowed.has(k)))throw new HttpError('Unzulässige Fortschrittsfelder.');
 for(const kind of ['answers','outcomes']){
  if(patch[kind]===undefined)continue;
  if(!patch[kind]||typeof patch[kind]!=='object'||Array.isArray(patch[kind])||Object.keys(patch[kind]).length>120)throw new HttpError('Ungültige Aufgabendaten.');
  for(const [id,value] of Object.entries(patch[kind])){
   if(forbiddenObjKeys.has(id)||!Object.hasOwn(QUESTION_BY_ID,id))continue;
   if(kind==='answers'){
    const answer=sanitizedAnswer(QUESTION_BY_ID[id],value);
    if(answer!==undefined){
     // Bei einer geänderten Antwort erlischt ein früherer Erfolg; die neue Antwort muss erneut geprüft werden.
     if(JSON.stringify(p.answers[id])!==JSON.stringify(answer))delete p.outcomes[id];
     p.answers[id]=answer;
    }
   }else{
    if(value===null){delete p.outcomes[id];continue;}
    if(!value||typeof value!=='object'||typeof value.complete!=='boolean')continue;
    const outcome={complete:value.complete,method:value.method==='self'?'self':'auto'};
    if(!allowedCompletion(QUESTION_BY_ID[id],p.answers[id],outcome))throw new HttpError('Aufgabe noch nicht korrekt gelöst oder Selbstkontrolle unvollständig.',400);
    p.outcomes[id]=outcome;
   }
  }
 }
 if(patch.checklist!==undefined){
  if(!patch.checklist||typeof patch.checklist!=='object'||Object.keys(patch.checklist).length>CHECKLIST.length)throw new HttpError('Ungültige Checkliste.');
  for(const [id,value] of Object.entries(patch.checklist)){
   if(!/^\d+$/.test(id)||Number(id)<0||Number(id)>=CHECKLIST.length||!value||typeof value!=='object')continue;
   p.checklist[id]={rating:Math.min(5,Math.max(1,Math.round(Number(value.rating)||1))),done:value.done===true};
  }
 }
 return p;
}
async function ensureTeacherClass(teacher,key){
 const user=await storeU().get(key,{type:'json',consistency:'strong'});
 if(!user||user.classKey!==teacher.classKey||user.role!=='student')throw new HttpError('Nutzer in dieser Klasse nicht gefunden.',404);
 return user;
}
async function listStudents(teacher){
 const {blobs}=await storeU().list({prefix:`u/${teacher.classKey}/`});
 const candidates=await Promise.all(blobs.map(b=>storeU().get(b.key,{type:'json',consistency:'strong'})));
 return candidates.filter(u=>u&&u.role==='student'&&u.classKey===teacher.classKey).sort((a,b)=>a.nickname.localeCompare(b.nickname,'de'));
}
async function run(req){
 const pathname=new URL(req.url).pathname;
 const route=pathname.split('/').filter(Boolean)[1]||'';
 const method=req.method.toUpperCase();
 if(method==='POST'){
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw new HttpError('Anfrage von einer fremden Website abgelehnt.',403);
 }
 if(route==='status'&&method==='GET')return res({ok:true,configured:validSecret()});
 if(route==='register'&&method==='POST'){
  if(!validSecret())throw new HttpError('Für Konten muss in Netlify LEHRER_CODE gesetzt sein (mindestens 16 Zeichen).',503);
  const b=await body(req);const nick=readIdentity(b.nickname,'nickname'),cl=readIdentity(b.className,'class');
  const role=allowedRoles.has(b.role)?b.role:'student';
  const password=checkPassword(b.password);
  if(role==='teacher'&&!safeEqual(b.teacherCode,teacherSecret()))throw new HttpError('Lehrer-Code ungültig.',403);
  const key=accountKey(cl.key,nick.key);
  const user={key,id:randomUUID(),nickname:nick.display,nickKey:nick.key,className:cl.display,classKey:cl.key,role,hash:await hashPassword(password),sessionVersion:0,failures:0,lockedUntil:0};
  try{
   const result=await storeU().setJSON(key,user,{onlyIfNew:true});
   if(!result.modified)throw new HttpError('Dieser Nickname existiert in der Klasse bereits.',409);
  }catch(e){if(isConflict(e))throw new HttpError('Dieser Nickname existiert in der Klasse bereits.',409);throw e;}
  return res({ok:true,user:publicUser(user),token:makeToken(user),progress:freshProgress()},201);
 }
 if(route==='login'&&method==='POST'){
  if(!validSecret())throw new HttpError('Lehrer-Code in Netlify fehlt.',503);
  const b=await body(req);const nick=readIdentity(b.nickname,'nickname'),cl=readIdentity(b.className,'class');
  const role=allowedRoles.has(b.role)?b.role:'student';
  if(typeof b.password!=='string'||b.password.length>100)throw new HttpError('Ungültiges Passwort.',400);
  const key=accountKey(cl.key,nick.key);const a=await storeU().get(key,{type:'json',consistency:'strong'});
  if(!a||a.role!==role)throw new HttpError('Klasse, Nickname oder Passwort stimmt nicht.',401);
  if((a.lockedUntil||0)>Date.now())throw new HttpError('Zu viele Fehlversuche. Bitte versuchen Sie es später erneut oder fragen Sie Ihre Lehrkraft.',429);
  if(!await verifyPassword(b.password,a.hash)){
   a.failures=(a.failures||0)+1;
   if(a.failures>=6){a.lockedUntil=Date.now()+15*60*1000;a.failures=0;}
   await storeU().setJSON(key,a);
   throw new HttpError('Klasse, Nickname oder Passwort stimmt nicht.',401);
  }
  if(a.failures||a.lockedUntil){a.failures=0;a.lockedUntil=0;await storeU().setJSON(key,a);}
  return res({ok:true,token:makeToken(a),user:publicUser(a),progress:await userProgress(a)});
 }
 if(route==='teacher-recover'&&method==='POST'){
  if(!validSecret())throw new HttpError('Lehrer-Code fehlt.',503);
  const b=await body(req);
  if(!safeEqual(b.teacherCode,teacherSecret()))throw new HttpError('Lehrer-Code ungültig.',403);
  const nick=readIdentity(b.nickname,'nickname'),cl=readIdentity(b.className,'class');
  checkPassword(b.newPassword);
  const key=accountKey(cl.key,nick.key);const a=await storeU().get(key,{type:'json',consistency:'strong'});
  if(!a||a.role!=='teacher')throw new HttpError('Kein Lehrerkonto mit diesen Angaben.',404);
  a.hash=await hashPassword(b.newPassword);a.sessionVersion=(a.sessionVersion||0)+1;a.failures=0;a.lockedUntil=0;
  await storeU().setJSON(key,a);
  return res({ok:true,message:'Lehrerpasswort wurde geändert. Melden Sie sich erneut an.'});
 }
 if(route==='me'&&method==='GET'){
  const a=await userFor(req);
  return res({ok:true,user:publicUser(a),progress:await userProgress(a)});
 }
 if(route==='progress'&&method==='GET'){
  const a=await userFor(req);return res({ok:true,progress:await userProgress(a),metrics:metrics(await userProgress(a))});
 }
 if(route==='progress'&&method==='POST'){
  const a=await userFor(req);const b=await body(req);
  const p=await mutateProgress(a,p=>applyPatch(p,b.patch));
  return res({ok:true,progress:p,metrics:metrics(p)});
 }
 if(route==='shop'&&method==='POST'){
  const a=await userFor(req);const b=await body(req);
  const item=CATALOG.find(x=>x.id===b.itemId);
  if(!item||!item.cost)throw new HttpError('Unbekanntes oder kostenloses Angebot.');
  const p=await mutateProgress(a,p=>{
   if(p.inventory.includes(item.id))throw new HttpError('Bereits freigeschaltet.');
   if(metrics(p).walletXP<item.cost)throw new HttpError('Nicht genügend verfügbare XP.');
   p.inventory.push(item.id);p.spent+=item.cost;return p;
  });
  return res({ok:true,progress:p,metrics:metrics(p)});
 }
 if(route==='equip'&&method==='POST'){
  const a=await userFor(req);const b=await body(req);
  const item=CATALOG.find(x=>x.id===b.itemId);
  if(!item)throw new HttpError('Gegenstand nicht gefunden.');
  const p=await mutateProgress(a,p=>{
   if(!p.inventory.includes(item.id))throw new HttpError('Gegenstand noch nicht freigeschaltet.',403);
   p.equipped[item.type]=item.id;return p;
  });
  return res({ok:true,progress:p,metrics:metrics(p)});
 }
 if(route==='unequip'&&method==='POST'){
  const a=await userFor(req);const b=await body(req);
  if(!['pet','outfit'].includes(b.type))throw new HttpError('Ungültige Ausrüstung.');
  const p=await mutateProgress(a,p=>{p.equipped[b.type]=null;return p;});
  return res({ok:true,progress:p,metrics:metrics(p)});
 }
 if(route==='teacher'&&method==='GET'){
  const a=await userFor(req,'teacher');
  const students=await listStudents(a);
  const rows=await Promise.all(students.map(async u=>{
   const p=await userProgress(u);return {key:u.key,nickname:u.nickname,metrics:metrics(p),lastChange:p.revision||0};
  }));
  return res({ok:true,className:a.className,students:rows});
 }
 if(route==='teacher'&&method==='POST'){
  const teacher=await userFor(req,'teacher'),b=await body(req);
  if(b.action==='detail'){
   const u=await ensureTeacherClass(teacher,String(b.key||''));
   const p=await userProgress(u);
   return res({ok:true,nickname:u.nickname,progress:p,metrics:metrics(p)});
  }
  if(b.action==='reset-all'){
   const students=await listStudents(teacher);
   await Promise.all(students.map(async u=>{
    await storeP().delete(progressKey(u));
    u.sessionVersion=(u.sessionVersion||0)+1;
    await storeU().setJSON(u.key,u);
   }));
   return res({ok:true,count:students.length,message:'Alle Lernstände dieser Klasse wurden gelöscht. Aktive Schüleranmeldungen müssen erneuert werden.'});
  }
  if(b.action==='remove'){
   const u=await ensureTeacherClass(teacher,String(b.key||''));
   await storeU().delete(u.key);await storeP().delete(progressKey(u));
   return res({ok:true,message:'Nutzerkonto und Lernstand entfernt.'});
  }
  if(b.action==='reset-password'){
   const u=await ensureTeacherClass(teacher,String(b.key||''));
   const password=randomBytes(12).toString('base64url');
   u.hash=await hashPassword(password);u.sessionVersion=(u.sessionVersion||0)+1;u.failures=0;u.lockedUntil=0;
   await storeU().setJSON(u.key,u);
   return res({ok:true,newPassword:password,message:'Neues Einmal-Startpasswort erstellt. Teilen Sie es der betroffenen Person auf einem sicheren Weg mit.'});
  }
  throw new HttpError('Unbekannte Lehrkraft-Aktion.',400);
 }
 if(route==='change-password'&&method==='POST'){
  const a=await userFor(req),b=await body(req);
  checkPassword(b.newPassword);
  if(!await verifyPassword(String(b.oldPassword||''),a.hash))throw new HttpError('Bisheriges Passwort falsch.',401);
  a.hash=await hashPassword(b.newPassword);a.sessionVersion=(a.sessionVersion||0)+1;
  await storeU().setJSON(a.key,a);
  return res({ok:true,token:makeToken(a)});
 }
 return problem('Schnittstelle nicht gefunden.',404);
}
export default async function handler(req){
 try{return await run(req);}catch(error){
  if(!(error instanceof HttpError))console.error('Course API error:',error);
  return problem(errText(error),error instanceof HttpError?error.status:500);
 }
}
