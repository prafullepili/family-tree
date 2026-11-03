export default function FamilyConstellation() {
  return (
    <svg className="auth-tree-art" viewBox="0 0 620 500" role="img" aria-label="A connected family tree">
      <defs>
        <linearGradient id="auth-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9cfb8" />
          <stop offset="1" stopColor="#789982" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#auth-line)" strokeWidth="2">
        <path d="M175 104 C175 150 232 153 265 189" />
        <path d="M445 104 C445 150 388 153 355 189" />
        <path d="M310 254 C310 303 205 314 164 355" />
        <path d="M310 254 C310 304 310 314 310 355" />
        <path d="M310 254 C310 303 415 314 456 355" />
        <path d="M175 104 L445 104" strokeDasharray="6 7" />
      </g>
      <g className="auth-tree-node">
        <rect x="109" y="56" width="132" height="94" rx="22" />
        <circle cx="150" cy="96" r="21" />
        <path d="M181 88h34M181 101h27M181 114h19" />
      </g>
      <g className="auth-tree-node auth-tree-node-alt">
        <rect x="379" y="56" width="132" height="94" rx="22" />
        <circle cx="420" cy="96" r="21" />
        <path d="M451 88h34M451 101h27M451 114h19" />
      </g>
      <g className="auth-tree-node auth-tree-focus">
        <rect x="238" y="174" width="144" height="98" rx="23" />
        <circle cx="282" cy="216" r="23" />
        <path d="M316 207h41M316 220h34M316 233h25" />
      </g>
      {[92, 238, 384].map((x, index) => (
        <g className="auth-tree-node auth-tree-small" key={x}>
          <rect x={x} y="350" width="144" height="92" rx="21" />
          <circle cx={x + 40} cy="390" r="20" />
          <path d={`M${x + 70} 383h47M${x + 70} 396h34M${x + 70} 409h25`} />
          {index === 1 && <circle className="auth-tree-spark" cx={x + 122} cy="365" r="7" />}
        </g>
      ))}
    </svg>
  );
}
