<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Separator } from '@cio/ui/base/separator';
  import { ContentIcon, HoverableItem } from '@cio/ui/custom/moving-icons';
  import { t } from '$lib/utils/functions/translations';

  interface Props {
    showTranscript?: boolean;
    showTopSeparator?: boolean;
    showBottomSeparator?: boolean;
    /** Match the note column (`max-w-2xl`) instead of the full video column. */
    alignWithNote?: boolean;
    onTranscript?: () => void;
  }

  let {
    showTranscript = false,
    showTopSeparator = true,
    showBottomSeparator = true,
    alignWithNote = false,
    onTranscript = () => {}
  }: Props = $props();
</script>

{#if showTranscript}
  <div class={alignWithNote ? 'mx-auto w-full max-w-2xl' : 'w-full'}>
    {#if showTopSeparator}
      <Separator class="my-2" />
    {/if}

    <div class="flex flex-wrap items-center gap-x-2 gap-y-2 py-1 sm:gap-x-3">
      <HoverableItem>
        {#snippet children(isHovered)}
          <Button variant="ghost" size="sm" class="ui:h-auto ui:px-1 ui:py-1 sm:ui:px-2" onclick={onTranscript}>
            <ContentIcon {isHovered} size={16} />
            {$t('course.navItem.lessons.materials.show_transcript')}
          </Button>
        {/snippet}
      </HoverableItem>
    </div>

    {#if showBottomSeparator}
      <Separator class="my-2" />
    {/if}
  </div>
{/if}
