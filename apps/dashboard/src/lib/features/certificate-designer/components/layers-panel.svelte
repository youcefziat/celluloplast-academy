<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import ImageIcon from '@lucide/svelte/icons/image';
  import TypeIcon from '@lucide/svelte/icons/type';

  import { t } from '$lib/utils/functions/translations';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';

  const layers = $derived(
    [...store.layout.elements].sort((leftElement, rightElement) => rightElement.zIndex - leftElement.zIndex)
  );
</script>

<div class="space-y-2">
  {#each layers as element (element.id)}
    <Button
      variant={store.selectedElementId === element.id ? 'secondary' : 'ghost'}
      class="w-full justify-start gap-2"
      onclick={() => store.selectElement(element.id)}
    >
      {#if element.type === 'image'}
        <ImageIcon class="size-4" />
      {:else}
        <TypeIcon class="size-4" />
      {/if}
      <span class="truncate">{element.name}</span>
    </Button>
  {/each}

  <div class="ui:border-border mt-3 flex items-center gap-2 border-t px-3 pt-3 text-sm">
    <span class="size-4 rounded-sm" style:background={store.layout.page.backgroundColor}></span>
    <span>{$t('certificate_designer.background')}</span>
  </div>
</div>
