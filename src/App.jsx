import React,{useState,useEffect} from 'react';
import './app.css';
const KEY='sports-raquettes-par-sexe-v1';
const uid=()=>crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36);
const coll=new Intl.Collator('fr',{sensitivity:'base'});
const sortNames=(a,b)=>coll.compare(a.name,b.name);
const initial=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return []}};
const download=(name,html)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 text=String(text).replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0]||'';
 const separator=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(c===separator&&!quoted){row.push(cell.trim());cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 return rows;
}
function separateName(full){
 const parts=full.trim().split(/\s+/);
 let i=0;
 while(i<parts.length-1&&parts[i]===parts[i].toLocaleUpperCase('fr')&&parts[i]!==parts[i].toLocaleLowerCase('fr'))i++;
 if(i===0)i=1;
 return {nom:parts.slice(0,i).join(' '),prenom:parts.slice(i).join(' ')};
}
function parseStudentsCSV(raw){
 const rows=parseCSV(raw);if(rows.length<2)throw Error('Le fichier CSV est vide ou ne contient pas de liste.');
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const columns=rows[0].map(norm);
 const nameCol=columns.findIndex(x=>x==='eleves'||x==='eleve'||x==='nom prenom'||x==='nom et prenom'||x==='nom');
 const sexCol=columns.findIndex(x=>x==='sexe'||x==='genre');
 if(nameCol<0||sexCol<0)throw Error('Colonnes Élèves et Sexe introuvables. Vérifie le format du CSV.');
 const students=[];const seen=new Set();let ignored=0;
 for(const row of rows.slice(1)){
  const name=(row[nameCol]||'').replace(/\s+/g,' ').trim(),gender=norm(row[sexCol]);
  const sex=['feminin','female','f','fille','girl'].includes(gender)?'F':['masculin','male','m','garcon','g','boy'].includes(gender)?'G':null;
  const key=norm(name);
  if(!name||!sex||seen.has(key)){ignored++;continue}
  seen.add(key);const {nom,prenom}=separateName(name);students.push({id:uid(),nom,prenom,name,sex,departure:null,arrival:null});
 }
 if(!students.length)throw Error('Aucun élève exploitable dans ce fichier.');
 return {students:students.sort(sortNames),ignored};
}
function allocate(players,size){let groups=[];for(let i=0;i<players.length;i+=size)groups.push(players.slice(i,i+size));if(groups.length>1&&groups.at(-1).length===1)groups.at(-2).push(groups.pop()[0]);return groups}
function games(ids,legs=1){let a=[];for(let leg=1;leg<=legs;leg++)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)a.push({id:uid(),a:leg===1?ids[i]:ids[j],b:leg===1?ids[j]:ids[i],sa:'',sb:'',leg});return a}
function ranking(pool){const rows=pool.ids.map(id=>({id,pts:0,for:0,against:0,wins:0,played:0}));for(const m of pool.games){if(m.sa===''||m.sb==='')continue;const a=rows.find(x=>x.id===m.a),b=rows.find(x=>x.id===m.b),sa=Number(m.sa),sb=Number(m.sb);a.played++;b.played++;a.for+=sa;a.against+=sb;b.for+=sb;b.against+=sa;if(sa>sb){a.pts+=3;a.wins++}else if(sb>sa){b.pts+=3;b.wins++}else{a.pts++;b.pts++}}return rows.sort((a,b)=>b.pts-a.pts||b.wins-a.wins||(b.for-b.against)-(a.for-a.against)||b.for-a.for)}
function schedulePool(pool,leg,courts,withRef){
 const pending=pool.games.filter(m=>(m.leg||1)===leg);
 const batches=[];let rest=[...pending];let refCounts={};
 while(rest.length){
  const used=new Set(),gamesNow=[];
  const cap=Math.min(Math.max(1,courts),Math.floor(pool.ids.length/(withRef?3:2)));
  for(const m of rest){
   if(gamesNow.length>=cap)break;
   if(used.has(m.a)||used.has(m.b))continue;
   const available=pool.ids.filter(id=>id!==m.a&&id!==m.b&&!used.has(id));
   if(withRef&&!available.length)continue;
   let referee=null;
   if(withRef){referee=available.sort((a,b)=>(refCounts[a]||0)-(refCounts[b]||0))[0];used.add(referee);refCounts[referee]=(refCounts[referee]||0)+1}
   used.add(m.a);used.add(m.b);gamesNow.push({game:m,referee,court:gamesNow.length+1});
  }
  if(!gamesNow.length){batches.push({impossible:true,games:rest});break}
  batches.push({games:gamesNow});const scheduled=new Set(gamesNow.map(x=>x.game.id));rest=rest.filter(x=>!scheduled.has(x.id));
 }
 return batches;
}
function App(){
const [chosen,setChosen]=useState([]),[assignStage,setAssignStage]=useState('departure'),[assignCourt,setAssignCourt]=useState(1),[places,setPlaces]=useState(2),[studentSearch,setStudentSearch]=useState(''),[courtDraft,setCourtDraft]=useState('8');const [importBusy,setImportBusy]=useState(false);const [classes,setClasses]=useState(initial),[id,setId]=useState(null),[tab,setTab]=useState('eleves'),[newClass,setNewClass]=useState(''),[student,setStudent]=useState(''),[sex,setSex]=useState('F'),[size,setSize]=useState(4),[mode,setMode]=useState('points'),[target,setTarget]=useState(11),[courtCount,setCourtCount]=useState(8),[poolCourtDraft,setPoolCourtDraft]=useState('8'),[selected,setSelected]=useState(null),[genderView,setGenderView]=useState('F'),[legs,setLegs]=useState(1),[referees,setReferees]=useState(false),[roundView,setRoundView]=useState(1),[poolView,setPoolView]=useState(null),[poolCourts,setPoolCourts]=useState({}),[reportStudent,setReportStudent]=useState(null),[attendanceOpen,setAttendanceOpen]=useState(false);
useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(classes))},[classes]);
const active=classes.find(c=>c.id===id);
const setCourtTotal=(n)=>{const value=Math.min(40,Math.max(1,Math.floor(Number(n)||1)));const occupied=active?.players?.some(p=>p.departure>value||p.arrival>value);if(occupied&&!confirm('Des élèves sont affectés à des terrains au-delà de '+value+'. Leurs affectations seront effacées. Continuer ?')){setCourtDraft(String(courtCount));return;}if(occupied)update(c=>({...c,players:c.players.map(p=>({...p,departure:p.departure>value?null:p.departure,arrival:p.arrival>value?null:p.arrival}))}));setCourtCount(value);setCourtDraft(String(value));setChosen([])};
const update=f=>setClasses(cs=>cs.map(c=>c.id===id?f(c):c));
const players=active?.players||[];
const available=players.filter(p=>(p.attendance|| (p.inactive?'absent':'present'))==='present');
const poolGroups=g=>active?.pools.filter(p=>p.gender===g)||[];
const exportBackup=()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,classes},null,2)],{type:'application/json'}));a.href=url;a.download='raquettes-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)};
const importBackup=async(e)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.classes)||!data.classes.every(c=>typeof c.name==='string'&&Array.isArray(c.players)&&Array.isArray(c.pools)))throw Error('Format de sauvegarde non reconnu');if(!confirm('Cette restauration remplacera les classes actuellement enregistrées sur cet iPad. Continuer ?'))return;setClasses(data.classes);setId(null);setTab('eleves')}catch(err){alert('Import impossible : '+err.message)}};
const name=x=>players.find(p=>p.id===x)?.name||'?';
const addClass=()=>{if(!newClass.trim())return;let c={id:uid(),name:newClass.trim(),players:[],rounds:[],pools:[],history:[]};setClasses(cs=>[...cs,c]);setId(c.id);setNewClass('')};
const importFile=async(event)=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 setImportBusy(true);
 try{
  const {students,ignored}=parseStudentsCSV(await file.text());
  const proposed=file.name.replace(/\\.csv$/i,'').replace(/^(liste[ _-]*)/i,'').trim()||'Nouvelle classe';
  const className=prompt('Nom de la classe à créer :',proposed);
  if(className===null)return;
  const trimmed=className.trim();if(!trimmed){alert('Le nom de la classe ne peut pas être vide.');return}
  if(classes.some(c=>c.name.toLocaleLowerCase('fr')===trimmed.toLocaleLowerCase('fr'))){alert('Une classe porte déjà ce nom. Choisis un autre nom : aucune donnée existante ne sera remplacée.');return}
  const c={id:uid(),name:trimmed,players:students,rounds:[],pools:[],history:[]};
  setClasses(cs=>[...cs,c]);setId(c.id);setTab('eleves');
  alert(students.length+' élèves importés dans '+trimmed+' : '+students.filter(x=>x.sex==='F').length+' filles et '+students.filter(x=>x.sex==='G').length+' garçons.'+(ignored?' ('+ignored+' ligne(s) ignorée(s)).':''));
 }catch(e){alert('Import impossible : '+e.message)}
 finally{setImportBusy(false)}
};
const deleteClass=(classId)=>{const c=classes.find(x=>x.id===classId);if(!c)return;const confirmation=prompt('Suppression définitive de '+c.name+' et de ses résultats. Pour confirmer, saisis exactement : '+c.name);if(confirmation!==c.name)return;setClasses(cs=>cs.filter(x=>x.id!==classId));if(id===classId){setId(null);setTab('eleves')}};
const setAttendance=(pid,status)=>update(c=>({...c,players:c.players.map(p=>p.id===pid?{...p,attendance:status,inactive:status!=='present'}:p)}));
const toggleInactive=(pid)=>update(c=>({...c,players:c.players.map(p=>p.id===pid?{...p,inactive:!p.inactive}:p)}));
const addStudent=()=>{if(!student.trim()||!active)return;update(c=>({...c,players:[...c.players,{id:uid(),...separateName(student.trim()),name:student.trim(),sex,departure:null,arrival:null}]}));setStudent('')};
const assignSelected=(court)=>{if(!chosen.length)return;const selectedCourt=Number(court);const existing=players.filter(p=>p[assignStage]===selectedCourt&&!chosen.includes(p.id));if(existing.length+chosen.length>places){alert('Ce terrain dispose de '+places+' places. Libère des places ou sélectionne moins d’élèves.');return}update(c=>({...c,players:c.players.map(p=>chosen.includes(p.id)?{...p,[assignStage]:selectedCourt}:p)}));setChosen([])};
const unassignStudent=(studentId)=>{update(c=>({...c,players:c.players.map(p=>p.id===studentId?{...p,[assignStage]:null}:p)}));};
const clearSelected=()=>{if(!chosen.length)return;update(c=>({...c,players:c.players.map(p=>chosen.includes(p.id)?{...p,[assignStage]:null}:p)}));setChosen([])};
const assign=(studentId,field,n)=>update(c=>({...c,players:c.players.map(p=>p.id===studentId?{...p,[field]:n}:p)}));
const createPools=()=>{if(!active||!available.length)return;if(active.pools.length&&!confirm('Recréer les poules ? Les rencontres en cours seront perdues (l’historique reste conservé).'))return;const ordered=[...available].sort((a,b)=>(a.arrival??999)-(b.arrival??999)||(a.departure??999)-(b.departure??999)||sortNames(a,b));const pools=[];for(const gender of ['F','G']){const poolSets=allocate(ordered.filter(x=>x.sex===gender),Math.max(2,Number(size)||4));poolSets.forEach((set,i)=>pools.push({id:uid(),gender,level:i+1,ids:set.map(x=>x.id),games:games(set.map(x=>x.id),legs)}))}update(c=>({...c,pools,settings:{legs,courtCount,referees,mode,target},rotations:{F:1,G:1},rotation:1,history:[...c.history,{type:'constitution',at:new Date().toISOString(),pools:pools.map(p=>({gender:p.gender,level:p.level,ids:p.ids}))}]}));setTab('poules')};
const changeScore=(poolId,gameId,key,value)=>update(c=>({...c,pools:c.pools.map(p=>p.id===poolId?{...p,games:p.games.map(g=>g.id===gameId?{...g,[key]:value}:g)}:p)}));
const completed=p=>p.games.every(m=>m.sa!==''&&m.sb!=='');
const advance=(gender)=>{const current=poolGroups(gender);if(!current.length||!current.every(completed)){alert('Termine les rencontres de ce championnat avant de passer à la rotation suivante.');return}
const ps=[...current].sort((a,b)=>a.level-b.level),ranks=ps.map(p=>ranking(p).map(x=>x.id)),next=[];
ps.forEach((p,i)=>{const standing=ranks[i];let ids=standing.filter((x,j)=>!(i>0&&j===0)&&!(i<ps.length-1&&j===standing.length-1));if(i>0)ids.push(ranks[i-1].at(-1));if(i<ps.length-1)ids.push(ranks[i+1][0]);next.push({...p,id:uid(),ids,games:games(ids,active.settings?.legs||1)})});
const before=ps.flatMap(p=>p.ids).sort(),after=next.flatMap(p=>p.ids).sort();if(before.length!==after.length||before.some((x,i)=>x!==after[i])){alert('Rotation interrompue : incohérence des effectifs.');return}
update(c=>({...c,pools:[...c.pools.filter(p=>p.gender!==gender),...next],rotations:{F:c.rotations?.F||1,G:c.rotations?.G||1,[gender]:(c.rotations?.[gender]||1)+1},history:[...c.history,{type:'rotation',gender,at:new Date().toISOString(),pools:ps.map(p=>({gender:p.gender,level:p.level,ranking:ranking(p),ids:[...p.ids],games:p.games.map(m=>({...m})),rotation:c.rotations?.[gender]||1}))}]}));setPoolView(null);setRoundView(1)};
const newCourtSession=()=>{if(!active)return;if(!confirm('Nouvelle séance : reprendre les arrivées précédentes comme terrains de départ ? Les anciennes séances restent dans le bilan.'))return;update(c=>({...c,players:c.players.map(p=>({...p,departure:p.arrival??p.departure??null,arrival:null})),history:[...c.history,{type:'nouvelle-seance',at:new Date().toISOString(),players:c.players.map(p=>({id:p.id,departure:p.arrival??p.departure??null}))}]}));setAssignStage('departure');setChosen([]);setStudentSearch('')};
const saveRound=()=>update(c=>({...c,history:[...c.history,{type:'terrains',at:new Date().toISOString(),players:c.players.map(p=>({id:p.id,departure:p.departure,arrival:p.arrival}))}]}));
const studentReport=(pid)=>{if(!active)return {terrains:[],rounds:[],matches:[],wins:0,losses:0,draws:0};
 const terrains=active.history.filter(h=>h.type==='terrains'||h.type==='nouvelle-seance').map((h,i)=>({...h,number:i+1,record:h.players?.find(p=>p.id===pid)})).filter(h=>h.record);
 const pools=[...active.history.filter(h=>h.type==='rotation').flatMap(h=>(h.pools||[]).map(p=>({...p,at:h.at,rotation:p.rotation||1}))),...active.pools.map(p=>({...p,at:'En cours',rotation:active.rotations?.[p.gender]||1}))];
 const rounds=pools.filter(p=>p.ids?.includes(pid)||p.ranking?.some(r=>r.id===pid)).map(p=>({gender:p.gender,level:p.level,rotation:p.rotation,at:p.at,rank:p.ranking?.findIndex(r=>r.id===pid)+1|| (p.at==='En cours'?ranking(p).findIndex(r=>r.id===pid)+1:null)}));
 const matches=pools.flatMap(p=>(p.games||[]).filter(m=>m.a===pid||m.b===pid).map(m=>({id:m.id,pool:p.level,rotation:p.rotation,at:p.at,leg:m.leg||1,opponent:m.a===pid?m.b:m.a,scored:m.a===pid?m.sa:m.sb,conceded:m.a===pid?m.sb:m.sa})));
 let wins=0,losses=0,draws=0;for(const m of matches){if(m.scored===''||m.conceded==='')continue;if(+m.scored>+m.conceded)wins++;else if(+m.scored<+m.conceded)losses++;else draws++}
 return {terrains,rounds,matches,wins,losses,draws};
};
const exportHTML=()=>{if(!active)return;
 const sections=players.slice().sort(sortNames).map(p=>{const r=studentReport(p.id);
 const terrainRows=r.terrains.map(h=>'<tr><td>'+esc(new Date(h.at).toLocaleDateString('fr-FR'))+'</td><td>'+esc(h.record.departure??'—')+'</td><td>'+esc(h.record.arrival??'—')+'</td></tr>').join('');
 const rounds=r.rounds.map(x=>'<li>Rotation '+esc(x.rotation)+' · Poule '+esc(x.level)+' · Rang '+esc(x.rank??'—')+'</li>').join('');
 const matches=r.matches.map(m=>'<tr><td>'+esc(m.rotation)+'</td><td>'+esc(m.pool)+'</td><td>'+esc(m.leg===1?'Aller':'Retour')+'</td><td>'+esc(name(m.opponent))+'</td><td>'+esc(m.scored===''?'—':m.scored+' - '+m.conceded)+'</td></tr>').join('');
 return '<section><h2>'+esc(p.name)+'</h2><p>'+r.wins+' victoires · '+r.losses+' défaites · '+r.draws+' nuls</p><h3>Montée-descente</h3><table><tr><th>Date</th><th>Départ</th><th>Arrivée</th></tr>'+terrainRows+'</table><h3>Évolution en poules</h3><ol>'+rounds+'</ol><h3>Matchs et adversaires</h3><table><tr><th>Rotation</th><th>Poule</th><th>Phase</th><th>Adversaire</th><th>Score</th></tr>'+matches+'</table></section>'}).join('');
 download('bilan-raquettes-'+active.name.replace(/[^a-z0-9]/gi,'-')+'.html','<!doctype html><html lang="fr"><meta charset="utf-8"><title>Bilan '+esc(active.name)+'</title><style>body{font:15px system-ui;max-width:950px;margin:30px auto;padding:15px;color:#253952}section{padding:22px 0;border-bottom:2px solid #dce5ef}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e0e7ee;text-align:left;padding:9px}</style><h1>Bilan de cycle — '+esc(active.name)+'</h1>'+sections+'</html>')};
