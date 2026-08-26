<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus';
  import debounce from 'lodash/debounce';
  import ColorPicker from 'svelte-awesome-color-picker';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { setTheme } from '$lib/utils/functions/theme';
  import { orgApi } from '$features/org/api/org.svelte';

  import { Input } from '@cio/ui/base/input';
  import { UploadImage, UnsavedChanges } from '$features/ui';
  import * as Field from '@cio/ui/base/field';
  import * as Page from '@cio/ui/base/page';

  let avatar = $state<string | File | undefined>();
  let draftName = $state('');
  let savedName = $state('');
  let capturedOrgId = $state<string | null>(null);
  let hasUnsavedChanges = $state(false);
  let isSaving = $state(false);

  const themes = {
    rose: 'rose',
    green: 'green',
    orange: 'orange',
    purple: 'purple',
    blue: 'blue'
  };

  const updateThemeApi = debounce(async (theme: string) => {
    await orgApi.update(
      $currentOrg.id,
      {
        theme
      },
      {
        onSuccess: () => {}
      }
    );
  }, 2000);

  function handleChangeTheme(t = '') {
    return () => {
      if (t === $currentOrg.theme) return;

      $currentOrg.theme = t;

      setTheme(t);

      updateThemeApi(t);
    };
  }

  async function handleUpdate() {
    if (!$currentOrg.id) {
      return;
    }

    isSaving = true;

    try {
      await orgApi.update($currentOrg.id, {
        name: draftName.trim(),
        avatar
      });

      if (orgApi.success) {
        hasUnsavedChanges = false;
        avatar = undefined;
        captureSavedFields();
      }
    } finally {
      isSaving = false;
    }
  }

  function captureSavedFields() {
    savedName = $currentOrg.name;
    draftName = $currentOrg.name;
  }

  $effect(() => {
    if (!$currentOrg?.id) return;

    if (capturedOrgId !== $currentOrg.id) {
      capturedOrgId = $currentOrg.id;
      captureSavedFields();
    }
  });

  function handleDiscard() {
    draftName = savedName;
    avatar = undefined;
    hasUnsavedChanges = false;
    orgApi.errors = {};
  }

  function markDirty() {
    hasUnsavedChanges = true;
  }

  let isCustomTheme = $derived($currentOrg?.theme?.includes('#'));
  let hex = $derived($currentOrg.theme?.includes('#') ? $currentOrg.theme : undefined);
</script>

<UnsavedChanges bind:hasUnsavedChanges />

<Field.Group class="w-full max-w-md! px-2">
  <Field.Set>
    <Field.Group>
      <Field.Field>
        <Field.Label>{$t('settings.organization.organization_profile.organization_name')}</Field.Label>
        <Input bind:value={draftName} oninput={markDirty} class="w-full lg:w-60" />
        {#if orgApi.errors.name}
          <Field.Error>{orgApi.errors.name}</Field.Error>
        {/if}
      </Field.Field>
      <Field.Field>
        <UploadImage
          bind:avatar
          src={$currentOrg.avatarUrl}
          shape="rounded-md"
          widthHeight="w-24 h-24"
          change={markDirty}
        />
        {#if orgApi.errors.avatar}
          <Field.Error>{orgApi.errors.avatar}</Field.Error>
        {/if}
      </Field.Field>
    </Field.Group>
  </Field.Set>

  <Field.Separator />

  <Field.Set>
    <Field.Legend>{$t('settings.organization.organization_profile.theme.heading')}</Field.Legend>
    <Field.Description>{$t('settings.organization.organization_profile.theme.sub_heading')}</Field.Description>
    <Field.Field>
      <div class="flex items-center gap-5">
        <button
          class="cursor-pointer rounded-full border-2 {$currentOrg.theme === themes.blue &&
            'border-[#1d4ee2]'} flex h-fit items-center justify-center"
          onclick={handleChangeTheme(themes.blue)}
          aria-label="Default blue theme"
        >
          <div class="m-1 h-6 w-6 rounded-full bg-[#1d4ee2] md:h-6 md:w-6"></div>
        </button>

        <button
          class="cursor-pointer rounded-full border-2 {$currentOrg.theme === themes.rose &&
            'border-[#be1241]'} flex h-fit items-center justify-center"
          onclick={handleChangeTheme(themes.rose)}
          aria-label="Rose theme"
        >
          <div class="m-1 h-6 w-6 rounded-full bg-[#be1241] md:h-6 md:w-6"></div>
        </button>

        <button
          class="cursor-pointer rounded-full border-2 {$currentOrg.theme === themes.green &&
            'border-[#0c891b]'} flex h-fit items-center justify-center"
          onclick={handleChangeTheme(themes.green)}
          aria-label="Green theme"
        >
          <div class="m-1 h-6 w-6 rounded-full bg-[#0c891b] md:h-6 md:w-6"></div>
        </button>

        <button
          class="cursor-pointer rounded-full border-2 {$currentOrg.theme === themes.orange &&
            'border-[#cc4902]'} flex h-fit items-center justify-center"
          onclick={handleChangeTheme(themes.orange)}
          aria-label="Orange theme"
        >
          <div class="m-1 h-6 w-6 rounded-full bg-[#cc4902] md:h-6 md:w-6"></div>
        </button>

        <button
          class="cursor-pointer rounded-full border-2 {$currentOrg.theme === themes.purple &&
            'border-purple-600'} flex h-fit items-center justify-center"
          onclick={handleChangeTheme(themes.purple)}
          aria-label="Purple theme"
        >
          <div class="m-1 h-6 w-6 rounded-full bg-purple-600 md:h-6 md:w-6"></div>
        </button>

        <div
          style={isCustomTheme ? `border-color: ${$currentOrg.theme}; --picker-z-index: 50;` : '--picker-z-index: 50;'}
          class="group relative h-auto w-fit cursor-pointer rounded-full border-2 {!isCustomTheme
            ? 'custom-theme-picker--empty'
            : ''}"
        >
          <div
            class="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200"
          >
            <PlusIcon class="z-10 size-6 {hex ? 'stroke-white' : 'stroke-gray-500'}" />
          </div>
          <ColorPicker
            position="responsive"
            label=""
            {hex}
            on:input={(e) => {
              handleChangeTheme(e.detail.hex)();
            }}
          />
        </div>
      </div>
    </Field.Field>
  </Field.Set>
</Field.Group>

<Page.SettingsActions
  hasChanges={hasUnsavedChanges}
  loading={isSaving}
  statusLabel={$t('common.unsaved_changes.label')}
  discardLabel={$t('common.discard')}
  saveLabel={$t('common.save_changes')}
  onSave={handleUpdate}
  onDiscard={handleDiscard}
/>

<style>
  :global(.dark) {
    --cp-text-color: #fff;
    --cp-border-color: white;
    --cp-text-color: white;
    --cp-input-color: #555;
    --cp-button-hover-color: #777;
  }

  :global(.dark .alpha) {
    background: #333 !important;
  }

  :global(.color::before) {
    display: none;
  }

  :global(.custom-theme-picker--empty .color) {
    background-color: #e5e7eb !important;
  }

  :global(.dark .custom-theme-picker--empty .color) {
    background-color: #374151 !important;
  }
</style>
