import type { BadgeVariant } from '@cio/ui/base/badge';
import { ROLE } from '@cio/utils/constants';
import { ROLE_LABEL } from '$lib/utils/constants/roles';

/** Admins stand out, tutors read as a distinct staff role, students are the default. */
export function roleBadgeVariant(roleId: number): BadgeVariant {
  switch (roleId) {
    case ROLE.ADMIN:
      return 'default';
    case ROLE.TUTOR:
      return 'secondary';
    default:
      return 'outline';
  }
}

export function roleLabelKey(roleId: number): string {
  return ROLE_LABEL[roleId as keyof typeof ROLE_LABEL] ?? 'course.navItem.people.roles.student';
}

export function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'expired':
    case 'revoked':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function statusLabelKey(status: string): string {
  switch (status) {
    case 'active':
      return 'audience.status_active';
    case 'pending':
      return 'audience.status_pending';
    case 'expired':
      return 'audience.status_expired';
    case 'revoked':
      return 'audience.status_revoked';
    default:
      return 'audience.status_pending';
  }
}

export function canResendAudienceInvite(status: string): boolean {
  return status === 'pending' || status === 'expired' || status === 'revoked';
}

export function canRevokeAudienceInvite(status: string): boolean {
  return status === 'pending';
}
