<script lang="ts">
  import { onMount } from 'svelte';
  import * as Field from '@cio/ui/base/field';
  import * as RadioGroup from '@cio/ui/base/radio-group';
  import { Label } from '@cio/ui/base/label';
  import { CheckboxField, MultiSelectList } from '@cio/ui';
  import { orgApi } from '$features/org/api/org.svelte';
  import { settings } from '$features/course/utils/settings-store';
  import type { OrganizationAudienceMember } from '$features/org/utils/types';
  import { t } from '$lib/utils/functions/translations';
  import { SvelteSet } from 'svelte/reactivity';
  import { currentOrg } from '$lib/utils/store/org';

  interface Props {
    onChange?: () => void;
  }

  let { onChange }: Props = $props();

  let jobTitles = $state<string[]>([]);
  let departments = $state<string[]>([]);
  let employees = $state<OrganizationAudienceMember[]>([]);
  let isLoadingOptions = $state(true);

  const selectedMemberIds = $derived(new SvelteSet($settings.audienceAssignment.memberIds));
  const selectedJobTitles = $derived(new SvelteSet($settings.audienceAssignment.jobTitles));
  const selectedDepartments = $derived(new SvelteSet($settings.audienceAssignment.departments));

  function notifyChange() {
    onChange?.();
  }

  function setMode(mode: typeof $settings.audienceAssignment.mode) {
    $settings.audienceAssignment.mode = mode;
    notifyChange();
  }

  function toggleMember(memberId: number) {
    if ($settings.audienceAssignment.memberIds.includes(memberId)) {
      $settings.audienceAssignment.memberIds = $settings.audienceAssignment.memberIds.filter((id) => id !== memberId);
    } else {
      $settings.audienceAssignment.memberIds = [...$settings.audienceAssignment.memberIds, memberId];
    }
    notifyChange();
  }

  function toggleJobTitle(jobTitle: string) {
    if ($settings.audienceAssignment.jobTitles.includes(jobTitle)) {
      $settings.audienceAssignment.jobTitles = $settings.audienceAssignment.jobTitles.filter(
        (title) => title !== jobTitle
      );
    } else {
      $settings.audienceAssignment.jobTitles = [...$settings.audienceAssignment.jobTitles, jobTitle];
    }
    notifyChange();
  }

  function toggleDepartment(department: string) {
    if ($settings.audienceAssignment.departments.includes(department)) {
      $settings.audienceAssignment.departments = $settings.audienceAssignment.departments.filter(
        (value) => value !== department
      );
    } else {
      $settings.audienceAssignment.departments = [...$settings.audienceAssignment.departments, department];
    }
    notifyChange();
  }

  onMount(async () => {
    isLoadingOptions = true;

    try {
      const orgId = $currentOrg.id;
      if (!orgId) {
        return;
      }

      const [options] = await Promise.all([
        orgApi.getAudienceAssignmentOptions(),
        orgApi.getOrgAudience(orgId, { page: 1, limit: 500, sortBy: 'name', sortOrder: 'asc' })
      ]);

      jobTitles = options?.jobTitles ?? [];
      departments = options?.departments ?? [];
      employees = orgApi.audience;
    } finally {
      isLoadingOptions = false;
    }
  });
</script>

<Field.Field>
  <Field.Label>{$t('celluloplast_settings.audience_target_label')}</Field.Label>
  <Field.Description>{$t('celluloplast_settings.audience_target_description')}</Field.Description>

  <RadioGroup.Root
    value={$settings.audienceAssignment.mode}
    onValueChange={(value) => {
      if (value) {
        setMode(value as typeof $settings.audienceAssignment.mode);
      }
    }}
  >
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="all" id="audience-all" />
        <Label for="audience-all">{$t('celluloplast_settings.audience_mode_all')}</Label>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="members" id="audience-members" />
        <Label for="audience-members">{$t('celluloplast_settings.audience_mode_members')}</Label>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="jobTitles" id="audience-job-titles" />
        <Label for="audience-job-titles">{$t('celluloplast_settings.audience_mode_job_titles')}</Label>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="departments" id="audience-departments" />
        <Label for="audience-departments">{$t('celluloplast_settings.audience_mode_departments')}</Label>
      </div>
    </div>
  </RadioGroup.Root>
</Field.Field>

{#if $settings.audienceAssignment.mode === 'members'}
  <Field.Field>
    <MultiSelectList
      heading={$t('celluloplast_settings.audience_select_employees')}
      emptyMessage={isLoadingOptions ? $t('generic.loading') : $t('celluloplast_settings.audience_no_employees')}
      items={employees.map((employee) => ({
        id: String(employee.id),
        label: employee.email ? `${employee.name} (${employee.email})` : employee.name
      }))}
      isSelected={(id) => selectedMemberIds.has(Number(id))}
      onToggle={(id) => toggleMember(Number(id))}
      namePrefix="publish-audience-member"
    />
  </Field.Field>
{/if}

{#if $settings.audienceAssignment.mode === 'jobTitles'}
  <Field.Field>
    <MultiSelectList
      heading={$t('celluloplast_settings.audience_select_job_titles')}
      emptyMessage={isLoadingOptions ? $t('generic.loading') : $t('celluloplast_settings.audience_no_job_titles')}
      items={jobTitles.map((jobTitle) => ({ id: jobTitle, label: jobTitle }))}
      isSelected={(id) => selectedJobTitles.has(id)}
      onToggle={toggleJobTitle}
      namePrefix="publish-audience-job-title"
    />
  </Field.Field>
{/if}

{#if $settings.audienceAssignment.mode === 'departments'}
  <Field.Field>
    <MultiSelectList
      heading={$t('celluloplast_settings.audience_select_departments')}
      emptyMessage={isLoadingOptions ? $t('generic.loading') : $t('celluloplast_settings.audience_no_departments')}
      items={departments.map((department) => ({ id: department, label: department }))}
      isSelected={(id) => selectedDepartments.has(id)}
      onToggle={toggleDepartment}
      namePrefix="publish-audience-department"
    />
  </Field.Field>
{/if}

<Field.Field orientation="horizontal">
  <CheckboxField
    name="publish-audience-send-email"
    label={$t('celluloplast_settings.audience_send_email')}
    bind:checked={$settings.audienceAssignment.sendEmail}
  />
</Field.Field>
