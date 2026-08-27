<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import * as Field from '@cio/ui/base/field';
  import { Label } from '@cio/ui/base/label';
  import { Switch } from '@cio/ui/base/switch';
  import { InputField } from '@cio/ui/custom/input-field';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import { DeleteModal, UnsavedChanges, UploadWidget } from '$features/ui';
  import PublishAudienceAssignment from '$features/course/components/publish-audience-assignment.svelte';
  import { courseApi } from '$features/course/api';
  import { DEFAULT_COURSE_AUDIENCE_ASSIGNMENT, settings } from '$features/course/utils/settings-store';
  import { CELLULOPLAST_AUTHORING } from '$lib/celluloplast/course-authoring';
  import { snackbar } from '$features/ui/snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { handleOpenWidget } from '$features/ui/course-landing-page/store';
  import { currentOrgPath, isFreePlan } from '$lib/utils/store/org';
  import type { Course } from '../utils/types';

  interface Props {
    hasUnsavedChanges?: boolean;
  }

  let { hasUnsavedChanges = $bindable(false) }: Props = $props();

  let initializedCourseId = $state<string | null>(null);
  let isDeleting = $state(false);
  let isPublicationSaving = $state(false);
  let openDeleteModal = $state(false);
  let errors: {
    title: string | undefined;
    description: string | undefined;
  } = $state({
    title: undefined,
    description: undefined
  });

  const courseStatusLabel = $derived(
    $settings.isPublished ? $t('celluloplast_settings.published') : $t('celluloplast_settings.unpublished')
  );

  const publicationActionLabel = $derived(
    $settings.isPublished ? $t('celluloplast_settings.unpublish_button') : $t('celluloplast_settings.publish_button')
  );

  const assignEmployeesHref = $derived.by(() => {
    const courseId = courseApi.course?.id;

    if (!courseId) {
      return undefined;
    }

    return CELLULOPLAST_AUTHORING.assignPeoplePath(courseId);
  });

  function toggleCoverWidget() {
    $handleOpenWidget.open = !$handleOpenWidget.open;
  }

  function clearCoverImage() {
    $settings.logo = '';
    hasUnsavedChanges = true;
  }

  function buildAudienceAssignmentPayload() {
    const assignment = $settings.audienceAssignment;

    return {
      mode: assignment.mode,
      sendEmail: assignment.sendEmail,
      ...(assignment.mode === 'members' ? { memberIds: assignment.memberIds } : {}),
      ...(assignment.mode === 'jobTitles' ? { jobTitles: assignment.jobTitles } : {}),
      ...(assignment.mode === 'departments' ? { departments: assignment.departments } : {})
    };
  }

  function validateAudienceAssignment(isPublishing: boolean): boolean {
    if (!isPublishing) {
      return true;
    }

    const assignment = $settings.audienceAssignment;

    if (assignment.mode === 'members' && assignment.memberIds.length === 0) {
      snackbar.error('celluloplast_settings.audience_validation_members');
      return false;
    }

    if (assignment.mode === 'jobTitles' && assignment.jobTitles.length === 0) {
      snackbar.error('celluloplast_settings.audience_validation_job_titles');
      return false;
    }

    if (assignment.mode === 'departments' && assignment.departments.length === 0) {
      snackbar.error('celluloplast_settings.audience_validation_departments');
      return false;
    }

    return true;
  }

  function mapCourseAudienceAssignment(course: Course) {
    const saved = course.metadata?.audienceAssignment;

    if (!saved || typeof saved !== 'object' || !('mode' in saved)) {
      return { ...DEFAULT_COURSE_AUDIENCE_ASSIGNMENT };
    }

    return {
      mode: saved.mode,
      memberIds: saved.memberIds ?? [],
      jobTitles: saved.jobTitles ?? [],
      departments: saved.departments ?? [],
      sendEmail: saved.sendEmail ?? true
    };
  }

  async function handleDeleteCourse() {
    if (!courseApi.course) return;

    isDeleting = true;
    await courseApi.delete(courseApi.course.id);

    if (courseApi.success) {
      goto(`${$currentOrgPath}/courses`);
    }

    isDeleting = false;
  }

  async function setDefault(course: Course) {
    if (!course || !Object.keys(course).length) return;

    untrack(() => {
      settings.set({
        courseTitle: course.title,
        type: course.type || CELLULOPLAST_AUTHORING.defaultCourseType,
        courseDescription: course.description,
        logo: course.logo || '',
        tabs: course.metadata?.lessonTabsOrder || $settings.tabs,
        grading: !!course.metadata?.grading,
        lessonDownload: !!course.metadata?.lessonDownload,
        isPublished: !!course.isPublished,
        allowNewStudents: !!course.metadata?.allowNewStudent,
        isContentGroupingEnabled: course.metadata?.isContentGroupingEnabled ?? true,
        progressionMode: course.metadata?.progressionMode ?? 'free',
        callout: null,
        welcomeEmailMessage: course.metadata?.welcomeEmailMessage ?? '',
        certificate: {
          isDownloadable: course.certificate?.isDownloadable ?? true,
          deadline: course.certificate?.deadline ?? null,
          threshold: typeof course.certificate?.threshold === 'number' ? course.certificate.threshold : 100,
          requiredExerciseId: course.certificate?.requiredExerciseId ?? null,
          exerciseMinScorePercent:
            typeof course.certificate?.exerciseMinScorePercent === 'number'
              ? course.certificate.exerciseMinScorePercent
              : null
        },
        audienceAssignment: mapCourseAudienceAssignment(course)
      });
    });
  }

  export function handleDiscard() {
    if (!courseApi.course) return;

    setDefault(courseApi.course);
    errors.title = undefined;
    errors.description = undefined;
    hasUnsavedChanges = false;
  }

  export async function handleSave(options: { isPublicationFlow?: boolean } = {}) {
    const { isPublicationFlow = false } = options;

    if (!$settings.courseTitle.trim()) {
      errors.title = $t('snackbar.course_settings.error.title');
      return;
    }

    if (!$settings.courseDescription.trim()) {
      errors.description = $t('snackbar.course_settings.error.description');
      return;
    }

    if (!validateAudienceAssignment($settings.isPublished)) {
      return;
    }

    if (!courseApi.course) return;

    const audienceAssignment = buildAudienceAssignmentPayload();

    const metadataPayload = {
      ...(courseApi.course.metadata ?? {}),
      allowNewStudent: $settings.isPublished,
      audienceAssignment
    };

    const certificatePayload = {
      ...(courseApi.course.certificate ?? {}),
      isDownloadable: $settings.certificate.isDownloadable,
      threshold:
        typeof $settings.certificate.threshold === 'number'
          ? $settings.certificate.threshold
          : CELLULOPLAST_AUTHORING.defaultCertificate.threshold,
      deadline: $settings.certificate.deadline,
      requiredExerciseId: $settings.certificate.requiredExerciseId,
      exerciseMinScorePercent: $settings.certificate.exerciseMinScorePercent
    };

    const updatePayload = {
      title: $settings.courseTitle.trim(),
      description: $settings.courseDescription.trim(),
      type: courseApi.course.type,
      logo: $settings.logo,
      isPublished: $settings.isPublished,
      metadata: metadataPayload,
      certificate: certificatePayload
    };

    const response = await courseApi.update(courseApi.course.id, updatePayload, {
      showSuccessToast: !isPublicationFlow
    });

    if (courseApi.success && response) {
      hasUnsavedChanges = false;

      if (isPublicationFlow && $settings.isPublished) {
        const audienceSync = (response as { audienceSync?: { assigned: number; alreadyEnrolled: number } })
          .audienceSync;

        if (audienceSync) {
          snackbar.success(
            t.get('celluloplast_settings.publish_assigned_success', {
              assigned: audienceSync.assigned,
              alreadyEnrolled: audienceSync.alreadyEnrolled
            })
          );
        } else {
          snackbar.success('celluloplast_settings.publish_success');
        }
      }
    }
  }

  async function handlePublicationAction() {
    const nextPublished = !$settings.isPublished;

    if (nextPublished && !validateAudienceAssignment(true)) {
      return;
    }

    $settings.isPublished = nextPublished;
    $settings.allowNewStudents = nextPublished;
    hasUnsavedChanges = true;
    isPublicationSaving = true;

    try {
      await handleSave({ isPublicationFlow: true });
    } finally {
      isPublicationSaving = false;
    }
  }

  $effect(() => {
    const courseData = $page.data?.course;
    const courseId = $page.data?.courseId;

    if (courseData && courseId && !courseApi.course) {
      courseApi.course = courseData;
    }
  });

  $effect(() => {
    const course = courseApi.course;

    if (course?.id && initializedCourseId !== course.id) {
      initializedCourseId = course.id;
      setDefault(course);
    }
  });
