<script lang="ts">
  import {
    CERTIFICATE_FONT_FAMILIES,
    CERTIFICATE_VARIABLES,
    type CertificateFontFamily,
    type CertificateVariable
  } from '@cio/certificates';
  import { Button } from '@cio/ui/base/button';
  import { Checkbox } from '@cio/ui/base/checkbox';
  import * as Field from '@cio/ui/base/field';
  import { Input } from '@cio/ui/base/input';
  import * as Select from '@cio/ui/base/select';
  import { Textarea } from '@cio/ui/base/textarea';

  import { snackbar } from '$features/ui/snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { validateImageExtension, validateImageType } from '$lib/utils/functions/fileValidation';
  import { uploadImage } from '$lib/utils/services/upload';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';
  import type { CertificateLayoutElementPatch } from '../utils/types';

  const FONT_LABELS: Record<CertificateFontFamily, string> = {
    inter: 'Inter',
    'cormorant-garamond': 'Cormorant Garamond',
    cinzel: 'Cinzel',
    'playfair-display': 'Playfair Display',
    'space-grotesk': 'Space Grotesk',
    'dm-mono': 'DM Mono'
  };

  let replacementInput = $state<HTMLInputElement | null>(null);

  function updateSelected(patch: CertificateLayoutElementPatch) {
    if (!store.selectedElementId) return;
    store.updateElement(store.selectedElementId, patch);
  }

  function updateNumber(
    property: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'fontSize',
    event: Event,
    divisor = 1
  ) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;

    const patch: CertificateLayoutElementPatch = {};
    patch[property] = value / divisor;
    updateSelected(patch);
  }

  async function replaceImage(file: File) {
    if (!validateImageType(file) || !validateImageExtension(file.name) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      snackbar.error(t.get('certificate_designer.upload_invalid'));
      return;
    }

    store.isUploading = true;
    try {
      const imageUrl = await uploadImage(file);
      updateSelected({ src: imageUrl });
    } catch (error) {
      console.error('Certificate designer image replacement failed:', error);
      snackbar.error(t.get('certificate_designer.upload_failed'));
    } finally {
      store.isUploading = false;
    }
  }

  function handleReplacement(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void replaceImage(file);
    input.value = '';
  }
</script>

