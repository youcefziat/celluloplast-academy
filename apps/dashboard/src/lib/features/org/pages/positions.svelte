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
  import type { OrganizationPosition } from '$features/org/utils/types';
  import { t } from '$lib/utils/functions/translations';

  let isLoading = $state(true);
  let dialogOpen = $state(false);
  let deleteOpen = $state(false);
  let editing = $state<OrganizationPosition | null>(null);
  let deleting = $state<OrganizationPosition | null>(null);
  let name = $state('');

  onMount(async () => {
    await orgApi.getPositions();
    isLoading = false;
  });

  function openCreate() {
    editing = null;
    name = '';
    orgApi.errors = {};
    dialogOpen = true;
  }

  function openEdit(position: OrganizationPosition) {
    editing = position;
    name = position.name;
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

  function openDelete(position: OrganizationPosition) {
    deleting = position;
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
      await orgApi.updatePosition(editing.id, { name: trimmed });
    } else {
      await orgApi.createPosition({ name: trimmed });
    }

    if (orgApi.success) {
      handleDialogOpenChange(false);
    }
  }

  async function handleDelete() {
    if (!deleting) {
      return;
    }

    await orgApi.deletePosition(deleting.id);

    if (orgApi.success) {
      handleDeleteOpenChange(false);
    }
  }
</script>

<Page.Header>
  <Page.HeaderContent>
    <Page.Title>{$t('celluloplast_hr_refs.positions.title')}</Page.Title>
    <Page.Subtitle>{$t('celluloplast_hr_refs.positions.subtitle')}</Page.Subtitle>
  </Page.HeaderContent>
  <Page.Action>
    <Button onclick={openCreate}>{$t('celluloplast_hr_refs.positions.add')}</Button>
  </Page.Action>
</Page.Header>

<Page.Body>
  {#snippet child()}
    {#if isLoading}
      <div class="flex justify-center py-12">
        <Spinner />
      </div>
    {:else if orgApi.positions.length === 0}
      <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('celluloplast_hr_refs.positions.empty')}</p>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{$t('celluloplast_hr_refs.positions.name_label')}</Table.Head>
            <Table.Head>{$t('celluloplast_hr_refs.positions.employees')}</Table.Head>
            <Table.Head class="text-right">{$t('celluloplast_hr_refs.positions.actions')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each orgApi.positions as position (position.id)}
            <Table.Row>
              <Table.Cell>{position.name}</Table.Cell>
              <Table.Cell>{position.employeeCount}</Table.Cell>
              <Table.Cell class="space-x-2 text-right">
                <Button variant="outline" size="sm" onclick={() => openEdit(position)}>
                  {$t('celluloplast_hr_refs.positions.edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={position.employeeCount > 0}
                  onclick={() => openDelete(position)}
                >
                  {$t('celluloplast_hr_refs.positions.delete')}
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
        {editing ? $t('celluloplast_hr_refs.positions.edit') : $t('celluloplast_hr_refs.positions.add')}
      </Dialog.Title>
    </Dialog.Header>
    <Field.Group>
      <Field.Field>
        <Field.Label for="position-name">{$t('celluloplast_hr_refs.positions.name_label')}</Field.Label>
        <Input
          id="position-name"
          bind:value={name}
          placeholder={$t('celluloplast_hr_refs.positions.name_placeholder')}
        />
        {#if orgApi.errors.name}
          <Field.Error>{orgApi.errors.name}</Field.Error>
        {/if}
      </Field.Field>
    </Field.Group>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleDialogOpenChange(false)}>
        {$t('celluloplast_hr_refs.positions.cancel')}
      </Button>
      <Button loading={orgApi.isLoading} disabled={!name.trim()} onclick={handleSave}>
        {$t('celluloplast_hr_refs.positions.save')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('celluloplast_hr_refs.positions.delete')}</Dialog.Title>
      <Dialog.Description>{$t('celluloplast_hr_refs.positions.delete_confirm')}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => handleDeleteOpenChange(false)}>
        {$t('celluloplast_hr_refs.positions.cancel')}
      </Button>
      <Button variant="destructive" loading={orgApi.isLoading} onclick={handleDelete}>
        {$t('celluloplast_hr_refs.positions.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
