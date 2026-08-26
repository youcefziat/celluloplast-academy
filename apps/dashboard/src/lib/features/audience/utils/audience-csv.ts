/**
 * Parse multi-column employee CSV for audience import.
 * Accepted headers (FR/EN): email|mail, firstName|prenom|prénom, lastName|nom,
 * jobTitle|poste, department|departement|département, managerEmail|manager
 */

export type AudienceCsvRow = {
  email: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  managerEmail?: string;
};

const HEADER_ALIASES: Record<string, keyof AudienceCsvRow> = {
  email: 'email',
  mail: 'email',
  firstname: 'firstName',
  prenom: 'firstName',
  prénom: 'firstName',
  lastname: 'lastName',
  nom: 'lastName',
  jobtitle: 'jobTitle',
  poste: 'jobTitle',
  department: 'department',
  departement: 'department',
  département: 'department',
  manageremail: 'managerEmail',
  manager: 'managerEmail'
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function getAudienceCsvTemplate(): string {
  return [
    'email,firstName,lastName,jobTitle,department,managerEmail',
    'alice@example.com,Alice,Martin,Technicienne,Production,',
    'bob@example.com,Bob,Dupont,Responsable,Production,alice@example.com'
  ].join('\n');
}

export function parseAudienceCsv(content: string): {
  rows: AudienceCsvRow[];
  errors: string[];
} {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ['empty'] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const columnMap = new Map<number, keyof AudienceCsvRow>();

  headerCells.forEach((header, index) => {
    const field = HEADER_ALIASES[header];
    if (field) {
      columnMap.set(index, field);
    }
  });

  if (![...columnMap.values()].includes('email')) {
    // Legacy single-column / email-only paste
    const emails = content
      .split(/[\n,;\t ]+/g)
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes('@'));

    return {
      rows: emails.map((email) => ({ email })),
      errors: emails.length === 0 ? ['no_email_column'] : []
    };
  }

  const rows: AudienceCsvRow[] = [];
  const errors: string[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const cells = splitCsvLine(lines[lineIndex]);
    const row: AudienceCsvRow = { email: '' };

    for (const [index, field] of columnMap.entries()) {
      const value = cells[index]?.trim();
      if (!value) continue;
      row[field] = field === 'email' || field === 'managerEmail' ? value.toLowerCase() : value;
    }

    if (!row.email) {
      errors.push(`line_${lineIndex + 1}_missing_email`);
      continue;
    }

    rows.push(row);
  }

  return { rows, errors };
}