{#if store.selectedElement}
  {@const element = store.selectedElement}
  <Field.Group>
    <Field.Set>
      <Field.Legend>{element.name}</Field.Legend>
      <div class="grid grid-cols-2 gap-3">
        <Field.Field>
          <Field.Label for="element-x">X</Field.Label>
          <Input id="element-x" type="number" value={element.x} oninput={(event) => updateNumber('x', event)} />
        </Field.Field>
        <Field.Field>
          <Field.Label for="element-y">Y</Field.Label>
          <Input id="element-y" type="number" value={element.y} oninput={(event) => updateNumber('y', event)} />
        </Field.Field>
        <Field.Field>
          <Field.Label for="element-width">{$t('certificate_designer.width')}</Field.Label>
          <Input
            id="element-width"
            type="number"
            min="24"
            value={element.width}
            oninput={(event) => updateNumber('width', event)}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="element-height">{$t('certificate_designer.height')}</Field.Label>
          <Input
            id="element-height"
            type="number"
            min="24"
            value={element.height}
            oninput={(event) => updateNumber('height', event)}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="element-rotation">{$t('certificate_designer.rotation')}</Field.Label>
          <Input
            id="element-rotation"
            type="number"
            min="-360"
            max="360"
            value={element.rotation}
            oninput={(event) => updateNumber('rotation', event)}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="element-opacity">{$t('certificate_designer.opacity')}</Field.Label>
          <Input
            id="element-opacity"
            type="number"
            min="0"
            max="100"
            value={Math.round(element.opacity * 100)}
            oninput={(event) => updateNumber('opacity', event, 100)}
          />
        </Field.Field>
      </div>
    </Field.Set>

    {#if element.type === 'text' || element.type === 'variable'}
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('certificate_designer.text_properties')}</Field.Legend>
        {#if element.type === 'text'}
          <Field.Field>
            <Field.Label for="element-text">{$t('certificate_designer.content')}</Field.Label>
            <Textarea
              id="element-text"
              rows="4"
              value={element.text}
              oninput={(event) => updateSelected({ text: (event.currentTarget as HTMLTextAreaElement).value })}
            />
          </Field.Field>
        {:else}
          <Field.Field>
            <Field.Label>{$t('certificate_designer.dynamic_field')}</Field.Label>
            <Select.Root
              type="single"
              value={element.variable}
              onValueChange={(value) => updateSelected({ variable: value as CertificateVariable })}
            >
              <Select.Trigger class="w-full">{`{{${element.variable}}}`}</Select.Trigger>
              <Select.Content>
                {#each CERTIFICATE_VARIABLES as variable (variable)}
                  <Select.Item value={variable}>{`{{${variable}}}`}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        {/if}

        <Field.Field>
          <Field.Label>{$t('certificate_designer.font')}</Field.Label>
          <Select.Root
            type="single"
            value={element.fontFamily}
            onValueChange={(value) => updateSelected({ fontFamily: value as CertificateFontFamily })}
          >
            <Select.Trigger class="w-full">{FONT_LABELS[element.fontFamily]}</Select.Trigger>
            <Select.Content>
              {#each CERTIFICATE_FONT_FAMILIES as fontFamily (fontFamily)}
                <Select.Item value={fontFamily}>{FONT_LABELS[fontFamily]}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Field.Field>

        <div class="grid grid-cols-2 gap-3">
          <Field.Field>
            <Field.Label for="font-size">{$t('certificate_designer.font_size')}</Field.Label>
            <Input
              id="font-size"
              type="number"
              min="6"
              max="240"
              value={element.fontSize}
              oninput={(event) => updateNumber('fontSize', event)}
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="text-color">{$t('certificate_designer.color')}</Field.Label>
            <Input
              id="text-color"
              type="color"
              value={element.color}
              oninput={(event) => updateSelected({ color: (event.currentTarget as HTMLInputElement).value })}
            />
          </Field.Field>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <Button
            variant={element.fontWeight >= 600 ? 'secondary' : 'outline'}
            size="sm"
            onclick={() => updateSelected({ fontWeight: element.fontWeight >= 600 ? 400 : 700 })}
          >
            {$t('certificate_designer.bold')}
          </Button>
          <Button
            variant={element.fontStyle === 'italic' ? 'secondary' : 'outline'}
            size="sm"
            onclick={() => updateSelected({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}
          >
            {$t('certificate_designer.italic')}
          </Button>
        </div>

        <Field.Field>
          <Field.Label>{$t('certificate_designer.alignment')}</Field.Label>
          <div class="grid grid-cols-3 gap-2">
            {#each ['left', 'center', 'right'] as alignment (alignment)}
              <Button
                variant={element.textAlign === alignment ? 'secondary' : 'outline'}
                size="sm"
                onclick={() => updateSelected({ textAlign: alignment as 'left' | 'center' | 'right' })}
              >
                {$t(`certificate_designer.align_${alignment}`)}
              </Button>
            {/each}
          </div>
        </Field.Field>
      </Field.Set>
    {:else}
      <Field.Separator />
      <Field.Set>
        <Field.Legend>{$t('certificate_designer.image_properties')}</Field.Legend>
        <Input
          bind:ref={replacementInput}
          class="sr-only"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onchange={handleReplacement}
        />
        <Button variant="outline" onclick={() => replacementInput?.click()}>
          {$t('certificate_designer.replace_image')}
        </Button>
        <Field.Field orientation="horizontal">
          <Checkbox
            id="keep-ratio"
            checked={element.keepRatio}
            onCheckedChange={(checked) => updateSelected({ keepRatio: checked === true })}
          />
          <Field.Label for="keep-ratio">{$t('certificate_designer.keep_ratio')}</Field.Label>
        </Field.Field>
      </Field.Set>
    {/if}

    <Field.Separator />
    <Button variant="destructive" class="w-full" onclick={() => store.deleteSelected()}>
      {$t('certificate_designer.delete_element')}
    </Button>
  </Field.Group>
{:else}
  <p class="ui:text-muted-foreground text-sm">{$t('certificate_designer.select_element')}</p>
{/if}
