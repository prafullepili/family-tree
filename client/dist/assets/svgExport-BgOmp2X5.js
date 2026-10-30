const y=t=>String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;"),F=t=>[t==null?void 0:t.firstName,t==null?void 0:t.lastName].filter(Boolean).join(" ")||"Unnamed person",E=t=>{var e,o;return`${((e=t==null?void 0:t.firstName)==null?void 0:e[0])||""}${((o=t==null?void 0:t.lastName)==null?void 0:o[0])||""}`.toUpperCase()||"?"},I=t=>{if(!t)return"—";const e=new Date(t).getUTCFullYear();return Number.isFinite(e)?e:"—"},L=(t,e)=>String(t||"").length>e?`${String(t).slice(0,e-1)}…`:String(t||"");function P(t,e){const o=new Blob([t],{type:"image/svg+xml;charset=utf-8"}),s=URL.createObjectURL(o),n=document.createElement("a");n.href=s,n.download=e,document.body.appendChild(n),n.click(),n.remove(),window.setTimeout(()=>URL.revokeObjectURL(s),0)}function W(t,e,o){const s=t.querySelector(".tree-person-card");if(!s)return"";const n=getComputedStyle(s),r=s.querySelector(".person-avatar"),a=r?getComputedStyle(r):n,m=s.offsetWidth||196,l=s.offsetHeight||96,c=t.offsetLeft,f=t.offsetTop,p=Math.min(54,Math.max(34,l-28)),S=c+16+p/2,x=f+l/2,$=c+28+p,g=f+Math.max(29,l/2-8),u=`${e.maidenName?`Born: ${e.maidenName} · `:""}${I(e.birthDate)}${e.deathDate?` — ${I(e.deathDate)}`:" —"}`,w=[e.birthPlace,e.occupation].filter(Boolean).join(" · "),b=[F(e),u,e.birthPlace,e.occupation,e.bio,e.notes].filter(Boolean).join(`
`),T=n.backgroundColor||"#ffffff",v=n.borderColor||"#8aa29a",h=n.color||"#23312c",k=a.color||h,N=a.backgroundColor||"#e6f3ed",j=o==="red"?"#c83f49":"#171918";return`
    <g class="exported-person" data-person-id="${y(e.id)}">
      <title>${y(b)}</title>
      <rect x="${c}" y="${f}" width="${m}" height="${l}" rx="12" fill="${T}" stroke="${v}" stroke-width="1.5"/>
      <circle cx="${S}" cy="${x}" r="${p/2}" fill="${N}" stroke="${v}" stroke-width="1"/>
      <text x="${S}" y="${x}" text-anchor="middle" dominant-baseline="central" class="avatar-text" fill="${k}">${y(E(e))}</text>
      <text x="${$}" y="${g}" class="person-name" fill="${h}">${y(L(F(e),27))}</text>
      <text x="${$}" y="${g+20}" class="person-meta" fill="${k}">${y(L(u,32))}</text>
      ${w&&l>=88?`<text x="${$}" y="${g+37}" class="person-detail" fill="${k}">${y(L(w,31))}</text>`:""}
      ${e.deathDate&&o!=="off"?`<path d="M ${c+m-24} ${f} H ${c+m} V ${f+24} Z" fill="${j}"/><path d="M ${c+m-17} ${f} L ${c+m} ${f+17}" stroke="#fff" stroke-width="2.2"/>`:""}
    </g>`}function z({board:t,people:e,treeName:o,theme:s,deceasedRibbon:n}){var Y;if(!t||!e.length)throw new Error("No family tree is available to export");const r=t.querySelector("svg.connector-svg"),a=(Y=r==null?void 0:r.getBBox)==null?void 0:Y.call(r),m=[...t.querySelectorAll(".tree-person")],l=m.map(i=>{const d=i.querySelector(".tree-person-card");return{x:i.offsetLeft,y:i.offsetTop,width:(d==null?void 0:d.offsetWidth)||196,height:(d==null?void 0:d.offsetHeight)||76}}),c=Math.min((a==null?void 0:a.x)??1/0,...l.map(i=>i.x)),f=Math.min((a==null?void 0:a.y)??1/0,...l.map(i=>i.y)),p=Math.max(((a==null?void 0:a.x)??-1/0)+((a==null?void 0:a.width)??0),...l.map(i=>i.x+i.width)),S=Math.max(((a==null?void 0:a.y)??-1/0)+((a==null?void 0:a.height)??0),...l.map(i=>i.y+i.height)),x=80,$=Math.max(1,Math.ceil(p-c+x*2)),g=Math.max(1,Math.ceil(S-f+x*2)),u=Math.min(1,1600/$,1200/g),w=Math.max(1,Math.round($*u)),b=Math.max(1,Math.round(g*u)),T=x-c,v=x-f,h=r==null?void 0:r.cloneNode(!0);h==null||h.querySelectorAll(".connector-hit, .connector-child-name").forEach(i=>i.remove());const k=(h==null?void 0:h.innerHTML)||"",N=new Map(e.map(i=>[String(i.id),i])),j=m.map(i=>{const d=N.get(String(i.dataset.personId));return d?W(i,d,n):""}).join(""),M=s==="dark",U=M?"#111a16":"#f1ede7",A=M?"#789088":"#70827d",q=M?"#a9d8bf":"#42775f",X=M?"#18231e":"#f8f5f0",C=M?"#eef6f1":"#24342e",D=String(o||"family-tree").trim().replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"family-tree",H=/\bfamily$/i.test(String(o||"").trim())?String(o).trim():`${String(o||"Family").trim()} family`,R=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${b}" viewBox="0 0 ${$} ${g}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="tree-title tree-description">
  <title id="tree-title">${y(H)} tree</title>
  <desc id="tree-description">Family tree containing ${e.length} people with relationship lines and person information.</desc>
  <style>
    :root { --line: ${A}; --accent: ${q}; }
    .connector { fill: none; stroke: ${A}; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
    .connector.partner { stroke: ${q}; stroke-width: 1.9; }
    .connector.sibling { stroke-dasharray: 5 4; }
    .connector.custom { stroke-dasharray: 2 4; }
    .connector-relation, .family-role { font: 600 11px system-ui, sans-serif; fill: ${C}; paint-order: stroke; stroke: ${X}; stroke-width: 5px; stroke-linejoin: round; }
    .family-junction { fill: ${A}; stroke: ${U}; stroke-width: 1.5; }
    .person-name { font: 700 13px system-ui, sans-serif; }
    .person-meta { font: 500 10px system-ui, sans-serif; opacity: .82; }
    .person-detail { font: 500 9px system-ui, sans-serif; opacity: .7; }
    .avatar-text { font: 700 11px system-ui, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="${U}"/>
  <g transform="translate(${T} ${v})">
    <g aria-label="Relationships">${k}</g>
    <g aria-label="People">${j}</g>
  </g>
</svg>`;return P(R,`${D}.svg`),{width:$,height:g,displayWidth:w,displayHeight:b,peopleCount:e.length}}export{z as exportTreeSvg};
