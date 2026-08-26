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
  import { CertificatesTable } from '$features/certifications';
  import { learningOverviewApi } from '$features/learning-overview';

  $effect(() => {
    learningOverviewApi.ensureFetched($currentOrg.id);
  });

  function handleRefresh() {
    const orgId = $currentOrg.id;
    if (!orgId) return;

    learningOverviewApi.fetchOverview(orgId);
  }

  const PAGE_SIZE = 50;

  let searchValue = $state('');
  let courseFilter = $state<string>('all');
  let page = $state(1);

  const certifiedRows = $derived.by(() => {
    const rows = learningOverviewApi.overview?.learners ?? [];

    return rows
      .filter((row) => row.certificateEarnedAt != null)
      .sort((left, right) => {
        const leftTime = left.certificateEarnedAt ? new Date(left.certificateEarnedAt).getTime() : 0;
        const rightTime = right.certificateEarnedAt ? new Date(right.certificateEarnedAt).getTime() : 0;

        return rightTime - leftTime;
      });
  });

  const courses = $derived.by(() => {
    const byId = new Map<string, { courseId: string; courseTitle: string }>();

    for (const row of certifiedRows) {
      if (!byId.has(row.courseId)) {
        byId.set(row.courseId, { courseId: row.courseId, courseTitle: row.courseTitle });
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  });

  const filteredRows = $derived.by(() => {
    const query = searchValue.trim().toLowerCase();

    return certifiedRows.filter((row) => {
      if (courseFilter !== 'all' && row.courseId !== courseFilter) {
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
    void searchValue;
    void courseFilter;
    page = 1;
  });
</script>

<svelte:head>
  <title>{pageTitle($t('celluloplast_certifications.title'))}</title>
</svelte:head>

<Page.Root class="w-full">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('celluloplast_certifications.title')}</Page.Title>
      <p class="ui:text-muted-foreground text-sm">{$t('celluloplast_certifications.subtitle')}</p>
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
              placeholder={$t('celluloplast_certifications.search_placeholder')}
              bind:value={searchValue}
              class="w-full md:max-w-sm"
            />

            <Select.Root type="single" bind:value={courseFilter}>
              <Select.Trigger class="w-[220px]">
                {courseFilter === 'all'
                  ? $t('celluloplast_certifications.filter.all_trainings')
                  : (courses.find((course) => course.courseId === courseFilter)?.courseTitle ??
                    $t('celluloplast_certifications.filter.training'))}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all" label={$t('celluloplast_certifications.filter.all_trainings')}>
                  {$t('celluloplast_certifications.filter.all_trainings')}
                </Select.Item>
                {#each courses as course (course.courseId)}
                  <Select.Item value={course.courseId} label={course.courseTitle}>
                    {course.courseTitle}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <CertificatesTable rows={pagedRows} />

          {#if filteredRows.length > PAGE_SIZE}
            <div class="flex items-center justify-between gap-3">
              <p class="ui:text-muted-foreground text-sm">
                {$t('celluloplast_certifications.pagination.label', {
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
                  {$t('celluloplast_certifications.pagination.prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onclick={() => {
                    page = Math.min(totalPages, page + 1);
                  }}
                >
                  {$t('celluloplast_certifications.pagination.next')}
                </Button>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/snippet}
  </Page.Body>
</Page.Root>
