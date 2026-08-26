<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import { Spinner } from '@cio/ui/base/spinner';
  import { Empty } from '@cio/ui/custom/empty';
  import { BlurFade } from '@cio/ui/custom/animation/blurfade';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import AwardIcon from '@lucide/svelte/icons/award';
  import UserRoundIcon from '@lucide/svelte/icons/user-round';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { coursesApi } from '$features/course/api';
  import { getStudentCourseProgressPercent } from '$features/course/utils/compliance-utils';
  import { getStudentCourseContinuePath } from '$features/course/utils/student-course-navigation';
  import {
    getCelluloplastLmsActionKey,
    getCelluloplastLmsStatusKey,
    getCelluloplastLmsTrainingStatus,
    isCelluloplastLmsSimplified,
    sortCelluloplastLmsTrainings
  } from '$lib/celluloplast/lms';
  import { CELLULOPLAST_V1 } from '$lib/celluloplast/features';
  import * as ResourceListRow from '@cio/ui/custom/resource-list-row';
  import { CourseListRow } from '$features/course/components';
  import CoursePreviewModal from '$features/lms/components/course-preview-modal.svelte';
  import type { RecommendedCourses } from '$features/course/types';
  import { Badge } from '@cio/ui/base/badge';

  type EnrolledCourse = (typeof coursesApi.enrolledCourses)[number];

  let selectedCourse = $state<RecommendedCourses[number] | null>(null);
  let previewOpen = $state(false);
  const isSimplified = isCelluloplastLmsSimplified();

  const sortedTrainings = $derived(sortCelluloplastLmsTrainings(coursesApi.enrolledCourses));
  const homeTrainings = $derived(sortedTrainings.slice(0, 4));
  const earnedCertificates = $derived(
    coursesApi.enrolledCourses.filter((course) => course.certificateEarnedAt != null)
  );

  $effect(() => {
    if (!$profile.id || !$currentOrg.id) return;

    coursesApi.getEnrolledCourses();

    if (CELLULOPLAST_V1.exploreCatalog) {
      coursesApi.getRecommendedCourses({ limit: 3 });
    }
  });

  function gotoCourse(id: string | undefined) {
    if (!id) return;

    goto(getStudentCourseContinuePath(id));
  }

  function gotoCourseCertificates(id: string | undefined) {
    if (!id) return;

    goto(`/courses/${id}/certificates`);
  }

  function getCourseCompletedItems(course: EnrolledCourse) {
    const exercisesCompleted =
      'exercisesCompleted' in course && typeof course.exercisesCompleted === 'number' ? course.exercisesCompleted : 0;

    return (course.progressRate || 0) + exercisesCompleted;
  }

  function getCourseTotalItems(course: EnrolledCourse) {
    const exercises = 'exerciseCount' in course && typeof course.exerciseCount === 'number' ? course.exerciseCount : 0;

    return (course.lessonCount || 0) + exercises;
  }
</script>

