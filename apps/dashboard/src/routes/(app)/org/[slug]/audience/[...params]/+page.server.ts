import { classroomio, getApiHeaders, type InferResponseType } from '$lib/utils/services/api';
import { safeServerApi } from '$lib/utils/services/api/server';

type GetAudienceAnalyticsRequest = (typeof classroomio.organization.audience)[':userId']['analytics']['$get'];
type GetAudienceAnalyticsSuccess = Extract<InferResponseType<GetAudienceAnalyticsRequest>, { success: true }>;
type GetAssignableCoursesRequest = (typeof classroomio.organization.audience)[':userId']['assignable-courses']['$get'];
type GetAssignableCoursesSuccess = Extract<InferResponseType<GetAssignableCoursesRequest>, { success: true }>;

export const load = async ({ params, parent, cookies }) => {
  const { orgId } = await parent();
  const paramParts = params.params?.split('/') ?? [];

  const userId = paramParts[0];

  if (!userId || !orgId) {
    return {
      userId,
      orgId,
      analytics: null,
      courses: []
    };
  }

  const headers = getApiHeaders(cookies, orgId);

  // The course list backs the assign dialog on this page, so fetch it alongside the analytics.
  const [analyticsResult, coursesResult] = await Promise.all([
    safeServerApi<GetAudienceAnalyticsSuccess>(() =>
      classroomio.organization.audience[':userId'].analytics.$get({ param: { userId } }, headers)
    ),
    // Only the courses this person may actually be given, so the picker cannot offer one
    // the server would refuse.
    safeServerApi<GetAssignableCoursesSuccess>(() =>
      classroomio.organization.audience[':userId']['assignable-courses'].$get({ param: { userId } }, headers)
    )
  ]);

  return {
    userId,
    orgId,
    analytics: analyticsResult.ok ? analyticsResult.body.data : null,
    courses: coursesResult.ok ? coursesResult.body.data : []
  };
};
