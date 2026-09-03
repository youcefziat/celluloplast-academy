<script lang="ts">
  import { Switch } from '@cio/ui/base/switch';

  import { currentOrg } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { orgApi } from '$features/org/api/org.svelte';
  import { handleOpenWidget } from '$features/ui/upload-widget/store';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';

  import { UploadWidget } from '$features/ui';
  import * as Field from '@cio/ui/base/field';

  interface Props {
    hasUnsavedChanges?: boolean;
  }

  let { hasUnsavedChanges = $bindable(false) }: Props = $props();

  let widgetKey = $state('');
  let savedCustomizationSnapshot = $state('');

  function widgetControl(key: string) {
    widgetKey = key;
    $handleOpenWidget.open = true;
  }

  function authBackgroundWidgetControl() {
    widgetKey = 'auth-background';
    $handleOpenWidget.open = true;
  }

  function deleteAuthBackgroundImage() {
    $currentOrg.customization.auth.backgroundImage = '';
  }

  function captureCustomizationSnapshot() {
    savedCustomizationSnapshot = JSON.stringify($currentOrg.customization);
  }

  $effect(() => {
    if (!$currentOrg?.id) return;

    if (!savedCustomizationSnapshot) {
      captureCustomizationSnapshot();
    }
  });

  $effect(() => {
    if (!$currentOrg?.id || !savedCustomizationSnapshot) return;

    hasUnsavedChanges = JSON.stringify($currentOrg.customization) !== savedCustomizationSnapshot;
  });

  export async function handleSave() {
    await orgApi.update($currentOrg.id, {
      customization: $currentOrg.customization
    });

    if (orgApi.success) {
      captureCustomizationSnapshot();
      hasUnsavedChanges = false;
    }
  }

  export function handleDiscard() {
    if (!savedCustomizationSnapshot) return;

    $currentOrg.customization = JSON.parse(savedCustomizationSnapshot);
    hasUnsavedChanges = false;
  }
</script>

<Field.Group class="w-full max-w-md! px-2">
  <Field.Set>
    <Field.Legend>{$t('components.settings.customize_lms.dashboard.title')}</Field.Legend>
    <Field.Group>
      <Field.Field>
        <Field.Label>{$t('components.settings.customize_lms.dashboard.banner_image')}</Field.Label>
        <Button variant="outline" onclick={() => widgetControl('banner-image')}>
          {$t('components.settings.customize_lms.dashboard.banner_image_btn')}
        </Button>
        {#if $currentOrg.customization.dashboard.bannerImage}
          <img alt="Banner" src={$currentOrg.customization.dashboard.bannerImage} class="mt-2 w-full rounded-md" />
        {/if}
        {#if $handleOpenWidget.open && widgetKey === 'banner-image'}
          <UploadWidget bind:imageURL={$currentOrg.customization.dashboard.bannerImage} />
        {/if}
      </Field.Field>

      <Field.Field>
        <Field.Label>{$t('components.settings.customize_lms.dashboard.banner_text')}</Field.Label>
        <Input
          placeholder={$t('components.settings.customize_lms.dashboard.banner_text_placeholder')}
          bind:value={$currentOrg.customization.dashboard.bannerText}
        />
      </Field.Field>
    </Field.Group>
  </Field.Set>

  <Field.Separator />

  <Field.Set>
    <Field.Legend>{$t('components.settings.customize_lms.auth_background.title')}</Field.Legend>
    <Field.Description>{$t('components.settings.customize_lms.auth_background.description')}</Field.Description>
    <Field.Group>
      <Field.Field>
        <div class="flex items-center gap-2">
          <Button onclick={authBackgroundWidgetControl}>
            {$t('course.navItem.settings.replace')}
          </Button>
          <Button variant="outline" onclick={deleteAuthBackgroundImage}>
            {$t('common.reset')}
          </Button>
        </div>
        {#if $handleOpenWidget.open && widgetKey === 'auth-background'}
          <UploadWidget bind:imageURL={$currentOrg.customization.auth.backgroundImage} />
        {/if}
      </Field.Field>
      <Field.Field>
        <div class="relative w-fit">
          <img
            style="min-width:280px; min-height:200px"
            alt={$t('components.settings.customize_lms.auth_background.preview_alt')}
            src={$currentOrg.customization.auth.backgroundImage
              ? $currentOrg.customization.auth.backgroundImage
              : '/images/classroomio-course-img-template.jpg'}
            class="relative mt-2 h-[200px] w-[280px] rounded-md object-cover md:mt-0"
          />
        </div>
      </Field.Field>
    </Field.Group>
  </Field.Set>

  <Field.Separator />

  <Field.Set>
    <Field.Legend>{$t('components.settings.customize_lms.course.title')}</Field.Legend>
    <Field.Group>
      <Field.Field orientation="horizontal">
        <Field.Label>{$t('components.settings.customize_lms.course.grading')}</Field.Label>
        <Switch bind:checked={$currentOrg.customization.course.grading} />
        <Field.Description class="text-gray-600">
          {$currentOrg.customization.course.grading
            ? $t('components.settings.customize_lms.enabled')
            : $t('components.settings.customize_lms.disabled')}
        </Field.Description>
      </Field.Field>
    </Field.Group>
  </Field.Set>
</Field.Group>
