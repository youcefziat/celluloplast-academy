#!/usr/bin/env node
/**
 * E2E API — isolation + auto-assignation audience (Celluloplast Docker).
 *
 * Usage (repo root):
 *   node scripts/celluloplast/e2e-audience-assignment.mjs
 *   .\scripts\celluloplast\e2e-audience-assignment.ps1
 *
 * Requires: celluloplast-api on :3081, migration 0008 applied, admin@test.com / 123456
 */

import { execFileSync } from 'node:child_process';

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:3081';
const ORIGIN = process.env.E2E_ORIGIN || 'http://localhost:3082';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '123456';
const ORG_SITE = process.env.E2E_ORG_SITE || 'celluloplast';
const ORG_ID_FALLBACK = process.env.E2E_ORG_ID || '1a1dcddd-1abc-4f72-b644-0bd18191a289';
const POSTGRES_CONTAINER = process.env.E2E_POSTGRES_CONTAINER || 'celluloplast-postgres';
const POSTGRES_USER = process.env.E2E_POSTGRES_USER || 'postgres';
const POSTGRES_DB = process.env.E2E_POSTGRES_DB || 'classroomio';

const POSITION_PROD = 'Poste Production';
const POSITION_RH = 'Poste RH';
const DEPT_ATELIER = 'Département Atelier';
const DEPT_BUREAU = 'Département Bureau';

const COURSE_A = 'E2E — Poste Production';
const COURSE_B = 'E2E — Département Atelier';
const COURSE_C = 'E2E — Tous';

const EMP_PROD = 'e2e-prod@celluloplast.local';
const EMP_ATELIER = 'e2e-atelier@celluloplast.local';
const EMP_RH = 'e2e-rh@celluloplast.local';

/** @type {string | null} */
let sessionCookie = null;
/** @type {string} */
let orgId = ORG_ID_FALLBACK;

const results = [];

function log(msg) {
  console.log(msg);
}