</script>

<UnsavedChanges bind:hasUnsavedChanges />

<DeleteModal onDelete={handleDeleteCourse} bind:open={openDeleteModal} />

<Field.Group class="w-full max-w-md! px-2">
  {#if CELLULOPLAST_AUTHORING.visibleSettings.coverImage}
    <Field.Set>
      <Field.Legend>{$t('celluloplast_settings.cover_heading')}</Field.Legend>
      <Field.Description>{$t('celluloplast_settings.cover_description')}</Field.Description>
      <Field.Group>
        <Field.Field>
          <div class="flex items-center gap-2">
            <Button variant="secondary" onclick={toggleCoverWidget}>
              {$t('course.navItem.settings.replace')}
            </Button>
            <Button variant="outline" onclick={clearCoverImage}>
              {$t('celluloplast_settings.remove_cover')}
            </Button>
          </div>

          {#if $handleOpenWidget.open}
            <UploadWidget
              bind:imageURL={$settings.logo}
              onchange={() => {
                hasUnsavedChanges = true;
              }}
            />
          {/if}
        </Field.Field>

        <Field.Field>
          <img
            alt="Training cover"
            src={$settings.logo ? $settings.logo : '/images/classroomio-course-img-template.jpg'}
            class="relative mt-2 h-[200px] w-[280px] rounded-md border object-cover md:mt-0"
          />
        </Field.Field>
      </Field.Group>
    </Field.Set>

    <Field.Separator />
  {/if}

  {#if CELLULOPLAST_AUTHORING.visibleSettings.title || CELLULOPLAST_AUTHORING.visibleSettings.description}
    <Field.Set>
      <Field.Legend>{$t('celluloplast_settings.details_heading')}</Field.Legend>
      <Field.Group>
        <Field.Field>
          <InputField
            label={$t('celluloplast_settings.name_label')}
            placeholder={$t('celluloplast_settings.name_placeholder')}
            className="w-full"
            isRequired
            bind:value={$settings.courseTitle}
            errorMessage={errors.title}
            onInputChange={() => {
              errors.title = undefined;
              hasUnsavedChanges = true;
            }}
          />
        </Field.Field>

        <Field.Field>
          <TextareaField
            label={$t('celluloplast_settings.description_label')}
            placeholder={$t('celluloplast_settings.description_placeholder')}
            className="w-full"
            isRequired
            bind:value={$settings.courseDescription}
            errorMessage={errors.description}
            onchange={() => {
              errors.description = undefined;
              hasUnsavedChanges = true;
            }}
          />
        </Field.Field>
      </Field.Group>
    </Field.Set>

    <Field.Separator />
  {/if}

  {#if CELLULOPLAST_AUTHORING.visibleSettings.certificateEnabled}
    <Field.Set>
      <Field.Legend>{$t('celluloplast_settings.certificate_heading')}</Field.Legend>
      <Field.Description>{$t('celluloplast_settings.certificate_description')}</Field.Description>
      <Field.Field orientation="horizontal">
        <Switch
          id="certificate-downloadable"
          checked={$settings.certificate.isDownloadable}
          onCheckedChange={(checked) => {
            $settings.certificate.isDownloadable = checked;
            hasUnsavedChanges = true;
          }}
          disabled={$isFreePlan}
        />
        <Label for="certificate-downloadable">{$t('celluloplast_authoring.certificate_toggle')}</Label>
      </Field.Field>
    </Field.Set>

    <Field.Separator />
  {/if}

  {#if CELLULOPLAST_AUTHORING.visibleSettings.publication}
    <Field.Set id="publish">
      <Field.Legend>{$t('celluloplast_settings.publication_heading')}</Field.Legend>
      <Field.Description>{$t('celluloplast_settings.publication_description')}</Field.Description>

      <Field.Group>
        <Field.Field>
          <Field.Label>{$t('celluloplast_settings.status_label')}</Field.Label>
          <div class="flex items-center gap-3">
            <Badge variant={$settings.isPublished ? 'default' : 'outline'}>{courseStatusLabel}</Badge>
            <span class="ui:text-muted-foreground text-sm">{courseStatusLabel}</span>
          </div>
        </Field.Field>

        <PublishAudienceAssignment
          onChange={() => {
            hasUnsavedChanges = true;
          }}
        />

        <Field.Field>
          <Button onclick={handlePublicationAction} loading={isPublicationSaving} disabled={isPublicationSaving}>
            {publicationActionLabel}
          </Button>
        </Field.Field>

        <Field.Field>
          <Field.Description>{$t('celluloplast_settings.publication_help')}</Field.Description>
        </Field.Field>
      </Field.Group>
    </Field.Set>

    <Field.Separator />
  {/if}

  {#if CELLULOPLAST_AUTHORING.visibleSettings.assignment}
    <Field.Set>
      <Field.Legend>{$t('celluloplast_settings.assignment_heading')}</Field.Legend>
      <Field.Description>{$t('celluloplast_settings.assignment_description')}</Field.Description>
      <Field.Field>
        <Button href={assignEmployeesHref} disabled={!$settings.isPublished || !assignEmployeesHref}>
          {$t('celluloplast_authoring.assign_employees')}
        </Button>
      </Field.Field>
    </Field.Set>

    <Field.Separator />
  {/if}

  {#if CELLULOPLAST_AUTHORING.visibleSettings.deletion}
    <Field.Set id="delete">
      <Field.Legend>{$t('celluloplast_settings.delete_heading')}</Field.Legend>
      <Field.Description>{$t('celluloplast_settings.delete_description')}</Field.Description>
      <Field.Field>
        <Button
          variant="destructive"
          onclick={() => (openDeleteModal = true)}
          loading={isDeleting}
          disabled={isDeleting}
          class="w-fit!"
        >
          {$t('celluloplast_settings.delete_button')}
        </Button>
      </Field.Field>
    </Field.Set>
  {/if}
</Field.Group>