return <main className="raquettes-app"><header className="app-heading"><div className="eyebrow">EPS • Outils de séance</div><h1>🏸 Sport de raquettes</h1><p>Classement, montée-descente et championnats par poules • Données sauvegardées sur cet appareil</p></header>
<div className="class-toolbar" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><select value={id||''} onChange={e=>{setId(e.target.value);setTab('eleves')}}><option value="">Choisir une classe</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input placeholder="Nouvelle classe" value={newClass} onChange={e=>setNewClass(e.target.value)}/><button onClick={addClass}>Créer la classe</button><label className="csv-import">📥 {importBusy?'Importation…':'Importer un CSV'}<input type="file" accept=".csv,text/csv" disabled={importBusy} onChange={importFile}/></label></div>
<div className="backup-controls"><button onClick={exportBackup}>↓ Sauvegarder toutes les classes</button><label>↑ Restaurer une sauvegarde<input type="file" accept=".json,application/json" onChange={importBackup}/></label></div><section className="class-overview"><div className="section-heading"><div><span className="section-kicker">MES CLASSES</span><h2>Choisir une classe</h2></div><span className="class-total">{classes.length} classe{classes.length>1?'s':''}</span></div>{classes.length===0?<div className="empty-classes"><span>📚</span><h3>Votre espace est prêt</h3><p>Importez un fichier CSV ou créez une classe pour commencer.</p></div>:<div className="class-card-grid">{classes.slice().sort((a,b)=>coll.compare(a.name,b.name)).map(c=><div key={c.id} className={'class-card '+(c.id===id?'is-active':'')}><button className="class-card-main" onClick={()=>{setId(c.id);setTab('eleves')}}><span className="class-icon">🏸</span><span className="class-card-title">{c.name}</span><span className="class-card-count">{c.players.length} élèves</span><span className="class-card-breakdown"><span>♀ {c.players.filter(p=>p.sex==='F').length} filles</span><span>♂ {c.players.filter(p=>p.sex==='G').length} garçons</span></span><span className="class-card-link">{c.id===id?'Classe ouverte ✓':'Ouvrir la classe →'}</span></button><button className="class-delete" title={'Supprimer '+c.name} aria-label={'Supprimer '+c.name} onClick={()=>deleteClass(c.id)}>🗑 Supprimer</button></div>)}</div>}</section>
{active&&<><div className="stats-strip"><div><strong>{players.length}</strong><span>Élèves dans la classe</span></div><div><strong>{players.filter(p=>p.sex==='F').length}</strong><span>Filles</span></div><div><strong>{players.filter(p=>p.sex==='G').length}</strong><span>Garçons</span></div></div><nav className="module-nav" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>{[['eleves','Élèves'],['terrains','Montée-descente'],['poules','Poules'],['bilan','Bilans']].map(([value,label])=><button className={tab===value?'active':''} key={value} onClick={()=>setTab(value)}>{label}</button>)}</nav><section className="content-panel">
{tab==='eleves'&&<><div className="students-header"><div><h2>{active.name} · {players.length} élèves</h2><p>{available.length} présents · {players.filter(p=>(p.attendance||'present')==='absent').length} absents · {players.filter(p=>p.attendance==='dispense').length} dispensés</p></div><button className="primary-action" onClick={()=>setAttendanceOpen(true)}>Gérer les présences</button></div><div className="student-add"><input placeholder="Nom prénom" value={student} onChange={e=>setStudent(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addStudent()}/><select value={sex} onChange={e=>setSex(e.target.value)}><option value="F">Fille</option><option value="G">Garçon</option></select><button onClick={addStudent}>Ajouter</button></div><div className="student-roster">{players.slice().sort(sortNames).map(p=><div className="roster-row" key={p.id}><span className="roster-name">{p.name}</span><span className="roster-gender">{p.sex==='F'?'Fille':'Garçon'}</span><span className={'roster-status '+(p.attendance|| (p.inactive?'absent':'present'))}>{(p.attendance|| (p.inactive?'absent':'present'))==='present'?'Présent':(p.attendance|| (p.inactive?'absent':'present'))==='absent'?'Absent':'Dispensé'}</span><button className="roster-delete" title="Supprimer définitivement" onClick={()=>{if(confirm('Supprimer définitivement cet élève ?'))update(c=>({...c,players:c.players.filter(x=>x.id!==p.id)}))}}>×</button></div>)}</div></>}
{attendanceOpen&&active&&<div className="attendance-overlay" onClick={()=>setAttendanceOpen(false)}><div className="attendance-dialog" onClick={e=>e.stopPropagation()}><h2>Présents / absents / dispensés</h2><p>Indique le statut de chaque élève pour la séance. Les résultats déjà enregistrés sont conservés.</p><div className="attendance-rows">{players.slice().sort(sortNames).map(p=><div key={p.id} className="attendance-row"><strong>{p.name}</strong><div>{[['present','Présent'],['absent','Absent'],['dispense','Dispensé']].map(([val,label])=><button key={val} className={'attendance-choice '+val+' '+((p.attendance|| (p.inactive?'absent':'present'))===val?'active':'')} onClick={()=>setAttendance(p.id,val)}>{label}</button>)}</div></div>)}</div><div className="attendance-footer"><span>{available.length} présents · {players.filter(p=>(p.attendance|| (p.inactive?'absent':'present'))==='absent').length} absents · {players.filter(p=>p.attendance==='dispense').length} dispensés</span><button className="primary-action" onClick={()=>setAttendanceOpen(false)}>Terminer</button></div></div></div>}
{tab==='terrains'&&<><div className="terrain-heading"><div><span className="section-kicker">MONTEE - DESCENTE</span><h2>Répartition des élèves</h2><p>Sélectionne les élèves à gauche, puis touche le terrain à droite.</p></div></div>
<div className="court-options"><label>Terrains <input type="number" min="1" max="40" value={courtDraft} onChange={e=>setCourtDraft(e.target.value)} onBlur={()=>setCourtTotal(courtDraft)} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur()}}}/></label><button onClick={()=>setCourtTotal(Math.max(1,Math.ceil(players.length/places)))}>Adapter aux élèves</button><label>Places / terrain <select value={places} onChange={e=>setPlaces(Number(e.target.value))}><option value={2}>2 joueurs</option><option value={3}>3 joueurs</option><option value={4}>4 joueurs</option></select></label><span>{players.length} élèves · {courtCount*places} places</span></div>
<div className="terrain-stage"><button className={assignStage==='departure'?'active':''} onClick={()=>{setAssignStage('departure');setChosen([])}}>1 · Départ ({players.filter(p=>p.departure!=null).length}/{players.length})</button><button className={assignStage==='arrival'?'active':''} onClick={()=>{setAssignStage('arrival');setChosen([])}}>2 · Arrivée ({players.filter(p=>p.arrival!=null).length}/{players.length})</button></div>
<div className="court-help">Touche un ou plusieurs élèves, puis leur table ou terrain {assignStage==='departure'?'de départ':'d’arrivée'}.</div>
<div className="court-workspace"><div><input className="search-students" placeholder="Rechercher un élève…" value={studentSearch} onChange={e=>setStudentSearch(e.target.value)}/><div className="court-students">{available.slice().sort(sortNames).filter(p=>p[assignStage]==null&&p.name.toLocaleLowerCase('fr').includes(studentSearch.toLocaleLowerCase('fr'))).map(p=><button type="button" key={p.id} className={'court-student '+(chosen.includes(p.id)?'picked':'')} onClick={()=>setChosen(list=>list.includes(p.id)?list.filter(x=>x!==p.id):[...list,p.id])}><strong>{p.name}</strong><small>Départ : {p.departure??'—'} · Arrivée : {p.arrival??'—'}</small><span>{chosen.includes(p.id)?'✓':''}</span></button>)}</div></div>
<div><h3>Terrains {assignStage==='departure'?'de départ':'d’arrivée'}</h3><div className="court-destinations">{Array.from({length:courtCount},(_,i)=>{const number=i+1,occupants=players.filter(p=>p[assignStage]===number);return <div className={'court-destination '+(occupants.length>=places?'full':'')} key={number}><button type="button" className="court-assign-target" disabled={!chosen.length} onClick={()=>assignSelected(number)}><strong>Terrain {number}</strong><small>{occupants.length}/{places} places · Toucher pour attribuer</small></button><div className="court-occupants">{Array.from({length:Math.max(places,occupants.length)},(_,slot)=>occupants[slot]?<button type="button" key={occupants[slot].id} className="court-occupant" title={'Retirer '+occupants[slot].name} onClick={()=>unassignStudent(occupants[slot].id)}>{occupants[slot].name} <span>×</span></button>:<span className="court-empty-slot" key={'empty'+slot}>Place libre</span>)}</div></div>})}</div></div></div>
<div className="court-bottom"><span>{players.filter(p=>p[assignStage]!=null).length} / {players.length} élèves placés · {chosen.length} sélectionné(s)</span><button disabled={!chosen.length} onClick={clearSelected}>Retirer de ce terrain</button><button disabled={!chosen.length} onClick={()=>setChosen([])}>Annuler la sélection</button></div>
<div className="terrain-finish">{assignStage==='departure'&&<button className="primary-action" onClick={()=>{setAssignStage('arrival');setChosen([]);setStudentSearch('')}}>Passer aux terrains d’arrivée →</button>}<button onClick={saveRound}>Enregistrer le classement</button><button className="primary-action" onClick={createPools}>Créer les poules →</button></div></>}
{tab==='poules'&&<><h2>Championnat par poules</h2>
<div className="pool-settings"><label>Joueurs / poule <input type="number" min="2" max="12" value={size} onChange={e=>setSize(e.target.value)}/></label><label>Terrains disponibles <input type="number" min="1" value={poolCourtDraft} onChange={e=>setPoolCourtDraft(e.target.value)} onBlur={()=>{const n=Math.max(1,Math.min(40,Number(poolCourtDraft)||1));setCourtCount(n);setPoolCourtDraft(String(n))}}/></label><label>Rencontres <select value={legs} onChange={e=>setLegs(Number(e.target.value))}><option value={1}>Aller simple</option><option value={2}>Aller-retour</option></select></label><label>Format <select value={mode} onChange={e=>setMode(e.target.value)}><option value="points">Aux points</option><option value="temps">Au temps</option></select></label><label>{mode==='temps'?'Durée (min)':'Objectif de points'} <input type="number" min="1" value={target} onChange={e=>setTarget(e.target.value)}/></label><label className="arbitrage-toggle"><input type="checkbox" checked={referees} onChange={e=>setReferees(e.target.checked)}/> Arbitrage par élève</label><button onClick={createPools}>Créer les poules</button></div>
{active.pools.length>0&&<><div className="rotation-header"><div><span className="section-kicker">CHAMPIONNAT</span><h3>Rotation n° {active.rotations?.[genderView]||1}</h3></div><span>{active.settings?.courtCount||courtCount} terrain(s) · {active.settings?.legs===2?'Aller-retour':'Aller simple'} · {active.settings?.referees?'Avec arbitrage':'Sans arbitrage'}</span></div>
<div className="sex-tabs"><button className={genderView==='F'?'active':''} onClick={()=>setGenderView('F')}>♀ Filles ({players.filter(p=>p.sex==='F').length})</button><button className={genderView==='G'?'active':''} onClick={()=>setGenderView('G')}>♂ Garçons ({players.filter(p=>p.sex==='G').length})</button></div>
<div className="sex-tabs secondary"><button className={roundView===1?'active':''} onClick={()=>setRoundView(1)}>Matchs aller</button>{(active.settings?.legs||1)===2&&<button className={roundView===2?'active':''} onClick={()=>setRoundView(2)}>Matchs retour</button>}</div>
<div className="pool-picker">{active.pools.filter(p=>p.gender===genderView).sort((a,b)=>a.level-b.level).map(p=><button key={p.id} className={(poolView||active.pools.find(x=>x.gender===genderView)?.id)===p.id?'active':''} onClick={()=>setPoolView(p.id)}>Poule {p.level}<small>{p.ids.length} joueurs</small></button>)}</div>
{active.pools.filter(p=>p.gender===genderView&&p.id===(poolView&&active.pools.some(x=>x.id===poolView&&x.gender===genderView)?poolView:active.pools.find(x=>x.gender===genderView)?.id)).map(p=>{
const availableCourts=Math.max(1,Number(poolCourts[p.id]||1));
const batches=schedulePool(p,roundView,availableCourts,!!active.settings?.referees);
const matches=p.games.filter(m=>(m.leg||1)===roundView);
const done=matches.filter(m=>m.sa!==''&&m.sb!=='').length;
return <article className="pool-card" key={p.id}>
<div className="pool-card-top"><h4>Poule {p.level} · {p.ids.length} joueurs</h4><span>{done}/{matches.length} matchs terminés</span></div>
<div className="pool-setup"><label>Terrains affectés à cette poule <select value={availableCourts} onChange={e=>setPoolCourts(x=>({...x,[p.id]:Number(e.target.value)}))}>{Array.from({length:Math.max(1,active.settings?.courtCount||courtCount)},(_,i)=><option key={i} value={i+1}>{i+1} terrain{ i>0?'s':''}</option>)}</select></label><span>{active.settings?.referees?'Arbitrage activé':'Sans arbitrage'} · Planning automatique</span></div>
<table><thead><tr><th>Classement</th><th>Points</th><th>MJ</th><th>Diff.</th></tr></thead><tbody>{ranking(p).map((r,i)=><tr key={r.id}><td>{i+1}. {name(r.id)}</td><td>{r.pts}</td><td>{r.played}</td><td>{r.for-r.against}</td></tr>)}</tbody></table>
{batches.map((batch,i)=><section className="match-series" key={i}><h4>Série {i+1}</h4>{batch.impossible?<p>Impossible de planifier avec arbitrage : il faut au moins 3 élèves disponibles dans cette poule.</p>:<div className="match-list">{batch.games.map(({game:m,referee,court})=><div className="match-row" key={m.id}><span className="match-number">Terrain {court}</span><span className="match-player">{name(m.a)}</span><input aria-label={'Score '+name(m.a)} inputMode="numeric" type="number" min="0" value={m.sa} onChange={e=>changeScore(p.id,m.id,'sa',e.target.value)}/><span className="match-dash">–</span><input aria-label={'Score '+name(m.b)} inputMode="numeric" type="number" min="0" value={m.sb} onChange={e=>changeScore(p.id,m.id,'sb',e.target.value)}/><span className="match-player">{name(m.b)}</span>{referee&&<span className="match-ref">Arbitre : {name(referee)}</span>}</div>)}</div>}</section>)}
</article>})}
<div className="rotation-footer"><p>Termine les rencontres de ce championnat avant de valider. Le premier monte, le dernier descend ; le classement est conservé dans l’historique.</p><button className="primary-action" disabled={!poolGroups(genderView).length||!poolGroups(genderView).every(completed)} onClick={()=>advance(genderView)}>Valider la rotation et préparer la suivante →</button></div></>}</>}
{tab==='bilan'&&<><h2>Bilans individuels du cycle</h2><p>Sélectionne un élève pour retrouver ses terrains, ses rotations et tous ses adversaires.</p><div className="report-list">{players.slice().sort(sortNames).map(p=><button className={reportStudent===p.id?'active':''} key={p.id} onClick={()=>setReportStudent(p.id)}>{p.name}</button>)}</div>{reportStudent&&players.some(p=>p.id===reportStudent)&&(()=>{const p=players.find(x=>x.id===reportStudent),r=studentReport(p.id);return <div className="student-report"><h3>{p.name} · Bilan de cycle</h3><div className="report-numbers"><span>{r.wins} victoire(s)</span><span>{r.losses} défaite(s)</span><span>{r.draws} nul(s)</span></div><h4>Montée-descente</h4><table><thead><tr><th>Séance</th><th>Départ</th><th>Arrivée</th></tr></thead><tbody>{r.terrains.map((h,i)=><tr key={i}><td>{new Date(h.at).toLocaleDateString('fr-FR')}</td><td>{h.record.departure??'—'}</td><td>{h.record.arrival??'—'}</td></tr>)}</tbody></table><h4>Évolution des poules</h4>{r.rounds.map((x,i)=><p key={i}>Rotation {x.rotation} · Poule {x.level} · Position {x.rank??'—'}</p>)}<h4>Matchs et adversaires</h4><table><thead><tr><th>Rotation</th><th>Adversaire</th><th>Score</th><th>Résultat</th></tr></thead><tbody>{r.matches.map(m=><tr key={m.id}><td>{m.rotation} · {m.leg===1?'Aller':'Retour'}</td><td>{name(m.opponent)}</td><td>{m.scored===''?'—':m.scored+' - '+m.conceded}</td><td>{m.scored===''||m.conceded===''?'À jouer':+m.scored>+m.conceded?'Victoire':+m.scored<+m.conceded?'Défaite':'Nul'}</td></tr>)}</tbody></table></div>})()}<button className="primary-action" onClick={exportHTML}>Exporter le bilan HTML de toute la classe</button></>}</section></>}
</main>
}
export default App;
