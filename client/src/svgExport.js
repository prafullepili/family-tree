import { portraitNameLines, PORTRAIT_SIZE } from './portraitName.js';

const escapeXml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const personName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
const initials = (person) => `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase() || '?';
const year = (value) => {
  if (!value) return '—';
  const parsed = new Date(value).getUTCFullYear();
  return Number.isFinite(parsed) ? parsed : '—';
};
const shortened = (value, limit) => (String(value || '').length > limit ? `${String(value).slice(0, limit - 1)}…` : String(value || ''));

function downloadSvg(source, filename) {
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function nodeMarkup(node, person, deceasedRibbon) {
  const card = node.querySelector('.tree-person-card');
  if (!card) return '';
  const cardStyle = getComputedStyle(card);
  const avatar = card.querySelector('.person-avatar');
  const avatarStyle = avatar ? getComputedStyle(avatar) : cardStyle;
  const width = card.offsetWidth || 196;
  const height = card.offsetHeight || 96;
  const x = node.offsetLeft;
  const y = node.offsetTop;
  const avatarSize = Math.min(54, Math.max(34, height - 28));
  const avatarX = x + 16 + avatarSize / 2;
  const avatarY = y + height / 2;
  const textX = x + 28 + avatarSize;
  const nameY = y + Math.max(29, height / 2 - 8);
  const dateText = `${person.maidenName ? `Born: ${person.maidenName} · ` : ''}${year(person.birthDate)}${person.deathDate ? ` — ${year(person.deathDate)}` : ' —'}`;
  const detailText = [person.birthPlace, person.occupation].filter(Boolean).join(' · ');
  const title = [personName(person), dateText, person.birthPlace, person.occupation, person.bio, person.notes].filter(Boolean).join('\n');
  const fill = cardStyle.backgroundColor || '#ffffff';
  const stroke = cardStyle.borderColor || '#8aa29a';
  const text = cardStyle.color || '#23312c';
  const muted = avatarStyle.color || text;
  const avatarFill = avatarStyle.backgroundColor || '#e6f3ed';
  const ribbonColor = deceasedRibbon === 'red' ? '#c83f49' : '#171918';
  if (node.classList.contains('tree-person-portrait')) {
    const label = card.querySelector('.tree-person-copy');
    const labelFill = label ? getComputedStyle(label).backgroundColor : fill;
    const nameLines = portraitNameLines(personName(person));
    const labelHeight = label?.offsetHeight || Math.max(48, nameLines.length * 15 + 20);
    const labelY = y + PORTRAIT_SIZE + 6;
    const firstNameY = labelY + 12 + (labelHeight - (nameLines.length * 15 + 14)) / 2;
    const portraitDateText = label?.querySelector('small')?.textContent || dateText;
    const portraitStroke = avatarStyle.borderColor || stroke;
    const portraitX = x + width / 2 - PORTRAIT_SIZE / 2;
    const portraitY = y;
    let photo = '';
    const image = avatar?.querySelector('img');
    if (image?.complete && image.naturalWidth) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 192; canvas.height = 192;
        const context = canvas.getContext('2d');
        const scale = Math.min(192 / image.naturalWidth, 192 / image.naturalHeight);
        const photoWidth = image.naturalWidth * scale, photoHeight = image.naturalHeight * scale;
        context.drawImage(image, (192 - photoWidth) / 2, 192 - photoHeight, photoWidth, photoHeight);
        photo = canvas.toDataURL('image/png');
      } catch { /* Remote photos without CORS permission use the silhouette. */ }
    }
    const clipId = `portrait-${String(person.id).replace(/[^a-z0-9_-]/gi, '')}`;
    return `<g class="exported-person" data-person-id="${escapeXml(person.id)}">
      <title>${escapeXml(title)}</title>
      <defs><clipPath id="${clipId}"><rect x="${portraitX}" y="${portraitY}" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}"/></clipPath></defs>
      <rect x="${portraitX}" y="${portraitY}" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}" fill="${avatarFill}" stroke="${portraitStroke}" stroke-width="2"/>
      ${photo ? `<image href="${photo}" x="${portraitX}" y="${portraitY}" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}" clip-path="url(#${clipId})"/>` : `<g transform="translate(${portraitX} ${y}) scale(${PORTRAIT_SIZE / 96})" fill="${muted}"><circle cx="48" cy="34" r="18" opacity=".35"/><path d="M12 96V84c0-20 16-30 36-30s36 10 36 30v12Z" opacity=".28"/></g>`}
      <rect x="${portraitX}" y="${labelY}" width="${PORTRAIT_SIZE}" height="${labelHeight}" rx="8" fill="${labelFill}"/>
      <text text-anchor="middle" class="person-name" style="font-size:13px" fill="${text}">${nameLines.map((line,index) => `<tspan x="${x + width / 2}" y="${firstNameY + index * 15}">${escapeXml(line)}</tspan>`).join('')}</text>
      <text x="${x + width / 2}" y="${firstNameY + nameLines.length * 15}" text-anchor="middle" class="person-meta" fill="${muted}">${escapeXml(shortened(portraitDateText, 20))}</text>
      ${person.deathDate && deceasedRibbon !== 'off' ? `<path d="M ${portraitX + PORTRAIT_SIZE - 24} ${y} H ${portraitX + PORTRAIT_SIZE - 11} V ${y + 27} L ${portraitX + PORTRAIT_SIZE - 17.5} ${y + 21} L ${portraitX + PORTRAIT_SIZE - 24} ${y + 27} Z" fill="${ribbonColor}"/>` : ''}
    </g>`;
  }
  return `
    <g class="exported-person" data-person-id="${escapeXml(person.id)}">
      <title>${escapeXml(title)}</title>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <circle cx="${avatarX}" cy="${avatarY}" r="${avatarSize / 2}" fill="${avatarFill}" stroke="${stroke}" stroke-width="1"/>
      <text x="${avatarX}" y="${avatarY}" text-anchor="middle" dominant-baseline="central" class="avatar-text" fill="${muted}">${escapeXml(initials(person))}</text>
      <text x="${textX}" y="${nameY}" class="person-name" fill="${text}">${escapeXml(shortened(personName(person), 27))}</text>
      <text x="${textX}" y="${nameY + 20}" class="person-meta" fill="${muted}">${escapeXml(shortened(dateText, 32))}</text>
      ${detailText && height >= 88 ? `<text x="${textX}" y="${nameY + 37}" class="person-detail" fill="${muted}">${escapeXml(shortened(detailText, 31))}</text>` : ''}
      ${person.deathDate && deceasedRibbon !== 'off' ? `<path d="M ${x + width - 24} ${y} H ${x + width} V ${y + 24} Z" fill="${ribbonColor}"/><path d="M ${x + width - 17} ${y} L ${x + width} ${y + 17}" stroke="#fff" stroke-width="2.2"/>` : ''}
    </g>`;
}

export function exportTreeSvg({ board, people, treeName, theme, deceasedRibbon }) {
  if (!board || !people.length) throw new Error('No family tree is available to export');
  const liveConnector = board.querySelector('svg.connector-svg');
  const connectorBounds = liveConnector?.getBBox?.();
  const personNodes = [...board.querySelectorAll('.tree-person')];
  const nodeBounds = personNodes.map((node) => {
    const card = node.querySelector('.tree-person-card');
    return {
      x: node.offsetLeft,
      y: node.offsetTop,
      width: card?.offsetWidth || 196,
      height: card?.offsetHeight || 76,
    };
  });
  const contentMinX = Math.min(connectorBounds?.x ?? Infinity, ...nodeBounds.map((bounds) => bounds.x));
  const contentMinY = Math.min(connectorBounds?.y ?? Infinity, ...nodeBounds.map((bounds) => bounds.y));
  const contentMaxX = Math.max((connectorBounds?.x ?? -Infinity) + (connectorBounds?.width ?? 0), ...nodeBounds.map((bounds) => bounds.x + bounds.width));
  const contentMaxY = Math.max((connectorBounds?.y ?? -Infinity) + (connectorBounds?.height ?? 0), ...nodeBounds.map((bounds) => bounds.y + bounds.height));
  const padding = 80;
  const width = Math.max(1, Math.ceil(contentMaxX - contentMinX + padding * 2));
  const height = Math.max(1, Math.ceil(contentMaxY - contentMinY + padding * 2));
  // Keep the complete, full-resolution tree in the viewBox, but give the
  // downloaded file a practical initial display size. SVG remains vector data,
  // so viewers can still zoom in without losing any detail.
  const previewScale = Math.min(1, 1600 / width, 1200 / height);
  const displayWidth = Math.max(1, Math.round(width * previewScale));
  const displayHeight = Math.max(1, Math.round(height * previewScale));
  const translateX = padding - contentMinX;
  const translateY = padding - contentMinY;
  const connector = liveConnector?.cloneNode(true);
  connector?.querySelectorAll('.connector-hit, .connector-child-name').forEach((element) => element.remove());
  const connectors = connector?.innerHTML || '';
  const familyGroups = [...board.querySelectorAll('.family-group-borders rect')].map((rect) =>
    `<rect x="${Number(rect.getAttribute('x'))}" y="${Number(rect.getAttribute('y'))}" width="${Number(rect.getAttribute('width'))}" height="${Number(rect.getAttribute('height'))}" rx="18"/>`,
  ).join('');
  const peopleById = new Map(people.map((person) => [String(person.id), person]));
  const nodes = personNodes
    .map((node) => {
      const person = peopleById.get(String(node.dataset.personId));
      return person ? nodeMarkup(node, person, deceasedRibbon) : '';
    })
    .join('');
  const dark = theme === 'dark';
  const background = dark ? '#111a16' : '#f1ede7';
  const line = dark ? '#789088' : '#70827d';
  const accent = dark ? '#a9d8bf' : '#42775f';
  const labelBackground = dark ? '#18231e' : '#f8f5f0';
  const labelText = dark ? '#eef6f1' : '#24342e';
  const safeName = String(treeName || 'family-tree').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'family-tree';
  const displayTitle = /\bfamily$/i.test(String(treeName || '').trim()) ? String(treeName).trim() : `${String(treeName || 'Family').trim()} family`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="tree-title tree-description">
  <title id="tree-title">${escapeXml(displayTitle)} tree</title>
  <desc id="tree-description">Family tree containing ${people.length} people with relationship lines and person information.</desc>
  <style>
    :root { --line: ${line}; --accent: ${accent}; }
    .connector { fill: none; stroke: ${line}; stroke-width: 1.6; vector-effect: non-scaling-stroke; }
    .family-groups rect { fill: none; stroke: ${line}; stroke-width: 1; stroke-dasharray: 5 5; opacity: .35; }
    .connector.partner { stroke: ${accent}; stroke-width: 1.9; }
    .connector.sibling { stroke-dasharray: 5 4; }
    .connector.custom { stroke-dasharray: 2 4; }
    .connector-relation, .family-role { font: 600 11px system-ui, sans-serif; fill: ${labelText}; paint-order: stroke; stroke: ${labelBackground}; stroke-width: 5px; stroke-linejoin: round; }
    .family-junction { fill: ${line}; stroke: ${background}; stroke-width: 1.5; }
    .person-name { font: 700 13px system-ui, sans-serif; }
    .person-meta { font: 500 10px system-ui, sans-serif; opacity: .82; }
    .person-detail { font: 500 9px system-ui, sans-serif; opacity: .7; }
    .avatar-text { font: 700 11px system-ui, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="${background}"/>
  <g transform="translate(${translateX} ${translateY})">
    <g class="family-groups" aria-label="Family groups">${familyGroups}</g>
    <g aria-label="Relationships">${connectors}</g>
    <g aria-label="People">${nodes}</g>
  </g>
</svg>`;
  downloadSvg(svg, `${safeName}.svg`);
  return { width, height, displayWidth, displayHeight, peopleCount: people.length };
}
