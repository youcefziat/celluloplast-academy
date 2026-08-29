import type { CertificateVariable } from '@cio/certificates';

export const CERTIFICATE_VARIABLE_GROUPS: Array<{
  labelKey: string;
  variables: Array<{ variable: CertificateVariable; labelKey: string }>;
}> = [
  {
    labelKey: 'certificate_designer.variables.employee',
    variables: [
      { variable: 'student.fullName', labelKey: 'certificate_designer.variables.full_name' },
      { variable: 'student.firstName', labelKey: 'certificate_designer.variables.first_name' },
      { variable: 'student.lastName', labelKey: 'certificate_designer.variables.last_name' },
      { variable: 'student.email', labelKey: 'certificate_designer.variables.email' }
    ]
  },
  {
    labelKey: 'certificate_designer.variables.course',
    variables: [
      { variable: 'course.name', labelKey: 'certificate_designer.variables.course_name' },
      { variable: 'course.description', labelKey: 'certificate_designer.variables.course_description' }
    ]
  },
  {
    labelKey: 'certificate_designer.variables.certificate',
    variables: [
      { variable: 'certificate.date', labelKey: 'certificate_designer.variables.certificate_date' },
      { variable: 'certificate.id', labelKey: 'certificate_designer.variables.certificate_id' }
    ]
  },
  {
    labelKey: 'certificate_designer.variables.organization',
    variables: [{ variable: 'organization.name', labelKey: 'certificate_designer.variables.organization_name' }]
  }
];
