<script lang="ts">
  import * as UnderlineTabs from '@cio/ui/custom/underline-tabs';
  import { CoursesPage } from '$features/course/pages';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { coursesApi } from '$features/course/api';
  import { filterCelluloplastLmsByStatus } from '$lib/celluloplast/lms';

  let searchValue = $state('');
  let currentTab = $state('in_progress');

  const coursesNotStarted = $derived(filterCelluloplastLmsByStatus(coursesApi.enrolledCourses, 'NOT_STARTED'));
  const coursesInProgress = $derived(filterCelluloplastLmsByStatus(coursesApi.enrolledCourses, 'IN_PROGRESS'));
  const coursesComplete = $derived(filterCelluloplastLmsByStatus(coursesApi.enrolledCourses, 'COMPLETED'));

  $effect(() => {
    if (!$profile.id || !$currentOrg.id) return;

    coursesApi.getEnrolledCourses();
  });

  const tabs = $derived([
    {
      label: $t('celluloplast_lms.tab_in_progress', { count: coursesInProgress.length }),
      value: 'in_progress',
      courses: coursesInProgress,
      emptyTitle: $t('celluloplast_lms.empty_in_progress_title'),
      emptyDescription: $t('celluloplast_lms.empty_in_progress_description')
    },
    {
      label: $t('celluloplast_lms.tab_not_started', { count: coursesNotStarted.length }),
      value: 'not_started',
      courses: coursesNotStarted,
      emptyTitle: $t('celluloplast_lms.empty_not_started_title'),
      emptyDescription: $t('celluloplast_lms.empty_not_started_description')
    },
    {
      label: $t('celluloplast_lms.tab_completed', { count: coursesComplete.length }),
      value: 'completed',
      courses: coursesComplete,
      emptyTitle: $t('celluloplast_lms.empty_completed_title'),
      emptyDescription: $t('celluloplast_lms.empty_completed_description')
    }
  ]);
</script>

<UnderlineTabs.Root bind:value={currentTab}>
  <UnderlineTabs.List class="flex flex-wrap">
    {#each tabs as tab (tab.value)}
      <UnderlineTabs.Trigger value={tab.value}>
        {tab.label}
      </UnderlineTabs.Trigger>
    {/each}
  </UnderlineTabs.List>

  {#each tabs as tab (tab.value)}
    <UnderlineTabs.Content value={tab.value}>
      <CoursesPage
        bind:searchValue
        courses={tab.courses}
        emptyDescription={tab.emptyDescription}
        emptyTitle={tab.emptyTitle}
        isLMS={true}
        isLoading={coursesApi.isLoading}
        showSortSelect={false}
      />
    </UnderlineTabs.Content>
  {/each}
</UnderlineTabs.Root>
