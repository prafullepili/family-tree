const g=e=>String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;"),W=e=>[e==null?void 0:e.firstName,e==null?void 0:e.lastName].filter(Boolean).join(" ")||"Unnamed person",R=e=>{var t,c;return`${((t=e==null?void 0:e.firstName)==null?void 0:t[0])||""}${((c=e==null?void 0:e.lastName)==null?void 0:c[0])||""}`.toUpperCase()||"?"},P=e=>{if(!e)return"—";const t=new Date(e).getUTCFullYear();return Number.isFinite(t)?t:"—"},C=(e,t)=>String(e||"").length>t?`${String(e).slice(0,t-1)}…`:String(e||"");function z(e,t){const c=new Blob([e],{type:"image/svg+xml;charset=utf-8"}),f=URL.createObjectURL(c),h=document.createElement("a");h.href=f,h.download=t,document.body.appendChild(h),h.click(),h.remove(),window.setTimeout(()=>URL.revokeObjectURL(f),0)}function E(e,t,c){var H;const f=e.querySelector(".tree-person-card");if(!f)return"";const h=getComputedStyle(f),l=f.querySelector(".person-avatar"),r=l?getComputedStyle(l):h,n=f.offsetWidth||196,x=f.offsetHeight||96,o=e.offsetLeft,i=e.offsetTop,v=Math.min(54,Math.max(34,x-28)),j=o+16+v/2,k=i+x/2,p=o+28+v,u=i+Math.max(29,x/2-8),S=`${t.maidenName?`Born: ${t.maidenName} · `:""}${P(t.birthDate)}${t.deathDate?` — ${P(t.deathDate)}`:" —"}`,A=[t.birthPlace,t.occupation].filter(Boolean).join(" · "),N=[W(t),S,t.birthPlace,t.occupation,t.bio,t.notes].filter(Boolean).join(`
`),U=h.backgroundColor||"#ffffff",L=h.borderColor||"#8aa29a",y=h.color||"#23312c",w=r.color||y,D=r.backgroundColor||"#e6f3ed",F=c==="red"?"#c83f49":"#171918";if(e.classList.contains("tree-person-portrait")){const d=f.querySelector(".tree-person-copy"),I=d?getComputedStyle(d).backgroundColor:U,M=((H=d==null?void 0:d.querySelector("small"))==null?void 0:H.textContent)||S,Y=r.borderColor||L,$=o+n/2-48,T=i;let q="";const m=l==null?void 0:l.querySelector("img");if(m!=null&&m.complete&&m.naturalWidth)try{const b=document.createElement("canvas");b.width=192,b.height=192;const a=b.getContext("2d"),s=Math.min(m.naturalWidth,m.naturalHeight);a.drawImage(m,(m.naturalWidth-s)/2,(m.naturalHeight-s)*.25,s,s,0,0,192,192),q=b.toDataURL("image/png")}catch{}const X=`portrait-${String(t.id).replace(/[^a-z0-9_-]/gi,"")}`;return`<g class="exported-person" data-person-id="${g(t.id)}">
      <title>${g(N)}</title>
      <defs><clipPath id="${X}"><rect x="${$}" y="${T}" width="96" height="96" rx="28"/></clipPath></defs>
      <rect x="${$}" y="${T}" width="96" height="96" rx="28" fill="${D}" stroke="${Y}" stroke-width="2"/>
      ${q?`<image href="${q}" x="${$}" y="${T}" width="96" height="96" clip-path="url(#${X})"/>`:`<circle cx="${o+n/2}" cy="${i+36}" r="17" fill="${w}" opacity=".45"/><path d="M ${$+16} ${i+92} Q ${$+16} ${i+60} ${o+n/2} ${i+60} Q ${$+80} ${i+60} ${$+80} ${i+92}" fill="${w}" opacity=".45"/>`}
      <rect x="${o+n/2-72}" y="${i+102}" width="144" height="40" rx="8" fill="${I}"/>
      <text x="${o+n/2}" y="${i+118}" text-anchor="middle" class="person-name" style="font-size:12px" fill="${y}">${g(C(W(t),20))}</text>
      <text x="${o+n/2}" y="${i+133}" text-anchor="middle" class="person-meta" fill="${w}">${g(C(M,25))}</text>
      ${t.deathDate&&c!=="off"?`<path d="M ${$+72} ${i} H ${$+85} V ${i+27} L ${$+78.5} ${i+21} L ${$+72} ${i+27} Z" fill="${F}"/>`:""}
    </g>`}return`
    <g class="exported-person" data-person-id="${g(t.id)}">
      <title>${g(N)}</title>
      <rect x="${o}" y="${i}" width="${n}" height="${x}" rx="12" fill="${U}" stroke="${L}" stroke-width="1.5"/>
      <circle cx="${j}" cy="${k}" r="${v/2}" fill="${D}" stroke="${L}" stroke-width="1"/>
      <text x="${j}" y="${k}" text-anchor="middle" dominant-baseline="central" class="avatar-text" fill="${w}">${g(R(t))}</text>
      <text x="${p}" y="${u}" class="person-name" fill="${y}">${g(C(W(t),27))}</text>
      <text x="${p}" y="${u+20}" class="person-meta" fill="${w}">${g(C(S,32))}</text>
      ${A&&x>=88?`<text x="${p}" y="${u+37}" class="person-detail" fill="${w}">${g(C(A,31))}</text>`:""}
      ${t.deathDate&&c!=="off"?`<path d="M ${o+n-24} ${i} H ${o+n} V ${i+24} Z" fill="${F}"/><path d="M ${o+n-17} ${i} L ${o+n} ${i+17}" stroke="#fff" stroke-width="2.2"/>`:""}
    </g>`}function O({board:e,people:t,treeName:c,theme:f,deceasedRibbon:h}){var b;if(!e||!t.length)throw new Error("No family tree is available to export");const l=e.querySelector("svg.connector-svg"),r=(b=l==null?void 0:l.getBBox)==null?void 0:b.call(l),n=[...e.querySelectorAll(".tree-person")],x=n.map(a=>{const s=a.querySelector(".tree-person-card");return{x:a.offsetLeft,y:a.offsetTop,width:(s==null?void 0:s.offsetWidth)||196,height:(s==null?void 0:s.offsetHeight)||76}}),o=Math.min((r==null?void 0:r.x)??1/0,...x.map(a=>a.x)),i=Math.min((r==null?void 0:r.y)??1/0,...x.map(a=>a.y)),v=Math.max(((r==null?void 0:r.x)??-1/0)+((r==null?void 0:r.width)??0),...x.map(a=>a.x+a.width)),j=Math.max(((r==null?void 0:r.y)??-1/0)+((r==null?void 0:r.height)??0),...x.map(a=>a.y+a.height)),k=80,p=Math.max(1,Math.ceil(v-o+k*2)),u=Math.max(1,Math.ceil(j-i+k*2)),S=Math.min(1,1600/p,1200/u),A=Math.max(1,Math.round(p*S)),N=Math.max(1,Math.round(u*S)),U=k-o,L=k-i,y=l==null?void 0:l.cloneNode(!0);y==null||y.querySelectorAll(".connector-hit, .connector-child-name").forEach(a=>a.remove());const w=(y==null?void 0:y.innerHTML)||"",D=[...e.querySelectorAll(".family-group-borders rect")].map(a=>`<rect x="${Number(a.getAttribute("x"))}" y="${Number(a.getAttribute("y"))}" width="${Number(a.getAttribute("width"))}" height="${Number(a.getAttribute("height"))}" rx="18"/>`).join(""),F=new Map(t.map(a=>[String(a.id),a])),H=n.map(a=>{const s=F.get(String(a.dataset.personId));return s?E(a,s,h):""}).join(""),d=f==="dark",I=d?"#111a16":"#f1ede7",M=d?"#789088":"#70827d",Y=d?"#a9d8bf":"#42775f",$=d?"#18231e":"#f8f5f0",T=d?"#eef6f1":"#24342e",q=String(c||"family-tree").trim().replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"family-tree",m=/\bfamily$/i.test(String(c||"").trim())?String(c).trim():`${String(c||"Family").trim()} family`,X=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${A}" height="${N}" viewBox="0 0 ${p} ${u}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="tree-title tree-description">
  <title id="tree-title">${g(m)} tree</title>
  <desc id="tree-description">Family tree containing ${t.length} people with relationship lines and person information.</desc>
  <style>
    :root { --line: ${M}; --accent: ${Y}; }
    .connector { fill: none; stroke: ${M}; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
    .family-groups rect { fill: none; stroke: ${M}; stroke-width: 1; stroke-dasharray: 5 5; opacity: .35; }
    .connector.partner { stroke: ${Y}; stroke-width: 1.9; }
    .connector.sibling { stroke-dasharray: 5 4; }
    .connector.custom { stroke-dasharray: 2 4; }
    .connector-relation, .family-role { font: 600 11px system-ui, sans-serif; fill: ${T}; paint-order: stroke; stroke: ${$}; stroke-width: 5px; stroke-linejoin: round; }
    .family-junction { fill: ${M}; stroke: ${I}; stroke-width: 1.5; }
    .person-name { font: 700 13px system-ui, sans-serif; }
    .person-meta { font: 500 10px system-ui, sans-serif; opacity: .82; }
    .person-detail { font: 500 9px system-ui, sans-serif; opacity: .7; }
    .avatar-text { font: 700 11px system-ui, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="${I}"/>
  <g transform="translate(${U} ${L})">
    <g class="family-groups" aria-label="Family groups">${D}</g>
    <g aria-label="Relationships">${w}</g>
    <g aria-label="People">${H}</g>
  </g>
</svg>`;return z(X,`${q}.svg`),{width:p,height:u,displayWidth:A,displayHeight:N,peopleCount:t.length}}export{O as exportTreeSvg};
