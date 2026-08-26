<script lang="ts">
  import { MultiSelectList } from '@cio/ui';
  import { TextareaField } from '@cio/ui/custom/textarea-field';
  import * as RadioGroup from '@cio/ui/base/radio-group';
  import { Label } from '@cio/ui/base/label';
  import { Button } from '@cio/ui/base/button';
  import { t } from '$lib/utils/functions/translations';
  import { orgApi } from '$features/org/api/org.svelte';
  import { snackbar } from '$features/ui/snackbar/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { SvelteSet } from 'svelte/reactivity';
  import { getAudienceCsvTemplate, parseAudienceCsv } from '../utils/audience-csv';

  interface Course {
    id: string;
    title: string;
  }

  interface Cohort {
    id: string;
    name: string;
  }

  interface Props {
    courses: Course[];
    cohorts: Cohort[];
  }

  let { courses, cohorts }: Props = $props();

  let csvText = $state('');
  let courseAccessMode = $state('none');
  let cohortAccessMode = $state('none');
  let selectedCourseIds = new SvelteSet<string>();
  let selectedCohortIds = new SvelteSet<string>();
  let sendEmail = $state(true);
  let isSubmitting = $state(false);

  const audiencePath = $derived(page.url.pathname.replace(/\/import$/, ''));
  const parsed = $derived(parseAudienceCsv(csvText));
  const parsedRows = $derived(parsed.rows);
  const parseErrors = $derived(parsed.errors);

  function toggleCourse(courseId: string) {
    if (selectedCourseIds.has(courseId)) {
      selectedCourseIds.delete(courseId);
    } else {
      selectedCourseIds.add(courseId);
    }
  }

  function toggleCohort(cohortId: string) {
    if (selectedCohortIds.has(cohortId)) {
      selectedCohortIds.delete(cohortId);
    } else {
      selectedCohortIds.add(cohortId);
    }
  }

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    csvText = await file.text();
    input.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([getAudienceCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'employes-modele.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (parsedRows.length === 0) {
      snackbar.error('audience.import.snackbar_no_emails');
      return;
    }

    isSubmitting = true;

    try {
      const result = await orgApi.importAudienceMembers({
        rows: parsedRows,
        allCourses: courseAccessMode === 'all',
        allCohorts: cohortAccessMode === 'all',
        courseIds: courseAccessMode === 'select' ? [...selectedCourseIds] : undefined,
        cohortIds: cohortAccessMode === 'select' ? [...selectedCohortIds] : undefined,
        sendEmail
      });

      if (result) {
        await goto(resolve(audiencePath, {}));
      }
    } catch {
      snackbar.error('audience.import.snackbar_failed');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form id="import-audience-form" class="space-y-6" onsubmit={handleSubmit}>
  <p class="ui:text-muted-foreground text-sm">{$t('audience.import.description')}</p>

  <div class="flex flex-wrap gap-2">
    <Button type="button" variant="outline" onclick={downloadTemplate}>
      {$t('audience.import.download_template')}
    </Button>
    <Label
      class="border-input bg-background hover:ui:bg-accent inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"
    >
      {$t('audience.import.upload_file')}
      <input type="file" accept=".csv,text/csv" class="sr-only" onchange={handleFileChange} />
    </Label>
  </div>

  <TextareaField
    label={$t('audience.import.csv_label')}
    bind:value={csvText}
    rows={8}
    className="w-full font-mono text-sm"
    placeholder={$t('audience.import.csv_placeholder')}
  />

  {#if parsedRows.length > 0}
    <div class="space-y-2">
      <p class="text-sm font-medium">
        {$t('audience.import.preview_label', { count: parsedRows.length })}
      </p>
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-left text-sm">
          <thead class="ui:bg-muted/40">
            <tr>
              <th class="px-3 py-2">{$t('audience.email')}</th>
              <th class="px-3 py-2">{$t('audience.create.first_name_label')}</th>
              <th class="px-3 py-2">{$t('audience.create.last_name_label')}</th>
              <th class="px-3 py-2">{$t('audience.job_title')}</th>
              <th class="px-3 py-2">{$t('audience.department')}</th>
              <th class="px-3 py-2">{$t('audience.manager')}</th>
            </tr>
          </thead>
          <tbody>
            {#each parsedRows.slice(0, 10) as row (row.email)}
              <tr class="border-t">
                <td class="px-3 py-2">{row.email}</td>
                <td class="px-3 py-2">{row.firstName || '—'}</td>
                <td class="px-3 py-2">{row.lastName || '—'}</td>
                <td class="px-3 py-2">{row.jobTitle || '—'}</td>
                <td class="px-3 py-2">{row.department || '—'}</td>
                <td class="px-3 py-2">{row.managerEmail || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if parsedRows.length > 10}
        <p class="ui:text-muted-foreground text-xs">
          {$t('audience.import.preview_more', { count: parsedRows.length - 10 })}
        </p>
      {/if}
    </div>
  {/if}

  {#if parseErrors.length > 0}
    <p class="ui:text-destructive text-sm">{$t('audience.import.parse_errors', { count: parseErrors.length })}</p>
  {/if}

  <div class="space-y-3">
    <Label class="text-sm font-medium">{$t('audience.import.course_access')}</Label>
    <RadioGroup.Root bind:value={courseAccessMode}>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="none" id="course-none" />
        <Label for="course-none">{$t('audience.import.no_courses')}</Label>
      </div>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="all" id="course-all" />
        <Label for="course-all">{$t('audience.import.all_courses')}</Label>
      </div>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="select" id="course-select" />
        <Label for="course-select">{$t('audience.import.select_courses')}</Label>
      </div>
    </RadioGroup.Root>

    {#if courseAccessMode === 'select'}
      <MultiSelectList
        items={courses.map((course) => ({ id: course.id, label: course.title }))}
        emptyMessage={$t('audience.import.select_courses_placeholder')}
        isSelected={(id) => selectedCourseIds.has(id)}
        onToggle={toggleCourse}
        searchPlaceholder={$t('audience.import.select_courses_placeholder')}
      />
    {/if}
  </div>

  <div class="space-y-3">
    <Label class="text-sm font-medium">{$t('audience.import.cohort_access')}</Label>
    <RadioGroup.Root bind:value={cohortAccessMode}>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="none" id="cohort-none" />
        <Label for="cohort-none">{$t('audience.import.no_cohorts')}</Label>
      </div>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="all" id="cohort-all" />
        <Label for="cohort-all">{$t('audience.import.all_cohorts')}</Label>
      </div>
      <div class="flex items-center space-x-2">
        <RadioGroup.Item value="select" id="cohort-select" />
        <Label for="cohort-select">{$t('audience.import.select_cohorts')}</Label>
      </div>
    </RadioGroup.Root>

    {#if cohortAccessMode === 'select'}
      <MultiSelectList
        items={cohorts.map((cohort) => ({ id: cohort.id, label: cohort.name }))}
        emptyMessage={$t('audience.import.select_cohorts_placeholder')}
        isSelected={(id) => selectedCohortIds.has(id)}
        onToggle={toggleCohort}
        searchPlaceholder={$t('audience.import.select_cohorts_placeholder')}
      />
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <input id="send-email" type="checkbox" bind:checked={sendEmail} class="size-4" />
    <Label for="send-email">{$t('audience.import.send_email')}</Label>
  </div>

  <Button type="submit" loading={isSubmitting} disabled={parsedRows.length === 0}>
    {$t('audience.import.submit')}
  </Button>
</form>
