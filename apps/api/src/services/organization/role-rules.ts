import { AppError, ErrorCodes } from '@api/utils/errors';
import { ROLE } from '@cio/utils/constants';

/**
 * The two rules that keep an organization administrable when a member's role changes.
 *
 * Kept in its own module, free of database imports, so the rules can be exercised directly
 * rather than through the whole audience service graph.
 *
 * Only meaningful when the member currently holds ADMIN — demoting anyone else is always fine.
 */
export function assertRoleChangeAllowed(input: {
  currentRoleId: number;
  memberProfileId: string | null;
  actorProfileId: string;
  adminCount: number;
}): void {
  const { currentRoleId, memberProfileId, actorProfileId, adminCount } = input;

  if (currentRoleId !== ROLE.ADMIN) {
    return;
  }

  if (memberProfileId && memberProfileId === actorProfileId) {
    throw new AppError('You cannot change your own admin role', ErrorCodes.VALIDATION_ERROR, 403, 'roleId');
  }

  if (adminCount <= 1) {
    throw new AppError('The organization must keep at least one admin', ErrorCodes.VALIDATION_ERROR, 409, 'roleId');
  }
}

/**
 * The same protection applied to removal: losing the last admin locks the organization out
 * just as surely as demoting them, and removing your own membership is never intended.
 */
export function assertMemberRemovalAllowed(input: {
  currentRoleId: number;
  memberProfileId: string | null;
  actorProfileId: string;
  adminCount: number;
}): void {
  const { currentRoleId, memberProfileId, actorProfileId, adminCount } = input;

  if (memberProfileId && memberProfileId === actorProfileId) {
    throw new AppError('You cannot remove your own membership', ErrorCodes.VALIDATION_ERROR, 403, 'memberId');
  }

  if (currentRoleId !== ROLE.ADMIN) {
    return;
  }

  if (adminCount <= 1) {
    throw new AppError('The organization must keep at least one admin', ErrorCodes.VALIDATION_ERROR, 409, 'memberId');
  }
}
