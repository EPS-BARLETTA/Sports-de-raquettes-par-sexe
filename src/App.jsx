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
function App(){
const [importBusy,setImportBusy]=useState(false);const [classes,setClasses]=useState(initial),[id,setId]=useState(null),[tab,setTab]=useState('eleves'),[newClass,setNewClass]=useState(''),[student,setStudent]=useState(''),[sex,setSex]=useState('F'),[size,setSize]=useState(4),[mode,setMode]=useState('points'),[target,setTarget]=useState(11),[courtCount,setCourtCount]=useState(8),[selected,setSelected]=useState(null),[genderView,setGenderView]=useState('F'),[legs,setLegs]=useState(1),[referees,setReferees]=useState(false),[roundView,setRoundView]=useState(1);
useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(classes))},[classes]);
const active=classes.find(c=>c.id===id);
const update=f=>setClasses(cs=>cs.map(c=>c.id===id?f(c):c));
const players=active?.players||[];
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
const addStudent=()=>{if(!student.trim()||!active)return;update(c=>({...c,players:[...c.players,{id:uid(),...separateName(student.trim()),name:student.trim(),sex,departure:null,arrival:null}]}));setStudent('')};
const assign=(studentId,field,n)=>update(c=>({...c,players:c.players.map(p=>p.id===studentId?{...p,[field]:n}:p)}));
const createPools=()=>{if(!active||!players.length)return;if(active.pools.length&&!confirm('Recréer les poules ? Les rencontres en cours seront perdues (l’historique reste conservé).'))return;const ordered=[...players].sort((a,b)=>(a.arrival??999)-(b.arrival??999)||(a.departure??999)-(b.departure??999)||sortNames(a,b));const pools=[];for(const gender of ['F','G']){const poolSets=allocate(ordered.filter(x=>x.sex===gender),Math.max(2,Number(size)||4));poolSets.forEach((set,i)=>pools.push({id:uid(),gender,level:i+1,ids:set.map(x=>x.id),games:games(set.map(x=>x.id),legs)}))}update(c=>({...c,pools,settings:{legs,courtCount,referees,mode,target},rotation:1,history:[...c.history,{type:'constitution',at:new Date().toISOString(),pools:pools.map(p=>({gender:p.gender,level:p.level,ids:p.ids}))}]}));setTab('poules')};
const changeScore=(poolId,gameId,key,value)=>update(c=>({...c,pools:c.pools.map(p=>p.id===poolId?{...p,games:p.games.map(g=>g.id===gameId?{...g,[key]:value}:g)}:p)}));
const completed=p=>p.games.every(m=>m.sa!==''&&m.sb!=='');
const advance=()=>{if(!active?.pools.length||!active.pools.every(completed)){alert('Terminez toutes les rencontres avant de passer à la rotation suivante.');return}
const next=[];for(const gender of ['F','G']){
 const ps=active.pools.filter(p=>p.gender===gender).sort((a,b)=>a.level-b.level);
 const ranks=ps.map(p=>ranking(p).map(x=>x.id));
 ps.forEach((p,i)=>{
  const standing=ranks[i];
  let ids=standing.filter((playerId,index)=>!(i>0&&index===0)&&!(i<ps.length-1&&index===standing.length-1));
  if(i>0)ids.push(ranks[i-1][ranks[i-1].length-1]);
  if(i<ps.length-1)ids.push(ranks[i+1][0]);
  next.push({...p,id:uid(),ids,games:games(ids,active.settings?.legs||1)});
 });
}
const before=active.pools.flatMap(p=>p.ids).sort();
const after=next.flatMap(p=>p.ids).sort();
if(before.length!==after.length||before.some((x,i)=>x!==after[i])){alert('Rotation interrompue : incohérence dans les effectifs. Aucune donnée modifiée.');return}
update(c=>({...c,pools:next,rotation:(c.rotation||1)+1,history:[...c.history,{type:'rotation',at:new Date().toISOString(),pools:active.pools.map(p=>({gender:p.gender,level:p.level,ranking:ranking(p)}))}]}))};
const saveRound=()=>update(c=>({...c,history:[...c.history,{type:'terrains',at:new Date().toISOString(),players:c.players.map(p=>({id:p.id,departure:p.departure,arrival:p.arrival}))}]}));
const exportHTML=()=>{if(!active)return;const lines=players.slice().sort(sortNames).map(p=>{let h=active.history.map((event,i)=>{if(event.type==='terrains'){const r=event.players.find(x=>x.id===p.id);return r?'<li>Séance '+(i+1)+' : départ '+esc(r.departure??'—')+', arrivée '+esc(r.arrival??'—')+'</li>':''}const po=event.pools.find(x=>x.ids?.includes(p.id)||x.ranking?.some(y=>y.id===p.id));if(!po)return '';let position=po.ranking?.findIndex(x=>x.id===p.id);return '<li>'+esc(event.type)+' : '+(po.gender==='F'?'Filles':'Garçons')+', poule '+po.level+(position>=0?', rang '+(position+1):'')+'</li>'}).join('');return '<section><h2>'+esc(p.name)+' ('+esc(p.sex)+')</h2><ol>'+h+'</ol></section>'}).join('');download('bilan-raquettes-'+active.name.replace(/[^a-z0-9]/gi,'-')+'.html','<!doctype html><html lang="fr"><meta charset="utf-8"><title>Bilan '+esc(active.name)+'</title><style>body{font:16px system-ui;max-width:850px;margin:32px auto;padding:16px}section{border-top:1px solid #ddd;padding:12px}li{margin:6px}</style><h1>Bilan — '+esc(active.name)+'</h1><p>Export du '+new Date().toLocaleDateString('fr-FR')+'</p>'+lines+'</html>')};
return <main className="raquettes-app"><header className="app-heading"><div className="eyebrow">EPS • Outils de séance</div><h1>🏸 Sport de raquettes</h1><p>Classement, montée-descente et championnats par poules • Données sauvegardées sur cet appareil</p></header>
<div className="class-toolbar" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><select value={id||''} onChange={e=>{setId(e.target.value);setTab('eleves')}}><option value="">Choisir une classe</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input placeholder="Nouvelle classe" value={newClass} onChange={e=>setNewClass(e.target.value)}/><button onClick={addClass}>Créer la classe</button><label className="csv-import">📥 {importBusy?'Importation…':'Importer un CSV'}<input type="file" accept=".csv,text/csv" disabled={importBusy} onChange={importFile}/></label></div>
<section className="class-overview"><div className="section-heading"><div><span className="section-kicker">MES CLASSES</span><h2>Choisir une classe</h2></div><span className="class-total">{classes.length} classe{classes.length>1?'s':''}</span></div>{classes.length===0?<div className="empty-classes"><span>📚</span><h3>Votre espace est prêt</h3><p>Importez un fichier CSV ou créez une classe pour commencer.</p></div>:<div className="class-card-grid">{classes.slice().sort((a,b)=>coll.compare(a.name,b.name)).map(c=><div key={c.id} className={'class-card '+(c.id===id?'is-active':'')}><button className="class-card-main" onClick={()=>{setId(c.id);setTab('eleves')}}><span className="class-icon">🏸</span><span className="class-card-title">{c.name}</span><span className="class-card-count">{c.players.length} élèves</span><span className="class-card-breakdown"><span>♀ {c.players.filter(p=>p.sex==='F').length} filles</span><span>♂ {c.players.filter(p=>p.sex==='G').length} garçons</span></span><span className="class-card-link">{c.id===id?'Classe ouverte ✓':'Ouvrir la classe →'}</span></button><button className="class-delete" title={'Supprimer '+c.name} aria-label={'Supprimer '+c.name} onClick={()=>deleteClass(c.id)}>🗑 Supprimer</button></div>)}</div>}</section>
{active&&<><div className="stats-strip"><div><strong>{players.length}</strong><span>Élèves dans la classe</span></div><div><strong>{players.filter(p=>p.sex==='F').length}</strong><span>Filles</span></div><div><strong>{players.filter(p=>p.sex==='G').length}</strong><span>Garçons</span></div></div><nav className="module-nav" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>{[['eleves','Élèves'],['terrains','Montée-descente'],['poules','Poules'],['bilan','Bilans']].map(([value,label])=><button className={tab===value?'active':''} key={value} onClick={()=>setTab(value)}>{label}</button>)}</nav><section className="content-panel">
{tab==='eleves'&&<><h2>{active.name} — {players.length} élèves</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input placeholder="Nom prénom" value={student} onChange={e=>setStudent(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addStudent()}/><select value={sex} onChange={e=>setSex(e.target.value)}><option value="F">Fille</option><option value="G">Garçon</option></select><button onClick={addStudent}>Ajouter</button></div><div className="student-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8,marginTop:18}}>{players.slice().sort(sortNames).map(p=><div className="student-card" key={p.id}><strong>{p.nom||p.name} {p.prenom||''}</strong> · {p.sex==='F'?'Fille':'Garçon'} <button title="Supprimer" onClick={()=>{if(confirm('Supprimer cet élève ?'))update(c=>({...c,players:c.players.filter(x=>x.id!==p.id)}))}}>×</button></div>)}</div></>}
{tab==='terrains'&&<><h2>Classement initial par montée-descente</h2><label>Nombre de terrains <input type="number" min="1" value={courtCount} onChange={e=>setCourtCount(Math.max(1,Number(e.target.value)))}/></label><p>Clique sur la case d'un élève, puis attribue son terrain de départ et d'arrivée. Les valeurs restent modifiables.</p><div className="court-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>{players.slice().sort(sortNames).map(p=><div className={'court-card '+(selected===p.id?'selected':'')} key={p.id} onClick={()=>setSelected(p.id)}><strong>{p.name}</strong><p>{p.sex==='F'?'Fille':'Garçon'}</p>{['departure','arrival'].map((f)=><label key={f} style={{display:'block',marginTop:8}}>{f==='departure'?'Départ':'Arrivée'} <select value={p[f]??''} onClick={e=>e.stopPropagation()} onChange={e=>assign(p.id,f,e.target.value===''?null:Number(e.target.value))}><option value="">—</option>{Array.from({length:courtCount},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>)}</div>)}</div><p><button onClick={saveRound}>Enregistrer cette séance</button></p><p>Le terrain 1 correspond au classement le plus élevé.</p><button className="primary-action" onClick={createPools}>Constituer les poules à partir des arrivées →</button></>}
{tab==='poules'&&<><h2>Championnat par poules</h2>
<div className="pool-settings"><label>Joueurs / poule <input type="number" min="2" max="12" value={size} onChange={e=>setSize(e.target.value)}/></label><label>Terrains disponibles <input type="number" min="1" value={courtCount} onChange={e=>setCourtCount(Math.max(1,Number(e.target.value)||1))}/></label><label>Rencontres <select value={legs} onChange={e=>setLegs(Number(e.target.value))}><option value={1}>Aller simple</option><option value={2}>Aller-retour</option></select></label><label>Format <select value={mode} onChange={e=>setMode(e.target.value)}><option value="points">Aux points</option><option value="temps">Au temps</option></select></label><label>{mode==='temps'?'Durée (min)':'Objectif de points'} <input type="number" min="1" value={target} onChange={e=>setTarget(e.target.value)}/></label><label className="arbitrage-toggle"><input type="checkbox" checked={referees} onChange={e=>setReferees(e.target.checked)}/> Arbitrage par élève</label><button onClick={createPools}>Créer les poules</button></div>
{active.pools.length>0&&<><div className="rotation-header"><div><span className="section-kicker">CHAMPIONNAT</span><h3>Rotation n° {active.rotation||1}</h3></div><span>{active.settings?.courtCount||courtCount} terrain(s) · {active.settings?.legs===2?'Aller-retour':'Aller simple'} · {active.settings?.referees?'Avec arbitrage':'Sans arbitrage'}</span></div>
<div className="sex-tabs"><button className={genderView==='F'?'active':''} onClick={()=>setGenderView('F')}>♀ Filles ({players.filter(p=>p.sex==='F').length})</button><button className={genderView==='G'?'active':''} onClick={()=>setGenderView('G')}>♂ Garçons ({players.filter(p=>p.sex==='G').length})</button></div>
<div className="sex-tabs secondary"><button className={roundView===1?'active':''} onClick={()=>setRoundView(1)}>Matchs aller</button>{(active.settings?.legs||1)===2&&<button className={roundView===2?'active':''} onClick={()=>setRoundView(2)}>Matchs retour</button>}</div>
{active.pools.filter(p=>p.gender===genderView).sort((a,b)=>a.level-b.level).map(p=>{const matches=p.games.filter(m=>(m.leg||1)===roundView);const done=matches.filter(m=>m.sa!==''&&m.sb!=='').length;return <article className="pool-card" key={p.id}><div className="pool-card-top"><h4>Poule {p.level}</h4><span>{done}/{matches.length} matchs</span></div><table><thead><tr><th>Rang / Joueur</th><th>Points</th><th>MJ</th><th>Diff.</th></tr></thead><tbody>{ranking(p).map((r,i)=><tr key={r.id}><td>{i+1}. {name(r.id)}</td><td>{r.pts}</td><td>{r.played}</td><td>{r.for-r.against}</td></tr>)}</tbody></table><div className="match-list">{matches.map((m,i)=><div className="match-row" key={m.id}><span className="match-number">M{i+1}</span><span className="match-player">{name(m.a)}</span><input aria-label={'Score '+name(m.a)} inputMode="numeric" type="number" min="0" value={m.sa} onChange={e=>changeScore(p.id,m.id,'sa',e.target.value)}/><span className="match-dash">–</span><input aria-label={'Score '+name(m.b)} inputMode="numeric" type="number" min="0" value={m.sb} onChange={e=>changeScore(p.id,m.id,'sb',e.target.value)}/><span className="match-player">{name(m.b)}</span>{active.settings?.referees&&<span className="match-ref">Arbitre : {p.ids.find(x=>x!==m.a&&x!==m.b)?name(p.ids.find(x=>x!==m.a&&x!==m.b)):'Externe'}</span>}</div>)}</div></article>})}
<div className="rotation-footer"><p>Termine toutes les rencontres des deux championnats avant de valider. Le premier monte, le dernier descend ; le classement est conservé dans l’historique.</p><button className="primary-action" disabled={!active.pools.every(completed)} onClick={()=>{advance();setRoundView(1)}}>Valider la rotation et préparer la suivante →</button></div></>}</>}
{tab==='bilan'&&<><h2>Historique et bilans</h2><p>{active.history.length} étapes enregistrées. Export HTML individuel regroupé dans un fichier consultable hors ligne.</p><button className="primary-action" onClick={exportHTML}>Télécharger les bilans HTML</button><ol>{active.history.map((h,i)=><li key={i}>{new Date(h.at).toLocaleString('fr-FR')} — {h.type}</li>)}</ol></>}
</section></>}
</main>
}
export default App;
