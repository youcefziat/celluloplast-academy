<script lang="ts">
  import { Separator } from '@cio/ui/base/separator';
  import * as Sidebar from '@cio/ui/base/sidebar';
  import * as ButtonGroup from '@cio/ui/base/button-group';
  import * as DropdownMenu from '@cio/ui/base/dropdown-menu';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import { Button } from '@cio/ui/base/button';
  import { page } from '$app/state';
  import { currentOrgDomain } from '$lib/utils/store/org';
  import { isStudentExperience, isCourseLearnerView } from '$lib/utils/store/app';
  import { isMobileStore } from '@cio/ui/hooks/is-mobile.svelte';
  import { getCourseProgress } from '$features/course/utils/content';
  import { isCourseMobileBottomNavVisible } from '$features/course/utils/mobile-bottom-nav';
  import { courseApi } from '$features/course/api';
  import { getActiveCourseNavKey } from '$features/course/utils/functions';
  import { CELLULOPLAST_AUTHORING } from '$lib/celluloplast/course-authoring';
  import { t } from '$lib/utils/functions/translations';
  import UsersIcon from '@lucide/svelte/icons/users';
  import CourseProgressPopover from './course-progress-popover.svelte';
  import CoursePublishBadge from './course-publish-badge.svelte';
  import CoursePublicBadge from './course-public-badge.svelte';
  import CourseContextMenuContent from './course-context-menu-content.svelte';
  import ViewAsStudentModal from './view-as-student-modal.svelte';

  const showCoursePublishBadge = $derived(!$isStudentExperience);
  const isPublicCourse = $derived(courseApi.course?.type === 'PUBLIC');
  const activeNavKey = $derived(getActiveCourseNavKey(page.url.pathname, courseApi.course?.id ?? ''));
  const isPublished = $derived(courseApi.course?.isPublished ?? false);
  const lessonId = $derived(page.params.lessonId as string | undefined);
  const exerciseId = $derived(page.params.exerciseId as string | undefined);
  const showMobileBottomNav = $derived(
    isCourseMobileBottomNavVisible({
      isCourseLearnerView: $isCourseLearnerView,
      isMobile: isMobileStore.current,
      isLessonOrExercisePage: Boolean(lessonId || exerciseId),
      courseProgress: getCourseProgress(courseApi.course)
    })
  );

  let viewAsStudentOpen = $state(false);
</script>

<header
  class="border-border ui:bg-background ui:z-app-bar sticky top-0 flex h-12 w-full shrink-0 items-center gap-2 border-b backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8"
>
  <div class="flex w-full items-center gap-2 px-4">
    <Sidebar.Trigger />

    <div class="h-4 w-2">
      <Separator orientation="vertical" />
    </div>

    <div class="flex w-[60%] min-w-0 flex-1 flex-col justify-center gap-0.5">
      <div class="flex min-w-0 items-center gap-2">
        <p class="max-w-xs truncate text-sm font-medium">
          {activeNavKey ? $t(activeNavKey) : ''}
        </p>

        {#if isPublicCourse}
          <CoursePublicBadge class="shrink-0" />
        {/if}

        {#if showCoursePublishBadge}
          <CoursePublishBadge {isPublished} />
        {/if}
      </div>
    </div>

    <span class="grow"></span>

    {#if $isCourseLearnerView && !showMobileBottomNav}
      <CourseProgressPopover class="md:hidden" />
    {/if}

    {#if !$isStudentExperience && courseApi.course?.id}
      <Button variant="outline" size="sm" href={CELLULOPLAST_AUTHORING.assignPeoplePath(courseApi.course.id)}>
        <UsersIcon size={14} />
        <span class="hidden sm:inline">{$t('celluloplast_authoring.assign_employees')}</span>
      </Button>

      {#if !isPublished}
        <Button size="sm" href={CELLULOPLAST_AUTHORING.publishSettingsPath(courseApi.course.id)}>
          {$t('celluloplast_authoring.publish_training')}
        </Button>
      {/if}
    {/if}

    {#if !$isStudentExperience}
      <ButtonGroup.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="outline"
                size="sm"
                aria-label={$t('courses.course_card.actions_menu_aria')}
                disabled={!courseApi.course?.id}
              >
                <EllipsisVerticalIcon size={14} />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {#if courseApi.course}
              <CourseContextMenuContent
                id={courseApi.course.id}
                title={courseApi.course.title}
                description={courseApi.course.description}
                isPublished={courseApi.course.isPublished ?? false}
                courseType={courseApi.course.type}
                slug={courseApi.course.slug ?? ''}
                includeViewAsStudent={true}
                onViewAsStudent={() => (viewAsStudentOpen = true)}
              />
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </ButtonGroup.Root>
    {/if}
  </div>
</header>

<ViewAsStudentModal
  bind:open={viewAsStudentOpen}
  courseId={courseApi.course?.id}
  currentOrgDomain={$currentOrgDomain}
/>
