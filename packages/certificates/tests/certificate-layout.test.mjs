import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  CERTIFICATE_PREVIEW_CONTEXT,
  CERTIFICATE_TEMPLATE_IDS,
  createCertificateLayoutPreset,
  migrateLegacyCertificateDesign,
  renderCertificate,
  resolveOrganizationCertificateLayout,
  resolveCertificateVariable,
  toCertificateLayoutSnapshot
} from '../dist/index.js';

const previewData = {
  recipientName: CERTIFICATE_PREVIEW_CONTEXT.student.fullName,
  recipientFirstName: CERTIFICATE_PREVIEW_CONTEXT.student.firstName,
  recipientLastName: CERTIFICATE_PREVIEW_CONTEXT.student.lastName,
  recipientEmail: CERTIFICATE_PREVIEW_CONTEXT.student.email,
  courseName: CERTIFICATE_PREVIEW_CONTEXT.course.name,
  courseDescription: CERTIFICATE_PREVIEW_CONTEXT.course.description,
  orgName: CERTIFICATE_PREVIEW_CONTEXT.organization.name,
  date: CERTIFICATE_PREVIEW_CONTEXT.certificate.date,
  certificateId: CERTIFICATE_PREVIEW_CONTEXT.certificate.id
};

test('all historical themes are editable V1 presets', () => {
  for (const templateId of CERTIFICATE_TEMPLATE_IDS) {
    const layout = createCertificateLayoutPreset(templateId);

    assert.equal(layout.version, 1);
    assert.equal(layout.page.width, CERTIFICATE_PAGE_WIDTH);
    assert.equal(layout.page.height, CERTIFICATE_PAGE_HEIGHT);
    assert.equal(layout.sourcePresetId, templateId);
    assert.ok(layout.elements.some((element) => element.id === 'student-name'));
    assert.ok(layout.elements.some((element) => element.id === 'organization-logo'));
    assert.deepEqual(
      layout.elements.map((element) => element.zIndex),
      layout.elements.map((_, index) => index + 1)
    );
  }
});

test('legacy designs migrate their visual content into editable elements', () => {
  const layout = migrateLegacyCertificateDesign({
    templateId: 'noir',
    accentColor: '#123456',
    subtitle: 'Distinction interne',
    descriptionOverride: 'Parcours terminé avec succès',
    logoUrl: 'https://cdn.example.com/logo.png',
    signatories: [
      {
        name: 'Samira Diallo',
        role: 'Direction RH',
        enabled: true,
        signatureUrl: 'https://cdn.example.com/signature.png'
      },
      { name: '', role: '', enabled: false }
    ],
    idFormat: 'CELL-{year}-{seq}'
  });

  const logo = layout.elements.find((element) => element.id === 'organization-logo');

  assert.equal(layout.sourcePresetId, 'noir');
  assert.equal(layout.certificateIdFormat, 'CELL-{year}-{seq}');
  assert.equal(logo?.type === 'image' ? logo.src : undefined, 'https://cdn.example.com/logo.png');
  assert.ok(layout.elements.some((element) => element.id === 'legacy-subtitle'));
  assert.ok(layout.elements.some((element) => element.id === 'signature-1'));
  assert.ok(layout.elements.some((element) => element.id === 'signatory-1'));
});

test('the shared renderer resolves variables and keeps layout coordinates', () => {
  const layout = createCertificateLayoutPreset('minimal');
  const studentName = layout.elements.find((element) => element.id === 'student-name');

  assert.ok(studentName);
  studentName.x = 217;
  studentName.y = 303;

  const rendered = renderCertificate(layout, previewData);

  assert.match(rendered.html, /Ahmed Benali/);
  assert.match(rendered.html, /Sensibilisation Cybersécurité/);
  assert.match(rendered.html, /left:217px/);
  assert.match(rendered.html, /top:303px/);
  assert.match(rendered.styles, /@page \{ size: 1100px 780px/);
});

test('unknown variables degrade to empty text without throwing', () => {
  let warnedVariable = '';
  const resolved = resolveCertificateVariable('future.variable', CERTIFICATE_PREVIEW_CONTEXT, (variable) => {
    warnedVariable = variable;
  });

  assert.equal(resolved, '');
  assert.equal(warnedVariable, 'future.variable');
});

test('certificate snapshots unwrap proxy graphs into structured-cloneable model data', () => {
  const layout = createCertificateLayoutPreset('classique');
  const proxiedElements = new Proxy(
    layout.elements.map((element) => new Proxy(element, {})),
    {}
  );
  const proxiedLayout = new Proxy({ ...layout, page: new Proxy(layout.page, {}), elements: proxiedElements }, {});

  assert.throws(() => structuredClone(proxiedLayout), { name: 'DataCloneError' });

  const snapshot = toCertificateLayoutSnapshot(proxiedLayout);

  assert.deepEqual(snapshot, layout);
  assert.doesNotThrow(() => structuredClone(snapshot));
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test('certificate snapshots reject non-serializable values in declared model fields', () => {
  const layout = createCertificateLayoutPreset('minimal');
  layout.elements[0].name = () => 'runtime callback';

  assert.throws(() => toCertificateLayoutSnapshot(layout), /element\.name.*string/);
});

test('organization settings are the only live source of certificate layout', () => {
  const organizationLayout = createCertificateLayoutPreset('poster');
  organizationLayout.page.backgroundColor = '#123456';

  const resolved = resolveOrganizationCertificateLayout({
    certificateDesign: organizationLayout,
    certificate: {
      theme: 'classique',
      design: { templateId: 'classique' }
    }
  });

  assert.deepEqual(resolved, organizationLayout);
  assert.equal(resolved.page.backgroundColor, '#123456');
});

test('course-era design fields are ignored when organization settings have no design', () => {
  const resolved = resolveOrganizationCertificateLayout({
    certificate: {
      theme: 'noir',
      design: { templateId: 'noir', accentColor: '#000000' }
    }
  });

  assert.equal(resolved.sourcePresetId, 'classique');
});
