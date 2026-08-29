import type { CertificateRenderData, CertificateVariable, CertificateVariableContext } from './types';

export const CERTIFICATE_PREVIEW_CONTEXT: CertificateVariableContext = {
  student: {
    fullName: 'Ahmed Benali',
    firstName: 'Ahmed',
    lastName: 'Benali',
    email: 'ahmed.benali@celluloplast.com'
  },
  course: {
    name: 'Sensibilisation Cybersécurité',
    description: 'Formation aux bonnes pratiques de sécurité numérique en entreprise.'
  },
  certificate: {
    date: '29/08/2026',
    id: 'CERT-2026-0247'
  },
  organization: {
    name: 'Celluloplast'
  }
};

export function splitCertificateRecipientName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? '';

  return { firstName, lastName: parts.join(' ') };
}

export function toCertificateVariableContext(data: CertificateRenderData): CertificateVariableContext {
  const derivedName = splitCertificateRecipientName(data.recipientName);

  return {
    student: {
      fullName: data.recipientName,
      firstName: data.recipientFirstName ?? derivedName.firstName,
      lastName: data.recipientLastName ?? derivedName.lastName,
      email: data.recipientEmail ?? ''
    },
    course: {
      name: data.courseName,
      description: data.courseDescription
    },
    certificate: {
      date: data.date,
      id: data.certificateId
    },
    organization: {
      name: data.orgName,
      logoUrl: data.orgLogoUrl
    }
  };
}

export function resolveCertificateVariable(
  variable: CertificateVariable | string,
  context: CertificateVariableContext,
  onUnknown: (variable: string) => void = (unknownVariable) => {
    console.warn(`[certificate] Unknown variable: ${unknownVariable}`);
  }
): string {
  switch (variable) {
    case 'student.fullName':
      return context.student.fullName;
    case 'student.firstName':
      return context.student.firstName;
    case 'student.lastName':
      return context.student.lastName;
    case 'student.email':
      return context.student.email;
    case 'course.name':
      return context.course.name;
    case 'course.description':
      return context.course.description;
    case 'certificate.date':
      return context.certificate.date;
    case 'certificate.id':
      return context.certificate.id;
    case 'organization.name':
      return context.organization.name;
    default:
      onUnknown(variable);
      return '';
  }
}
