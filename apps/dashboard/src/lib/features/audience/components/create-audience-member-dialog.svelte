<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
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
  let jobTitle = $state('');
  let department = $state('');
  let managerMemberId = $state<string>('none');

  function resetForm() {
    email = '';
    firstName = '';
    lastName = '';
    jobTitle = '';
    department = '';
    managerMemberId = 'none';
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
      jobTitle: jobTitle.trim() || undefined,
      department: department.trim() || undefined,
      managerMemberId: managerMemberId !== 'none' ? Number(managerMemberId) : undefined,
      sendEmail: true
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
        <Field.Label for="audience-create-job-title">{$t('audience.create.job_title_label')}</Field.Label>
        <Input id="audience-create-job-title" bind:value={jobTitle} />
      </Field.Field>

      <Field.Field>
        <Field.Label for="audience-create-department">{$t('audience.create.department_label')}</Field.Label>
        <Input id="audience-create-department" bind:value={department} />
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
