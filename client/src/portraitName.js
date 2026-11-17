let measuringContext;
const cache = new Map();
export const PORTRAIT_SIZE = 120;
export const PORTRAIT_MIN_HEIGHT = 184;

export function portraitNameLines(name) {
  const normalized = String(name || 'Unnamed person').trim();
  const key = `${typeof document}:${normalized}`;
  if (cache.has(key)) return cache.get(key);
  if (!measuringContext && typeof document !== 'undefined') {
    measuringContext = document.createElement('canvas').getContext('2d');
    if (measuringContext) measuringContext.font = '700 13px "DM Sans", sans-serif';
  }
  const width = (text) => measuringContext ? measuringContext.measureText(text).width : [...text].length * 7;
  const lines = [];
  let line = '';
  for (const word of normalized.split(/\s+/)) {
    if (line && width(`${line} ${word}`) <= PORTRAIT_SIZE - 12) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of word) {
      if (line && width(line + character) > PORTRAIT_SIZE - 12) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  if (cache.size >= 500) cache.delete(cache.keys().next().value);
  cache.set(key, lines);
  return lines;
}

export const portraitNodeHeight = (name) => Math.max(PORTRAIT_MIN_HEIGHT, 146 + portraitNameLines(name).length * 15);
