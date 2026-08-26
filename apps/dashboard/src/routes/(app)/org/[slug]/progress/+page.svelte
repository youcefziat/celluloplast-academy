<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { pageTitle } from '$lib/celluloplast/brand';
  import * as Page from '@cio/ui/base/page';
  import * as Select from '@cio/ui/base/select';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import { Search } from '@cio/ui/custom/search';
  import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
  import { LearnersTable } from '$features/learning-overview/components';
  import { learningOverviewApi } from '$features/learning-overview';
  import type { LearningProgressStatus } from '$features/learning-overview/utils/types';

  $effect(() => {
    learningOverviewApi.ensureFetched($currentOrg.id);
  });

  function handleRefresh() {
    const orgId = $currentOrg.id;
    if (!orgId) return;

    learningOverviewApi.fetchOverview(orgId);
  }

  const PAGE_SIZE = 50;

  type StatusFilter = LearningProgressStatus | 'all';

  const statusFilters: StatusFilter[] = ['all', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];

  let searchValue = $state('');
  let courseFilter = $state<string>('all');
  let statusFilter = $state<StatusFilter>('all');
  let page = $state(1);

  const courses = $derived(learningOverviewApi.overview?.courses ?? []);

  const filteredRows = $derived.by(() => {
    const rows = learningOverviewApi.overview?.learners ?? [];
    const query = searchValue.trim().toLowerCase();

    return rows.filter((row) => {
      if (courseFilter !== 'all' && row.courseId !== courseFilter) {
        return false;
      }

      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${row.fullname ?? ''} ${row.email ?? ''}`.toLowerCase();

      return haystack.includes(query);
    });
  });

  const totalPages = $derived(Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)));

  const pagedRows = $derived.by(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredRows.slice(start, start + PAGE_SIZE);
  });

  $effect(() => {
    // Reset page when filters change.
    void searchValue;
    void courseFilter;
    void statusFilter;
    page = 1;
  });

  function statusFilterLabel(filter: StatusFilter) {
    if (filter === 'all') {
      return $t('celluloplast_progress.filter.all');
    }

    return $t(`celluloplast_progress.status.${filter}`);
  }
</script>

<svelte:head>
  <title>{pageTitle($t('celluloplast_progress.title'))}</title>
</svelte:head>

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('celluloplast_progress.title')}</Page.Title>
      <p class="ui:text-muted-foreground text-sm">{$t('celluloplast_progress.subtitle')}</p>
    </Page.HeaderContent>
    <Page.Action>
      <Button variant="outline" size="sm" disabled={learningOverviewApi.loading} onclick={handleRefresh}>
        <RefreshIcon class={learningOverviewApi.loading ? 'animate-spin' : ''} />
        {$t('analytics.refresh')}
      </Button>
    </Page.Action>
  </Page.Header>

  <Page.Body>
    {#snippet child()}
      <div class="space-y-6">
        {#if learningOverviewApi.loading && !learningOverviewApi.overview}
          <div class="flex h-32 items-center justify-center">
            <Spinner class="ui:text-muted-foreground size-6" />
          </div>
        {:else}
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Search
              placeholder={$t('celluloplast_progress.search_placeholder')}
              bind:value={searchValue}
              class="w-full md:max-w-sm"
            />

            <div class="flex flex-wrap items-center gap-2">
              <Select.Root type="single" bind:value={courseFilter}>
                <Select.Trigger class="w-[220px]">
                  {courseFilter === 'all'
                    ? $t('celluloplast_progress.filter.all_trainings')
                    : (courses.find((course) => course.courseId === courseFilter)?.courseTitle ??
                      $t('celluloplast_progress.filter.training'))}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all" label={$t('celluloplast_progress.filter.all_trainings')}>
                    {$t('celluloplast_progress.filter.all_trainings')}
                  </Select.Item>
                  {#each courses as course (course.courseId)}
                    <Select.Item value={course.courseId} label={course.courseTitle}>
                      {course.courseTitle}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>

              {#each statusFilters as filter (filter)}
                <Button
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onclick={() => (statusFilter = filter)}
                >
                  {statusFilterLabel(filter)}
                </Button>
              {/each}
            </div>
          </div>

          <LearnersTable rows={pagedRows} />

          {#if filteredRows.length > PAGE_SIZE}
            <div class="flex items-center justify-between gap-3">
              <p class="ui:text-muted-foreground text-sm">
                {$t('celluloplast_progress.pagination.label', {
                  page: Math.min(page, totalPages),
                  total: totalPages,
                  count: filteredRows.length
                })}
              </p>
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onclick={() => {
                    page = Math.max(1, page - 1);
                  }}
                >
                  {$t('celluloplast_progress.pagination.prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onclick={() => {
                    page = Math.min(totalPages, page + 1);
                  }}
                >
                  {$t('celluloplast_progress.pagination.next')}
                </Button>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/snippet}
  </Page.Body>
</Page.Root>