<div class="space-y-8 pb-8">
  {#if isSimplified}
    <BlurFade delay={0.05} once>
      <section class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold tracking-tight">{$t('celluloplast_lms.my_trainings')}</h2>
          <Button variant="outline" size="sm" href="/lms/mylearning">
            {$t('celluloplast_lms.view_all_trainings')}
          </Button>
        </div>

        {#if coursesApi.isLoading}
          <div class="ui:text-muted-foreground flex items-center justify-center py-16">
            <Spinner class="size-6" />
          </div>
        {:else if homeTrainings.length > 0}
          <div class="space-y-3">
            {#each homeTrainings as course (course.id)}
              {@const courseProgress = getStudentCourseProgressPercent(course)}
              {@const status = getCelluloplastLmsTrainingStatus(course)}
              {@const totalItems = getCourseTotalItems(course)}
              {@const completedItems = getCourseCompletedItems(course)}
              <article class="ui:bg-card ui:text-card-foreground rounded border p-4">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div class="flex min-w-0 flex-1 items-start gap-4">
                    <div
                      class="ui:bg-primary/10 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded"
                    >
                      {#if course.logo}
                        <img src={course.logo} alt="" class="size-full object-cover" />
                      {:else}
                        <UserRoundIcon class="ui:text-primary size-5" />
                      {/if}
                    </div>

                    <div class="min-w-0 flex-1 space-y-2">
                      <div class="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 class="truncate text-base font-semibold">{course.title}</h3>
                        <Badge variant={status === 'COMPLETED' ? 'default' : 'outline'}>
                          {$t(getCelluloplastLmsStatusKey(status))}
                        </Badge>
                      </div>

                      <div class="flex items-center gap-3">
                        <Progress value={courseProgress} max={100} class="ui:h-1.5 min-w-0 flex-1" />
                        <span class="ui:text-muted-foreground shrink-0 text-xs tabular-nums">{courseProgress}%</span>
                      </div>

                      <p class="ui:text-muted-foreground text-xs">
                        {$t('celluloplast_lms.items_done', { completed: completedItems, total: totalItems })}
                      </p>
                    </div>
                  </div>

                  <div class="flex shrink-0 flex-wrap items-center gap-2">
                    {#if status === 'COMPLETED' && course.certificateEarnedAt}
                      <Button variant="outline" onclick={() => gotoCourseCertificates(course.id)}>
                        {$t('celluloplast_lms.view_certificate')}
                      </Button>
                    {/if}
                    <Button onclick={() => gotoCourse(course.id)}>
                      {$t(getCelluloplastLmsActionKey(course))}
                    </Button>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <div class="ui:bg-card rounded border p-4">
            <Empty
              title={$t('celluloplast_lms.empty_trainings_title')}
              description={$t('celluloplast_lms.empty_trainings_description')}
              icon={BookOpenIcon}
            />
          </div>
        {/if}
      </section>
    </BlurFade>

    <BlurFade delay={0.1} once>
      <section class="ui:bg-card rounded border p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="ui:bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded">
              <AwardIcon class="ui:text-primary size-5" />
            </div>
            <div>
              <h2 class="text-base font-semibold">{$t('celluloplast_lms.my_certificates')}</h2>
              <p class="ui:text-muted-foreground mt-1 text-sm">
                {$t('celluloplast_lms.certificates_count', { count: earnedCertificates.length })}
              </p>
            </div>
          </div>
          <Button variant="outline" href="/lms/certificates">
            {$t('celluloplast_lms.view_certificates')}
          </Button>
        </div>
      </section>
    </BlurFade>
  {:else}
    <!-- Upstream LMS dashboard retained for non-Celluloplast mode. -->
    <p class="ui:text-muted-foreground text-sm">{$t('dashboard.learning_awaits_you')}</p>
  {/if}

  {#if CELLULOPLAST_V1.exploreCatalog && (coursesApi.isLoading || coursesApi.recommendedCourses.length > 0)}
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="ui:text-muted-foreground text-sm font-semibold tracking-[0.14em] uppercase">
          {$t('dashboard.explore_more_courses')}
        </h2>
        <Button variant="outline" size="sm" onclick={() => goto('/lms/explore')}>
          {$t('dashboard.view_more')}
        </Button>
      </div>

      {#if coursesApi.isLoading}
        <div class="ui:text-muted-foreground flex items-center justify-center py-8">
          <Spinner class="size-6" />
        </div>
      {:else}
        <ResourceListRow.Group class="@container">
          {#each coursesApi.recommendedCourses as course (course.id)}
            <CourseListRow
              id={course.id}
              slug={course.slug ?? ''}
              title={course.title}
              logo={course.logo}
              type={course.type}
              description={course.description ?? ''}
              isPublished={course.isPublished ?? false}
              lessonCount={course.lessonCount}
              exerciseCount={course.exerciseCount}
              isExplore={true}
              isLMS={true}
              hiddenColumns={['published', 'tags', 'students']}
              onExploreClick={() => {
                selectedCourse = course;
                previewOpen = true;
              }}
            />
          {/each}
        </ResourceListRow.Group>
      {/if}
    </section>
  {/if}

  {#if selectedCourse}
    <CoursePreviewModal course={selectedCourse} bind:open={previewOpen} />
  {/if}
</div>
