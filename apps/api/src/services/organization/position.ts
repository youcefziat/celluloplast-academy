import { AppError, ErrorCodes } from '@api/utils/errors';
import type { TCreateOrganizationPosition, TUpdateOrganizationPosition } from '@cio/utils/validation/organization';
import {
  countMembersUsingPosition,
  createOrganizationPosition,
  deleteOrganizationPosition,
  getOrganizationPositionById,
  getOrganizationPositionByName,
  listOrganizationPositions,
  updateOrganizationPosition
} from '@cio/db/queries/organization';

export async function listPositions(orgId: string) {
  return listOrganizationPositions(orgId);
}

export async function createPosition(orgId: string, data: TCreateOrganizationPosition) {
  const name = data.name.trim();
  const existing = await getOrganizationPositionByName(orgId, name);
  if (existing) {
    throw new AppError('A position with this name already exists', ErrorCodes.CONFLICT, 409, 'name');
  }

  return createOrganizationPosition({
    organizationId: orgId,
    name
  });
}

export async function updatePosition(orgId: string, positionId: number, data: TUpdateOrganizationPosition) {
  const existing = await getOrganizationPositionById(orgId, positionId);
  if (!existing) {
    throw new AppError('Position not found', ErrorCodes.NOT_FOUND, 404);
  }

  const name = data.name.trim();
  const duplicate = await getOrganizationPositionByName(orgId, name);
  if (duplicate && duplicate.id !== positionId) {
    throw new AppError('A position with this name already exists', ErrorCodes.CONFLICT, 409, 'name');
  }

  const updated = await updateOrganizationPosition(orgId, positionId, { name });
  if (!updated) {
    throw new AppError('Position not found', ErrorCodes.NOT_FOUND, 404);
  }

  return updated;
}

export async function deletePosition(orgId: string, positionId: number) {
  const existing = await getOrganizationPositionById(orgId, positionId);
  if (!existing) {
    throw new AppError('Position not found', ErrorCodes.NOT_FOUND, 404);
  }

  const employeeCount = await countMembersUsingPosition(orgId, positionId);
  if (employeeCount > 0) {
    throw new AppError(
      `Cannot delete this position: ${employeeCount} employee(s) are assigned to it.`,
      ErrorCodes.CONFLICT,
      409,
      'positionId'
    );
  }

  const deleted = await deleteOrganizationPosition(orgId, positionId);
  if (!deleted) {
    throw new AppError('Position not found', ErrorCodes.NOT_FOUND, 404);
  }

  return { deleted: true };
}
