<script lang="ts">
  import { onMount } from 'svelte';
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import { Checkbox } from '@cio/ui/base/checkbox';
  import { orgApi } from '$features/org/api/org.svelte';
  import type { OrganizationAudienceMember } from '$features/org/utils/types';
  import { t } from '$lib/utils/functions/translations';

  interface Props {
    open: boolean;
    managers: OrganizationAudienceMember[];
    onCreated?: () => void;
  }

  let { open = $bindable(false), managers, onCreated }: Props = $props();

  let email = $state('');
  let firstName = $state('');
  let lastName = $state('');
  let positionId = $state<string>('none');
  let departmentId = $state<string>('none');
  let managerMemberId = $state<string>('none');
  let office365 = $state(false);
  let refsLoaded = $state(false);

  onMount(async () => {
    await Promise.all([orgApi.getPositions(), orgApi.getDepartments()]);
    refsLoaded = true;
  });

  function resetForm() {
    email = '';
    firstName = '';
    lastName = '';
    positionId = 'none';
    departmentId = 'none';
    managerMemberId = 'none';
    office365 = false;
    orgApi.errors = {};
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (!isOpen) {
      resetForm();
    }
  }

  async function handleSubmit() {
    const result = await orgApi.createAudienceMember({
      email: email.trim(),
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      positionId: positionId !== 'none' ? Number(positionId) : undefined,
      departmentId: departmentId !== 'none' ? Number(departmentId) : undefined,
      managerMemberId: managerMemberId !== 'none' ? Number(managerMemberId) : undefined,
      sendEmail: true,
      office365
    });

    if (!result) {
      return;
    }

    resetForm();
    open = false;
    onCreated?.();
  }

  const managerOptions = $derived(
    managers.map((member) => ({
      value: String(member.id),
      label: member.name ? `${member.name} (${member.email})` : member.email
    }))
  );

  const selectedManagerLabel = $derived(
    managerMemberId === 'none'
      ? t.get('audience.create.manager_placeholder')
      : (managerOptions.find((option) => option.value === managerMemberId)?.label ??
          t.get('audience.create.manager_placeholder'))
  );

  /** Local-part @ celluloplast.onmicrosoft.com — mirrors toOffice365DeliveryEmail on the API. */
  const office365PreviewEmail = $derived.by(() => {
    const localPart = email.trim().split('@')[0];
    return localPart ? `${localPart}@celluloplast.onmicrosoft.com` : '';
  });

  const selectedPositionLabel = $derived(
    positionId === 'none'
      ? t.get('audience.create.job_title_placeholder')
      : (orgApi.positions.find((position) => String(position.id) === positionId)?.name ??
          t.get('audience.create.job_title_placeholder'))
  );

  const selectedDepartmentLabel = $derived(
    departmentId === 'none'
      ? t.get('audience.create.department_placeholder')
      : (orgApi.departments.find((department) => String(department.id) === departmentId)?.name ??
          t.get('audience.create.department_placeholder'))
  );
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{$t('audience.create.title')}</Dialog.Title>
      <Dialog.Description>{$t('audience.create.description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group class="py-2">
      <Field.Field>
        <Field.Label for="audience-create-email">{$t('audience.create.email_label')} *</Field.Label>
        <Input id="audience-create-email" type="email" bind:value={email} autocomplete="email" />
        {#if orgApi.errors.email}
          <Field.Error>{orgApi.errors.email}</Field.Error>
        {/if}
      </Field.Field>

      <Field.Field orientation="horizontal">
        <Checkbox id="audience-create-office365" bind:checked={office365} />
        <Field.Label for="audience-create-office365">{$t('audience.create.office365_label')}</Field.Label>
      </Field.Field>
      {#if office365 && office365PreviewEmail}
        <p class="ui:text-muted-foreground text-sm">
          {$t('audience.create.office365_hint', { email: office365PreviewEmail })}
        </p>
      {/if}

      <div class="grid gap-4 sm:grid-cols-2">
        <Field.Field>
          <Field.Label for="audience-create-first-name">{$t('audience.create.first_name_label')}</Field.Label>
          <Input id="audience-create-first-name" bind:value={firstName} />
        </Field.Field>

        <Field.Field>
          <Field.Label for="audience-create-last-name">{$t('audience.create.last_name_label')}</Field.Label>
          <Input id="audience-create-last-name" bind:value={lastName} />
        </Field.Field>
      </div>

      <Field.Field>
        <Field.Label>{$t('audience.create.job_title_label')}</Field.Label>
        {#if refsLoaded && orgApi.positions.length === 0}
          <p class="ui:text-muted-foreground text-sm">{$t('audience.create.job_title_empty')}</p>
        {:else}
          <Select.Root type="single" bind:value={positionId}>
            <Select.Trigger class="w-full">
              {selectedPositionLabel}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">{$t('audience.create.job_title_placeholder')}</Select.Item>
              {#each orgApi.positions as position (position.id)}
                <Select.Item value={String(position.id)}>{position.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
        {#if orgApi.errors.jobTitle}
          <Field.Error>{orgApi.errors.jobTitle}</Field.Error>
        {/if}
      </Field.Field>

      <Field.Field>
        <Field.Label>{$t('audience.create.department_label')}</Field.Label>
        {#if refsLoaded && orgApi.departments.length === 0}
          <p class="ui:text-muted-foreground text-sm">{$t('audience.create.department_empty')}</p>
        {:else}
          <Select.Root type="single" bind:value={departmentId}>
            <Select.Trigger class="w-full">
              {selectedDepartmentLabel}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">{$t('audience.create.department_placeholder')}</Select.Item>
              {#each orgApi.departments as department (department.id)}
                <Select.Item value={String(department.id)}>{department.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
        {#if orgApi.errors.department}
          <Field.Error>{orgApi.errors.department}</Field.Error>
        {/if}
      </Field.Field>

      <Field.Field>
        <Field.Label>{$t('audience.create.manager_label')}</Field.Label>
        <Select.Root type="single" bind:value={managerMemberId}>
          <Select.Trigger class="w-full">
            {selectedManagerLabel}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="none">{$t('audience.create.manager_placeholder')}</Select.Item>
            {#each managerOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </Field.Field>
    </Field.Group>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleOpenChange(false)}>{$t('audience.create.cancel')}</Button>
      <Button loading={orgApi.isLoading} disabled={!email.trim()} onclick={handleSubmit}>
        {$t('audience.create.submit')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
