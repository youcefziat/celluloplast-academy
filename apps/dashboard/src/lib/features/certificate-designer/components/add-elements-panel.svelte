<script lang="ts">
  import type { CertificateImageElement, CertificateVariable } from '@cio/certificates';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import ImageIcon from '@lucide/svelte/icons/image';
  import PenToolIcon from '@lucide/svelte/icons/pen-tool';
  import TypeIcon from '@lucide/svelte/icons/type';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import VariableIcon from '@lucide/svelte/icons/braces';

  import { snackbar } from '$features/ui/snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { uploadImage } from '$lib/utils/services/upload';
  import { validateImageExtension, validateImageType } from '$lib/utils/functions/fileValidation';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';
  import { CERTIFICATE_VARIABLE_GROUPS } from '../utils/variables';

  let imageInput = $state<HTMLInputElement | null>(null);
  let pendingRole = $state<CertificateImageElement['role']>('image');
  let isDragging = $state(false);

  function openImagePicker(role: CertificateImageElement['role']) {
    pendingRole = role;
    imageInput?.click();
  }

  function isSupportedImage(file: File): boolean {
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
    const allowedExtension = /\.(jpe?g|png|webp)$/i.test(file.name);

    return allowedMime && allowedExtension && validateImageType(file) && validateImageExtension(file.name);
  }

  async function addUploadedImage(file: File, role: CertificateImageElement['role']) {
    if (!isSupportedImage(file)) {
      snackbar.error(t.get('certificate_designer.upload_invalid'));
      return;
    }

    store.isUploading = true;
    try {
      const imageUrl = await uploadImage(file);
      store.addImage(role, imageUrl);
    } catch (error) {
      console.error('Certificate designer image upload failed:', error);
      snackbar.error(t.get('certificate_designer.upload_failed'));
    } finally {
      store.isUploading = false;
    }
  }

  function handleInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void addUploadedImage(file, pendingRole);
    input.value = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void addUploadedImage(file, 'image');
  }

  function addVariable(variable: CertificateVariable) {
    store.addVariable(variable);
  }
</script>

<div class="space-y-5">
  <div class="grid grid-cols-2 gap-2">
    <Button variant="outline" class="h-auto justify-start gap-2 py-3" onclick={() => store.addText()}>
      <TypeIcon class="size-4" />
      {$t('certificate_designer.add_text')}
    </Button>
    <Button variant="outline" class="h-auto justify-start gap-2 py-3" onclick={() => openImagePicker('logo')}>
      <UploadIcon class="size-4" />
      {$t('certificate_designer.add_logo')}
    </Button>
    <Button variant="outline" class="h-auto justify-start gap-2 py-3" onclick={() => openImagePicker('signature')}>
      <PenToolIcon class="size-4" />
      {$t('certificate_designer.add_signature')}
    </Button>
    <Button variant="outline" class="h-auto justify-start gap-2 py-3" onclick={() => openImagePicker('image')}>
      <ImageIcon class="size-4" />
      {$t('certificate_designer.add_image')}
    </Button>
  </div>

  <Input
    bind:ref={imageInput}
    class="sr-only"
    type="file"
    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
    onchange={handleInput}
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
    onclick={() => openImagePicker('image')}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') openImagePicker('image');
    }}
  >
    {$t('certificate_designer.drop_image')}
  </div>

  <div class="space-y-4">
    <div class="flex items-center gap-2 text-sm font-semibold">
      <VariableIcon class="size-4" />
      {$t('certificate_designer.dynamic_fields')}
    </div>

    {#each CERTIFICATE_VARIABLE_GROUPS as group (group.labelKey)}
      <div class="space-y-2">
        <h3 class="ui:text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {$t(group.labelKey)}
        </h3>
        <div class="space-y-1">
          {#each group.variables as item (item.variable)}
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-between font-normal"
              onclick={() => addVariable(item.variable)}
            >
              <span>{$t(item.labelKey)}</span>
              <code class="ui:text-muted-foreground text-[10px]">{`{{${item.variable}}}`}</code>
            </Button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
