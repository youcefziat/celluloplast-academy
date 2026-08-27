import { z } from 'zod';

export const ZOrganizationPositionParam = z.object({
  positionId: z.coerce.number().int().positive()
});
export type TOrganizationPositionParam = z.infer<typeof ZOrganizationPositionParam>;

export const ZCreateOrganizationPosition = z.object({
  name: z.string().trim().min(1).max(120)
});
export type TCreateOrganizationPosition = z.infer<typeof ZCreateOrganizationPosition>;

export const ZUpdateOrganizationPosition = z.object({
  name: z.string().trim().min(1).max(120)
});
export type TUpdateOrganizationPosition = z.infer<typeof ZUpdateOrganizationPosition>;
