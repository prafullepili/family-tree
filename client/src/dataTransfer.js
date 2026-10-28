const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unnamed person';

function exportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function personDataRow(person, peopleById) {
  const personName = (id) => fullName(peopleById.get(String(id)));
  const namedPeople = (ids) => (ids || []).map(personName).join('; ');
  const partners = (person.partnerIds || [])
    .map((id) => {
      const label = (person.partnerRelationships || []).find((link) => String(link.partnerId) === String(id))?.label;
      return `${personName(id)}${label ? ` (${label})` : ''}`;
    })
    .join('; ');
  const otherRelationships = (person.relationshipLinks || []).map((link) => `${personName(link.personId)}${link.label ? ` (${link.label})` : ''}`).join('; ');
  return {
    'First Name': person.firstName || '',
    'Last Name': person.lastName || '',
    'Maiden Name': person.maidenName || '',
    Gender: person.gender || 'unspecified',
    Born: exportDate(person.birthDate),
    Died: exportDate(person.deathDate),
    Birthplace: person.birthPlace || '',
    Occupation: person.occupation || '',
    About: person.bio || '',
    'Family Notes': person.notes || '',
    'Photo URL': person.photoUrl || '',
    Parents: namedPeople(person.parentIds),
    Partners: partners,
    Siblings: namedPeople(person.siblingIds),
    'Other Relationships': otherRelationships,
    'Tree X': Number.isFinite(person.treeX) ? person.treeX : '',
    'Tree Y': Number.isFinite(person.treeY) ? person.treeY : '',
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index <= text.length; index += 1) {
    const character = text[index] ?? '\n';
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  const [headers = [], ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ''])));
}

function parseJsonCell(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return String(value)
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function normalizeImportedRows(rows) {
  return rows
    .map((row, index) => ({
      sourceId: String(row.ID || row.id || `import-${index + 1}`).trim(),
      firstName: String(row['First Name'] || row.firstName || '').trim(),
      lastName: String(row['Last Name'] || row.lastName || '').trim(),
      maidenName: String(row['Maiden Name'] || row.maidenName || '').trim(),
      gender: ['female', 'male', 'nonbinary', 'unspecified'].includes(String(row.Gender || row.gender || '').toLowerCase()) ? String(row.Gender || row.gender).toLowerCase() : 'unspecified',
      birthDate: String(row.Born || row.birthDate || '').trim() || null,
      deathDate: String(row.Died || row.deathDate || '').trim() || null,
      birthPlace: String(row.Birthplace || row.birthPlace || '').trim(),
      occupation: String(row.Occupation || row.occupation || '').trim(),
      bio: String(row.About || row.bio || '').trim(),
      notes: String(row['Family Notes'] || row.notes || '').trim(),
      photoUrl: String(row['Photo URL'] || row.photoUrl || '').trim(),
      parentIds: parseJsonCell(row['Parent IDs'] ?? row.parentIds).map(String),
      partnerIds: parseJsonCell(row['Partner IDs'] ?? row.partnerIds).map(String),
      siblingIds: parseJsonCell(row['Sibling IDs'] ?? row.siblingIds).map(String),
      partnerRelationships: parseJsonCell(row['Partner Relationships'] ?? row.partnerRelationships),
      relationshipLinks: parseJsonCell(row['Other Relationships'] ?? row.relationshipLinks),
      treeX: row['Tree X'] === '' || row.treeX === '' ? null : Number(row['Tree X'] ?? row.treeX),
      treeY: row['Tree Y'] === '' || row.treeY === '' ? null : Number(row['Tree Y'] ?? row.treeY),
    }))
    .filter((person) => person.firstName);
}

function dataRows(people) {
  const peopleById = new Map(people.map((person) => [String(person.id || person._id), person]));
  return people.map((person) => personDataRow(person, peopleById));
}

export function exportCsvFile(people, columns) {
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.map(escapeCell).join(','), ...dataRows(people).map((row) => columns.map((column) => escapeCell(row[column])).join(','))].join('\r\n');
  downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `family-tree-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportExcelFile(people, columns) {
  const excelModule = await import('exceljs');
  const ExcelJS = excelModule.default || excelModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kinfolk';
  const sheet = workbook.addWorksheet('Family Tree', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((header) => ({ header, key: header, width: Math.min(42, Math.max(13, header.length + 3)) }));
  dataRows(people).forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6B4F' } };
  const lastColumn = sheet.getColumn(columns.length).letter;
  sheet.autoFilter = { from: 'A1', to: `${lastColumn}${Math.max(1, people.length + 1)}` };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `family-tree-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function readImportFile(file) {
  let rows;
  if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsv(await file.text());
  else {
    const excelModule = await import('exceljs');
    const ExcelJS = excelModule.default || excelModule;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw Error('The workbook has no worksheet');
    const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((value) => String(value || '').trim());
    rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values.slice(1);
      if (values.some((value) => value !== null && value !== undefined && value !== '')) rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
    });
  }
  return normalizeImportedRows(rows);
}