function pass(name) {
  results.push({ name, ok: true });
  log(`  PASS  ${name}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, condition, detail) {
  if (condition) pass(name);
  else fail(name, detail);
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const cookies = raw.length > 0 ? raw : [];
  // Node < 20 fallback: single set-cookie may be missing getSetCookie
  if (cookies.length === 0) {
    const single = headers.get('set-cookie');
    if (single) cookies.push(single);
  }

  for (const line of cookies) {
    const match = line.match(/classroomio\.session_token=([^;]+)/);
    if (match) return `classroomio.session_token=${match[1]}`;
  }

  return null;
}

async function api(method, path, { json, skipOrg = false } = {}) {
  const headers = {
    Origin: ORIGIN,
    ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    ...(!skipOrg && orgId ? { 'cio-org-id': orgId } : {})
  };

  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const response = await fetch(`${API_BASE}${path}`, { method, headers, body });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  const setCookie = parseSetCookie(response.headers);
  if (setCookie) sessionCookie = setCookie;

  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

function sql(query) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      POSTGRES_USER,
      '-d',
      POSTGRES_DB,
      '-v',
      'ON_ERROR_STOP=1',
      '-tAc',
      query
    ],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();
}

async function login() {
  log('1) Auth admin…');
  const result = await api('POST', '/api/auth/sign-in/email', {
    json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    skipOrg: true
  });

  if (!result.ok || !sessionCookie) {
    throw new Error(`Login failed (${result.status}): ${JSON.stringify(result.data)}`);
  }

  log(`   session OK (${ADMIN_EMAIL})`);
}

async function resolveOrg() {
  log('2) Resolve org…');
  const result = await api('GET', '/organization');
  if (!result.ok) throw new Error(`GET /organization failed: ${JSON.stringify(result.data)}`);

  const orgs = result.data?.data ?? [];
  const match = orgs.find((org) => org.siteName === ORG_SITE) || orgs[0];
  if (!match?.id) throw new Error(`Org ${ORG_SITE} not found`);

  orgId = match.id;
  log(`   org ${match.name} (${orgId})`);
}

async function ensureNamedRef(listPath, createPath, name) {
  const listed = await api('GET', listPath);
  if (!listed.ok) throw new Error(`GET ${listPath} failed: ${JSON.stringify(listed.data)}`);

  const items = listed.data?.data ?? [];
  const existing = items.find((item) => item.name === name);
  if (existing) {
    log(`   reuse ${name} id=${existing.id}`);
    return existing;
  }

  const created = await api('POST', createPath, { json: { name } });
  if (!created.ok) throw new Error(`POST ${createPath} "${name}" failed: ${JSON.stringify(created.data)}`);

  const row = created.data?.data;
  log(`   created ${name} id=${row.id}`);
  return row;
}

async function ensureCourses() {
  log('4) Courses (draft then publish + audienceAssignment)…');

  const listed = await api('GET', `/organization/courses?search=${encodeURIComponent('E2E —')}&limit=50`);
  if (!listed.ok) throw new Error(`GET courses failed: ${JSON.stringify(listed.data)}`);

  const existingByTitle = new Map((listed.data?.data ?? []).map((course) => [course.title, course]));

  async function ensureCourse(title, assignment) {
    let course = existingByTitle.get(title);

    if (!course) {
      const created = await api('POST', '/course', {
        json: {
          title,
          description: `${title} (E2E auto)`,
          type: 'SELF_PACED',
          organizationId: orgId
        }
      });
      if (!created.ok) throw new Error(`POST /course "${title}" failed: ${JSON.stringify(created.data)}`);
      course = created.data?.data?.course ?? created.data?.data;
      if (!course?.id) throw new Error(`POST /course "${title}" missing id: ${JSON.stringify(created.data)}`);
      log(`   created course ${title} id=${course.id}`);
    } else {
      log(`   reuse course ${title} id=${course.id}`);
    }

    const published = await api('PUT', `/course/${course.id}`, {
      json: {
        isPublished: true,
        metadata: {
          allowNewStudent: true,
          audienceAssignment: assignment
        }
      }
    });

    if (!published.ok) {
      throw new Error(`PUT publish "${title}" failed: ${JSON.stringify(published.data)}`);
    }

    log(`   published ${title} sync=${JSON.stringify(published.data?.data?.audienceSync ?? null)}`);
    return published.data?.data ?? course;
  }

  const courseA = await ensureCourse(COURSE_A, {
    mode: 'jobTitles',
    jobTitles: [POSITION_PROD],
    sendEmail: false
  });
  const courseB = await ensureCourse(COURSE_B, {
    mode: 'departments',
    departments: [DEPT_ATELIER],
    sendEmail: false
  });
  const courseC = await ensureCourse(COURSE_C, {
    mode: 'all',
    sendEmail: false
  });

  return { courseA, courseB, courseC };
}

async function findAudienceByEmail(email) {
  const listed = await api('GET', `/organization/audience?search=${encodeURIComponent(email)}&limit=50`);
  if (!listed.ok) throw new Error(`GET audience failed: ${JSON.stringify(listed.data)}`);

  const items = listed.data?.data ?? [];
  return items.find((item) => item.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureEmployee(email, firstName, lastName, refs) {
  const existing = await findAudienceByEmail(email);
  if (existing) {
    log(`   reuse employee ${email} id=${existing.id}`);
    return existing;
  }

  const created = await api('POST', '/organization/audience', {
    json: {
      email,
      firstName,
      lastName,
      positionId: refs.positionId,
      departmentId: refs.departmentId,
      sendEmail: false
    }
  });

  if (!created.ok) {
    throw new Error(`POST audience ${email} failed: ${JSON.stringify(created.data)}`);
  }

  const member = created.data?.data;
  log(`   created employee ${email} id=${member?.id ?? member?.memberId ?? '?'}`);
  return member;
}

function inviteCourseIds(email) {
  const escaped = email.replace(/'/g, "''");
  const raw = sql(
    `SELECT COALESCE(metadata->'courseIds', '[]'::jsonb)::text
     FROM organization_invite
     WHERE organization_id = '${orgId}'
       AND lower(email) = lower('${escaped}')
       AND is_revoked = false
       AND accepted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1;`
  );

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function main() {
  log('=== E2E audience isolation + auto-assignment ===');
  log(`API ${API_BASE}`);

  await login();
  await resolveOrg();

  log('3) Référentiels postes / départements…');
  const posProd = await ensureNamedRef('/organization/positions', '/organization/positions', POSITION_PROD);
  const posRh = await ensureNamedRef('/organization/positions', '/organization/positions', POSITION_RH);
  const deptAtelier = await ensureNamedRef('/organization/departments', '/organization/departments', DEPT_ATELIER);
  const deptBureau = await ensureNamedRef('/organization/departments', '/organization/departments', DEPT_BUREAU);

  const { courseA, courseB, courseC } = await ensureCourses();
  const idA = courseA.id;
  const idB = courseB.id;
  const idC = courseC.id;

  log('5) Employés pending (sendEmail: false)…');
  await ensureEmployee(EMP_PROD, 'E2E', 'Prod', {
    positionId: posProd.id,
    departmentId: undefined
  });
  await ensureEmployee(EMP_ATELIER, 'E2E', 'Atelier', {
    positionId: undefined,
    departmentId: deptAtelier.id
  });
  await ensureEmployee(EMP_RH, 'E2E', 'RH', {
    positionId: posRh.id,
    departmentId: deptBureau.id
  });

  // Re-run sync path for reused employees: touch course assignments slightly then restore
  // so pending invites pick up courses if a prior partial run left them empty.
  log('6) Re-sync published assignments (touch sendEmail flip)…');
  for (const [course, assignment] of [
    [courseA, { mode: 'jobTitles', jobTitles: [POSITION_PROD], sendEmail: true }],
    [courseB, { mode: 'departments', departments: [DEPT_ATELIER], sendEmail: true }],
    [courseC, { mode: 'all', sendEmail: true }]
  ]) {
    await api('PUT', `/course/${course.id}`, {
      json: { metadata: { allowNewStudent: true, audienceAssignment: assignment } }
    });
  }
  for (const [course, assignment] of [
    [courseA, { mode: 'jobTitles', jobTitles: [POSITION_PROD], sendEmail: false }],
    [courseB, { mode: 'departments', departments: [DEPT_ATELIER], sendEmail: false }],
    [courseC, { mode: 'all', sendEmail: false }]
  ]) {
    const put = await api('PUT', `/course/${course.id}`, {
      json: { metadata: { allowNewStudent: true, audienceAssignment: assignment } }
    });
    if (!put.ok) throw new Error(`Re-sync PUT failed: ${JSON.stringify(put.data)}`);
  }

  log('7) Assertions invite metadata…');

  function checkInvite(label, email, mustHave, mustNotHave) {
    const ids = inviteCourseIds(email);
    const okHave = mustHave.every((id) => ids.includes(id));
    const okNot = mustNotHave.every((id) => !ids.includes(id));
    assert(
      label,
      okHave && okNot,
      `courseIds=[${ids.join(', ')}] need=[${mustHave.join(', ')}] forbid=[${mustNotHave.join(', ')}]`
    );
  }

  checkInvite(`Prod ${EMP_PROD} → A+C not B`, EMP_PROD, [idA, idC], [idB]);
  checkInvite(`Atelier ${EMP_ATELIER} → B+C not A`, EMP_ATELIER, [idB, idC], [idA]);
  checkInvite(`RH ${EMP_RH} → C only`, EMP_RH, [idC], [idA, idB]);

  log('8) Optional: groupmember count for course C (mode all)…');
  try {
    const gmCount = sql(
      `SELECT count(*)::text
       FROM groupmember gm
       JOIN course c ON c.group_id = gm.group_id
       WHERE c.id = '${idC}';`
    );
    log(`   course C groupmember count = ${gmCount}`);
  } catch (error) {
    log(`   (skip) groupmember count: ${error instanceof Error ? error.message : error}`);
  }

  const failed = results.filter((r) => !r.ok);
  log('');
  log(`=== ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length}) ===`);

  if (failed.length > 0) {
    for (const item of failed) {
      log(` - ${item.name}: ${item.detail || ''}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('E2E crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
