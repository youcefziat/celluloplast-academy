import { z } from 'zod';

export const ZOrganizationDepartmentParam = z.object({
  departmentId: z.coerce.number().int().positive()
});
export type TOrganizationDepartmentParam = z.infer<typeof ZOrganizationDepartmentParam>;

export const ZCreateOrganizationDepartment = z.object({
  name: z.string().trim().min(1).max(120)
});
export type TCreateOrganizationDepartment = z.infer<typeof ZCreateOrganizationDepartment>;

export const ZUpdateOrganizationDepartment = z.object({
  name: z.string().trim().min(1).max(120)
});
export type TUpdateOrganizationDepartment = z.infer<typeof ZUpdateOrganizationDepartment>;
