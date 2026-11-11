// Eigenständiger PDF-Generator (keine CDN-Abhängigkeit). A4, PDF 1.4, WinAnsi.
// Exportiert bearbeitete Aufgaben und originale Schülerantworten, nicht automatisch die Musterlösungen.
const EXTRA={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function pdfEscape(input){
 let out='';for(const char of String(input||'')){
  const point=char.codePointAt(0);const b=Object.hasOwn(EXTRA,char)?EXTRA[char]:point;
  if(char==='('||char===')'||char==='\\')out+='\\'+char;
  else if(b===10||b===13||b===9)out+=' ';
  else if(b>=32&&b<=126)out+=char;
  else if(b>=160&&b<=255||Object.hasOwn(EXTRA,char))out+='\\'+b.toString(8).padStart(3,'0');
  else out+='?';
 }return out;
}
function simpleText(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function wrap(text,columns=92){
 const lines=[];
 for(const rawLine of String(text||'').split(/\r?\n/)){
  if(!rawLine.trim()){lines.push('');continue;}
  let current='';
  for(const word of rawLine.split(/\s+/)){
   if(!word)continue;
   if((current+' '+word).trim().length>columns&&current){lines.push(current);current='';}
   if(word.length>columns){
    if(current){lines.push(current);current='';}
    for(let i=0;i<word.length;i+=columns)lines.push(word.slice(i,i+columns));
   }else current+=(current?' ':'')+word;
  }
  if(current)lines.push(current);
 }
 return lines;
}
function formattedAnswer(q,ans){
 if(ans===undefined||ans===null)return '';
 if(q.type==='single')return q.options[ans]||'—';
 if(q.type==='truefalse')return ans===true?'Richtig':ans===false?'Falsch':'—';
 if(q.type==='multi')return Array.isArray(ans)?ans.map(i=>q.options[i]).filter(Boolean).join('; '):'';
 if(q.type==='drag'||q.type==='match')return q.items.map(i=>`${i.label}: ${ans[i.id||i.label]||'offen'}`).join(' | ');
 if(q.type==='order')return Array.isArray(ans)?ans.map(id=>q.items.find(i=>i.id===id)?.label||'').join(' > '):'';
 return String(ans);
}
export function buildPdfBytes(questions,progress,identity='Gastmodus'){
 const work=questions.filter(q=>{
  const a=progress.answers?.[q.id];
  return a!==undefined&&a!==null&&!(typeof a==='string'&&!a.trim())&&!(Array.isArray(a)&&a.length===0)&&!(typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===0);
 });
 const pageStreams=[];let commands='',y=0,pageNo=0;
 function textAt(s,x,yy,{size=10,bold=false,gray=false}={}){
  const color=gray?'0.40 0.46 0.55':'0.13 0.19 0.29';
  commands+=`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${yy} Tm (${pdfEscape(s)}) Tj ET\n`;
 }
 function startPage(){
  if(pageNo>0)pageStreams.push(commands);
  pageNo++;commands='';y=787;
  textAt('RECHTQUEST  |  Lernportfolio',46,807,{size:10,bold:true});
  textAt(`Seite ${pageNo}`,500,807,{size:9,gray:true});
  commands+='0.86 0.89 0.93 RG 46 797 m 548 797 l S\n';
 }
 function newline(n=13){y-=n;if(y<58){startPage();}}
 function block(lines,{size=10,bold=false,gray=false,indent=0,leading=13}={}){
  for(const line of lines){if(y<58)startPage();textAt(line,46+indent,y,{size,bold,gray});newline(leading);}
 }
 startPage();
 block(['Ihre bearbeiteten Aufgaben'],{size:17,bold:true,leading:27});
 block([`Profil: ${identity}`,'Enthalten: eigene Eingaben und Bearbeitungsstand.'],{size:10,gray:true});
 newline(9);
 if(!work.length)block(['Es wurden noch keine Aufgaben beantwortet.']);
 for(let idx=0;idx<work.length;idx++){
  const q=work[idx],answer=formattedAnswer(q,progress.answers[q.id]);
  if(y<135)startPage();
  const mark=progress.outcomes?.[q.id]?.complete?'Bearbeitet und abgeschlossen':'In Bearbeitung';
  block([`${idx+1}. ${q.chapter.toUpperCase()} | AFB ${q.afb} | ${mark}`],{bold:true,size:10,leading:14});
  block(wrap(simpleText(q.prompt),92),{size:10,leading:13});
  block(['Ihre Antwort:'],{bold:true,size:9,leading:12});
  block(wrap(answer,92),{size:10,leading:13,indent:8});
  newline(13);
 }
 pageStreams.push(commands);
 const objects=[];
 objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
 objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
 objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 const pageRefs=[];
 for(let i=0;i<pageStreams.length;i++){
  const pid=5+i*2,cid=pid+1;pageRefs.push(`${pid} 0 R`);
  const stream=pageStreams[i];
  objects[pid]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`;
  objects[cid]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
 }
 objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageStreams.length} >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=1;i<objects.length;i++){
  offsets[i]=pdf.length;
  pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
 }
 const xref=pdf.length;
 pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
 for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const bytes=new Uint8Array(pdf.length);
 for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;
 return bytes;
}
export function downloadPortfolio(questions,progress,identity){
 const bytes=buildPdfBytes(questions,progress,identity);
 const blob=new Blob([bytes],{type:'application/pdf'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='RechtQuest-Lernportfolio.pdf';a.style.display='none';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
