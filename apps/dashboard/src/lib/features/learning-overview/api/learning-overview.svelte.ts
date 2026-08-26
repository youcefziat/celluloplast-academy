import { BaseApi, classroomio } from '$lib/utils/services/api';

import type { LearningOverviewData, LearningOverviewRequest } from '../utils/types';

class LearningOverviewApi extends BaseApi {
  overview = $state<LearningOverviewData | null>(null);
  loading = $state(false);
  lastFetchedOrgId = $state<string | null>(null);

  async fetchOverview(orgId: string) {
    if (!orgId) return;

    this.loading = true;
    this.lastFetchedOrgId = orgId;
    await this.execute<LearningOverviewRequest>({
      requestFn: () => classroomio.dash['learning-overview'].$get({ query: { orgId } }),
      logContext: 'fetching org learning overview',
      onSuccess: (response) => {
        this.overview = response.data;
      }
    });
    this.loading = false;
  }

  ensureFetched(orgId: string) {
    if (this.lastFetchedOrgId === orgId) return;

    this.fetchOverview(orgId);
  }
}

export const learningOverviewApi = new LearningOverviewApi();
