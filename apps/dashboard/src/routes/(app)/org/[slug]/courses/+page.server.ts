import { classroomio, getApiHeaders } from '$lib/utils/services/api';
import { safeServerApi } from '$lib/utils/services/api/server';
import type { InferResponseType } from '$lib/utils/services/api';

type GetOrganizationCoursesRequest = typeof classroomio.organization.courses.$get;
type GetOrganizationCoursesSuccess = Extract<InferResponseType<GetOrganizationCoursesRequest>, { success: true }>;

export const load = async ({ parent, locals, cookies }) => {
  const { orgId } = await parent();

  if (!orgId || !locals.user?.id) {
    return { courses: [] };
  }

  const coursesResult = await safeServerApi<GetOrganizationCoursesSuccess>(() =>
    classroomio.organization.courses.$get({ query: {} }, getApiHeaders(cookies, orgId))
  );

  return {
    courses: coursesResult.ok ? coursesResult.body.data : []
  };
};
