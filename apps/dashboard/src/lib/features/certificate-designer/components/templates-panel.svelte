<script lang="ts">
  import { CERTIFICATE_TEMPLATES, type CertificateTemplateId } from '@cio/certificates';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import ImageIcon from '@lucide/svelte/icons/image';

  import { snackbar } from '$features/ui/snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { validateImageExtension, validateImageType } from '$lib/utils/functions/fileValidation';
  import { uploadImage } from '$lib/utils/services/upload';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';

  interface Props {
    onRequestTemplate: (templateId: CertificateTemplateId) => void;
  }

  let { onRequestTemplate }: Props = $props();
  let backgroundInput = $state<HTMLInputElement | null>(null);
  let isDragging = $state(false);

  const PRESET_COLORS: Record<CertificateTemplateId, string> = {
    classique: '#faf6ec',
    brutalist: '#f0ede4',
    noir: '#0e0e0e',
    poster: '#fef2dc',
    minimal: '#ffffff'
  };

  async function importBackground(file: File) {
    if (!validateImageType(file) || !validateImageExtension(file.name) || !/\.(jpe?g|png)$/i.test(file.name)) {
      snackbar.error(t.get('certificate_designer.background_invalid'));
      return;
    }

    store.isUploading = true;
    try {
      const backgroundImageUrl = await uploadImage(file);
      store.setBackgroundImage(backgroundImageUrl);
    } catch (error) {
      console.error('Certificate background upload failed:', error);
      snackbar.error(t.get('certificate_designer.upload_failed'));
    } finally {
      store.isUploading = false;
    }
  }

  function handleBackgroundInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importBackground(file);
    input.value = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void importBackground(file);
  }
</script>

<div class="space-y-5">
  <div class="grid grid-cols-2 gap-3">
    {#each CERTIFICATE_TEMPLATES as template (template.id)}
      <button
        type="button"
        class="ui:border-border hover:ui:border-primary group overflow-hidden rounded-lg border text-left transition-colors"
        class:ui:border-primary={store.layout.sourcePresetId === template.id}
        onclick={() => onRequestTemplate(template.id)}
      >
        <span
          class="flex aspect-[1.4/1] items-center justify-center text-sm font-semibold"
          style:background={PRESET_COLORS[template.id]}
          style:color={template.id === 'noir' ? '#d4af37' : '#1f2937'}
        >
          {template.label}
        </span>
        <span class="block px-2 py-2 text-xs font-medium">{template.label}</span>
      </button>
    {/each}
  </div>

  <div class="ui:border-border border-t pt-5">
    <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold">
      <ImageIcon class="size-4" />
      {$t('certificate_designer.import_background')}
    </h3>
    <Input
      bind:ref={backgroundInput}
      class="sr-only"
      type="file"
      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
      onchange={handleBackgroundInput}
    />
    <div
      class="rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors {isDragging
        ? 'border-blue-500 bg-blue-50 text-blue-700'
        : 'ui:border-border ui:text-muted-foreground'}"
      role="button"
      tabindex="0"
      ondragover={(event) => {
        event.preventDefault();
        isDragging = true;
      }}
      ondragleave={() => (isDragging = false)}
      ondrop={handleDrop}
      onclick={() => backgroundInput?.click()}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') backgroundInput?.click();
      }}
    >
      {$t('certificate_designer.drop_background')}
    </div>
    {#if store.layout.page.backgroundImageUrl}
      <Button variant="outline" size="sm" class="mt-3 w-full" onclick={() => store.clearBackgroundImage()}>
        {$t('certificate_designer.remove_background')}
      </Button>
    {/if}
  </div>
</div>
