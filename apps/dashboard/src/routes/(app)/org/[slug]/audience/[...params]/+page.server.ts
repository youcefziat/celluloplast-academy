import { classroomio, getApiHeaders, type InferResponseType } from '$lib/utils/services/api';
import { safeServerApi } from '$lib/utils/services/api/server';

type GetAudienceAnalyticsRequest = (typeof classroomio.organization.audience)[':userId']['analytics']['$get'];
type GetAudienceAnalyticsSuccess = Extract<InferResponseType<GetAudienceAnalyticsRequest>, { success: true }>;
type GetOrganizationCoursesRequest = typeof classroomio.organization.courses.$get;
type GetOrganizationCoursesSuccess = Extract<InferResponseType<GetOrganizationCoursesRequest>, { success: true }>;

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
    safeServerApi<GetOrganizationCoursesSuccess>(() =>
      classroomio.organization.courses.$get({ query: { tags: undefined } }, headers)
    )
  ]);

  return {
    userId,
    orgId,
    analytics: analyticsResult.ok ? analyticsResult.body.data : null,
    courses: coursesResult.ok ? coursesResult.body.data : []
  };
};
