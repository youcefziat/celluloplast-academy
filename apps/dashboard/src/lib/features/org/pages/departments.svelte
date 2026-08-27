<script lang="ts">
  import { onMount } from 'svelte';
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';
  import * as Table from '@cio/ui/base/table';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import { Spinner } from '@cio/ui/base/spinner';
  import { orgApi } from '$features/org/api/org.svelte';
  import type { OrganizationDepartment } from '$features/org/utils/types';
  import { t } from '$lib/utils/functions/translations';

  let isLoading = $state(true);
  let dialogOpen = $state(false);
  let deleteOpen = $state(false);
  let editing = $state<OrganizationDepartment | null>(null);
  let deleting = $state<OrganizationDepartment | null>(null);
  let name = $state('');

  onMount(async () => {
    await orgApi.getDepartments();
    isLoading = false;
  });

  function openCreate() {
    editing = null;
    name = '';
    orgApi.errors = {};
    dialogOpen = true;
  }

  function openEdit(department: OrganizationDepartment) {
    editing = department;
    name = department.name;
    orgApi.errors = {};
    dialogOpen = true;
  }

  function handleDialogOpenChange(isOpen: boolean) {
    dialogOpen = isOpen;

    if (!isOpen) {
      editing = null;
      name = '';
      orgApi.errors = {};
    }
  }

  function openDelete(department: OrganizationDepartment) {
    deleting = department;
    deleteOpen = true;
  }

  function handleDeleteOpenChange(isOpen: boolean) {
    deleteOpen = isOpen;

    if (!isOpen) {
      deleting = null;
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    if (editing) {
      await orgApi.updateDepartment(editing.id, { name: trimmed });
    } else {
      await orgApi.createDepartment({ name: trimmed });
    }

    if (orgApi.success) {
      handleDialogOpenChange(false);
    }
  }

  async function handleDelete() {
    if (!deleting) {
      return;
    }

    await orgApi.deleteDepartment(deleting.id);

    if (orgApi.success) {
      handleDeleteOpenChange(false);
    }
  }
</script>

<Page.Header>
  <Page.HeaderContent>
    <Page.Title>{$t('celluloplast_hr_refs.departments.title')}</Page.Title>
    <Page.Subtitle>{$t('celluloplast_hr_refs.departments.subtitle')}</Page.Subtitle>
  </Page.HeaderContent>
  <Page.Action>
    <Button onclick={openCreate}>{$t('celluloplast_hr_refs.departments.add')}</Button>
  </Page.Action>
</Page.Header>

<Page.Body>
  {#snippet child()}
    {#if isLoading}
      <div class="flex justify-center py-12">
        <Spinner />
      </div>
    {:else if orgApi.departments.length === 0}
      <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('celluloplast_hr_refs.departments.empty')}</p>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{$t('celluloplast_hr_refs.departments.name_label')}</Table.Head>
            <Table.Head>{$t('celluloplast_hr_refs.departments.employees')}</Table.Head>
            <Table.Head class="text-right">{$t('celluloplast_hr_refs.departments.actions')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each orgApi.departments as department (department.id)}
            <Table.Row>
              <Table.Cell>{department.name}</Table.Cell>
              <Table.Cell>{department.employeeCount}</Table.Cell>
              <Table.Cell class="space-x-2 text-right">
                <Button variant="outline" size="sm" onclick={() => openEdit(department)}>
                  {$t('celluloplast_hr_refs.departments.edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={department.employeeCount > 0}
                  onclick={() => openDelete(department)}
                >
                  {$t('celluloplast_hr_refs.departments.delete')}
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  {/snippet}
</Page.Body>

<Dialog.Root open={dialogOpen} onOpenChange={handleDialogOpenChange}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>
        {editing ? $t('celluloplast_hr_refs.departments.edit') : $t('celluloplast_hr_refs.departments.add')}
      </Dialog.Title>
    </Dialog.Header>
    <Field.Group>
      <Field.Field>
        <Field.Label for="department-name">{$t('celluloplast_hr_refs.departments.name_label')}</Field.Label>
        <Input
          id="department-name"
          bind:value={name}
          placeholder={$t('celluloplast_hr_refs.departments.name_placeholder')}
        />
        {#if orgApi.errors.name}
          <Field.Error>{orgApi.errors.name}</Field.Error>
        {/if}
      </Field.Field>
    </Field.Group>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleDialogOpenChange(false)}>
        {$t('celluloplast_hr_refs.departments.cancel')}
      </Button>
      <Button loading={orgApi.isLoading} disabled={!name.trim()} onclick={handleSave}>
        {$t('celluloplast_hr_refs.departments.save')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('celluloplast_hr_refs.departments.delete')}</Dialog.Title>
      <Dialog.Description>{$t('celluloplast_hr_refs.departments.delete_confirm')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleDeleteOpenChange(false)}>
        {$t('celluloplast_hr_refs.departments.cancel')}
      </Button>
      <Button variant="destructive" loading={orgApi.isLoading} onclick={handleDelete}>
        {$t('celluloplast_hr_refs.departments.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
