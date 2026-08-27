import { AppError, ErrorCodes } from '@api/utils/errors';
import type { TCreateOrganizationDepartment, TUpdateOrganizationDepartment } from '@cio/utils/validation/organization';
import {
  countMembersUsingDepartment,
  createOrganizationDepartment,
  deleteOrganizationDepartment,
  getOrganizationDepartmentById,
  getOrganizationDepartmentByName,
  listOrganizationDepartments,
  updateOrganizationDepartment
} from '@cio/db/queries/organization';

export async function listDepartments(orgId: string) {
  return listOrganizationDepartments(orgId);
}

export async function createDepartment(orgId: string, data: TCreateOrganizationDepartment) {
  const name = data.name.trim();
  const existing = await getOrganizationDepartmentByName(orgId, name);
  if (existing) {
    throw new AppError('A department with this name already exists', ErrorCodes.CONFLICT, 409, 'name');
  }

  return createOrganizationDepartment({
    organizationId: orgId,
    name
  });
}

export async function updateDepartment(orgId: string, departmentId: number, data: TUpdateOrganizationDepartment) {
  const existing = await getOrganizationDepartmentById(orgId, departmentId);
  if (!existing) {
    throw new AppError('Department not found', ErrorCodes.NOT_FOUND, 404);
  }

  const name = data.name.trim();
  const duplicate = await getOrganizationDepartmentByName(orgId, name);
  if (duplicate && duplicate.id !== departmentId) {
    throw new AppError('A department with this name already exists', ErrorCodes.CONFLICT, 409, 'name');
  }

  const updated = await updateOrganizationDepartment(orgId, departmentId, { name });
  if (!updated) {
    throw new AppError('Department not found', ErrorCodes.NOT_FOUND, 404);
  }

  return updated;
}

export async function deleteDepartment(orgId: string, departmentId: number) {
  const existing = await getOrganizationDepartmentById(orgId, departmentId);
  if (!existing) {
    throw new AppError('Department not found', ErrorCodes.NOT_FOUND, 404);
  }

  const employeeCount = await countMembersUsingDepartment(orgId, departmentId);
  if (employeeCount > 0) {
    throw new AppError(
      `Cannot delete this department: ${employeeCount} employee(s) are assigned to it.`,
      ErrorCodes.CONFLICT,
      409,
      'departmentId'
    );
  }

  const deleted = await deleteOrganizationDepartment(orgId, departmentId);
  if (!deleted) {
    throw new AppError('Department not found', ErrorCodes.NOT_FOUND, 404);
  }

  return { deleted: true };
}
