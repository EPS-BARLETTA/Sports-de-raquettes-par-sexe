import React from 'react';
const sections=[
['01','LE SERVICE','🏓',['Balle sur la paume ouverte, lancée presque verticalement d’au moins 16 cm.','La balle doit rester visible et derrière la ligne de fond.','Elle rebondit d’abord dans mon camp, puis dans le camp adverse.']],
['02','LE FILET','🟢',['En échange : filet touché + balle sur la table adverse = jeu valable.','Au service : filet touché + service autrement correct = service à refaire (let).','Filet touché + balle qui ne passe pas correctement = point perdu.']],
['03','LES FAUTES','🔴',['Balle envoyée hors de la table adverse ou dans le filet.','Deux rebonds dans son propre camp avant de renvoyer.','Main libre posée sur la surface de jeu, table déplacée ou filet touché pendant l’échange.']],
['04','INTERCEPTER LA BALLE','✋',['Une balle qui va encore vers la surface de jeu ne doit pas être interceptée avant son rebond : obstruction.','Si elle a déjà dépassé la ligne de fond sans toucher la table, le point est gagné : on peut la récupérer.','On frappe la balle après son rebond dans son camp, avant un deuxième rebond.']],
['05','COMPTER LES POINTS','🏆',['Un set se joue en 11 points, avec 2 points d’écart.','Service alterné tous les 2 points, puis à chaque point dès 10–10.','En EPS, le format des rencontres peut être adapté par le professeur.']],
['06','FAIR-PLAY','🤝',['Respecter l’adversaire et les décisions de l’arbitre.','Annoncer le score clairement avant chaque service.','Serrer la main en fin de rencontre.']]
];
export default function ReglesEssentielles({onClose}){
 const [fullscreen,setFullscreen]=React.useState(false);
 React.useEffect(()=>{const f=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f)},[onClose]);
 return <div role="dialog" aria-modal="true" aria-label="Règles essentielles du tennis de table" style={{position:'fixed',inset:0,zIndex:9999,background:'#091a30ed',padding:fullscreen?0:'min(3vh,24px)',overflowY:'auto'}}>
 <div style={{maxWidth:fullscreen?'none':1500,margin:'auto',background:'#f3f8fc',borderRadius:fullscreen?0:18,minHeight:'100%',overflow:'hidden'}}>
 <header style={{background:'#103960',color:'white',padding:'18px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
 <div><div style={{fontSize:'clamp(22px,3vw,40px)',fontWeight:900}}>🏓 TENNIS DE TABLE — RÈGLES ESSENTIELLES</div><div style={{fontSize:16}}>À connaître en EPS · Simple</div></div>
 <div style={{display:'flex',gap:8}}><button onClick={()=>setFullscreen(x=>!x)} style={{padding:'12px 16px',borderRadius:10,background:'#d7ebfa',color:'#103960',fontWeight:700}}>{fullscreen?'Réduire':'⛶ Agrandir'}</button><button onClick={onClose} aria-label="Fermer les règles" style={{padding:'12px 16px',borderRadius:10,background:'#fff',color:'#103960',fontWeight:700}}>✕ Fermer</button></div>
 </header>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,360px),1fr))',gap:14,padding:18}}>
 {sections.map(([num,title,emoji,items],i)=><section key={num} style={{background:'white',border:'2px solid #d6e5f0',borderRadius:14,overflow:'hidden',boxShadow:'0 3px 12px #14355412'}}>
 <h2 style={{margin:0,padding:'14px 18px',fontSize:'clamp(18px,1.7vw,26px)',background:i===5?'#187a5d':i===2?'#b63e3e':'#146aa4',color:'white'}}>{num} · {emoji} {title}</h2>
 <ul style={{margin:0,padding:'18px 24px 20px 38px',fontSize:'clamp(16px,1.25vw,21px)',lineHeight:1.45,color:'#172c42'}}>{items.map((item,j)=><li key={j} style={{marginBottom:12}}>{item}</li>)}</ul>
 </section>)}
 </div><footer style={{padding:'10px 20px 20px',textAlign:'center',fontSize:18,fontWeight:700,color:'#103960'}}>Un jeu rapide, précis et fair-play !</footer></div></div>;
}
