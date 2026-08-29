<script lang="ts">
  import { Button } from '@cio/ui/base/button';

  import { t } from '$lib/utils/functions/translations';
  import { certificateDesignerStore as store } from '../stores/certificate-designer.svelte';
</script>

<div class="ui:border-border ui:bg-background flex min-h-12 flex-wrap items-center gap-2 border-b px-3 py-2">
  <Button variant="outline" size="sm" disabled={!store.canUndo} onclick={() => store.undo()}>
    {$t('certificate_designer.undo')}
  </Button>
  <Button variant="outline" size="sm" disabled={!store.canRedo} onclick={() => store.redo()}>
    {$t('certificate_designer.redo')}
  </Button>

  {#if store.selectedElement}
    <span class="ui:bg-border mx-1 h-6 w-px"></span>
    <Button variant="outline" size="sm" onclick={() => store.duplicateSelected()}>
      {$t('certificate_designer.duplicate')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.moveSelectedLayer('front')}>
      {$t('certificate_designer.bring_front')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.moveSelectedLayer('back')}>
      {$t('certificate_designer.send_back')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.alignSelected('horizontal')}>
      {$t('certificate_designer.center_horizontal')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.alignSelected('vertical')}>
      {$t('certificate_designer.center_vertical')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.alignSelected('left')}>
      {$t('certificate_designer.align_left')}
    </Button>
    <Button variant="outline" size="sm" onclick={() => store.alignSelected('right')}>
      {$t('certificate_designer.align_right')}
    </Button>
  {/if}
</div>
