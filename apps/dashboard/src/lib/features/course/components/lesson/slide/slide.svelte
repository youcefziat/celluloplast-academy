<script lang="ts">
  import { lessonApi } from '$features/course/api';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Button } from '@cio/ui/base/button';
  import { DeleteModal } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';
  import MODES from '$lib/utils/constants/mode';
  import PresentationIcon from '@lucide/svelte/icons/presentation';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { lessonDocUpload } from '$features/course/components/lesson/store';
  import type { LessonDocument } from '$features/course/utils/types';
  import SlidePdfViewer from './slide-pdf-viewer.svelte';

  interface Props {
    mode?: (typeof MODES)[keyof typeof MODES];
  }

  let { mode = MODES.view }: Props = $props();

  let openDeleteDeckModal = $state(false);

  const allDocuments = $derived(lessonApi.lesson?.documents ?? []);
  /** The Slides tab owns at most one uploaded deck, stored alongside the lesson documents. */
  const slideDeck = $derived(allDocuments.find((doc): doc is LessonDocument => doc.slot === 'slide') ?? null);
  const slideDeckIndex = $derived(allDocuments.findIndex((doc) => doc.slot === 'slide'));

  let url = $derived(getUrl(lessonApi.lesson?.slideUrl || ''));

  function canvaHandler(_url): string {
    if (_url.includes('?embed')) return _url;
    return `${_url}?embed`;
  }

  function getUrl(_url: string | null): string | undefined {
    if (!_url) return;
    if (_url.includes('www.canva.com')) {
      return canvaHandler(_url);
    }
    return _url;
  }

  function openSlideUploadModal() {
    lessonDocUpload.update((state) => ({ ...state, slot: 'slide', isModalOpen: true }));
  }

  function confirmRemoveDeck() {
    if (slideDeckIndex !== -1) {
      void lessonApi.deleteLessonDocument(slideDeckIndex);
    }
    openDeleteDeckModal = false;
  }
</script>

{#if mode === MODES.edit}
  <!-- Edit Mode -->
  {@const slideUrlValue = lessonApi.lesson?.slideUrl || ''}
  <InputField
    label={$t('course.navItem.lessons.materials.tabs.slide.slide_link')}
    value={slideUrlValue}
    onInputChange={(e) => {
      lessonApi.updateLessonState('slideUrl', e.currentTarget.value);
    }}
    helperMessage={$t('course.navItem.lessons.materials.tabs.slide.helper_message')}
  />

  <div class="mt-6">
    <p class="ui:text-foreground text-sm font-medium">
      {$t('course.navItem.lessons.materials.tabs.slide.upload_heading')}
    </p>
    <p class="ui:text-muted-foreground mt-1 text-sm">
      {$t('course.navItem.lessons.materials.tabs.slide.upload_hint')}
    </p>

    {#if slideDeck}
      <div class="border-border mt-3 flex items-center gap-3 rounded-lg border p-4">
        <PresentationIcon class="ui:text-muted-foreground size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="ui:text-foreground truncate font-medium">{slideDeck.name}</p>
          {#if slideDeck.processingStatus === 'processing'}
            <p class="ui:text-muted-foreground text-sm">
              {$t('course.navItem.lessons.materials.tabs.document.processing')}
            </p>
          {:else if slideDeck.processingStatus === 'failed'}
            <p class="text-sm text-red-600">
              {$t('course.navItem.lessons.materials.tabs.document.conversion_failed')}
            </p>
          {/if}
        </div>
        <Button variant="ghost" onclick={() => (openDeleteDeckModal = true)}>
          <Trash2Icon size={16} />
        </Button>
      </div>
    {:else}
      <Button class="mt-3" onclick={openSlideUploadModal}>
        {$t('course.navItem.lessons.materials.tabs.slide.upload_action')}
      </Button>
    {/if}
  </div>

  <DeleteModal bind:open={openDeleteDeckModal} onDelete={confirmRemoveDeck} />
{:else}
  <!-- View Mode -->
  {#if slideDeck}
    {#if slideDeck.processingStatus === 'processing'}
      <p class="ui:text-muted-foreground my-3 text-sm">
        {$t('course.navItem.lessons.materials.tabs.document.processing')}
      </p>
    {:else if slideDeck.viewerLink}
      <SlidePdfViewer link={slideDeck.viewerLink} name={slideDeck.name} />
    {:else}
      <p class="my-3 text-sm text-red-600">
        {$t('course.navItem.lessons.materials.tabs.document.conversion_failed')}
      </p>
    {/if}
  {/if}

  {#if url}
    <iframe
      title="Embeded Slides"
      src={url}
      frameborder="0"
      width="100%"
      height="569"
      class="iframe my-3"
      allowfullscreen={true}
    ></iframe>
  {/if}
{/if}
