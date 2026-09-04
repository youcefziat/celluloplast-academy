<script lang="ts">
  import { onMount } from 'svelte';
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import { orgApi } from '$features/org/api/org.svelte';
  import type { OrganizationAudienceMember } from '$features/org/utils/types';
  import { t } from '$lib/utils/functions/translations';
  import { ROLE } from '@cio/utils/constants';
  import { ROLE_LABEL } from '$lib/utils/constants/roles';

  interface Props {
    open: boolean;
    /** The member being edited; null closes the dialog. */
    member: OrganizationAudienceMember | null;
    managers: OrganizationAudienceMember[];
    onUpdated?: () => void;
  }

  let { open = $bindable(false), member, managers, onUpdated }: Props = $props();

  const NONE = 'none';

  let firstName = $state('');
  let lastName = $state('');
  let positionId = $state<string>(NONE);
  let departmentId = $state<string>(NONE);
  let managerMemberId = $state<string>(NONE);
  let roleId = $state<string>(String(ROLE.STUDENT));
  let refsLoaded = $state(false);

  onMount(async () => {
    await Promise.all([orgApi.getPositions(), orgApi.getDepartments()]);
    refsLoaded = true;
  });

  /** Refill whenever a different member is opened, so the form always shows current values. */
  $effect(() => {
    if (!member) return;

    firstName = member.firstName ?? '';
    lastName = member.lastName ?? '';
    positionId = member.position?.id ? String(member.position.id) : NONE;
    departmentId = member.department?.id ? String(member.department.id) : NONE;
    managerMemberId = member.manager?.id ? String(member.manager.id) : NONE;
    roleId = String(member.roleId);
    orgApi.errors = {};
  });

  const roleOptions = [
    { value: String(ROLE.STUDENT), label: t.get(ROLE_LABEL[ROLE.STUDENT]) },
    { value: String(ROLE.TUTOR), label: t.get(ROLE_LABEL[ROLE.TUTOR]) },
    { value: String(ROLE.ADMIN), label: t.get(ROLE_LABEL[ROLE.ADMIN]) }
  ];

  const selectedRoleLabel = $derived(
    roleOptions.find((option) => option.value === roleId)?.label ?? roleOptions[0].label
  );

  /** A member cannot be their own manager. */
  const managerOptions = $derived(
    managers
      .filter((candidate) => candidate.id !== member?.id)
      .map((candidate) => ({
        value: String(candidate.id),
        label: candidate.name ? `${candidate.name} (${candidate.email})` : candidate.email
      }))
  );

  const selectedManagerLabel = $derived(
    managerMemberId === NONE
      ? t.get('audience.create.manager_placeholder')
      : (managerOptions.find((option) => option.value === managerMemberId)?.label ??
          t.get('audience.create.manager_placeholder'))
  );

  const selectedPositionLabel = $derived(
    positionId === NONE
      ? t.get('audience.create.job_title_placeholder')
      : (orgApi.positions.find((position) => String(position.id) === positionId)?.name ??
          t.get('audience.create.job_title_placeholder'))
  );

  const selectedDepartmentLabel = $derived(
    departmentId === NONE
      ? t.get('audience.create.department_placeholder')
      : (orgApi.departments.find((department) => String(department.id) === departmentId)?.name ??
          t.get('audience.create.department_placeholder'))
  );

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (!isOpen) {
      orgApi.errors = {};
    }
  }

  async function handleSubmit() {
    if (!member) return;

    // Null clears a reference server-side; undefined would leave it untouched.
    const result = await orgApi.updateAudienceMember(member.id, {
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      positionId: positionId !== NONE ? Number(positionId) : null,
      departmentId: departmentId !== NONE ? Number(departmentId) : null,
      managerMemberId: managerMemberId !== NONE ? Number(managerMemberId) : null,
      roleId: Number(roleId)
    });

    if (!result) {
      return;
    }

    open = false;
    onUpdated?.();
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{$t('audience.edit.title')}</Dialog.Title>
      {#if member}
        <Dialog.Description>{member.email}</Dialog.Description>
      {/if}
    </Dialog.Header>

    <Field.Group class="py-2">
      <Field.Field>
        <Field.Label>{$t('audience.create.role_label')} *</Field.Label>
        <Select.Root type="single" bind:value={roleId}>
          <Select.Trigger class="w-full">
            {selectedRoleLabel}
          </Select.Trigger>
          <Select.Content>
            {#each roleOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        {#if orgApi.errors.roleId}
          <Field.Error>{orgApi.errors.roleId}</Field.Error>
        {/if}
      </Field.Field>

      <div class="grid gap-4 sm:grid-cols-2">
        <Field.Field>
          <Field.Label for="audience-edit-first-name">{$t('audience.create.first_name_label')}</Field.Label>
          <Input id="audience-edit-first-name" bind:value={firstName} />
        </Field.Field>

        <Field.Field>
          <Field.Label for="audience-edit-last-name">{$t('audience.create.last_name_label')}</Field.Label>
          <Input id="audience-edit-last-name" bind:value={lastName} />
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
              <Select.Item value={NONE}>{$t('audience.create.job_title_placeholder')}</Select.Item>
              {#each orgApi.positions as position (position.id)}
                <Select.Item value={String(position.id)}>{position.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
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
              <Select.Item value={NONE}>{$t('audience.create.department_placeholder')}</Select.Item>
              {#each orgApi.departments as department (department.id)}
                <Select.Item value={String(department.id)}>{department.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
      </Field.Field>

      <Field.Field>
        <Field.Label>{$t('audience.create.manager_label')}</Field.Label>
        <Select.Root type="single" bind:value={managerMemberId}>
          <Select.Trigger class="w-full">
            {selectedManagerLabel}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={NONE}>{$t('audience.create.manager_placeholder')}</Select.Item>
            {#each managerOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </Field.Field>
    </Field.Group>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('audience.create.cancel')}
      </Button>
      <Button onclick={handleSubmit} disabled={orgApi.isLoading}>
        {$t('audience.edit.submit')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
