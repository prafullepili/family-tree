import{p as G,P as s}from"./index-rcyvVK3s.js";const g=e=>String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;"),E=e=>[e==null?void 0:e.firstName,e==null?void 0:e.lastName].filter(Boolean).join(" ")||"Unnamed person",B=e=>{var t,c;return`${((t=e==null?void 0:e.firstName)==null?void 0:t[0])||""}${((c=e==null?void 0:e.lastName)==null?void 0:c[0])||""}`.toUpperCase()||"?"},_=e=>{if(!e)return"—";const t=new Date(e).getUTCFullYear();return Number.isFinite(t)?t:"—"},P=(e,t)=>String(e||"").length>t?`${String(e).slice(0,t-1)}…`:String(e||"");function J(e,t){const c=new Blob([e],{type:"image/svg+xml;charset=utf-8"}),f=URL.createObjectURL(c),$=document.createElement("a");$.href=f,$.download=t,document.body.appendChild($),$.click(),$.remove(),window.setTimeout(()=>URL.revokeObjectURL(f),0)}function K(e,t,c){var Y;const f=e.querySelector(".tree-person-card");if(!f)return"";const $=getComputedStyle(f),l=f.querySelector(".person-avatar"),i=l?getComputedStyle(l):$,d=f.offsetWidth||196,p=f.offsetHeight||96,h=e.offsetLeft,o=e.offsetTop,N=Math.min(54,Math.max(34,p-28)),H=h+16+N/2,k=o+p/2,u=h+28+N,w=o+Math.max(29,p/2-8),b=`${t.maidenName?`Born: ${t.maidenName} · `:""}${_(t.birthDate)}${t.deathDate?` — ${_(t.deathDate)}`:" —"}`,A=[t.birthPlace,t.occupation].filter(Boolean).join(" · "),L=[E(t),b,t.birthPlace,t.occupation,t.bio,t.notes].filter(Boolean).join(`
`),j=$.backgroundColor||"#ffffff",T=$.borderColor||"#8aa29a",y=$.color||"#23312c",S=i.color||y,C=i.backgroundColor||"#e6f3ed",I=c==="red"?"#c83f49":"#171918";if(e.classList.contains("tree-person-portrait")){const n=f.querySelector(".tree-person-copy"),U=n?getComputedStyle(n).backgroundColor:j,x=G(E(t)),q=(n==null?void 0:n.offsetHeight)||Math.max(48,x.length*15+20),D=o+s+6,F=D+12+(q-(x.length*15+14))/2,R=((Y=n==null?void 0:n.querySelector("small"))==null?void 0:Y.textContent)||b,W=i.borderColor||T,m=h+d/2-s/2,M=o;let a="";const r=l==null?void 0:l.querySelector("img");if(r!=null&&r.complete&&r.naturalWidth)try{const v=document.createElement("canvas");v.width=192,v.height=192;const X=v.getContext("2d"),Z=Math.min(192/r.naturalWidth,192/r.naturalHeight),O=r.naturalWidth*Z,V=r.naturalHeight*Z;X.drawImage(r,(192-O)/2,192-V,O,V),a=v.toDataURL("image/png")}catch{}const z=`portrait-${String(t.id).replace(/[^a-z0-9_-]/gi,"")}`;return`<g class="exported-person" data-person-id="${g(t.id)}">
      <title>${g(L)}</title>
      <defs><clipPath id="${z}"><rect x="${m}" y="${M}" width="${s}" height="${s}"/></clipPath></defs>
      <rect x="${m}" y="${M}" width="${s}" height="${s}" fill="${C}" stroke="${W}" stroke-width="2"/>
      ${a?`<image href="${a}" x="${m}" y="${M}" width="${s}" height="${s}" clip-path="url(#${z})"/>`:`<g transform="translate(${m} ${o}) scale(${s/96})" fill="${S}"><circle cx="48" cy="34" r="18" opacity=".35"/><path d="M12 96V84c0-20 16-30 36-30s36 10 36 30v12Z" opacity=".28"/></g>`}
      <rect x="${m}" y="${D}" width="${s}" height="${q}" rx="8" fill="${U}"/>
      <text text-anchor="middle" class="person-name" style="font-size:13px" fill="${y}">${x.map((v,X)=>`<tspan x="${h+d/2}" y="${F+X*15}">${g(v)}</tspan>`).join("")}</text>
      <text x="${h+d/2}" y="${F+x.length*15}" text-anchor="middle" class="person-meta" fill="${S}">${g(P(R,20))}</text>
      ${t.deathDate&&c!=="off"?`<path d="M ${m+s-24} ${o} H ${m+s-11} V ${o+27} L ${m+s-17.5} ${o+21} L ${m+s-24} ${o+27} Z" fill="${I}"/>`:""}
    </g>`}return`
    <g class="exported-person" data-person-id="${g(t.id)}">
      <title>${g(L)}</title>
      <rect x="${h}" y="${o}" width="${d}" height="${p}" rx="12" fill="${j}" stroke="${T}" stroke-width="1.5"/>
      <circle cx="${H}" cy="${k}" r="${N/2}" fill="${C}" stroke="${T}" stroke-width="1"/>
      <text x="${H}" y="${k}" text-anchor="middle" dominant-baseline="central" class="avatar-text" fill="${S}">${g(B(t))}</text>
      <text x="${u}" y="${w}" class="person-name" fill="${y}">${g(P(E(t),27))}</text>
      <text x="${u}" y="${w+20}" class="person-meta" fill="${S}">${g(P(b,32))}</text>
      ${A&&p>=88?`<text x="${u}" y="${w+37}" class="person-detail" fill="${S}">${g(P(A,31))}</text>`:""}
      ${t.deathDate&&c!=="off"?`<path d="M ${h+d-24} ${o} H ${h+d} V ${o+24} Z" fill="${I}"/><path d="M ${h+d-17} ${o} L ${h+d} ${o+17}" stroke="#fff" stroke-width="2.2"/>`:""}
    </g>`}function tt({board:e,people:t,treeName:c,theme:f,deceasedRibbon:$}){var M;if(!e||!t.length)throw new Error("No family tree is available to export");const l=e.querySelector("svg.connector-svg"),i=(M=l==null?void 0:l.getBBox)==null?void 0:M.call(l),d=[...e.querySelectorAll(".tree-person")],p=d.map(a=>{const r=a.querySelector(".tree-person-card");return{x:a.offsetLeft,y:a.offsetTop,width:(r==null?void 0:r.offsetWidth)||196,height:(r==null?void 0:r.offsetHeight)||76}}),h=Math.min((i==null?void 0:i.x)??1/0,...p.map(a=>a.x)),o=Math.min((i==null?void 0:i.y)??1/0,...p.map(a=>a.y)),N=Math.max(((i==null?void 0:i.x)??-1/0)+((i==null?void 0:i.width)??0),...p.map(a=>a.x+a.width)),H=Math.max(((i==null?void 0:i.y)??-1/0)+((i==null?void 0:i.height)??0),...p.map(a=>a.y+a.height)),k=80,u=Math.max(1,Math.ceil(N-h+k*2)),w=Math.max(1,Math.ceil(H-o+k*2)),b=Math.min(1,1600/u,1200/w),A=Math.max(1,Math.round(u*b)),L=Math.max(1,Math.round(w*b)),j=k-h,T=k-o,y=l==null?void 0:l.cloneNode(!0);y==null||y.querySelectorAll(".connector-hit, .connector-child-name").forEach(a=>a.remove());const S=(y==null?void 0:y.innerHTML)||"",C=[...e.querySelectorAll(".family-group-borders rect")].map(a=>`<rect x="${Number(a.getAttribute("x"))}" y="${Number(a.getAttribute("y"))}" width="${Number(a.getAttribute("width"))}" height="${Number(a.getAttribute("height"))}" rx="18"/>`).join(""),I=new Map(t.map(a=>[String(a.id),a])),Y=d.map(a=>{const r=I.get(String(a.dataset.personId));return r?K(a,r,$):""}).join(""),n=f==="dark",U=n?"#111a16":"#f1ede7",x=n?"#789088":"#70827d",q=n?"#a9d8bf":"#42775f",D=n?"#18231e":"#f8f5f0",F=n?"#eef6f1":"#24342e",R=String(c||"family-tree").trim().replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"family-tree",W=/\bfamily$/i.test(String(c||"").trim())?String(c).trim():`${String(c||"Family").trim()} family`,m=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${A}" height="${L}" viewBox="0 0 ${u} ${w}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="tree-title tree-description">
  <title id="tree-title">${g(W)} tree</title>
  <desc id="tree-description">Family tree containing ${t.length} people with relationship lines and person information.</desc>
  <style>
    :root { --line: ${x}; --accent: ${q}; }
    .connector { fill: none; stroke: ${x}; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
    .family-groups rect { fill: none; stroke: ${x}; stroke-width: 1; stroke-dasharray: 5 5; opacity: .35; }
    .connector.partner { stroke: ${q}; stroke-width: 1.9; }
    .connector.sibling { stroke-dasharray: 5 4; }
    .connector.custom { stroke-dasharray: 2 4; }
    .connector-relation, .family-role { font: 600 11px system-ui, sans-serif; fill: ${F}; paint-order: stroke; stroke: ${D}; stroke-width: 5px; stroke-linejoin: round; }
    .family-junction { fill: ${x}; stroke: ${U}; stroke-width: 1.5; }
    .person-name { font: 700 13px system-ui, sans-serif; }
    .person-meta { font: 500 10px system-ui, sans-serif; opacity: .82; }
    .person-detail { font: 500 9px system-ui, sans-serif; opacity: .7; }
    .avatar-text { font: 700 11px system-ui, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="${U}"/>
  <g transform="translate(${j} ${T})">
    <g class="family-groups" aria-label="Family groups">${C}</g>
    <g aria-label="Relationships">${S}</g>
    <g aria-label="People">${Y}</g>
  </g>
</svg>`;return J(m,`${R}.svg`),{width:u,height:w,displayWidth:A,displayHeight:L,peopleCount:t.length}}export{tt as exportTreeSvg};
